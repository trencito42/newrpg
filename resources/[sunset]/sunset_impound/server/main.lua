-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Vehicle Impound (server/main.lua)
--  Police confiscation + owner recovery at the impound lot.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetImpound.Config

local function notify(source, msg, kind, duration)
    TriggerClientEvent('sunset:client:notify', source, msg, kind or 'info', duration or 5000)
end

local function getCharId(source)
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.id) or nil
end

-- ═══ IMPOUND (police) ═══

exports.sunset_core:RegisterCallback('sunset:impound:confiscate', function(source, vehicleId, reasonId)
    -- Must be law enforcement on duty
    local isLE = false
    pcall(function()
        isLE = exports.sunset_factions:HasFactionPerm(source, 'impound') == true
    end)
    if not isLE then
        return nil, { localeKey = 'impound.message.only_law_enforcement_on_duty_can_impound_vehicles' }
    end

    vehicleId = tonumber(vehicleId)
    if not vehicleId then return nil, { localeKey = 'impound.message.invalid_vehicle' } end

    reasonId = tostring(reasonId or 'other')
    local reasonRow = nil
    for _, r in ipairs(Cfg.reasons or {}) do
        if r.id == reasonId then reasonRow = r break end
    end
    if not reasonRow then reasonRow = { id = 'other', label = exports.sunset_core:TFor(source, 'impound.ui.other'), fee = Cfg.baseFee or 500 } end

    -- Get vehicle info
    local veh = nil
    pcall(function()
        veh = exports.sunset_vehicles:GetVehicleById(vehicleId)
    end)
    if not veh then return nil, { localeKey = 'impound.message.vehicle_not_found' } end

    local ownerCharId = tonumber(veh.character_id)
    if not ownerCharId then return nil, { localeKey = 'impound.message.this_vehicle_has_no_registered_owner' } end

    -- [SEC2] The officer must actually be next to the vehicle (previously any
    -- vehicle id could be impounded remotely by any officer with the perm).
    do
        local wantPlate = tostring(veh.plate or ''):gsub('%s+', ''):upper()
        local officerPed = GetPlayerPed(source)
        local near = false
        if officerPed and officerPed ~= 0 and wantPlate ~= '' then
            local oc = GetEntityCoords(officerPed)
            for _, ent in ipairs(GetAllVehicles()) do
                if DoesEntityExist(ent) then
                    local p = tostring(GetVehicleNumberPlateText(ent) or ''):gsub('%s+', ''):upper()
                    if p == wantPlate and #(GetEntityCoords(ent) - oc) <= 40.0 then near = true break end
                end
            end
        end
        if not near then return nil, { localeKey = 'impound.message.vehicle_not_found' } end
    end

    local impoundedByName = exports.sunset_core:GetPlayerDisplayName(source) or 'Officer'
    local impoundedBy = getCharId(source)

    -- [RACE] Two officers confiscating the same car at once used to insert two
    -- 'impounded' rows (check-then-insert; the owner would pay twice / a second
    -- record could outlive recovery). Serialise on the vehicle row: lock it,
    -- re-check, take the CURRENT owner from the locked row, insert - one txn.
    local reasonError
    local committed = MySQL.startTransaction(function(query)
        local locked = query.single.await('SELECT id, character_id FROM vehicles WHERE id = ? FOR UPDATE', { vehicleId })
        if not locked or not tonumber(locked.character_id) then reasonError = 'impound.message.vehicle_not_found' return false end
        local existing = query.scalar.await(
            'SELECT id FROM impounded_vehicles WHERE vehicle_id = ? AND status = "impounded" LIMIT 1', { vehicleId })
        if existing then reasonError = 'impound.message.this_vehicle_is_already_impounded' return false end
        local inserted = query.insert.await([[
            INSERT INTO impounded_vehicles (vehicle_id, character_id, impounded_by, impounded_by_name, reason, fee, daily_fee)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], { vehicleId, tonumber(locked.character_id), impoundedBy, impoundedByName, reasonRow.label,
            math.max(0, math.floor(tonumber(reasonRow.fee) or 0)), math.max(0, math.floor(tonumber(Cfg.dailyFee) or 100)) })
        if not inserted then return false end
        ownerCharId = tonumber(locked.character_id)
        return true
    end)
    if not committed then
        return nil, { localeKey = reasonError or 'impound.message.vehicle_not_found' }
    end

    -- Delete the vehicle entity from the world
    pcall(function()
        exports.sunset_vehicles:DeleteVehicleEntity(vehicleId)
    end)

    notify(source, exports.sunset_core:TFor(source, 'impound.msg.vehicle_impounded', { plate = veh.plate or exports.sunset_core:TFor(source, 'impound.word.unknown'), label = tostring(reasonRow.label) }), 'success')

    -- Notify owner if online
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local cid = getCharId(src)
        if cid == ownerCharId then
            notify(src, exports.sunset_core:TFor(src, 'impound.msg.your_vehicle_has_been_impounded_by', { plate = veh.plate or exports.sunset_core:TFor(src, 'impound.word.unknown'), impounded_by_name = tostring(impoundedByName), label = tostring(reasonRow.label) }), 'error', 10000)
        end
    end

    return true
end)

-- ═══ RECOVERY (owner) ═══

exports.sunset_core:RegisterCallback('sunset:impound:list', function(source)
    local charId = getCharId(source)
    if not charId then return nil, { localeKey = 'impound.message.no_character_loaded' } end

    local rows = MySQL.query.await([[
        SELECT iv.id, iv.vehicle_id, iv.reason, iv.fee, iv.daily_fee, iv.impounded_at, iv.impounded_by_name,
               v.plate, v.model
        FROM impounded_vehicles iv
        LEFT JOIN vehicles v ON v.id = iv.vehicle_id
        WHERE iv.character_id = ? AND iv.status = 'impounded'
        ORDER BY iv.impounded_at DESC
    ]], { charId }) or {}

    local now = os.time()
    local result = {}
    for _, row in ipairs(rows) do
        local impoundedAt = 0
        if row.impounded_at then
            -- Parse MySQL timestamp
            local y, mo, d, h, mi, s = tostring(row.impounded_at):match('(%d+)-(%d+)-(%d+) (%d+):(%d+):(%d+)')
            if y then
                impoundedAt = os.time({ year = tonumber(y), month = tonumber(mo), day = tonumber(d),
                    hour = tonumber(h), min = tonumber(mi), sec = tonumber(s) })
            end
        end
        local daysHeld = math.floor((now - impoundedAt) / 86400)
        local totalFee = (tonumber(row.fee) or 0) + (tonumber(row.daily_fee) or 0) * daysHeld

        result[#result + 1] = {
            impoundId = row.id,
            vehicleId = row.vehicle_id,
            plate = row.plate or 'Unknown',
            model = row.model or 'Unknown',
            reason = row.reason,
            fee = totalFee,
            baseFee = tonumber(row.fee) or 0,
            daysHeld = daysHeld,
            impoundedBy = row.impounded_by_name or 'Unknown',
        }
    end

    return result
end)

exports.sunset_core:RegisterCallback('sunset:impound:recover', function(source, impoundId)
    local charId = getCharId(source)
    if not charId then return nil, { localeKey = 'impound.message.no_character_loaded' } end

    impoundId = tonumber(impoundId)
    if not impoundId then return nil, { localeKey = 'impound.message.invalid_impound_record' } end

    local row = MySQL.single.await([[
        SELECT iv.*, v.plate, v.model FROM impounded_vehicles iv
        LEFT JOIN vehicles v ON v.id = iv.vehicle_id
        WHERE iv.id = ? AND iv.character_id = ? AND iv.status = 'impounded'
    ]], { impoundId, charId })
    if not row then return nil, { localeKey = 'impound.message.impound_record_not_found' } end

    -- Calculate total fee
    local now = os.time()
    local impoundedAt = 0
    if row.impounded_at then
        local y, mo, d, h, mi, s = tostring(row.impounded_at):match('(%d+)-(%d+)-(%d+) (%d+):(%d+):(%d+)')
        if y then
            impoundedAt = os.time({ year = tonumber(y), month = tonumber(mo), day = tonumber(d),
                hour = tonumber(h), min = tonumber(mi), sec = tonumber(s) })
        end
    end
    local daysHeld = math.floor((now - impoundedAt) / 86400)
    local totalFee = (tonumber(row.fee) or 0) + (tonumber(row.daily_fee) or 0) * daysHeld

    -- Check if player is near the impound lot (server-side coords check)
    local nearLot = false
    pcall(function()
        local ped = GetPlayerPed(source)
        if ped and ped ~= 0 then
            local coords = GetEntityCoords(ped)
            nearLot = #(coords - Cfg.lot) < 10.0
        end
    end)
    if not nearLot then
        return nil, { localeKey = 'impound.message.you_must_be_at_the_impound_lot_to_recover' }
    end

    -- [SEC2] Atomically claim the record BEFORE charging so two parallel recover
    -- calls cannot both pass the status check (double spawn / double release).
    local claimed = MySQL.update.await(
        'UPDATE impounded_vehicles SET status = "released", released_at = NOW() WHERE id = ? AND character_id = ? AND status = "impounded"',
        { impoundId, charId })
    if claimed ~= 1 then return nil, { localeKey = 'impound.message.impound_record_not_found' } end

    -- Charge the fee
    if not exports.sunset_core:RemoveMoney(source, 'cash', totalFee, 'impound_fee') then
        MySQL.update.await(
            'UPDATE impounded_vehicles SET status = "impounded", released_at = NULL WHERE id = ? AND character_id = ? AND status = "released"',
            { impoundId, charId })
        return nil, { localeKey = 'impound.message.not_enough_cash_recovery_fee_value', formatArgs = { totalFee } }
    end

    -- Respawn the vehicle at the impound lot
    pcall(function()
        exports.sunset_vehicles:SpawnVehicleAt(source, row.vehicle_id, Cfg.lot, Cfg.lotHeading)
    end)

    notify(source, exports.sunset_core:TFor(source, 'impound.msg.vehicle_recovered_for_2', { plate = row.plate or exports.sunset_core:TFor(source, 'impound.word.unknown'), total_fee = tostring(totalFee) }), 'success')
    return { plate = row.plate, fee = totalFee }
end)

-- ═══ AUTO-SELL (expired impounds) ═══

CreateThread(function()
    Wait(30000) -- Wait for server to fully boot
    while true do
        Wait(3600000) -- Check every hour
        local cutoff = os.date('%Y-%m-%d %H:%M:%S', os.time() - (Cfg.autoSellDays or 7) * 86400)
        local expired = MySQL.query.await(
            'SELECT id, vehicle_id FROM impounded_vehicles WHERE status = "impounded" AND impounded_at < ?', { cutoff }) or {}
        for _, row in ipairs(expired) do
            -- [RACE] claim conditionally: a record recovered by its owner in the
            -- meantime (status != impounded) must NOT have its vehicle deleted.
            local claimed = MySQL.update.await(
                'UPDATE impounded_vehicles SET status = "sold" WHERE id = ? AND status = "impounded"', { row.id })
            if tonumber(claimed) == 1 then
                pcall(function()
                    exports.sunset_vehicles:DeleteVehicleRecord(row.vehicle_id)
                end)
                print(('[sunset_impound] Vehicle %d sold (impound expired)'):format(row.vehicle_id))
            end
        end
    end
end)

print('^2[sunset_impound]^7 Vehicle impound system online')
