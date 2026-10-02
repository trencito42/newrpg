local NO_SEATBELT_CLASSES = { [8] = true, [13] = true, [14] = true, [15] = true, [16] = true }
local NO_DOOR_LOCK_CLASSES = { [13] = true }
local NO_ENGINE_CLASSES = { [13] = true }

local function vehicleClassOf(veh)
    if not veh or veh == 0 then return -1 end
    return GetVehicleClass(veh)
end

local function supportsSeatbelt(veh)
    return not NO_SEATBELT_CLASSES[vehicleClassOf(veh)]
end

local function supportsDoorLock(veh)
    return not NO_DOOR_LOCK_CLASSES[vehicleClassOf(veh)]
end

local function supportsEngineControl(veh)
    return not NO_ENGINE_CLASSES[vehicleClassOf(veh)]
end

local locked = false
local lightMode = 0 -- 0 off, 1 low, 2 high

local function boolNative(value)
    return value == true or value == 1
end

-- SetVehicleLights(2) forces always-on and during daytime GTA shows high beams
-- before low beams. Mode 3 behaves like normal dipped/main beam control.
local function readLightMode(veh)
    if not veh or veh == 0 then return 0 end
    local _, lightsOn, highbeamsOn = GetVehicleLightsState(veh)
    if not boolNative(lightsOn) then return 0 end
    if boolNative(highbeamsOn) then return 2 end
    return 1
end

local function applyLightMode(veh, mode)
    if not veh or veh == 0 then return end
    if mode == 0 then
        SetVehicleFullbeam(veh, false)
        SetVehicleLights(veh, 1)
        return
    end
    SetVehicleLights(veh, 3)
    SetVehicleFullbeam(veh, mode == 2)
end
local currentVeh = 0
local fuel = 100.0
local spawnedOwnedVehicles = {}
local protectedVehicles = {}

local function normalizePlate(plate)
    return (plate or ''):gsub('%s+', ''):upper()
end

local function isTrackedOwnedVehicle(veh)
    if not veh or veh == 0 then return false end
    for _, tracked in pairs(spawnedOwnedVehicles) do
        if tracked == veh then return true end
    end
    return false
end

local function trackSpawnedOwned(plate, vehicle)
    local key = normalizePlate(plate)
    if key == '' or not vehicle or vehicle == 0 then return end
    spawnedOwnedVehicles[key] = vehicle
end

local function untrackSpawnedOwned(vehOrPlate)
    if type(vehOrPlate) == 'number' then
        for plate, veh in pairs(spawnedOwnedVehicles) do
            if veh == vehOrPlate then
                spawnedOwnedVehicles[plate] = nil
                return
            end
        end
        return
    end
    spawnedOwnedVehicles[normalizePlate(vehOrPlate)] = nil
end

local function getNearestTrackedOwned(maxDist)
    local ped = PlayerPedId()
    local pCoords = GetEntityCoords(ped)
    local best, bestDist = nil, maxDist or 30.0
    for _, veh in pairs(spawnedOwnedVehicles) do
        if DoesEntityExist(veh) then
            local dist = #(pCoords - GetEntityCoords(veh))
            if dist <= bestDist then
                best = veh
                bestDist = dist
            end
        end
    end
    return best
end

local function forEachTrackedOwned(fn)
    for plate, veh in pairs(spawnedOwnedVehicles) do
        if DoesEntityExist(veh) then
            fn(plate, veh)
        else
            spawnedOwnedVehicles[plate] = nil
        end
    end
end
local lastBodyHealth = 1000.0
local lastVehSpeed = 0.0
local spawnGraceUntil = 0
local engineEnabled = {}
local lastEjectAt = 0
local odometerKm = 0.0
local odometerPlate = nil
local lastOdoCoords = nil
local vehicleProps = {}
local lastFuelTickAt = nil

-- GTA fuel natives use liters (0..fPetrolTankVolume), not 0–100%. We track percent for HUD/DB.
local function getNativeTankVolume(veh)
    if not veh or veh == 0 then return 60.0 end
    local vol = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fPetrolTankVolume')
    if vol and vol > 0.01 then return vol end
    return Sunset.GetVehicleTankCapacityLiters(GetVehicleClass(veh))
end

local function readFuelPercent(veh)
    if not veh or veh == 0 then return fuel end
    local cap = getNativeTankVolume(veh)
    if cap <= 0 then return 0 end
    return math.max(0, math.min(100, GetVehicleFuelLevel(veh) / cap * 100.0))
end

local function writeFuelPercent(veh, percent)
    if not veh or veh == 0 then return end
    local cap = getNativeTankVolume(veh)
    local liters = math.max(0, math.min(cap, (tonumber(percent) or 0) / 100.0 * cap))
    SetVehicleFuelLevel(veh, liters)
end

-- RP-friendly ejection: hard crashes only (not every bump)
local EJECT_PARAMS = { 48.0, 52.0, 17.0, 1200.0 }
local NO_EJECT_PARAMS = { 10000.0, 10000.0, 17.0, 0.0 }

local function getVeh()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        return GetVehiclePedIsIn(ped, false)
    end
    return 0
end

local function isDriver()
    local veh = getVeh()
    return veh ~= 0 and GetPedInVehicleSeat(veh, -1) == PlayerPedId()
end

local function isPassenger()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return false end
    return GetPedInVehicleSeat(GetVehiclePedIsIn(ped, false), -1) ~= ped
end

local function buildStoreProps(veh)
    local props = {}
    for key, value in pairs(vehicleProps or {}) do props[key] = value end
    props.odometer = math.floor(odometerKm * 10) / 10
    if veh and veh ~= 0 then props.model = GetEntityModel(veh) end
    if GetResourceState('sunset_tuning') == 'started' then
        local ok, ecu = pcall(function() return exports.sunset_tuning:ExportTuneForStore(veh) end)
        if ok and ecu then props.ecu = ecu end
    end
    return props
end

local function decodeVehicleProps(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) ~= 'string' or raw == '' then return nil end
    local ok, props = pcall(json.decode, raw)
    if ok and type(props) == 'table' then return props end
    return nil
end

local function notify(msg, type)
    exports.sunset_ui:Notify(msg, type or 'info')
end

local function showVehicleHint(id)
    local engineOn = false
    local veh = getVeh()
    if veh ~= 0 then
        if engineEnabled[veh] ~= nil then
            engineOn = engineEnabled[veh] == true
        else
            engineOn = GetIsVehicleEngineRunning(veh)
        end
    end
    local lights = { 'hud.lights_off', 'hud.lights_low', 'hud.lights_high' }
    local lightTones = { 'off', 'low', 'high' }
    local mode = lightMode or 0
    local rows = {
        engine = { labelKey = engineOn and 'hud.engine_on' or 'hud.engine_off', key = '2', ok = engineOn, tone = engineOn and 'on' or 'off' },
        lock = { labelKey = locked and 'hud.locked' or 'hud.unlocked', key = 'U', ok = not locked, tone = locked and 'off' or 'on' },
        seatbelt = { labelKey = seatbelt and 'hud.seatbelt_on' or 'hud.seatbelt_off', key = 'K', ok = seatbelt, tone = seatbelt and 'on' or 'off' },
        lights = { labelKey = lights[mode + 1] or 'hud.lights_off', key = 'H', ok = mode > 0, tone = lightTones[mode + 1] or 'off' },
    }
    exports.sunset_ui:Send('vehicleHint', { id = id, rows = rows })
