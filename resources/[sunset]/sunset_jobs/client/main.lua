AddEventHandler('sunset:world:openJobCenter', function(centerId, center)
    if IsNuiFocused() then return end
    local jobs, err = Sunset.AwaitCallback('sunset:jobs:getJobCenterJobs', centerId)
    if not jobs then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('jobs.msg.could_not_load_jobs'), 'error')
        return
    end
    exports.sunset_ui:Send('jobCenterShow', {
        centerId = centerId,
        label = center.label,
        jobs = jobs,
    })
    exports.sunset_ui:SetFocus(true, true)
end)

AddEventHandler('sunset:nui:jobCenterHire', function(data)
    local ok, err = Sunset.AwaitCallback('sunset:hireJob', data.jobId)
    if ok then
        if data.jobId ~= 'unemployed' then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.msg.you_are_now_employed_as', { job_label = tostring(data.jobLabel or data.jobId) }), 'success', 6000)
        else
            exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.you_have_resigned'), 'info', 4000)
        end
        exports.sunset_ui:SetFocus(false, false)
        exports.sunset_ui:Send('jobCenterHide', {})
    else
        local errMsg = err or 'Could not complete the hiring.'
        -- "already work" = user already has this job; treat as info, not error
        local kind = (errMsg:find('already work') or errMsg:find('You already work')) and 'info' or 'error'
        if kind == 'info' then
            errMsg = 'You already work this job! Use /work to start your shift.'
        end
        exports.sunset_ui:Notify(errMsg, kind)
        -- nu inchidem UI-ul — userul poate incerca alt job sau apasa ESC
    end
end)

AddEventHandler('sunset:nui:jobCenterClose', function()
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('jobCenterHide', {})
end)

AddEventHandler('sunset:nui:jobCenterWaypoint', function(data)
    if data and data.x and data.y then
        SetNewWaypoint(data.x, data.y)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.waypoint_setat_pe_harta'), 'info', 3000)
    end
end)

RegisterCommand('quitjob', function()
    CreateThread(function()
        if Sunset.JobClient then
            if Sunset.JobClient.clearWorkHud then
                Sunset.JobClient.clearWorkHud()
            elseif Sunset.JobClient.cleanup then
                Sunset.JobClient.cleanup()
            end
        end
        local ok, err = Sunset.AwaitCallback('sunset:quitCivilianJob')
        if not ok then exports.sunset_ui:Notify(err or exports.sunset_core:Translate('menu.msg.could_not_quit_civilian_job'), 'error') end
    end)
end, false)
