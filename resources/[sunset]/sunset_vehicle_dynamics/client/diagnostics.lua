--[[
    Sunset Vehicle Dynamics - Diagnostics & Benchmark Suite
    Server-authorized inspection/reapply plus Config.Debug developer commands.
    Provides canonical-versus-live handling, hot reloading, and benchmarking.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

local function showHandlingInfo()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then
        TriggerEvent('chat:addMessage', {
            color = { 255, 80, 80 },
            multiline = false,
            args = { 'Dynamics', 'You must be inside a vehicle to inspect handling info.' }
        })
        return
    end

    local veh = GetVehiclePedIsIn(ped, false)
    local modelHash = GetEntityModel(veh)
    local modelName = GetDisplayNameFromVehicleModel(modelHash) or 'UNKNOWN'
    local classId = GetVehicleClass(veh)
    local profile = SunsetVehicleDynamics.Resolve(modelHash, classId)
    local canon = profile.handling or {}

    -- Live Handling Readout from Entity
    local liveMass = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fMass')
    local liveDriveForce = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fInitialDriveForce')
    local liveFlatVel = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fInitialDriveMaxFlatVel')
    local liveBrakeForce = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fBrakeForce')
    local liveTractionMax = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fTractionCurveMax')
    local liveTractionMin = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fTractionCurveMin')
    local liveSteerLock = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fSteeringLock')
    local liveDriveBias = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fDriveBiasFront')
    local liveGears = GetVehicleHandlingInt(veh, 'CHandlingData', 'nInitialDriveGears')
    local liveDrag = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fInitialDragCoeff')
    local liveSuspension = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fSuspensionForce')
    local liveAntiRoll = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fAntiRollBarForce')
    local liveRollFront = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fRollCentreHeightFront')
    local liveRollRear = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fRollCentreHeightRear')
    local speedKmh = GetEntitySpeed(veh) * 3.6

    -- Tuning State
    local activeTuneInfo = 'Stock (No ECU Tune)'
    if GetResourceState('sunset_tuning') == 'started' then
        pcall(function()
            local plate = GetVehicleNumberPlateText(veh)
            if exports.sunset_tuning and exports.sunset_tuning.GetTuneForPlate then
                local tune = exports.sunset_tuning:GetTuneForPlate(plate)
                if tune and tune.stage and tune.stage ~= 'stock' then
                    activeTuneInfo = string.format('Stage: %s (Pwr: +%s%%, Trq: +%s%%)', tune.stage, tostring(tune.power or 0), tostring(tune.torque or 0))
                end
            end
        end)
    end

    print('^3=======================================================^7')
    print(string.format('^3--- Vehicle Dynamics Diagnostic: %s (Hash: %d) ---^7', modelName, modelHash))
    print(string.format('^2Identity: %s | Profile: %s | Source: %s | Archetype: %s | Tier: %s | Class: %d^7', profile.displayName or modelName, profile.model or 'unknown', profile.source or 'unknown', profile.archetype or 'custom', profile.performanceTier or 'unknown', classId))
    print(string.format('Drivetrain: ^5%s^7 (DriveBiasFront: %.2f) | Weight: ^5%d kg^7', profile.drivetrain or 'unknown', liveDriveBias, math.floor(liveMass)))
    print(string.format('Tuning Status: ^5%s^7', activeTuneInfo))
    print('^6--- CANONICAL BASELINE vs LIVE EFFECTIVE ---^7')
    print(string.format('  Mass:           Canon: %4d kg    | Live: %4d kg', math.floor(canon.fMass or 0), math.floor(liveMass)))
    print(string.format('  Drive Force:    Canon: %.3f      | Live: %.3f', canon.fInitialDriveForce or 0, liveDriveForce))
    print(string.format('  Max Flat Vel:   Canon: %.1f      | Live: %.1f (Raw GTA parameter)', canon.fInitialDriveMaxFlatVel or 0, liveFlatVel))
    print(string.format('  Brake Force:    Canon: %.2f      | Live: %.2f', canon.fBrakeForce or 0, liveBrakeForce))
    print(string.format('  Traction Max:   Canon: %.2f      | Live: %.2f', canon.fTractionCurveMax or 0, liveTractionMax))
    print(string.format('  Traction Min:   Canon: %.2f      | Live: %.2f', canon.fTractionCurveMin or 0, liveTractionMin))
    print(string.format('  Steering Lock:  Canon: %.1f deg  | Live: %.1f deg', canon.fSteeringLock or 0, liveSteerLock))
    local liveHighGear = GetVehicleHighGear(veh)
    print(string.format('  Gears:          Canon: %d        | Live: %d (high gear native: %d)', canon.nInitialDriveGears or 0, liveGears, liveHighGear or 0))
    print(string.format('  Drag:           Canon: %.2f      | Live: %.2f', canon.fInitialDragCoeff or 0, liveDrag))
    print(string.format('  Suspension:     Canon: %.2f      | Live: %.2f', canon.fSuspensionForce or 0, liveSuspension))
    print(string.format('  Anti-roll:      Canon: %.2f      | Live: %.2f', canon.fAntiRollBarForce or 0, liveAntiRoll))
    print(string.format('  Roll centres:   Canon: %.3f/%.3f | Live: %.3f/%.3f', canon.fRollCentreHeightFront or 0, canon.fRollCentreHeightRear or 0, liveRollFront, liveRollRear))
    print(string.format('  Target speed:   %.0f km/h        | Current: %.1f km/h', profile.targetTopSpeedKmh or 0, speedKmh))
    print('^3=======================================================^7')

    TriggerEvent('chat:addMessage', {
        color = { 60, 180, 240 },
        multiline = true,
        args = { 'Dynamics', string.format('[%s] %s | Drivetrain: %s | Mass: %d kg | Tune: %s\nCanon Force: %.3f (Live: %.3f) | Canon Grip: %.2f (Live: %.2f)',
            profile.displayName or modelName, profile.source, profile.drivetrain, math.floor(liveMass), activeTuneInfo, canon.fInitialDriveForce or 0, liveDriveForce, canon.fTractionCurveMax or 0, liveTractionMax) }
    })
end

RegisterCommand('handlinginfo', function()
    if SunsetVehicleDynamics.Config.Debug then showHandlingInfo() end
end, false)

RegisterNetEvent('sunset:vehicleDynamics:diagnose', showHandlingInfo)

local function reapplyHandling()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local veh = GetVehiclePedIsIn(ped, false)
        SVD.appliedEntities[veh] = nil
        SVD.ApplyVehicleDynamics(veh, true)
        -- Persisted ECU restored via sunset:vehicleDynamics:baselineRestored
    end

    print('^2[vehicle_dynamics] Handling profile re-applied successfully!^7')
    TriggerEvent('chat:addMessage', {
        color = { 100, 240, 100 },
        multiline = false,
        args = { 'Dynamics', 'Vehicle dynamics profile reloaded and synchronized with active tuning.' }
    })
end

RegisterCommand('handlingreload', function()
    if SunsetVehicleDynamics.Config.Debug then reapplyHandling() end
end, false)

RegisterNetEvent('sunset:vehicleDynamics:reapply', reapplyHandling)

RegisterCommand('vehbenchmark', function()
    SVD.RunVehicleBenchmark()
end, false)

RegisterCommand('handlingtest', function()
    SVD.RunVehicleBenchmark()
end, false)
