local sessions = {}
local sessionsBySource = {}

local function deliverConsumerResult(sess, result)
    if not sess or type(sess.context) ~= 'table' then return end
    if sess.context.consumer == 'sunset_robbery' and GetResourceState('sunset_robbery') == 'started' then
        local ok, accepted = pcall(function()
            return exports.sunset_robbery:CompleteHackingChallenge(
                sess.source,
                sess.context.robberySessionId,
                sess.id,
                result
            )
        end)
        if not ok or accepted ~= true then
            print(('[sunset_hacking] consumer rejected session %s'):format(tostring(sess.id)))
        end
    end
end

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
    source = tonumber(source)
    if not source or not GetPlayerName(source) then return nil, 'INVALID_PLAYER' end
    if sessionsBySource[source] then return nil, 'SESSION_ALREADY_ACTIVE' end
    local diff = config.difficulty or 'easy'
    local seed = math.random(1, 2147483647)

    local puzzle, solution = SunsetHacking.GetPuzzle(config.puzzle or diff, seed)
    if not puzzle then
        return nil, 'FAILED_TO_GENERATE_PUZZLE'
    end

    local diffCfg = SunsetHacking.Config.Difficulties[diff] or SunsetHacking.Config.Difficulties.easy
    local timeLimit = config.timeLimit or puzzle.timeLimit or diffCfg.timeLimit or 35
    local sessId = generateSessionToken(source)

    local player = exports.sunset_core:GetPlayer(source)
    local character = exports.sunset_core:GetCharacter(source)
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
        characterId = character and tonumber(character.id) or nil,
        context = type(config.context) == 'table' and config.context or nil,
    }

    sessions[sessId] = session
    sessionsBySource[source] = sessId

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

    local character = exports.sunset_core:GetCharacter(source)
    if sess.characterId and (not character or tonumber(character.id) ~= sess.characterId) then
        sessions[sessionId] = nil
        if sessionsBySource then sessionsBySource[source] = nil end
        local result = { success = false, reason = 'CHARACTER_CHANGED' }
        deliverConsumerResult(sess, result)
        return result
    end

    local now = os.time()
    if now > sess.expiresAt then
        sessions[sessionId] = nil
        if sessionsBySource then sessionsBySource[source] = nil end
        local result = { success = false, reason = 'SESSION_EXPIRED', timeSpent = now - sess.createdAt }
        deliverConsumerResult(sess, result)
        return result
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
    -- Consume before notifying any external economy/gameplay owner. A replay or
    -- parallel submit can no longer reuse this challenge while another resource
    -- yields during its state transition.
    sess.completed = true
    sessions[sessionId] = nil
    if sessionsBySource then sessionsBySource[source] = nil end

    local timeSpent = math.max(1, now - sess.createdAt)

    if eval.allTargetsReached then
        local result = {
            success = true,
            reason = 'SOLVED',
            puzzleId = sess.puzzle.id,
            difficulty = sess.difficulty,
            timeSpent = timeSpent
        }
        deliverConsumerResult(sess, result)
        return result
    else
        local result = {
            success = false,
            reason = 'INVALID_CIRCUIT_TOPOLOGY',
            puzzleId = sess.puzzle.id,
            difficulty = sess.difficulty,
            timeSpent = timeSpent
        }
        deliverConsumerResult(sess, result)
        return result
    end
end
exports('VerifyHackingCompletion', VerifyHackingCompletion)

local function cancelSession(source, sessionId, reason)
    local sess = sessions[sessionId]
    if not sess or sess.source ~= source then return false end
    sessions[sessionId] = nil
    if sessionsBySource then sessionsBySource[source] = nil end
    deliverConsumerResult(sess, { success = false, reason = reason or 'CANCELLED' })
    return true
end
exports('CancelHackingSession', cancelSession)

-- Client RPC Callbacks via Sunset framework conventions
RegisterNetEvent('sunset:hacking:requestSession', function(config)
    local src = source
    local allowed = SunsetHacking.Config.Debug == true
    if not allowed and GetResourceState('sunset_admin') == 'started' then
        local ok, isAdmin = pcall(function() return exports.sunset_admin:IsAdmin(src, 1) end)
        allowed = ok and isAdmin == true
    end
    if not allowed then
        TriggerClientEvent('sunset:hacking:sessionCreated', src, nil, 'SERVER_SESSION_REQUIRED')
        return
    end
    local sessionData, err = CreateHackingSession(src, config)
    TriggerClientEvent('sunset:hacking:sessionCreated', src, sessionData, err)
end)

RegisterNetEvent('sunset:hacking:submitSolution', function(sessionId, clientRotations)
    local src = source
    local result = VerifyHackingCompletion(src, sessionId, clientRotations)
    TriggerClientEvent('sunset:hacking:solutionResult', src, sessionId, result)
end)

RegisterNetEvent('sunset:hacking:cancelSession', function(sessionId, reason)
    cancelSession(source, sessionId, reason == 'PLAYER_DEAD' and reason or 'CANCELLED')
end)

-- Periodically prune stale sessions (> 5 minutes)
CreateThread(function()
    while true do
        Wait(60000)
        local now = os.time()
        for id, sess in pairs(sessions) do
            if now > sess.expiresAt then
                sessions[id] = nil
                if sessionsBySource then sessionsBySource[sess.source] = nil end
                deliverConsumerResult(sess, { success = false, reason = 'SESSION_EXPIRED' })
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    local id = sessionsBySource and sessionsBySource[src]
    if id then cancelSession(src, id, 'DISCONNECTED') end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for id, sess in pairs(sessions) do
        sessions[id] = nil
        deliverConsumerResult(sess, { success = false, reason = 'RESOURCE_STOPPED' })
    end
end)

RegisterNetEvent('sunset:hacking:requestDebugHack', function(target, seedArg)
    local src = source
    local allowed = false
    if SunsetHacking.Config.Debug then
        allowed = true
    elseif GetResourceState('sunset_admin') == 'started' then
        local ok, res = pcall(function() return exports.sunset_admin:IsAdmin(src, 1) end)
        if ok and res == true then
            allowed = true
        end
    end

    if allowed then
        TriggerClientEvent('sunset:hacking:client:startDebugHack', src, target, seedArg)
    else
        TriggerClientEvent('sunset:core:notify', src, exports.sunset_core:TFor(src, 'hacking.message.admin_only'), 'error')
    end
end)
