local Downed = {}
local LastPvPAttacker = {}
local MurderWindow = {}

AddEventHandler('sunset:death:recordAttacker', function(victimSrc, attackerSrc)
    victimSrc = tonumber(victimSrc)
    attackerSrc = tonumber(attackerSrc)
    if not victimSrc or not attackerSrc or victimSrc == attackerSrc then return end
    LastPvPAttacker[victimSrc] = { attacker = attackerSrc, at = os.time() }
end)

local function getDeathSpawnPosition(char, source)
    if not char then
        local h = Sunset.Config.HospitalSpawn or Sunset.Config.DefaultSpawn
        return { x = h.x, y = h.y, z = h.z, w = h.w or 0.0 }
    end
    local md = type(char.metadata) == 'table' and char.metadata or {}
    if type(char.metadata) == 'string' then
        local ok, dec = pcall(json.decode, char.metadata)
        md = ok and dec or {}
    end
    local choice = md.spawn_choice
    -- If player chose house or hq, resolve that spawn
    if (choice == 'house' or choice == 'hq') and Sunset.GetSpawnPosition then
        local pos = Sunset.GetSpawnPosition(char, source)
        if pos and pos.x then return pos end
    end
    -- Default / Hospital spawn
    local h = Sunset.Config.HospitalSpawn or Sunset.Config.DefaultSpawn
    return { x = h.x, y = h.y, z = h.z, w = h.w or 0.0 }
end

local function respawnPlayer(source, bill)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false, { localeKey = 'death.message.no_character' } end

    bill = bill or 0
    if bill > 0 then
        if not exports.sunset_core:RemoveMoney(source, 'bank', bill, 'hospital') then
            exports.sunset_core:RemoveMoney(source, 'cash', bill, 'hospital')
        end
    end

    char.is_dead = false
    Downed[source] = nil

    if GetResourceState('sunset_properties') == 'started' then
        pcall(function() exports.sunset_properties:LeaveProperty(source) end)
    end
    SetPlayerRoutingBucket(source, 0)
    local pos = getDeathSpawnPosition(char, source)
    pcall(function() exports.sunset_core:SaveCharacter(source) end)
    TriggerClientEvent('sunset:death:forceHospital', source, pos, bill)
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function RevivePlayer(targetId)
    targetId = tonumber(targetId)
    if not targetId then
        return false, { localeKey = 'death.message.usage_revive_player_id' }
    end
    if not GetPlayerName(targetId) then
        return false, { localeKey = 'death.message.player_not_found_check_tab_for_server_id' }
    end

    local char = exports.sunset_core:GetCharacter(targetId)
    if char then
        char.is_dead = false
        TriggerClientEvent('sunset:client:updateCharacter', targetId, char)
    end

    Downed[targetId] = nil
    if GetResourceState('sunset_anticheat') == 'started' then
        pcall(function() exports.sunset_anticheat:MarkLegit(targetId, 'health', 10) end)
    end
    TriggerClientEvent('sunset:death:reviveInPlace', targetId)
    return true
end

function ClearDownedForCustody(targetId)
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return false, { localeKey = 'death.message.player_not_found' }
    end

    local char = exports.sunset_core:GetCharacter(targetId)
    if char then
        char.is_dead = false
        pcall(function() exports.sunset_core:SaveCharacter(targetId) end)
        TriggerClientEvent('sunset:client:updateCharacter', targetId, char)
    end
    Downed[targetId] = nil
    return true
end

function StabilizePlayer(targetId)
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return false, { localeKey = 'death.message.player_not_found' }
    end
    if not Downed[targetId] then
        return false, { localeKey = 'death.message.target_is_not_dead' }
    end
    return true
end

exports('RevivePlayer', RevivePlayer)
exports('RespawnPlayer', respawnPlayer)
exports('StabilizePlayer', StabilizePlayer)
exports('ClearDownedForCustody', ClearDownedForCustody)
exports('IsPlayerDowned', function(source) return Downed[source] ~= nil end)

local function isOnDutyPolice(src)
    local onDuty = false
    pcall(function()
        onDuty = exports.sunset_factions:IsOnDuty(src) == true
    end)
    if not onDuty then return false end
    local char = exports.sunset_core:GetCharacter(src)
    if not char then return false end
    local md = type(char.metadata) == 'table' and char.metadata or {}
    local factionId = md.faction or char.job
    if factionId == 'police' then return true end
    if Sunset.GetCharacterFaction then
        factionId = select(1, Sunset.GetCharacterFaction(char)) or factionId
    end
    return Sunset.FactionTypeMatches
        and Sunset.FactionTypeMatches(factionId, 'law_enforcement') == true
