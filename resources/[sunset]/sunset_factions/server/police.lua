Police = Police or {}

local WantedOnline = {}
local JailedOnline = {}
local RadarSessions = {}
local DeathCapturePending = {}
local UnitStatuses = {}
local Bolos = {}

local function wantedStarSeconds()
    return math.max(60, math.floor(tonumber(Sunset.Police and Sunset.Police.wantedStarSeconds) or 900))
end

local function jailSecondsFor(level, surrenderable, deathCapture)
    level = math.max(1, math.min(5, math.floor(tonumber(level) or 1)))
    local tableName = (deathCapture or surrenderable == false) and 'noSurrenderJailSeconds' or 'arrestJailSeconds'
    local durations = Sunset.Police and Sunset.Police[tableName] or {}
    return math.max(60, math.floor(tonumber(durations[level]) or level * 4 * 60))
end

local function formatDuration(seconds)
    seconds = math.max(0, math.floor(tonumber(seconds) or 0))
    local minutes = math.floor(seconds / 60)
    local remaining = seconds % 60
    return remaining > 0 and ('%dm %02ds'):format(minutes, remaining) or ('%d min'):format(minutes)
end

local function notify(source, msg, typ, duration)
    FactionCore.notify(source, msg, typ or 'info', duration)
end

local function policeChat(target, tag, message, messageType)
    TriggerClientEvent('sunset:police:chatAlert', target, {
        tag = tag,
        message = message,
        type = messageType or 'hq',
    })
end

local function findVehicleDriverSource(vehicle)
    if not vehicle or vehicle == 0 then return nil end
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        if src then
            local ped = GetPlayerPed(src)
            if ped and ped ~= 0
                and GetVehiclePedIsIn(ped, false) == vehicle
                and GetPedInVehicleSeat(vehicle, -1) == ped then
                return src
            end
        end
    end
    return nil
end

local function officerRadarIdentity(source)
    local char = FactionCore.getChar(source)
    local factionId = char and select(1, FactionCore.getFactionOf(char))
    local faction = factionId and Sunset.Factions[factionId]
    local _, grade = FactionCore.getFactionOf(char)
    local gradeInfo = factionId and Sunset.GetFactionGrade and Sunset.GetFactionGrade(factionId, grade)
    return {
        id = source,
        name = exports.sunset_core:GetPlayerBaseName(source),
        factionId = factionId,
        factionLabel = faction and faction.label or 'LSPD',
        rank = (gradeInfo and gradeInfo.label) or 'Officer',
    }
end

local function notifyRadarCaught(driverSource, officer, speed, limit, over)
    local officerDisplay = exports.sunset_core:GetPlayerDisplayName(officer.id)
    local officerBase = exports.sunset_core:GetPlayerBaseName(officer.id)
    local header = ('%s %s %s'):format(officer.factionLabel, officer.rank, officerDisplay)
    local detail = ('caught you at %d km/h in a %d km/h zone (+%d).'):format(speed, limit, over)

    TriggerClientEvent('sunset:chat:message', driverSource, {
        id = officer.id,
        name = officerBase,
        message = detail,
        time = os.date('%H:%M:%S'),
        type = 'radar_alert',
        factionId = officer.factionId,
        factionLabel = officer.factionLabel,
        rank = officer.rank,
        speed = speed,
        limit = limit,
        over = over,
    })
    TriggerClientEvent('sunset:client:notify', driverSource, exports.sunset_core:TFor(driverSource, 'factions.message.value_value', header, detail), 'error', 10000)

    TriggerClientEvent('sunset:ui:radarAlert', driverSource, {
        type = 'mobile',
        title = ('%s — PATROL RADAR'):format(officer.factionLabel or 'TRAFFIC POLICE'),
        location = ('Officer %s (%s)'):format(officerBase, officer.rank or 'Patrol'),
        officer = officerBase,
        rank = officer.rank,
        limit = limit,
        speed = speed,
        over = over,
        fine = 0,
        paid = false,
        duration = 7500,
    })
end

local function broadcastToPolice(tag, message)
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        if src and FactionCore.isLawEnforcementMember(src) then
            local text = message
            if type(message) == 'table' and type(message.localeKey) == 'string' then
                text = exports.sunset_core:TFor(src, message.localeKey, message.params)
            end
            policeChat(src, 'HQ', text, 'hq')
        end
    end
end

local function charId(source)
    local char = FactionCore.getChar(source)
    return char and char.id
end

local function syncWantedBag(source, data)
    Player(source).state:set('sunsetWanted', data, true)
end

local function syncJailBag(source, data)
    Player(source).state:set('sunsetJailed', data, true)
end

local function syncWantedClient(targetId, level, reason)
    TriggerClientEvent('sunset:client:wantedUpdate', targetId, level or 0, reason or '')
end

function Police.loadWantedFromDb(characterId)
    local row = MySQL.single.await([[
        SELECT id, character_id, level, reason_code, reason_label, jail_minutes,
               surrenderable, decay_remaining_seconds
        FROM wanted_records
        WHERE character_id = ? AND active = 1
        ORDER BY id DESC LIMIT 1
    ]], { characterId })
    if not row then return nil end
    return {
        level = row.level,
        reason = row.reason_label,
        reasonCode = row.reason_code,
        jailMinutes = row.jail_minutes,
        surrenderable = tonumber(row.surrenderable) ~= 0,
        decayRemaining = math.max(1, tonumber(row.decay_remaining_seconds) or wantedStarSeconds()),
        recordId = row.id,
        characterId = row.character_id,
    }
end

function Police.saveWantedToDb(characterId, data, issuedBy)
    MySQL.update.await(
        'UPDATE wanted_records SET active = 0, cleared_at = NOW() WHERE character_id = ? AND active = 1',
        { characterId }
    )
    MySQL.insert.await([[
        INSERT INTO wanted_records
            (character_id, level, reason_code, reason_label, issued_by_character_id, jail_minutes,
             surrenderable, decay_remaining_seconds, active, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, FROM_UNIXTIME(?))
    ]], {
        characterId,
        data.level,
        data.reasonCode,
        data.reason,
        issuedBy,
        data.jailMinutes,
        data.surrenderable == false and 0 or 1,
        math.max(1, math.floor(tonumber(data.decayRemaining) or wantedStarSeconds())),
        data.decayAt,
    })
end

function Police.deleteWantedFromDb(characterId, clearedBy)
    MySQL.update.await(
        'UPDATE wanted_records SET active = 0, cleared_at = NOW(), cleared_by_character_id = ? WHERE character_id = ? AND active = 1',
        { clearedBy, characterId }
    )
end

function Police.loadJailFromDb(characterId)
    return MySQL.single.await([[
        SELECT id, character_id, reason, duration_minutes, officer_character_id,
               UNIX_TIMESTAMP(ends_at) AS release_at
        FROM jail_sentences
        WHERE character_id = ? AND status = 'active' AND ends_at > NOW()
        ORDER BY id DESC LIMIT 1
    ]], { characterId })
end

function Police.saveJailToDb(characterId, releaseAt, seconds, reason, officerCharId)
    MySQL.update.await(
        "UPDATE jail_sentences SET status = 'served', released_at = NOW() WHERE character_id = ? AND status = 'active'",
        { characterId }
    )
    MySQL.insert.await([[
        INSERT INTO jail_sentences
            (character_id, officer_character_id, reason, duration_minutes, duration_seconds, started_at, ends_at, status)
        VALUES (?, ?, ?, ?, ?, NOW(), FROM_UNIXTIME(?), 'active')
    ]], { characterId, officerCharId, reason or '', math.ceil(seconds / 60), seconds, releaseAt })
end

function Police.clearJailFromDb(characterId)
    MySQL.update.await(
        "UPDATE jail_sentences SET status = 'served', released_at = NOW() WHERE character_id = ? AND status = 'active'",
        { characterId }
    )
end

local findOnlineSourceByCharacterId -- [SEC3] forward declaration: used by clearWanted before its definition (was a nil global)
local ArrestInFlight = {}
local LastBounty = {}
local LIMITED_WANTED_MAX = 2

local function hasFullWantedPerm(source)
    return FactionCore.hasPerm(source, 'wanted')
end

local function hasLimitedWantedPerm(source)
    return FactionCore.hasPerm(source, 'wanted_limited')
end

local function canIssueWanted(source)
    return hasFullWantedPerm(source) or hasLimitedWantedPerm(source)
end

local function wantedCapFor(source)
    if hasFullWantedPerm(source) then return 5 end
    return LIMITED_WANTED_MAX
end

local function applyWanted(source, data)
    if not data.decayAt then
        local remaining = tonumber(data.decayRemaining) or wantedStarSeconds()
        data.decayAt = os.time() + math.max(1, remaining)
    else
        data.decayRemaining = math.max(1, data.decayAt - os.time())
    end
    data.characterId = data.characterId or charId(source)
    WantedOnline[source] = data
    syncWantedBag(source, {
        level = data.level,
        reason = data.reason,
        reasonCode = data.reasonCode,
        decayAt = data.decayAt,
        surrenderable = data.surrenderable ~= false,
    })
    syncWantedClient(source, data.level, data.reason)
end

local function setWanted(targetId, level, reason, reasonCode, jailMinutes, issuedBy, silent, surrenderable, maxLevel)
    local previous = WantedOnline[targetId]
    local addedLevel = math.max(1, tonumber(level) or 1)
    level = math.max(1, math.min(maxLevel or 5, (previous and previous.level or 0) + addedLevel))
    local combinedReason = reason or 'Unknown'
    if previous and previous.reason and previous.reason ~= '' then
        combinedReason = previous.reason .. '; ' .. combinedReason
        if #combinedReason > 128 then combinedReason = combinedReason:sub(-128) end
    end
    local canSurrender = surrenderable ~= false
    if previous and previous.surrenderable == false then canSurrender = false end
    local decaySeconds = wantedStarSeconds()
    local data = {
        level = level,
        reason = combinedReason,
        reasonCode = reasonCode or '',
        jailMinutes = math.ceil(jailSecondsFor(level, canSurrender, false) / 60),
        surrenderable = canSurrender,
        decayRemaining = decaySeconds,
        decayAt = os.time() + decaySeconds,
    }

    local cid = charId(targetId)
    if cid then
        Police.saveWantedToDb(cid, data, issuedBy)
    end
    applyWanted(targetId, data)
    local name = 'Unknown'
    pcall(function()
        name = exports.sunset_core:GetPlayerDisplayName(targetId) or name
    end)
    if not silent then
        broadcastToPolice('WANTED', { localeKey = 'factions.msg.is_now_wanted', params = { name = tostring(name), target_id = math.floor(tonumber(targetId) or 0), level = math.floor(tonumber(data.level) or 0), reason = tostring(data.reason), surrenderable = data.surrenderable and { localeKey = 'factions.word.right_to_surrender' } or { localeKey = 'factions.word.no_right_to_surrender' } } })
    end
    return data
end

function AddWantedCharge(targetId, reasonCode, issuedBy, options)
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then return nil, { localeKey = 'factions.message.player_is_not_online' } end
    reasonCode = string.lower(tostring(reasonCode or 'robbery'))
    local reasonRow = Sunset.GetPoliceReason(reasonCode)
    if not reasonRow then return nil, { localeKey = 'factions.message.unknown_wanted_reason' } end
    local silent = type(options) == 'table' and options.silent == true
    local surrenderable = reasonRow.surrenderable ~= false
    if type(options) == 'table' and options.surrenderable ~= nil then
        surrenderable = options.surrenderable == true
    end
    return setWanted(targetId, reasonRow.stars, reasonRow.label, reasonCode, reasonRow.jailMinutes, issuedBy, silent, surrenderable)
