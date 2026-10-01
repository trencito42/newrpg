local JC = Sunset.JobClient
local activeCall = nil
local repairing = false

RegisterNetEvent('sunset:jobs:mechanic:newCall', function(callData)
    if JC.jobId ~= 'mechanic' or JC.state == 'IDLE' then return end
    activeCall = callData
    JC.notify(('Mechanic call #%s: %s — press E to accept'):format(
        callData and callData.id or '?', callData and callData.label or 'Service request'), 'info')
    JC.hud({
        title = exports.sunset_core:Translate('jobs.hud.mechanic.title'),
        objective = exports.sunset_core:Translate('jobs.hud.mechanic.incoming', { id = callData and callData.id or '?', label = callData and callData.label or '' }),
        tone = 'warn',
        keyHints = { { key = 'E', label = exports.sunset_core:Translate('jobs.hud.act.accept_call') } },
    })
    if callData and callData.coords then
        JC.setWaypoint(callData.coords)
    end
end)

AddEventHandler('sunset:jobs:dispatchNewCall', function(call)
    if not call or call.callType ~= 'mechanic' then return end
    if JC.jobId ~= 'mechanic' or JC.state == 'IDLE' then return end
    TriggerEvent('sunset:jobs:mechanic:newCall', {
        id = call.id,
        label = call.description or 'Mechanic service request',
        coords = call.coords,
        callerName = call.callerName,
    })
end)

RegisterNetEvent('sunset:jobs:mechanic:applyRepair', function(restoreAmount)
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return end
    local veh = GetVehiclePedIsIn(ped, false)
    if not veh or veh == 0 then return end

    local engine = GetVehicleEngineHealth(veh)
    local body = GetVehicleBodyHealth(veh)
    local newEngine = math.min(1000.0, engine + (restoreAmount or 500))
    local newBody = math.min(1000.0, body + (restoreAmount or 500) * 0.8)

    SetVehicleEngineHealth(veh, newEngine)
    SetVehicleBodyHealth(veh, newBody)
    if newEngine > 900 and newBody > 900 then
        SetVehicleFixed(veh)
        SetVehicleDeformationFixed(veh)
    end
    JC.notify(exports.sunset_core:Translate('jobs.message.your_vehicle_was_repaired'), 'success')
end)

local function getNearbyPlayerInVehicle()
    local myPed = PlayerPedId()
    local myCoords = GetEntityCoords(myPed)
    local best, bestDist = nil, 6.0
    for _, player in ipairs(GetActivePlayers()) do
        if player ~= PlayerId() then
            local ped = GetPlayerPed(player)
            if ped and DoesEntityExist(ped) and IsPedInAnyVehicle(ped, false) then
                local dist = #(myCoords - GetEntityCoords(ped))
                if dist < bestDist then
                    bestDist = dist
                    best = GetPlayerServerId(player)
                end
            end
        end
    end
    return best
end

local function startMechanic()
    local data, err = Sunset.AwaitCallback('sunset:jobs:mechanic:start')
    if not data then
        JC.notify(err or 'Could not go on duty', 'error')
        return
    end

    local cfg = Sunset.GetJobConfig('mechanic')
    JC.clearBlips()
    JC.addBlip(cfg.depot.coords, cfg.depot.blip, 'Mechanic Depot')
    JC.sessionData = data
    JC.setWaypoint(cfg.depot.coords)
    JC.hud({ title = exports.sunset_core:Translate('jobs.hud.mechanic.title'), objective = exports.sunset_core:Translate('jobs.hud.mechanic.wait') })
    JC.notify(exports.sunset_core:Translate('jobs.message.on_duty_accept_service_mechanic_calls_stand_near_a'), 'success')

    CreateThread(function()
        while JC.jobId == 'mechanic' and JC.state ~= 'IDLE' do
            local acceptedThisFrame = false
            if activeCall and activeCall.id and JC.sessionData and JC.sessionData.stage == 'on_duty' and not repairing then
                if IsControlJustPressed(0, 38) then
                    acceptedThisFrame = true
                    -- [JOBS AUDIT] the client used to flip to 'en_route' even when the server refused the call.
                    local accepted, acceptErr = Sunset.AwaitCallback('sunset:jobs:mechanic:acceptCall', activeCall.id)
                    if accepted then
                        if JC.sessionData then JC.sessionData.stage = 'en_route' end
                        JC.hud({ title = exports.sunset_core:Translate('jobs.hud.mechanic.title'), objective = exports.sunset_core:Translate('jobs.hud.mechanic.en_route'), keyHints = { { key = 'E', label = exports.sunset_core:Translate('jobs.hud.act.repair') } } })
                        JC.notify(exports.sunset_core:Translate('jobs.message.call_accepted_go_to_customer'), 'success')
                    else
                        activeCall = nil
                        JC.notify(acceptErr or 'Could not accept call', 'error')
                    end
                end
            end

            -- Repairs only make sense once a call is accepted (server rejects them otherwise).
            local target = (not acceptedThisFrame and JC.sessionData and JC.sessionData.stage == 'en_route') and getNearbyPlayerInVehicle() or nil
            if target and not repairing then
                JC.drawMarker(GetEntityCoords(GetPlayerPed(GetPlayerFromServerId(target))), 255, 140, 0)
                if IsControlJustPressed(0, 38) then
                    repairing = true
                    JC.playAnim('mini@repair', 'fixing_a_player', cfg.repairDurationMs or 12000)
                    JC.progress('Repairing vehicle...', cfg.repairDurationMs or 12000)
                    local result, err2 = Sunset.AwaitCallback('sunset:jobs:mechanic:repair', target)
                    repairing = false
                    ClearPedTasks(PlayerPedId())
                    if result then
                        activeCall = nil
                        if JC.sessionData then JC.sessionData.stage = 'on_duty' end
                        JC.addEarned(result.pay or 0)
                        JC.hud({ title = exports.sunset_core:Translate('jobs.hud.mechanic.title'), objective = exports.sunset_core:Translate('jobs.hud.mechanic.done'), tone = 'success' })
                        JC.notify(('Repair complete +$%s'):format(result.pay or 0), 'success')
                    elseif err2 then
                        JC.notify(err2, 'error')
                    end
                end
            end
            Wait(0)
        end
        activeCall = nil
    end)
end

Sunset.Jobs.StartMechanic = startMechanic
Sunset.Jobs.EndMechanic = function()
    return Sunset.AwaitCallback('sunset:jobs:mechanic:endShift')
end
