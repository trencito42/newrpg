--[[
    Sunset Vehicle Dynamics - Diagnostics & Benchmark Suite
    Gated by Config.Debug.
    Provides deep inspection of canonical baseline vs live effective handling,
    hot reloading, and live physical performance benchmarking.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

RegisterCommand('handlinginfo', function()
    if not SunsetVehicleDynamics.Config.Debug then
        return
    end

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
    print(string.format('^2Profile Model: %s | Source: %s | Archetype: %s | Class: %d^7', profile.model or 'unknown', profile.source or 'unknown', profile.archetype or 'custom', classId))
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
    print(string.format('  Gears:          Canon: %d        | Live: %d', canon.nInitialDriveGears or 0, liveGears))
    print('^3=======================================================^7')

    TriggerEvent('chat:addMessage', {
        color = { 60, 180, 240 },
        multiline = true,
        args = { 'Dynamics', string.format('[%s] %s | Drivetrain: %s | Mass: %d kg | Tune: %s\nCanon Force: %.3f (Live: %.3f) | Canon Grip: %.2f (Live: %.2f)',
            modelName, profile.source, profile.drivetrain, math.floor(liveMass), activeTuneInfo, canon.fInitialDriveForce or 0, liveDriveForce, canon.fTractionCurveMax or 0, liveTractionMax) }
    })
end, false)

RegisterCommand('handlingreload', function()
    if not SunsetVehicleDynamics.Config.Debug then
        return
    end

    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local veh = GetVehiclePedIsIn(ped, false)
        SVD.appliedEntities[veh] = nil
        SVD.ApplyVehicleDynamics(veh, true)

        -- If vehicle is tuned in sunset_tuning, reapply the active tune over the fresh baseline
        if GetResourceState('sunset_tuning') == 'started' then
            pcall(function()
                local plate = GetVehicleNumberPlateText(veh)
                local tune = exports.sunset_tuning:GetTuneForPlate(plate)
                if tune and tune.stage and tune.stage ~= 'stock' then
                    exports.sunset_tuning:ApplyTune(veh, tune, false)
                end
            end)
        end
    end

    print('^2[vehicle_dynamics] Handling profile re-applied successfully!^7')
    TriggerEvent('chat:addMessage', {
        color = { 100, 240, 100 },
        multiline = false,
        args = { 'Dynamics', 'Vehicle dynamics profile reloaded and synchronized with active tuning.' }
    })
end, false)

local isTesting = false
RegisterCommand('handlingtest', function()
    if not SunsetVehicleDynamics.Config.Debug then
        return
    end

    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then
        TriggerEvent('chat:addMessage', {
            color = { 255, 80, 80 },
            multiline = false,
            args = { 'Dynamics Test', 'You must be in a vehicle.' }
        })
        return
    end

    if isTesting then
        TriggerEvent('chat:addMessage', {
            color = { 255, 200, 50 },
            multiline = false,
            args = { 'Dynamics Test', 'Test already in progress. Stop vehicle to abort.' }
        })
        return
    end

    local veh = GetVehiclePedIsIn(ped, false)
    if GetPedInVehicleSeat(veh, -1) ~= ped then
        TriggerEvent('chat:addMessage', {
            color = { 255, 80, 80 },
            multiline = false,
            args = { 'Dynamics Test', 'You must be in the driver seat.' }
        })
        return
    end

    CreateThread(function()
        isTesting = true
        TriggerEvent('chat:addMessage', {
            color = { 100, 240, 100 },
            multiline = false,
            args = { 'Dynamics Test', 'Bring car to complete stop to initiate benchmark...' }
        })

        while isTesting do
            local speedKmh = GetEntitySpeed(veh) * 3.6
            if speedKmh < 1.0 then break end
            Wait(100)
        end

        TriggerEvent('chat:addMessage', {
            color = { 50, 200, 255 },
            multiline = false,
            args = { 'Dynamics Test', 'READY! Accelerate at full throttle now!' }
        })

        while isTesting do
            local speedKmh = GetEntitySpeed(veh) * 3.6
            if speedKmh > 2.0 then break end
            Wait(10)
        end

        local startTime = GetGameTimer()
        local time0to100 = nil
        local maxSpeed = 0.0

        while isTesting do
            local speedKmh = GetEntitySpeed(veh) * 3.6
            if speedKmh > maxSpeed then maxSpeed = speedKmh end
            if not time0to100 and speedKmh >= 100.0 then
                time0to100 = (GetGameTimer() - startTime) / 1000.0
                TriggerEvent('chat:addMessage', {
                    color = { 100, 255, 100 },
                    multiline = false,
                    args = { 'Dynamics Test', string.format('Measured 0-100 km/h: %.2f s! Slam brakes now for 100-0 measurement!', time0to100) }
                })
                break
            end
            Wait(10)
        end

        if time0to100 then
            local brakeStartPos = nil
            local brakeDistance = nil

            while isTesting do
                local speedKmh = GetEntitySpeed(veh) * 3.6
                local isBraking = IsControlPressed(0, 72) or IsControlPressed(0, 76)
                if isBraking and not brakeStartPos and speedKmh >= 90.0 then
                    brakeStartPos = GetEntityCoords(veh)
                end
                if brakeStartPos and speedKmh < 1.0 then
                    local stopPos = GetEntityCoords(veh)
                    brakeDistance = #(brakeStartPos - stopPos)
                    break
                end
                Wait(10)
            end

            if brakeDistance then
                TriggerEvent('chat:addMessage', {
                    color = { 255, 220, 50 },
                    multiline = false,
                    args = { 'Dynamics Test', string.format('Measured 100-0 km/h Braking Distance: %.1f meters (Peak Speed: %.1f km/h).', brakeDistance, maxSpeed) }
                })
            end
        end

        isTesting = false
    end)
end, false)
