RPG = RPG or {}

local callbacks = {}
local globalRates = {}
local namedRates = {}
local metrics = { requests = 0, errors = 0, timeouts = 0, rejected = 0 }

local function isCallable(value)
    if type(value) == 'function' then return true end
    local meta = getmetatable(value)
    return meta ~= nil and type(meta.__call) == 'function'
end

local function allowWindow(store, key, windowMs, maximum)
    local now = GetGameTimer()
    local entry = store[key]
    if not entry or now - entry.startedAt >= windowMs then
        store[key] = { startedAt = now, count = 1 }
        return true
    end
    if entry.count >= maximum then return false end
    entry.count = entry.count + 1
    return true
end

function RegisterCallback(name, handler, options)
    assert(type(name) == 'string' and name:match('^[%w%._:-]+$'), 'invalid callback name')
    assert(isCallable(handler), 'callback handler must be callable')
    if callbacks[name] then error(('callback %s is already registered'):format(name)) end
    options = options or {}
    callbacks[name] = {
        handler = handler,
        allowUnauthenticated = options.allowUnauthenticated == true,
        windowMs = tonumber(options.windowMs) or RPG.Config.rpc.defaultWindowMs,
        maximum = tonumber(options.maximum) or RPG.Config.rpc.defaultMax,
        timeoutMs = tonumber(options.timeoutMs) or RPG.Config.rpc.timeoutMs,
        resource = GetInvokingResource() or GetCurrentResourceName(),
    }
    return true
end

RegisterNetEvent('rpg:rpc:request', function(requestId, name, args)
    local src = source
    metrics.requests = metrics.requests + 1
    if type(requestId) ~= 'string' or #requestId > 100 or type(name) ~= 'string' or #name > 100 or type(args) ~= 'table' then
        metrics.rejected = metrics.rejected + 1
        return
    end
    if not allowWindow(globalRates, src, RPG.Config.rpc.globalWindowMs, RPG.Config.rpc.globalMax) then
        metrics.rejected = metrics.rejected + 1
        TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = 'RATE_LIMIT', error = 'Too many requests. Slow down.' })
        return
    end
    local definition = callbacks[name]
    if not definition then
        metrics.errors = metrics.errors + 1
        TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = 'NOT_FOUND', error = 'Callback not found.' })
        return
    end
    namedRates[src] = namedRates[src] or {}
    if not allowWindow(namedRates[src], name, definition.windowMs, definition.maximum) then
        metrics.rejected = metrics.rejected + 1
        TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = 'RATE_LIMIT', error = 'That action is being used too quickly.' })
        return
    end
    if not definition.allowUnauthenticated and not GetAccountId(src) then
        metrics.rejected = metrics.rejected + 1
        TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = 'UNAUTHENTICATED', error = 'Authentication is required.' })
        return
    end

    local replied = false
    SetTimeout(definition.timeoutMs, function()
        if replied then return end
        replied = true
        metrics.timeouts = metrics.timeouts + 1
        RPG.Log('WARN', 'RPC handler timed out', { source = src, rpc = name, owner = definition.resource })
        TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = 'TIMEOUT', error = 'The request timed out.' })
    end)

    CreateThread(function()
        local packed
        local ok, failure = xpcall(function()
            packed = table.pack(definition.handler(src, table.unpack(args, 1, args.n or #args)))
        end, debug.traceback)
        if replied then return end
        replied = true
        if not ok then
            metrics.errors = metrics.errors + 1
            RPG.Log('ERROR', 'RPC handler exception', { source = src, rpc = name, owner = definition.resource, error = failure })
            TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = 'SERVER_ERROR', error = 'The request could not be completed.' })
            return
        end
        local data, handlerError, code = packed[1], packed[2], packed[3]
        if handlerError then
            TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = false, code = code or 'REJECTED', error = tostring(handlerError) })
        else
            TriggerClientEvent('rpg:rpc:response', src, requestId, { ok = true, data = data })
        end
    end)
end)

function RPG.GetRpcMetrics()
    return { requests = metrics.requests, errors = metrics.errors, timeouts = metrics.timeouts, rejected = metrics.rejected, registered = RPG.Util and (function()
        local count = 0 for _ in pairs(callbacks) do count = count + 1 end return count
    end)() or 0 }
end

AddEventHandler('playerDropped', function()
    globalRates[source] = nil
    namedRates[source] = nil
end)

exports('RegisterCallback', RegisterCallback)