end
exports('AddWantedCharge', AddWantedCharge)

local function clearWanted(targetId, clearedBy)
    local cid = charId(targetId)
    if cid then Police.deleteWantedFromDb(cid, clearedBy) end
    WantedOnline[targetId] = nil
    syncWantedBag(targetId, nil)
    syncWantedClient(targetId, 0, '')
end

function GetWantedState(source)
    return WantedOnline[source]
end
exports('GetWantedState', GetWantedState)

function Police.isJailed(source)
    return JailedOnline[source] ~= nil
end

local function beginJail(targetId, seconds, reason, officerSource)
    seconds = math.max(60, math.floor(tonumber(seconds) or 120))
    local minutes = math.ceil(seconds / 60)
    local releaseAt = os.time() + seconds
    local targetCharId = charId(targetId)
    local officerCharId = officerSource and charId(officerSource)

    if targetCharId then
        Police.saveJailToDb(targetCharId, releaseAt, seconds, reason, officerCharId)
    end

    JailedOnline[targetId] = { releaseAt = releaseAt, minutes = minutes, seconds = seconds, reason = reason }
    syncJailBag(targetId, { releaseAt = releaseAt, minutes = minutes })

    -- [AUDIT P6-09] A jailed officer must not stay on duty: on-duty counts feed
    -- robbery police presence, EMS bleedout timers and faction salary.
    -- setDuty lives in main.lua; go through the internal force-duty-off event.
    TriggerEvent('sunset:faction:forceDutyOff', targetId)

    if Detention then
        Detention.setJailed(targetId)
    end

    -- [AUDIT P6-02] Notify cross-system listeners (taxi rides etc.) of jail intake.
    TriggerEvent('sunset:faction:playerJailed', targetId)

    Detention.setCuffed(targetId, false)
    TriggerClientEvent('sunset:faction:uncuff', targetId)
    TriggerClientEvent('sunset:detention:sync', targetId, targetId, { -- [SEC3] target only (state bags cover others)
        cuffed = false,
        escorted = false,
        state = Detention.States.JAILED,
    })

    local jail = Sunset.Police and Sunset.Police.jailCoords
    local jailPayload = {
        releaseAt = releaseAt,
        minutes = minutes,
        coords = jail and { x = jail.x, y = jail.y, z = jail.z, w = jail.w } or nil,
    }
    TriggerClientEvent('sunset:police:jail', targetId, jailPayload)
    -- [AUDIT P6-04] The jail intake client event is one-shot: if it is lost
    -- (client hitch during death capture, factions restart between downed-clear
    -- and this call) the player is left not-downed AND not-jailed with no
    -- recovery path. Re-send once; the client handler is idempotent, and skip
    -- if the jail was already completed server-side meanwhile.
    SetTimeout(3000, function()
        if JailedOnline[targetId] and JailedOnline[targetId].releaseAt == releaseAt and GetPlayerName(targetId) then
            TriggerClientEvent('sunset:police:jail', targetId, jailPayload)
        end
    end)
end

local function nearestOnDutyOfficer(targetId, range)
    local targetPos = FactionCore.playerCoords(targetId)
    if not targetPos then return nil end

    local nearest, nearestDistance
    for _, id in ipairs(GetPlayers()) do
        local officer = tonumber(id)
        if officer and officer ~= targetId and FactionCore.isLawEnforcement(officer) then
            local distance = FactionCore.distBetween(targetPos, FactionCore.playerCoords(officer))
            if distance <= range and (not nearestDistance or distance < nearestDistance) then
                nearest, nearestDistance = officer, distance
            end
        end
    end
    return nearest, nearestDistance
end

local function captureWantedAfterDeath(targetId)
    targetId = tonumber(targetId)
    if not targetId or DeathCapturePending[targetId] or Police.isJailed(targetId) then return false end

    local wanted = WantedOnline[targetId]
    if not wanted then return false end

    local isDowned = false
    pcall(function()
        isDowned = exports.sunset_death:IsPlayerDowned(targetId) == true
    end)
    if not isDowned then return false end

    local range = math.max(5.0, tonumber(Sunset.Police and Sunset.Police.wantedDeathCaptureRange) or 125.0)
    local officer, distance = nearestOnDutyOfficer(targetId, range)
    if not officer then return false end

    DeathCapturePending[targetId] = true
    local sentenceSeconds = jailSecondsFor(wanted.level, wanted.surrenderable, true)
    local reason = wanted.reason or 'Active wanted status'
    local level = math.max(1, tonumber(wanted.level) or 1)

    local custodyCleared = false
    pcall(function()
        custodyCleared = exports.sunset_death:ClearDownedForCustody(targetId) == true
    end)
    if not custodyCleared then
        DeathCapturePending[targetId] = nil
        return false
    end

    clearWanted(targetId, charId(officer))
    beginJail(targetId, sentenceSeconds, reason, officer)
    DeathCapturePending[targetId] = nil

    local suspectName = exports.sunset_core:GetPlayerDisplayName(targetId)
    local officerName = exports.sunset_core:GetPlayerDisplayName(officer)
    notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.you_died_while_wanted_near_law', { format_duration = tostring(formatDuration(sentenceSeconds)), level = math.floor(tonumber(level) or 0) }), 'error', 10000)
    notify(officer, exports.sunset_core:TFor(officer, 'factions.msg.wanted_suspect_was_taken_into_custody', { suspect_name = tostring(suspectName), target_id = math.floor(tonumber(targetId) or 0) }), 'success', 8000)
    broadcastToPolice('SUSPECT IN CUSTODY', { localeKey = 'factions.msg.was_downed_near_and_jailed_for', params = { suspect_name = tostring(suspectName), target_id = math.floor(tonumber(targetId) or 0), officer_name = tostring(officerName), officer = math.floor(tonumber(officer) or 0), format_duration = tostring(formatDuration(sentenceSeconds)), reason = tostring(reason) } })
    FactionCore.auditLog('police', charId(officer), 'wanted_death_capture', charId(targetId), {
        wantedLevel = level,
        jailSeconds = sentenceSeconds,
        distance = math.floor((distance or 0.0) * 10 + 0.5) / 10,
        reason = reason,
    })
    return true
end

function Police.isDeathCapturePending(source)
    return DeathCapturePending[source] == true
end

local function endJail(source)
    local cid = charId(source)
    if cid then Police.clearJailFromDb(cid) end
    JailedOnline[source] = nil
    syncJailBag(source, nil)
    if Detention then Detention.releaseJail(source) end
    TriggerClientEvent('sunset:police:release', source)
end

local function bookingStatus(targetId)
    local targetPos = FactionCore.playerCoords(targetId)
    if not targetPos then return false, nil, 9999.0 end

    local radius = Sunset.Police and Sunset.Police.jailRadius or 12.0
    local nearest, nearestDistance
    for _, point in ipairs((Sunset.Police and Sunset.Police.bookingPoints) or {}) do
        local distance = FactionCore.distBetween(targetPos, point.coords)
        if not nearestDistance or distance < nearestDistance then
            nearest, nearestDistance = point, distance
        end
        if distance <= radius then return true, point, distance end
    end
    if not nearest and Sunset.Police and Sunset.Police.pdJailPoint then
        local point = { label = 'MRPD Booking — basement', coords = Sunset.Police.pdJailPoint }
        return FactionCore.distBetween(targetPos, point.coords) <= radius, point,
            FactionCore.distBetween(targetPos, point.coords)
    end
    return false, nearest, nearestDistance or 9999.0
end

local function buildWantedListRows()
    local now = os.time()
    local rows = MySQL.query.await([[
        SELECT wr.character_id, wr.level, wr.reason_label AS reason, wr.reason_code, wr.jail_minutes,
               wr.surrenderable, wr.decay_remaining_seconds,
               c.firstname, c.lastname
        FROM wanted_records wr
        INNER JOIN characters c ON c.id = wr.character_id
        WHERE wr.active = 1
        ORDER BY wr.level DESC
    ]]) or {}

    local onlineByChar = {}
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local cid = charId(src)
        if cid then onlineByChar[cid] = src end
    end

    local list = {}
    for _, row in ipairs(rows) do
        local src = onlineByChar[row.character_id]
        local onlineState = src and WantedOnline[src]
        local remaining = onlineState and math.max(0, (onlineState.decayAt or now) - now)
            or math.max(0, tonumber(row.decay_remaining_seconds) or wantedStarSeconds())
        local surrenderable = tonumber(row.surrenderable) ~= 0
        if onlineState then surrenderable = onlineState.surrenderable ~= false end
        list[#list + 1] = {
            id = src or row.character_id,
            serverId = src,
            characterId = row.character_id,
            name = ('%s %s'):format(row.firstname or '', row.lastname or ''):gsub('^%s+', ''):gsub('%s+$', ''),
            level = row.level,
            reason = row.reason,
            reasonCode = row.reason_code,
            remainingSec = remaining,
            surrenderable = surrenderable,
            online = src ~= nil,
        }
    end
    return list
end

function Police.hydratePlayer(source, characterId)
    local jailRow = Police.loadJailFromDb(characterId)
    if jailRow and jailRow.release_at and jailRow.release_at > os.time() then
        local remainingSec = jailRow.release_at - os.time()
        local remainingMin = math.max(1, math.ceil(remainingSec / 60))
        JailedOnline[source] = { releaseAt = jailRow.release_at, minutes = remainingMin, reason = jailRow.reason }
        syncJailBag(source, { releaseAt = jailRow.release_at, minutes = remainingMin })
        if Detention then Detention.setJailed(source) end
        local jail = Sunset.Police and Sunset.Police.jailCoords
        TriggerClientEvent('sunset:police:jail', source, {
            releaseAt = jailRow.release_at,
            minutes = remainingMin,
            coords = jail and { x = jail.x, y = jail.y, z = jail.z, w = jail.w } or nil,
        })
        return
    elseif jailRow then
        Police.clearJailFromDb(characterId)
    end

    local wanted = Police.loadWantedFromDb(characterId)
    if wanted then
        wanted.decayAt = os.time() + math.max(1, wanted.decayRemaining or wantedStarSeconds())
        applyWanted(source, wanted)
    else
        syncWantedBag(source, nil)
        syncWantedClient(source, 0, '')
    end
    syncJailBag(source, nil)
end

