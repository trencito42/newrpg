local JC = Sunset.JobClient
-- [JOBS AUDIT] was an undeclared global (leaked across shifts / other resources' scripts).
local isManualDockingMode = false

local function requestControl(entity)
    if NetworkHasControlOfEntity(entity) then return true end
    NetworkRequestControlOfEntity(entity)
    local timeout = GetGameTimer() + 3000
    while not NetworkHasControlOfEntity(entity) and GetGameTimer() < timeout do
        NetworkRequestControlOfEntity(entity)
        Wait(0)
    end
    return NetworkHasControlOfEntity(entity)
end

local function isNearTruckerPoint(coords, cfg)
    local p = GetEntityCoords(PlayerPedId())
    local t = type(coords) == 'vector3' and coords or vector3(coords.x, coords.y, coords.z)
    local dx, dy = p.x - t.x, p.y - t.y
    if math.sqrt(dx * dx + dy * dy) > (cfg.deliveryRadius or 25.0) then return false end
    return math.abs(p.z - t.z) <= (cfg.deliveryZTolerance or 8.0)
end

local function safeHeading(v)
    if not v then return 0.0 end
    if type(v) == 'vector4' then return v.w end
    if type(v) == 'table' then return v.w or v.heading or 0.0 end
    return 0.0
end

local function safeVec3(v)
    if not v then return vector3(0.0, 0.0, 0.0) end
    if type(v) == 'vector3' or type(v) == 'vector4' then
        return vector3(v.x, v.y, v.z)
    end
    if type(v) == 'table' then
        return vector3(v.x or 0.0, v.y or 0.0, v.z or 0.0)
    end
    return vector3(0.0, 0.0, 0.0)
end

local function routePoint(session, key)
    local point = session and session[key]
    if not point then return nil end
    return safeVec3(point)
end

local function draw3DText(coords, text)
    local onScreen, sx, sy = World3dToScreen2d(coords.x, coords.y, coords.z + 1.2)
    if not onScreen then return end
    SetTextScale(0.35, 0.35)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextColour(255, 255, 255, 220)
    SetTextEntry('STRING')
    SetTextCentre(1)
    AddTextComponentString(text)
    DrawText(sx, sy)
end

local function getGroundCoords(cp)
    if not cp then return cp end
    local found, groundZ = GetGroundZFor_3dCoord(cp.x, cp.y, cp.z + 50.0, false)
    if not found then
        found, groundZ = GetGroundZFor_3dCoord(cp.x, cp.y, cp.z + 150.0, false)
    end
    if found then
        return vector3(cp.x, cp.y, groundZ)
    end
    return cp
end

local currentTruckerCheckpoint = nil

local function clearTruckerCheckpoint()
    if currentTruckerCheckpoint then
        DeleteCheckpoint(currentTruckerCheckpoint)
        currentTruckerCheckpoint = nil
    end
end

local function setTruckerCheckpoint(coords, r, g, b)
    clearTruckerCheckpoint()
    if not coords then return end
    local pos = getGroundCoords(coords)
    r = r or 46
    g = g or 204
    b = b or 113
    -- Checkpoint Type 47 = tall cylinder with arrow pointing down
    currentTruckerCheckpoint = CreateCheckpoint(47, pos.x, pos.y, pos.z, pos.x, pos.y, pos.z, 6.0, r, g, b, 180, 0)
    SetCheckpointCylinderHeight(currentTruckerCheckpoint, 5.0, 5.0, 6.0)
end

local function drawTruckerMarker(coords, r, g, b)
    if SunsetJobVisuals and SunsetJobVisuals.DrawTruckerDeliveryPreview then
        SunsetJobVisuals.DrawTruckerDeliveryPreview(coords, true)
    end
end

local function getAngleDiff(a1, a2)
    local diff = math.abs((a1 - a2) % 360.0)
    if diff > 180.0 then diff = 360.0 - diff end
    return diff
end

local function drawParkingBay3D(coords, heading, isDocked)
    if SunsetJobVisuals and SunsetJobVisuals.DrawTruckerParkingBayPreview then
        return SunsetJobVisuals.DrawTruckerParkingBayPreview(coords, heading, isDocked)
    end
    local hRad = math.rad(heading or 0.0)
    local cosH = math.cos(hRad)
    local sinH = math.sin(hRad)
    local forward = vector3(-sinH, cosH, 0.0)
    local right = vector3(cosH, sinH, 0.0)

    local halfW = 1.9 -- width 3.8m
    local halfL = 6.8 -- length 13.6m

    local ground = getGroundCoords(coords)
    local center = vector3(ground.x, ground.y, ground.z + 0.12)

    local c1 = center + (forward * halfL) + (right * halfW)
    local c2 = center + (forward * halfL) - (right * halfW)
    local c3 = center - (forward * halfL) - (right * halfW)
    local c4 = center - (forward * halfL) + (right * halfW)

    local r, g, b = 255, 165, 0
    if isDocked then
        r, g, b = 46, 204, 113
    end

    -- Draw perimeter lines
    DrawLine(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z, r, g, b, 240)
    DrawLine(c2.x, c2.y, c2.z, c3.x, c3.y, c3.z, r, g, b, 240)
    DrawLine(c3.x, c3.y, c3.z, c4.x, c4.y, c4.z, r, g, b, 240)
    DrawLine(c4.x, c4.y, c4.z, c1.x, c1.y, c1.z, r, g, b, 240)

    -- Diagonal markers / arrows
    DrawLine(c1.x, c1.y, c1.z, center.x, center.y, center.z, r, g, b, 120)
    DrawLine(c2.x, c2.y, c2.z, center.x, center.y, center.z, r, g, b, 120)

    -- Center chevron
    DrawMarker(0, center.x, center.y, center.z + 1.2, forward.x, forward.y, 0.0, 0.0, 0.0, 0.0,
        1.5, 1.5, 1.0, r, g, b, 180, false, false, 2, false, nil, nil, false)
end

local function inWorkTruck()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return false end
    local truck = JC.vehicles[1]
    if not truck or not DoesEntityExist(truck) then return true end
    return GetVehiclePedIsIn(ped, false) == truck
end

local function recoverTrailer()
    -- Only valid on trailer routes (e.g. phantom/fuel routes)
    if JC.sessionData and JC.sessionData.hasTrailer == false then
        return JC.notify(exports.sunset_core:Translate('jobs.message.this_truck_does_not_use_a_trailer'), 'info')
    end
    local recovery, err = Sunset.AwaitCallback('sunset:jobs:recoverTrailer')
    if not recovery then
        return JC.notify(err or exports.sunset_core:Translate('jobs.msg.trailer_recovery_is_not_available'), 'error')
    end

    if recovery.respawn then
        local truck = NetworkGetEntityFromNetworkId(recovery.truckNetId or 0)
        if truck == 0 or not DoesEntityExist(truck) then
            truck = JC.vehicles[1]
        end
        local spawned, spawnErr = JC.respawnTrailer(truck, recovery.trailerModel)
        if not spawned then
            return JC.notify(spawnErr or exports.sunset_core:Translate('jobs.message.could_not_spawn_replacement_trailer'), 'error')
        end
        return JC.notify(exports.sunset_core:Translate('jobs.msg.replacement_trailer_spawned_recoveries_remai_2', { remaining = math.floor(tonumber(recovery.remaining or 0) or 0) }), 'success')
    end

    local truck = NetworkGetEntityFromNetworkId(recovery.truckNetId or 0)
    local trailer = NetworkGetEntityFromNetworkId(recovery.trailerNetId or 0)
    if truck == 0 or trailer == 0 or not DoesEntityExist(truck) or not DoesEntityExist(trailer) then
        return JC.notify(exports.sunset_core:Translate('jobs.message.could_not_find_your_assigned_truck_or_trailer'), 'error')
    end
    if not requestControl(trailer) then
        return JC.notify(exports.sunset_core:Translate('jobs.message.could_not_take_control_of_the_trailer_try_again'), 'error')
    end

    SetVehicleHandbrake(truck, true)
    SetEntityVelocity(trailer, 0.0, 0.0, 0.0)
    DetachVehicleFromTrailer(truck)
    Wait(150)

    local target = GetOffsetFromEntityInWorldCoords(truck, 0.0, -10.5, 1.0)
    local heading = GetEntityHeading(truck)
    SetEntityCoordsNoOffset(trailer, target.x, target.y, target.z, false, false, false)
    SetEntityRotation(trailer, 0.0, 0.0, heading, 2, true)
    SetEntityHeading(trailer, heading)
    SetVehicleOnGroundProperly(trailer)
    Wait(250)
    AttachVehicleToTrailer(truck, trailer, 1.0)
    SetVehicleHandbrake(truck, false)

    Wait(250)
    local isAttached = IsVehicleAttachedToTrailer(truck) == 1 or IsVehicleAttachedToTrailer(truck) == true
    local attached, attachedEntity = GetVehicleTrailerVehicle(truck)
    local dist = #(GetEntityCoords(truck) - GetEntityCoords(trailer))
    local recovered = isAttached or (attached and (attachedEntity == trailer or dist <= 20.0)) or dist <= 16.0
    if not recovered then
        return JC.notify(exports.sunset_core:Translate('jobs.message.trailer_is_upright_but_could_not_attach_automatically_reverse'), 'warning')
    end
    TriggerServerEvent('sunset:jobs:syncTrailerStatus', true)
    JC.notify(exports.sunset_core:Translate('jobs.msg.trailer_recovered_and_attached_recoveries_re', { remaining = math.floor(tonumber(recovery.remaining or 0) or 0) }), 'success')
end

local function startTrucker(selectedRouteIdx)
    local data, err = Sunset.AwaitCallback('sunset:jobs:trucker:start', selectedRouteIdx)
    if not data then
        JC.notify(err or exports.sunset_core:Translate('jobs.msg.could_not_start_trucker_shift'), 'error')
        return
    end

    local cfg = Sunset.GetJobConfig('trucker')
    -- Wait a tick for sessionStarted to arrive so JC.jobId / JC.state are set
    Wait(100)

    -- Clean up any leftover work vehicles from previous shifts before spawning
    JC.deleteVehicles()

    JC.sessionData = data
    JC.clearBlips()
    JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.trucker_depot'))

    -- Clear any task/animation before warping into the vehicle
    ClearPedTasksImmediately(PlayerPedId())

    -- Spawn truck on road spawn (outside the terminal)
    local truckModel = data.truckModel or cfg.truckModel
    local truck = JC.spawnVehicle(truckModel, cfg.depot.spawn, true)
    if not truck then
        JC.notify(exports.sunset_core:Translate('jobs.message.could_not_spawn_the_truck_try_again'), 'error')
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        return
    end

    if data.hasTrailer then
        local trailerModel = data.trailerModel or cfg.trailerModel
        -- Spawn trailer unattached at the selected trailer bay — player must drive to hook it up.
        local trailerSpawnVec = (data.trailerSpawn and vector4(data.trailerSpawn.x, data.trailerSpawn.y, data.trailerSpawn.z, data.trailerSpawn.w or 0.0))
            or cfg.depot.trailerSpawn
        local trailer = JC.spawnVehicleOnly(trailerModel, trailerSpawnVec)
        if not trailer then
            JC.deleteVehicles()
            Sunset.AwaitCallback('sunset:jobs:cancelWork')
            JC.notify(exports.sunset_core:Translate('jobs.message.could_not_create_the_assigned_trailer_try_again'), 'error')
            return
        end
    end

    local warpDeadline = GetGameTimer() + 2500
    while GetVehiclePedIsIn(PlayerPedId(), false) ~= truck and GetGameTimer() < warpDeadline do
        TaskWarpPedIntoVehicle(PlayerPedId(), truck, -1)
        Wait(100)
    end

    local registered, registerErr = JC.registerVehiclesWithServer()
    if not registered then
        JC.deleteVehicles()
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        JC.notify(registerErr or exports.sunset_core:Translate('jobs.msg.could_not_register_the_truck'), 'error')
        return
    end
    JC.monitorVehicles()

    -- No-collision with nearby players at spawn (prevents vehicles spawning into each other)
    local spawnPos = vector3(cfg.depot.spawn.x, cfg.depot.spawn.y, cfg.depot.spawn.z)
    local myPed   = PlayerPedId()
    for _, pid in ipairs(GetActivePlayers()) do
        if pid ~= PlayerId() then
            local theirPed = GetPlayerPed(pid)
            if DoesEntityExist(theirPed) then
                SetEntityNoCollisionEntity(myPed,  theirPed, false)
                SetEntityNoCollisionEntity(truck,  theirPed, false)
                if IsPedInAnyVehicle(theirPed, false) then
                    local theirVeh = GetVehiclePedIsIn(theirPed, false)
                    if theirVeh ~= 0 and DoesEntityExist(theirVeh) then
                        SetEntityNoCollisionEntity(truck, theirVeh, false)
                    end
                end
            end
        end
    end
    -- Lift collision once outside the 50 m spawn zone (or after 15 s)
    CreateThread(function()
        local deadline = GetGameTimer() + 15000
        while GetGameTimer() < deadline do
            if #(GetEntityCoords(PlayerPedId()) - spawnPos) > 50.0 then break end
            Wait(500)
        end
    end)

    -- Stage: to_pickup — show waypoint to trailer yard
    local pickup = data.pickup and vector3(data.pickup.x, data.pickup.y, data.pickup.z)
                   or vector3(cfg.depot.trailerSpawn.x, cfg.depot.trailerSpawn.y, cfg.depot.trailerSpawn.z)
    JC.clearBlips()
    JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.trucker_depot'))
    local pickupBlip = JC.addBlip(pickup, { sprite = 477, color = 5, scale = 0.9 }, exports.sunset_core:Translate('jobs.msg.trailer_yard'))
    SetBlipRoute(pickupBlip, true)
    SetBlipRouteColour(pickupBlip, 5)
    JC.setWaypoint(pickup)
    setTruckerCheckpoint(pickup, 255, 165, 0)
    JC.hud({ title = exports.sunset_core:Translate('jobs.hud.trucker.title'), objective = exports.sunset_core:Translate('jobs.hud.trucker.pickup'), progress = { pct = 30 } })
    JC.notify(exports.sunset_core:Translate('jobs.message.drive_to_the_trailer_yard_and_hook_up_your'), 'info', 8000)

    -- Job loop: pickup → delivery → return depot
    CreateThread(function()
        local busy = false
        while JC.jobId == 'trucker' and JC.state ~= 'IDLE' do
            local session = JC.sessionData
            local stage = session and session.stage

            if stage == 'to_pickup' then
                local p = pickup
                local truck = JC.vehicles[1]
                if p and truck and DoesEntityExist(truck) then
                    local ppos = GetEntityCoords(PlayerPedId())
                    local distToPickup = #(ppos - p)
                    if distToPickup <= 350.0 then
                        drawTruckerMarker(p, 255, 165, 0)
                        if distToPickup <= 45.0 then
                            local attached = IsVehicleAttachedToTrailer(truck)
                            if attached then
                                draw3DText(p, exports.sunset_core:Translate('hint.jobs.trucker.confirm_trailer'))
                            else
                                draw3DText(p, exports.sunset_core:Translate('jobs.msg.back_up_to_attach_the_trailer'))
                            end
                        end
                    end
                    if isNearTruckerPoint(p, cfg) and inWorkTruck() and IsVehicleAttachedToTrailer(truck) and not busy then
                        JC.showHelp(exports.sunset_core:Translate('hint.native.confirm_trailer'))
                        if IsControlJustPressed(0, 38) then
                            busy = true
                            local result, pickErr = Sunset.AwaitCallback('sunset:jobs:trucker:atPickup')
                            busy = false
                            if result then
                                JC.sessionData.stage = result.stage or 'to_delivery'
                                local delivery = vector3(result.delivery.x, result.delivery.y, result.delivery.z)
                                JC.clearBlips()
                                JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.trucker_depot'))
                                local delivBlip = JC.addBlip(delivery, { sprite = 478, color = 2, scale = 0.95 }, exports.sunset_core:Translate('jobs.msg.delivery_3', { label = result.label or exports.sunset_core:Translate('jobs.word.cargo') }))
                                SetBlipRoute(delivBlip, true)
                                SetBlipRouteColour(delivBlip, 2)
                                JC.setWaypoint(result.delivery)
                                setTruckerCheckpoint(delivery, 46, 204, 113)
                                JC.hud({ title = exports.sunset_core:Translate('jobs.hud.trucker.title'), objective = exports.sunset_core:Translate('jobs.hud.trucker.deliver', { label = result.label or '?' }), progress = { pct = 30 } })
                                JC.notify(exports.sunset_core:Translate('jobs.msg.follow_the_map', { label = result.label or exports.sunset_core:Translate('jobs.word.destination') }), 'success', 8000)
                            else
                                JC.notify(pickErr or exports.sunset_core:Translate('jobs.msg.could_not_confirm_pickup'), 'error')
                            end
                        end
                    end
                end
            elseif stage == 'to_delivery' then
                local d = routePoint(session, 'delivery')
                local bay = routePoint(session, 'parkingBay') or d
                local bayHeading = safeHeading(session.parkingBay or session.delivery)

                if d then
                    local ppos = GetEntityCoords(PlayerPedId())
                    local distToEntrance = #(ppos - d)
                    local distToBay = bay and #(ppos - bay) or distToEntrance

                    local truck = JC.vehicles[1]
                    local trailer = 0
                    local hasTrailer = false
                    if truck and DoesEntityExist(truck) then
                        local hasTr, trEnt = GetVehicleTrailerVehicle(truck)
                        if hasTr and trEnt ~= 0 and DoesEntityExist(trEnt) then
                            trailer = trEnt
                            hasTrailer = true
                        elseif JC.vehicles[2] and DoesEntityExist(JC.vehicles[2]) then
                            trailer = JC.vehicles[2]
                            hasTrailer = true
                        end
                    end

                    local targetRadius = cfg.manualParkingRadius or 4.5
                    local angleTolerance = cfg.manualParkingAngleTolerance or 35.0

                    local evalEntity = (hasTrailer and trailer ~= 0 and DoesEntityExist(trailer)) and trailer or truck
                    local evalPos = (evalEntity and DoesEntityExist(evalEntity)) and GetEntityCoords(evalEntity) or ppos
                    local evalDist = #(vector3(evalPos.x, evalPos.y, evalPos.z) - bay)
                    local evalHeading = (evalEntity and DoesEntityExist(evalEntity)) and GetEntityHeading(evalEntity) or 0.0

                    local angleDiff = math.min(getAngleDiff(evalHeading, bayHeading), getAngleDiff((evalHeading + 180.0) % 360.0, bayHeading))
                    local isDocked = (evalDist <= targetRadius) and (angleDiff <= angleTolerance)

                    -- If player pressed G to enter manual parking mode OR is already near the bay
                    if isManualDockingMode or isDocked or distToBay <= 35.0 then
                        if distToBay <= 350.0 then
                            drawTruckerMarker(bay, isDocked and 46 or 255, isDocked and 204 or 165, isDocked and 113 or 0)
                            drawParkingBay3D(bay, bayHeading, isDocked)

                            if distToBay <= 45.0 then
                                if isDocked then
                                    draw3DText(bay, exports.sunset_core:Translate('hint.jobs.trucker.manual_park'))
                                else
                                    draw3DText(bay, exports.sunset_core:Translate('jobs.msg.align_trailer_in_bay_for_g'))
                                end
                            end
                        end

                        if inWorkTruck() and not busy then
                            if isDocked then
                                JC.showHelp(exports.sunset_core:Translate('hint.native.manual_park'))
                                if IsControlJustPressed(0, 47) or IsControlJustPressed(0, 38) then
                                    busy = true
                                    local result, err2 = Sunset.AwaitCallback('sunset:jobs:trucker:deliver', true)
                                    busy = false
                                    if result then
                                        isManualDockingMode = false
                                        JC.sessionData = JC.sessionData or {}
                                        JC.sessionData.stage = result.stage or 'return_depot'
                                        JC.deleteVehicles(true)
                                        JC.clearBlips()
                                        local retPoint = (cfg.depot.returnCoords and vector3(cfg.depot.returnCoords.x, cfg.depot.returnCoords.y, cfg.depot.returnCoords.z)) or (cfg.depot.spawn and vector3(cfg.depot.spawn.x, cfg.depot.spawn.y, cfg.depot.spawn.z)) or cfg.depot.coords
                                        local depBlip = JC.addBlip(retPoint, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.return_depot'))
                                        SetBlipRoute(depBlip, true)
                                        SetBlipRouteColour(depBlip, 3)
                                        JC.setWaypoint(retPoint)
                                        setTruckerCheckpoint(retPoint, 52, 152, 219)
                                        JC.addEarned(result.pay or 0)
                                        JC.hud({ title = exports.sunset_core:Translate('jobs.hud.trucker.title'), objective = exports.sunset_core:Translate('jobs.hud.trucker.return'), progress = { pct = 90 } })

                                        -- [JOBS AUDIT] the server verifies the docking; show the bonus only if granted.
                                        local bonusStr = ' ' .. (result.isManual and exports.sunset_core:Translate('jobs.msg.bonus_manual_dock') or exports.sunset_core:Translate('jobs.msg.bonus_dock_unverified'))
                                        if result.bonusPct and result.bonusPct > 0 then
                                            bonusStr = bonusStr .. ' ' .. exports.sunset_core:Translate('jobs.msg.bonus_rank_pct', { pct = math.floor(result.bonusPct) })
                                        end
                                        JC.notify(exports.sunset_core:Translate('jobs.msg.delivered_return_the_truck_to_the', { pay = math.floor(tonumber(result.pay or 0) or 0), bonus_str = tostring(bonusStr) }), 'success', 8000)
                                    else
                                        JC.notify(err2 or exports.sunset_core:Translate('jobs.msg.could_not_deliver_cargo'), 'error')
                                    end
                                end
                            elseif distToBay <= 45.0 then
                                JC.showHelp(exports.sunset_core:Translate('jobs.msg.reverse_trailer_into_the_glowing_box'))
                            end
                        end
                    else
                        -- Approaching the entrance / stop marker (d)
                        if distToEntrance <= 350.0 then
                            drawTruckerMarker(d, 255, 165, 0)
                            if distToEntrance <= 45.0 then
                                draw3DText(d, exports.sunset_core:Translate('hint.jobs.trucker.quick_or_bay'))
                            end
                        end

                        if (distToEntrance <= 30.0 or isNearTruckerPoint(d, cfg)) and inWorkTruck() and not busy then
                            JC.showHelp(exports.sunset_core:Translate('hint.native.quick_or_bay'))

                            if IsControlJustPressed(0, 38) then -- E -> Quick deliver
                                busy = true
                                local result, err2 = Sunset.AwaitCallback('sunset:jobs:trucker:deliver', false)
                                busy = false
                                if result then
                                    isManualDockingMode = false
                                    JC.sessionData = JC.sessionData or {}
                                    JC.sessionData.stage = result.stage or 'return_depot'
                                    JC.deleteVehicles(true)
                                    JC.clearBlips()
                                    local retPoint = (cfg.depot.returnCoords and vector3(cfg.depot.returnCoords.x, cfg.depot.returnCoords.y, cfg.depot.returnCoords.z)) or (cfg.depot.spawn and vector3(cfg.depot.spawn.x, cfg.depot.spawn.y, cfg.depot.spawn.z)) or cfg.depot.coords
                                    local depBlip = JC.addBlip(retPoint, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.return_depot'))
                                    SetBlipRoute(depBlip, true)
                                    SetBlipRouteColour(depBlip, 3)
                                    JC.setWaypoint(retPoint)
                                    setTruckerCheckpoint(retPoint, 52, 152, 219)
                                    JC.addEarned(result.pay or 0)
                                    JC.hud({ title = exports.sunset_core:Translate('jobs.hud.trucker.title'), objective = exports.sunset_core:Translate('jobs.hud.trucker.return'), progress = { pct = 90 } })

                                    local bonusStr = ''
                                    if result.bonusPct and result.bonusPct > 0 then
                                        bonusStr = bonusStr .. ' ' .. exports.sunset_core:Translate('jobs.msg.bonus_rank_pct', { pct = math.floor(result.bonusPct) })
                                    end
                                    JC.notify(exports.sunset_core:Translate('jobs.msg.delivered_return_the_truck_to_the', { pay = math.floor(tonumber(result.pay or 0) or 0), bonus_str = tostring(bonusStr) }), 'success', 8000)
                                else
                                    JC.notify(err2 or exports.sunset_core:Translate('jobs.msg.could_not_deliver_cargo'), 'error')
                                end
                            elseif IsControlJustPressed(0, 47) then -- G -> Switch to manual docking mode
                                isManualDockingMode = true
                                JC.clearBlips()
                                local bayBlip = JC.addBlip(bay, { sprite = 478, color = 2, scale = 0.95 }, exports.sunset_core:Translate('jobs.msg.parking_bay_2x_bonus'))
                                SetBlipRoute(bayBlip, true)
                                SetBlipRouteColour(bayBlip, 2)
                                JC.setWaypoint(bay)
                                setTruckerCheckpoint(bay, 255, 165, 0)
                                JC.hud({ title = exports.sunset_core:Translate('jobs.hud.trucker.title'), objective = exports.sunset_core:Translate('jobs.hud.trucker.park'), progress = { pct = 75 }, tone = 'warn' })
                                JC.notify(exports.sunset_core:Translate('jobs.message.manual_parking_mode_activated_reverse_and_align_your_trailer'), 'info', 7000)
                            end
                        end
                    end
                end
            elseif stage == 'return_depot' then
                local retPoint = (cfg.depot.returnCoords and vector3(cfg.depot.returnCoords.x, cfg.depot.returnCoords.y, cfg.depot.returnCoords.z)) or (cfg.depot.spawn and vector3(cfg.depot.spawn.x, cfg.depot.spawn.y, cfg.depot.spawn.z)) or cfg.depot.coords
                local ppos = GetEntityCoords(PlayerPedId())
                local distToDepot = #(ppos - retPoint)
                if distToDepot <= 350.0 then
                    drawTruckerMarker(retPoint, 52, 152, 219)
                    if distToDepot <= 45.0 then
                        draw3DText(retPoint, exports.sunset_core:Translate('hint.jobs.trucker.return_truck'))
                    end
                end
                if (JC.isNear(retPoint, cfg.returnRadius or 25.0) or JC.isNear(cfg.depot.coords, cfg.returnRadius or 25.0)) and inWorkTruck() and not busy then
                    JC.showHelp(exports.sunset_core:Translate('hint.native.return_truck'))
                    if IsControlJustPressed(0, 38) then
                        busy = true
                        local ok, err3 = Sunset.AwaitCallback('sunset:jobs:trucker:returnDepot')
                        busy = false
                        if ok then
                            clearTruckerCheckpoint()
                            JC.deleteVehicles()
                            SetWaypointOff()
                            break
                        else
                            JC.notify(err3 or exports.sunset_core:Translate('jobs.msg.could_not_return_the_truck_to'), 'error')
                        end
                    end
                end
            end
            Wait(0)
        end
    end)
end

Sunset.Jobs = Sunset.Jobs or {}
Sunset.Jobs.StartTrucker = startTrucker   -- called as StartTrucker(routeIndex)

RegisterNetEvent('sunset:jobs:trucker:startShift', function(routeIdx)
    startTrucker(routeIdx)
end)

exports('StartTrucker', startTrucker)

RegisterCommand('truckroute', function()
    if JC.jobId ~= 'trucker' or JC.state == 'IDLE' or not JC.sessionData then
        return JC.notify(exports.sunset_core:Translate('jobs.message.you_are_not_currently_on_a_trucker_shift'), 'info')
    end
    local cfg = Sunset.GetJobConfig('trucker')
    local session = JC.sessionData
    local stage = session and session.stage
    if stage == 'to_pickup' and cfg and cfg.depot then
        local p = session.pickup and vector3(session.pickup.x, session.pickup.y, session.pickup.z)
                  or vector3(cfg.depot.trailerSpawn.x, cfg.depot.trailerSpawn.y, cfg.depot.trailerSpawn.z)
        JC.clearBlips()
        JC.addBlip(p, { sprite = 477, color = 5, scale = 0.9 }, exports.sunset_core:Translate('jobs.msg.trailer_yard'))
        SetBlipRoute(JC.addBlip(p, { sprite = 477, color = 5, scale = 0.9 }, exports.sunset_core:Translate('jobs.msg.trailer_yard')), true)
        JC.setWaypoint(p)
        setTruckerCheckpoint(p, 255, 165, 0)
        JC.notify(exports.sunset_core:Translate('jobs.message.gps_refreshed_to_trailer_yard'), 'success')
    elseif stage == 'to_delivery' then
        local d = routePoint(session, 'delivery')
        if d then
            JC.clearBlips()
            local delivBlip = JC.addBlip(d, { sprite = 478, color = 2, scale = 0.95 }, exports.sunset_core:Translate('jobs.msg.delivery_3', { label = session.label or exports.sunset_core:Translate('jobs.word.cargo') }))
            SetBlipRoute(delivBlip, true)
            SetBlipRouteColour(delivBlip, 2)
            JC.setWaypoint(d)
            setTruckerCheckpoint(d, 46, 204, 113)
            JC.notify(exports.sunset_core:Translate('jobs.msg.gps_route_refreshed_to', { label = tostring(session.label or exports.sunset_core:Translate('jobs.word.destination_2')) }), 'success')
        end
    elseif stage == 'return_depot' and cfg and cfg.depot then
        JC.clearBlips()
        local depBlip = JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.return_depot'))
        SetBlipRoute(depBlip, true)
        SetBlipRouteColour(depBlip, 3)
        JC.setWaypoint(cfg.depot.coords)
        setTruckerCheckpoint(cfg.depot.coords, 52, 152, 219)
        JC.notify(exports.sunset_core:Translate('jobs.message.gps_route_refreshed_to_trucker_depot'), 'success')
    end
end, false)
TriggerEvent('chat:addSuggestion', '/truckroute', 'Refresh GPS route to current delivery destination or depot')

RegisterCommand('recovertrailer', function()
    recoverTrailer()
end, false)

TriggerEvent('chat:addSuggestion', '/recovertrailer', 'Right and reattach your assigned Trucker trailer')

-- ═══ TRUCK & TRAILER TELEPORT TOOL (ADMIN / DEBUG) ═══
local function teleportRig(targetArg)
    local cfg = Sunset.GetJobConfig('trucker')
    local session = JC.sessionData
    local ped = PlayerPedId()
    local truck = GetVehiclePedIsIn(ped, false)
    if truck == 0 or not DoesEntityExist(truck) then
        truck = JC.vehicles[1]
    end

    if not truck or truck == 0 or not DoesEntityExist(truck) then
        return JC.notify(exports.sunset_core:Translate('jobs.message.you_must_be_inside_a_truck_or_have_an'), 'error')
    end

    local destCoords = nil
    local destHeading = GetEntityHeading(truck)
    local offsetDist = 0.0
    local label = 'Location'

    local lowerArg = string.lower(tostring(targetArg or ''))
    local routeNum = tonumber(targetArg)

    if routeNum and cfg and cfg.routes and cfg.routes[routeNum] then
        local r = cfg.routes[routeNum]
        destCoords = vector3(r.delivery.x, r.delivery.y, r.delivery.z)
        destHeading = (r.delivery and (r.delivery.w or r.delivery.heading)) or 0.0
        offsetDist = 30.0
        label = exports.sunset_core:Translate('jobs.trucker.label.route', {
            route = routeNum, destination = r.label or exports.sunset_core:Translate('jobs.trucker.label.delivery'),
        })
    elseif lowerArg == 'wp' or lowerArg == 'waypoint' then
        local blip = GetFirstBlipInfoId(8)
        if not DoesBlipExist(blip) then
            return JC.notify(exports.sunset_core:Translate('jobs.message.no_gps_waypoint_set_on_map_place_a_waypoint'), 'error')
        end
        local wp = GetBlipInfoIdCoord(blip)
        destCoords = vector3(wp.x, wp.y, wp.z)
        label = exports.sunset_core:Translate('jobs.trucker.label.gps_waypoint')
    elseif lowerArg == 'depot' and cfg and cfg.depot then
        destCoords = cfg.depot.coords
        destHeading = (cfg.depot.spawn and cfg.depot.spawn.w) or 270.0
        offsetDist = 0.0
        label = exports.sunset_core:Translate('jobs.trucker.label.depot')
    elseif lowerArg == 'pickup' and session and session.pickup then
        destCoords = vector3(session.pickup.x, session.pickup.y, session.pickup.z)
        destHeading = session.pickup.heading or session.pickup.w or 0.0
        label = exports.sunset_core:Translate('jobs.trucker.label.trailer_pickup')
    elseif lowerArg == 'delivery' and session and session.delivery then
        destCoords = vector3(session.delivery.x, session.delivery.y, session.delivery.z)
        destHeading = (session.delivery and (session.delivery.w or session.delivery.heading)) or 0.0
        offsetDist = 30.0
        label = exports.sunset_core:Translate('jobs.trucker.label.delivery_destination')
    elseif session and session.stage then
        if session.stage == 'to_pickup' then
            local p = session.pickup or (cfg and cfg.depot and cfg.depot.trailerSpawn)
            destCoords = p and vector3(p.x, p.y, p.z)
            destHeading = (p and (p.w or p.heading)) or 0.0
            label = exports.sunset_core:Translate('jobs.trucker.label.trailer_yard')
        elseif session.stage == 'to_delivery' then
            local d = session.delivery
            destCoords = d and vector3(d.x, d.y, d.z)
            destHeading = (d and (d.w or d.heading)) or 0.0
            offsetDist = 30.0
            label = exports.sunset_core:Translate('jobs.trucker.label.delivery_approach')
        elseif session.stage == 'return_depot' and cfg and cfg.depot then
            destCoords = cfg.depot.coords
            destHeading = (cfg.depot.spawn and cfg.depot.spawn.w) or 270.0
            label = exports.sunset_core:Translate('jobs.trucker.label.depot')
        end
    end

    if not destCoords then
        local blip = GetFirstBlipInfoId(8)
        if DoesBlipExist(blip) then
            local wp = GetBlipInfoIdCoord(blip)
            destCoords = vector3(wp.x, wp.y, wp.z)
            label = exports.sunset_core:Translate('jobs.trucker.label.map_waypoint')
        else
            return JC.notify(exports.sunset_core:Translate('jobs.message.no_active_trucker_objective_or_waypoint_found_usage_tptruck'), 'error')
        end
    end

    TriggerServerEvent('sunset:anticheat:markLegitLocal', 'trucker_tp', 20)

    -- Detect attached trailer
    local hasTr, trailer = GetVehicleTrailerVehicle(truck)
    if not hasTr or trailer == 0 or not DoesEntityExist(trailer) then
        if JC.vehicles[2] and DoesEntityExist(JC.vehicles[2]) then
            trailer = JC.vehicles[2]
            hasTr = true
        end
    end

    local hRad = math.rad(destHeading)
    local forward = vector3(-math.sin(hRad), math.cos(hRad), 0.0)

    local truckPos = destCoords
    if offsetDist > 0.0 then
        truckPos = destCoords - (forward * offsetDist)
    end

    local groundPos = getGroundCoords(truckPos)

    if GetVehiclePedIsIn(ped, false) ~= truck then
        TaskWarpPedIntoVehicle(ped, truck, -1)
    end

    -- Stop momentum & freeze entities
    SetVehicleHandbrake(truck, true)
    SetEntityVelocity(truck, 0.0, 0.0, 0.0)
    FreezeEntityPosition(truck, true)

    if hasTr and trailer ~= 0 and DoesEntityExist(trailer) then
        requestControl(trailer)
        SetEntityVelocity(trailer, 0.0, 0.0, 0.0)
        DetachVehicleFromTrailer(truck)
        FreezeEntityPosition(trailer, true)
    end

    -- Teleport truck
    SetEntityCoordsNoOffset(truck, groundPos.x, groundPos.y, groundPos.z + 1.2, false, false, false)
    SetEntityHeading(truck, destHeading)
    SetEntityRotation(truck, 0.0, 0.0, destHeading, 2, true)
    SetVehicleOnGroundProperly(truck)
    FreezeEntityPosition(truck, false)

    -- Position trailer ~10.5m directly behind truck
    if hasTr and trailer ~= 0 and DoesEntityExist(trailer) then
        Wait(100)
        local trailerTarget = GetOffsetFromEntityInWorldCoords(truck, 0.0, -10.5, 0.5)
        SetEntityCoordsNoOffset(trailer, trailerTarget.x, trailerTarget.y, trailerTarget.z, false, false, false)
        SetEntityHeading(trailer, destHeading)
        SetEntityRotation(trailer, 0.0, 0.0, destHeading, 2, true)
        SetVehicleOnGroundProperly(trailer)
        FreezeEntityPosition(trailer, false)

        Wait(150)
        AttachVehicleToTrailer(truck, trailer, 1.0)
    end

    SetVehicleHandbrake(truck, false)
    SetVehicleEngineOn(truck, true, true, false)
    JC.notify(exports.sunset_core:Translate('jobs.msg.teleported_rig_trailer_to', { label = tostring(label) }), 'success', 7000)
end

RegisterNetEvent('sunset:jobs:trucker:teleportRig', function(targetArg)
    teleportRig(targetArg)
end)

-- [JOBS AUDIT] /tptruck and /trucktp were registered CLIENT-side with no permission check, so any
-- player could teleport a loaded rig straight to the delivery for instant pay. They are now
-- server commands (admin level 3, see server/trucker.lua) that trigger the net event above.

RegisterNetEvent('sunset:jobs:sessionEnded', function(jobId)
    if jobId == 'trucker' or not jobId then
        clearTruckerCheckpoint()
        isManualDockingMode = false
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        clearTruckerCheckpoint()
    end
end)

-- ═══ TRUCKER DEPOT: HIDE STATIC MAPPING TRAILER PROPS ═══
-- Removes the 5 static map trailers (model 0x44AEA99C) so the bays are clean for job spawning.
local DEPOT_STATIC_TRAILERS = {
    { coords = vector3(1234.3, -3104.2, 4.8), model = 0x44AEA99C },
    { coords = vector3(1219.3, -3104.1, 4.8), model = 0x44AEA99C },
    { coords = vector3(1178.8, -3135.6, 4.6), model = 0x44AEA99C },
    { coords = vector3(1178.8, -3148.8, 4.6), model = 0x44AEA99C },
    { coords = vector3(1178.8, -3155.9, 4.6), model = 0x44AEA99C },
}

CreateThread(function()
    for _, prop in ipairs(DEPOT_STATIC_TRAILERS) do
        CreateModelHide(prop.coords.x, prop.coords.y, prop.coords.z, 10.0, prop.model, true)
        CreateModelHideExcludingScriptObjects(prop.coords.x, prop.coords.y, prop.coords.z, 10.0, prop.model, true)
    end

    while true do
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        -- Only scan when player is within 300m of the trucker depot
        if #(pos - vector3(1208.77, -3114.84, 5.54)) < 300.0 then
            for _, obj in ipairs(GetGamePool('CObject')) do
                if DoesEntityExist(obj) and (GetEntityModel(obj) & 0xFFFFFFFF) == (0x44AEA99C & 0xFFFFFFFF) then
                    local objCoords = GetEntityCoords(obj)
                    for _, prop in ipairs(DEPOT_STATIC_TRAILERS) do
                        if #(objCoords - prop.coords) < 8.0 then
                            SetEntityAsMissionEntity(obj, true, true)
                            DeleteObject(obj)
                            SetEntityCoords(obj, 0.0, 0.0, -500.0, false, false, false, false)
                        end
                    end
                end
            end
            Wait(1000)
        else
            Wait(5000)
        end
    end
end)
