local activeSession  = nil
local activeBlips    = {}
local activeZoneBlip = nil
local cargoObject    = nil
local missionVehicle = nil
local conditionPct   = 100

local function showHelp(text)
    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayHelp(0, false, true, -1)
end

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

local function notify(msg, kind) exports.sunset_ui:Notify(msg, kind or 'info') end

local function setStage(stage)
    if not activeSession then return end
    local ok, err = Sunset.AwaitCallback('sunset:missions:setStage', { mission = activeSession.missionId, stage = stage })
    if ok then activeSession.state = stage
    else print('[sunset_missions] setStage fail: ' .. tostring(err)) end
end

-- Spawn target vehicle on the closest road node inside the search zone
local function spawnTargetVehicle(def, variant)
    local zone     = def.searchZones[variant.searchZone]
    local angle    = math.random() * 2 * math.pi
    local r        = math.random(30, math.floor(zone.radius * 0.7))
    local sx, sy   = zone.center.x + r * math.cos(angle), zone.center.y + r * math.sin(angle)
    local found, nx, ny, nz, nh = GetClosestVehicleNodeWithHeading(sx, sy, zone.center.z, 0, 3.0, 0)
    if not found then nx, ny, nz, nh = sx, sy, zone.center.z, math.random(0, 359) end

    local veh = MSN_SpawnVehicle(variant.vehicleModel, { x = nx, y = ny, z = nz, w = nh }, variant.vehicleColor)
    if veh then
        SetVehicleNumberPlateText(veh, variant.vehiclePlate)
        -- Lock vehicle so lockpick is required
        SetVehicleDoorsLocked(veh, 2)
    end
    return veh, vector3(nx, ny, nz)
end

