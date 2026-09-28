RPG = RPG or {}

local commands = {}
local aliases = {}
local rates = {}

local function isCallable(value)
    if type(value) == 'function' then return true end
    local meta = getmetatable(value)
    return meta ~= nil and type(meta.__call) == 'function'
end

local function reply(src, message, kind)
    if src == 0 then print(('[RPG][COMMAND] %s'):format(message)) return end
    TriggerClientEvent('rpg:ui:notify', src, { message = tostring(message), kind = kind or 'info' })
    TriggerClientEvent('rpg:chat:system', src, tostring(message), kind or 'info')
end

function Notify(src, message, kind)
    if type(message) ~= 'string' or message == '' then return false end
    reply(tonumber(src) or 0, message, kind)
    return true
end

function RPG.RegisterCommand(definition)
    assert(type(definition) == 'table', 'command definition must be a table')
    local name = type(definition.name) == 'string' and string.lower(definition.name) or nil
    assert(name and name:match('^[%w_-]+$'), 'invalid command name')
    assert(isCallable(definition.handler), 'command handler must be callable')
    if commands[name] or aliases[name] then error(('command /%s already exists'):format(name)) end
    definition.name = name
    definition.aliases = definition.aliases or {}
    definition.description = definition.description or ''
    definition.usage = definition.usage or ('/' .. name)
    definition.minimumAdminLevel = tonumber(definition.minimumAdminLevel) or 0
    definition.arguments = definition.arguments or {}
    definition.consoleAllowed = definition.consoleAllowed == true
    definition.audit = definition.audit or 'none'
    definition.resource = GetInvokingResource() or GetCurrentResourceName()
    commands[name] = definition
    for _, alias in ipairs(definition.aliases) do
        alias = string.lower(tostring(alias))
        if commands[alias] or aliases[alias] then error(('command alias /%s already exists'):format(alias)) end
        aliases[alias] = name
    end
    return true
end

local function parse(line)
    local args = {}
    for token in tostring(line):gmatch('%S+') do args[#args + 1] = token end
    local name = table.remove(args, 1) or ''
    return string.lower(name:gsub('^/', '')), args
end

function DispatchCommand(src, line)
    src = tonumber(src) or 0
    if type(line) ~= 'string' or #line > 512 then reply(src, 'Invalid command.', 'error') return false end
    if src ~= 0 then
        local now = GetGameTimer()
        if rates[src] and now - rates[src] < 250 then reply(src, 'Commands are being entered too quickly.', 'warning') return false end
        rates[src] = now
    end
    local enteredName, args = parse(line)
    if enteredName == '' then reply(src, 'Enter a command after /.', 'warning') return false end
    local canonical = aliases[enteredName] or enteredName
    local definition = commands[canonical]
    if not definition then reply(src, ('Unknown command: /%s'):format(enteredName), 'error') return false end
    if src == 0 and not definition.consoleAllowed then reply(src, ('/%s cannot be used from console.'):format(canonical), 'error') return false end
    local level = src == 0 and 5 or GetAdminLevel(src)
    if level < definition.minimumAdminLevel then
        local required = RPG.Config.adminLabels[definition.minimumAdminLevel] or ('Level ' .. definition.minimumAdminLevel)
        reply(src, ('No access to /%s. Requires %s (level %d). Your level: %d.'):format(canonical, required, definition.minimumAdminLevel, level), 'error')
        return false
    end
    local requiredCount = 0
    for _, argument in ipairs(definition.arguments) do if argument.required ~= false then requiredCount = requiredCount + 1 end end
    if #args < requiredCount then reply(src, 'Usage: ' .. definition.usage, 'error') return false end

    local ok, result, handlerError = xpcall(function() return definition.handler(src, args, reply) end, debug.traceback)
    if not ok then
        RPG.Log('ERROR', 'Command handler exception', { source = src, command = canonical, owner = definition.resource, error = result })
        reply(src, ('/%s could not be completed.'):format(canonical), 'error')
        return false
    end
    if result == false then
        reply(src, handlerError or ('/%s could not be completed.'):format(canonical), 'error')
        return false
    end
    if definition.audit ~= 'none' then TriggerEvent('rpg:server:commandAudit', src, canonical, args, definition.audit) end
    if type(result) == 'string' then reply(src, result, 'success') end
    return true
end

function RPG.GetCommandDefinitions()
    local list = {}
    for name, definition in pairs(commands) do
        list[#list + 1] = { name = name, aliases = definition.aliases, description = definition.description, usage = definition.usage, minimumAdminLevel = definition.minimumAdminLevel }
    end
    table.sort(list, function(a, b) return a.name < b.name end)
    return list
end

AddEventHandler('playerDropped', function() rates[source] = nil end)

exports('RegisterCommand', RPG.RegisterCommand)
exports('DispatchCommand', DispatchCommand)
exports('Notify', Notify)
