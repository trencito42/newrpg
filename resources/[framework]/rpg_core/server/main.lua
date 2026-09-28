local connections = {}
local bootAt = os.time()
local peakPlayers = 0

RegisterNetEvent('rpg:core:clientReady', function()
    local src = source
    if GetAccountId(src) then return end
    if connections[src] and connections[src].state == 'authenticating' then
        TriggerClientEvent('rpg:auth:show', src)
        return
    end
    connections[src] = { state = 'authenticating', connectedAt = os.time(), lastActivityAt = os.time() }
    SetPlayerRoutingBucket(src, 0)
    TriggerClientEvent('rpg:auth:show', src)
end)

RegisterNetEvent('rpg:core:activity', function()
    local state = connections[source]
    if state then state.lastActivityAt = os.time() end
end)

RegisterCallback('core.stats', function(src)
    return GetPlayerStats(src)
end, { windowMs = 2000, maximum = 3 })

RegisterCallback('core.heartbeat', function(src)
    local state = connections[src]
    if state then state.lastActivityAt = os.time() end
    return { serverTime = os.time() }
end, { allowUnauthenticated = true, windowMs = 10000, maximum = 3 })

RPG.RegisterCommand({
    name = 'fixscreen',
    aliases = { 'fixui' },
    description = 'Fix screen blackouts, reset cameras and UI panels.',
    usage = '/fixscreen',
    handler = function(src, _, reply)
        TriggerClientEvent('rpg:ui:fixscreen', src)
        reply(src, 'Screen and camera reset signal sent to your client.', 'success')
        return true
    end,
})

RPG.RegisterCommand({
    name = 'debugui',
    description = 'Show debug information about UI and state.',
    usage = '/debugui',
    handler = function(src, _, reply)
        TriggerClientEvent('rpg:ui:debugui', src)
        return true
    end,
})

RPG.RegisterCommand({
    name = 'stats',
    description = 'Show your permanent framework statistics.',
    usage = '/stats',
    handler = function(src, _, reply)
        local stats = GetPlayerStats(src)
        if not stats then return false, 'You are not authenticated.' end
        local hours = math.floor(stats.totalPlaytimeSeconds / 3600)
        local minutes = math.floor((stats.totalPlaytimeSeconds % 3600) / 60)
        reply(src, ('ID %d | %s | %s | Level %d | XP %d | Money $%d | RP %d | Playtime %dh %dm | Created %s | Last login %s'):format(
            stats.id, stats.username, stats.sex, stats.level, stats.xp, stats.money, stats.respectPoints, hours, minutes,
            stats.createdAt or 'unknown', stats.lastLoginAt or 'first session'
        ), 'info')
        return true
    end,
})

RegisterCommand('framework', function(source, args)
    if source ~= 0 then return end
    local mode = args[1] or 'health'
    local health = GetHealthSnapshot()
    local rpc = RPG.GetRpcMetrics()
    if mode == 'players' then
        for _, raw in ipairs(GetPlayers()) do
            local src = tonumber(raw)
            local player = GetPlayer(src)
            print(('[RPG][FRAMEWORK] source=%d account=%s username=%s state=%s ping=%d'):format(
                src, player and tostring(player.accountId) or '-', player and player.username or '-', player and player.state or 'unauthenticated', GetPlayerPing(src)
            ))
        end
    elseif mode == 'sessions' then
        local rows = MySQL.query.await([[SELECT s.id,s.account_id,a.username,s.server_source,s.started_at,s.last_activity_at
                                        FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.ended_at IS NULL ORDER BY s.started_at]])
        for _, session in ipairs(rows) do
            print(('[RPG][FRAMEWORK] session=%s account=%d username=%s source=%d started=%s activity=%s'):format(
                session.id, session.account_id, session.username, session.server_source, tostring(session.started_at), tostring(session.last_activity_at)
            ))
        end
    elseif mode ~= 'health' then
        print('[RPG][FRAMEWORK] Usage: framework [health|players|sessions]')
        return
    end
    print(('[RPG][FRAMEWORK] mode=%s online=%d authenticated=%d active=%d db=%s uptime=%ds rpc=%s'):format(
        mode, health.online, health.authenticated, health.active,
        GetResourceState('oxmysql') == 'started' and 'up' or 'down', os.time() - bootAt, json.encode(rpc)
    ))
end, true)

CreateThread(function()
    math.randomseed(os.time() + GetGameTimer())
    while GetResourceState('oxmysql') ~= 'started' do Wait(100) end
    local ok, latency = pcall(function()
        local start = GetGameTimer()
        MySQL.scalar.await('SELECT 1')
        return GetGameTimer() - start
    end)
    if not ok then
        RPG.Log('ERROR', 'Database health check failed; persistent play is disabled', { error = latency })
        return
    end
    MySQL.update.await([[UPDATE sessions SET ended_at = UTC_TIMESTAMP(6), end_reason = 'server_restart'
                         WHERE ended_at IS NULL]])
    RPG.Log('INFO', 'Core ready', { databaseLatencyMs = latency })

    while true do
        Wait(300000)
        for _, raw in ipairs(GetPlayers()) do
            local src = tonumber(raw)
            if src and GetAccountId(src) then
                local callOk, saved, err = pcall(SavePlayer, src, 'periodic')
                if not callOk or not saved then RPG.Log('ERROR', 'Periodic save failed', { source = src, error = callOk and err or saved }) end
            end
        end
    end
end)

CreateThread(function()
    while true do
        Wait(5000)
        peakPlayers = math.max(peakPlayers, #GetPlayers())
    end
end)

AddEventHandler('playerDropped', function()
    connections[source] = nil
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, raw in ipairs(GetPlayers()) do
        local src = tonumber(raw)
        if src and GetAccountId(src) then
            local ok, err = pcall(RPG.FinalizePlayer, src, 'core_resource_stop', true)
            if not ok then RPG.Log('ERROR', 'Stop cleanup failed', { source = src, error = err }) end
        end
    end
end)

function RPG.GetServerRuntimeStats()
    return { bootAt = bootAt, peakPlayers = peakPlayers, uptimeSeconds = os.time() - bootAt }
end

exports('GetRuntimeStats', RPG.GetServerRuntimeStats)