end

-- [SEC2] Server-side corroboration for client-reported death. Previously every
-- death/respawn event teleported the caller to hospital/home on demand (free
-- teleport, custody/pursuit escape). The server now verifies the ped's health
-- (replicated by OneSync) or a state it already recorded itself.
local function serverSaysDead(src)
    if Downed[src] then return true end
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end
    local hp = GetEntityHealth(ped)
    return hp ~= nil and hp <= 105
end

local function waitServerDead(src, maxMs)
    local waited = 0
    while waited <= maxMs do
        if serverSaysDead(src) then return true end
        Wait(250)
        waited = waited + 250
    end
    return false
end

RegisterNetEvent('sunset:server:playerDied', function()
    local source = source
    if not exports.sunset_core:RateLimit(source, 'playerDied', 3000) then return end
    if Downed[source] then return end
    if not waitServerDead(source, 3000) then
        print(('^3[sunset_death]^7 playerDied from %d rejected: server health says alive'):format(source))
        return
    end
    if GetResourceState('sunset_turfs') == 'started' then
        local ok, inWar = pcall(function() return exports.sunset_turfs:IsInWar(source) end)
        if ok and inWar then return end
    end

    local char = exports.sunset_core:GetCharacter(source)
    if char then char.is_dead = true end
    local now = os.time()
    Downed[source] = { startedAt = now, releaseAt = now + 2, stabilized = false }
    TriggerEvent('sunset:death:playerDowned', source)

    local pending = LastPvPAttacker[source]
    LastPvPAttacker[source] = nil
    if pending and pending.attacker and (now - (pending.at or 0)) <= 15 then
        local killer = pending.attacker
        if killer ~= source and GetPlayerName(killer) and not isOnDutyPolice(killer) then
            if not MurderWindow[source] then
                MurderWindow[source] = { killerId = killer, expires = now + 60 }
                TriggerClientEvent('sunset:client:notify', source,
                    'You were attacked! You have 60 seconds to use /112 to report the attacker.',
                    'error', 10000)
                SetTimeout(61000, function()
                    local row = MurderWindow[source]
                    if row and row.killerId == killer then
                        MurderWindow[source] = nil
                    end
                end)
            end
        end
    end

    -- SA:MP RPG Instant Respawn after 1.5s fade out
    SetTimeout(1500, function()
        if GetPlayerName(source) then
            respawnPlayer(source, Sunset.Config.HospitalBill or 250)
        end
    end)
end)

RegisterNetEvent('sunset:death:enteredDowned', function()
    local source = source
    if not exports.sunset_core:RateLimit(source, 'deathRespawn', 2000) then return end
    if not serverSaysDead(source) then return end
    respawnPlayer(source, Sunset.Config.HospitalBill or 250)
end)

RegisterNetEvent('sunset:server:bleedoutExpired', function()
    local source = source
    if not exports.sunset_core:RateLimit(source, 'deathRespawn', 2000) then return end
    if not serverSaysDead(source) then return end
    respawnPlayer(source, Sunset.Config.HospitalBill or 250)
end)

RegisterNetEvent('sunset:server:requestRespawn', function()
    local source = source
    if not exports.sunset_core:RateLimit(source, 'deathRespawn', 2000) then return end
    if not serverSaysDead(source) then return end
    respawnPlayer(source, Sunset.Config.HospitalBill or 250)
end)

RegisterNetEvent('sunset:death:playerKilled', function(victimId)
    local killer = source
    victimId = tonumber(victimId)
    if not victimId or victimId == killer or not GetPlayerName(victimId) then return end

    local killerPed = GetPlayerPed(killer)
    local victimPed = GetPlayerPed(victimId)
    if not killerPed or killerPed == 0 or not victimPed or victimPed == 0 then return end
    if #(GetEntityCoords(killerPed) - GetEntityCoords(victimPed)) > 500.0 then return end

    if isOnDutyPolice(killer) then return end
    if MurderWindow[victimId] then return end

    local recorded = LastPvPAttacker[victimId]
    if not recorded or recorded.attacker ~= killer then return end

    MurderWindow[victimId] = { killerId = killer, expires = os.time() + 60 }
    TriggerClientEvent('sunset:client:notify', victimId, exports.sunset_core:TFor(victimId, 'death.message.you_were_attacked_you_have_60_seconds_to_use'), 'error', 10000)
    SetTimeout(61000, function()
        local pending = MurderWindow[victimId]
        if pending and pending.killerId == killer then
            MurderWindow[victimId] = nil
        end
    end)
end)

