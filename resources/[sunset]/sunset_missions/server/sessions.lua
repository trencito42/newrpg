local sessions = {}

function MSN_CreateSession(source, missionId, variant)
    if sessions[source] then return nil, { localeKey = 'missions.message.already_in_mission' } end
    local id = ('msn_%d_%d'):format(source, math.floor(os.clock() * 1000) % 1000000)
    local char = exports.sunset_core:GetCharacter(source)
    sessions[source] = {
        id       = id,
        player   = source,
        mission  = missionId,
        state    = 'BRIEFING',
        step     = 0,
        startedAt = os.time(),
        data     = variant or {},
        entities = { guards = {}, vehicles = {}, props = {} },
        completedObjectives = {},
        rewardClaimed = false,
        charId   = char and char.id or nil,
    }
    return sessions[source]
end

function MSN_GetSession(source)
    return sessions[source]
end

function MSN_RequireSession(source, missionId, allowedStates)
    local s = sessions[source]
    if not s then return nil, { localeKey = 'missions.message.no_session' } end
    if missionId and s.mission ~= missionId then return nil, { localeKey = 'missions.message.wrong_mission' } end
    if allowedStates then
        local ok = false
        for _, st in ipairs(allowedStates) do
            if s.state == st then ok = true break end
        end
        if not ok then return nil, 'wrong_state:' .. tostring(s.state) end
    end
    return s
end

function MSN_SetState(source, state)
    if sessions[source] then
        sessions[source].state = state
        sessions[source].stageAt = os.time()
        sessions[source].visited = sessions[source].visited or {}
        sessions[source].visited[state] = true
    end
end

function MSN_EndSession(source, result, reward, meta)
    local s = sessions[source]
    if not s then return end
    local charId = s.charId
    if not charId then
        local char = exports.sunset_core:GetCharacter(source)
        charId = char and char.id or nil
    end
    if charId then
        MySQL.insert.await(
            'INSERT INTO sunset_mission_history (character_id, mission, started_at, completed_at, result, reward, variant) VALUES (?,?,?,?,?,?,?)',
            { charId, s.mission, s.startedAt, os.time(), result or 'abandoned', reward or 0, json.encode(s.data) }
        )
    end
    sessions[source] = nil
end

function MSN_CleanupPlayer(source)
    local s = sessions[source]
    if s and s.charId then
        -- fire-and-forget: player already dropped, no await needed
        MySQL.insert(
            'INSERT INTO sunset_mission_history (character_id, mission, started_at, completed_at, result, reward, variant) VALUES (?,?,?,?,?,?,?)',
            { s.charId, s.mission, s.startedAt, os.time(), 'disconnected', 0, json.encode(s.data or {}) }
        )
    end
    sessions[source] = nil
end
