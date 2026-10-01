local function generatePlate()
    local chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
    local plate = ''
    for i = 1, 8 do
        local idx = math.random(1, #chars)
        plate = plate .. chars:sub(idx, idx)
    end
    return plate
end

local StoreRate = {}
local StateSyncRate = {}
local ParkRate = {}

local function normalizePlate(plate)
    return type(plate) == 'string' and plate:gsub('%s+', ''):upper() or ''
end

local function decodeProps(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) ~= 'string' or raw == '' then return {} end
    local ok, value = pcall(json.decode, raw)
    return ok and type(value) == 'table' and value or {}
end

local function buildVehicleEcuInfo(props)
    props = type(props) == 'table' and props or {}
    if GetResourceState('sunset_tuning') == 'started' then
        local ok, info = pcall(function()
            return exports.sunset_tuning:FormatVehicleInfo(props.ecu)
        end)
        if ok and type(info) == 'table' then return info end
    end
    if props.ecu then
        return {
            tuned = true,
            stock = false,
            summary = 'ECU customizat',
            chips = { 'TUNED' },
            lines = {},
            tune = props.ecu,
        }
    end
    return {
        tuned = false,
        stock = true,
        summary = 'Mapa ECU stock',
        chips = { 'STOCK' },
        lines = { { label = 'ECU', value = 'Factory map' } },
        tune = nil,
    }
end

local ModelPriceCache = {}

local function getVehicleBasePrice(model)
    model = tostring(model or ''):lower():gsub('%s+', '')
    if model == '' then return 25000 end
    if ModelPriceCache[model] then return ModelPriceCache[model] end
    local row = MySQL.single.await('SELECT price FROM dealership_vehicles WHERE LOWER(model) = ? LIMIT 1', { model })
    local price = row and tonumber(row.price) or 25000
    ModelPriceCache[model] = price
    return price
end

local function calculateVehicleInsuranceCost(model, savedCost)
    if savedCost and tonumber(savedCost) and tonumber(savedCost) > 0 then
        return tonumber(savedCost)
    end
    local carPrice = getVehicleBasePrice(model)
    local baseInsurance = math.max(250, math.min(15000, math.floor(carPrice * 0.015)))
    return baseInsurance
end

local function enrichVehicleRow(row)
    if type(row) ~= 'table' then return row end
    local props = decodeProps(row.props)
    row.props = nil
    row.odometer = tonumber(props.odometer)
    row.ecuInfo = buildVehicleEcuInfo(props)
    if row.ecuInfo and row.ecuInfo.tune then
        row.ecu = row.ecuInfo.tune
    end

    local model = (row.model or ''):lower()
    local insuranceCost = calculateVehicleInsuranceCost(model, row.insurance_cost)
    row.insuranceCost = insuranceCost
    row.insurancePoints = math.max(0, tonumber(row.insurance_points) or 5)
    row.insuranceLevel = math.max(1, math.min(11, tonumber(row.insurance_level) or 1))
    row.destroyed = (row.destroyed == 1 or row.destroyed == true or row.destroyed == '1')
    row.claimCost = math.floor(insuranceCost * row.insuranceLevel)
    row.renewCost = math.floor(insuranceCost * 3)
    return row
end

local function enrichVehicleList(rows)
    if type(rows) ~= 'table' then return {} end
    for i = 1, #rows do
        rows[i] = enrichVehicleRow(rows[i])
    end
    return rows
end

exports('EnrichVehicleRow', enrichVehicleRow)
exports('EnrichVehicleList', enrichVehicleList)
exports('BuildVehicleEcuInfo', buildVehicleEcuInfo)

local function plateTextMatches(a, b)
    a = normalizePlate(a)
    b = normalizePlate(b)
    if a == '' or b == '' then return false end
    return a == b
end

local function findOwnedVehicle(charId, plate)
    local rows = MySQL.query.await(
        'SELECT id, plate FROM vehicles WHERE character_id = ?',
        { charId }
    ) or {}
    for _, row in ipairs(rows) do
        if plateTextMatches(row.plate, plate) then
            return row
        end
    end
    return nil
end

local function findDrivenVehicle(source, plate)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    local playerCoords = GetEntityCoords(ped)
    for _, vehicle in ipairs(GetAllVehicles()) do
        if normalizePlate(GetVehicleNumberPlateText(vehicle)) == plate then
            local coords = GetEntityCoords(vehicle)
            if #(playerCoords - coords) <= 12.0 and GetPedInVehicleSeat(vehicle, -1) == ped then
                return vehicle
            end
        end
    end
    return nil
end

local function findVehicleEntityByPlate(plate)
    plate = normalizePlate(plate)
    if plate == '' then return nil end
    for _, vehicle in ipairs(GetAllVehicles()) do
        if DoesEntityExist(vehicle) and normalizePlate(GetVehicleNumberPlateText(vehicle)) == plate then
            return vehicle
        end
    end
    return nil
end

local function hasParkedPosition(veh)
    return veh
        and veh.parked_x ~= nil
        and veh.parked_y ~= nil
        and veh.parked_z ~= nil
        and tonumber(veh.parked_x) ~= nil
        and tonumber(veh.parked_y) ~= nil
        and tonumber(veh.parked_z) ~= nil
end

local function buildSpawnOpts(veh)
    local garage = Sunset.Garages[veh.garage or 'legion'] or Sunset.Garages.legion
    if not garage or not garage.spawn then return nil end

    if hasParkedPosition(veh) then
        return {
            x = tonumber(veh.parked_x),
            y = tonumber(veh.parked_y),
            z = tonumber(veh.parked_z),
            w = tonumber(veh.parked_h) or 0.0,
        }
    end

    local spawn = garage.spawn
    return {
        x = spawn.x,
        y = spawn.y,
        z = spawn.z,
        w = spawn.w or 0.0,
    }
end

exports.sunset_core:RegisterCallback('sunset:getVehicles', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return {} end
    local rows = MySQL.query.await(
        'SELECT id, plate, model, fuel, engine, body, stored, garage, parked_x, parked_y, parked_z, parked_h, props, insurance_points, insurance_level, destroyed, insurance_cost FROM vehicles WHERE character_id = ?',
        { char.id }
    ) or {}
    return enrichVehicleList(rows)
end)

local function normalizeStored(val)
    if val == true or val == 1 or val == '1' then return 1 end
    if val == false or val == 0 or val == '0' then return 0 end
    local n = tonumber(val)
    if n == 1 then return 1 end
    if n == 0 then return 0 end
    return 1
end

exports.sunset_core:RegisterCallback('sunset:spawnVehicle', function(source, vehicleId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end

    -- [AUDIT P6-10] Jailed/downed players must not pull cars from the garage.
    if exports.sunset_core:IsIncapacitated(source) then
        return nil, { localeKey = 'vehicles.message.you_cannot_access_your_vehicles_right_now' }
    end

    vehicleId = tonumber(vehicleId)
    if not vehicleId then return nil, { localeKey = 'vehicles.message.invalid_vehicle' } end

    local veh = MySQL.single.await(
        'SELECT * FROM vehicles WHERE id = ? AND character_id = ?',
        { vehicleId, char.id }
    )
    if not veh then return nil, { localeKey = 'vehicles.message.vehicle_not_found' } end

    if veh.destroyed == 1 or veh.destroyed == true or veh.destroyed == '1' then
        return nil, { localeKey = 'vehicles.message.this_vehicle_is_totaled_file_an_insurance_claim_from' }
    end

    local stored = normalizeStored(veh.stored)
    local outPlates = {}

    if stored == 1 then
        outPlates = {}
        -- [SEC2] atomic claim: two parallel spawn requests must not both spawn the car
        local claimed = MySQL.update.await('UPDATE vehicles SET stored = 0 WHERE id = ? AND character_id = ? AND stored = 1', { veh.id, char.id })
        if claimed ~= 1 then return nil, { localeKey = 'vehicles.message.vehicle_not_available' } end
    elseif stored == 0 then
        outPlates = { { plate = veh.plate } }
    else
        return nil, { localeKey = 'vehicles.message.vehicle_not_available' }
    end

    local spawnOpts = buildSpawnOpts(veh)
    if not spawnOpts then
        return nil, { localeKey = 'vehicles.message.garage_spawn_not_configured' }
    end

    -- [AUDIT F7.1] Broadcast cleanup to ALL clients: a key-holder may be driving the
    -- "out" vehicle far from the owner; source-only cleanup left a plate-dupe window.
    if #outPlates > 0 then
        TriggerClientEvent('sunset:client:cleanupOwnedVehicles', -1, outPlates)
    end
    TriggerClientEvent('sunset:client:spawnOwnedVehicle', source, veh, spawnOpts)
    return true
end)

exports.sunset_core:RegisterCallback('sunset:getVehicleById', function(source, vehicleId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil end
    return enrichVehicleRow(MySQL.single.await(
        'SELECT id, plate, model, fuel, engine, body, stored, garage, parked_x, parked_y, parked_z, parked_h, props, insurance_points, insurance_level, destroyed, insurance_cost FROM vehicles WHERE id = ? AND character_id = ?',
        { vehicleId, char.id }
    ))
end)

exports.sunset_core:RegisterCallback('sunset:storeVehicle', function(source, garageId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end

    TriggerClientEvent('sunset:client:storeVehicleRequest', source, garageId or 'legion')
    return true
end)

local function storeOwnedVehicle(source, netId, plate, props, fuelLevel, garageId, parked)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end

    local now = GetGameTimer()
    if now - (StoreRate[source] or 0) < 1500 then return nil, { localeKey = 'vehicles.message.please_wait_before_storing_again' } end
    StoreRate[source] = now

    plate = normalizePlate(plate)
    if plate == '' or #plate > 8 or type(props) ~= 'table' then return nil, { localeKey = 'vehicles.message.invalid_vehicle_data' } end

    local owned = MySQL.single.await(
        'SELECT id, props, fuel, engine, body FROM vehicles WHERE REPLACE(UPPER(plate), " ", "") = ? AND character_id = ?',
        { plate, char.id }
    )
    if not owned then return nil, { localeKey = 'vehicles.message.this_vehicle_is_not_owned_by_your_character' } end

    -- [AUDIT F1.1] Whitelist client-reported props keys. Performance data (ecu) can
    -- ONLY come from the DB (paid tuning flow); cosmetics/colors/odometer from client.
    -- Anything else is dropped instead of being persisted.
    local storedProps = decodeProps(owned.props)
    local clientProps = props
    props = {}
    local PROPS_WHITELIST = { 'cosmetics', 'color1', 'color2', 'odometer' }
    for _, key in ipairs(PROPS_WHITELIST) do
        if clientProps[key] ~= nil then props[key] = clientProps[key] end
    end
    for key, value in pairs(storedProps) do
        if props[key] == nil then props[key] = value end
    end
    -- ecu/hardware: always carry over the persisted (paid) values, never client input.
    props.ecu = storedProps.ecu
    local previousOdometer = math.max(0, tonumber(storedProps.odometer) or 0)
    -- [AUDIT F5.2] Monotonic AND capped (+8 km per store) like the sync/park paths.
    props.odometer = math.min(
        math.max(previousOdometer, tonumber(props.odometer) or previousOdometer),
        previousOdometer + 8.0)
    local encodedProps = json.encode(props)
    if #encodedProps > 32768 then return nil, { localeKey = 'vehicles.message.vehicle_data_is_too_large' } end

    local vehicle = tonumber(netId) and NetworkGetEntityFromNetworkId(tonumber(netId)) or 0
    if vehicle == 0 or not DoesEntityExist(vehicle)
        or normalizePlate(GetVehicleNumberPlateText(vehicle)) ~= plate then
        vehicle = findVehicleEntityByPlate(plate)
    end

    local playerPed = GetPlayerPed(source)
    if vehicle and vehicle ~= 0 and DoesEntityExist(vehicle) then
        local driver = GetPedInVehicleSeat(vehicle, -1)
        if driver ~= 0 and driver ~= playerPed then
            return nil, { localeKey = 'vehicles.message.someone_else_is_currently_driving_this_vehicle' }
        end
    end

    local engine = (vehicle and vehicle ~= 0 and DoesEntityExist(vehicle))
        and math.max(-4000, math.min(1000, GetVehicleEngineHealth(vehicle)))
        or (tonumber(owned.engine) or 1000.0)

    local body = (vehicle and vehicle ~= 0 and DoesEntityExist(vehicle))
        and math.max(0, math.min(1000, GetVehicleBodyHealth(vehicle)))
        or (tonumber(owned.body) or 1000.0)

    -- [AUDIT F3.1] Fuel must never increase through the store path (same monotonic
    -- cap as sync/park: +0.5 tolerance). Otherwise a modified client stores
    -- fuelLevel=100 for a free tank, bypassing paid refueling.
    local previousFuel = math.max(0, math.min(100, tonumber(owned.fuel) or 100.0))
    if fuelLevel == nil or tonumber(fuelLevel) == nil then
        fuelLevel = previousFuel
    else
        fuelLevel = math.max(0, math.min(math.min(100, previousFuel + 0.5), tonumber(fuelLevel) or previousFuel))
    end
    -- Prefer the server-side entity fuel reading when the vehicle is resolvable.
    -- GetVehicleFuelLevel is a client-only native on the current server artifact.
    -- Keep the persisted monotonic value when the server cannot read fuel instead
    -- of crashing the whole store callback.
    if vehicle and vehicle ~= 0 and DoesEntityExist(vehicle)
        and type(GetVehicleFuelLevel) == 'function' then
        local entityFuel = GetVehicleFuelLevel(vehicle)
        if entityFuel and entityFuel > 0 then
            fuelLevel = math.min(fuelLevel, math.max(0, math.min(100, entityFuel)))
        end
    end

    local px, py, pz, ph = nil, nil, nil, nil
    -- [SPAWN FIX] parked coords are NO LONGER persisted by the garage store
    -- (see UPDATE below); only /park (parkOwnedVehicle) sets them. This block
    -- is kept only to consume the client payload shape; values are ignored.
    if type(parked) == 'table' and parked.x then
        px = tonumber(parked.x)
    end

    -- [PARK FIX] Store keeps the existing parked_* position: /park is the ONLY
    -- writer of the parked location. Storing hides the car but it respawns
    -- where the player parked it (front of the house, rented spot, anywhere).
    -- The old "NULL on store" made every garage store forget the park location.
    local changed = MySQL.update.await([[
        UPDATE vehicles SET stored = 1, garage = ?, props = ?, fuel = ?, engine = ?, body = ?
        WHERE id = ? AND character_id = ?
    ]], {
        tostring(garageId or 'legion'):sub(1, 32),
        encodedProps,
        fuelLevel,
        engine,
        body,
        owned.id,
        char.id,
    })
    if not changed or changed < 1 then return nil, { localeKey = 'vehicles.message.vehicle_could_not_be_stored' } end
    if vehicle and vehicle ~= 0 and DoesEntityExist(vehicle) then
        DeleteEntity(vehicle)
    end
    TriggerClientEvent('sunset:client:cleanupOwnedVehicles', -1, { { plate = plate } })
    return true
end

exports.sunset_core:RegisterCallback('sunset:storeOwnedVehicle', function(source, netId, plate, props, fuelLevel, garageId, parked)
    return storeOwnedVehicle(source, netId, plate, props, fuelLevel, garageId, parked)
end)

RegisterNetEvent('sunset:server:vehicleDestroyed', function(netId, plate)
    local src = source
    local char = exports.sunset_core:GetCharacter(src)
    if not char then return end

    plate = normalizePlate(plate)
    if plate == '' then return end

    local veh = MySQL.single.await(
        'SELECT id, model, insurance_points, insurance_level, insurance_cost, destroyed FROM vehicles WHERE REPLACE(UPPER(plate), " ", "") = ? AND character_id = ?',
        { plate, char.id }
    )
    if not veh then return end

    if veh.destroyed == 1 or veh.destroyed == true or veh.destroyed == '1' then
        return
    end

    -- [AUDIT P2-12] Reject if the resolved entity is perfectly healthy: a client
    -- should not be able to remotely total an undamaged car (self-harm only, but
    -- it desyncs DB state and can grief insurance level progression).
    local checkVeh = tonumber(netId) and NetworkGetEntityFromNetworkId(tonumber(netId)) or 0
    if checkVeh == 0 or not DoesEntityExist(checkVeh) then
        checkVeh = findVehicleEntityByPlate(plate) or 0
    end
    if checkVeh ~= 0 and DoesEntityExist(checkVeh) then
        local engineHealth = GetVehicleEngineHealth(checkVeh)
        local bodyHealth = GetVehicleBodyHealth(checkVeh)
        if engineHealth > 300.0 and bodyHealth > 500.0 and not IsEntityDead(checkVeh) then
            return
        end
    end

    local currentLevel = math.max(1, math.min(11, tonumber(veh.insurance_level) or 1))
    local nextLevel = math.min(11, currentLevel + 1)
    local currentPoints = math.max(0, tonumber(veh.insurance_points) or 0)
    local nextPoints = math.max(0, currentPoints - 1)
    local baseCost = calculateVehicleInsuranceCost(veh.model, veh.insurance_cost)
    local claimCost = math.floor(baseCost * nextLevel)

    MySQL.update.await([[
        UPDATE vehicles
        SET destroyed = 1,
            stored = 0,
            insurance_points = ?,
            insurance_level = ?,
            engine = -4000.0
        WHERE id = ?
    ]], { nextPoints, nextLevel, veh.id })

    local vehicle = tonumber(netId) and NetworkGetEntityFromNetworkId(tonumber(netId)) or 0
    if vehicle == 0 or not DoesEntityExist(vehicle) then
        vehicle = findVehicleEntityByPlate(plate)
    end

    TriggerClientEvent('sunset:client:notify', src,
        ('Your vehicle [%s] was totaled. Insurance tier %d/11 · Claim fee: $%s · Points remaining: %d. Open /v to recover it.'):format(
            plate, nextLevel, claimCost, nextPoints
        ),
        'error'
    )

    if vehicle and vehicle ~= 0 and DoesEntityExist(vehicle) then
        SetTimeout(12000, function()
            if DoesEntityExist(vehicle) then
                DeleteEntity(vehicle)
            end
            TriggerClientEvent('sunset:client:cleanupOwnedVehicles', -1, { { plate = plate } })
        end)
    end
end)

exports.sunset_core:RegisterCallback('sunset:claimVehicleInsurance', function(source, vehicleId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_active_character_loaded' } end

    vehicleId = tonumber(vehicleId)
    if not vehicleId then return nil, { localeKey = 'vehicles.message.invalid_vehicle_fc2a3f' } end

    local veh = MySQL.single.await(
        'SELECT id, model, plate, destroyed, insurance_points, insurance_level, insurance_cost, garage FROM vehicles WHERE id = ? AND character_id = ?',
        { vehicleId, char.id }
    )
    if not veh then return nil, { localeKey = 'vehicles.message.vehicle_not_found_871b72' } end

    local isDestroyed = (veh.destroyed == 1 or veh.destroyed == true or veh.destroyed == '1')
    if not isDestroyed then
        return nil, { localeKey = 'vehicles.message.this_vehicle_is_not_totaled_retrieve_it_from_the' }
    end

    local points = math.max(0, tonumber(veh.insurance_points) or 0)
    if points <= 0 then
        return nil, { localeKey = 'vehicles.message.you_have_no_insurance_points_left_renew_your_coverage' }
    end

    local baseCost = calculateVehicleInsuranceCost(veh.model, veh.insurance_cost)
    local level = math.max(1, math.min(11, tonumber(veh.insurance_level) or 1))
    local claimCost = math.floor(baseCost * level)

    local paidAccount = nil
    if exports.sunset_core:RemoveMoney(source, 'bank', claimCost, 'vehicle_insurance_claim') then
        paidAccount = 'bank'
    elseif exports.sunset_core:RemoveMoney(source, 'cash', claimCost, 'vehicle_insurance_claim') then
        paidAccount = 'cash'
    else
        return nil, { localeKey = 'vehicles.message.insufficient_funds_you_need_value_in_bank_or_cash', formatArgs = { claimCost } }
    end

    local plate = normalizePlate(veh.plate)
    local entity = findVehicleEntityByPlate(plate)
    if entity and entity ~= 0 and DoesEntityExist(entity) then
        DeleteEntity(entity)
    end
    TriggerClientEvent('sunset:client:cleanupOwnedVehicles', -1, { { plate = plate } })

    MySQL.update.await([[
        UPDATE vehicles
        SET stored = 1, destroyed = 0, engine = 1000.0, body = 1000.0, fuel = 100.0,
            parked_x = NULL, parked_y = NULL, parked_z = NULL, parked_h = NULL
        WHERE id = ? AND character_id = ?
    ]], { veh.id, char.id })

    TriggerClientEvent('sunset:client:notify', source,
        exports.sunset_core:TFor(source, 'vehicles.message.insurance_claim_approved_for_value_value_your_vehicle_has_been_re', claimCost, paidAccount),
        'success'
    )

    return { ok = true, claimCost = claimCost }
end)

RegisterNetEvent('sunset:vehicles:adminRepairDatabase', function(plate)
    local src = source
    -- [AUDIT P1-01] This event repairs/undestroys vehicles: admins only.
    local okAdmin, isAdmin = pcall(function() return exports.sunset_admin:IsAdmin(src, 3) end)
    if not okAdmin or not isAdmin then return end
    local char = exports.sunset_core:GetCharacter(src)
    if not char then return end
    plate = normalizePlate(plate)
    if plate == '' then return end

    MySQL.update.await([[
        UPDATE vehicles
        SET destroyed = 0, engine = 1000.0, body = 1000.0, fuel = 100.0
        WHERE REPLACE(UPPER(plate), " ", "") = ? AND character_id = ?
    ]], { plate, char.id })
end)


exports.sunset_core:RegisterCallback('sunset:renewVehicleInsurance', function(source, vehicleId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_active_character_loaded' } end

    vehicleId = tonumber(vehicleId)
    if not vehicleId then return nil, { localeKey = 'vehicles.message.invalid_vehicle_fc2a3f' } end

    local veh = MySQL.single.await(
        'SELECT id, model, plate, insurance_points, insurance_level, insurance_cost FROM vehicles WHERE id = ? AND character_id = ?',
        { vehicleId, char.id }
    )
    if not veh then return nil, { localeKey = 'vehicles.message.vehicle_not_found_871b72' } end

    local baseCost = calculateVehicleInsuranceCost(veh.model, veh.insurance_cost)
    local renewCost = math.floor(baseCost * 3)

    local paidAccount = nil
    if exports.sunset_core:RemoveMoney(source, 'bank', renewCost, 'vehicle_insurance_renew') then
        paidAccount = 'bank'
    elseif exports.sunset_core:RemoveMoney(source, 'cash', renewCost, 'vehicle_insurance_renew') then
        paidAccount = 'cash'
    else
        return nil, { localeKey = 'vehicles.message.insufficient_funds_you_need_value_to_renew_5_insurance', formatArgs = { renewCost } }
    end

    MySQL.update.await([[
        UPDATE vehicles
        SET insurance_points = insurance_points + 5
        WHERE id = ? AND character_id = ?
    ]], { veh.id, char.id })

    TriggerClientEvent('sunset:client:notify', source,
        exports.sunset_core:TFor(source, 'vehicles.message.purchased_5_insurance_points_for_value_value', renewCost, paidAccount),
        'success'
    )

    return { ok = true, renewCost = renewCost }
end)

exports.sunset_core:RegisterCallback('sunset:getDrivenOwnedVehicleState', function(source, netId, plate)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end
    plate = normalizePlate(plate)
    if plate == '' then return nil, { localeKey = 'vehicles.message.invalid_vehicle_plate' } end

    local vehicle = tonumber(netId) and NetworkGetEntityFromNetworkId(tonumber(netId)) or 0
    local ped = GetPlayerPed(source)
    if vehicle == 0 or not DoesEntityExist(vehicle) or ped == 0
        or GetPedInVehicleSeat(vehicle, -1) ~= ped
        or normalizePlate(GetVehicleNumberPlateText(vehicle)) ~= plate then
        return nil, { localeKey = 'vehicles.message.you_must_be_driving_the_vehicle' }
    end

    return MySQL.single.await(
        'SELECT id, props, fuel, engine, body FROM vehicles WHERE REPLACE(UPPER(plate), " ", "") = ? AND character_id = ? AND stored = 0',
        { plate, char.id }
    )
end)

exports.sunset_core:RegisterCallback('sunset:syncOwnedVehicleState', function(source, netId, plate, reportedFuel, reportedOdometer)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end
    local now = GetGameTimer()
    if now - (StateSyncRate[source] or 0) < 10000 then return true end
    StateSyncRate[source] = now

    plate = normalizePlate(plate)
    local row = MySQL.single.await(
        'SELECT id, fuel, props FROM vehicles WHERE REPLACE(UPPER(plate), " ", "") = ? AND character_id = ? AND stored = 0',
        { plate, char.id }
    )
    if not row then return nil, { localeKey = 'vehicles.message.owned_vehicle_not_active' } end
    local vehicle = tonumber(netId) and NetworkGetEntityFromNetworkId(tonumber(netId)) or 0
    local ped = GetPlayerPed(source)
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) or not ped or ped == 0
        or GetPedInVehicleSeat(vehicle, -1) ~= ped or normalizePlate(GetVehicleNumberPlateText(vehicle)) ~= plate then
        return nil, { localeKey = 'vehicles.message.vehicle_state_rejected' }
    end

    -- Driving may only consume fuel here. Refuelling has separate paid callbacks.
    local previousFuel = math.max(0, math.min(100, tonumber(row.fuel) or 100))
    local fuelValue = math.max(0, math.min(previousFuel + 0.5, tonumber(reportedFuel) or previousFuel))
    local engine = math.max(-4000, math.min(1000, GetVehicleEngineHealth(vehicle)))
    local body = math.max(0, math.min(1000, GetVehicleBodyHealth(vehicle)))
    local props = decodeProps(row.props)
    local previousOdometer = math.max(0, tonumber(props.odometer) or 0)
    local requestedOdometer = math.max(previousOdometer, tonumber(reportedOdometer) or previousOdometer)
    -- With a 30-second client interval, 8 km is already over 900 km/h.
    props.odometer = math.min(requestedOdometer, previousOdometer + 8.0)
    MySQL.update.await('UPDATE vehicles SET fuel = ?, engine = ?, body = ?, props = ? WHERE id = ? AND character_id = ?',
        { fuelValue, engine, body, json.encode(props), row.id, char.id })
    return true
end)

AddEventHandler('playerDropped', function()
    local src = source
    StoreRate[src] = nil
    StateSyncRate[src] = nil
    ParkRate[src] = nil

    -- [AUDIT P6-03] Capture the character id SYNCHRONOUSLY: sunset_core's own
    -- playerDropped handler nils Players[src] and a deferred GetCharacter call
    -- would race it and silently skip cleanup.
    local charId
    local okChar, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
    if okChar and char then charId = char.id end
    if not charId then return end

    -- [AUDIT F7.2] Clean up this character's out-of-garage vehicles so they don't
    -- orphan in-world (mission entities never auto-despawn) with stale DB state.
    CreateThread(function()
        local ok, err = pcall(function()
            local rows = MySQL.query.await(
                'SELECT id, plate, parked_x, parked_y FROM vehicles WHERE character_id = ? AND stored = 0',
                { charId }
            ) or {}
            for _, row in ipairs(rows) do
                local plate = normalizePlate(row.plate)
                local veh = plate ~= '' and findVehicleEntityByPlate(plate) or 0
                local entityOk = veh and veh ~= 0 and DoesEntityExist(veh)
                -- If we can resolve the entity, persist where it was left and remove it;
                -- otherwise just mark it stored so it doesn't dupe on next login.
                if entityOk then
                    -- [PARK FIX] Disconnect stores the car but KEEPS its parked
                    -- position: /park is the only writer of parked_* coords, so
                    -- after reconnect the car respawns exactly where the player
                    -- parked it (garage spawn only when no park was ever set).
                    MySQL.update.await([[
                        UPDATE vehicles SET stored = 1,
                            engine = ?, body = ?
                        WHERE id = ? AND character_id = ?
                    ]], {
                        math.max(-4000, math.min(1000, GetVehicleEngineHealth(veh))),
                        math.max(0, math.min(1000, GetVehicleBodyHealth(veh))),
                        row.id, charId,
                    })
                    DeleteEntity(veh)
                else
                    MySQL.update.await('UPDATE vehicles SET stored = 1 WHERE id = ? AND character_id = ?',
                        { row.id, charId })
                end
                TriggerClientEvent('sunset:client:cleanupOwnedVehicles', -1, { { plate = plate } })
            end
        end)
        if not ok then
            print(('[sunset_vehicles] disconnect cleanup error: %s'):format(tostring(err)))
        end
    end)
end)

local function isNearGasStation(playerCoords, maxDist)
    maxDist = maxDist or 30.0
    if not Sunset or not Sunset.GasStations then return false end
    for _, station in ipairs(Sunset.GasStations) do
        if station.coords and #(playerCoords - station.coords) <= maxDist then
            return true
        end
        if station.pumps then
            for _, pump in ipairs(station.pumps) do
                local pCoords = vector3(pump.x, pump.y, pump.z)
                if #(playerCoords - pCoords) <= 15.0 then
                    return true
                end
            end
        end
    end
    return false
end

exports.sunset_core:RegisterCallback('sunset:refuelVehiclePartial', function(source, fromFuel, toFuel, plate)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil, { localeKey = 'vehicles.message.invalid_player_ped' } end
    if not isNearGasStation(GetEntityCoords(ped)) then
        return nil, { localeKey = 'vehicles.message.you_must_be_at_a_gas_station_pump_to' }
    end

    local vehicle = GetVehiclePedIsIn(ped, false)
    if not vehicle or vehicle == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then
        return nil, { localeKey = 'vehicles.message.sit_in_the_driver_seat_beside_the_pump_while' }
    end
    local actualPlate = normalizePlate(GetVehicleNumberPlateText(vehicle))
    if actualPlate == '' or actualPlate ~= normalizePlate(plate) then
        return nil, { localeKey = 'vehicles.message.the_active_vehicle_does_not_match_this_refuel_session' }
    end
    local owned = findOwnedVehicle(char.id, actualPlate)
    if not owned then return nil, { localeKey = 'vehicles.message.only_your_personal_vehicle_can_be_refuelled_from_this' } end
    local currentFuel = math.max(0, math.min(100, tonumber(owned.fuel) or 0))
    local requestedFuel = math.max(0, math.min(100, tonumber(toFuel) or currentFuel))
    if requestedFuel <= currentFuel + 0.05 then return nil, { localeKey = 'vehicles.message.the_tank_did_not_receive_fuel_no_payment_was' } end
    local added = requestedFuel - currentFuel
    local pricePer = Sunset.Config.FuelPricePerPercent or 1.75
    local cost = math.ceil(added * pricePer)
    if cost < 1 then return nil, { localeKey = 'vehicles.message.the_fuel_amount_is_too_small_to_bill' } end
    local account = (tonumber(char.cash) or 0) >= cost and 'cash'
        or ((tonumber(char.bank) or 0) >= cost and 'bank' or nil)
    if not account then return nil, { localeKey = 'vehicles.message.you_need_value_in_cash_or_bank_for_this', formatArgs = { cost } } end
    local committed = MySQL.startTransaction(function(query)
        local lockedFuel = query.single.await('SELECT id, fuel FROM vehicles WHERE id=? FOR UPDATE', { owned.id })
        if not lockedFuel then return false end
        -- Re-read fuel under the row lock: the pre-check value may be stale if
        -- two checkouts raced; re-validate the increase against the locked row.
        local lockedCurrent = math.max(0, math.min(100, tonumber(lockedFuel.fuel) or 0))
        if requestedFuel <= lockedCurrent + 0.05 then return false end
        local charged = query.update.await(
            ('UPDATE characters SET %s=%s-? WHERE id=? AND %s>=?'):format(account, account, account),
            { cost, char.id, cost })
        if tonumber(charged) ~= 1 then return false end
        local saved = query.update.await([[UPDATE vehicles SET fuel=? WHERE id=? AND character_id=?
            AND fuel <= ?]], { requestedFuel, owned.id, char.id, lockedCurrent + 0.01 })
        return tonumber(saved) == 1
    end)
    if not committed then return nil, { localeKey = 'vehicles.message.fuel_checkout_was_cancelled_because_the_balance_or_tank' } end
    exports.sunset_core:RefreshMoney(source)

    if GetResourceState('sunset_businesses') == 'started' then
        exports.sunset_businesses:RecordSaleAtCoords(GetEntityCoords(ped), 'gas', cost)
    end

    return { newFuel = requestedFuel, cost = cost, liters = added }
end)

exports.sunset_core:RegisterCallback('sunset:fillGasCan', function(source, targetLiters)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil, { localeKey = 'vehicles.message.invalid_player_ped' } end
    if not isNearGasStation(GetEntityCoords(ped)) then
        return nil, { localeKey = 'vehicles.message.you_must_be_at_a_gas_station_pump_to_2d5458' }
    end

    if not exports.sunset_inventory:HasItem(source, 'gas_can', 1) then
        return nil, { localeKey = 'vehicles.message.you_need_a_gas_can' }
    end

    local maxLiters = Sunset.GetGasCanMaxLiters()
    local current = exports.sunset_inventory:GetGasCanLiters(source) or 0
    targetLiters = math.max(current, math.min(maxLiters, tonumber(targetLiters) or maxLiters))
    local added = targetLiters - current
    if added <= 0.05 then return nil, { localeKey = 'vehicles.message.gas_can_is_already_full' } end

    local pricePer = Sunset.Config.FuelPricePerLiter or 2.92
    local cost = math.ceil(added * pricePer)
    local account = (tonumber(char.cash) or 0) >= cost and 'cash'
        or ((tonumber(char.bank) or 0) >= cost and 'bank' or nil)
    if not account then return nil, { localeKey = 'vehicles.message.you_need_value_in_cash_or_bank_to_fill', formatArgs = { cost } } end
    local gasRow = MySQL.single.await([[SELECT id,metadata FROM character_inventory
        WHERE character_id=? AND item='gas_can' AND count>0 ORDER BY id LIMIT 1]], { char.id })
    if not gasRow then return nil, { localeKey = 'vehicles.message.the_gas_can_is_no_longer_in_your_inventory' } end
    local committed = MySQL.startTransaction(function(query)
        local charged = query.await(
            ('UPDATE characters SET %s=%s-? WHERE id=? AND %s>=?'):format(account, account, account),
            { cost, char.id, cost })
        if tonumber(charged) ~= 1 then return false end
        local saved = query.await([[UPDATE character_inventory SET metadata=?
            WHERE id=? AND character_id=? AND item='gas_can' AND count>0]],
            { json.encode({ liters = targetLiters }), gasRow.id, char.id })
        return tonumber(saved) == 1
    end)
    if not committed then return nil, { localeKey = 'vehicles.message.gas_can_checkout_was_cancelled_because_the_item_or' } end
    exports.sunset_core:RefreshMoney(source)
    exports.sunset_inventory:ReloadInventory(source)

    if GetResourceState('sunset_businesses') == 'started' then
        exports.sunset_businesses:RecordSaleAtCoords(GetEntityCoords(ped), 'gas', cost)
    end

    return { liters = targetLiters, maxLiters = maxLiters, cost = cost, added = added }
end)

exports.sunset_core:RegisterCallback('sunset:useGasCanOnVehicle', function(source, plate)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end
    if not exports.sunset_inventory:HasItem(source, 'gas_can', 1) then
        return nil, { localeKey = 'vehicles.message.you_need_a_gas_can' }
    end

    plate = normalizePlate(plate)
    if plate == '' then return nil, { localeKey = 'vehicles.message.invalid_vehicle' } end

    local owned = findOwnedVehicle(char.id, plate)
    if not owned then return nil, { localeKey = 'vehicles.message.this_is_not_your_vehicle' } end

    local vehicle = findVehicleEntityByPlate(plate)
    local ped = GetPlayerPed(source)
    if not vehicle or not DoesEntityExist(vehicle) or not ped or ped == 0
        or #(GetEntityCoords(ped) - GetEntityCoords(vehicle)) > 4.5 then
        return nil, { localeKey = 'vehicles.message.stand_beside_your_vehicle_before_using_the_gas_can' }
    end

    local canLiters = exports.sunset_inventory:GetGasCanLiters(source) or 0
    local maxCanLiters = Sunset.GetGasCanMaxLiters()
    if canLiters <= 0.05 then return nil, { localeKey = 'vehicles.message.gas_can_is_empty_fill_it_at_a_pump' } end

    local vehicleClass = GetVehicleClass(vehicle)
    local tankCapacity = Sunset.GetVehicleTankCapacityLiters(vehicleClass)
    if tankCapacity <= 0 then return nil, { localeKey = 'vehicles.message.this_vehicle_has_no_fuel_tank' } end

    local currentFuelPercent = math.max(0, math.min(100, tonumber(owned.fuel) or 0))
    local currentTankLiters = Sunset.PercentToTankLiters and Sunset.PercentToTankLiters(currentFuelPercent, vehicleClass)
        or (currentFuelPercent / 100.0) * tankCapacity
    if currentTankLiters >= tankCapacity - 0.05 then
        return nil, { localeKey = 'vehicles.message.vehicle_tank_is_already_full' }
    end

    local roomLiters = tankCapacity - currentTankLiters
    local transferLiters = math.min(canLiters, roomLiters)
    if transferLiters <= 0.05 then return nil, { localeKey = 'vehicles.message.vehicle_tank_is_already_full' } end

    local fromTankLiters = currentTankLiters
    local newTankLiters = currentTankLiters + transferLiters
    local newCanLiters = canLiters - transferLiters
    local vehicleFuelPercent = Sunset.TankLitersToPercent(newTankLiters, vehicleClass)

    local gasRow = MySQL.single.await([[SELECT id,count FROM character_inventory
        WHERE character_id=? AND item='gas_can' AND count>0 ORDER BY id LIMIT 1]], { char.id })
    if not gasRow then return nil, { localeKey = 'vehicles.message.the_gas_can_is_no_longer_in_your_inventory' } end
    local committed = MySQL.startTransaction(function(query)
        local saved = query.await([[UPDATE vehicles SET fuel=? WHERE id=? AND character_id=? AND fuel=?]],
            { vehicleFuelPercent, owned.id, char.id, owned.fuel })
        if tonumber(saved) ~= 1 then return false end
        local changed
        if newCanLiters <= 0.1 and tonumber(gasRow.count) <= 1 then
            changed = query.await("DELETE FROM character_inventory WHERE id=? AND character_id=? AND item='gas_can'", { gasRow.id, char.id })
        elseif newCanLiters <= 0.1 then
            changed = query.await("UPDATE character_inventory SET count=count-1 WHERE id=? AND character_id=? AND item='gas_can' AND count>1", { gasRow.id, char.id })
        else
            changed = query.await("UPDATE character_inventory SET metadata=? WHERE id=? AND character_id=? AND item='gas_can' AND count>0",
                { json.encode({ liters = newCanLiters }), gasRow.id, char.id })
        end
        return tonumber(changed) == 1
    end)
    if not committed then return nil, { localeKey = 'vehicles.message.fuel_transfer_was_cancelled_because_the_vehicle_or_gas' } end
    exports.sunset_inventory:ReloadInventory(source)

    return {
        vehicleFuel = vehicleFuelPercent,
        fromTankLiters = fromTankLiters,
        tankLiters = newTankLiters,
        tankCapacity = tankCapacity,
        transferredLiters = transferLiters,
        canLiters = newCanLiters,
        maxCanLiters = maxCanLiters,
    }
end)

local VehicleKeys = {}

local function plateKey(plate)
    return (plate or ''):gsub('%s+', ''):upper()
end

-- [AUDIT P6-07] Key grants must die with ownership. Previously grants survived
-- TransferVehicleOwnership and character deletion, so an old friend kept engine
-- access to a car they no longer had any relationship with.
local function clearKeysForPlate(plate)
    VehicleKeys[plateKey(plate)] = nil
end

local function clearKeysForCharacter(charId)
    charId = tonumber(charId)
    if not charId then return end
    for _, grants in pairs(VehicleKeys) do
        grants[charId] = nil
    end
end

exports('ClearKeysForPlate', clearKeysForPlate)
exports('ClearKeysForCharacter', clearKeysForCharacter)

exports.sunset_core:RegisterCallback('sunset:hasVehicleKeys', function(source, plate)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false end
    plate = plateKey(plate)
    local row = MySQL.single.await('SELECT character_id FROM vehicles WHERE REPLACE(plate, " ", "") = ?', { plate })
    if row and tonumber(row.character_id) == tonumber(char.id) then return true end
    return VehicleKeys[plate] and VehicleKeys[plate][char.id] == true
end)

exports.sunset_core:RegisterCallback('sunset:giveVehicleKeys', function(source, targetId, plate)
    local char = exports.sunset_core:GetCharacter(source)
    local target = exports.sunset_core:GetCharacter(tonumber(targetId))
    if not char or not target then return nil, { localeKey = 'vehicles.message.player_not_found' } end
    plate = plateKey(plate)
    local row = MySQL.single.await('SELECT character_id FROM vehicles WHERE REPLACE(plate, " ", "") = ?', { plate })
    if not row or tonumber(row.character_id) ~= tonumber(char.id) then
        return nil, { localeKey = 'vehicles.message.you_do_not_own_this_vehicle' }
    end
    VehicleKeys[plate] = VehicleKeys[plate] or {}
    VehicleKeys[plate][target.id] = true
    TriggerClientEvent('sunset:client:notify', tonumber(targetId), exports.sunset_core:TFor(tonumber(targetId), 'vehicles.message.you_received_vehicle_keys'), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:takeVehicleKeys', function(source, targetId, plate)
    local char = exports.sunset_core:GetCharacter(source)
    local target = exports.sunset_core:GetCharacter(tonumber(targetId))
    if not char or not target then return nil, { localeKey = 'vehicles.message.player_not_found' } end
    plate = plateKey(plate)
    local row = MySQL.single.await('SELECT character_id FROM vehicles WHERE REPLACE(plate, " ", "") = ?', { plate })
    if not row or tonumber(row.character_id) ~= tonumber(char.id) then
        return nil, { localeKey = 'vehicles.message.you_do_not_own_this_vehicle' }
    end
    if VehicleKeys[plate] then VehicleKeys[plate][target.id] = nil end
    TriggerClientEvent('sunset:client:notify', tonumber(targetId), exports.sunset_core:TFor(tonumber(targetId), 'vehicles.message.your_vehicle_keys_were_taken'), 'warning')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:parkOwnedVehicle', function(source, netId, plate, reportedProps, reportedFuel)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'vehicles.message.no_character' } end
    local now = GetGameTimer()
    if now - (ParkRate[source] or 0) < 1500 then return nil, { localeKey = 'vehicles.message.please_wait_before_parking_again' } end
    ParkRate[source] = now

    plate = normalizePlate(plate)
    if plate == '' then return nil, { localeKey = 'vehicles.message.invalid_vehicle_plate' } end
    local row = MySQL.single.await(
        'SELECT id, props, fuel FROM vehicles WHERE character_id = ? AND REPLACE(UPPER(plate), " ", "") = ?',
        { char.id, plate }
    )
    if not row then return nil, { localeKey = 'vehicles.message.this_is_not_your_vehicle' } end

    local ped = GetPlayerPed(source)
    local vehicle = tonumber(netId) and NetworkGetEntityFromNetworkId(tonumber(netId)) or 0
    if vehicle == 0 or not DoesEntityExist(vehicle) then
        vehicle = ped ~= 0 and GetVehiclePedIsIn(ped, false) or 0
    end
    if vehicle == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then
        return nil, { localeKey = 'vehicles.message.sit_in_the_driver_seat_of_your_vehicle_to_f63be1' }
    end
    if normalizePlate(GetVehicleNumberPlateText(vehicle)) ~= plate then
        return nil, { localeKey = 'vehicles.message.the_vehicle_you_are_driving_does_not_match_this' }
    end

    local pos = GetEntityCoords(vehicle)
    local heading = GetEntityHeading(vehicle)
    local props = decodeProps(row.props)
    if type(reportedProps) == 'table' then
        local previousOdometer = math.max(0, tonumber(props.odometer) or 0)
        local requestedOdometer = math.max(previousOdometer, tonumber(reportedProps.odometer) or previousOdometer)
        props.odometer = math.min(requestedOdometer, previousOdometer + 8.0)
    end
    local encodedProps = json.encode(props)
    if #encodedProps > 32768 then return nil, { localeKey = 'vehicles.message.vehicle_data_is_too_large' } end

    -- Parking cannot repair or refuel a vehicle; those have separate paid,
    -- server-authoritative paths.
    local previousFuel = math.max(0, math.min(100, tonumber(row.fuel) or 100))
    local fuelValue = math.max(0, math.min(previousFuel + 0.5, tonumber(reportedFuel) or previousFuel))
    local engine = math.max(-4000, math.min(1000, GetVehicleEngineHealth(vehicle)))
    local body = math.max(0, math.min(1000, GetVehicleBodyHealth(vehicle)))
    local changed = MySQL.update.await([[
        UPDATE vehicles SET stored = 0, props = ?, fuel = ?, engine = ?, body = ?,
            parked_x = ?, parked_y = ?, parked_z = ?, parked_h = ?
        WHERE id = ? AND character_id = ?
    ]], { encodedProps, fuelValue, engine, body, pos.x, pos.y, pos.z, heading, row.id, char.id })
    if not changed or changed < 1 then return nil, { localeKey = 'vehicles.message.the_parking_position_could_not_be_saved' } end
    return { ok = true, x = pos.x, y = pos.y, z = pos.z, heading = heading }
end)

local function notifyPlayer(source, message, kind)
    if source == 0 then
        print(('[givecar] %s'):format(message))
        return
    end
    exports.sunset_core:CommandReply(source, message, kind or 'info')
end

local function runGiveCar(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 3) then
        exports.sunset_core:CommandDenyAdmin(source, 'givecar')
        return
    end

    local target = tonumber(args[1])
    local model = string.lower((args[2] or 'sultan'):gsub('%s+', ''))
    if not target then
        notifyPlayer(source, 'Usage: /givecar [player id] [model]', 'error')
        return
    end

    if not GetPlayerName(target) then
        notifyPlayer(source, ('Player #%d is not online. Check F10 for current server IDs.'):format(target), 'error')
        return
    end

    local char = exports.sunset_core:GetCharacter(target)
    if not char then
        exports.sunset_core:CommandNoCharacter(source, target)
        return
    end

    local vehicleId
    for _ = 1, 8 do
        local plate = generatePlate()
        local ok, result = pcall(function()
            return MySQL.insert.await(
                'INSERT INTO vehicles (character_id, plate, model, stored, garage) VALUES (?, ?, ?, 1, ?)',
                { char.id, plate, model, 'legion' }
            )
        end)
        if ok and result then
            vehicleId = result
            break
        end
    end

    if not vehicleId then
        local name = exports.sunset_core:GetPlayerDisplayName(target) or GetPlayerName(target) or '?'
        notifyPlayer(source,
            ('Could not store %s in Legion garage for %s (#%d) — database insert failed after 8 plate attempts.'):format(
                model, name, target), 'error')
        return
    end

    local targetName = exports.sunset_core:GetPlayerDisplayName(target)
    TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'vehicles.message.you_received_a_vehicle_value', model), 'success')
    notifyPlayer(
        source,
        ('Gave %s to %s (#%d) — stored in Legion garage'):format(model, targetName, target),
        'success'
    )
end

RegisterCommand('givecar', function(source, args)
    runGiveCar(source, args)
end, false)

function ExecutePlayerCommand(source, name, args)
    if string.lower(tostring(name or '')) ~= 'givecar' then return false end
    runGiveCar(source, args or {})
    return true
end

exports('ExecutePlayerCommand', ExecutePlayerCommand)

function TransferVehicleOwnership(vehicleId, fromCharId, toCharId)
    vehicleId = tonumber(vehicleId)
    fromCharId = tonumber(fromCharId)
    toCharId = tonumber(toCharId)
    if not vehicleId or not fromCharId or not toCharId then
        return false, { localeKey = 'vehicles.message.invalid_vehicle_transfer' }
    end

    local row = MySQL.single.await(
        'SELECT id, plate, stored, destroyed FROM vehicles WHERE id = ? AND character_id = ?',
        { vehicleId, fromCharId }
    )
    if not row then return false, { localeKey = 'vehicles.message.seller_no_longer_owns_this_vehicle' } end
    if row.destroyed == 1 or row.destroyed == true or row.destroyed == '1' then
        return false, { localeKey = 'vehicles.message.destroyed_vehicles_cannot_be_traded' }
    end
    if normalizeStored(row.stored) ~= 1 then
        return false, { localeKey = 'vehicles.message.only_garage_stored_vehicles_can_be_traded' }
    end

    local entity = findVehicleEntityByPlate(row.plate)
    if entity and DoesEntityExist(entity) then
        DeleteEntity(entity)
    end

    local changed = MySQL.update.await(
        'UPDATE vehicles SET character_id = ?, stored = 1 WHERE id = ? AND character_id = ?',
        { toCharId, vehicleId, fromCharId }
    )
    if changed ~= 1 then return false, { localeKey = 'vehicles.message.vehicle_transfer_failed' } end
    -- [AUDIT P6-07] Revoke all in-memory key grants on ownership change.
    clearKeysForPlate(row.plate)
    return true
end
exports('TransferVehicleOwnership', TransferVehicleOwnership)

-- ═══ IMPOUND SUPPORT EXPORTS ═══

exports('GetVehicleById', function(vehicleId)
    vehicleId = tonumber(vehicleId)
    if not vehicleId then return nil end
    return MySQL.single.await('SELECT * FROM vehicles WHERE id = ? LIMIT 1', { vehicleId })
end)

exports('DeleteVehicleEntity', function(vehicleId)
    vehicleId = tonumber(vehicleId)
    if not vehicleId then return end
    -- Tell the client to delete the entity if it's in the world
    for _, id in ipairs(GetPlayers()) do
        TriggerClientEvent('sunset:vehicles:deleteEntity', tonumber(id), vehicleId)
    end
end)

exports('SpawnVehicleAt', function(source, vehicleId, coords, heading)
    vehicleId = tonumber(vehicleId)
    if not vehicleId then return false end
    local veh = MySQL.single.await('SELECT * FROM vehicles WHERE id = ? LIMIT 1', { vehicleId })
    if not veh then return false end
    TriggerClientEvent('sunset:client:spawnOwnedVehicle', source, veh, {
        coords = coords,
        heading = heading or 0.0,
    })
    return true
end)

exports('DeleteVehicleRecord', function(vehicleId)
    vehicleId = tonumber(vehicleId)
    if not vehicleId then return false end
    MySQL.update.await('DELETE FROM vehicles WHERE id = ?', { vehicleId })
    return true
end)

-- ── Vehicle entry information ─────────────────────────────────────────────
-- Returns sanitised vehicle info when a player enters a vehicle.
-- Insurance details are only returned to the registered owner.
exports.sunset_core:RegisterCallback('sunset:getVehicleEntryInfo', function(source, vehicleNetId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil end

    vehicleNetId = tonumber(vehicleNetId)
    if not vehicleNetId or vehicleNetId <= 0 then return nil end
    local vehicle = NetworkGetEntityFromNetworkId(vehicleNetId)
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then return nil end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 or GetVehiclePedIsIn(ped, false) ~= vehicle then return nil end

    local rawPlate = GetVehicleNumberPlateText(vehicle) or ''
    local plate = normalizePlate(rawPlate)
    local modelHash = GetEntityModel(vehicle)

    -- Faction fleet vehicle?
    local factionId = Entity(vehicle).state.sunsetFactionVehicle
    if factionId then
        local factionLabel = factionId
        local cfg = Sunset and Sunset.Factions and Sunset.Factions[factionId]
        if cfg then factionLabel = cfg.label or factionId end
        return { category = 'faction', plate = rawPlate:match('^%s*(.-)%s*$'), faction = factionLabel }
    end

    -- Personal owned vehicle?
    if plate ~= '' then
        local row = MySQL.single.await([[
            SELECT v.id, v.model, v.props, v.insurance_points, v.insurance_level,
                   v.insurance_cost, v.destroyed, c.firstname, c.lastname,
                   v.character_id,
                   GREATEST(0, COALESCE(TIMESTAMPDIFF(DAY, v.created_at, NOW()), 0)) AS ownership_days
            FROM vehicles v
            JOIN characters c ON c.id = v.character_id
            WHERE REPLACE(UPPER(v.plate),' ','') = ?
            LIMIT 1
        ]], { plate })

        -- A matching plate alone is insufficient: world vehicles can reuse a plate.
        if row and type(row.model) == 'string' and joaat(row.model) == modelHash then
            local displayModel = (row.model or ''):lower()
            local cleanPlate   = rawPlate:match('^%s*(.-)%s*$')
            local isOwner      = tonumber(row.character_id) == tonumber(char.id)

            local props = type(row.props) == 'table' and row.props or {}
            if type(row.props) == 'string' then
                local ok, decoded = pcall(json.decode, row.props)
                if ok and type(decoded) == 'table' then props = decoded
                else print(('[sunset_vehicles] invalid props vehicle=%s'):format(row.id)) end
            end
            local odometer = math.max(0, tonumber(props.odometer) or 0)
            local ownerName = ((row.firstname or '') .. ' ' .. (row.lastname or '')):match('^%s*(.-)%s*$')
            local ownershipDays = math.max(0, math.floor(tonumber(row.ownership_days) or 0))

            if isOwner then
                local baseCost = calculateVehicleInsuranceCost(row.model, row.insurance_cost)
                return {
                    category      = 'personal_own',
                    plate         = cleanPlate,
                    model         = displayModel,
                    odometer      = math.floor(odometer * 10) / 10,
                    ownerName     = ownerName,
                    ownershipDays = ownershipDays,
                    ins_level     = math.max(1, math.min(11, tonumber(row.insurance_level) or 1)),
                    ins_points    = math.max(0, tonumber(row.insurance_points) or 5),
                    claim_cost    = math.floor(baseCost * (tonumber(row.insurance_level) or 1)),
                    destroyed     = row.destroyed == true or tonumber(row.destroyed) == 1,
                }
            else
                return {
                    category = 'personal_other',
                    plate    = cleanPlate,
                    model    = displayModel,
                    ownerName = ownerName,
                    odometer = math.floor(odometer * 10) / 10,
                    ownershipDays = ownershipDays,
                }
            end
        end
    end

    -- Unregistered / NPC vehicle.
    return { category = 'npc', plate = rawPlate:match('^%s*(.-)%s*$') }
end)
