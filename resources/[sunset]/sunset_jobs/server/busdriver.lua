-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Bus Driver Server Controller (server/busdriver.lua)
--  Green Route Scheduled Transit with Passenger Boarding & Fares.
-- ═══════════════════════════════════════════════════════════════

local function resolveBus(session, cfg, vehicleNetId)
    if not session or not cfg then return nil end
    local netId = session.vehicleNetId
    if not netId then return nil end
    if vehicleNetId ~= nil and tonumber(vehicleNetId) ~= netId then return nil end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return nil end
    if GetEntityModel(entity) ~= joaat(cfg.busModel or 'bus') then return nil end
    return entity
end

exports.sunset_core:RegisterCallback('sunset:jobs:busdriver:start', function(source, selectedRouteId)
    local cfg = Sunset.GetJobConfig('busdriver')
    if not cfg then return nil, { localeKey = 'jobs.message.invalid_job_config' } end

    if not SunsetJobs_ValidateCoords(source, cfg.depot.coords, 25.0) then
        return nil, { localeKey = 'jobs.message.go_to_the_bus_depot_to_start_work' }
    end

    local route = cfg.routes and cfg.routes[1]
    if not route or not route.stops or #route.stops == 0 then
        return nil, { localeKey = 'jobs.message.no_bus_routes_available' }
    end

    local stopsData = {}
    for i, s in ipairs(route.stops) do
        local pCoords = nil
        if s.passengerCoords then
            pCoords = {}
            for _, pc in ipairs(s.passengerCoords) do
                pCoords[#pCoords + 1] = { x = pc.x, y = pc.y, z = pc.z, w = pc.w or 0.0 }
            end
        end
        stopsData[#stopsData + 1] = {
            coords = { x = s.coords.x, y = s.coords.y, z = s.coords.z, w = s.coords.w or 0.0 },
            passengerCoords = pCoords,
            label  = s.label or (exports.sunset_core:TFor(source, 'jobs.presentation.stop') .. i),
        }
    end

    local session, err = SunsetJobs_StartSession(source, 'busdriver', {
        routeId               = route.id or 'green_route',
        label                 = route.label or exports.sunset_core:TFor(source, 'jobs.presentation.green_line'),
        stops                 = stopsData,
        totalStops            = #stopsData,
        currentStopIndex      = 1,
        passengersTransported = 0,
        totalEarned           = 0,
        stage                 = 'driving',
    })

    if not session then
        return nil, err
    end

    return {
        routeId    = route.id,
        label      = route.label,
        stops      = stopsData,
        totalStops = #stopsData,
        stopIndex  = 1,
        depot      = cfg.depot,
        spawns     = cfg.depot.spawns,
    }
end)

exports.sunset_core:RegisterCallback('sunset:jobs:busdriver:boardPassengers', function(source, vehicleNetId, stopIndex)
    local cfg = Sunset.GetJobConfig('busdriver')
    local session = SunsetJobs_GetSession(source)
    if not session or session.jobId ~= 'busdriver' then
        return { success = false, err = 'Nicio tura activa de sofer de autobuz!' }
    end

    local bus = resolveBus(session, cfg, vehicleNetId)
    if not bus then
        return { success = false, err = 'Autobuzul tau oficial de serviciu trebuie sa fie in statie!' }
    end

    local expectedIndex = session.data.currentStopIndex or 1
    if stopIndex and tonumber(stopIndex) ~= expectedIndex then
        return { success = false, err = 'Oprire necorespunzatoare cu traseul!' }
    end

    local stop = session.data.stops and session.data.stops[expectedIndex]
    if not stop then
        return { success = false, err = 'Statia de autobuz nu a fost gasita!' }
    end

    -- Validate bus position near stop
    local stopCoords = vector3(stop.coords.x, stop.coords.y, stop.coords.z)
    if not SunsetJobs_ValidateCoordsHorizontal(source, stopCoords, (cfg.stopRadius or 7.5) + 6.0) then
        return { success = false, err = 'Parcheaza autobuzul in zona marcata a statiei!' }
    end

    -- Random passenger count (1 - 3 passengers)
    local passengers = math.random(1, 3)
    local stopPay = (cfg.payPerStop or 120) + (passengers * (cfg.payPerPassenger or 35))
    local stopXp = cfg.xpPerStop or 20

    if not SunsetJobs_PayReward(source, 'busdriver', stopPay, 'busdriver_fare', false, stopXp) then
        return { success = false, err = 'Plata opririi nu a putut fi procesata. Incearca din nou.' }
    end

    -- Update session state
    session.data.passengersTransported = (session.data.passengersTransported or 0) + passengers
    session.data.totalEarned = (session.data.totalEarned or 0) + stopPay
    session.data.currentStopIndex = expectedIndex + 1

    local isLastStop = session.data.currentStopIndex > session.data.totalStops
    if isLastStop then
        session.data.stage = 'returning'
    end

    return {
        success = true,
        passengers = passengers,
        earned = stopPay,
        totalEarned = session.data.totalEarned,
        passengersTotal = session.data.passengersTransported,
        nextStopIndex = session.data.currentStopIndex,
        isLastStop = isLastStop,
    }
end)

exports.sunset_core:RegisterCallback('sunset:jobs:busdriver:finishRoute', function(source, vehicleNetId)
    local cfg = Sunset.GetJobConfig('busdriver')
    local session = SunsetJobs_GetSession(source)
    if not session or session.jobId ~= 'busdriver' then
        return { success = false, err = 'Nicio tura activa de sofer de autobuz!' }
    end

    if (session.data.currentStopIndex or 1) <= (session.data.totalStops or 6) then
        return { success = false, err = 'Nu ai completat toate opririle de pe traseu!' }
    end

    local returnTarget = cfg.depot.returnCoords or cfg.depot.coords
    local returnV3 = vector3(returnTarget.x, returnTarget.y, returnTarget.z)
    if not SunsetJobs_ValidateCoordsHorizontal(source, returnV3, 20.0) then
        return { success = false, err = 'Trebuie sa returnezi autobuzul la depou pentru a incasa bonusul!' }
    end

    local bonus = cfg.routeBonusPay or 450
    local xpBonus = cfg.xpPerRoute or 65

    if not SunsetJobs_PayReward(source, 'busdriver', bonus, 'busdriver_route_bonus', true, xpBonus) then
        return { success = false, err = 'Bonusul rutei nu a putut fi procesat. Incearca din nou.' }
    end

    local grandTotal = (session.data.totalEarned or 0) + bonus
    local passengersTotal = session.data.passengersTransported or 0

    SunsetJobs_ClearSession(source)

    return {
        success = true,
        bonus = bonus,
        grandTotal = grandTotal,
        passengersTotal = passengersTotal,
    }
end)
