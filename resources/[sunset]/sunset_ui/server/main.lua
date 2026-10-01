-- [AUDIT NUI-ERR] Receive NUI JS error reports forwarded by the client.
-- Logs to server console so staff see them without needing access to a player's F8.
-- [NUI PERF] per-player rate limit: a JS error loop must not flood the console.
local nuiErrRate = {}
AddEventHandler('playerDropped', function() nuiErrRate[source] = nil end)

RegisterNetEvent('sunset:server:nuiError', function(errType, message, jsSource, lineno)
    local src = source -- NOTE: do not shadow `source` with a param (previous bug)
    local now = os.time()
    local rec = nuiErrRate[src]
    if not rec or now - rec.t > 10 then rec = { t = now, n = 0 }; nuiErrRate[src] = rec end
    rec.n = rec.n + 1
    if rec.n > 5 then return end
    local player = GetPlayerName(src) or 'unknown'
    print(('^1[NUI-ERROR src=%s (%s) type=%s line=%s]^7 %s'):format(
        tostring(src), player, tostring(errType), tostring(lineno), tostring(message):sub(1, 300)))
end)

-- [NUI PERF] /nuistats — admin-only (ACE command.nuistats, granted via group.admin
-- `command allow`). Prints the player's top-20 largest NUI payload actions in F8.
-- Needs sv_sunset_nuidebug=1.
RegisterCommand('nuistats', function(src)
    if src and src > 0 then
        TriggerClientEvent('sunset_ui:client:nuiStats', src)
    end
end, true)