exports.sunset_core:RegisterCallback('sunset:policeSetWanted', function(source, targetId, reasonCode)
    if not canIssueWanted(source) then
        return nil, FactionCore.accessError(source, 'wanted', { localeKey = 'factions.action.add_a_wanted_charge' }, 'law_enforcement')
    end

    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    if targetId == source then return nil, { localeKey = 'factions.message.you_cannot_add_a_wanted_charge_to_yourself' } end
    if Police.isJailed(targetId) then return nil, { localeKey = 'factions.message.suspect_is_already_in_custody' } end

    reasonCode = string.lower(reasonCode or '')
    local reasonRow = Sunset.GetPoliceReason(reasonCode)
    if not reasonRow then
        local codes = {}
        for code in pairs(Sunset.Police.reasons or {}) do codes[#codes + 1] = code end
        table.sort(codes)
        return nil, { localeKey = 'factions.message.invalid_reason_use_value', formatArgs = { table.concat(codes, ', ') } }
    end

    local maxLevel = wantedCapFor(source)
    local previous = WantedOnline[targetId]
    local currentLevel = previous and previous.level or 0
    local projected = math.min(maxLevel, currentLevel + reasonRow.stars)
    if projected <= currentLevel and not hasFullWantedPerm(source) then
        return nil, { localeKey = 'factions.message.your_rank_can_only_raise_suspects_up_to_value', formatArgs = { LIMITED_WANTED_MAX } }
    end

    local wanted = setWanted(targetId, reasonRow.stars, reasonRow.label, reasonCode, reasonRow.jailMinutes,
        charId(source), false, reasonRow.surrenderable ~= false, maxLevel)

    notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.new_charge_total_wanted_one_star', { label = tostring(reasonRow.label), stars = math.floor(tonumber(reasonRow.stars) or 0), level = math.floor(tonumber(wanted.level) or 0), surrenderable = wanted.surrenderable and exports.sunset_core:TFor(targetId, 'factions.word.you_may_surrender') or exports.sunset_core:TFor(targetId, 'factions.word.no_right_to_surrender_2') }), 'error', 10000)
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.wanted_charge_added_to_now', { target_id = math.floor(tonumber(targetId) or 0), level = math.floor(tonumber(wanted.level) or 0), surrenderable = wanted.surrenderable and exports.sunset_core:TFor(source, 'factions.word.surrender_allowed') or exports.sunset_core:TFor(source, 'factions.word.no_surrender') }), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:policeClearWanted', function(source, targetId, characterId)
    if not FactionCore.hasPerm(source, 'clear_wanted') and not FactionCore.hasPerm(source, 'wanted') then
        return nil, FactionCore.accessError(source, 'clear_wanted', { localeKey = 'factions.action.clear_wanted_status' }, 'law_enforcement')
    end

    targetId = tonumber(targetId)
    characterId = tonumber(characterId)

    local targetCharId = nil
    local onlineSrc = nil

    -- 1. If targetId corresponds to an active online player
    if targetId and targetId > 0 and targetId <= 256 and GetPlayerName(targetId) then
        onlineSrc = targetId
        targetCharId = charId(targetId)
    end

    -- 2. Fallback to characterId or targetId treated as characterId
    if not targetCharId then
        targetCharId = characterId or targetId
        if targetCharId then
            onlineSrc = findOnlineSourceByCharacterId(targetCharId)
        end
    end

    if not targetCharId then
        return nil, { localeKey = 'factions.message.invalid_suspect_identifier_specified' }
    end

    local officerCharId = charId(source)
    -- [SEC3] an officer may not clear their own record
    if tonumber(targetCharId) == tonumber(officerCharId) then
        return nil, { localeKey = 'factions.message.you_cannot_add_a_wanted_charge_to_yourself' }
    end
    if targetCharId then
        Police.deleteWantedFromDb(targetCharId, officerCharId)
    end

    if onlineSrc and WantedOnline[onlineSrc] then
        clearWanted(onlineSrc, officerCharId)
        notify(onlineSrc, exports.sunset_core:TFor(onlineSrc, 'factions.msg.your_wanted_status_has_been_cleared'), 'success')
    elseif onlineSrc then
        syncWantedBag(onlineSrc, nil)
        syncWantedClient(onlineSrc, 0, '')
    end

    local officerName = exports.sunset_core:GetPlayerDisplayName(source)
    local targetName = (onlineSrc and exports.sunset_core:GetPlayerDisplayName(onlineSrc)) or ('Citizen #' .. tostring(targetCharId))
    broadcastToPolice('WANTED CLEARED', { localeKey = 'factions.msg.officer_cleared_wanted_status_for', params = { officer_name = tostring(officerName), target_name = tostring(targetName) } })
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.cleared_wanted_for_2', { target_name = tostring(targetName) }), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:policeSummon', function(source, targetId)
    if not FactionCore.hasPerm(source, 'mdc') then
        return nil, FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.issue_a_police_stop_order' }, 'law_enforcement')
    end

    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    if targetId == source then return nil, { localeKey = 'factions.message.you_cannot_issue_a_police_stop_order_to_yourself' } end

    local range = Sunset.Police and Sunset.Police.summonRange or 125.0
    local officerPos = FactionCore.playerCoords(source)
    local targetPos = FactionCore.playerCoords(targetId)
    if FactionCore.distBetween(officerPos, targetPos) > range then
        return nil, { localeKey = 'factions.message.you_must_be_within_value_m_of_the_suspect', formatArgs = { math.floor(range) } }
    end

    local officerName = exports.sunset_core:GetPlayerDisplayName(source)
    TriggerClientEvent('sunset:police:summonAlert', targetId, {
        officer = officerName,
        officerId = source,
        message = exports.sunset_core:TFor(source, 'factions.ui.you_are_being_summoned_by_law'),
    })
    local targetName = exports.sunset_core:GetPlayerDisplayName(targetId)
    local chatMessage = ('Officer %s (#%d) ordered %s (#%d) to stop and comply.'):format(
        officerName, source, targetName, targetId)
    policeChat(source, 'STOP ORDER', chatMessage, 'police_alert')
    policeChat(targetId, 'POLICE ORDER', chatMessage, 'police_alert')
    for _, id in ipairs(GetPlayers()) do
        local viewer = tonumber(id)
        local viewerPos = viewer and FactionCore.playerCoords(viewer)
        if viewer ~= source and viewer ~= targetId and viewerPos
            and (FactionCore.distBetween(viewerPos, officerPos) <= 80.0
            or FactionCore.distBetween(viewerPos, targetPos) <= 80.0) then
            policeChat(viewer, 'POLICE ALERT', chatMessage, 'police_alert')
        end
    end
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.stop_order_sent_to_nearby_players', { target_name = tostring(targetName), target_id = math.floor(tonumber(targetId) or 0) }), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:policeWantedList', function(source)
    if not FactionCore.hasPerm(source, 'mdc') then
        return nil, FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.view_the_wanted_list' }, 'law_enforcement')
    end
    return buildWantedListRows()
end)

exports.sunset_core:RegisterCallback('sunset:policeFindWanted', function(source, targetId)
    if not FactionCore.hasPerm(source, 'mdc')
        and not FactionCore.hasPerm(source, 'wanted')
        and not FactionCore.hasPerm(source, 'wanted_limited') then
        return nil, FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.track_wanted_suspects' }, 'law_enforcement')
    end
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    local wanted = WantedOnline[targetId]
    if not wanted then
        return nil, { localeKey = 'factions.message.player_value_has_no_active_wanted_status', formatArgs = { targetId } }
    end
    local coords = FactionCore.playerCoords(targetId)
    if not coords then
        return nil, { localeKey = 'factions.message.could_not_locate_that_player' }
    end
    return {
        id = targetId,
        name = exports.sunset_core:GetPlayerDisplayName(targetId),
        level = wanted.level or 1,
        reason = wanted.reason or exports.sunset_core:TFor(source, 'factions.ui.active_wanted'),
        x = coords.x,
        y = coords.y,
        z = coords.z,
    }
end)

exports.sunset_core:RegisterCallback('sunset:policeArrest', function(source, targetId)
    if not FactionCore.hasPerm(source, 'arrest') then
        return nil, FactionCore.accessError(source, 'arrest', { localeKey = 'factions.action.arrest_a_suspect' }, 'law_enforcement')
    end

    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    if targetId == source then return nil, { localeKey = 'factions.message.you_cannot_arrest_yourself' } end
    if not Detention.isCuffed(targetId) then
        return nil, { localeKey = 'factions.message.player_value_is_not_cuffed_stand_within_3m_and', formatArgs = { targetId, targetId } }
    end
    if not WantedOnline[targetId] then
        return nil, { localeKey = 'factions.message.player_value_has_no_active_wanted_charges_add_a_valid_charge_with', formatArgs = {
            targetId, targetId } }
    end
    local atBooking, nearest, bookingDistance = bookingStatus(targetId)
    if not atBooking then
        return nil, { localeKey = 'factions.message.take_player_value_to_value_value_m_away_use_booking_for_gps_escor', formatArgs = {
            targetId, nearest and nearest.label or 'MRPD Booking', bookingDistance, targetId } }
    end

    local officerPos = FactionCore.playerCoords(source)
    local targetPos = FactionCore.playerCoords(targetId)
    local arrestRange = Sunset.Police and Sunset.Police.arrestRange or 5.0
    if FactionCore.distBetween(officerPos, targetPos) > arrestRange then
        return nil, { localeKey = 'factions.message.you_must_be_within_value_m_of_the_suspect', formatArgs = { math.floor(arrestRange) } }
    end

    -- [SEC3] serialise per target: parallel arrests passed the WantedOnline check before clearWanted
    -- (DB await) finished, paying the bounty twice.
    if ArrestInFlight[targetId] or Police.isJailed(targetId) then
        return nil, { localeKey = 'factions.message.suspect_is_already_in_custody' }
    end
    ArrestInFlight[targetId] = true
    local w = WantedOnline[targetId]
    local level = w and w.level or 1
    local surrenderable = not w or w.surrenderable ~= false
    local sentenceSeconds = jailSecondsFor(level, surrenderable, false)
    local reason = w and w.reason or 'Arrest'
    local bounty = (Sunset.Police and Sunset.Police.bounties[level]) or 100

    local okArrest, errArrest = pcall(function()
        clearWanted(targetId, charId(source))
        beginJail(targetId, sentenceSeconds, reason, source)
    end)
    ArrestInFlight[targetId] = nil
    if not okArrest then
        print(('[sunset_factions] arrest failed: %s'):format(tostring(errArrest)))
        return nil, { localeKey = 'factions.message.could_not_remove_the_member_try_again' }
    end

    -- [SEC3] bounty farming guard: one bounty per suspect character per 30 minutes
    local tChar = charId(targetId)
    if tChar and LastBounty[tChar] and os.time() - LastBounty[tChar] < 1800 then
        bounty = 0
    elseif tChar then
        LastBounty[tChar] = os.time()
    end
    if bounty > 0 then exports.sunset_core:AddMoney(source, 'bank', bounty, 'arrest_bounty') end
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.suspect_arrested_jail_bounty', { format_duration = tostring(formatDuration(sentenceSeconds)), surrenderable = surrenderable and exports.sunset_core:TFor(source, 'factions.word.surrender_sentence') or exports.sunset_core:TFor(source, 'factions.word.no_surrender_sentence'), bounty = tostring(bounty) }), 'success')
    notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.you_have_been_arrested', { format_duration = tostring(formatDuration(sentenceSeconds)), surrenderable = surrenderable and exports.sunset_core:TFor(targetId, 'factions.word.right_to_surrender_sentence') or exports.sunset_core:TFor(targetId, 'factions.word.no_surrender_sentence') }), 'error', 10000)
    broadcastToPolice('ARREST', { localeKey = 'factions.msg.arrested', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(source)), source = math.floor(tonumber(source) or 0), player_display_name_2 = tostring(exports.sunset_core:GetPlayerDisplayName(targetId)), target_id = math.floor(tonumber(targetId) or 0), reason = tostring(reason), format_duration = tostring(formatDuration(sentenceSeconds)), surrenderable = surrenderable and { localeKey = 'factions.word.surrenderable' } or { localeKey = 'factions.word.no_surrender' } } })
    return true
end)