end

local function resetOdometerTracking(plate, km, props)
    odometerPlate = plate and normalizePlate(plate) or nil
    odometerKm = math.max(0, tonumber(km) or 0)
    vehicleProps = type(props) == 'table' and props or {}
    lastOdoCoords = nil
end

local function tickOdometer(veh)
    if not veh or veh == 0 then return end
    local coords = GetEntityCoords(veh)
    if lastOdoCoords then
        local delta = #(coords - lastOdoCoords)
        if delta > 0.02 and delta < 120.0 then
            odometerKm = odometerKm + (delta / 1000.0)
        end
    end
    lastOdoCoords = coords
end

local function blocked()
    if IsNuiFocused() or IsPauseMenuActive() then return true end
    local ok, open = pcall(function()
        return exports.sunset_chat:IsChatOpen()
    end)
    return ok and open == true
end

local function driverOnly()
    if isPassenger() then
        notify(exports.sunset_core:Translate('vehicles.message.only_the_driver_can_do_that'), 'error')
        return false
    end
    return true
end

local function syncLockState(veh)
    if veh == 0 then return end
    local state = GetVehicleDoorLockStatus(veh)
    locked = state == 2 or state == 3 or state == 4
end

-- ═══ LOCK (U / /lock) ═══
local function plateOf(veh)
    return (GetVehicleNumberPlateText(veh) or ''):gsub('%s+', ''):upper()
end

local function hasKeysFor(veh)
    if veh == 0 then return false end
    if isTrackedOwnedVehicle(veh) then return true end
    local ok = Sunset.AwaitCallback('sunset:hasVehicleKeys', plateOf(veh))
    return ok == true
end

local function toggleVehicleLock()
    if blocked() then return end
    local ped = PlayerPedId()
    local veh = getVeh()
    if veh == 0 then
        local coords = GetEntityCoords(ped)
        veh = GetClosestVehicle(coords.x, coords.y, coords.z, 5.0, 0, 0)
    end
    if veh == 0 then return notify(exports.sunset_core:Translate('vehicles.message.no_vehicle_nearby'), 'error') end
    if not supportsDoorLock(veh) then
        return notify(exports.sunset_core:Translate('vehicles.message.this_vehicle_cannot_be_locked'), 'error')
    end
    CreateThread(function()
        if not hasKeysFor(veh) then
            return notify(exports.sunset_core:Translate('vehicles.message.you_do_not_have_keys_for_this_vehicle'), 'error')
        end
        syncLockState(veh)
        locked = not locked
        SetVehicleDoorsLocked(veh, locked and 2 or 1)
        SetVehicleDoorsLockedForPlayer(veh, PlayerId(), false)
        showVehicleHint('lock')
    end)
end

RegisterCommand('sunset_lock', function()
    toggleVehicleLock()
end, false)
RegisterCommand('lock', function()
    toggleVehicleLock()
end, false)
RegisterKeyMapping('sunset_lock', 'Lock vehicle', 'keyboard', 'U')

-- ═══ SEATBELT (K) ═══
RegisterCommand('sunset_seatbelt', function()
    if blocked() then return end
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return end
    local veh = GetVehiclePedIsIn(ped, false)
    if not supportsSeatbelt(veh) then
        return notify(exports.sunset_core:Translate('vehicles.message.this_vehicle_has_no_seatbelt'), 'error')
    end
    seatbelt = not seatbelt
    showVehicleHint('seatbelt')
end, false)
RegisterKeyMapping('sunset_seatbelt', 'Seatbelt', 'keyboard', 'K')

-- ═══ ENGINE (2) ═══
RegisterCommand('sunset_engine', function()
    if blocked() then return end
    if not driverOnly() then return end
    local veh = getVeh()
    if veh == 0 then return end
    if not supportsEngineControl(veh) then
        return notify(exports.sunset_core:Translate('vehicles.message.this_vehicle_has_no_engine_to_toggle'), 'error')
    end
    local on = engineEnabled[veh] ~= true
    engineEnabled[veh] = on
    SetVehicleEngineOn(veh, on, true, true)
    SetVehicleKeepEngineOnWhenAbandoned(veh, on)
    showVehicleHint('engine')
end, false)
RegisterKeyMapping('sunset_engine', 'Motor on/off', 'keyboard', '2')

AddEventHandler('sunset:vehicles:setEngineState', function(veh, enabled)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return end
    engineEnabled[veh] = enabled == true
    SetVehicleEngineOn(veh, enabled == true, true, true)
    SetVehicleKeepEngineOnWhenAbandoned(veh, enabled == true)
end)

-- ═══ LIGHTS (H) — off → low → high ═══
RegisterCommand('sunset_lights', function()
    if blocked() then return end
    if not driverOnly() then return end
    local veh = getVeh()
    if veh == 0 then return end
    if vehicleClassOf(veh) == 13 then
        return notify(exports.sunset_core:Translate('vehicles.message.this_vehicle_has_no_headlights'), 'error')
    end

    lightMode = (lightMode + 1) % 3
    applyLightMode(veh, lightMode)
    showVehicleHint('lights')
end, false)
RegisterKeyMapping('sunset_lights', 'Vehicle lights', 'keyboard', 'H')

local function applySeatbeltPhysics(ped, veh)
    if not supportsSeatbelt(veh) then
        SetPedConfigFlag(ped, 32, true)
        SetFlyThroughWindscreenParams(EJECT_PARAMS[1], EJECT_PARAMS[2], EJECT_PARAMS[3], EJECT_PARAMS[4])
        return
    end
    if seatbelt then
        SetPedConfigFlag(ped, 32, false)
        SetFlyThroughWindscreenParams(NO_EJECT_PARAMS[1], NO_EJECT_PARAMS[2], NO_EJECT_PARAMS[3], NO_EJECT_PARAMS[4])
    else
        SetPedConfigFlag(ped, 32, true)
        SetFlyThroughWindscreenParams(EJECT_PARAMS[1], EJECT_PARAMS[2], EJECT_PARAMS[3], EJECT_PARAMS[4])
    end
end

