local sessions = {}

function MSN_CreateSession(source, missionId, variant)
    if sessions[source] then return nil, 'already_in_mission' end
    local id = ('msn_%d_%d'):format(source, math.floor(os.clock() * 1000) % 1000000)
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
    }
    return sessions[source]
end

function MSN_GetSession(source)
    return sessions[source]
end

function MSN_RequireSession(source, missionId, allowedStates)
    local s = sessions[source]
    if not s then return nil, 'no_session' end
    if missionId and s.mission ~= missionId then return nil, 'wrong_mission' end
    if allowedStates then
        local ok = false
        for _, st in ipairs(allowedStates) do
            if s.state == st then ok = true break end
        end
        if not ok then return nil, 'wrong_state:' .. s.state end
    end
    return s
end

function MSN_SetState(source, state)
    if sessions[source] then sessions[source].state = state end
end

function MSN_EndSession(source, result, reward, meta)
    local s = sessions[source]
    if not s then return end
    local char = exports.sunset_core:GetCharacter(source)
    if char then
        MySQL.insert.await(
            'INSERT INTO sunset_mission_history (character_id, mission, started_at, completed_at, result, reward, variant) VALUES (?,?,?,?,?,?,?)',
            { char.id, s.mission, s.startedAt, os.time(), result or 'abandoned', reward or 0, json.encode(s.data) }
        )
    end
    sessions[source] = nil
end

function MSN_CleanupPlayer(source)
    sessions[source] = nil
end
