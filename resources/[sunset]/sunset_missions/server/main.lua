AddEventHandler('playerDropped', function()
    MSN_CleanupPlayer(source)
end)

-- ── acceptMission ─────────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:accept', function(source, missionId)
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
end)

-- ── stage transitions ─────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:setStage', function(source, data)
    if type(data) ~= 'table' then return nil, { localeKey = 'missions.message.no_session' } end
    local s, err = MSN_RequireSession(source, data.mission)
    if not s then return nil, err end
    -- [JOBS AUDIT] stage changes are client-driven; stop instant chaining through every stage (min 3s dwell).
    if s.stageAt and os.time() - s.stageAt < 3 then return nil, { localeKey = 'missions.message.no_session' } end

    local def  = SunsetMissions.GetMission(s.mission)
    local allowed = false
    for i, st in ipairs(def.stages) do
        if st == s.state then
            if def.stages[i+1] == data.stage then allowed = true end
            break
        end
    end
    if not allowed then return nil, 'Invalid stage transition: ' .. tostring(s.state) .. ' -> ' .. tostring(data.stage) end

    MSN_SetState(source, data.stage)
    return true
end)

-- ── vehicle_recovery: vehicle entered -> transition to PURSUIT ─────────────────
exports.sunset_core:RegisterCallback('sunset:missions:vr:vehicleEntered', function(source)
    local s, err = MSN_RequireSession(source, 'vehicle_recovery', { 'STEAL_VEHICLE' })
    if not s then return nil, err end
    MSN_SetState(source, 'PURSUIT')
    return true
end)

-- ── vehicle_recovery: confirm delivery ───────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:vr:deliver', function(source, data)
    local s, err = MSN_RequireSession(source, 'vehicle_recovery', { 'DELIVER' })
    if not s then return nil, err end

    local def  = SunsetMissions.GetMission('vehicle_recovery')
    if not MSN_ValidateCoords(source, def.deliveryCoords, SunsetMissions.Config.deliveryRadius + 10) then
        return nil, { localeKey = 'missions.message.not_at_delivery_location' }
    end

    data = type(data) == 'table' and data or {}
    local cond = math.max(0, math.min(100, tonumber(data.condition) or 0))
    -- [JOBS AUDIT] escape bonus was whatever the client claimed; honour it only if the server saw the PURSUIT stage.
    local escaped = data.escaped == true and s.visited and s.visited.PURSUIT == true
    local total, details = MSN_PayReward(source, s, cond, escaped)
    if not details or (total or 0) <= 0 then return nil, { localeKey = 'missions.message.not_at_delivery_location' } end
    TriggerClientEvent('sunset:missions:complete', source, { reward = details, mission = 'vehicle_recovery', xp = details.xp })
    return true
end)

-- ── container_47: identify container (server validates slot) ─────────────────
exports.sunset_core:RegisterCallback('sunset:missions:c47:identify', function(source, data)
    local s, err = MSN_RequireSession(source, 'container_47', { 'SEARCH' })
    if not s then return nil, err end
    local slotIndex = tonumber(data and data.slotIndex)
    if not slotIndex then return nil, { localeKey = 'missions.message.invalid_slot' } end
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
    s.data.alertLevel = math.max(s.data.alertLevel or 0, tonumber(level) or 0)
    return s.data.alertLevel
end)

exports.sunset_core:RegisterCallback('sunset:missions:c47:deliver', function(source, data)
    local s, err = MSN_RequireSession(source, 'container_47', { 'ESCAPE', 'DELIVER' })
    if not s then return nil, err end

    local def = SunsetMissions.GetMission('container_47')
    if not MSN_ValidateCoords(source, def.deliveryCoords, SunsetMissions.Config.deliveryRadius + 15) then
        return nil, { localeKey = 'missions.message.not_at_delivery_location' }
    end

    local cond    = 100
    local escaped = (s.data.alertLevel or 0) < 3
    local total, details = MSN_PayReward(source, s, cond, escaped)
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