RegisterNetEvent('sunset:death:call112', function()
    local src = source
    local pending = MurderWindow[src]
    if not pending or os.time() > pending.expires then
        TriggerClientEvent('sunset:client:notify', src, exports.sunset_core:TFor(src, 'death.message.no_emergency_report_window_is_open'), 'error')
        return
    end

    local killer = pending.killerId
    MurderWindow[src] = nil

    local ped = GetPlayerPed(src)
    local coords = (ped and ped ~= 0) and GetEntityCoords(ped) or vector3(0, 0, 0)
    local victimName = exports.sunset_core:GetPlayerDisplayName(src) or ('Player #' .. tostring(src))
    local killerName = (killer and GetPlayerName(killer)) and exports.sunset_core:GetPlayerDisplayName(killer) or 'Unknown Attacker'

    -- 1. Medic dispatch
    if GetResourceState('sunset_dispatch') == 'started' then
        pcall(function()
            exports.sunset_dispatch:CreateServiceCall(src, 'medic', coords, {
                system = true,
                emergency = '112',
                category = 'medical',
                callerName = victimName,
            }, ('112 Emergency — Assault victim %s requires immediate medical response'):format(victimName))
        end)
    end

    -- 2. Report attacker for first-degree murder & alert police
    if killer and GetPlayerName(killer) then
        TriggerEvent('sunset:police:autoWanted', killer, 'murder', 'First-degree murder (Reported via 112)')
        TriggerClientEvent('sunset:client:notify', killer, exports.sunset_core:TFor(killer, 'death.message.a_112_emergency_call_reported_your_crime_you_are'), 'error', 12000)

        if GetResourceState('sunset_dispatch') == 'started' then
            pcall(function()
                local dispatchDesc = ('10-99 EMERGENCY — Homicide victim %s reported attacker %s!'):format(victimName, killerName)
                local call = exports.sunset_dispatch:CreateServiceCall(src, 'police', coords, {
                    system = true,
                    emergency = '112',
                    category = 'shots',
                    street = 'Emergency 112 Scene',
                    area = 'Los Santos',
                    callerName = victimName,
                    suspect = killerName,
                    suspectId = killer,
                }, dispatchDesc)

                local payload = {
                    callId = (type(call) == 'table' and call.id) or 0,
                    callType = 'police',
                    category = 'shots',
                    street = '112 Assault Scene',
                    area = 'Los Santos',
                    caller = victimName,
                    phone = '112-SOS',
                    description = dispatchDesc,
                    coords = { x = coords.x, y = coords.y, z = coords.z },
                }

                for _, id in ipairs(GetPlayers()) do
                    local officerSrc = tonumber(id)
                    local isCop = false
                    pcall(function()
                        isCop = exports.sunset_factions:IsOnDuty(officerSrc) and Sunset.FactionTypeMatches(exports.sunset_factions:GetPlayerFaction(officerSrc), 'law_enforcement')
                    end)
                    if isCop then
                        TriggerClientEvent('sunset:dispatch:112CallAlert', officerSrc, payload)
                    end
                end
            end)
        end
    end

    TriggerClientEvent('sunset:client:notify', src, exports.sunset_core:TFor(src, 'death.message.112_received_medic_police_dispatched_attacker_reported_for_murder'), 'success', 8000)
end)

AddEventHandler('playerDropped', function()
    Downed[source] = nil
    MurderWindow[source] = nil
    LastPvPAttacker[source] = nil
end)

exports.sunset_core:RegisterCallback('sunset:revivePlayer', function(source, targetId)
    targetId = tonumber(targetId)
    if not targetId then return nil, { localeKey = 'death.message.usage_revive_player_id' } end

    local isAdmin = false
    pcall(function() isAdmin = exports.sunset_admin:IsAdmin(source, 2) end)
    local isEms = false
    pcall(function() isEms = exports.sunset_factions:HasFactionPerm(source, 'revive') end)
    if not isAdmin and not isEms then return nil, { localeKey = 'death.message.not_on_duty_or_no_permission' } end

    -- [SEC3] non-admin EMS must be next to the patient (faction path revived anyone map-wide)
    if not isAdmin and targetId ~= source then
        local p1, p2 = GetPlayerPed(source), GetPlayerPed(targetId)
        if not p1 or p1 == 0 or not p2 or p2 == 0
            or GetPlayerRoutingBucket(source) ~= GetPlayerRoutingBucket(targetId)
            or #(GetEntityCoords(p1) - GetEntityCoords(p2)) > 25.0 then
            return nil, { localeKey = 'death.message.not_on_duty_or_no_permission' }
        end
    end
    local ok, err = RevivePlayer(targetId)
    if not ok then return nil, err end
    return true
end)