exports.sunset_core:RegisterCallback('sunset:policeReasons', function(source)
    if not FactionCore.hasPerm(source, 'mdc')
        and not FactionCore.hasPerm(source, 'wanted')
        and not FactionCore.hasPerm(source, 'wanted_limited') then
        return nil, FactionCore.accessError(source, 'wanted', { localeKey = 'factions.action.view_wanted_reason_codes' }, 'law_enforcement')
    end
    local list = {}
    for code, row in pairs(Sunset.Police.reasons or {}) do
        list[#list + 1] = {
            code = code,
            label = row.label,
            stars = row.stars,
            jailMinutes = math.ceil(jailSecondsFor(row.stars, row.surrenderable ~= false, false) / 60),
            surrenderable = row.surrenderable ~= false,
        }
    end
    table.sort(list, function(a, b) return a.stars < b.stars end)
    return list
end)

exports.sunset_core:RegisterCallback('sunset:policeViolations', function(source)
    if not FactionCore.hasPerm(source, 'ticket') and not FactionCore.hasPerm(source, 'fine') then
        return nil, FactionCore.accessError(source, 'ticket', { localeKey = 'factions.action.view_the_citation_list' }, 'law_enforcement')
    end
    return Sunset.Police.violations or {}
end)

exports.sunset_core:RegisterCallback('sunset:policeConfiscate', function(source, targetId)
    if not FactionCore.hasPerm(source, 'confiscate') then
        return nil, FactionCore.accessError(source, 'confiscate', { localeKey = 'factions.action.confiscate_contraband' }, 'law_enforcement')
    end

    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end

    local officerPos = FactionCore.playerCoords(source)
    local targetPos = FactionCore.playerCoords(targetId)
    if FactionCore.distBetween(officerPos, targetPos) > 3.5 then
        return nil, { localeKey = 'factions.message.you_must_be_within_3m_of_the_suspect' }
    end
    -- [SEC3] no stripping free, unrestrained players: target must be restrained, surrendering or in custody
    if targetId == source or not (Detention.isCuffed(targetId) or Detention.isHandsUp(targetId)
        or Police.isJailed(targetId)) then
        return nil, { localeKey = 'factions.message.suspect_must_be_restrained_first' }
    end

    local inv = exports.sunset_inventory:GetInventory(targetId) or {}
    local removed = {}
    for _, row in ipairs(inv) do
        if Sunset.IsConfiscatableItem(row.item) then
            local count = row.count or 1
            if exports.sunset_inventory:RemoveItem(targetId, row.item, count) then
                removed[#removed + 1] = { item = row.item, label = Sunset.Items[row.item] and Sunset.Items[row.item].label or row.item, count = count }
            end
        end
    end

    if #removed < 1 then return nil, { localeKey = 'factions.message.no_confiscatable_items_found' } end

    local officerChar = charId(source)
    local targetChar = charId(targetId)
    if officerChar and targetChar then
        pcall(function()
            MySQL.insert.await(
                'INSERT INTO police_confiscations (officer_character_id, target_character_id, items) VALUES (?, ?, ?)',
                { officerChar, targetChar, json.encode(removed) }
            )
        end)
    end

    notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.contraband_has_been_confiscated_by_law'), 'error')
    return removed
end)

local function broadcastFactionAction(source, message, factionId)
    local messageDesc
    if type(message) == 'table' and type(message.localeKey) == 'string' then
        messageDesc = message
        message = exports.sunset_core:TFor(0, messageDesc.localeKey, messageDesc.params)
    end
    local char = FactionCore.getChar(source)
    if not char then return end
    factionId = factionId or select(1, FactionCore.getFactionOf(char))
    if not factionId then return end

    local name = exports.sunset_core:GetPlayerDisplayName(source)
    local faction = Sunset.Factions[factionId]
    local label = faction and faction.label or factionId
    local _, grade = FactionCore.getFactionOf(char)
    local gradeInfo = Sunset.GetFactionGrade and Sunset.GetFactionGrade(factionId, grade)
    local rank = (gradeInfo and gradeInfo.label) or 'Member'
    local payload = {
        id = source,
        name = name,
        message = message,
        messageKey = messageDesc and messageDesc.localeKey or nil,
        messageParams = messageDesc and messageDesc.params or nil,
        time = os.date('%H:%M:%S'),
        type = 'faction_action',
        factionId = factionId,
        factionLabel = label,
        rank = rank,
    }

    for _, id in ipairs(GetPlayers()) do
        TriggerClientEvent('sunset:chat:message', tonumber(id), payload)
    end
end

local function isDepotFleetModel(depot, model)
    if not depot or not model then return false end
    if depot.vehicle and model == joaat(depot.vehicle) then return true end
    if depot.vehicles then
        for _, entry in ipairs(depot.vehicles) do
            if entry.model and model == joaat(entry.model) then return true end
        end
    end
    return false
end

local function validateRadarVehicle(source, networkId)
    if not FactionCore.hasPerm(source, 'radar') then
        return nil, FactionCore.accessError(source, 'radar', { localeKey = 'factions.action.use_the_speed_radar' }, 'law_enforcement')
    end
    local vehicle = NetworkGetEntityFromNetworkId(tonumber(networkId) or 0)
    local ped = GetPlayerPed(source)
    if vehicle == 0 or not DoesEntityExist(vehicle) or ped == 0 then
        return nil, { localeKey = 'factions.message.you_must_be_driving_a_valid_patrol_vehicle' }
    end
    if GetPedInVehicleSeat(vehicle, -1) ~= ped then
        return nil, { localeKey = 'factions.message.you_must_be_in_the_driver_seat_of_the' }
    end
    local char = FactionCore.getChar(source)
    local factionId = char and select(1, FactionCore.getFactionOf(char))
    local isFleet = factionId and Entity(vehicle).state.sunsetFactionVehicle == factionId
    local model = GetEntityModel(vehicle)
    local faction = factionId and Sunset.Factions[factionId]
    local depot = faction and faction.depot
    local isDepotModel = depot and isDepotFleetModel(depot, model)
    local allowed = false
    for _, name in ipairs((Sunset.Police.radar and Sunset.Police.radar.allowedModels) or {}) do
        if model == joaat(name) then
            allowed = true
            break
        end
    end
    if not isFleet and not isDepotModel and not allowed then
        return nil, { localeKey = 'factions.message.get_in_a_patrol_car_from_your_faction_garage' }
    end
    return vehicle
end

exports.sunset_core:RegisterCallback('sunset:policeRadarStart', function(source, networkId, requestedLimit)
    local vehicle, err = validateRadarVehicle(source, networkId)
    if not vehicle then return nil, err end
    local cfg = Sunset.Police.radar or {}
    if not exports.sunset_core:RateLimit(source, 'policeRadarStart', 3000) then return nil, { localeKey = 'factions.message.sec3_slow_down' } end -- [SEC3] chat-broadcast spam
    local limit = math.floor(tonumber(requestedLimit) or 0)
    if limit < (cfg.minLimitKmh or 20) or limit > (cfg.maxLimitKmh or 250) then
        return nil, { localeKey = 'factions.message.choose_a_speed_limit_between_value_and_value_km_h_example_startra', formatArgs = {
            cfg.minLimitKmh or 20, cfg.maxLimitKmh or 250 } }
    end
    RadarSessions[source] = { networkId = NetworkGetNetworkIdFromEntity(vehicle), limitKmh = limit, lastPlate = '', lastAt = 0 }
    broadcastFactionAction(source, { localeKey = 'factions.msg.placed_a_speed_radar_with_a', params = { limit = math.floor(tonumber(limit) or 0) } }, 'police')
    return { limitKmh = limit }
end)

exports.sunset_core:RegisterCallback('sunset:policeRadarStop', function(source)
    RadarSessions[source] = nil
    return true
end)


exports.sunset_core:RegisterCallback('sunset:policeRadarLock', function(source, targetNetworkId)
    local session = RadarSessions[source]
    if not session then return nil, { localeKey = 'factions.message.radar_is_not_active_use_startradar_limit_kmh_first' } end
    local radarVehicle, err = validateRadarVehicle(source, session.networkId)
    if not radarVehicle then
        RadarSessions[source] = nil
        return nil, err
    end

    local targetVehicle = NetworkGetEntityFromNetworkId(tonumber(targetNetworkId) or 0)
    if targetVehicle == 0 or targetVehicle == radarVehicle or not DoesEntityExist(targetVehicle) then
        return nil, { localeKey = 'factions.message.radar_target_is_no_longer_available' }
    end
    local cfg = Sunset.Police.radar or {}
    if #(GetEntityCoords(targetVehicle) - GetEntityCoords(radarVehicle)) > (cfg.mobileRange or 45.0) + 10.0 then
        return nil, { localeKey = 'factions.message.radar_target_is_out_of_range' }
    end

    local speed = math.floor(GetEntitySpeed(targetVehicle) * 3.6 + 0.5)
    local limit = session.limitKmh
    if speed <= limit then return { speed = speed, limit = limit, flagged = false } end
    local plate = GetVehicleNumberPlateText(targetVehicle) or 'UNKNOWN'
    local now = os.time()
    if session.lastPlate == plate and now - session.lastAt < 4 then
        return { speed = speed, limit = limit, flagged = false }
    end
    session.lastPlate, session.lastAt = plate, now

    local over = speed - limit
    local officer = officerRadarIdentity(source)
    local message = ('%s (%d) recorded %s at %d km/h (limit %d, +%d).'):format(
        officer.name, officer.id, plate, speed, limit, over)
    policeChat(source, 'HQ', message, 'hq')

    local driverSource = findVehicleDriverSource(targetVehicle)
    if driverSource and driverSource ~= source then
        notifyRadarCaught(driverSource, officer, speed, limit, over)
    end

    return { speed = speed, limit = limit, flagged = true, plate = plate, message = message }
end)

exports.sunset_core:RegisterCallback('sunset:policeFixedRadars', function(source)
    if not FactionCore.hasPerm(source, 'radar') then
        return nil, FactionCore.accessError(source, 'radar', { localeKey = 'factions.action.view_fixed_radars' }, 'law_enforcement')
    end
    local list = {}
    for _, row in ipairs(Sunset.Police.fixedRadars or {}) do
        list[#list + 1] = {
            label = row.label,
            limitKmh = row.limitKmh or math.floor((row.limitMph or 50) * 1.60934),
            limitMph = row.limitMph,
            x = row.coords.x,
            y = row.coords.y,
            z = row.coords.z,
            radius = row.radius,
        }
    end
    return list
end)

local fixedRadarCooldowns = {}

RegisterNetEvent('sunset:police:fixedRadarTrigger', function(radarIndex)
    local source = source
    local char = FactionCore.getChar(source)
    if not char then return end

    local radar = Sunset.Police and Sunset.Police.fixedRadars and Sunset.Police.fixedRadars[radarIndex]
    if not radar then return end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return end
    local vehicle = GetVehiclePedIsIn(ped, false)
    if not vehicle or vehicle == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then return end
    local playerPos = GetEntityCoords(ped)
    local dist = #(playerPos - radar.coords)
    if dist > (radar.radius + 20.0) then return end

    local cooldownKey = ('%s_%s'):format(source, radarIndex)
    local now = os.time()
    if fixedRadarCooldowns[cooldownKey] and (now - fixedRadarCooldowns[cooldownKey]) < 12 then
        return
    end
    fixedRadarCooldowns[cooldownKey] = now

    -- Exempt on-duty emergency services (Police, Sheriff, FIB, EMS, Fire)
    if FactionCore.isOnDuty(source) then
        local factionId = FactionCore.getFactionOf(char)
        local faction = Sunset.Factions[factionId]
        if faction and (faction.type == 'legal' or faction.factionType == 'law_enforcement' or faction.factionType == 'ems' or faction.factionType == 'fire_rescue') then
            return -- On-duty emergency service exempt from fixed speed cameras!
        end
    end

    local limit = radar.limitKmh or math.floor((radar.limitMph or 50) * 1.60934)
    local speedKmh = math.floor(GetEntitySpeed(vehicle) * 3.6 + 0.5)
    if speedKmh <= limit then return end

    local over = speedKmh - limit
    local fine = math.min(1500, math.max(100, 100 + over * 12))

    local paid = exports.sunset_core:RemoveMoney(source, 'bank', fine, 'radar_fine')
    if not paid then
        paid = exports.sunset_core:RemoveMoney(source, 'cash', fine, 'radar_fine')
    end

    local payNote = paid and ('-$%d din cont'):format(fine) or ('neachitat ($%d)'):format(fine)
    TriggerClientEvent('sunset:client:notify', source,
        ('📷 [RADAR FIX — %s] You were caught driving at %d km/h (Limit: %d km/h, +%d km/h). Automatic fine: %s.'):format(
            radar.label, speedKmh, limit, over, payNote
        ),
        'error', 9000
    )

    TriggerClientEvent('sunset:ui:radarAlert', source, {
        type = 'fixed',
        title = ('RADAR FIX — %s'):format(radar.label or 'SPEED CAMERA'),
        location = radar.label or 'Los Santos',
        limit = limit,
        speed = speedKmh,
        over = over,
        fine = fine,
        paid = paid,
        duration = 7500,
    })
end)

exports.sunset_core:RegisterCallback('sunset:policeBackup', function(source, priority)
    if not FactionCore.hasPerm(source, 'backup') then
        return nil, FactionCore.accessError(source, 'backup', { localeKey = 'factions.action.request_police_backup' }, 'law_enforcement')
    end
    if GetResourceState('sunset_dispatch') ~= 'started' then
        return nil, { localeKey = 'factions.message.cannot_request_backup_dispatch_is_offline_contact_staff_no' }
    end

    if not exports.sunset_core:RateLimit(source, 'policeBackup', 3000) then -- [SEC3] backup spam
        return nil, { localeKey = 'factions.message.sec3_slow_down' }
    end
    local char = FactionCore.getChar(source)
    local factionId = char and FactionCore.getFactionOf(char)
    local pos = FactionCore.playerCoords(source)
    local name = exports.sunset_core:GetPlayerDisplayName(source)
    priority = tostring(priority or 'code2'):lower()
    local isPanic = priority == 'panic' or priority == '10-99'
    local isCode3 = priority == 'code3' or isPanic

    local alertLabel = isPanic and ('🚨 10-99 OFFICER DISTRESS (PANIC) — %s (#%d)'):format(name, source)
        or (isCode3 and ('CODE 3 EMERGENCY BACKUP — %s (#%d)'):format(name, source)
        or ('BACKUP (Code 2) requested by %s (#%d)'):format(name, source))

    local call, err = exports.sunset_dispatch:CreateServiceCall(
        source,
        'police_backup',
        pos,
        { officerSource = source, officerName = name, factionId = factionId, priority = priority, isPanic = isPanic },
        alertLabel
    )
    if not call then return nil, err end

    if isPanic then
        broadcastToPolice('🚨 PANIC ALARM', { localeKey = 'factions.msg.officer_activated_10_99_panic_button', params = { name = tostring(name), source = math.floor(tonumber(source) or 0) } })
    else
        broadcastToPolice('BACKUP', { localeKey = 'factions.msg.requested_backup', params = { name = tostring(name), source = math.floor(tonumber(source) or 0), is_code3 = isCode3 and { localeKey = 'factions.msg.code_3' } or { localeKey = 'factions.msg.code_2' } } })
    end

    return call.id
end)

exports.sunset_core:RegisterCallback('sunset:policeCancelBackup', function(source)
    if not FactionCore.hasPerm(source, 'backup') then
        return nil, FactionCore.accessError(source, 'backup', { localeKey = 'factions.action.cancel_police_backup' }, 'law_enforcement')
    end
    if GetResourceState('sunset_dispatch') ~= 'started' then
        return nil, { localeKey = 'factions.message.cannot_cancel_backup_dispatch_is_offline_contact_staff' }
    end

    local call = exports.sunset_dispatch:GetPlayerActiveCall(source, 'police_backup')
    if not call then return nil, { localeKey = 'factions.message.no_active_backup_request' } end

    local ok, err = exports.sunset_dispatch:CancelCall(source, 'police_backup', call.id, 'Backup cancelled by officer')
    if not ok then return nil, err end
    broadcastToPolice('BACKUP CANCELLED', { localeKey = 'factions.msg.officer_cancelled_their_backup_request', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(source)), source = math.floor(tonumber(source) or 0) } })
    return true
