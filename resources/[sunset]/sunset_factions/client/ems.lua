local function notify(msg, typ)
    exports.sunset_ui:Notify(msg, typ or 'info')
end

RegisterCommand('stabilize', function(_, args)
    local target = tonumber(args[1])
    if not target then return notify(exports.sunset_core:Translate('factions.message.usage_stabilize_id'), 'error') end
    local ok, err = Sunset.AwaitCallback('sunset:emsStabilize', target)
    if not ok then notify(err or exports.sunset_core:Translate('factions.msg.stabilization_failed_check_duty_rank_patient'), 'error') end
end, false)

CreateThread(function()
    Wait(3500)
    TriggerEvent('chat:addSuggestion', '/stabilize', 'Stabilize downed patient (EMS/LSFD)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/firecalls', 'List active fire incidents (LSFD on duty)')
end)
