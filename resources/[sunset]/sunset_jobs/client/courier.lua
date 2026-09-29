local JC = Sunset.JobClient

local packageProp = nil
local carryAnimActive = false
local courierUiKey = nil
local currentCourierCheckpoint = nil

local function clearCourierCheckpoint()
    if currentCourierCheckpoint then
        DeleteCheckpoint(currentCourierCheckpoint)
        currentCourierCheckpoint = nil
    end
end

local function setCourierCheckpoint(coords, r, g, b)
    clearCourierCheckpoint()
    if not coords then return end
    local pos = vector3(coords.x, coords.y, coords.z)
    r, g, b = r or 46, g or 204, b or 113
    currentCourierCheckpoint = CreateCheckpoint(47, pos.x, pos.y, pos.z, pos.x, pos.y, pos.z, 5.0, r, g, b, 180, 0)
    SetCheckpointCylinderHeight(currentCourierCheckpoint, 5.0, 5.0, 5.0)
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

local function hideCourierUi()
    courierUiKey = nil
    exports.sunset_ui:Send('courierHide', {})
end

local function showCourierUi(state, data, force)
    data = data or {}
    data.state = state
    data.title = data.title or 'Courier'
    local key = table.concat({ state or '', data.counter or '', data.message or '', data.detail or '',
        tostring(data.progress or 0), data.key or '' }, '|')
    if not force and courierUiKey == key then return end
    courierUiKey = key
    exports.sunset_ui:Send('courierShow', data)
end

local function pointToDelivery(cfg, target, label)
    if not target then return end
    local pos = vector3(target.coords.x, target.coords.y, target.coords.z)
    JC.clearBlips()
    JC.addBlip(cfg.warehouse.coords, cfg.warehouse.blip, 'Courier Depot')
    JC.addBlip(pos, { sprite = 478, color = 3, scale = 0.85 }, label or 'Delivery')
    JC.setWaypoint(pos)
    setCourierCheckpoint(pos, 46, 204, 113)
end

local function detachPackage()
    carryAnimActive = false
    if packageProp and DoesEntityExist(packageProp) then
        DetachEntity(packageProp, true, true)
        DeleteObject(packageProp)
    end
    packageProp = nil
    ClearPedSecondaryTask(PlayerPedId())
end

local function attachPackage(cfg)
    if packageProp and DoesEntityExist(packageProp) then return true end
    local ped = PlayerPedId()
    local modelName = (cfg and cfg.packageProp) or 'prop_cs_cardbox_01'
    local model = joaat(modelName)
    if not JC.loadModel(model) then return false end
    local coords = GetEntityCoords(ped)
    packageProp = CreateObject(model, coords.x, coords.y, coords.z, true, true, false)
    SetEntityCollision(packageProp, false, false)
    AttachEntityToEntity(
        packageProp, ped, GetPedBoneIndex(ped, 60309),
        0.025, 0.08, 0.255, -145.0, 290.0, 0.0,
        true, true, false, true, 1, true
    )
    SetModelAsNoLongerNeeded(model)

    carryAnimActive = true
    CreateThread(function()
        RequestAnimDict('anim@heists@box_carry@')
        while not HasAnimDictLoaded('anim@heists@box_carry@') do Wait(10) end
        while carryAnimActive and JC.jobId == 'courier' do
            local p = PlayerPedId()
            if JC.sessionData and JC.sessionData.hasPackage then
                if not IsEntityPlayingAnim(p, 'anim@heists@box_carry@', 'idle', 3) then
                    TaskPlayAnim(p, 'anim@heists@box_carry@', 'idle', 8.0, -8.0, -1, 49, 0, false, false, false)
                end
            end
            Wait(500)
        end
    end)
    return true
end

local function getWorkVan()
    local van = JC.vehicles[1]
    if van and DoesEntityExist(van) then return van end
    return nil
end

local function getVanRearCoords(van, cfg)
    local offset = (cfg and cfg.vanRearOffset) or -3.2
    return GetOffsetFromEntityInWorldCoords(van, 0.0, offset, 0.0)
end

