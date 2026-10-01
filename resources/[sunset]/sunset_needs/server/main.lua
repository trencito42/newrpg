CreateThread(function()
    while true do
        local players = GetPlayers()
        local count = #players
        local sleepPerPlayer = count > 0 and math.floor(60000 / count) or 1000
        sleepPerPlayer = math.max(50, math.min(1000, sleepPerPlayer))

        local cycleStart = GetGameTimer()
        for _, playerId in ipairs(players) do
            local src = tonumber(playerId)
            if src then
                local char = exports.sunset_core:GetCharacter(src)
                if char and not char.is_dead then
                    char.hunger = math.max(0, (char.hunger or 100) - (Sunset.Config.HungerDrain or 0.8))
                    char.thirst = math.max(0, (char.thirst or 100) - (Sunset.Config.ThirstDrain or 1.2))
                    char.stress = math.min(100, (char.stress or 0) + (Sunset.Config.StressDrain or 0.1))

                    TriggerClientEvent('sunset:client:updateCharacter', src, char)
                end
            end
            Wait(sleepPerPlayer)
        end

        local elapsed = GetGameTimer() - cycleStart
        local remaining = 60000 - elapsed
        if remaining > 0 then
            Wait(remaining)
        end
    end
end)

-- Kept for backward compatibility with clients; server heartbeat handles actual decay
RegisterNetEvent('sunset:server:needsTick', function()
    -- No-op: Server authoritative tick loop handles needs updates
end)
