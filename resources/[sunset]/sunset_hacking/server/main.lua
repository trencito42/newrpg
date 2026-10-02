local sessions = {}

--- Server export to initiate or track a hacking session
--- @param source number
--- @param difficulty string
--- @return table session
function CreateHackingSession(source, difficulty)
    local sessId = ('hack_%d_%d'):format(source, os.time())
    local diff = difficulty or 'easy'
    local puzzle = SunsetHacking.GetPuzzle(diff)

    sessions[sessId] = {
        id = sessId,
        source = source,
        puzzleId = puzzle and puzzle.id or 'easy_01',
        difficulty = diff,
        createdAt = os.time(),
        completed = false,
    }

    return sessions[sessId]
end
exports('CreateHackingSession', CreateHackingSession)

-- Clean up expired sessions periodically
CreateThread(function()
    while true do
        Wait(60000)
        local now = os.time()
        for id, sess in pairs(sessions) do
            if now - sess.createdAt > 300 then
                sessions[id] = nil
            end
        end
    end
end)
