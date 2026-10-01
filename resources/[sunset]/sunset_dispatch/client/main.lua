local activeWaypointCallId = nil
local backupBlips = {}

local function notify(msg, typ)
    exports.sunset_ui:Notify(msg, typ or 'info')
end

local function setWaypoint(coords)
    if not coords or not coords.x then return end
    SetNewWaypoint(coords.x + 0.0, coords.y + 0.0)
end

local function clearWaypoint()
    if activeWaypointCallId then
        SetWaypointOff()
        activeWaypointCallId = nil
    end
end

RegisterNetEvent('sunset:dispatch:waypoint', function(coords)
    setWaypoint(coords)
    notify(exports.sunset_core:Translate('dispatch.message.gps_waypoint_set_for_service_call'), 'info')
end)

RegisterNetEvent('sunset:dispatch:newCall', function(call)
    if not call or not call.callType then return end
    local label = Sunset.Dispatch.ServiceTypes[call.callType]
        and Sunset.Dispatch.ServiceTypes[call.callType].label
        or call.callType
    notify(exports.sunset_core:Translate('dispatch.msg.new_call_accept', { label = tostring(label), id = math.floor(tonumber(call.id) or 0), call_type = tostring(call.callType), id_2 = math.floor(tonumber(call.id) or 0) }), 'warning')
    TriggerEvent('sunset:jobs:dispatchNewCall', call)
end)

local function removeBackupBlip(callId)
    local blip = backupBlips[callId]
    if blip and DoesBlipExist(blip) then RemoveBlip(blip) end
    backupBlips[callId] = nil
end

RegisterNetEvent('sunset:dispatch:backupAlert', function(call)
    if not call or not call.coords then return end
    local officerId = call.callerSource or call.callerServerId or 0
    local officerName = call.callerName or ('Officer #%d'):format(officerId)
    notify(exports.sunset_core:Translate('dispatch.msg.backup_requested_by', { officer_name = tostring(officerName), officer_id = math.floor(tonumber(officerId) or 0) }), 'warning', 12000)
    removeBackupBlip(call.id)
    local blip = AddBlipForCoord(call.coords.x, call.coords.y, call.coords.z)
    SetBlipSprite(blip, 161)
    SetBlipColour(blip, 3)
    SetBlipScale(blip, 1.1)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('dispatch.msg.backup', { officer_id = math.floor(tonumber(officerId) or 0) }))
    EndTextCommandSetBlipName(blip)
    backupBlips[call.id] = blip
    SetTimeout(60000, function()
        removeBackupBlip(call.id)
    end)
end)

RegisterNetEvent('sunset:dispatch:backupEnded', function(call)
    if call and call.id then removeBackupBlip(call.id) end
end)

RegisterNetEvent('sunset:dispatch:callAccepted', function(call)
    if not call then return end
    notify(exports.sunset_core:Translate('dispatch.message.a_responder_is_on_the_way'), 'success')
end)

RegisterNetEvent('sunset:dispatch:callUpdated', function(call)
    if not call then return end
    if call.isResponder and call.coords and (
        call.status == Sunset.Dispatch.States.EN_ROUTE
        or call.status == Sunset.Dispatch.States.ASSIGNED
    ) then
        setWaypoint(call.coords)
        activeWaypointCallId = call.id
    end
end)

RegisterNetEvent('sunset:dispatch:callEnded', function(call)
    if call and call.id == activeWaypointCallId then clearWaypoint() end
end)

RegisterNetEvent('sunset:dispatch:callTaken', function(data)
    if data and data.id == activeWaypointCallId then clearWaypoint() end
end)

CreateThread(function()
    Wait(1500)
    TriggerEvent('chat:addSuggestion', '/service', 'Request a service', {
        { name = 'type', help = 'taxi | medic | fire | mechanic' },
        { name = 'message', help = 'optional details' },
    })
    TriggerEvent('chat:addSuggestion', '/servicecalls', 'List open service calls for your duty role')
    TriggerEvent('chat:addSuggestion', '/accept', 'Accept a service call', {
        { name = 'type', help = 'taxi | medic | fire | mechanic' },
        { name = 'id', help = 'Call ID' },
    })
    TriggerEvent('chat:addSuggestion', '/cancel', 'Cancel a service call', {
        { name = 'type', help = 'taxi | medic | fire | mechanic' },
        { name = 'id', help = 'Call ID' },
    })
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        clearWaypoint()
        for callId in pairs(backupBlips) do removeBackupBlip(callId) end
    end
end)

RegisterCommand('calls', function()
    local data, err = Sunset.AwaitCallback('sunset:dispatchPanelData')
    if not data then
        notify(err or exports.sunset_core:Translate('dispatch.msg.cannot_open_dispatch_panel'), 'error')
        return
    end
    TriggerEvent('sunset:ui:serviceCalls', data)
end, false)

AddEventHandler('sunset:ui:serviceCallsAcceptRequest', function(data)
    local callId = tonumber(data and data.callId)
    if not callId then return end

    local call = Sunset.AwaitCallback('sunset:dispatchGet', callId)
    if not call or not call.callType then
        notify(exports.sunset_core:Translate('dispatch.message.call_not_found'), 'error')
        return
    end

    local accepted, err = Sunset.AwaitCallback('sunset:dispatchAccept', call.callType, callId)
    if accepted then
        notify(exports.sunset_core:Translate('dispatch.msg.accepted_call', { call_id = math.floor(tonumber(callId) or 0) }), 'success')
        exports.sunset_ui:Send('serviceCallsHide', {})
        exports.sunset_ui:SetFocus(false, false)
    else
        notify(err or exports.sunset_core:Translate('dispatch.message.could_not_accept_call'), 'error')
    end
end)

CreateThread(function()
    Wait(2000)
    TriggerEvent('chat:addSuggestion', '/calls', 'Open service dispatch panel (on duty)')
end)