-- ── Hot Wheels ────────────────────────────────────────────────────────────────
local function runVehicleRecovery(session)
    local def     = SunsetMissions.GetMission('vehicle_recovery')
    local variant = session.variant
    local zone    = def.searchZones[variant.searchZone]

    setStage('SEARCH_AREA')
    local spawnedVeh, spawnCoords = spawnTargetVehicle(def, variant)
    missionVehicle = spawnedVeh

    activeZoneBlip = AddBlipForRadius(zone.center.x, zone.center.y, zone.center.z, zone.radius)
    SetBlipColour(activeZoneBlip, 83)
    SetBlipAlpha(activeZoneBlip, 100)

    MSN_NUI_ShowHUD(
        ('Search %s for the vehicle'):format(zone.label),
        variant.vehicleLabel,
        { plate = ('...%s'):format(variant.vehiclePlate:sub(-3)), color = variant.vehicleColor.name }
    )

    -- Wait for player to get within detect radius
    while activeSession do
        Wait(500)
        if missionVehicle and DoesEntityExist(missionVehicle) then
            local pPos = GetEntityCoords(PlayerPedId())
            local vPos = GetEntityCoords(missionVehicle)
            if #(pPos - vPos) < SunsetMissions.Config.vehicleDetectRadius then break end
        end
    end
    if not activeSession then return end

    -- LOCATE_VEHICLE
    setStage('LOCATE_VEHICLE')
    RemoveBlip(activeZoneBlip) activeZoneBlip = nil
    addBlip(GetEntityCoords(missionVehicle), 225, 1, variant.vehicleLabel, 0.7)
    MSN_NUI_UpdateHUD('Vehicle located — steal it', variant.vehicleLabel,
        { plate = variant.vehiclePlate, color = variant.vehicleColor.name })
    notify('Vehicle located!', 'success')

    -- STEAL_VEHICLE — wait near vehicle, trigger lockpick, then enter
    setStage('STEAL_VEHICLE')
    MSN_NUI_UpdateHUD('Break in and steal the vehicle', variant.vehicleLabel)

    -- Lockpick phase: player must approach and use E
    local lockpickDone = false
    local lockpickSuccess = false

    while activeSession and not lockpickDone do
        Wait(0)
        if missionVehicle and DoesEntityExist(missionVehicle) then
            local pPos  = GetEntityCoords(PlayerPedId())
            local vPos  = GetEntityCoords(missionVehicle)
            local dist  = #(pPos - vPos)
            if dist < 4.0 then
                showHelp('Press ~INPUT_CONTEXT~ to pick the lock')
                if IsControlJustReleased(0, 38) then
                    -- pause world updates and show minigame
                    MSN_NUI_ShowLockpick(function(success)
                        lockpickSuccess = success
                        lockpickDone    = true
                        if success then
                            SetVehicleDoorsLocked(missionVehicle, 1)
                            notify('Lock picked! Get in the vehicle.', 'success')
                        else
                            -- Lockpick failed → alarm
                            SetVehicleAlarm(missionVehicle, true)
                            StartVehicleAlarm(missionVehicle)
                            notify('Lockpick failed — alarm triggered!', 'error')
                            SetVehicleDoorsLocked(missionVehicle, 1)
                            lockpickDone = true
                        end
                    end)
                end
            end
        end
    end
    if not activeSession then return end

    -- Wait for player to enter the vehicle
    local inVehicle = false
    while activeSession and not inVehicle do
        Wait(300)
        local ped    = PlayerPedId()
        local curVeh = GetVehiclePedIsIn(ped, false)
        if curVeh ~= 0 and curVeh == missionVehicle then
            inVehicle = true
        end
    end
    if not activeSession then return end

    clearBlips()
    addBlip(def.deliveryCoords, 1, 2, 'Delivery Point', 0.8)
    MSN_NUI_UpdateHUD('Deliver the vehicle — avoid damage', variant.vehicleLabel, { plate = variant.vehiclePlate })
    SetNewWaypoint(def.deliveryCoords.x, def.deliveryCoords.y)
    notify('Deliver the vehicle to Rico!', 'info')

    -- PURSUIT — spawns 5 seconds after entering vehicle
    setStage('PURSUIT')
    local pursuitDef = { pursuitVehicle = def.pursuitVehicle, pursuitPeds = def.pursuitPeds, pursuitCount = def.pursuitCount }
    CreateThread(function()
        Wait(5000)
        if activeSession and (activeSession.state == 'PURSUIT' or activeSession.state == 'DELIVER') then
            MSN_StartPursuit(pursuitDef, variant)
            MSN_NUI_UpdateHUD('Deliver the vehicle — lose the tail!', variant.vehicleLabel)
        end
    end)

    -- Condition monitor
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

    -- Wait until player is near delivery
    while activeSession do
        Wait(500)
        local pos = GetEntityCoords(PlayerPedId())
        if #(pos - vector3(def.deliveryCoords.x, def.deliveryCoords.y, def.deliveryCoords.z)) < SunsetMissions.Config.deliveryRadius + 10 then
            break
        end
    end
    if not activeSession then return end

    setStage('DELIVER')
    MSN_NUI_UpdateHUD('Park inside the marker and deliver', nil, { condition = conditionPct })

    while activeSession and activeSession.state == 'DELIVER' do
        Wait(0)
        local ped    = PlayerPedId()
        local curVeh = GetVehiclePedIsIn(ped, false)
        local pos    = GetEntityCoords(ped)
        local dst    = #(pos - vector3(def.deliveryCoords.x, def.deliveryCoords.y, def.deliveryCoords.z))
        if curVeh ~= 0 and curVeh == missionVehicle and dst < SunsetMissions.Config.deliveryRadius + 10 then
            showHelp('Press ~INPUT_CONTEXT~ to deliver the vehicle')
            if IsControlJustReleased(0, 38) then
                -- escaped = pursuit was spawned AND all pursuers are gone
                local wasEscaped = MSN_PursuitEscaped()
                local ok, err = Sunset.AwaitCallback('sunset:missions:vr:deliver',
                    { condition = conditionPct, escaped = wasEscaped })
                if not ok then notify(err or 'Could not confirm delivery', 'error') end
                break
            end
        end
    end
end

