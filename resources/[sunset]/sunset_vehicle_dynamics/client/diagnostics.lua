--[[
    Sunset Vehicle Dynamics - Diagnostics & Testing Tools
    Commands:
      /handlinginfo: Inspect active dynamics baseline vs live vehicle handling.
      /handlingreload: Hot reload profiles in development.
      /handlingtest: Live benchmark for 0-100 km/h, 100-0 km/h braking, and top speed.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

RegisterCommand('handlinginfo', function()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then
        print('^1[vehicle_dynamics] You must be inside a vehicle to inspect handling info.^7')
        TriggerEvent('chat:addMessage', {
            color = { 255, 80, 80 },
            multiline = false,
            args = { 'Dynamics', 'You must be inside a vehicle to use /handlinginfo.' }
        })
        return
    end

    local veh = GetVehiclePedIsIn(ped, false)
    local modelHash = GetEntityModel(veh)
    local modelName = GetDisplayNameFromVehicleModel(modelHash) or 'UNKNOWN'
    local classId = GetVehicleClass(veh)
    local profile = SunsetVehicleDynamics.Resolve(modelHash, classId)

    local liveMass = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fMass')
    local liveDriveForce = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fInitialDriveForce')
    local liveFlatVel = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fInitialDriveMaxFlatVel')
    local liveBrakeForce = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fBrakeForce')
    local liveTractionMax = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fTractionCurveMax')
    local liveTractionMin = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fTractionCurveMin')
    local liveSteerLock = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fSteeringLock')
    local liveDriveBias = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fDriveBiasFront')

    local msgHeader = string.format('^3--- Vehicle Dynamics: %s (Hash: %d) ---^7', modelName, modelHash)
    local msgProfile = string.format('^2Profile: %s | Source: %s | Archetype: %s^7', profile.model or 'unknown', profile.source or 'unknown', profile.archetype or 'custom')
    local msgDrivetrain = string.format('Drivetrain: ^5%s^7 (DriveBiasFront: %.2f) | Weight: ^5%d kg^7', profile.drivetrain or 'unknown', liveDriveBias, math.floor(liveMass))
    local msgPerformance = string.format('DriveForce: ^5%.3f^7 | MaxFlatVel: ^5%.1f^7 | BrakeForce: ^5%.2f^7', liveDriveForce, liveFlatVel, liveBrakeForce)
    local msgGrip = string.format('Traction Max: ^5%.2f^7 | Min: ^5%.2f^7 | SteerLock: ^5%.1f deg^7', liveTractionMax, liveTractionMin, liveSteerLock)

    print(msgHeader)
    print(msgProfile)
    print(msgDrivetrain)
    print(msgPerformance)
    print(msgGrip)

    TriggerEvent('chat:addMessage', {
        color = { 60, 180, 240 },
        multiline = true,
        args = { 'Dynamics', string.format('%s\n%s\n%s\n%s', msgProfile, msgDrivetrain, msgPerformance, msgGrip) }
    })
end, false)

RegisterCommand('handlingreload', function()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local veh = GetVehiclePedIsIn(ped, false)
        SVD.ApplyVehicleDynamics(veh, true)
    end
    print('^2[vehicle_dynamics] Handling profiles re-applied!^7')
    TriggerEvent('chat:addMessage', {
        color = { 100, 240, 100 },
        multiline = false,
        args = { 'Dynamics', 'Vehicle dynamics profile reloaded successfully!' }
    })
end, false)

local isTesting = false
RegisterCommand('handlingtest', function()
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
            args = { 'Dynamics Test', 'Bring car to complete stop to initiate 0-100 & braking test...' }
        })

        while isTesting do
            local speedKmh = GetEntitySpeed(veh) * 3.6
            if speedKmh < 1.0 then
                break
            end
            Wait(100)
        end

        TriggerEvent('chat:addMessage', {
            color = { 50, 200, 255 },
            multiline = false,
            args = { 'Dynamics Test', 'READY! Accelerate at full throttle now!' }
        })

        -- Wait for throttle launch
        while isTesting do
            local speedKmh = GetEntitySpeed(veh) * 3.6
            if speedKmh > 2.0 then
                break
            end
            Wait(10)
        end

        local startTime = GetGameTimer()
        local time0to100 = nil
        local maxSpeed = 0.0

        -- 0 - 100 km/h measurement
        while isTesting do
            local speedKmh = GetEntitySpeed(veh) * 3.6
            if speedKmh > maxSpeed then maxSpeed = speedKmh end
            if not time0to100 and speedKmh >= 100.0 then
                time0to100 = (GetGameTimer() - startTime) / 1000.0
                TriggerEvent('chat:addMessage', {
                    color = { 100, 255, 100 },
                    multiline = false,
                    args = { 'Dynamics Test', string.format('0-100 km/h: %.2f seconds! Now slam the brakes at 100 km/h!', time0to100) }
                })
                break
            end
            Wait(10)
        end

        -- Wait for braking phase from 100 to 0
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
                    args = { 'Dynamics Test', string.format('100-0 km/h Braking Distance: %.1f meters.', brakeDistance) }
                })
            end
        end

        isTesting = false
    end)
end, false)
