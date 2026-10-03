AddEventHandler('playerDropped', function()
    MSN_CleanupPlayer(source)
end)

-- Death ends the server session too (the client abort alone is not authoritative).
AddEventHandler('sunset:death:playerDowned', function(src)
    src = tonumber(src)
    if src and MSN_GetSession(src) and not MSN_GetSession(src).rewardClaimed then
        MSN_EndSession(src, 'failed', 0)
    end
end)

-- Resource restart mid-mission: close every open session as 'interrupted' (no reward, no cooldown bypass
-- since nothing is paid); clients clean their entities in their own onResourceStop handlers.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    MSN_InterruptAll()
end)

-- ── acceptMission ─────────────────────────────────────────────────────────────
local acceptLock = {}
exports.sunset_core:RegisterCallback('sunset:missions:accept', function(source, missionId)
    if type(missionId) ~= 'string' then return nil, { localeKey = 'missions.message.mission_not_found' } end
    -- per-player lock: concurrent accepts cannot both pass the cooldown await
    if acceptLock[source] then return nil, { localeKey = 'missions.message.already_in_a_mission' } end
    acceptLock[source] = true
    local r1, r2 = MSN_AcceptInner(source, missionId)
    acceptLock[source] = nil
    return r1, r2
end)

function MSN_AcceptInner(source, missionId)
    local def = SunsetMissions.GetMission(missionId)
    if not def then return nil, { localeKey = 'missions.message.mission_not_found' } end

    local existing = MSN_GetSession(source)
    if existing then return nil, { localeKey = 'missions.message.already_in_a_mission' } end

    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'missions.message.not_logged_in' } end

    local ok, err = MSN_ValidateRequirements(source, def)
    if not ok then return nil, err end

    local coolOk = MSN_ValidateCooldown(char.id, missionId, def.cooldown)
    if not coolOk then return nil, { localeKey = 'missions.message.on_cooldown_come_back_later' } end

    -- Build random variant
    local variant = {}
    if missionId == 'vehicle_recovery' then
        local vehList = def.vehicles
        local veh     = vehList[math.random(#vehList)]
        local col     = def.colors[math.random(#def.colors)]
        local zoneKeys = {}
        for k in pairs(def.searchZones) do zoneKeys[#zoneKeys+1] = k end
        local zone = zoneKeys[math.random(#zoneKeys)]
        local plate = ('%02d%s%03d'):format(math.random(10,99), string.char(math.random(65,90), math.random(65,90), math.random(65,90)), math.random(100,999))
        variant = {
            vehicleModel = veh.model,
            vehicleLabel = veh.label,
            vehicleColor = col,
            vehiclePlate = plate,
            searchZone   = zone,
            spawnCoords  = nil,
        }
        local zoneData = def.searchZones[zone]
        local angle    = math.random() * 2 * math.pi
        local r        = math.random(30, math.floor(zoneData.radius * 0.8))
        variant.spawnCoords = {
            x = zoneData.center.x + r * math.cos(angle),
            y = zoneData.center.y + r * math.sin(angle),
            z = zoneData.center.z,
            w = math.random(0, 359),
        }
    elseif missionId == 'container_47' then
        -- Shuffle IDs across physical slots (Fisher-Yates)
        local ids = {}
        for _, id in ipairs(def.containerIds) do ids[#ids+1] = id end
        for i = #ids, 2, -1 do
            local j = math.random(i)
            ids[i], ids[j] = ids[j], ids[i]
        end
        -- Locate which slot received the target ID
        local targetSlot = nil
        for i, id in ipairs(ids) do
            if id == def.targetId then targetSlot = i break end
        end
        local tgtSlot = def.containerSlots[targetSlot]
        variant = {
            slotMapping  = ids,        -- slot index -> container ID (client sees IDs on inspect)
            targetSlot   = targetSlot, -- server-only: which slot is the target
            targetRow    = tgtSlot.row,
            targetCoords = { x = tgtSlot.coords.x, y = tgtSlot.coords.y, z = tgtSlot.coords.z, w = tgtSlot.coords.w },
            alertLevel   = 0,
        }
    end

    local session = MSN_CreateSession(source, missionId, variant)
    if not session then return nil, { localeKey = 'missions.message.could_not_create_session' } end

    print(('[sunset_missions] src=%d started mission=%s id=%s'):format(source, missionId, session.id))
    return { sessionId = session.id, variant = variant }
end

-- ── stage transitions ─────────────────────────────────────────────────────────
-- [MISSIONS AUTHORITY] only predecessor->successor transitions with server-side sanity checks
-- (see server/stages.lua). The client cannot jump to DELIVER/COMPLETE or skip stages.
exports.sunset_core:RegisterCallback('sunset:missions:setStage', function(source, data)
    if type(data) ~= 'table' or type(data.stage) ~= 'string' then return nil, { localeKey = 'missions.message.no_session' } end
    local s, err = MSN_RequireSession(source, data.mission)
    if not s then return nil, err end
    local ok, why = MSN_RequestTransition(source, s, data.stage)
    if not ok then return nil, exports.sunset_core:TFor(source, 'missions.err.invalid_stage_transition', { state = tostring(s.state), stage = tostring(data.stage), why = tostring(why) }) end
    return true
end)

-- ── vehicle_recovery: vehicle entered -> transition to PURSUIT ─────────────────
exports.sunset_core:RegisterCallback('sunset:missions:vr:vehicleEntered', function(source)
    local s, err = MSN_RequireSession(source, 'vehicle_recovery', { 'STEAL_VEHICLE' })
    if not s then return nil, err end
    if s.stageAt and os.time() - s.stageAt < 1 then return nil, 'too_fast' end
    -- server verifies the player is really seated in the variant vehicle (model + plate)
    if not MSN_PlayerInMissionVehicle(source, s) then return nil, { localeKey = 'missions.message.no_session' } end
    MSN_SetState(source, 'PURSUIT')
    return true
end)

-- ── vehicle_recovery: confirm delivery ───────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:vr:deliver', function(source, data)
    local s, err = MSN_RequireSession(source, 'vehicle_recovery', { 'DELIVER' })
    if not s then return nil, err end
    if s.busy or s.rewardClaimed then return nil, { localeKey = 'missions.message.no_session' } end
    s.busy = true

    local def  = SunsetMissions.GetMission('vehicle_recovery')
    if not MSN_ValidateCoords(source, def.deliveryCoords, SunsetMissions.Config.deliveryRadius + 10) then
        s.busy = false
        return nil, { localeKey = 'missions.message.not_at_delivery_location' }
    end
    local inVeh, veh = MSN_PlayerInMissionVehicle(source, s)
    if not inVeh then
        s.busy = false
        return nil, { localeKey = 'missions.message.not_at_delivery_location' }
    end

    -- condition is read from the networked vehicle; the client value is ignored
    local cond = MSN_ReadVehicleCondition(veh)
    -- The server-observed stage history is the only authority for the escape bonus.
    local escaped = s.visited and s.visited.PURSUIT == true
    local total, details = MSN_PayReward(source, s, cond, escaped)
    if s.rewardClaimed ~= true then s.busy = false end
    if not details or (total or 0) <= 0 then return nil, { localeKey = 'missions.message.not_at_delivery_location' } end
    TriggerClientEvent('sunset:missions:complete', source, { reward = details, mission = 'vehicle_recovery', xp = details.xp })
    return true
end)

-- ── container_47: identify container (server validates slot) ─────────────────
exports.sunset_core:RegisterCallback('sunset:missions:c47:identify', function(source, data)
    local s, err = MSN_RequireSession(source, 'container_47', { 'SEARCH' })
    if not s then return nil, err end
    local slotIndex = math.floor(tonumber(data and data.slotIndex) or 0)
    local def0 = SunsetMissions.GetMission('container_47')
    local slotDef = def0.containerSlots[slotIndex]
    if not slotDef then return nil, { localeKey = 'missions.message.invalid_slot' } end
    -- must physically stand at the slot being inspected
    if not MSN_NearCoords(source, slotDef.coords, 8.0) then return nil, { localeKey = 'missions.message.invalid_slot' } end
    s.inspectAt = s.inspectAt or {}
    local nowT = GetGameTimer()
    if s.inspectAt[slotIndex] and nowT - s.inspectAt[slotIndex] < 2000 then return nil, 'too_fast' end
    s.inspectAt[slotIndex] = nowT
    if slotIndex == s.data.targetSlot then
        MSN_SetState(source, 'IDENTIFY')
        return true
    else
        -- wrong container: raise alert on server side
        s.data.alertLevel = math.min(4, (s.data.alertLevel or 0) + 1)
        return false, { localeKey = 'missions.message.wrong_container' }
    end
end)

-- ── container_47: stage updates ───────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:c47:updateAlert', function(source, level)
    local s, err = MSN_RequireSession(source, 'container_47')
    if not s then return nil, err end
    -- bounded; alert only ever rises (guards are client-side, so this is advisory for the 10% escape bonus)
    level = math.floor(tonumber(level) or 0)
    s.data.alertLevel = math.min(4, math.max(s.data.alertLevel or 0, math.max(0, level)))
    return s.data.alertLevel
end)

exports.sunset_core:RegisterCallback('sunset:missions:c47:deliver', function(source)
    local s, err = MSN_RequireSession(source, 'container_47', { 'DELIVER' })
    if not s then return nil, err end
    if s.busy or s.rewardClaimed then return nil, { localeKey = 'missions.message.no_session' } end
    s.busy = true

    local def = SunsetMissions.GetMission('container_47')
    if not MSN_ValidateCoords(source, def.deliveryCoords, SunsetMissions.Config.deliveryRadius + 15) then
        s.busy = false
        return nil, { localeKey = 'missions.message.not_at_delivery_location' }
    end

    local cond    = 100
    local escaped = s.visited and s.visited.ESCAPE == true
    local total, details = MSN_PayReward(source, s, cond, escaped)
    if s.rewardClaimed ~= true then s.busy = false end
    if not details or (total or 0) <= 0 then return nil, { localeKey = 'missions.message.not_at_delivery_location' } end
    TriggerClientEvent('sunset:missions:complete', source, { reward = details, mission = 'container_47', xp = details.xp })
    return true
end)

-- ── abandon ───────────────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:abandon', function(source)
    local s = MSN_GetSession(source)
    if s then MSN_EndSession(source, 'abandoned', 0) end
    return true
end)

-- ── get reputation ────────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:getStats', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return {} end
    return MSN_GetPlayerStats(char.id)
end)

-- ── get cooldowns ─────────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:getCooldowns', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return {} end
    return MSN_GetCooldowns(char.id)
end)