CreateThread(function()
    local previousVehicle = 0
    local previousSpeed = 0.0
    local previousBody = 1000.0

    while true do
        local ped = PlayerPedId()
        if IsPedInAnyVehicle(ped, false) then
            local veh = GetVehiclePedIsIn(ped, false)
            local driver = GetPedInVehicleSeat(veh, -1) == ped
            SetPedConfigFlag(ped, 184, true)
            if driver and engineEnabled[veh] == nil then
                engineEnabled[veh] = GetIsVehicleEngineRunning(veh) == true
                SetVehicleKeepEngineOnWhenAbandoned(veh, engineEnabled[veh] == true)
            elseif driver and engineEnabled[veh] == false then
                SetVehicleEngineOn(veh, false, true, true)
                SetVehicleKeepEngineOnWhenAbandoned(veh, false)
            elseif driver and engineEnabled[veh] == true then
                SetVehicleEngineOn(veh, true, true, true)
                SetVehicleKeepEngineOnWhenAbandoned(veh, true)
            end

            syncLockState(veh)
            if not supportsSeatbelt(veh) then seatbelt = false end
            applySeatbeltPhysics(ped, veh)

            local speed = GetEntitySpeed(veh)
            local body = GetVehicleBodyHealth(veh)
            if previousVehicle == veh and not seatbelt and GetGameTimer() - lastEjectAt > 3000 then
                local class = GetVehicleClass(veh)
                local canEject = class ~= 8 and class ~= 13 and class ~= 14 and class ~= 15 and class ~= 16
                -- [FIX] Relaxed thresholds: frontal crashes decelerate over several
                -- ticks, so a single-tick delta of 10 m/s was almost never met.
                local hardStop = previousSpeed >= 13.0 and (previousSpeed - speed) >= 6.0
                local collisionDamage = previousBody - body >= 5.0
                if canEject and hardStop and collisionDamage then
                    lastEjectAt = GetGameTimer()
                    local forward = GetEntityForwardVector(veh)
                    local pos = GetEntityCoords(ped)
                    SetEntityCoordsNoOffset(ped, pos.x + forward.x * 1.8, pos.y + forward.y * 1.8,
                        pos.z + 0.35, true, true, true)
                    SetEntityVelocity(ped, forward.x * previousSpeed * 0.75,
                        forward.y * previousSpeed * 0.75, 2.5)
                    SetPedToRagdoll(ped, 1500, 3500, 0, true, true, false)
                    notify(exports.sunset_core:Translate('vehicles.message.you_were_thrown_from_the_vehicle_because_you_were'), 'error')
                end
            end
            previousVehicle = veh
            previousSpeed = speed
            previousBody = body
            Wait(0)
        else
            seatbelt = false
            locked = false
            lightMode = 0
            lastBodyHealth = 1000.0
            lastVehSpeed = 0.0
            previousVehicle = 0
            previousSpeed = 0.0
            previousBody = 1000.0
            Wait(500)
        end
    end
end)

-- Persist fuel/damage while an owned vehicle is being driven, not only when it
-- is manually stored. This limits rollback after disconnects or crashes.
CreateThread(function()
    while true do
        Wait(30000)
        local veh = getVeh()
        if veh ~= 0 and isDriver() and isTrackedOwnedVehicle(veh) and DoesEntityExist(veh) then
            local plate = (GetVehicleNumberPlateText(veh) or ''):gsub('%s+', ''):upper()
            Sunset.AwaitCallback('sunset:syncOwnedVehicleState', VehToNet(veh),
                plate, fuel, odometerKm)
        end
    end
end)

local function computeFuelDrainPerSecond(veh)
    local profiles = Sunset.VehicleProfiles or {}
    local class = GetVehicleClass(veh)
    local model = GetEntityModel(veh)
    local litersPerHour = Sunset.GetVehicleFuelLitersPerHour(model, class)

    if litersPerHour <= 0 or not GetIsVehicleEngineRunning(veh) then return 0 end

    local tuning = profiles.consumption or {}
    local rpm = math.max(0.0, math.min(1.0, GetVehicleCurrentRpm(veh)))
    local speedKmh = GetEntitySpeed(veh) * 3.6
    local tankLiters = getNativeTankVolume(veh)
    if tankLiters <= 0 then return 0 end

    local load
    if speedKmh <= 1.0 and rpm < 0.30 then
        load = tuning.idleLoad or 0.07
    else
        local speedReference = tuning.speedReferenceKmh or 160.0
        local speedFactor = math.min(speedKmh / speedReference, 1.0)
        local throttle = math.max(0.0, math.min(1.0, GetControlNormal(0, 71)))
        local redlineStart = tuning.redlineStart or 0.72
        local redlineRange = math.max(0.01, 1.0 - redlineStart)
        local redline = math.max(0.0, (rpm - redlineStart) / redlineRange)

        load = (tuning.baseLoad or 0.45)
            + (rpm ^ 1.7) * (tuning.rpmLoad or 0.75)
            + speedFactor * (tuning.speedLoad or 0.25)
            + throttle * (tuning.throttleLoad or 0.35)
            + (redline ^ 2) * (tuning.redlineLoad or 1.25)
    end

    local litersPerSecond = (litersPerHour / 3600.0) * load
    return (litersPerSecond / tankLiters) * 100.0
end

local function applyCollisionDamage(veh)
    if GetGameTimer() < spawnGraceUntil then
        lastBodyHealth = GetVehicleBodyHealth(veh)
        lastVehSpeed = GetEntitySpeed(veh)
        return
    end
    local body = GetVehicleBodyHealth(veh)
    local speed = GetEntitySpeed(veh)
    local bodyLoss = lastBodyHealth - body
    local speedDrop = lastVehSpeed - speed

    if bodyLoss > 8.0 and (lastVehSpeed > 8.0 or speedDrop > 4.0) then
        local profile = Sunset.GetVehicleDamageProfile(GetEntityModel(veh), GetVehicleClass(veh))
        local engineScale = profile.engine or 1.0
        local bodyScale = profile.body or 1.0
        local scaledLoss = bodyLoss * engineScale * bodyScale * 0.45
        if scaledLoss > 0.5 then
            local eng = GetVehicleEngineHealth(veh)
            SetVehicleEngineHealth(veh, math.max(150.0, eng - scaledLoss))
        end
    end

    lastBodyHealth = body
    lastVehSpeed = speed
end

CreateThread(function()
    while true do
        local veh = getVeh()
        if veh ~= 0 and isDriver() then
            if veh ~= currentVeh then
                currentVeh = veh
                lastFuelTickAt = GetGameTimer()
                fuel = readFuelPercent(veh)
                writeFuelPercent(veh, fuel)
                lastBodyHealth = GetVehicleBodyHealth(veh)
                lastVehSpeed = GetEntitySpeed(veh)
                local plate = normalizePlate(GetVehicleNumberPlateText(veh))
                if plate ~= odometerPlate then
                    local ownedState = Sunset.AwaitCallback('sunset:getDrivenOwnedVehicleState', VehToNet(veh), plate)
                    local props = ownedState and decodeVehicleProps(ownedState.props) or nil
                    resetOdometerTracking(plate, props and props.odometer or 0, props)
                    if ownedState then trackSpawnedOwned(plate, veh) end
                end
                lastOdoCoords = GetEntityCoords(veh)
                lightMode = readLightMode(veh)
            end

            applyCollisionDamage(veh)
            if isTrackedOwnedVehicle(veh) then
                tickOdometer(veh)
            end

            local now = GetGameTimer()
            local elapsedSeconds = lastFuelTickAt and math.min(2.0, math.max(0.0, (now - lastFuelTickAt) / 1000.0)) or 0.0
            lastFuelTickAt = now
            local class = GetVehicleClass(veh)
            local fuelExempt = class == 14 or class == 15 or class == 16
            if not fuelExempt then
                local drain = computeFuelDrainPerSecond(veh) * elapsedSeconds
                if drain > 0 then
                    fuel = math.max(0, fuel - drain)
                    writeFuelPercent(veh, fuel)
                end
                if fuel <= 0.05 then SetVehicleEngineOn(veh, false, false, true) end
            end
            Wait(1000)
        else
            currentVeh = 0
            lastFuelTickAt = nil
            lastOdoCoords = nil
            Wait(500)
        end
    end
end)

