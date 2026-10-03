-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Discord RPC Server Bridge
-- ═══════════════════════════════════════════════════════════════

exports('GetServerStatusRPC', function()
    local players = GetPlayers()
    local maxClients = GetConvarInt('sv_maxclients', 64)
    return {
        onlineCount = #players,
        maxClients = maxClients
    }
end)

RegisterNetEvent('sunset:discord_rpc:requestStatus', function()
    local src = source
    local players = GetPlayers()
    local maxClients = GetConvarInt('sv_maxclients', 64)

    TriggerClientEvent('sunset:discord_rpc:updateStatus', src, {
        onlineCount = #players,
        maxClients = maxClients
    })
end)