end)

RegisterNetEvent('sunset:server:jailComplete', function()
    local src = source
    local jail = JailedOnline[src]
    if not jail then return end
    if not jail.releaseAt or os.time() < jail.releaseAt then
        notify(src, exports.sunset_core:TFor(src, 'factions.msg.your_sentence_is_not_complete_yet'), 'error')
        syncJailBag(src, { releaseAt = jail.releaseAt, minutes = math.max(1, math.ceil((jail.releaseAt - os.time()) / 60)) })
        return
    end
    endJail(src)
    notify(src, exports.sunset_core:TFor(src, 'factions.message.your_sentence_is_complete_you_are_free'), 'success', 6000)
end)

AddEventHandler('sunset:server:characterSelected', function(source, characterId)
    if not characterId then
        local char = FactionCore.getChar(source)
        characterId = char and char.id
    end
    if characterId then
        Police.hydratePlayer(source, characterId)
    end
end)

-- [AUDIT P7-12] On factions restart, already-connected players never re-fire
-- characterSelected, so wanted/jail state stayed lost until relog. Rehydrate
-- every online player from DB after the resource starts.
AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    CreateThread(function()
        Wait(1500)
        for _, pid in ipairs(GetPlayers()) do
            local src = tonumber(pid)
            local ok, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
            if ok and char and char.id then
                pcall(Police.hydratePlayer, src, char.id)
            end
        end
    end)
end)

AddEventHandler('sunset:death:playerDowned', function(victimSource)
    captureWantedAfterDeath(victimSource)

    if GetResourceState('sunset_dispatch') ~= 'started' then return end
    pcall(function()
        local call = exports.sunset_dispatch:GetPlayerActiveCall(victimSource, 'police_backup')
        if call then
            exports.sunset_dispatch:CancelCall(victimSource, 'police_backup', call.id, 'Officer down — backup cancelled')
        end
    end)
end)

AddEventHandler('playerDropped', function()
    local src = source
    local wanted = WantedOnline[src]
    if wanted then
        wanted.decayRemaining = math.max(1, (tonumber(wanted.decayAt) or os.time()) - os.time())
        local cid = wanted.characterId or charId(src)
        if cid then Police.saveWantedToDb(cid, wanted, nil) end
    end
    WantedOnline[src] = nil
    JailedOnline[src] = nil
    RadarSessions[src] = nil
    DeathCapturePending[src] = nil
end)

CreateThread(function()
    while true do
        Wait(10000)
        local now = os.time()
        for src, w in pairs(WantedOnline) do
            if not GetPlayerName(src) then
                WantedOnline[src] = nil
            elseif w.decayAt and now >= w.decayAt then
                local newLevel = w.level - 1
                local cid = charId(src)
                if newLevel <= 0 then
                    clearWanted(src, nil)
                    notify(src, exports.sunset_core:TFor(src, 'factions.msg.your_wanted_level_has_expired'), 'success')
                else
                    w.level = newLevel
                    w.decayRemaining = wantedStarSeconds()
                    w.decayAt = now + w.decayRemaining
                    w.jailMinutes = math.ceil(jailSecondsFor(newLevel, w.surrenderable, false) / 60)
                    if cid then Police.saveWantedToDb(cid, w, nil) end
                    applyWanted(src, w)
                    notify(src, exports.sunset_core:TFor(src, 'factions.msg.wanted_reduced_to_next_star_expires', { new_level = math.floor(tonumber(newLevel) or 0) }), 'info')
                end
            elseif w.decayAt then
                w.decayRemaining = math.max(1, w.decayAt - now)
                local cid = w.characterId or charId(src)
                if cid and (not w.lastPersistAt or now - w.lastPersistAt >= 60) then
                    w.lastPersistAt = now
                    MySQL.update(
                        'UPDATE wanted_records SET decay_remaining_seconds = ?, expires_at = FROM_UNIXTIME(?) WHERE character_id = ? AND active = 1',
                        { w.decayRemaining, w.decayAt, cid }
                    )
                end
            end
        end

        for src, jail in pairs(JailedOnline) do
            if jail.releaseAt and now >= jail.releaseAt then
                endJail(src)
            end
        end
    end
end)

exports('IsJailed', function(source) return Police.isJailed(source) end)

-- ═══════════════════════════════════════════════════════════════
--  [ADMIN TOOLS] Thin wrappers so sunset_admin can jail/unjail/clear
--  wanted through the SAME police pipeline (persistence, sessions,
--  Bolingbroke spawn lock, payday suspension) without touching tables
--  it does not own. Caller (sunset_admin) validates permissions.
-- ═══════════════════════════════════════════════════════════════
exports('AdminJail', function(targetId, minutes, reason, adminSource)
    targetId = tonumber(targetId)
    minutes = math.max(1, math.min(1440, math.floor(tonumber(minutes) or 5)))
    if not targetId or not GetPlayerName(targetId) then
        return false, { localeKey = 'factions.message.that_player_is_not_online' }
    end
    beginJail(targetId, minutes * 60, tostring(reason or 'Admin jail'), adminSource)
    return true
end)

exports('AdminUnjail', function(targetId)
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return false, { localeKey = 'factions.message.that_player_is_not_online' }
    end
    if not JailedOnline[targetId] then
        return false, { localeKey = 'factions.message.that_player_is_not_in_jail' }
    end
    endJail(targetId)
    return true
end)

exports('AdminClearWanted', function(targetId)
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return false, { localeKey = 'factions.message.that_player_is_not_online' }
    end
    clearWanted(targetId, nil)
    return true
end)

AddEventHandler('sunset:police:autoWanted', function(targetId, reasonCode, reasonLabel)
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then return end
    setWanted(targetId, 5, reasonLabel or 'Murder', reasonCode or 'murder', 50, nil, false, false)
    notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.wanted_5_first_degree_murder_no'), 'error', 10000)
end)

exports.sunset_core:RegisterCallback('sunset:getJailSpawnLock', function(source)
    if not Police.isJailed(source) then return { locked = false } end
    local jail = Sunset.Police and Sunset.Police.jailCoords
    if not jail then return { locked = true, x = 1845.0, y = 2585.0, z = 45.7, w = 270.0 } end
    return { locked = true, x = jail.x, y = jail.y, z = jail.z, w = jail.w or 0.0 }
end)