function GetVehicleTelemetry(targetVeh)
    local veh = targetVeh or getVeh()
    if not veh or veh == 0 or not DoesEntityExist(veh) then return nil end

    local rawRpm = GetVehicleCurrentRpm(veh)
    local speedKmh = math.floor(GetEntitySpeed(veh) * 3.6 + 0.5)
    local gear = GetVehicleCurrentGear(veh)
    local engineOn = engineEnabled[veh] == true
    local throttle = GetControlNormal(0, 71)
    local brake = GetControlNormal(0, 72)
    local displayRpm = 0.0
    if engineOn and not (throttle > 0.4 and brake > 0.4 and speedKmh < 3) then
        displayRpm = math.max(0.0, math.min(1.0, (rawRpm - 0.2) / 0.8))
    end

    return {
        veh = veh,
        rawRpm = rawRpm,
        displayRpm = displayRpm,
        speedKmh = speedKmh,
        gear = gear,
        throttle = throttle,
        brake = brake,
        engineOn = engineOn,
    }
end
exports('GetVehicleTelemetry', GetVehicleTelemetry)

function GetVehicleState()
    local veh = getVeh()
    if veh == 0 or not isDriver() then return nil end

    local tele = GetVehicleTelemetry(veh)
    if not tele then return nil end

    local class = GetVehicleClass(veh)
    local fuelExempt = class == 13 or class == 14 or class == 15 or class == 16

    local plate = isTrackedOwnedVehicle(veh) and plateOf(veh) or nil
    local ecuInfo = nil
    if GetResourceState('sunset_tuning') == 'started' then
        pcall(function()
            local tune = vehicleProps and vehicleProps.ecu or (plate and exports.sunset_tuning:GetTuneForPlate(plate))
            ecuInfo = exports.sunset_tuning:FormatVehicleInfo(tune)
        end)
    end

    return {
        inVehicle = true,
        isDriver = isDriver(),
        speed = tele.speedKmh,
        gear = tele.gear,
        rpm = tele.displayRpm,
        rawRpm = tele.rawRpm,
        displayRpm = tele.displayRpm,
        fuel = fuelExempt and 100 or fuel,
        showFuel = not fuelExempt,
        engine = GetVehicleEngineHealth(veh),
        locked = locked,
        seatbelt = seatbelt,
        lightMode = lightMode,
        engineOn = tele.engineOn,
        odometer = isTrackedOwnedVehicle(veh) and (math.floor(odometerKm * 10) / 10) or nil,
        showOdometer = isTrackedOwnedVehicle(veh),
        vehicleClass = class,
        vehicleName = exports.sunset_vehicles:GetVehicleDisplayName(veh),
        supportsSeatbelt = supportsSeatbelt(veh),
        supportsDoorLock = supportsDoorLock(veh),
        plate = plate,
        ecuInfo = ecuInfo,
    }
end

exports('GetVehicleState', GetVehicleState)

-- ═══ OWNED VEHICLES / GARAGE ═══

local function markProtected(veh)
    if veh and veh ~= 0 then
        protectedVehicles[veh] = true
    end
end

local function unmarkProtected(veh)
    if veh then protectedVehicles[veh] = nil end
end

local function deleteVehicleEntity(veh)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return end
    unmarkProtected(veh)
    SetEntityAsMissionEntity(veh, true, true)
    DeleteVehicle(veh)
    if DoesEntityExist(veh) then
        DeleteEntity(veh)
    end
end

local function plateTextMatches(vehPlate, target)
    -- [AUDIT F6.4] Exact match only after normalization. The previous substring
    -- match let short vanity plates (e.g. "A") match unrelated world traffic,
    -- causing deleteVehicleByPlate to remove other players' vehicles on spawn.
    local a = normalizePlate(vehPlate)
    local b = normalizePlate(target)
    if a == '' or b == '' then return false end
    return a == b
end

local function findVehicleByPlate(plate)
    local target = normalizePlate(plate)
    if target == '' then return nil end

    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local current = GetVehiclePedIsIn(ped, false)
        if plateTextMatches(GetVehicleNumberPlateText(current), target) then
            return current
        end
    end

    for _, veh in pairs(spawnedOwnedVehicles) do
        if DoesEntityExist(veh) and plateTextMatches(GetVehicleNumberPlateText(veh), target) then
            return veh
        end
    end

    for _, veh in ipairs(GetGamePool('CVehicle')) do
        if plateTextMatches(GetVehicleNumberPlateText(veh), target) then
            return veh
        end
    end

    return nil
end

exports('IsPlateInWorld', function(plate)
    return findVehicleByPlate(plate) ~= nil
end)

exports('IsProtectedVehicle', function(veh)
    if not veh or veh == 0 then return false end
    if protectedVehicles[veh] then return true end
    if isTrackedOwnedVehicle(veh) then return true end
    return false
end)

local function deleteVehicleByPlate(plate)
    local veh = findVehicleByPlate(plate)
    if not veh then return end
    deleteVehicleEntity(veh)
    untrackSpawnedOwned(veh)
end

RegisterNetEvent('sunset:client:cleanupOwnedVehicles', function(plates)
    for _, row in ipairs(plates or {}) do
        deleteVehicleByPlate(row.plate or row)
    end
end)

local function normalizeVehicleStats(vehData)
    local fuel = tonumber(vehData.fuel)
    local engine = tonumber(vehData.engine)
    local body = tonumber(vehData.body)
    local isDestroyed = vehData.destroyed == 1 or vehData.destroyed == true or vehData.destroyed == '1'

    if fuel == nil or fuel <= 0 then fuel = 100.0 end

    if isDestroyed then
        engine = 0.0
        body = 0.0
    else
        -- [AUDIT F4.1] Only default MISSING (legacy NULL) health; do not silently
        -- heal damaged values to 1000 (that was a free repair loop: damage to
        -- ~100, re-store, re-spawn fully repaired).
        if engine == nil then engine = 1000.0 end
        if body == nil then body = 1000.0 end
    end

    fuel = math.max(0.0, math.min(100.0, fuel))
    engine = math.max(0.0, math.min(1000.0, engine))
    body = math.max(0.0, math.min(1000.0, body))

    return fuel, engine, body
end


local function hasParkedPosition(vehData)
    return vehData
        and tonumber(vehData.parked_x) ~= nil
        and tonumber(vehData.parked_y) ~= nil
        and tonumber(vehData.parked_z) ~= nil
end

local function getSpawnPoint(opts)
    if opts and opts.x and opts.y and opts.z then
        return opts.x, opts.y, opts.z, opts.w or opts.h or 0.0
    end

    local spawn = opts or {}
    return spawn.x, spawn.y, spawn.z, spawn.w or spawn.h or 0.0
end

local function getParkedCoords(vehData)
    if not hasParkedPosition(vehData) then return nil end
    return {
        x = tonumber(vehData.parked_x),
        y = tonumber(vehData.parked_y),
        z = tonumber(vehData.parked_z),
    }
end

local function captureParkedPosition(entity)
    if not entity or entity == 0 then return nil end
    local coords = GetEntityCoords(entity)
    return {
        x = coords.x,
        y = coords.y,
        z = coords.z,
        h = GetEntityHeading(entity),
    }
end

