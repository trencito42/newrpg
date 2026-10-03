local JC = Sunset.JobClient

local LEGACY_STARTERS = {
    trucker = function() Sunset.Jobs.StartTrucker() end,
    garbage = function() Sunset.Jobs.StartGarbage() end,
    courier = function() Sunset.Jobs.StartCourier() end,
    fisherman = function() Sunset.Jobs.StartFisherman() end,
    mechanic = function() Sunset.Jobs.StartMechanic() end,
}

local STARTERS = {
    trucker = LEGACY_STARTERS.trucker,
    garbage = LEGACY_STARTERS.garbage,
    courier = LEGACY_STARTERS.courier,
    fisherman = LEGACY_STARTERS.fisherman,
    mechanic = LEGACY_STARTERS.mechanic,
}

local function openJobsPanel()
    if IsNuiFocused() then return end
    local data, err = Sunset.AwaitCallback('sunset:jobs:getPanelData')
    if not data then
        JC.notify(err or exports.sunset_core:Translate('jobs.msg.could_not_load_jobs'), 'error')
        return
    end
    TriggerEvent('sunset:ui:jobs', data)
end

local function showSkills()
    local data, err = Sunset.AwaitCallback('sunset:jobs:getSkills')
    if not data then
        JC.notify(err or exports.sunset_core:Translate('jobs.msg.could_not_load_skills'), 'error')
        return
    end
    TriggerEvent('sunset:ui:skills', { skills = data.skills or {} })
end

local function showJobHelp()
    local jobId = JC.getCharacterJob()
    local cfg = Sunset.GetJobConfig(jobId)
    local def = Sunset.CivilianJobs[jobId]
    if not cfg or not def or jobId == 'unemployed' then
        JC.notify(exports.sunset_core:Translate('jobs.message.get_a_job_at_the_job_center_or_use'), 'info')
        return
    end
    JC.notify(def.label .. ': ' .. (cfg.help or def.description or ''), 'info', 8000)
end

local function startWork()
    if JC.state ~= 'IDLE' then
        if not JC.syncSessionState() then
            -- stale client state cleared
        elseif JC.jobId == 'fisherman' then
            if Sunset.Jobs and Sunset.Jobs.EnsureFishermanShift then
                Sunset.Jobs.EnsureFishermanShift()
            end
            JC.workFeedback(exports.sunset_core:Translate('jobs.msg.fisherman_shift_is_already_active_stand'), 'info')
            return
        elseif JC.state ~= 'IDLE' then
            JC.workFeedback(exports.sunset_core:Translate('jobs.msg.already_on_a_shift_finish_or'), 'error')
            return
        end
    end

    local jobId = JC.getCharacterJob()
    if jobId == 'unemployed' then
        JC.workFeedback(exports.sunset_core:Translate('jobs.msg.you_need_a_job_first_visit'), 'error')
        return
    end

    local starter = STARTERS[jobId]
    if not starter then
        -- [JOBS AUDIT] hunter/diver shifts start at their workplace supervisor (contract/gear menus), so
        -- "/work" and the Jobs panel Start button used to dead-end with a misleading message.
        local wp = Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId]
        if wp then
            JC.workFeedback(exports.sunset_core:Translate('jobs.msg.visit_your_supervisor_to_start_a', { job_label = tostring(wp.jobLabel or jobId) }), 'info')
            local c = wp.npc and wp.npc.coords
            if c then SetNewWaypoint(c.x + 0.0, c.y + 0.0) end
        else
            JC.workFeedback(exports.sunset_core:Translate('jobs.msg.no_work_loop_for_your_job'), 'error')
        end
        return
    end

    local def = Sunset.CivilianJobs[jobId]
    JC.workFeedback(exports.sunset_core:Translate('jobs.msg.starting_shift', { def = tostring(def and def.label or jobId) }), 'info')
    local ok, err = pcall(starter)
    if not ok then
        JC.workFeedback(exports.sunset_core:Translate('jobs.msg.work_command_failed_try_again_or'), 'error')
        print(('[sunset_jobs] /work error for %s: %s'):format(jobId, tostring(err)))
    end
end

