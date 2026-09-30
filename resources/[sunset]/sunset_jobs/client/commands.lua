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
        JC.notify(err or 'Could not load jobs', 'error')
        return
    end
    TriggerEvent('sunset:ui:jobs', data)
end

local function showSkills()
    local data, err = Sunset.AwaitCallback('sunset:jobs:getSkills')
    if not data then
        JC.notify(err or 'Could not load skills', 'error')
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
            JC.workFeedback('Fisherman shift is already active — stand in the fishing zone and press E.', 'info')
            return
        elseif JC.state ~= 'IDLE' then
            JC.workFeedback('Already on a shift — finish or /work cancel', 'error')
            return
        end
    end

    local jobId = JC.getCharacterJob()
    if jobId == 'unemployed' then
        JC.workFeedback('You need a job first — visit the Job Center or /jobs', 'error')
        return
    end

    local starter = STARTERS[jobId]
    if not starter then
        JC.workFeedback('No work loop for your job yet', 'error')
        return
    end

    local def = Sunset.CivilianJobs[jobId]
    JC.workFeedback(('Starting %s shift...'):format(def and def.label or jobId), 'info')
    local ok, err = pcall(starter)
    if not ok then
        JC.workFeedback('Work command failed — try again or contact staff.', 'error')
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
        JC.workFeedback('Shift cancelled', 'info')
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
        JC.notify(exports.sunset_core:Translate('jobs.message.you_are_now_employed_as') .. (data.jobLabel or data.jobId), 'success')
    else
        JC.notify(err or 'Could not get job', 'error')
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

-- DEV: spawn a phantom+tanker at your position for coord testing
RegisterCommand('spawntruck', function()
    local ped    = PlayerPedId()
    local pos    = GetEntityCoords(ped)
    local h      = GetEntityHeading(ped)

    local function loadModel(name)
        local hash = joaat(name)
        RequestModel(hash)
        local t = GetGameTimer() + 5000
        while not HasModelLoaded(hash) and GetGameTimer() < t do Wait(50) end
        return HasModelLoaded(hash) and hash or nil
    end

    local truckHash = loadModel('phantom')
    if not truckHash then exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.could_not_load_phantom_model'), 'error', 3000) return end
    local truck = CreateVehicle(truckHash, pos.x, pos.y, pos.z, h, true, false)
    SetEntityAsMissionEntity(truck, true, true)
    TaskWarpPedIntoVehicle(ped, truck, -1)
    SetModelAsNoLongerNeeded(truckHash)

    Wait(300)
    local trailerHash = loadModel('tanker')
    if not trailerHash then exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.could_not_load_tanker_model'), 'error', 3000) return end
    local rear = GetOffsetFromEntityInWorldCoords(truck, 0.0, -10.5, 0.5)
    local trailer = CreateVehicle(trailerHash, rear.x, rear.y, rear.z, h, true, false)
    SetEntityAsMissionEntity(trailer, true, true)
    SetEntityHeading(trailer, h)
    SetVehicleOnGroundProperly(trailer)
    Wait(200)
    AttachVehicleToTrailer(truck, trailer, 1.1)
    SetModelAsNoLongerNeeded(trailerHash)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.spawned_phantom_tanker_use_dl_for_coords_heading'), 'success', 4000)
end, false)

TriggerEvent('chat:addSuggestion', '/spawntruck', '[DEV] Spawn phantom+tanker la tine pentru testare coords')
TriggerEvent('chat:addSuggestion', '/jobs', 'Open jobs panel')
TriggerEvent('chat:addSuggestion', '/work', 'Start your civilian job shift', {
    { name = 'cancel', help = 'Cancel current shift' },
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
            AddTextComponentSubstringPlayerName(depotLabels[jobId] or ((cfg.label or jobId) .. ' Work'))
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
        AddTextComponentSubstringPlayerName('Fish Buyer')
        EndTextCommandSetBlipName(blip)
    end
end)