local function updateObjective(cfg, data)
    if not data then return end
    local total = data.total or 6
    local delivered = data.delivered or 0
    local loaded = data.loaded or 0
    local pct = math.floor((delivered / math.max(total, 1)) * 100)
    local idx = math.min(data.deliveryIndex or (delivered + 1), total)

    if data.stage == 'loading' then
        if data.carryingPackage then
            showCourierUi('working', {
                counter = ('Loading %d/%d'):format(loaded + 1, total),
                message = 'Carry package to your van',
                detail = 'Go to the rear doors and press [E]',
                progress = math.floor((loaded / total) * 100),
            })
        else
            showCourierUi('route', {
                counter = ('Loaded %d/%d'):format(loaded, total),
                message = 'Pick up parcel from loading dock',
                detail = 'Go to the package stack and press [E]',
                progress = math.floor((loaded / total) * 100),
            })
        end
    elseif data.stage == 'delivering' then
        local target = data.deliveries and data.deliveries[idx]
        showCourierUi('route', {
            counter = ('Package %d/%d'):format(delivered + 1, total),
            message = 'Follow GPS to delivery address',
            detail = target and target.label or 'Customer location',
            progress = pct,
        })
    end
end

local function startCourier()
    local data, err = Sunset.AwaitCallback('sunset:jobs:courier:start')
    if not data then
        JC.notify(err or 'Could not start courier shift', 'error')
        return
    end

    local cfg = Sunset.GetJobConfig('courier')
    JC.deleteVehicles()
    JC.clearBlips()
    JC.addBlip(cfg.warehouse.coords, cfg.warehouse.blip, 'Courier Depot')
    JC.sessionData = data

    -- Spawn delivery van at parking lot
    local vehicleModel = cfg.vehicleModel or 'speedo'
    local vehicleSpawn = cfg.vehicleSpawn or cfg.warehouse.coords
    local van = JC.spawnVehicle(vehicleModel, vehicleSpawn, true)
    if not van then
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        JC.notify('Could not spawn the delivery van — try again', 'error')
        return
    end
    local ok, registerErr = JC.registerVehiclesWithServer()
    if not ok then
        JC.deleteVehicles()
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        JC.notify(registerErr or 'Could not register van', 'error')
        return
    end
    JC.monitorVehicles()

    -- Point player to loading bay
    local pickupPos = cfg.packagePickup or cfg.warehouse.coords
    local pickupV3 = type(pickupPos) == 'vector4' and vector3(pickupPos.x, pickupPos.y, pickupPos.z) or pickupPos
    JC.setWaypoint(pickupV3)
    setCourierCheckpoint(pickupV3, 255, 180, 0)
    updateObjective(cfg, data)
    JC.notify(('Load all %d parcels into your van at the loading dock.'):format(data.total or 6), 'info')

    CreateThread(function()
        local busy = false
        while JC.jobId == 'courier' and JC.state ~= 'IDLE' do
            local session = JC.sessionData
            local stage = session and session.stage
            local carrying = session and session.carryingPackage

            -- Stage 1: Load packages at warehouse loading dock
            if stage == 'loading' then
                local onFoot = not IsPedInAnyVehicle(PlayerPedId(), false)

                if not carrying then
                    -- Sub-step A: Pick up parcel from pallet / stack
                    JC.drawMarker(pickupV3, 255, 180, 0)
                    local nearPickup = JC.isNear(pickupV3, cfg.loadingRadius or 3.5)
                    if nearPickup and onFoot then
                        draw3DText(pickupV3, ('[E] Pick Up Package (%d/%d loaded)'):format(session.loaded or 0, session.total or 6))
                        if not busy and IsControlJustPressed(0, 38) then
                            busy = true
                            JC.playAnim('anim@heists@box_carry@', 'idle', 1200)
                            local newData, err2 = Sunset.AwaitCallback('sunset:jobs:courier:pickupWarehousePackage')
                            busy = false
                            if newData then
                                JC.sessionData = newData
                                attachPackage(cfg)
                                updateObjective(cfg, newData)
                                JC.notify('Take the parcel to the back doors of your van.', 'info')
                            else
                                JC.notify(err2 or 'Could not pick up package', 'error')
                            end
                        end
                    elseif nearPickup and not onFoot then
                        showCourierUi('blocked', {
                            counter = ('%d/%d'):format(session.loaded or 0, session.total or 6),
                            message = 'Exit the vehicle',
                            detail = 'Pick up packages on foot',
                            progress = 0,
                        })
                    else
                        updateObjective(cfg, session)
                    end

                else
                    -- Sub-step B: Load carried parcel into rear of van
                    local workVan = getWorkVan()
                    if workVan then
                        local rearPos = getVanRearCoords(workVan, cfg)
                        JC.drawMarker(rearPos, 46, 204, 113)
                        local nearRear = JC.isNear(rearPos, cfg.dumpRadius or 3.8)
                        if nearRear and onFoot then
                            draw3DText(rearPos, '[E] Load Package into Van')
                            if not busy and IsControlJustPressed(0, 38) then
                                busy = true
                                JC.playAnim('anim@heists@narcotics@trash', 'drop_front', 1500)
                                local vanNetId = NetworkGetNetworkIdFromEntity(workVan)
                                local newData, err2 = Sunset.AwaitCallback('sunset:jobs:courier:loadPackageIntoVan', vanNetId)
                                busy = false
                                if newData then
                                    JC.sessionData = newData
                                    detachPackage()
                                    if newData.stage == 'delivering' then
                                        clearCourierCheckpoint()
                                        local firstTarget = newData.deliveries and newData.deliveries[1]
                                        if firstTarget then
                                            pointToDelivery(cfg, firstTarget, 'Delivery 1: ' .. (firstTarget.label or ''))
                                        end
                                        updateObjective(cfg, newData)
                                        JC.notify(('Van fully loaded with %d packages! Drive to delivery locations.'):format(newData.total or 6), 'success')
                                    else
                                        updateObjective(cfg, newData)
                                        JC.notify(('Package loaded (%d/%d). Pick up the next package.'):format(newData.loaded or 0, newData.total or 6), 'success')
                                    end
                                else
                                    JC.notify(err2 or 'Could not load package into van', 'error')
                                end
                            end
                        end
                    else
                        JC.notify('Your delivery van is missing', 'error')
                    end
                end

            -- Stage 2: Deliver each package to customer addresses
            elseif stage == 'delivering' then
                local idx = session.deliveryIndex or 1
                local target = session.deliveries and session.deliveries[idx]
                if target then
                    local pos = vector3(target.coords.x, target.coords.y, target.coords.z)
                    JC.drawMarker(pos, 46, 204, 113)
                    local onFoot = not IsPedInAnyVehicle(PlayerPedId(), false)
                    local nearDelivery = JC.isNear(pos, cfg.deliveryRadius or 3.0)
                    local total = session.total or 1
                    local pct = math.floor(((session.delivered or 0) / math.max(total, 1)) * 100)

                    -- Re-attach package prop when player exits vehicle near delivery
                    if onFoot and session.hasPackage then
                        attachPackage(cfg)
                    elseif not onFoot then
                        detachPackage()
                    end

                    if nearDelivery and onFoot then
                        draw3DText(pos, '[E] Deliver Package')
                        if not busy and IsControlJustPressed(0, 38) then
                            busy = true
                            showCourierUi('working', {
                                counter = ('Package %d/%d'):format(idx, total),
                                message = 'Handing over package',
                                detail = target.label or 'Delivery address',
                                progress = pct,
                            }, true)
                            JC.playAnim('anim@heists@narcotics@trash', 'drop_front', 2000)
                            local result, err2 = Sunset.AwaitCallback('sunset:jobs:courier:deliver')
                            busy = false
                            if result then
                                detachPackage()
                                local newDelivered = (session.delivered or 0) + 1
                                JC.notify(('Delivered +$%d (%d/%d)'):format(result.pay or 0, newDelivered, total), 'success')
                                if result.completed then
                                    clearCourierCheckpoint()
                                    showCourierUi('complete', {
                                        counter = ('Package %d/%d'):format(total, total),
                                        message = 'Route complete!',
                                        detail = 'All packages delivered successfully',
                                        progress = 100,
                                    }, true)
                                    Wait(2000)
                                    JC.deleteVehicles()
                                    JC.clearBlips()
                                    JC.hideObjective()
                                    break
                                else
                                    JC.sessionData = result.data
                                    local nextIdx = result.data.deliveryIndex or 1
                                    local nextTarget = result.data.deliveries and result.data.deliveries[nextIdx]
                                    if nextTarget then
                                        pointToDelivery(cfg, nextTarget,
                                            ('Delivery %d: '):format(nextIdx) .. (nextTarget.label or ''))
                                    end
                                    updateObjective(cfg, result.data)
                                end
                            else
                                JC.notify(err2 or 'Could not deliver the package', 'error')
                                courierUiKey = nil
                            end
                        end
                    elseif nearDelivery and not onFoot then
                        draw3DText(pos, '[E] Deliver Package')
                        JC.showHelp('Exit the vehicle to deliver the package')
                    else
                        updateObjective(cfg, session)
                    end
                end
            end
            Wait(0)
        end
        clearCourierCheckpoint()
        detachPackage()
        hideCourierUi()
        JC.hideObjective()
    end)
end

RegisterNetEvent('sunset:jobs:sessionEnded', function(jobId)
    if jobId ~= 'courier' then return end
    clearCourierCheckpoint()
    detachPackage()
    hideCourierUi()
end)

Sunset.Jobs.StartCourier = startCourier
