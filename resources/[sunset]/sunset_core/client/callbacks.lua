Sunset = Sunset or {}

local PendingCallbacks = {}
local RequestId = 0
local ResourceRequestBase = (math.abs(GetHashKey(GetCurrentResourceName())) % 10000) * 100000

local function nextRequestId()
    RequestId = RequestId + 1
    if RequestId >= 99999 then RequestId = 1 end
    return ResourceRequestBase + RequestId
end

function TriggerCallbackTimeout(name, timeoutMs, cb, ...)
    local id = nextRequestId()
    local tStart = GetGameTimer()
    local timeout = tonumber(timeoutMs) or 15000
    local isSpecialTrace = (name == 'sunset:enterGame')

    PendingCallbacks[id] = {
        cb = cb,
        name = name,
        start = tStart,
        timeout = timeout,
    }

    if isSpecialTrace then
        print(('^3[CB-PERF] enterGame REQUEST id=%s at=%d^7'):format(tostring(id), tStart))
        print(('^3[CB-PERF] enterGame TIMEOUT_ARMED id=%s timeout=%d^7'):format(tostring(id), timeout))
    end

    TriggerServerEvent('sunset:server:triggerCallback', name, id, ...)

    SetTimeout(timeout, function()
        local item = PendingCallbacks[id]
        if not item then return end
        PendingCallbacks[id] = nil
        local dur = GetGameTimer() - item.start
        if item.name == 'sunset:enterGame' then
            print(('^1[CB-PERF] enterGame TIMEOUT_FIRED id=%s dur=%d^7'):format(tostring(id), dur))
        end
        item.cb(nil, ('%s timed out after %d ms'):format(item.name, item.timeout))
    end)
end
exports('TriggerCallbackTimeout', TriggerCallbackTimeout)

function TriggerCallback(name, cb, ...)
    TriggerCallbackTimeout(name, 15000, cb, ...)
end
exports('TriggerCallback', TriggerCallback)

RegisterNetEvent('sunset:client:callbackResponse', function(requestId, result, err)
    local item = PendingCallbacks[requestId]
    if item then
        PendingCallbacks[requestId] = nil
        local dur = GetGameTimer() - item.start
        if item.name == 'sunset:enterGame' then
            print(('^2[CB-PERF] enterGame RESPONSE id=%s dur=%d^7'):format(tostring(requestId), dur))
        end
        if type(result) == 'table' and result.__cb then
            item.cb(result.result, result.err)
        else
            item.cb(result, err)
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

-- Test command to verify AwaitCallbackTimeout returns deterministically on unhandled callbacks
RegisterCommand('testcbtimeout', function()
    print('^3[TEST-CB] Starting 1000ms callback timeout test...^7')
    local t0 = GetGameTimer()
    local res, err = Sunset.AwaitCallbackTimeout('sunset:testNonExistentCallback', 1000)
    local dur = GetGameTimer() - t0
    print(('^2[TEST-CB] Completed in %dms (res=%s, err=%s)^7'):format(dur, tostring(res), tostring(err)))
end, false)
