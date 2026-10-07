--[[
    Developer-only vehicle benchmark (requires Config.Debug).
    Measures standing-start acceleration, vmax window, and controlled braking.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

local benchmarkActive = false

local function chat(msg, color)
    TriggerEvent('chat:addMessage', {
        color = color or { 100, 200, 255 },
        multiline = false,
        args = { 'VehBenchmark', msg },
    })
end

local function speedKmh(veh)
    return GetEntitySpeed(veh) * 3.6
end

local function driverVehicle()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return nil end
    local veh = GetVehiclePedIsIn(ped, false)
    if veh == 0 or GetPedInVehicleSeat(veh, -1) ~= ped then return nil end
    return veh
end

function SVD.RunVehicleBenchmark()
    if not SunsetVehicleDynamics.Config.Debug then return end
    if benchmarkActive then
        chat('Benchmark already running. Exit vehicle or wait for timeout.', { 255, 200, 50 })
        return
    end

    local veh = driverVehicle()
    if not veh then
        chat('Driver seat required.', { 255, 80, 80 })
        return
    end

    benchmarkActive = true
    local startMs = GetGameTimer()
    local hardTimeoutMs = 120000
    local results = {
        standing = false,
        t0_100 = nil,
        t0_200 = nil,
        vmax = 0.0,
        vmaxWindowSec = 45,
        brakeFromKmh = nil,
        brakeDistanceM = nil,
    }

    CreateThread(function()
        chat('Phase 1: bring vehicle to complete stop (<0.5 km/h).', { 200, 200, 200 })

        while benchmarkActive do
            if not DoesEntityExist(veh) or driverVehicle() ~= veh then
                chat('Aborted: left vehicle.', { 255, 80, 80 })
                benchmarkActive = false
                return
            end
            if GetGameTimer() - startMs > hardTimeoutMs then
                chat('Aborted: 120s timeout.', { 255, 80, 80 })
                benchmarkActive = false
                return
            end
            if speedKmh(veh) < 0.5 then break end
            Wait(50)
        end

        chat('Phase 2: full throttle from standstill (measuring from 0.5 km/h).', { 100, 240, 100 })
        local accelStart = nil
        local vmaxPhaseStart = nil

        while benchmarkActive do
            if not DoesEntityExist(veh) or driverVehicle() ~= veh then
                chat('Aborted: left vehicle.', { 255, 80, 80 })
                benchmarkActive = false
                return
            end
            if GetGameTimer() - startMs > hardTimeoutMs then break end

            local v = speedKmh(veh)
            if not accelStart and v >= 0.5 then
                accelStart = GetGameTimer()
                results.standing = true
            end
            if accelStart then
                local elapsed = (GetGameTimer() - accelStart) / 1000.0
                if not results.t0_100 and v >= 100.0 then results.t0_100 = elapsed end
                if not results.t0_200 and v >= 200.0 then results.t0_200 = elapsed end
                if v > results.vmax then results.vmax = v end
                if not vmaxPhaseStart then vmaxPhaseStart = GetGameTimer() end
                if (GetGameTimer() - vmaxPhaseStart) / 1000.0 >= results.vmaxWindowSec then
                    break
                end
            end
            Wait(10)
        end

        chat(string.format(
            'Accel done. 0-100: %s | 0-200: %s | vmax(%ds): %.1f km/h. Phase 3: brake from ~100 km/h.',
            results.t0_100 and string.format('%.2fs', results.t0_100) or 'n/a',
            results.t0_200 and string.format('%.2fs', results.t0_200) or 'n/a',
            results.vmaxWindowSec,
            results.vmax
        ), { 255, 220, 50 })

        local brakeStartPos = nil
        local brakePhaseStart = GetGameTimer()
        while benchmarkActive do
            if not DoesEntityExist(veh) or driverVehicle() ~= veh then
                chat('Aborted: left vehicle.', { 255, 80, 80 })
                benchmarkActive = false
                return
            end
            if GetGameTimer() - startMs > hardTimeoutMs then break end

            local v = speedKmh(veh)
            local braking = IsControlPressed(0, 72) or IsControlPressed(0, 76)
            if braking and not brakeStartPos and v >= 95.0 and v <= 105.0 then
                results.brakeFromKmh = v
                brakeStartPos = GetEntityCoords(veh)
            end
            if brakeStartPos and v < 1.0 then
                results.brakeDistanceM = #(brakeStartPos - GetEntityCoords(veh))
                break
            end
            if GetGameTimer() - brakePhaseStart > 30000 then
                chat('Brake phase timeout (no 100-0 sample).', { 255, 140, 80 })
                break
            end
            Wait(10)
        end

        local profile = SunsetVehicleDynamics.Resolve(GetEntityModel(veh), GetVehicleClass(veh))
        local target = profile and profile.targetTopSpeedKmh or 0
        print('^3========== VEHICLE BENCHMARK (MEASURED) ==========^7')
        print(string.format('Model: %s | Target top speed (design): %d km/h', profile and profile.model or 'unknown', target))
        print(string.format('0-100 km/h: %s', results.t0_100 and string.format('%.2f s', results.t0_100) or 'not reached'))
        print(string.format('0-200 km/h: %s', results.t0_200 and string.format('%.2f s', results.t0_200) or 'not reached'))
        print(string.format('Max speed observed (%ds): %.1f km/h', results.vmaxWindowSec, results.vmax))
        if results.brakeDistanceM then
            print(string.format('Brake distance from %.1f km/h: %.1f m', results.brakeFromKmh or 0, results.brakeDistanceM))
        else
            print('Brake distance: not captured')
        end
        print('^3================================================^7')

        benchmarkActive = false
    end)
end