local function spawnOwnedVehicleEntity(vehData, spawnOpts)
    deleteVehicleByPlate(vehData.plate)

    local model = joaat(vehData.model)
    if not IsModelInCdimage(model) or not IsModelAVehicle(model) then
        notify(exports.sunset_core:Translate('vehicles.msg.invalid_vehicle_model', { model = tostring(vehData.model) }), 'error')
        return nil
    end

    RequestModel(model)
    local timeout = GetGameTimer() + 8000
    while not HasModelLoaded(model) do
        if GetGameTimer() > timeout then
            notify(exports.sunset_core:Translate('vehicles.message.failed_to_load_vehicle_model'), 'error')
            return nil
        end
        Wait(10)
    end

    local vehFuel, vehEngine, vehBody = normalizeVehicleStats(vehData)
    local sx, sy, sz, heading = getSpawnPoint(spawnOpts)
    RequestCollisionAtCoord(sx, sy, sz)
    -- [FIX] Set spawn grace BEFORE creating the vehicle so ground-collision
    -- damage during spawn placement doesn't damage the engine/body.
    spawnGraceUntil = GetGameTimer() + 4000

    local vehicle = 0
    -- [ANTICHEAT] whitelist this spawn for the vehspawn ledger detector
    TriggerServerEvent('sunset:anticheat:markLegitLocal', 'vehicle_spawn', 15)
    for i = 0, 4 do
        local ox = (i % 2 == 0) and (i * 2.2) or (-i * 2.2)
        local oy = math.floor(i / 2) * 2.2
        vehicle = CreateVehicle(model, sx + ox, sy + oy, sz, heading, true, false)
        if vehicle ~= 0 then break end
        Wait(50)
    end

    if vehicle == 0 then
        SetModelAsNoLongerNeeded(model)
        notify(exports.sunset_core:Translate('vehicles.message.could_not_spawn_vehicle_move_to_open_space'), 'error')
        return nil
    end

    SetVehicleNumberPlateText(vehicle, vehData.plate)
    SetEntityAsMissionEntity(vehicle, true, true)
    SetVehicleHasBeenOwnedByPlayer(vehicle, true)
    SetVehicleNeedsToBeHotwired(vehicle, false)
    SetVehRadioStation(vehicle, 'OFF')
    SetVehicleDirtLevel(vehicle, 0.0)
    SetVehiclePetrolTankHealth(vehicle, 1000.0)
    writeFuelPercent(vehicle, vehFuel)
    SetVehicleOnGroundProperly(vehicle)
    Wait(150)
    if vehEngine >= 999.0 and vehBody >= 999.0 then
        SetVehicleFixed(vehicle)
        SetVehicleDeformationFixed(vehicle)
    end
    SetVehicleEngineHealth(vehicle, vehEngine)
    SetVehicleBodyHealth(vehicle, vehBody)
    SetVehiclePetrolTankHealth(vehicle, 1000.0)
    writeFuelPercent(vehicle, vehFuel)
    local spawnProps = decodeVehicleProps(vehData.props)
    if spawnProps and (spawnProps.color1 or spawnProps.color2) then
        SetVehicleColours(vehicle, tonumber(spawnProps.color1) or 0, tonumber(spawnProps.color2) or 0)
    end
    local cosmetics = spawnProps and spawnProps.cosmetics
    if type(cosmetics) == 'table' then
        if GetResourceState('sunset_tuning') == 'started' then
            pcall(function() exports.sunset_tuning:ApplyCosmetics(vehicle, cosmetics, false) end)
        else
            SetVehicleModColor_1(vehicle, 0)
            SetVehicleModColor_2(vehicle, 0)
            if cosmetics.primary then
                SetVehicleCustomPrimaryColour(vehicle, cosmetics.primary.r or 0, cosmetics.primary.g or 0, cosmetics.primary.b or 0)
            end
            if cosmetics.secondary then
                SetVehicleCustomSecondaryColour(vehicle, cosmetics.secondary.r or 111, cosmetics.secondary.g or 111, cosmetics.secondary.b or 111)
            end
            if cosmetics.pearl then SetVehicleExtraColours(vehicle, cosmetics.pearl or 0, cosmetics.wheel or 0) end
        end
    end
    Wait(50)
    SetVehicleEngineHealth(vehicle, vehEngine)
    SetVehicleBodyHealth(vehicle, vehBody)
    writeFuelPercent(vehicle, vehFuel)
    spawnGraceUntil = GetGameTimer() + 4000
    lastBodyHealth = vehBody
    lastVehSpeed = 0.0
    engineEnabled[vehicle] = false
    SetVehicleEngineOn(vehicle, false, true, true)
    SetModelAsNoLongerNeeded(model)

    local props = decodeVehicleProps(vehData.props)
    resetOdometerTracking(vehData.plate, props and props.odometer or 0, props)
    if GetResourceState('sunset_tuning') == 'started' then
        pcall(function()
            exports.sunset_tuning:CaptureModelBaseline(vehicle)
            if props and props.ecu and not exports.sunset_tuning:FormatVehicleInfo(props.ecu).stock then
                exports.sunset_tuning:ApplyTune(vehicle, props.ecu, false, vehData.model)
            end
            if cosmetics then
                exports.sunset_tuning:ApplyCosmetics(vehicle, cosmetics, false)
            end
        end)
    end

    trackSpawnedOwned(vehData.plate, vehicle)
    markProtected(vehicle)
    fuel = vehFuel
    currentVeh = 0
    notify(exports.sunset_core:Translate('vehicles.msg.vehicle_spawned_fuel', { plate = tostring(vehData.plate), veh_fuel = math.floor(tonumber(math.floor(vehFuel)) or 0) }), 'success')
    TriggerEvent('sunset:client:vehicleUpdated', { id = tonumber(vehData.id), plate = vehData.plate, stored = 0, inWorld = true })
    TriggerEvent('sunset:menu:refreshIfOpen')
    return vehicle
end

RegisterNetEvent('sunset:client:spawnOwnedVehicle', function(vehData, spawnOpts)
    Wait(200)
    spawnOwnedVehicleEntity(vehData, spawnOpts)
end)

local function showGaragePanel(_vehicles)
    TriggerEvent('sunset:menu:openVehicle')
end

RegisterNetEvent('sunset:client:garageMenu', function(_vehicles)
    showGaragePanel(_vehicles)
end)

local function openGaragePanel()
    if blocked() then return end
    TriggerEvent('sunset:menu:openVehicle')
end

RegisterCommand('v', openGaragePanel, false)
RegisterCommand('garage', openGaragePanel, false)

TriggerEvent('chat:addSuggestion', '/v', 'Personal vehicle garage')
TriggerEvent('chat:addSuggestion', '/garage', 'Personal vehicle garage')
TriggerEvent('chat:addSuggestion', '/park', 'Save your personal vehicle at its current position')

local function closeGarageUiUnlessMenu()
    local menuOpen = GetResourceState('sunset_menu') == 'started' and exports.sunset_menu:IsMenuOpen()
    if menuOpen then return end
    exports.sunset_ui:ReleaseFocusUnlessModal()
    exports.sunset_ui:Send('garageHide', {})
end

AddEventHandler('sunset:nui:garageSpawn', function(data)
    CreateThread(function()
        local ok, err = Sunset.AwaitCallback('sunset:spawnVehicle', data.vehicleId)
        if not ok then
            notify(err or exports.sunset_core:Translate('vehicles.msg.could_not_spawn_vehicle'), 'error')
        else
            TriggerEvent('sunset:client:vehicleUpdated', { id = tonumber(data.vehicleId), stored = 0, inWorld = true })
            TriggerEvent('sunset:menu:refreshIfOpen')
        end
        closeGarageUiUnlessMenu()
    end)
end)

