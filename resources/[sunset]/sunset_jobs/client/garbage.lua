local JC = Sunset.JobClient

local bagProp = nil
local worldBag = nil
local carryAnimActive = false
local currentGarbageCheckpoint = nil

local function clearGarbageCheckpoint()
    if currentGarbageCheckpoint then
        DeleteCheckpoint(currentGarbageCheckpoint)
        currentGarbageCheckpoint = nil
    end
end

local function setGarbageCheckpoint(coords, r, g, b)
    clearGarbageCheckpoint()
    if not coords then return end
    local pos = vector3(coords.x, coords.y, coords.z)
    r, g, b = r or 46, g or 204, b or 113
    currentGarbageCheckpoint = CreateCheckpoint(47, pos.x, pos.y, pos.z, pos.x, pos.y, pos.z, 4.0, r, g, b, 180, 0)
    SetCheckpointCylinderHeight(currentGarbageCheckpoint, 5.0, 5.0, 4.0)
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

local function spawnWorldBag(pos)
    if worldBag and DoesEntityExist(worldBag) then
        DeleteObject(worldBag)
        worldBag = nil
    end
    if not pos then return end
    local model = joaat('prop_cs_rub_binbag_01')
    if not JC.loadModel(model) then return end
    worldBag = CreateObject(model, pos.x, pos.y, pos.z - 0.95, false, false, false)
    FreezeEntityPosition(worldBag, true)
    SetEntityCollision(worldBag, false, false)
    SetModelAsNoLongerNeeded(model)
end

local function pointToBin(cfg, bin, label)
    if not bin then return end
    local pos = vector3(bin.x, bin.y, bin.z)
    JC.clearBlips()
    JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.garbage_depot'))
    JC.addBlip(pos, { sprite = 318, color = 2, scale = 0.8 }, label or exports.sunset_core:Translate('jobs.msg.trash_bin'))
    JC.setWaypoint(pos)
    setGarbageCheckpoint(pos, 46, 204, 113)
end

local function getWorkTruck()
    local truck = JC.vehicles[1]
    if truck and DoesEntityExist(truck) then return truck end
    return nil
end

local function getTruckDumpPos(truck, cfg)
    local offset = (cfg and cfg.truckRearOffset) or -4.5
    return GetOffsetFromEntityInWorldCoords(truck, 0.0, offset, 0.0)
end

local function detachBag()
    carryAnimActive = false
    if bagProp and DoesEntityExist(bagProp) then
        DetachEntity(bagProp, true, true)
        DeleteObject(bagProp)
    end
    bagProp = nil
    ClearPedSecondaryTask(PlayerPedId())
end

local function attachBag()
    detachBag()
    local ped = PlayerPedId()
    local model = joaat('prop_cs_rub_binbag_01')
    if not JC.loadModel(model) then return end
    local coords = GetEntityCoords(ped)
    bagProp = CreateObject(model, coords.x, coords.y, coords.z, true, true, false)
    SetEntityCollision(bagProp, false, false)
    AttachEntityToEntity(
        bagProp, ped, GetPedBoneIndex(ped, 57005),
        0.12, 0.0, -0.05, 220.0, 120.0, 0.0,
        true, true, false, true, 1, true
    )
    SetModelAsNoLongerNeeded(model)

    carryAnimActive = true
    CreateThread(function()
        RequestAnimDict('anim@move_m@trash')
        local animDeadline = GetGameTimer() + 5000
        while not HasAnimDictLoaded('anim@move_m@trash') and GetGameTimer() < animDeadline do Wait(10) end
        if not HasAnimDictLoaded('anim@move_m@trash') then return end
        while carryAnimActive and JC.jobId == 'garbage' do
            local p = PlayerPedId()
            if not IsEntityPlayingAnim(p, 'anim@move_m@trash', 'walk', 3) then
                TaskPlayAnim(p, 'anim@move_m@trash', 'walk', 8.0, -8.0, -1, 49, 0, false, false, false)
            end
            Wait(500)
        end
    end)
end

-- [NETWORK FIX] Consolidated onto the shared JobClient.registerVehiclesWithServer
-- handshake (client-side networked gate + retryable/fatal taxonomy + bounded
-- backoff) instead of a duplicated blind retry loop.
local function registerTruckWithRetry(truck)
    if not truck or not DoesEntityExist(truck) then return false end
    local ok, err = JC.registerVehiclesWithServer()
    if ok then return true end
    JC.notify(err or exports.sunset_core:Translate('jobs.msg.could_not_register_work_truck_try'), 'error')
    return false