-- ── Container 47 ─────────────────────────────────────────────────────────────
local function runContainer47(session)
    local def     = SunsetMissions.GetMission('container_47')
    local variant = session.variant
    local alertShown = 0

    MSN_SpawnGuards(def.guardPatrols, function(level)
        Sunset.AwaitCallback('sunset:missions:c47:updateAlert', level)
        if level > alertShown then
            alertShown = level
            local msgs = { [1]='~y~Guards are suspicious', [2]='~o~Guards are investigating',
                           [3]='~r~ALERT — combat!', [4]='~r~REINFORCEMENTS incoming!' }
            notify(msgs[level] or '', 'warning')
            if level == 4 then
                local rveh = MSN_SpawnVehicle(def.reinforcementVehicle, def.reinforcementCoords)
                if rveh then
                    -- spawn 2 armed cops inside
                    for seat = -1, 0 do
                        local pHash = GetHashKey('s_m_y_sheriff_01')
                        RequestModel(pHash)
                        local t = 0
                        while not HasModelLoaded(pHash) do Wait(50) t=t+50 if t>5000 then break end end
                        local cp = CreatePedInsideVehicle(rveh, 4, pHash, seat, false, false)
                        if cp ~= 0 then
                            SetEntityAsMissionEntity(cp, true, true)
                            GiveWeaponToPed(cp, GetHashKey('WEAPON_CARBINERIFLE'), 200, false, true)
                            SetCurrentPedWeapon(cp, GetHashKey('WEAPON_CARBINERIFLE'), true)
                            if seat ~= -1 then
                                TaskVehicleShootAtPed(cp, PlayerPedId(), 5.0)
                            end
                        end
                        SetModelAsNoLongerNeeded(pHash)
                    end
                end
            end
        end
    end)

    -- ENTER_PORT
    setStage('ENTER_PORT')
    addBlip(def.portEnterCoords, 1, 5, 'Enter Port', 0.8)
    SetNewWaypoint(def.portEnterCoords.x, def.portEnterCoords.y)
    MSN_NUI_ShowHUD('Enter the terminal port', nil, { row = variant.targetRow, id = '???47' })

    while activeSession and activeSession.state == 'ENTER_PORT' do
        Wait(400)
        if #(GetEntityCoords(PlayerPedId()) - def.portEnterCoords) < def.portEnterRadius then
            setStage('SEARCH') break
        end
    end
    if not activeSession then return end

    -- SEARCH
    clearBlips()
    MSN_NUI_UpdateHUD(('Find container in row %s'):format(variant.targetRow), nil, { row = variant.targetRow })

    local containerPoints = {}
    for _, loc in ipairs(def.containerLocations) do
        addBlip(vector3(loc.coords.x, loc.coords.y, loc.coords.z), 1, 4, loc.id, 0.5)
        containerPoints[#containerPoints+1] = { coords = loc.coords, id = loc.id }
    end

    local identified = false
    while activeSession and not identified do
        Wait(0)
        local pos = GetEntityCoords(PlayerPedId())
        for _, cp in ipairs(containerPoints) do
            local dst = #(pos - vector3(cp.coords.x, cp.coords.y, cp.coords.z))
            if dst < 2.5 then
                showHelp(('Press ~INPUT_CONTEXT~ to inspect %s'):format(cp.id))
                if IsControlJustReleased(0, 38) then
                    if cp.id == variant.targetContainer then
                        identified = true
                        notify('Match found — ' .. cp.id, 'success')
                        setStage('IDENTIFY')
                        clearBlips()
                        MSN_RaiseAlert(1)
                    else
                        notify(cp.id .. ' — not a match', 'warning')
                        MSN_RaiseAlert(1)
                    end
                end
            end
        end
    end
    if not activeSession then return end

    -- BREAK_SEAL
    MSN_NUI_UpdateHUD('Cut the container seal', variant.targetContainer)
    local tgtCoords = vector3(variant.targetCoords.x, variant.targetCoords.y, variant.targetCoords.z)
    local waitingSeal = true
    while activeSession and waitingSeal do
        Wait(0)
        if #(GetEntityCoords(PlayerPedId()) - tgtCoords) < 3.5 then
            showHelp('Press ~INPUT_CONTEXT~ to cut the seal')
            if IsControlJustReleased(0, 38) then
                setStage('BREAK_SEAL')
                waitingSeal = false
                MSN_NUI_ShowSeal(function(success)
                    if success then
                        notify('Seal cut — take the cargo!', 'success')
                    else
                        MSN_RaiseAlert(2)
                        notify('Seal broken noisily — guards alerted!', 'error')
                    end
                    TriggerEvent('sunset:missions:client:sealBroken')
                end)
            end
        end
    end

    local sealDone = false
    AddEventHandler('sunset:missions:client:sealBroken', function() sealDone = true end)
    while activeSession and not sealDone do Wait(200) end
    if not activeSession then return end

    -- TAKE_CARGO
    setStage('TAKE_CARGO')
    MSN_NUI_UpdateHUD('Take the cargo', variant.targetContainer)

    local cargoTaken = false
    while activeSession and not cargoTaken do
        Wait(0)
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        if #(pos - tgtCoords) < 3.5 then
            showHelp('Press ~INPUT_CONTEXT~ to take the cargo')
            if IsControlJustReleased(0, 38) then
                cargoObject = MSN_SpawnProp(def.cargoModel, vector3(pos.x, pos.y, pos.z + 1.0))
                if cargoObject then MSN_AttachCargo(cargoObject, ped) end
                MSN_RaiseAlert(2)
                setStage('ALERT')
                cargoTaken = true
                notify('Cargo taken — get out now!', 'warning')
            end
        end
    end
    if not activeSession then return end

    -- ESCAPE
    setStage('ESCAPE')
    clearBlips()
    local exitIdx = math.random(#def.exitPoints)
    local exit    = def.exitPoints[exitIdx]
    addBlip(exit.coords, 1, 1, exit.label, 0.8)
    SetNewWaypoint(exit.coords.x, exit.coords.y)
    MSN_NUI_UpdateHUD(('Escape via %s'):format(exit.label), 'Leave the port with the cargo')

    while activeSession and activeSession.state == 'ESCAPE' do
        Wait(400)
        if #(GetEntityCoords(PlayerPedId()) - exit.coords) < 18.0 then
            setStage('DELIVER') break
        end
    end
    if not activeSession then return end

    -- DELIVER
    clearBlips()
    addBlip(def.deliveryCoords, 1, 2, 'Delivery', 0.8)
    SetNewWaypoint(def.deliveryCoords.x, def.deliveryCoords.y)
    MSN_NUI_UpdateHUD('Deliver the cargo to Hank', nil)

    while activeSession do
        Wait(0)
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        if #(pos - vector3(def.deliveryCoords.x, def.deliveryCoords.y, def.deliveryCoords.z)) < SunsetMissions.Config.deliveryRadius + 10 then
            showHelp('Press ~INPUT_CONTEXT~ to deliver the cargo')
            if IsControlJustReleased(0, 38) then
                local ok, err = Sunset.AwaitCallback('sunset:missions:c47:deliver', {})
                if not ok then
                    notify(err or 'Could not confirm delivery', 'error')
                end
                break
            end
        end
    end
end

-- ── Mission complete (from server) ────────────────────────────────────────────
AddEventHandler('sunset:missions:complete', function(data)
    MSN_NUI_ShowComplete(data)
    clearBlips()
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

function MSN_StartMissionRuntime(missionId, sessionData)
    if activeSession then return end
    activeSession = { missionId = missionId, state = 'BRIEFING', variant = sessionData.variant }
    conditionPct  = 100

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
    MSN_StopPursuit()
    MSN_CleanupGuards()
    MSN_CleanupAllEntities()
    MSN_NUI_HideAll()
    activeSession  = nil
    missionVehicle = nil
    cargoObject    = nil
    exports.sunset_ui:Notify(reason or 'Mission abandoned', 'error')
end

function MSN_ActiveSession()
    return activeSession
end
