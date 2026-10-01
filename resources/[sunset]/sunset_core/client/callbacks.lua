Sunset = Sunset or {}

local PendingCallbacks = {}
local RequestId = 0
local ResourceRequestBase = math.abs(GetHashKey(GetCurrentResourceName())) * 100000

local function nextRequestId()
    RequestId = RequestId + 1
    if RequestId >= 99999 then RequestId = 1 end
    return ResourceRequestBase + RequestId
end

function TriggerCallbackTimeout(name, timeoutMs, cb, ...)
    local id = nextRequestId()
    PendingCallbacks[id] = cb
    TriggerServerEvent('sunset:server:triggerCallback', name, id, ...)
    local timeout = tonumber(timeoutMs) or 15000
    SetTimeout(timeout, function()
        local pending = PendingCallbacks[id]
        if not pending then return end
        PendingCallbacks[id] = nil
        pending(nil, ('%s timed out after %d ms'):format(name, timeout))
    end)
end
exports('TriggerCallbackTimeout', TriggerCallbackTimeout)

function TriggerCallback(name, cb, ...)
    TriggerCallbackTimeout(name, 15000, cb, ...)
end
exports('TriggerCallback', TriggerCallback)

RegisterNetEvent('sunset:client:callbackResponse', function(requestId, result, err)
    local cb = PendingCallbacks[requestId]
    if cb then
        PendingCallbacks[requestId] = nil
        if type(result) == 'table' and result.__cb then
            cb(result.result, result.err)
        else
            cb(result, err)
        end
    end
end)

-- Promise-style for internal use with custom timeout — always returns result, err (never throws)
function Sunset.AwaitCallbackTimeout(name, timeoutMs, ...)
    local p = promise.new()
    TriggerCallbackTimeout(name, timeoutMs, function(result, err)
        p:resolve({ result = result, err = err })
    end, ...)
    local packed = Citizen.Await(p)
    return packed.result, packed.err
end

function Sunset.AwaitCallback(name, ...)
    return Sunset.AwaitCallbackTimeout(name, 15000, ...)
end
