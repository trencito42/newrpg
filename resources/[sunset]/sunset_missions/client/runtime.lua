-- Active mission state machine
local activeSession   = nil
local activeBlips     = {}
local activeZoneBlip  = nil
local cargoObject     = nil
local missionVehicle  = nil
local conditionPct    = 100
local escaped         = false

local function addBlip(coords, sprite, color, name, scale)
    local b = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(b, sprite or 1)
    SetBlipColour(b, color or 2)
    SetBlipScale(b, scale or 0.8)
    SetBlipAsShortRange(b, false)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentString(name or '')
    EndTextCommandSetBlipName(b)
    activeBlips[#activeBlips+1] = b
    return b
end

local function clearBlips()
    for _, b in ipairs(activeBlips) do RemoveBlip(b) end
    activeBlips = {}
    if activeZoneBlip then RemoveBlip(activeZoneBlip) activeZoneBlip = nil end
end

local function notify(msg, kind)
    exports.sunset_ui:Notify(msg, kind or 'info')
end

local function setStage(stage)
    if not activeSession then return end
    local ok, err = Sunset.AwaitCallback('sunset:missions:setStage', { mission = activeSession.missionId, stage = stage })
    if ok then
        activeSession.state = stage
    else
        print('[sunset_missions] setStage fail: ' .. tostring(err))
    end
end

-- ── Hot Wheels / vehicle_recovery ────────────────────────────────────────────
local function runVehicleRecovery(session)
    local def     = SunsetMissions.GetMission('vehicle_recovery')
    local variant = session.variant
    local zone    = def.searchZones[variant.searchZone]

    -- SEARCH_AREA
    setStage('SEARCH_AREA')
    local spawnCoords = variant.spawnCoords
    missionVehicle = MSN_SpawnVehicle(variant.vehicleModel, spawnCoords, variant.vehicleColor)
    if missionVehicle then
        SetVehicleNumberPlateText(missionVehicle, variant.vehiclePlate)
    end

    activeZoneBlip = AddBlipForRadius(zone.center.x, zone.center.y, zone.center.z, zone.radius)
    SetBlipColour(activeZoneBlip, 83)
    SetBlipAlpha(activeZoneBlip, 100)

    MSN_NUI_ShowHUD(
        ('Search %s for the vehicle'):format(zone.label),
        variant.vehicleLabel,
        { plate = ('...%s'):format(variant.vehiclePlate:sub(-3)), color = variant.vehicleColor.name }
    )

    -- wait for player to get near vehicle
    local located = false
    while not located do
        Wait(500)
        if not activeSession then return end
        if missionVehicle and DoesEntityExist(missionVehicle) then
            local pPos  = GetEntityCoords(PlayerPedId())
            local vPos  = GetEntityCoords(missionVehicle)
            if #(pPos - vPos) < SunsetMissions.Config.vehicleDetectRadius then
                located = true
            end
        end
    end

    -- LOCATE_VEHICLE
    setStage('LOCATE_VEHICLE')
    RemoveBlip(activeZoneBlip)
    activeZoneBlip = nil
    addBlip(GetEntityCoords(missionVehicle), 225, 1, variant.vehicleLabel, 0.7)
    MSN_NUI_UpdateHUD('Vehicle located — steal it', variant.vehicleLabel,
        { plate = variant.vehiclePlate, color = variant.vehicleColor.name })
    notify('Vehicle located!', 'success')

    -- STEAL_VEHICLE — wait for player to enter vehicle
    setStage('STEAL_VEHICLE')
    local inVehicle = false
    while not inVehicle do
        Wait(300)
        if not activeSession then return end
        local ped    = PlayerPedId()
        local curVeh = GetVehiclePedIsIn(ped, false)
        if curVeh ~= 0 and curVeh == missionVehicle then
            inVehicle = true
        end
    end

    clearBlips()
    addBlip(def.deliveryCoords, 1, 2, 'Delivery Point', 0.8)
    MSN_NUI_UpdateHUD('Deliver the vehicle — avoid damage', variant.vehicleLabel, { plate = variant.vehiclePlate })
    SetGpsPlayerWaypoint(def.deliveryCoords.x, def.deliveryCoords.y)
    notify('Deliver the vehicle to Rico!', 'info')

    -- PURSUIT after 5 seconds
    local pursuitDef = { pursuitVehicle = def.pursuitVehicle, pursuitPeds = def.pursuitPeds, pursuitCount = def.pursuitCount }
    CreateThread(function()
        Wait(5000)
        if activeSession and activeSession.state == 'PURSUIT' then
            MSN_StartPursuit(pursuitDef, variant)
            MSN_NUI_UpdateHUD('Deliver the vehicle — lose the tail!', variant.vehicleLabel)
        end
    end)
    setStage('PURSUIT')

    -- condition monitor
    CreateThread(function()
        while activeSession and (activeSession.state == 'PURSUIT' or activeSession.state == 'DELIVER') do
            Wait(2000)
            if missionVehicle and DoesEntityExist(missionVehicle) then
                local body   = GetVehicleBodyHealth(missionVehicle)
                local engine = GetVehicleEngineHealth(missionVehicle)
                conditionPct = math.floor(((body / 1000.0) * 0.6 + (engine / 1000.0) * 0.4) * 100)
                MSN_NUI_UpdateHUD(nil, nil, { condition = conditionPct })
            end
        end
    end)

    -- wait near delivery
    local delivered = false
    while not delivered do
        Wait(500)
        if not activeSession then return end
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        local dst = #(pos - vector3(def.deliveryCoords.x, def.deliveryCoords.y, def.deliveryCoords.z))
        if dst < SunsetMissions.Config.deliveryRadius + 10 then
            delivered = true
        end
    end

    -- DELIVER
    setStage('DELIVER')
    MSN_NUI_UpdateHUD('Park the vehicle inside the marker', nil, { condition = conditionPct })
    escaped = not MSN_StopPursuit and true or true

    -- E to confirm
    while activeSession and activeSession.state == 'DELIVER' do
        Wait(100)
        local ped    = PlayerPedId()
        local curVeh = GetVehiclePedIsIn(ped, false)
        if curVeh ~= 0 and curVeh == missionVehicle then
            local pos = GetEntityCoords(ped)
            local dst = #(pos - vector3(def.deliveryCoords.x, def.deliveryCoords.y, def.deliveryCoords.z))
            if dst < SunsetMissions.Config.deliveryRadius + 10 then
                exports.sunset_ui:Notify('[E] Deliver vehicle', 'info')
                if IsControlJustReleased(0, 38) then
                    local ok, err = Sunset.AwaitCallback('sunset:missions:vr:deliver', { condition = conditionPct, escaped = escaped })
                    if not ok then
                        notify(err or 'Could not confirm delivery', 'error')
                    end
                    break
                end
            end
        end
        Wait(0)
    end
end

-- ── Container 47 ─────────────────────────────────────────────────────────────
local function runContainer47(session)
    local def     = SunsetMissions.GetMission('container_47')
    local variant = session.variant
    local alertShown = 0

    -- Spawn guards
    MSN_SpawnGuards(def.guardPatrols, function(level)
        Sunset.AwaitCallback('sunset:missions:c47:updateAlert', level)
        if level > alertShown then
            alertShown = level
            local msgs = {
                [1] = '~y~Guards are suspicious',
                [2] = '~o~Guards are investigating',
                [3] = '~r~ALERT — combat!',
                [4] = '~r~REINFORCEMENTS incoming!',
            }
            notify(msgs[level] or '', 'warning')
            if level == 4 then
                MSN_SpawnVehicle(def.reinforcementVehicle, def.reinforcementCoords)
            end
        end
    end)

    -- ENTER_PORT
    setStage('ENTER_PORT')
    addBlip(def.portEnterCoords, 1, 5, 'Enter Port', 0.8)
    SetGpsPlayerWaypoint(def.portEnterCoords.x, def.portEnterCoords.y)
    MSN_NUI_ShowHUD('Enter the terminal port', nil, { row = variant.targetRow, id = '???47' })

    while activeSession and activeSession.state == 'ENTER_PORT' do
        Wait(400)
        local pos = GetEntityCoords(PlayerPedId())
        if #(pos - def.portEnterCoords) < def.portEnterRadius then
            setStage('SEARCH')
            break
        end
    end

    -- SEARCH — inspect containers
    clearBlips()
    MSN_NUI_UpdateHUD(
        ('Find container in row %s'):format(variant.targetRow),
        ('Plate ending: ...%s'):format(variant.targetId and variant.targetId:sub(-2) or '47'),
        { row = variant.targetRow }
    )

    local containerPeds = {}
    for _, loc in ipairs(def.containerLocations) do
        addBlip(vector3(loc.coords.x, loc.coords.y, loc.coords.z), 1, 4, loc.id, 0.5)
        containerPeds[#containerPeds+1] = { coords = loc.coords, id = loc.id }
    end

    local identified = false
    while not identified do
        Wait(100)
        if not activeSession then return end
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        for _, cp in ipairs(containerPeds) do
            local dst = #(pos - vector3(cp.coords.x, cp.coords.y, cp.coords.z))
            if dst < 2.5 then
                exports.sunset_ui:Notify(('[E] Inspect container %s'):format(cp.id), 'info')
                if IsControlJustReleased(0, 38) then
                    if cp.id == variant.targetContainer then
                        identified = true
                        notify('Match found — ' .. cp.id, 'success')
                        setStage('IDENTIFY')
                        clearBlips()
                        MSN_RaiseAlert(1)
                    else
                        notify(cp.id .. ' — Not a match', 'warning')
                        MSN_RaiseAlert(1)
                    end
                end
            end
        end
    end

    -- BREAK_SEAL
    MSN_NUI_UpdateHUD('Break the container seal', variant.targetContainer)
    exports.sunset_ui:Notify('[E] Cut the seal', 'info')
    local waitingSeal = true
    while waitingSeal do
        Wait(100)
        if not activeSession then return end
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        local tgt = vector3(variant.targetCoords.x, variant.targetCoords.y, variant.targetCoords.z)
        if #(pos - tgt) < 3.5 then
            if IsControlJustReleased(0, 38) then
                setStage('BREAK_SEAL')
                MSN_NUI_ShowSeal(function(success)
                    if success then
                        TriggerEvent('sunset:missions:client:sealBroken')
                    else
                        MSN_RaiseAlert(2)
                        notify('Seal broken noisily — guards alerted!', 'error')
                        TriggerEvent('sunset:missions:client:sealBroken')
                    end
                end)
                waitingSeal = false
            end
        end
    end

    -- wait for seal result
    local sealDone = false
    AddEventHandler('sunset:missions:client:sealBroken', function()
        sealDone = true
    end)
    while not sealDone do Wait(200) end

    -- TAKE_CARGO
    setStage('TAKE_CARGO')
    MSN_NUI_UpdateHUD('Take the cargo', variant.targetContainer)
    local tgtCoords = vector3(variant.targetCoords.x, variant.targetCoords.y, variant.targetCoords.z)

    local cargoTaken = false
    while not cargoTaken do
        Wait(100)
        if not activeSession then return end
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        if #(pos - tgtCoords) < 3.5 then
            exports.sunset_ui:Notify('[E] Take cargo', 'info')
            if IsControlJustReleased(0, 38) then
                cargoObject = MSN_SpawnProp(def.cargoModel, vector3(pos.x, pos.y, pos.z + 1.0))
                if cargoObject then MSN_AttachCargo(cargoObject, ped) end
                MSN_RaiseAlert(2)
                setStage('ALERT')
                cargoTaken = true
                notify('Cargo taken — get out!', 'warning')
            end
        end
    end

    -- ESCAPE
    setStage('ESCAPE')
    clearBlips()
    local exitIdx = math.random(#def.exitPoints)
    local exit    = def.exitPoints[exitIdx]
    addBlip(exit.coords, 1, 1, exit.label, 0.8)
    SetGpsPlayerWaypoint(exit.coords.x, exit.coords.y)
    MSN_NUI_UpdateHUD(('Escape via %s'):format(exit.label), 'Leave the port with the cargo')

    while activeSession and activeSession.state == 'ESCAPE' do
        Wait(400)
        local pos = GetEntityCoords(PlayerPedId())
        if #(pos - exit.coords) < 18.0 then
            setStage('DELIVER')
            break
        end
    end

    -- DELIVER cargo
    clearBlips()
    addBlip(def.deliveryCoords, 1, 2, 'Delivery', 0.8)
    SetGpsPlayerWaypoint(def.deliveryCoords.x, def.deliveryCoords.y)
    MSN_NUI_UpdateHUD('Deliver the cargo to Hank', nil)

    local delivered47 = false
    while not delivered47 do
        Wait(200)
        if not activeSession then return end
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        if #(pos - vector3(def.deliveryCoords.x, def.deliveryCoords.y, def.deliveryCoords.z)) < SunsetMissions.Config.deliveryRadius + 10 then
            exports.sunset_ui:Notify('[E] Deliver cargo', 'info')
            if IsControlJustReleased(0, 38) then
                local ok, err = Sunset.AwaitCallback('sunset:missions:c47:deliver', {})
                if not ok then
                    notify(err or 'Could not confirm delivery', 'error')
                else
                    delivered47 = true
                end
            end
        end
    end
end

-- ── Mission complete event (from server) ──────────────────────────────────────
AddEventHandler('sunset:missions:complete', function(data)
    MSN_NUI_ShowComplete(data)
    clearBlips()
    ClearGpsPlayerWaypoint()
    MSN_StopPursuit()
    MSN_CleanupGuards()
    if cargoObject then MSN_DeleteEntity(cargoObject) cargoObject = nil end
    if missionVehicle and DoesEntityExist(missionVehicle) then
        SetEntityAsMissionEntity(missionVehicle, false, true)
        DeleteEntity(missionVehicle)
        missionVehicle = nil
    end
    activeSession = nil
end)

AddEventHandler('sunset:missions:client:completeClose', function()
    MSN_NUI_HideAll()
    MSN_CleanupAllEntities()
end)

-- ── Public: start session from main ──────────────────────────────────────────
function MSN_StartMissionRuntime(missionId, sessionData)
    if activeSession then return end
    activeSession = { missionId = missionId, state = 'BRIEFING', variant = sessionData.variant }

    CreateThread(function()
        if missionId == 'vehicle_recovery' then
            runVehicleRecovery(activeSession)
        elseif missionId == 'container_47' then
            runContainer47(activeSession)
        end
    end)
end

function MSN_AbortMission(reason)
    if not activeSession then return end
    Sunset.AwaitCallback('sunset:missions:abandon')
    clearBlips()
    ClearGpsPlayerWaypoint()
    MSN_StopPursuit()
    MSN_CleanupGuards()
    MSN_CleanupAllEntities()
    MSN_NUI_HideAll()
    activeSession = nil
    exports.sunset_ui:Notify(reason or 'Mission abandoned', 'error')
end

function MSN_ActiveSession()
    return activeSession
end
