local sessions = {}

--- Generate a secure hex session token
local function generateSessionToken(source)
    local template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    local token = string.gsub(template, '[xy]', function (c)
        local v = (c == 'x') and math.random(0, 0xf) or math.random(8, 0xb)
        return string.format('%x', v)
    end)
    return ('sess_%d_%s'):format(source, token)
end

--- Server export to create an authoritative hacking session
--- @param source number Player source ID
--- @param config table { difficulty = string, puzzle = string, timeLimit = number, title = string, allowCancel = boolean }
--- @return table sessionData
function CreateHackingSession(source, config)
    config = config or {}
    local diff = config.difficulty or 'easy'
    local seed = math.random(1, 2147483647)

    local puzzle, solution = SunsetHacking.GetPuzzle(config.puzzle or diff, seed)
    if not puzzle then
        return nil, 'FAILED_TO_GENERATE_PUZZLE'
    end

    local diffCfg = SunsetHacking.Config.Difficulties[diff] or SunsetHacking.Config.Difficulties.easy
    local timeLimit = config.timeLimit or puzzle.timeLimit or diffCfg.timeLimit or 35
    local sessId = generateSessionToken(source)

    local session = {
        id = sessId,
        source = source,
        puzzle = puzzle,
        solution = solution,
        difficulty = diff,
        timeLimit = timeLimit,
        title = config.title or puzzle.title or 'CTOS_NETWORK_GRID',
        allowCancel = config.allowCancel ~= false,
        createdAt = os.time(),
        expiresAt = os.time() + timeLimit + 10, -- 10s grace period for network roundtrip / animations
        completed = false,
    }

    sessions[sessId] = session

    return {
        sessionId = sessId,
        puzzle = puzzle,
        difficulty = diff,
        timeLimit = timeLimit,
        title = session.title,
        allowCancel = session.allowCancel,
    }
end
exports('CreateHackingSession', CreateHackingSession)

--- Authoritatively verifies player solution submitted from client
--- @param source number
--- @param sessionId string
--- @param clientRotations table { [nodeId]: number }
--- @return table { success = boolean, reason = string, timeSpent = number }
function VerifyHackingCompletion(source, sessionId, clientRotations)
    local sess = sessions[sessionId]
    if not sess then
        return { success = false, reason = 'INVALID_SESSION' }
    end

    if sess.source ~= source then
        return { success = false, reason = 'SESSION_OWNER_MISMATCH' }
    end

    if sess.completed then
        return { success = false, reason = 'ALREADY_COMPLETED' }
    end

    local now = os.time()
    if now > sess.expiresAt then
        sess.completed = true
        return { success = false, reason = 'SESSION_EXPIRED', timeSpent = now - sess.createdAt }
    end

    -- Reconstruct node state with client rotations and test graph propagation
    local testNodes = {}
    for _, n in ipairs(sess.puzzle.nodes) do
        local rot = clientRotations and clientRotations[n.id] or n.rotation or 0
        table.insert(testNodes, {
            id = n.id,
            type = n.type,
            rotation = rot,
            locked = n.locked == true,
            unlockRequirement = n.unlockRequirement
        })
    end

    local eval = SunsetHacking.EvaluateGraph(testNodes, sess.puzzle.links, sess.puzzle.source, sess.puzzle.targets, true)
    sess.completed = true

    local timeSpent = math.max(1, now - sess.createdAt)

    if eval.allTargetsReached then
        return {
            success = true,
            reason = 'SOLVED',
            puzzleId = sess.puzzle.id,
            difficulty = sess.difficulty,
            timeSpent = timeSpent
        }
    else
        return {
            success = false,
            reason = 'INVALID_CIRCUIT_TOPOLOGY',
            puzzleId = sess.puzzle.id,
            difficulty = sess.difficulty,
            timeSpent = timeSpent
        }
    end
end
exports('VerifyHackingCompletion', VerifyHackingCompletion)

-- Client RPC Callbacks via Sunset framework conventions
RegisterNetEvent('sunset:hacking:requestSession', function(config)
    local src = source
    local sessionData, err = CreateHackingSession(src, config)
    TriggerClientEvent('sunset:hacking:sessionCreated', src, sessionData, err)
end)

RegisterNetEvent('sunset:hacking:submitSolution', function(sessionId, clientRotations)
    local src = source
    local result = VerifyHackingCompletion(src, sessionId, clientRotations)
    TriggerClientEvent('sunset:hacking:solutionResult', src, sessionId, result)
end)

-- Periodically prune stale sessions (> 5 minutes)
CreateThread(function()
    while true do
        Wait(60000)
        local now = os.time()
        for id, sess in pairs(sessions) do
            if now > sess.expiresAt + 60 then
                sessions[id] = nil
            end
        end
    end
end)