RegisterCommand('givekeys', function(_, args)
    CreateThread(function()
        local target = tonumber(args[1])
        local veh = getVeh()
        if veh == 0 then
            local coords = GetEntityCoords(PlayerPedId())
            veh = GetClosestVehicle(coords.x, coords.y, coords.z, 5.0, 0, 0)
        end
        if not target or veh == 0 then return notify(exports.sunset_core:Translate('vehicles.message.usage_givekeys_id_near_your_vehicle'), 'error') end
        local ok, err = Sunset.AwaitCallback('sunset:giveVehicleKeys', target, plateOf(veh))
        if ok then notify(exports.sunset_core:Translate('vehicles.message.keys_given'), 'success') else notify(err or exports.sunset_core:Translate('vehicles.msg.could_not_give_keys'), 'error') end
    end)
end, false)

RegisterCommand('takekeys', function(_, args)
    CreateThread(function()
        local target = tonumber(args[1])
        local veh = getVeh()
        if veh == 0 then
            local coords = GetEntityCoords(PlayerPedId())
            veh = GetClosestVehicle(coords.x, coords.y, coords.z, 5.0, 0, 0)
        end
        if not target or veh == 0 then return notify(exports.sunset_core:Translate('vehicles.message.usage_takekeys_id_near_your_vehicle'), 'error') end
        local ok, err = Sunset.AwaitCallback('sunset:takeVehicleKeys', target, plateOf(veh))
        if ok then notify(exports.sunset_core:Translate('vehicles.message.keys_taken'), 'success') else notify(err or exports.sunset_core:Translate('vehicles.msg.could_not_take_keys'), 'error') end
    end)
end, false)

local function parkCurrentVehicle(closeMenuAfter)
    CreateThread(function()
        local veh = getVeh()
        if veh == 0 or not isDriver() then return notify(exports.sunset_core:Translate('vehicles.message.sit_in_the_driver_seat_of_your_vehicle_to'), 'error') end
        local result, err = Sunset.AwaitCallback('sunset:parkOwnedVehicle', VehToNet(veh), plateOf(veh),
            buildStoreProps(veh), readFuelPercent(veh))
        if result then
            notify(exports.sunset_core:Translate('vehicles.message.vehicle_parked_here_gps_and_future_spawns_will_use'), 'success')
            if closeMenuAfter then TriggerEvent('sunset:nui:menuClose') end
        else notify(err or exports.sunset_core:Translate('vehicles.msg.could_not_park'), 'error') end
    end)
end

RegisterCommand('park', function()
    parkCurrentVehicle(false)
end, false)

AddEventHandler('sunset:vehicle:parkCurrent', function()
    parkCurrentVehicle(true)
end)

CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local trying = GetVehiclePedIsTryingToEnter(ped)
        if trying ~= 0 then
            local class = GetVehicleClass(trying)
            local lockedState = GetVehicleDoorLockStatus(trying)
            local mine = isTrackedOwnedVehicle(trying)
            if mine then
                SetVehicleDoorsLockedForPlayer(trying, PlayerId(), false)
            elseif class ~= 13 and lockedState > 1 then
                local keys = Sunset.AwaitCallback('sunset:hasVehicleKeys', plateOf(trying))
                if keys then
                    SetVehicleDoorsLockedForPlayer(trying, PlayerId(), false)
                else
                    ClearPedTasks(ped)
                    notify(exports.sunset_core:Translate('vehicles.message.this_is_not_your_vehicle'), 'error')
                end
            elseif not isTrackedOwnedVehicle(trying) then
                -- unlocked but not yours: allow enter, just inform once
            end
        end
        Wait(200)
    end
end)

AddEventHandler('sunset:nui:garageStore', function(data)
    CreateThread(function()
        local vehData = Sunset.AwaitCallback('sunset:getVehicleById', data.vehicleId)
        if not vehData then
            notify(exports.sunset_core:Translate('vehicles.message.vehicle_not_found'), 'error')
            return
        end
        if vehData.stored == 1 then
            notify(exports.sunset_core:Translate('vehicles.message.already_in_garage'), 'info')
            TriggerEvent('sunset:client:vehicleUpdated', { id = tonumber(data.vehicleId), stored = 1, inWorld = false })
            TriggerEvent('sunset:menu:refreshIfOpen')
            return
        end

        local entity = findVehicleByPlate(vehData.plate)
        local props = entity and buildStoreProps(entity) or { model = joaat(vehData.model), odometer = math.floor(odometerKm * 10) / 10 }
        local vehFuel = vehData.fuel or 100.0
        local vehEngine = vehData.engine or 1000.0
        local vehBody = vehData.body or 1000.0

        if entity and DoesEntityExist(entity) then
            local ped = PlayerPedId()
            local driver = GetPedInVehicleSeat(entity, -1)
            if driver ~= 0 and driver ~= ped then
                notify(exports.sunset_core:Translate('vehicles.message.the_vehicle_is_currently_being_driven_by_someone_else'), 'error')
                return
            end

            props = buildStoreProps(entity)
            vehFuel = readFuelPercent(entity)
            vehEngine = GetVehicleEngineHealth(entity)
            vehBody = GetVehicleBodyHealth(entity)
        end

        local plate = normalizePlate(vehData.plate)
        local parked = entity and captureParkedPosition(entity) or nil
        local netId = (entity and entity ~= 0 and DoesEntityExist(entity)) and VehToNet(entity) or 0
        local ok, err = Sunset.AwaitCallback('sunset:storeOwnedVehicle', netId, plate, props,
            vehFuel, vehData.garage or 'legion', parked)
        if not ok then
            notify(err or exports.sunset_core:Translate('vehicles.message.vehicle_could_not_be_stored'), 'error')
            return
        end
        if entity and DoesEntityExist(entity) then
            deleteVehicleEntity(entity)
        end
        if entity then untrackSpawnedOwned(entity) end
        notify(exports.sunset_core:Translate('vehicles.message.vehicle_successfully_stored'), 'success')
        TriggerEvent('sunset:client:vehicleUpdated', { id = tonumber(data.vehicleId), stored = 1, inWorld = false })
        TriggerEvent('sunset:menu:refreshIfOpen')
        closeGarageUiUnlessMenu()
    end)
end)

AddEventHandler('sunset:nui:garageLocate', function(data)
    local entity = findVehicleByPlate(data.plate)
    if entity then
        local coords = GetEntityCoords(entity)
        SetNewWaypoint(coords.x, coords.y)
        notify(exports.sunset_core:Translate('vehicles.msg.gps_set_to_plate', { plate = tostring(normalizePlate(data.plate)) }), 'success')
        closeGarageUiUnlessMenu()
        return
    end

    local vehData = nil
    if data.vehicleId then
        vehData = Sunset.AwaitCallback('sunset:getVehicleById', tonumber(data.vehicleId))
    end

    local parked = vehData and getParkedCoords(vehData) or nil
    if parked then
        SetNewWaypoint(parked.x, parked.y)
        notify(exports.sunset_core:Translate('vehicles.msg.gps_set_to_parked_location_plate', { plate = tostring(normalizePlate(data.plate or vehData.plate)) }), 'success')
    else
        notify(exports.sunset_core:Translate('vehicles.message.vehicle_not_found_no_parked_location_saved'), 'error')
    end
    closeGarageUiUnlessMenu()
end)

