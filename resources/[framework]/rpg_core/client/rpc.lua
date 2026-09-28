RPG = RPG or {}

local pending = {}
local counter = 0
local prefix = ('rpg_core:%s:%s'):format(GetPlayerServerId(PlayerId()), math.random(100000, 999999))

local function nextId()
    counter = (counter % 999999) + 1
    return ('%s:%d'):format(prefix, counter)
end

function Request(name, callback, ...)
    if type(name) ~= 'string' or type(callback) ~= 'function' then return nil end
    local id = nextId()
    pending[id] = callback
    TriggerServerEvent('rpg:rpc:request', id, name, table.pack(...))
    SetTimeout(RPG.Config.rpc.timeoutMs + 1000, function()
        local cb = pending[id]
        if not cb then return end
        pending[id] = nil
        cb(nil, 'The request timed out.', 'TIMEOUT')
    end)
    return id
end

function Await(name, ...)
    local promiseObject = promise.new()
    Request(name, function(data, err, code)
        promiseObject:resolve({ data = data, error = err, code = code })
    end, ...)
    local result = Citizen.Await(promiseObject)
    return result.data, result.error, result.code
end

RegisterNetEvent('rpg:rpc:response', function(requestId, response)
    if type(requestId) ~= 'string' or type(response) ~= 'table' then return end
    local callback = pending[requestId]
    if not callback then return end
    pending[requestId] = nil
    if response.ok then callback(response.data, nil, nil) else callback(nil, response.error or 'Request failed.', response.code) end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for id, callback in pairs(pending) do
        pending[id] = nil
        callback(nil, 'Framework stopped.', 'RESOURCE_STOP')
    end
end)

exports('Request', Request)
exports('Await', Await)

