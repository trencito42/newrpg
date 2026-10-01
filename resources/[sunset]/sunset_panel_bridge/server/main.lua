-- The panel reads this snapshot from MariaDB; no imaginary Lua HTTP listener.

exports('IsAccountOnline', function(accountId)
    accountId = tonumber(accountId)
    if not accountId then return false end
    local src = exports.sunset_core:GetSourceByAccountId(accountId)
    return src ~= nil and src > 0
end)

exports('GetLiveServerStats', function()
    return {
        online = true,
        playerCount = #GetPlayers(),
        maxClients = GetConvarInt('sv_maxclients', 64),
    }
end)

print('^2[sunset_panel_bridge]^7 Resource initialized.')

CreateThread(function()
    local interval = math.max(5, GetConvarInt('panel_snapshot_seconds', 15)) * 1000
    local lastFailure = false
    while true do
        local ok, err = pcall(function()
            MySQL.update.await([[
                INSERT INTO panel_runtime_snapshot (id, player_count, max_players, resource_version, updated_at)
                VALUES (1, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE player_count = VALUES(player_count),
                    max_players = VALUES(max_players),
                    resource_version = VALUES(resource_version), updated_at = NOW()
            ]], { #GetPlayers(), GetConvarInt('sv_maxclients', 64), GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or 'unknown' })
        end)
        if not ok and not lastFailure then
            print(('^1[sunset_panel_bridge] Snapshot unavailable: %s^7'):format(tostring(err)))
        end
        lastFailure = not ok
        Wait(interval)
    end
end)
