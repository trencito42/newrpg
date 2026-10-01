-- Scalable Staggered Autosave Worker
-- Eliminates synchronized DB burst at high player count (100-200 players).
-- Distributes character saves uniformly across the 60-second SaveInterval with deadline guarantees.

local SAVE_INTERVAL_SEC = Sunset.Config and Sunset.Config.SaveInterval or 60

CreateThread(function()
    while true do
        local cycleStart = GetGameTimer()
        local intervalMs = SAVE_INTERVAL_SEC * 1000
        local online = exports.sunset_core:GetOnlineCharacters()
        local sources = {}

        for cid, src in pairs(online) do
            sources[#sources + 1] = src
        end

        local count = #sources
        if count > 0 then
            -- Evenly space saves across the full 60s window (clamped to min 250ms per save)
            local stepMs = math.max(250, math.floor(intervalMs / count))
            for _, src in ipairs(sources) do
                if GetPlayerName(src) then
                    local char = exports.sunset_core:GetCharacter(src)
                    if char and char.id then
                        exports.sunset_core:SaveCharacter(src)
                    end
                end
                Wait(stepMs)
            end

            -- Ensure the entire 60-second cycle completes before starting the next cycle
            local elapsed = GetGameTimer() - cycleStart
            local remaining = intervalMs - elapsed
            if remaining > 100 then
                Wait(remaining)
            end
        else
            Wait(5000)
        end
    end
end)
