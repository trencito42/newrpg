local serverCommands = {}
local COMMAND_RATE_MS = 400
local CommandRateLimits = {}

AddEventHandler('playerDropped', function()
    CommandRateLimits[source] = nil
end)

local function checkCommandRateLimit(source, key)
    local now = GetGameTimer()
    local bucket = CommandRateLimits[source] or {}
    local last = bucket[key] or 0
    if now - last < COMMAND_RATE_MS then return false end
    bucket[key] = now
    CommandRateLimits[source] = bucket
    return true
end

local function refreshServerCommands()
    serverCommands = {}
    for _, row in ipairs(GetRegisteredCommands()) do
        if row.name then
            serverCommands[string.lower(row.name)] = true
        end
    end
end

AddEventHandler('onResourceStart', function()
    SetTimeout(500, refreshServerCommands)
end)

CreateThread(function()
    Wait(2500)
    refreshServerCommands()
end)

local function countArgs(rest)
    if not rest or rest == '' then return 0 end
    local n = 0
    for _ in rest:gmatch('%S+') do
        n = n + 1
    end
    return n
end

local function chatSystem(source, message, kind)
    TriggerClientEvent('sunset:chat:system', source, message, kind or 'info')
end

local function t(source, key, params)
    return exports.sunset_core:TFor(source, key, params)
end

local function getAdminLevel(source)
    local ok, level = pcall(function()
        return exports.sunset_admin:GetAdminLevel(source)
    end)
    return ok and tonumber(level) or 0
end

local function adminRequired(cmd)
    return SunsetAdmin and SunsetAdmin.Commands and SunsetAdmin.Commands[cmd]
end

local function commandExists(cmd)
    if serverCommands[cmd] then return true end
    if adminRequired(cmd) then return true end
    if SunsetAdmin and SunsetAdmin.ServerHandlers and SunsetAdmin.ServerHandlers[cmd] then return true end
    if Sunset.CommandUsage and Sunset.CommandUsage[cmd] then return true end
    if Sunset.ClientCommands and Sunset.ClientCommands[cmd] then return true end
    return false
end