RegisterCommand('jobs', function()
    openJobsPanel()
end, false)


RegisterCommand('work', function(_, args)
    local sub = args[1] and string.lower(args[1])
    if sub == 'cancel' or sub == 'stop' then
        local charJob = JC.getCharacterJob()
        if JC.jobId == 'mechanic' and JC.state ~= 'IDLE' then
            Sunset.Jobs.EndMechanic()
        else
            Sunset.AwaitCallback('sunset:jobs:cancelWork')
        end
        JC.cleanup()
        JC.hideObjective()
        JC.workFeedback(exports.sunset_core:Translate('jobs.hud.result.cancelled'), 'info')
        return
    end
    startWork()
end, false)

RegisterCommand('jobhelp', function()
    showJobHelp()
end, false)

RegisterCommand('skills', function()
    showSkills()
end, false)

AddEventHandler('sunset:nui:jobsClose', function()
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('jobsHide', {})
end)

AddEventHandler('sunset:nui:jobsStartWork', function()
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('jobsHide', {})
    startWork()
end)

AddEventHandler('sunset:ui:jobsSelectRequest', function(data)
    if not data or not data.jobId then return end
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('jobsHide', {})
    local ok, err = Sunset.AwaitCallback('sunset:hireJob', data.jobId)
    if ok then
        JC.notify(exports.sunset_core:Translate('jobs.msg.you_are_now_employed_as', { job_label = tostring(data.jobLabel or data.jobId) }), 'success')
    else
        JC.notify(err or exports.sunset_core:Translate('jobs.msg.could_not_get_job'), 'error')
    end
end)

AddEventHandler('sunset:nui:jobsCancelWork', function()
    if JC.jobId == 'mechanic' and JC.state ~= 'IDLE' then
        Sunset.Jobs.EndMechanic()
    else
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
    end
    JC.cleanup()
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('jobsHide', {})
end)

-- [JOBS AUDIT] /spawntruck (client-side phantom+tanker spawner, no permission check) removed: it let any
-- player spawn trucks and had no references.
TriggerEvent('chat:addSuggestion', '/jobs', 'Open jobs panel')
TriggerEvent('chat:addSuggestion', '/work', 'Start your civilian job shift', {
    { name = 'cancel', helpKey = "config.jobs.help.cancel_current_shift.600fd5d4", help = 'Cancel current shift' },
})
TriggerEvent('chat:addSuggestion', '/jobhelp', 'Help for your current job')
TriggerEvent('chat:addSuggestion', '/skills', 'Show job skill levels')

CreateThread(function()
    local depotLabels = {
        trucker = 'Trucker Depot',
        garbage = 'Garbage Depot',
        courier = 'Courier Warehouse',
        mechanic = 'Mechanic Depot',
    }
    for jobId, cfg in pairs(Sunset.JobsConfig or {}) do
        local depot = cfg.depot or cfg.warehouse
        if depot and depot.coords and depot.blip then
            local blip = AddBlipForCoord(depot.coords.x, depot.coords.y, depot.coords.z)
            SetBlipSprite(blip, depot.blip.sprite or 1)
            SetBlipColour(blip, depot.blip.color or 0)
            SetBlipScale(blip, depot.blip.scale or 0.7)
            SetBlipAsShortRange(blip, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentSubstringPlayerName(depotLabels[jobId] or (exports.sunset_core:Translate('jobs.msg.work', { label = tostring(cfg.label or jobId) })))
            EndTextCommandSetBlipName(blip)
        end
    end
    local fishCfg = Sunset.GetJobConfig('fisherman')
    if fishCfg and fishCfg.sellPoint then
        local sp = fishCfg.sellPoint
        local blip = AddBlipForCoord(sp.coords.x, sp.coords.y, sp.coords.z)
        local blipCfg = sp.blip or {}
        SetBlipSprite(blip, blipCfg.sprite or 280)
        SetBlipColour(blip, blipCfg.color or 46)
        SetBlipScale(blip, blipCfg.scale or 0.75)
        SetBlipAsShortRange(blip, true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('jobs.msg.fish_buyer'))
        EndTextCommandSetBlipName(blip)
    end
end)
