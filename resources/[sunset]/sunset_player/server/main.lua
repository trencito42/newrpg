-- Scalable Staggered Autosave Worker
-- Eliminates synchronized DB burst at high player count (100-200 players).
-- Distributes character saves across the SaveInterval with jitter and mutex protection.

local SAVE_INTERVAL_SEC = Sunset.Config and Sunset.Config.SaveInterval or 60

CreateThread(function()
    while true do
        local online = exports.sunset_core:GetOnlineCharacters()
        local sources = {}
        for cid, src in pairs(online) do
            sources[#sources + 1] = src
        end

        local count = #sources
        if count > 0 then
            local delayBetweenSavesMs = math.max(250, math.min(2000, math.floor((SAVE_INTERVAL_SEC * 1000) / count)))
            for _, src in ipairs(sources) do
                if GetPlayerName(src) then
                    local char = exports.sunset_core:GetCharacter(src)
                    if char and char.id then
                        exports.sunset_core:SaveCharacter(src)
                    end
                end
                Wait(delayBetweenSavesMs + math.random(10, 50))
            end
        else
            Wait(5000)
        end
    end
end)