end

local function updateObjective(cfg, data)
    if not data then return end
    local title = exports.sunset_core:Translate('jobs.hud.garbage.title')
    local capacity = data.capacity or cfg.capacity or 8
    local collected = data.collected or 0
    local progress = { current = collected, total = capacity }
    if data.stage == 'return_unload' then
        JC.hud({ title = title, objective = exports.sunset_core:Translate('jobs.hud.garbage.unload'), progress = progress })
        return
    end
    if data.carrying then
        JC.hud({
            title = title,
            objective = exports.sunset_core:Translate('jobs.hud.garbage.dump'),
            progress = progress,
            keyHints = { { key = 'E', label = exports.sunset_core:Translate('jobs.hud.act.dump_trash') } },
        })
    else
        JC.hud({
            title = title,
            objective = exports.sunset_core:Translate('jobs.hud.garbage.bin', { index = data.binIndex or 1 }),
            progress = progress,
            keyHints = { { key = 'E', label = exports.sunset_core:Translate('jobs.hud.act.pickup_trash') } },
        })
    end
end

local function startGarbage()
    local data, err = Sunset.AwaitCallback('sunset:jobs:garbage:start')
    if not data then
        JC.notify(err or exports.sunset_core:Translate('jobs.msg.could_not_start_garbage_route'), 'error')
        return
    end

    local cfg = Sunset.GetJobConfig('garbage')
    JC.deleteVehicles()
    JC.clearBlips()
    JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.garbage_depot'))

    local truck = JC.spawnVehicle(cfg.truckModel, cfg.depot.spawn, true)
    if not truck then
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        return
    end
    if not registerTruckWithRetry(truck) then
        JC.deleteVehicles()
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        return
    end
    JC.monitorVehicles()
    JC.sessionData = data
    updateObjective(cfg, data)

    local firstBin = data.bins and data.bins[data.binIndex or 1]
    if firstBin then
        pointToBin(cfg, firstBin, exports.sunset_core:Translate('jobs.msg.trash_bin_1'))
    else
        JC.setWaypoint(cfg.depot.coords)
    end
    JC.notify(exports.sunset_core:Translate('jobs.msg.collect_bins_capacity', { capacity = tostring(data.capacity or 8) }), 'info')

    CreateThread(function()
        local busy = false
        while JC.jobId == 'garbage' and JC.state ~= 'IDLE' do
            local stage = JC.sessionData and JC.sessionData.stage
            local carrying = JC.sessionData and JC.sessionData.carrying

            if stage == 'collecting' and not carrying then
                local idx = JC.sessionData.binIndex or 1
                local bin = JC.sessionData.bins and JC.sessionData.bins[idx]
                if bin then
                    local pos = vector3(bin.x, bin.y, bin.z)
                    JC.drawMarker(pos, 46, 204, 113)
                    JC.hudDistance(pos)
                    if not worldBag or not DoesEntityExist(worldBag) then
                        spawnWorldBag(pos)
                    end
                    local nearBin = JC.isNear(pos, cfg.collectRadius or 3.0)
                    local onFoot = not IsPedInAnyVehicle(PlayerPedId(), false)
                    if nearBin and onFoot then
                        draw3DText(pos, exports.sunset_core:Translate('hint.jobs.garbage.pickup'))
                    end
                    if nearBin and onFoot and not busy and IsControlJustPressed(0, 38) then
                        busy = true
                        JC.playAnim('anim@heists@narcotics@trash', 'pickup', 2500)
                        local newData, err2 = Sunset.AwaitCallback('sunset:jobs:garbage:pickupBin')
                        busy = false
                        if newData then
                            JC.sessionData = newData
                            attachBag()
                            clearGarbageCheckpoint()
                            if worldBag and DoesEntityExist(worldBag) then
                                DeleteObject(worldBag)
                                worldBag = nil
                            end
                            updateObjective(cfg, newData)
                            JC.notify(exports.sunset_core:Translate('jobs.message.take_the_bag_to_the_back_of_your_truck'), 'info')
                        else
                            JC.notify(err2 or exports.sunset_core:Translate('jobs.msg.could_not_pick_up_trash_from'), 'error')
                        end
                    end
                end
            elseif stage == 'collecting' and carrying then
                local truck = getWorkTruck()
                if truck then
                    local dumpPos = getTruckDumpPos(truck, cfg)
                    JC.drawMarker(dumpPos, 255, 180, 0)
                    JC.hudDistance(dumpPos)
                    local nearDump = JC.isNear(dumpPos, cfg.dumpRadius or 3.5)
                    local onFoot = not IsPedInAnyVehicle(PlayerPedId(), false)
                    if nearDump and onFoot then
                        draw3DText(dumpPos, exports.sunset_core:Translate('hint.jobs.garbage.dump'))
                    end
                    if nearDump and onFoot and not busy and IsControlJustPressed(0, 38) then
                        busy = true
                        JC.playAnim('anim@heists@narcotics@trash', 'drop_front', 2000)
                        local truckNetId = NetworkGetNetworkIdFromEntity(truck)
                        local newData, err2 = Sunset.AwaitCallback('sunset:jobs:garbage:dumpBin', truckNetId)
                        busy = false
                        if newData then
                            detachBag()
                            JC.sessionData = newData
                            JC.addEarned(cfg.payPerBin or 65)
                            JC.notify(exports.sunset_core:Translate('jobs.msg.collected', { collected = math.floor(tonumber(newData.collected) or 0), capacity = math.floor(tonumber(newData.capacity) or 0), pay_per_bin = tostring(cfg.payPerBin or 65) }), 'success')
                            updateObjective(cfg, newData)
                            if newData.stage == 'return_unload' then
                                local unload = cfg.depot.unload or cfg.depot.coords
                                JC.clearBlips()
                                JC.addBlip(cfg.depot.coords, cfg.depot.blip, exports.sunset_core:Translate('jobs.msg.garbage_depot'))
                                JC.setWaypoint(unload)
                                setGarbageCheckpoint(unload, 52, 152, 219)
                                JC.notify(exports.sunset_core:Translate('jobs.message.truck_full_return_to_depot_to_unload'), 'info')
                            else
                                local nextBin = newData.bins and newData.bins[newData.binIndex or 1]
                                pointToBin(cfg, nextBin, exports.sunset_core:Translate('jobs.msg.trash_bin_2', { bin_index = tostring(newData.binIndex or 1) }))
                            end
                        else
                            JC.notify(err2 or exports.sunset_core:Translate('jobs.msg.could_not_dump_the_bag_at'), 'error')
                        end
                    end
                else
                    JC.notify(exports.sunset_core:Translate('jobs.message.your_trash_truck_is_missing'), 'error')
                end
            elseif stage == 'return_unload' then
                local unload = cfg.depot.unload or cfg.depot.coords
                JC.drawMarker(unload, 52, 152, 219)
                JC.hudDistance(unload)
                if JC.isNear(unload, 8.0) and IsPedInAnyVehicle(PlayerPedId(), false) then
                    draw3DText(unload, exports.sunset_core:Translate('jobs.msg.drive_in_to_unload'))
                end
                if JC.isNear(unload, 8.0) and IsPedInAnyVehicle(PlayerPedId(), false) and not busy then
                    busy = true
                    local result, err2 = Sunset.AwaitCallback('sunset:jobs:garbage:unload')
                    busy = false
                    if result then
                        clearGarbageCheckpoint()
                        detachBag()
                        JC.deleteVehicles()
                        JC.addEarned(result.bonus or 0)
                        JC.notify(exports.sunset_core:Translate('jobs.msg.shift_complete_unload_bonus', { bonus = tostring(result.bonus or 0) }), 'success')
                        break
                    elseif err2 then
                        JC.notify(err2, 'error')
                        -- [JOBS AUDIT] failed unload retried every frame (server callback + notify spam)
                        Wait(2500)
                    end
                end
            end
            Wait(0)
        end
        clearGarbageCheckpoint()
        detachBag()
    end)
end

local function clearWorldBag()
    if worldBag and DoesEntityExist(worldBag) then
        DeleteObject(worldBag)
    end
    worldBag = nil
end

RegisterNetEvent('sunset:jobs:sessionEnded', function(jobId)
    if jobId ~= 'garbage' then return end
    clearGarbageCheckpoint()
    detachBag()
    clearWorldBag() -- [JOBS AUDIT] the world bag prop at the next bin leaked on cancel/death/fail
end)

-- [JOBS AUDIT] carried bag, world bag and route checkpoint survived a resource restart.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    clearGarbageCheckpoint()
    detachBag()
    clearWorldBag()
end)

Sunset.Jobs.StartGarbage = startGarbage