exports.sunset_core:RegisterCallback('sunset:policeUnjail', function(source, targetId)
    local isAdmin = false
    pcall(function() isAdmin = exports.sunset_admin:IsAdmin(source, 2) == true end)
    if not isAdmin and not FactionCore.hasPerm(source, 'arrest') then
        return nil, { localeKey = 'factions.message.you_cannot_release_prisoners' }
    end
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.that_player_is_not_online' }
    end
    if not JailedOnline[targetId] then
        return nil, { localeKey = 'factions.message.that_player_is_not_in_jail' }
    end
    -- [SEC3] non-admin officers cannot release themselves; every release is audited
    if not isAdmin and targetId == source then
        return nil, { localeKey = 'factions.message.you_cannot_release_prisoners' }
    end
    FactionCore.auditLog('police', charId(source), 'unjail', charId(targetId), { admin = isAdmin })
    endJail(targetId)
    notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.you_have_been_released_from_jail'), 'success')
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.released_from_jail_2', { target_id = math.floor(tonumber(targetId) or 0) }), 'success')
    return true
end)

findOnlineSourceByCharacterId = function(characterId)
    characterId = tonumber(characterId)
    if not characterId then return nil end
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local c = FactionCore.getChar(src)
        if c and tonumber(c.id) == characterId then
            return src
        end
    end
    return nil
end

