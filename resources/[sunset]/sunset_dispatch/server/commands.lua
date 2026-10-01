local DispatchChatHandlers = {}

local function notify(source, msg, typ)
    TriggerClientEvent('sunset:client:notify', source, msg, typ or 'info')
end

local function runService(source, args)
    if source == 0 then return end
    local callType = args[1]
    if not callType then
        notify(source, exports.sunset_core:TFor(source, 'dispatch.msg.usage_service_taxi_medic_fire_mechanic'), 'error')
        return
    end
    local description = table.concat(args, ' ', 2)
    local call, err = ServiceCore.createServiceCall(source, callType, nil, nil, description)
    if not call then notify(source, err or exports.sunset_core:TFor(source, 'dispatch.message.could_not_create_service_call'), 'error'); return end
    TriggerEvent('sunset:dispatch:serviceCommand', source, call.callType, call.id, description)
end

local function runServiceCalls(source)
    if source == 0 then return end
    local openCalls = ServiceCore.getActiveCalls(nil, { status = Sunset.Dispatch.States.OPEN })
    local lines = {}
    local shown = 0
    for _, call in ipairs(openCalls) do
        if ServiceCore.isProviderForType(source, call.callType) then
            shown = shown + 1
            local c = call.coords or {}
            lines[#lines + 1] = ('#%d %s — %s (%.0f, %.0f)'):format(
                call.id,
                Sunset.Dispatch.ServiceTypes[call.callType].label or call.callType,
                call.callerName or 'Unknown',
                c.x or 0,
                c.y or 0
            )
        end
    end
    if shown == 0 then
        notify(source, exports.sunset_core:TFor(source, 'dispatch.msg.no_open_service_calls_for_your'), 'info')
        return
    end
    notify(source, exports.sunset_core:TFor(source, 'dispatch.msg.open_calls', { shown = math.floor(tonumber(shown) or 0), concat = table.concat(lines, ' | ') }), 'info')
end

local function runAccept(source, args)
    if source == 0 then return end
    local callType, callId = args[1], args[2]
    if not callType or not callId then
        notify(source, exports.sunset_core:TFor(source, 'dispatch.message.usage_accept_type_id'), 'error')
        return
    end
    local call, err = ServiceCore.acceptCall(source, callType, callId)
    if not call then notify(source, err or exports.sunset_core:TFor(source, 'dispatch.message.could_not_accept_call'), 'error') end
end

local function runCancel(source, args)
    if source == 0 then return end
    local callType, callId = args[1], args[2]
    if not callType or not callId then
        notify(source, exports.sunset_core:TFor(source, 'dispatch.message.usage_cancel_type_id'), 'error')
        return
    end
    local ok, err = ServiceCore.cancelCall(source, callType, callId)
    if not ok then notify(source, err or exports.sunset_core:TFor(source, 'dispatch.msg.could_not_cancel_call'), 'error')
    else notify(source, exports.sunset_core:TFor(source, 'dispatch.msg.service_call_cancelled'), 'success') end
end

local function registerDispatchCommand(name, handler)
    name = string.lower(name)
    DispatchChatHandlers[name] = handler
    RegisterCommand(name, handler, false)
end

registerDispatchCommand('service', function(source, args) runService(source, args) end)
registerDispatchCommand('servicecalls', function(source) runServiceCalls(source) end)
registerDispatchCommand('accept', function(source, args) runAccept(source, args) end)
registerDispatchCommand('cancel', function(source, args) runCancel(source, args) end)

function ExecutePlayerCommand(source, name, args)
    if source == 0 then return false end
    name = string.lower(tostring(name or ''))
    local handler = DispatchChatHandlers[name]
    if not handler then return false end
    handler(source, args or {})
    return true
end
exports('ExecutePlayerCommand', ExecutePlayerCommand)

CreateThread(function()
    Wait(500)
    TriggerClientEvent('chat:addSuggestion', -1, '/service', 'Request a service', {
        { name = 'type', help = 'taxi | medic | fire | mechanic' },
        { name = 'message', help = 'optional details' },
    })
    TriggerClientEvent('chat:addSuggestion', -1, '/servicecalls', 'List open service calls for your duty role')
    TriggerClientEvent('chat:addSuggestion', -1, '/accept', 'Accept a service call', {
        { name = 'type', help = 'taxi | medic | fire | mechanic' },
        { name = 'id', help = 'Call ID' },
    })
    TriggerClientEvent('chat:addSuggestion', -1, '/cancel', 'Cancel a service call', {
        { name = 'type', help = 'taxi | medic | fire | mechanic' },
        { name = 'id', help = 'Call ID' },
    })
end)