AddEventHandler('sunset:nui:garageClose', function()
    closeGarageUiUnlessMenu()
end)

AddEventHandler('sunset:nui:garageClaimInsurance', function(data)
    CreateThread(function()
        if not data or not data.vehicleId then return end
        local result, err = Sunset.AwaitCallback('sunset:claimVehicleInsurance', tonumber(data.vehicleId))
        if result and result.ok then
            TriggerEvent('sunset:menu:refreshIfOpen')
            if not data.fromMenu then
                TriggerEvent('sunset:menu:openVehicle')
            end
        else
            notify(err or exports.sunset_core:Translate('vehicles.msg.insurance_claim_could_not_be_processed'), 'error')
        end
    end)
end)

AddEventHandler('sunset:nui:garageRenewInsurance', function(data)
    CreateThread(function()
        if not data or not data.vehicleId then return end
        local result, err = Sunset.AwaitCallback('sunset:renewVehicleInsurance', tonumber(data.vehicleId))
        if result and result.ok then
            TriggerEvent('sunset:menu:refreshIfOpen')
            if not data.fromMenu then
                TriggerEvent('sunset:menu:openVehicle')
            end
        else
            notify(err or exports.sunset_core:Translate('vehicles.msg.insurance_renewal_could_not_be_processed'), 'error')
        end
    end)
end)


local reportedDestroyedVehicles = {}

local function reportVehicleDestroyed(veh)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return end
    if reportedDestroyedVehicles[veh] then return end
    reportedDestroyedVehicles[veh] = true

    local plate = normalizePlate(GetVehicleNumberPlateText(veh))
    if plate == '' then return end

    TriggerServerEvent('sunset:server:vehicleDestroyed', VehToNet(veh), plate)
    untrackSpawnedOwned(veh)

    SetTimeout(60000, function()
        reportedDestroyedVehicles[veh] = nil
    end)
end

AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkVehicleUndriveable' then
        local veh = args and args[1]
        if veh and veh ~= 0 and DoesEntityExist(veh) then
            if isTrackedOwnedVehicle(veh) or hasKeysFor(veh) then
                reportVehicleDestroyed(veh)
            end
        end
    end
end)

CreateThread(function()
    while true do
        forEachTrackedOwned(function(_, veh)
            if IsEntityDead(veh)
                or GetVehicleEngineHealth(veh) <= -3900.0
                or (IsEntityInWater(veh) and GetEntitySubmergedLevel(veh) >= 0.85) then
                reportVehicleDestroyed(veh)
            end
        end)
        Wait(1000)
    end
end)

local function resolveVehicleToStore()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        return GetVehiclePedIsIn(ped, false)
    end
    local nearbyOwned = getNearestTrackedOwned(30.0)
    if nearbyOwned then return nearbyOwned end
    local coords = GetEntityCoords(ped)
    local closest = GetClosestVehicle(coords.x, coords.y, coords.z, 15.0, 0, 71)
    if closest ~= 0 and DoesEntityExist(closest) then
        return closest
    end
    nearbyOwned = getNearestTrackedOwned(120.0)
    if nearbyOwned then return nearbyOwned end
    return 0
end

RegisterNetEvent('sunset:client:storeVehicleRequest', function(garageId)
    CreateThread(function()
        local veh = resolveVehicleToStore()
        if veh == 0 or not DoesEntityExist(veh) then
            return notify(exports.sunset_core:Translate('vehicles.message.no_vehicle_nearby_to_store'), 'error')
        end
        local ped = PlayerPedId()
        local driver = GetPedInVehicleSeat(veh, -1)
        if driver ~= 0 and driver ~= ped then
            return notify(exports.sunset_core:Translate('vehicles.message.the_vehicle_is_currently_being_driven_by_someone_else'), 'error')
        end
        local plate = normalizePlate(GetVehicleNumberPlateText(veh))
        local parked = captureParkedPosition(veh)
        local vehFuel = readFuelPercent(veh)
        local props = buildStoreProps(veh)
        local ok, err = Sunset.AwaitCallback('sunset:storeOwnedVehicle', VehToNet(veh), plate,
            props, vehFuel, garageId or 'legion', parked)
        if not ok then return notify(err or exports.sunset_core:Translate('vehicles.message.vehicle_could_not_be_stored'), 'error') end
        deleteVehicleEntity(veh)
        untrackSpawnedOwned(veh)
        notify(exports.sunset_core:Translate('vehicles.message.vehicle_successfully_stored'), 'success')
    end)
end)

AddEventHandler('sunset:world:garageStore', function(garageId)
    CreateThread(function()
        local veh = resolveVehicleToStore()
        if veh == 0 or not DoesEntityExist(veh) then
            notify(exports.sunset_core:Translate('vehicles.message.no_vehicle_nearby_to_store_use_v_for_the'), 'info')
            return
        end
        local ped = PlayerPedId()
        local driver = GetPedInVehicleSeat(veh, -1)
        if driver ~= 0 and driver ~= ped then
            notify(exports.sunset_core:Translate('vehicles.message.the_vehicle_is_currently_being_driven_by_someone_else'), 'error')
            return
        end
        local plate = normalizePlate(GetVehicleNumberPlateText(veh))
        local parked = captureParkedPosition(veh)
        local vehFuel = readFuelPercent(veh)
        local props = buildStoreProps(veh)
        local ok, err = Sunset.AwaitCallback('sunset:storeOwnedVehicle', VehToNet(veh), plate,
            props, vehFuel, garageId or 'legion', parked)
        if not ok then return notify(err or exports.sunset_core:Translate('vehicles.message.vehicle_could_not_be_stored'), 'error') end
        deleteVehicleEntity(veh)
        untrackSpawnedOwned(veh)
        notify(exports.sunset_core:Translate('vehicles.message.vehicle_successfully_stored'), 'success')
    end)
end)

local function setFuelLevel(veh, level)
    level = math.max(0.0, math.min(100.0, tonumber(level) or 0))
    fuel = level
    writeFuelPercent(veh, level)
end

exports('SetFuelLevel', setFuelLevel)

exports('GetFuelLevel', function()
    return fuel
end)

local function getGasCanTargetVehicle()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        return nil, { localeKey = 'vehicles.message.exit_the_vehicle_and_stand_beside_it_before_using' }
    end

    local coords = GetEntityCoords(ped)
    local veh = GetClosestVehicle(coords.x, coords.y, coords.z, 4.5, 0, 71)
    if veh ~= 0 and DoesEntityExist(veh) then return veh end
    return nil, { localeKey = 'vehicles.message.stand_next_to_your_vehicle_to_use_the_gas' }
end