local function parseArgs(rest)
    local args = {}
    if rest and rest ~= '' then
        for token in rest:gmatch('%S+') do
            args[#args + 1] = token
        end
    end
    return args
end

local RESOURCE_COMMAND_EXPORTS = {
    'sunset_admin',
    'sunset_vehicles',
    'sunset_factions',
    'sunset_core',
    'sunset_dispatch',
    'sunset_robbery',
    'sunset_properties',
    'sunset_licenses',
    'sunset_jobs',
    'sunset_businesses',
    'sunset_turfs',
    'sunset_cnn',
}

local function tryRunResourceCommand(src, cmd, args)
    for _, resource in ipairs(RESOURCE_COMMAND_EXPORTS) do
        if GetResourceState(resource) == 'started' then
            local ok, result = pcall(function()
                return exports[resource]:ExecutePlayerCommand(src, cmd, args)
            end)
            if ok and result then return true end
            if not ok then
                print(('[sunset_chat] command export failure resource=%s command=%s player=%s error=%s')
                    :format(resource, cmd, src, tostring(result)))
                if resource == 'sunset_cnn' and ({ ad=true, myad=true, ads=true, adlist=true,
                    acceptad=true, aad=true, deletead=true, dad=true, rejectad=true, admute=true })[cmd] then
                    chatSystem(src, t(src, 'chat.command.failed', { command = cmd }), 'error')
                    return true -- never retry a potentially side-effecting submission through native routing
                end
            end
        end
    end
    return false
end

local function tryRunAdminCommand(src, cmd, rest)
    local args = parseArgs(rest)
    local ok, result = pcall(function()
        return exports.sunset_admin:ExecutePlayerCommand(src, cmd, args)
    end)
    if ok and result then return true end

    ok, result = pcall(function()
        return exports.sunset_vehicles:ExecutePlayerCommand(src, cmd, args)
    end)
    if ok and result then return true end

    ok, result = pcall(function()
        return exports.sunset_factions:ExecutePlayerCommand(src, cmd, args)
    end)
    if ok and result then return true end

    return false
end

local SERVER_CHAT_COMMANDS = {
    f = true, r = true, d = true, gov = true, m = true, megaphone = true,
    cmotd = true, fmotd = true,
    finvite = true, acceptfaction = true, declinefaction = true,
    lc = true,
    w = true, whisper = true,
    cw = true, carwhisper = true,
    version = true,
}

local function hasFactionMedicPerm(src, cmd)
    if cmd ~= 'heal' and cmd ~= 'revive' then return false end
    local ok, allowed = pcall(function()
        return exports.sunset_factions:HasFactionPerm(src, cmd)
    end)
    return ok and allowed == true
end

local function shouldDelegateAcceptToClient(cmd, args)
    if cmd ~= 'accept' then return false end
    return #args < 2
end

local function isClientOnlyCommand(cmd)
    if SERVER_CHAT_COMMANDS[cmd] then return false end
    if adminRequired(cmd) then return false end
    if not (Sunset.ClientCommands and Sunset.ClientCommands[cmd]) then return false end
    if serverCommands[cmd] then return false end
    return true
end

local function tryRunServerChatCommand(src, cmd, args)
    cmd = string.lower(tostring(cmd or ''))
    args = args or {}

    local ok, handled = pcall(function()
        return exports.sunset_factions:RunChatCommand(src, cmd, args)
    end)
    if not ok then
        chatSystem(src, t(src, 'chat.command.failed', { command = cmd }), 'error')
        return true
    end
    if handled then return true end

    ok, handled = pcall(function()
        return exports.sunset_clans:RunChatCommand(src, cmd, args)
    end)
    if not ok then
        chatSystem(src, t(src, 'chat.command.failed', { command = cmd }), 'error')
        return true
    end
    if handled then return true end

    ok, handled = pcall(function()
        return exports.sunset_turfs:RunChatCommand(src, cmd, args)
    end)
    if not ok then
        chatSystem(src, t(src, 'chat.command.failed', { command = cmd }), 'error')
        return true
    end
    if handled then return true end

    ok, handled = pcall(function()
        return exports.sunset_chat:RunServerCommand(src, cmd, args)
    end)
    if not ok then
        chatSystem(src, t(src, 'chat.command.failed', { command = cmd }), 'error')
        return true
    end
    if handled then return true end

    if SERVER_CHAT_COMMANDS[cmd] then
        chatSystem(src, t(src, 'chat.command.unavailable', { command = cmd }), 'error')
        return true
    end

    return false
end

RegisterNetEvent('sunset:chat:runCommand', function(line)
    local src = source
    if not checkCommandRateLimit(src, 'runCommand') then
        chatSystem(src, t(src, 'chat.command_rate_limited'), 'warning')
        return
    end
    if type(line) ~= 'string' then return end
    if #line > 512 then return end -- [SEC3] bound client-supplied command line before tokenizing

    line = line:match('^%s*(.-)%s*$') or ''
    if line == '' then return end

    local cmd, rest = line:match('^(%S+)%s*(.*)$')
    cmd = cmd and string.lower(cmd) or ''
    if cmd == '' then return end

    local args = parseArgs(rest)

    if not commandExists(cmd) then
        if tryRunResourceCommand(src, cmd, args) then return end
        if tryRunServerChatCommand(src, cmd, args) then return end
        TriggerClientEvent('sunset:chat:executeCommand', src, line)
        return
    end

    local need = adminRequired(cmd)
    if need then
        local level = getAdminLevel(src)
        if level < need and not hasFactionMedicPerm(src, cmd) then
            local label = (SunsetAdmin.Levels and SunsetAdmin.Levels[need]) or ('Level ' .. need)
            chatSystem(src, t(src, 'chat.command.no_access', {
                command = cmd, role = label, required = need, current = level,
            }), 'error')
            return
        end
    end

    local usageDef = Sunset.CommandUsage and Sunset.CommandUsage[cmd]
    if usageDef then
        local minArgs = usageDef.minArgs or 0
        if countArgs(rest) < minArgs then
            chatSystem(src, usageDef.usageKey and t(src, usageDef.usageKey)
                or usageDef.usage
                or t(src, 'chat.command.usage', { command = cmd }), 'error')
            return
        end
    end

    if shouldDelegateAcceptToClient(cmd, args) then
        TriggerClientEvent('sunset:chat:executeCommand', src, line)
        return
    end

    if adminRequired(cmd) then
        if tryRunAdminCommand(src, cmd, rest) then
            return
        end
        if Sunset.ClientAdminCommands and Sunset.ClientAdminCommands[cmd] then
            TriggerClientEvent('sunset:chat:executeCommand', src, line)
            return
        end
        if tryRunResourceCommand(src, cmd, args) then
            return
        end
        -- Fallback to client native execution for admin commands
        TriggerClientEvent('sunset:chat:executeCommand', src, line)
        return
    end

    if isClientOnlyCommand(cmd) then
        TriggerClientEvent('sunset:chat:executeCommand', src, line)
        return
    end

    if tryRunServerChatCommand(src, cmd, args) then
        return
    end

    if tryRunResourceCommand(src, cmd, args) then
        return
    end

    -- Delegate to native FiveM command execution on client/server
    TriggerClientEvent('sunset:chat:executeCommand', src, line)
end)

exports('RefreshCommandList', refreshServerCommands)