exports.sunset_core:RegisterCallback('sunset:policeMdcData', function(source)
    if not FactionCore.hasPerm(source, 'mdc') then
        return nil, FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.access_the_mdt' }, 'law_enforcement')
    end

    local char = FactionCore.getChar(source)
    local factionId = char and select(1, FactionCore.getFactionOf(char)) or 'police'
    local _, grade = FactionCore.getFactionOf(char)
    local gradeInfo = factionId and Sunset.GetFactionGrade and Sunset.GetFactionGrade(factionId, grade)
    local factionObj = Sunset.Factions and Sunset.Factions[factionId]

    local deptLabel = 'Los Santos Police Department'
    local shortDept = 'LSPD'
    if factionId == 'sheriff' then
        deptLabel = "San Andreas Sheriff's Department"
        shortDept = 'SASD'
    elseif factionId == 'fib' then
        deptLabel = 'Federal Investigation Bureau'
        shortDept = 'FIB'
    end

    local callsign = ('%s-%02d'):format(shortDept:sub(1, 1) .. '-UNIT', source)
    local officerInfo = {
        id = source,
        charId = char and char.id or 0,
        name = exports.sunset_core:GetPlayerDisplayName(source),
        department = factionId,
        departmentLabel = deptLabel,
        shortDept = shortDept,
        rank = (gradeInfo and gradeInfo.label) or 'Officer',
        callsign = callsign,
        status = UnitStatuses[source] or '10-8',
    }

    -- Active 112 & Police Calls
    local activeCalls = {}
    if GetResourceState('sunset_dispatch') == 'started' then
        local calls = exports.sunset_dispatch:GetActiveCalls() or {}
        for _, c in ipairs(calls) do
            if c.callType == 'police' or c.callType == 'police_backup' or (c.metadata and c.metadata.emergency == '112') then
                local meta = c.metadata or {}
                activeCalls[#activeCalls + 1] = {
                    id = c.id,
                    callType = c.callType,
                    status = c.status,
                    callerName = c.callerName or 'Citizen',
                    callerPhone = meta.callerPhone or 'N/A',
                    category = meta.category or (c.callType == 'police_backup' and 'Officer Backup' or 'Emergency'),
                    street = meta.street or 'Unknown Location',
                    area = meta.area or 'Los Santos',
                    description = c.description or exports.sunset_core:TFor(source, 'factions.ui.emergency_reported'),
                    coords = c.coords or { x = 0, y = 0, z = 0 },
                    createdAt = c.createdAt or os.time(),
                    responderName = c.responderName,
                    isResponder = char and char.id == c.responderCharacterId,
                    isPanic = meta.isPanic == true,
                    priority = meta.priority or (c.callType == 'police_backup' and 'code3' or 'normal'),
                }
            end
        end
    end

    -- Active Wanted List
    local wanted = buildWantedListRows()

    -- Online Law Enforcement Units
    local units = {}
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        if src and FactionCore.isOnDuty(src) and FactionCore.isLawEnforcementMember(src) then
            local uChar = FactionCore.getChar(src)
            local uFactionId = uChar and select(1, FactionCore.getFactionOf(uChar)) or 'police'
            local _, uGrade = FactionCore.getFactionOf(uChar)
            local uGradeInfo = uFactionId and Sunset.GetFactionGrade and Sunset.GetFactionGrade(uFactionId, uGrade)
            local uShort = uFactionId == 'sheriff' and 'SASD' or (uFactionId == 'fib' and 'FIB' or 'LSPD')
            local uPos = FactionCore.playerCoords(src)
            units[#units + 1] = {
                id = src,
                name = exports.sunset_core:GetPlayerDisplayName(src),
                department = uFactionId,
                shortDept = uShort,
                rank = (uGradeInfo and uGradeInfo.label) or 'Officer',
                status = UnitStatuses[src] or '10-8',
                isMe = src == source,
                coords = uPos and { x = math.floor(uPos.x * 10) / 10, y = math.floor(uPos.y * 10) / 10, z = math.floor(uPos.z * 10) / 10 } or nil,
            }
        end
    end

    -- Active BOLOs
    local activeBolos = {}
    for _, b in pairs(Bolos) do
        activeBolos[#activeBolos + 1] = b
    end
    table.sort(activeBolos, function(a, b) return (a.createdAt or 0) > (b.createdAt or 0) end)

    -- Penal code reasons formatted
    local penalReasons = {}
    for code, row in pairs(Sunset.Police and Sunset.Police.reasons or {}) do
        penalReasons[#penalReasons + 1] = {
            code = code,
            label = row.label,
            stars = row.stars,
            surrenderable = row.surrenderable ~= false,
            jailMinutes = math.ceil(jailSecondsFor(row.stars, row.surrenderable ~= false, false) / 60),
        }
    end
    table.sort(penalReasons, function(a, b) return a.stars < b.stars end)

    -- Active backup status
    local hasActiveBackup = false
    local activeBackupId = nil
    if GetResourceState('sunset_dispatch') == 'started' then
        local bCall = exports.sunset_dispatch:GetPlayerActiveCall(source, 'police_backup')
        if bCall then
            hasActiveBackup = true
            activeBackupId = bCall.id
        end
    end

    -- Radar session status
    local radarSession = RadarSessions[source]

    return {
        officer = officerInfo,
        calls = activeCalls,
        wanted = wanted,
        units = units,
        bolos = activeBolos,
        reasons = penalReasons,
        violations = (Sunset.Police and Sunset.Police.violations) or {},
        hasActiveBackup = hasActiveBackup,
        activeBackupId = activeBackupId,
        radarActive = radarSession ~= nil,
        radarLimit = radarSession and radarSession.limitKmh or 90,
    }
end)

exports.sunset_core:RegisterCallback('sunset:policeMdcLookup', function(source, query)
    if not FactionCore.hasPerm(source, 'mdc') then
        return { error = FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.search_the_mdt' }, 'law_enforcement') }
    end

    query = tostring(query or ''):sub(1, 64):gsub('^%s*(.-)%s*$', '%1') -- [SEC3] bound client string
    if query == '' then
        return { error = exports.sunset_core:TFor(source, 'factions.ui.enter_a_citizen_name_server_id') }
    end

    local targetChar = nil
    local onlineSrc = nil
    local num = tonumber(query)

    -- If numeric: first try online server ID
    if num and num > 0 and num <= 256 and GetPlayerName(num) then
        local c = FactionCore.getChar(num)
        if c then
            targetChar = c
            onlineSrc = num
        end
    end

    -- If not found by server ID, try character ID
    if not targetChar and num and num > 0 then
        local row = MySQL.single.await('SELECT * FROM characters WHERE id = ?', { num })
        if row then
            targetChar = row
            onlineSrc = findOnlineSourceByCharacterId(row.id)
        end
    end

    -- If not found yet, try searching by name
    if not targetChar then
        local namePattern = '%' .. query .. '%'
        local rows = MySQL.query.await([[
            SELECT * FROM characters
            WHERE CONCAT(firstname, ' ', lastname) LIKE ?
               OR firstname LIKE ?
               OR lastname LIKE ?
            ORDER BY id DESC LIMIT 5
        ]], { namePattern, namePattern, namePattern }) or {}

        if #rows > 0 then
            targetChar = rows[1]
            onlineSrc = findOnlineSourceByCharacterId(targetChar.id)
        end
    end

    if not targetChar then
        return { error = exports.sunset_core:TFor(source, 'factions.ui.no_citizen_record_found_matching', { query = tostring(query) }) }
    end

    local charId = targetChar.id
    local meta = type(targetChar.metadata) == 'table' and targetChar.metadata or (type(targetChar.metadata) == 'string' and json.decode(targetChar.metadata) or {})
    local phone = targetChar.phone_number or meta.phone or ('555-%04d'):format(charId)
    local fullName = ('%s %s'):format(targetChar.firstname or '', targetChar.lastname or ''):gsub('^%s*(.-)%s*$', '%1')

    -- Check Wanted
    local isWanted = false
    local wantedLevel = 0
    local wantedReason = ''
    local wantedSurrenderable = true
    if onlineSrc and WantedOnline[onlineSrc] then
        isWanted = true
        wantedLevel = WantedOnline[onlineSrc].level or 1
        wantedReason = WantedOnline[onlineSrc].reason or 'Active Wanted'
        wantedSurrenderable = WantedOnline[onlineSrc].surrenderable ~= false
    end

    -- Past wanted records from MySQL
    local wantedHistory = MySQL.query.await([[
        SELECT level, reason_label, surrenderable, active, created_at
        FROM wanted_records
        WHERE character_id = ?
        ORDER BY id DESC LIMIT 10
    ]], { charId }) or {}

    local wantedRows = {}
    for _, w in ipairs(wantedHistory) do
        wantedRows[#wantedRows + 1] = {
            level = w.level,
            reason = w.reason_label,
            surrenderable = w.surrenderable == 1 or w.surrenderable == true,
            active = w.active == 1 or w.active == true,
            date = w.created_at and tostring(w.created_at):sub(1, 16) or '',
        }
        if w.active == 1 and not isWanted then
            isWanted = true
            wantedLevel = w.level
            wantedReason = w.reason_label
            wantedSurrenderable = w.surrenderable == 1
        end
    end

    -- Jail status
    local isJailed = false
    local jailMinutesRemaining = 0
    if onlineSrc and JailedOnline[onlineSrc] then
        isJailed = true
        jailMinutesRemaining = math.max(1, math.ceil((JailedOnline[onlineSrc].releaseAt - os.time()) / 60))
    end

    -- Cazier (past convictions and jail sentences)
    local sentences = MySQL.query.await([[
        SELECT id, reason, duration_minutes, status, created_at, released_at
        FROM jail_sentences
        WHERE character_id = ?
        ORDER BY id DESC LIMIT 15
    ]], { charId }) or {}

    local cazierRows = {}
    for _, s in ipairs(sentences) do
        cazierRows[#cazierRows + 1] = {
            id = s.id,
            reason = s.reason or exports.sunset_core:TFor(source, 'factions.ui.sentence'),
            duration = s.duration_minutes,
            status = s.status or 'served',
            date = s.created_at and tostring(s.created_at):sub(1, 16) or '',
        }
        if s.status == 'active' then
            isJailed = true
        end
    end

    -- Unpaid fines and tickets history
    local unpaid = MySQL.scalar.await(
        'SELECT COALESCE(SUM(amount), 0) FROM tickets WHERE target_character_id = ? AND paid = 0',
        { charId }
    ) or 0

    local tickets = MySQL.query.await([[
        SELECT id, amount, reason, reason_code, paid, paid_at, created_at
        FROM tickets
        WHERE target_character_id = ?
        ORDER BY id DESC LIMIT 15
    ]], { charId }) or {}

    local ticketRows = {}
    for _, t in ipairs(tickets) do
        ticketRows[#ticketRows + 1] = {
            id = t.id,
            amount = t.amount,
            reason = t.reason,
            violationCode = t.reason_code,
            paid = t.paid == 1 or t.paid == true,
            date = t.created_at and tostring(t.created_at):sub(1, 16) or '',
        }
    end

    -- Registered Personal Vehicles
    local vehicles = MySQL.query.await([[
        SELECT id, plate, model, stored, garage, fuel
        FROM vehicles
        WHERE character_id = ?
        ORDER BY id DESC LIMIT 15
    ]], { charId }) or {}

    local vehicleRows = {}
    for _, v in ipairs(vehicles) do
        local plateClean = tostring(v.plate):upper():gsub('^%s*(.-)%s*$', '%1')
        local bolo = Bolos[plateClean]
        vehicleRows[#vehicleRows + 1] = {
            id = v.id,
            plate = plateClean,
            model = v.model,
            displayName = exports.sunset_vehicles:GetVehicleDisplayName(v.model),
            stored = v.stored == 1 or v.stored == true,
            garage = v.garage or 'legion',
            fuel = math.floor(tonumber(v.fuel) or 100),
            bolo = bolo ~= nil,
            boloReason = bolo and bolo.reason or nil,
        }
    end

    -- Character Licenses
    local licenses = MySQL.query.await([[
        SELECT license_type, issued_at
        FROM character_licenses
        WHERE character_id = ?
    ]], { charId }) or {}

    local licenseRows = {}
    for _, lic in ipairs(licenses) do
        licenseRows[#licenseRows + 1] = {
            type = lic.license_type,
            issuedAt = lic.issued_at and tostring(lic.issued_at):sub(1, 10) or '',
        }
    end

    -- Person BOLO check
    local personBolo = Bolos[fullName:upper()] or Bolos[tostring(charId)]

    return {
        found = true,
        id = charId,
        serverId = onlineSrc,
        isOnline = onlineSrc ~= nil,
        name = fullName,
        dob = targetChar.dateofbirth and tostring(targetChar.dateofbirth):sub(1, 10) or 'Unknown',
        gender = tonumber(targetChar.gender) == 1 and 'Female' or 'Male',
        nationality = targetChar.nationality or 'San Andreas',
        phone = phone,
        job = targetChar.job or 'Unemployed',
        wanted = isWanted,
        wantedLevel = wantedLevel,
        wantedReason = wantedReason,
        wantedSurrenderable = wantedSurrenderable,
        wantedHistory = wantedRows,
        jailed = isJailed,
        jailMinutes = jailMinutesRemaining,
        cazier = cazierRows,
        unpaidFines = unpaid,
        tickets = ticketRows,
        vehicles = vehicleRows,
        licenses = licenseRows,
        bolo = personBolo ~= nil,
        boloReason = personBolo and personBolo.reason or nil,
    }
end)

exports.sunset_core:RegisterCallback('sunset:policeMdcVehicleLookup', function(source, query)
    if not FactionCore.hasPerm(source, 'mdc') then
        return { error = FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.search_vehicle_dmv' }, 'law_enforcement') }
    end
    query = tostring(query or ''):sub(1, 32):gsub('^%s*(.-)%s*$', '%1') -- [SEC3] bound client string
    if query == '' then return { error = exports.sunset_core:TFor(source, 'factions.ui.enter_a_plate_or_model_to') } end

    local pattern = '%' .. query:upper() .. '%'
    local rows = MySQL.query.await([[
        SELECT v.id, v.character_id, v.plate, v.model, v.fuel, v.stored, v.garage, v.props,
               c.firstname, c.lastname, c.phone_number, c.metadata
        FROM vehicles v
        LEFT JOIN characters c ON v.character_id = c.id
        WHERE UPPER(v.plate) LIKE ? OR UPPER(v.model) LIKE ?
        ORDER BY v.id DESC LIMIT 15
    ]], { pattern, pattern }) or {}

    local results = {}
    for _, row in ipairs(rows) do
        local plateClean = tostring(row.plate):upper():gsub('^%s*(.-)%s*$', '%1')
        local bolo = Bolos[plateClean]
        local meta = type(row.metadata) == 'table' and row.metadata or (type(row.metadata) == 'string' and json.decode(row.metadata) or {})
        local ownerPhone = row.phone_number or meta.phone or ('555-%04d'):format(row.character_id or 0)

        local tuningInfo = nil
        if GetResourceState('sunset_tuning') == 'started' then
            local ok, tRes = pcall(function()
                return exports.sunset_tuning:GetVehicleTuningInfo(row.props)
            end)
            if ok and tRes then tuningInfo = tRes end
        end

        results[#results + 1] = {
            id = row.id,
            plate = plateClean,
            model = row.model,
            displayName = exports.sunset_vehicles:GetVehicleDisplayName(row.model),
            characterId = row.character_id,
            ownerName = (row.firstname and row.lastname) and (row.firstname .. ' ' .. row.lastname) or 'Unknown / Impounded',
            ownerPhone = ownerPhone,
            stored = row.stored == 1 or row.stored == true,
            garage = row.garage or 'Unknown',
            fuel = math.floor(tonumber(row.fuel) or 100),
            bolo = bolo ~= nil,
            boloReason = bolo and bolo.reason or nil,
            boloDate = bolo and bolo.date or nil,
            boloOfficer = bolo and bolo.officer or nil,
            tuningInfo = tuningInfo,
        }
    end
    return { results = results }
end)

function Police.suspendLicense(source, targetId, licenseType, reason)
    if not FactionCore.hasPerm(source, 'ticket')
        and not FactionCore.hasPerm(source, 'confiscate')
        and not FactionCore.hasPerm(source, 'arrest')
        and not FactionCore.hasPerm(source, 'mdc') then
        return nil, FactionCore.accessError(source, 'ticket', { localeKey = 'factions.action.suspend_a_license' }, 'law_enforcement')
    end

    licenseType = tostring(licenseType or 'driver'):lower()
    if licenseType ~= 'driver' and licenseType ~= 'weapon' then
        licenseType = 'driver'
    end

    reason = tostring(reason or ''):gsub('[%c]', ' '):sub(1, 200):gsub('^%s*(.-)%s*$', '%1') -- [SEC3]
    if not exports.sunset_core:RateLimit(source, 'policeSuspendLicense', 1500) then
        return nil, { localeKey = 'factions.message.sec3_slow_down' }
    end
    if reason == '' then
        reason = 'Excessive speed (+50 km/h) / Dangerous driving against traffic'
    end

    local targetNum = tonumber(targetId)
    if not targetNum or targetNum <= 0 then
        return nil, { localeKey = 'factions.message.the_citizen_id_is_invalid' }
    end

    local targetChar = nil
    local onlineSrc = nil

    -- 1. Check if targetNum is an active server ID
    if targetNum <= 256 and GetPlayerName(targetNum) then
        local c = FactionCore.getChar(targetNum)
        if c then
            targetChar = c
            onlineSrc = targetNum
        end
    end

    -- 2. If not active server ID, try character ID from database
    if not targetChar then
        local row = MySQL.single.await('SELECT id, firstname, lastname FROM characters WHERE id = ?', { targetNum })
        if row then
            targetChar = row
            onlineSrc = findOnlineSourceByCharacterId(row.id)
        end
    end

    if not targetChar then
        return nil, { localeKey = 'factions.message.no_citizen_found_with_id_value', formatArgs = { tostring(targetId) } }
    end

    local cid = targetChar.id
    local targetName = ('%s %s'):format(targetChar.firstname or '', targetChar.lastname or ''):gsub('^%s*(.-)%s*$', '%1')
    if targetName == '' then targetName = ('Citizen #%d'):format(cid) end

    -- Check if target has the license in database
    local existing = MySQL.single.await('SELECT id FROM character_licenses WHERE character_id = ? AND license_type = ?', { cid, licenseType })
    if not existing then
        local licLabel = licenseType == 'driver' and 'driver' or 'weapon'
        return nil, { localeKey = 'factions.message.value_does_not_hold_an_active_value_license', formatArgs = { targetName, licLabel } }
    end

    -- Revoke license
    local ok = false
    if exports.sunset_licenses and exports.sunset_licenses.RevokeLicenseByCharacterId then
        ok = exports.sunset_licenses:RevokeLicenseByCharacterId(cid, licenseType)
    else
        MySQL.update.await('DELETE FROM character_licenses WHERE character_id = ? AND license_type = ?', { cid, licenseType })
        ok = true
    end

    FactionCore.auditLog('police', charId(source), 'license_suspend', cid, { license = licenseType, reason = reason }) -- [SEC3]
    local officerName = exports.sunset_core:GetPlayerDisplayName(source)
    local licLabelKey = licenseType == 'driver' and 'factions.word.license_driving' or 'factions.word.license_weapon'

    -- If suspect is online: refresh client cache and notify
    if onlineSrc then
        TriggerClientEvent('sunset:licenses:refresh', onlineSrc)
        TriggerClientEvent('sunset:client:notify', onlineSrc,
            exports.sunset_core:TFor(onlineSrc, 'factions.message.license_suspended_your_value_license_has_been_confiscated_by_the_', exports.sunset_core:TFor(onlineSrc, licLabelKey), reason, officerName),
            'error', 12000)
    end

    -- Broadcast to police channels
    broadcastToPolice('TRAFFIC', { localeKey = 'factions.msg.officer_suspended_the_license_of_citizen', params = { officer_name = tostring(officerName), source = math.floor(tonumber(source) or 0), license = { localeKey = licLabelKey }, target_name = tostring(targetName), cid = math.floor(tonumber(cid) or 0), reason = tostring(reason) } })

    notify(source, exports.sunset_core:TFor(source, 'factions.msg.you_successfully_suspended_the_license_of', { license = exports.sunset_core:TFor(source, licLabelKey), target_name = tostring(targetName), cid = math.floor(tonumber(cid) or 0) }), 'success', 8000)

    return {
        success = true,
        targetId = cid,
        targetName = targetName,
        licenseType = licenseType,
        reason = reason,
    }
end

exports.sunset_core:RegisterCallback('sunset:policeMdcSuspendLicense', function(source, targetId, licenseType, reason)
    local res, err = Police.suspendLicense(source, targetId, licenseType, reason)
    if not res then return { error = err } end
    return { ok = true, data = res }
end)

RegisterCommand('suspendlicense', function(source, args)
    if source == 0 then return end
    local target = tonumber(args[1])
    if not target then
        return notify(source, exports.sunset_core:TFor(source, 'factions.msg.syntax_suspendlicense_id_driver_weapon_reaso'), 'error')
    end
    local licType = args[2] and tostring(args[2]):lower() or 'driver'
    local reasonParts = {}
    local startIdx = 3
    if licType ~= 'driver' and licType ~= 'weapon' then
        table.insert(reasonParts, args[2])
        licType = 'driver'
        startIdx = 3
    end
    for i = startIdx, #args do
        table.insert(reasonParts, args[i])
    end
    local reason = table.concat(reasonParts, ' ')
    if reason == '' then reason = 'Excessive speed (+50 km/h) / Driving against traffic' end

    local res, err = Police.suspendLicense(source, target, licType, reason)
    if not res and err then
        notify(source, err, 'error')
    end
end, false)

RegisterCommand('confiscatelicense', function(source, args)
    if source == 0 then return end
    ExecuteCommand(('suspendlicense %s'):format(table.concat(args, ' ')))
end, false)

exports.sunset_core:RegisterCallback('sunset:policeMdcToggleBolo', function(source, targetType, targetKey, reason, notes)
    if not FactionCore.hasPerm(source, 'mdc') then
        return { error = FactionCore.accessError(source, 'mdc', { localeKey = 'factions.action.manage_bolos' }, 'law_enforcement') }
    end
    targetKey = tostring(targetKey or ''):sub(1, 40):upper():gsub('^%s*(.-)%s*$', '%1')
    if targetKey == '' then return { error = exports.sunset_core:TFor(source, 'factions.ui.target_identifier_required') } end
    -- [SEC3] bound client-supplied BOLO fields (were stored/broadcast verbatim, any type/length) and cap table size
    targetType = (targetType == 'citizen' or targetType == 'person') and targetType or 'vehicle'
    reason = type(reason) == 'string' and reason:gsub('[%c]', ' '):sub(1, 200) or nil
    notes = type(notes) == 'string' and notes:gsub('[%c]', ' '):sub(1, 400) or ''
    if not Bolos[targetKey] then
        local n = 0
        for _ in pairs(Bolos) do n = n + 1 end
        if n >= 300 then return { error = exports.sunset_core:TFor(source, 'factions.ui.bolo_list_is_full') } end
    end

    local officerName = exports.sunset_core:GetPlayerDisplayName(source)
    if Bolos[targetKey] then
        Bolos[targetKey] = nil
        broadcastToPolice('BOLO', { localeKey = 'factions.msg.bolo_cleared_by', params = { target_key = tostring(targetKey), officer_name = tostring(officerName) } })
        return { ok = true, active = false, key = targetKey }
    else
        Bolos[targetKey] = {
            type = targetType or 'vehicle',
            key = targetKey,
            reason = reason or 'Wanted in connection with active police investigation', -- i18n-ignore: stored default reason
            notes = notes or '',
            officer = officerName,
            officerId = source,
            date = os.date('%Y-%m-%d %H:%M'),
            createdAt = os.time(),
        }
        broadcastToPolice('BOLO', { localeKey = 'factions.msg.new_bolo_issued_by', params = { target_key = tostring(targetKey), reason = reason or { localeKey = 'factions.word.active_bolo' }, officer_name = tostring(officerName) } })
        return { ok = true, active = true, bolo = Bolos[targetKey] }
    end
end)

exports.sunset_core:RegisterCallback('sunset:policeMdcSetUnitStatus', function(source, status)
    if not FactionCore.isLawEnforcementMember(source) or not FactionCore.isOnDuty(source) then
        return { error = exports.sunset_core:TFor(source, 'factions.ui.you_must_be_on_duty_as') }
    end
    status = tostring(status or '10-8'):sub(1, 16):upper() -- [SEC3]
    UnitStatuses[source] = status
    return { ok = true, status = status }
end)

exports.sunset_core:RegisterCallback('sunset:policeMdcSetCallStatus', function(source, callId, action)
    if not FactionCore.isLawEnforcementMember(source) or not FactionCore.isOnDuty(source) then
        return { error = exports.sunset_core:TFor(source, 'factions.ui.you_must_be_on_duty_as') }
    end
    callId = tonumber(callId)
    if not callId then return { error = exports.sunset_core:TFor(source, 'factions.ui.invalid_call_id') } end

    if action == 'respond' then
        if GetResourceState('sunset_dispatch') == 'started' then
            local targetCall = exports.sunset_dispatch:GetCall(callId)
            local callType = (targetCall and targetCall.callType) or 'police'
            local res, err = exports.sunset_dispatch:AcceptCall(source, callType, callId)
            if not res then return { error = err or exports.sunset_core:TFor(source, 'factions.ui.could_not_attach_to_call') } end
            UnitStatuses[source] = '10-97'
            return { ok = true, status = 'ASSIGNED' }
        end
    elseif action == 'clear' then
        if GetResourceState('sunset_dispatch') == 'started' then
            local res, err = exports.sunset_dispatch:CompleteCall(callId, source)
            if not res then return { error = err or exports.sunset_core:TFor(source, 'factions.ui.could_not_clear_call') } end
            UnitStatuses[source] = '10-8'
            return { ok = true, status = 'COMPLETED' }
        end
    end
    return { error = exports.sunset_core:TFor(source, 'factions.ui.unknown_action') }
end)

exports.sunset_core:RegisterCallback('sunset:policeIssueTicket', function(source, targetId, amount, reason, reasonCode)
    if not FactionCore.hasPerm(source, 'ticket') and not FactionCore.hasPerm(source, 'fine') then
        return nil, FactionCore.accessError(source, 'ticket', { localeKey = 'factions.action.issue_a_citation' }, 'law_enforcement')
    end
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_enter_the_server', formatArgs = { tostring(targetId or '?') } }
    end
    if targetId == source then return nil, { localeKey = 'factions.message.you_cannot_issue_a_citation_to_yourself' } end

    reasonCode = reasonCode and string.lower(reasonCode) or nil
    if reasonCode then
        local violation = Sunset.GetPoliceViolation(reasonCode)
        if not violation then return nil, { localeKey = 'factions.message.that_citation_violation_is_invalid_close_and_reopen_ticket' } end
        amount = violation.amount
        reason = violation.label
    else
        return nil, { localeKey = 'factions.message.select_a_violation_in_the_citation_window_before_pressing' }
    end

    amount = math.floor(tonumber(amount) or 0)
    if amount < 1 or amount > 50000 then return nil, { localeKey = 'factions.message.invalid_citation_amount' } end
    if not exports.sunset_core:RateLimit(source, 'policeIssueTicket', 2000) then -- [SEC3] citation spam
        return nil, { localeKey = 'factions.message.sec3_slow_down' }
    end

    local officerPos = FactionCore.playerCoords(source)
    local targetPos = FactionCore.playerCoords(targetId)
    if FactionCore.distBetween(officerPos, targetPos) > 30.0 then
        return nil, { localeKey = 'factions.message.move_closer_to_player_value_citations_require_you_to', formatArgs = { targetId } }
    end

    local officer = FactionCore.getChar(source)
    local target = FactionCore.getChar(targetId)
    if not officer then return nil, { localeKey = 'factions.message.your_character_is_no_longer_loaded_reconnect_and_select' } end
    if not target then return nil, { localeKey = 'factions.message.player_value_has_not_loaded_a_character_yet_wait', formatArgs = { targetId } } end

    local ticketId = MySQL.insert.await([[
        INSERT INTO tickets (officer_character_id, target_character_id, amount, reason, reason_code, paid)
        VALUES (?, ?, ?, ?, ?, 0)
    ]], { officer.id, target.id, amount, reason or '', reasonCode or '' })

    TriggerClientEvent('sunset:ui:ticketReceive', targetId, {
        ticketId = ticketId,
        id = ticketId,
        amount = amount,
        reason = reason or exports.sunset_core:TFor(source, 'factions.ui.traffic_violation'),
        officer = exports.sunset_core:GetPlayerDisplayName(source),
        officerId = source,
    })
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.citation_issued_to_2', { ticket_id = math.floor(tonumber(ticketId) or 0), target_id = math.floor(tonumber(targetId) or 0) }), 'success')
    return ticketId
end)

exports.sunset_core:RegisterCallback('sunset:policePayTicket', function(source, ticketId)
    ticketId = tonumber(ticketId)
    if not ticketId then return nil, { localeKey = 'factions.message.this_citation_has_no_valid_id_close_the_window' } end

    local char = FactionCore.getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded_reconnect_and_select_it' } end

    local row = MySQL.single.await(
        'SELECT id, target_character_id, amount, reason, paid FROM tickets WHERE id = ?',
        { ticketId }
    )
    if not row or row.target_character_id ~= char.id then return nil, { localeKey = 'factions.message.this_citation_does_not_exist_or_does_not_belong' } end
    if row.paid == 1 then return nil, { localeKey = 'factions.message.this_citation_has_already_been_paid_no_money_was' } end
    if row.paid ~= 0 then return nil, { localeKey = 'factions.message.this_citation_was_already_refused_or_is_currently_being' } end

    local claimed = MySQL.update.await('UPDATE tickets SET paid = 3 WHERE id = ? AND paid = 0', { ticketId })
    if not claimed or claimed < 1 then return nil, { localeKey = 'factions.message.this_citation_was_already_handled_no_money_was_taken' } end

    if not exports.sunset_core:RemoveMoney(source, 'bank', row.amount, 'ticket')
        and not exports.sunset_core:RemoveMoney(source, 'cash', row.amount, 'ticket') then
        MySQL.update.await('UPDATE tickets SET paid = 0 WHERE id = ? AND paid = 3', { ticketId })
        return nil, { localeKey = 'factions.message.you_need_value_in_bank_or_cash_to_pay', formatArgs = { row.amount } }
    end

    MySQL.update.await('UPDATE tickets SET paid = 1, paid_at = NOW() WHERE id = ? AND paid = 3', { ticketId })
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.paid_citation', { amount = tostring(row.amount), reason = tostring(row.reason or '') }), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:policeRefuseTicket', function(source, ticketId)
    ticketId = tonumber(ticketId)
    if not ticketId then return nil, { localeKey = 'factions.message.this_citation_has_no_valid_id_close_the_window' } end

    local char = FactionCore.getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded_reconnect_and_select_it' } end

    local row = MySQL.single.await(
        'SELECT id, target_character_id, amount, reason, paid FROM tickets WHERE id = ?',
        { ticketId }
    )
    if not row or row.target_character_id ~= char.id then return nil, { localeKey = 'factions.message.this_citation_does_not_exist_or_does_not_belong' } end
    if row.paid == 1 then return nil, { localeKey = 'factions.message.this_citation_was_already_paid_and_cannot_be_refused' } end
    if row.paid ~= 0 then return nil, { localeKey = 'factions.message.this_citation_was_already_refused_or_is_currently_being_796a1b' } end

    local refused = MySQL.update.await('UPDATE tickets SET paid = 2, paid_at = NOW() WHERE id = ? AND paid = 0', { ticketId })
    if not refused or refused < 1 then return nil, { localeKey = 'factions.message.this_citation_was_already_handled_no_new_wanted_charge' } end

    local wanted = setWanted(source, 1, 'Refused citation: ' .. (row.reason or ''), 'evading', 4, nil, false, false)
    notify(source, exports.sunset_core:TFor(source, 'factions.msg.you_refused_citation_wanted_increased_to', { ticket_id = math.floor(tonumber(ticketId) or 0), level = math.floor(tonumber(wanted.level) or 0) }), 'error')
    broadcastToPolice('CITATION REFUSED', { localeKey = 'factions.msg.refused_citation_wanted_is_now', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(source)), source = math.floor(tonumber(source) or 0), ticket_id = math.floor(tonumber(ticketId) or 0), reason = row.reason or { localeKey = 'factions.word.violation' }, level = math.floor(tonumber(wanted.level) or 0) } })
    return true
end)

print('[sunset_factions] police server loaded (radar, MDC, tickets, wanted, jail)')