RegisterNetEvent('sunset:client:useGasCan', function()
    CreateThread(function()
        pcall(function() exports.sunset_inventory:Close() end)
        Wait(100)

        local ped = PlayerPedId()
        if IsPedInAnyVehicle(ped, false) then
            local insideVehicle = GetVehiclePedIsIn(ped, false)
            local insideFuel = readFuelPercent(insideVehicle)
            if insideFuel >= 99.5 then
                notify(exports.sunset_core:Translate('vehicles.message.this_vehicle_already_has_a_full_tank_100_the'), 'info')
            else
                notify(exports.sunset_core:Translate('vehicles.msg.exit_the_vehicle_and_stand_beside', { value = math.floor(tonumber(math.floor(insideFuel + 0.5)) or 0) }), 'warning')
            end
            return
        end

        local veh, err = getGasCanTargetVehicle()
        if not veh then
            notify(err or exports.sunset_core:Translate('vehicles.message.no_vehicle_nearby'), 'error')
            return
        end

        local plate = normalizePlate(GetVehicleNumberPlateText(veh))
        local vehicleClass = GetVehicleClass(veh)
        local tankCapacity = Sunset.GetVehicleTankCapacityLiters(vehicleClass)

        local fuelPct
        fuelPct = readFuelPercent(veh)
        if fuelPct >= 99.5 then
            notify(exports.sunset_core:Translate('vehicles.message.this_vehicle_already_has_a_full_tank_100_the'), 'info')
            return
        end
        local tankLiters = Sunset.PercentToTankLiters(fuelPct, vehicleClass)

        local result, useErr = Sunset.AwaitCallback('sunset:useGasCanOnVehicle', plate, tankLiters, vehicleClass)
        if not result then
            notify(useErr or exports.sunset_core:Translate('vehicles.msg.could_not_use_gas_can'), 'error')
            return
        end

        SetVehiclePetrolTankHealth(veh, 1000.0)
        setFuelLevel(veh, result.vehicleFuel or fuelPct)

        local poured = result.transferredLiters or 0
        local fromL = result.fromTankLiters or tankLiters
        local toL = result.tankLiters or (tankLiters + poured)
        local cap = result.tankCapacity or tankCapacity
        local maxCan = result.maxCanLiters or Sunset.GetGasCanMaxLiters()
        local canLeft = result.canLiters

        if canLeft == nil or canLeft <= 0.1 then
            notify(exports.sunset_core:Translate('vehicles.msg.added_l_to_vehicle_l_l', { poured = string.format('%.0f', poured), from_l = string.format('%.0f', fromL), to_l = string.format('%.0f', toL), cap = string.format('%.0f', cap) }), 'success')
        else
            notify(exports.sunset_core:Translate('vehicles.msg.added_l_to_vehicle_l_l_2', { poured = string.format('%.0f', poured), from_l = string.format('%.0f', fromL), to_l = string.format('%.0f', toL), cap = string.format('%.0f', cap), can_left = string.format('%.0f', canLeft), max_can = string.format('%.0f', maxCan) }), 'success')
        end
    end)
end)

function SetVehicleProp(key, value)
    if type(key) ~= 'string' or key == '' then return end
    vehicleProps[key] = value
end

-- ── Vehicle entry info display ────────────────────────────────────────────
-- Shows a compact chat message once per vehicle enter (not on seat change).

local function localizedNumber(value, decimals)
    local locale = exports.sunset_core:GetLocale()
    local raw = (('%.' .. tostring(decimals or 0) .. 'f'):format(tonumber(value) or 0))
    local whole, fraction = raw:match('^(%-?%d+)%.?(%d*)$')
    local sign = whole:sub(1, 1) == '-' and '-' or ''
    whole = whole:gsub('^-', '')
    local separator = locale == 'ro' and '.' or ','
    local groups = {}
    while #whole > 3 do
        table.insert(groups, 1, whole:sub(-3))
        whole = whole:sub(1, -4)
    end
    table.insert(groups, 1, whole)
    local grouped = table.concat(groups, separator)
    if fraction ~= '' then
        return sign .. grouped .. (locale == 'ro' and ',' or '.') .. fraction
    end
    return sign .. grouped
end

local function ownershipAge(days)
    days = math.max(0, math.floor(tonumber(days) or 0))
    return exports.sunset_core:Translate(days == 1 and 'vehicles.entry.age.one' or 'vehicles.entry.age.other', {
        count = localizedNumber(days, 0),
    })
end

CreateThread(function()
    local lastVeh = 0
    local entryGeneration = 0
    while true do
        local ped = PlayerPedId()
        local veh = GetVehiclePedIsIn(ped, false)

        if veh ~= lastVeh then
            entryGeneration = entryGeneration + 1
            local generation = entryGeneration
            lastVeh = veh
            if veh ~= 0 and DoesEntityExist(veh) then
                CreateThread(function()
                    local info
                    local function stillInside()
                        return generation == entryGeneration and DoesEntityExist(veh)
                            and GetVehiclePedIsIn(PlayerPedId(), false) == veh
                    end
                    for attempt = 1, 6 do
                        if not stillInside() then return end
                        local netId = NetworkGetEntityIsNetworked(veh) and VehToNet(veh) or 0
                        if netId ~= 0 then
                            local completed = false
                            local requestActive = true
                            TriggerCallback('sunset:getVehicleEntryInfo', function(result)
                                if requestActive and stillInside() then info = result end
                                completed = true
                            end, netId)
                            local deadline = GetGameTimer() + 1000
                            while not completed and stillInside() and GetGameTimer() < deadline do Wait(50) end
                            requestActive = false
                            if not completed then
                                Wait(250)
                            end
                        end
                        if info then break end
                        Wait(250)
                    end
                    if not stillInside() then return end
                    if info then
                        local msg
                        if info.category == 'personal_own' then
                            local insLine = info.destroyed
                                and exports.sunset_core:Translate('vehicles.entry.totaled')
                                or exports.sunset_core:Translate('vehicles.entry.insurance', {
                                    level = info.ins_level, points = info.ins_points, cost = info.claim_cost,
                                })
                            msg = exports.sunset_core:Translate('vehicles.entry.own', {
                                model = info.displayName or exports.sunset_vehicles:GetVehicleDisplayName(info.model), plate = info.plate,
                                owner = info.ownerName or exports.sunset_core:Translate('vehicles.entry.private'),
                                odometer = localizedNumber(info.odometer, 1),
                                age = ownershipAge(info.ownershipDays), insurance = insLine,
                            })
                        elseif info.category == 'personal_other' then
                            msg = exports.sunset_core:Translate('vehicles.entry.other', {
                                model = info.displayName or exports.sunset_vehicles:GetVehicleDisplayName(info.model), plate = info.plate, owner = info.ownerName or exports.sunset_core:Translate('vehicles.entry.private'),
                                odometer = localizedNumber(info.odometer, 1), age = ownershipAge(info.ownershipDays),
                            })
                        elseif info.category == 'faction' then
                            msg = exports.sunset_core:Translate('vehicles.entry.faction', {
                                plate = info.plate ~= '' and info.plate or exports.sunset_core:Translate('vehicles.entry.fleet'), faction = info.faction,
                            })
                        else
                            msg = exports.sunset_core:Translate('vehicles.entry.npc', { plate = info.plate or '' })
                        end
                        TriggerEvent('chat:addMessage', {
                            args = { exports.sunset_core:Translate('vehicles.entry.title'), msg },
                            color = { 255, 255, 255 },
                        })
                    end
                end)
            end
        end

        Wait(500)
    end
end)

exports('SetVehicleProp', SetVehicleProp)

RegisterNetEvent('sunset:client:vehicleStateChanged', function(data)
    TriggerEvent('sunset:client:vehicleUpdated', data and data.vehicle or {})
    TriggerEvent('sunset:menu:refreshIfOpen')
end)
