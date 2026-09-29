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

local function updateObjective(cfg, data)
    if not data then return end
    local total = data.total or 1
    local delivered = data.delivered or 0
    local pct = math.floor((delivered / math.max(total, 1)) * 100)
    local idx = math.min(data.deliveryIndex or (delivered + 1), total)

    if data.stage == 'loading' then
        showCourierUi('route', {
            counter = ('%d packages'):format(total),
            message = 'Load the van at the warehouse',
            detail = 'Go to the loading dock and press E',
            progress = 0,
        })
    elseif data.stage == 'delivering' then
        local target = data.deliveries and data.deliveries[idx]
        showCourierUi('route', {
            counter = ('Package %d/%d'):format(delivered + 1, total),
            message = 'Follow GPS to delivery',
            detail = target and target.label or 'Delivery address',
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
    JC.clearBlips()
    JC.addBlip(cfg.warehouse.coords, cfg.warehouse.blip, 'Courier Depot')
    JC.sessionData = data

    -- Spawn delivery van near the warehouse
    local vehicleModel = cfg.vehicleModel or 'speedo2'
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

    -- Point player to warehouse loading dock to load packages
    JC.setWaypoint(cfg.warehouse.coords)
    setCourierCheckpoint(cfg.warehouse.coords, 255, 180, 0)
    updateObjective(cfg, data)
    JC.notify(('Load all %d packages at the warehouse, then deliver them'):format(data.total or 0), 'info')

    CreateThread(function()
        local busy = false
        while JC.jobId == 'courier' and JC.state ~= 'IDLE' do
            local session = JC.sessionData
            local stage = session and session.stage

            -- Stage 1: load all packages at warehouse
            if stage == 'loading' then
                local warehousePos = cfg.warehouse.coords
                local loadRadius = cfg.loadingRadius or 6.0
                JC.drawMarker(warehousePos, 255, 180, 0)
                local onFoot = not IsPedInAnyVehicle(PlayerPedId(), false)
                local nearWarehouse = JC.isNear(warehousePos, loadRadius)
                if nearWarehouse and onFoot then
                    draw3DText(warehousePos, '[E] Load Packages')
                    if not busy and IsControlJustPressed(0, 38) then
                        busy = true
                        showCourierUi('working', {
                            counter = ('%d packages'):format(session.total or 0),
                            message = 'Loading packages into the van',
                            detail = 'Preparing delivery manifest',
                            progress = 0,
                        }, true)
                        JC.playAnim('anim@heists@box_carry@', 'idle', 2500)
                        local newData, err2 = Sunset.AwaitCallback('sunset:jobs:courier:loadPackages')
                        busy = false
                        if newData then
                            JC.sessionData = newData
                            -- Attach package prop on the player
                            attachPackage(cfg)
                            -- Point to first delivery
                            local firstTarget = newData.deliveries and newData.deliveries[1]
                            if firstTarget then
                                pointToDelivery(cfg, firstTarget, 'Delivery 1: ' .. (firstTarget.label or ''))
                            end
                            updateObjective(cfg, newData)
                            JC.notify(('Van loaded! Deliver all %d packages.'):format(newData.total or 0), 'success')
                        else
                            JC.notify(err2 or 'Could not load packages', 'error')
                            courierUiKey = nil
                        end
                    end
                elseif nearWarehouse and not onFoot then
                    showCourierUi('blocked', {
                        counter = ('%d packages'):format(session and session.total or 0),
                        message = 'Exit the vehicle',
                        detail = 'Load the packages on foot',
                        progress = 0,
                    })
                else
                    updateObjective(cfg, session)
                end

            -- Stage 2: deliver each package
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
                        -- Detach while driving (prop would clip through car)
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
