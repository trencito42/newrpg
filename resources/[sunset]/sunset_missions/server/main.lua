AddEventHandler('playerDropped', function()
    MSN_CleanupPlayer(source)
end)

-- ── acceptMission ─────────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:accept', function(source, missionId)
    local def = SunsetMissions.GetMission(missionId)
    if not def then return nil, 'Mission not found' end

    local existing = MSN_GetSession(source)
    if existing then return nil, 'Already in a mission' end

    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, 'Not logged in' end

    local ok, err = MSN_ValidateRequirements(source, def)
    if not ok then return nil, err end

    local coolOk = MSN_ValidateCooldown(char.id, missionId, def.cooldown)
    if not coolOk then return nil, 'On cooldown — come back later' end

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
        local locs    = def.containerLocations
        local target  = locs[math.random(#locs)]
        variant = {
            targetContainer = target.id,
            targetRow       = target.row,
            targetCoords    = { x = target.coords.x, y = target.coords.y, z = target.coords.z, w = target.coords.w },
            alertLevel      = 0,
        }
    end

    local session = MSN_CreateSession(source, missionId, variant)
    if not session then return nil, 'Could not create session' end

    print(('[sunset_missions] src=%d started mission=%s id=%s'):format(source, missionId, session.id))
    return { sessionId = session.id, variant = variant }
end)

-- ── stage transitions ─────────────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:setStage', function(source, data)
    local s, err = MSN_RequireSession(source, data.mission)
    if not s then return nil, err end

    local def  = SunsetMissions.GetMission(s.mission)
    local allowed = false
    for i, st in ipairs(def.stages) do
        if st == s.state then
            if def.stages[i+1] == data.stage then allowed = true end
            break
        end
    end
    if not allowed then return nil, 'Invalid stage transition: ' .. s.state .. ' -> ' .. tostring(data.stage) end

    MSN_SetState(source, data.stage)
    return true
end)

-- ── vehicle_recovery: confirm delivery ───────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:missions:vr:deliver', function(source, data)
    local s, err = MSN_RequireSession(source, 'vehicle_recovery', { 'DELIVER' })
    if not s then return nil, err end

    local def  = SunsetMissions.GetMission('vehicle_recovery')
    if not MSN_ValidateCoords(source, def.deliveryCoords, SunsetMissions.Config.deliveryRadius + 10) then
        return nil, 'Not at delivery location'
    end

    local cond = math.max(0, math.min(100, data.condition or 0))
    local total, details = MSN_PayReward(source, s, cond, data.escaped)
    TriggerClientEvent('sunset:missions:complete', source, { reward = details, mission = 'vehicle_recovery' })
    return true
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
        return nil, 'Not at delivery location'
    end

    local cond    = 100
    local escaped = (s.data.alertLevel or 0) < 3
    local total, details = MSN_PayReward(source, s, cond, escaped)
    TriggerClientEvent('sunset:missions:complete', source, { reward = details, mission = 'container_47' })
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
    local rows = MySQL.query.await(
        'SELECT mission, last_mission FROM sunset_mission_reputation WHERE character_id = ?',
        { char.id }
    )
    local result = {}
    for _, row in ipairs(rows or {}) do
        if row.mission then result[row.mission] = row.last_mission end
    end
    return result
end)
