local Rides = {}
local rideSeq = 0
local DriverAvailable = {}
local DriverSessionStats = {}
local MeterThreads = {}
local RequestCooldown = {}

-- ═══════════════════════════════════════════════════════════════
--  [SESSIONS MIGRATION] Mirror active rides into sunset_sessions so the
--  canonical framework owns lifecycle triggers (downed/jail/drop for EITHER
--  party) and admin diagnostics. Taxi keeps its own meter/settlement logic
--  (already hardened: P5-04 settling lock, P6-02 downed/jail cancel); the
--  framework session is the authoritative "this ride is live" record.
-- ═══════════════════════════════════════════════════════════════
local SessionsService = GetResourceState('sunset_sessions') == 'started'
local function sessionsCall(method, ...)
    if GetResourceState('sunset_sessions') ~= 'started' then SessionsService = false return nil end
    local args = table.pack(...)
    local ok, res = pcall(function()
        return exports.sunset_sessions[method](exports.sunset_sessions, table.unpack(args, 1, args.n))
    end)
    if not ok then return nil end
    return res
end

CreateThread(function()
    -- [PERF] explicit readiness instead of a fixed Wait hoping sunset_sessions loaded
    local waited = 0
    while GetResourceState('sunset_sessions') ~= 'started' and waited < 60000 do Wait(500); waited = waited + 500 end
    if GetResourceState('sunset_sessions') ~= 'started' then
        print('^3[sunset_taxi]^7 sunset_sessions not started; rides run without framework mirroring.')
        return
    end
    SessionsService = true
    sessionsCall('RegisterActivity', 'taxi_ride', {
        reconnect = 'ABANDON',
        onEndEvent = 'sunset:taxi:frameworkRideEnded',
    })
end)

-- NOTE: the 'sunset:taxi:frameworkRideEnded' handler lives next to
-- cancelRideForParty (Lua upvalue scoping: handlers cannot reference locals
-- declared later in the file).

local function createRideSession(driverSource, driverCharId, passengerCharId, rideId)
    if not SessionsService then return nil end
    local s = sessionsCall('CreateSession', {
        source = driverSource,
        charId = driverCharId,
        participants = { passengerCharId },
        activity = 'taxi_ride',
        timeoutSec = 3600,
        data = { rideId = rideId },
    })
    return type(s) == 'table' and s.id or nil
end

local function endRideSession(rideId)
    if not SessionsService then return end
    for _, ride in pairs(Rides) do
        if ride.id == rideId and ride.frameworkId then
            sessionsCall('EndSession', ride.frameworkId, 'COMPLETED', 'ride ended')
            ride.frameworkId = nil
            return
        end
    end
end


local function getChar(source)
    return exports.sunset_core:GetCharacter(source)
end

local function findSourceByCharacterId(characterId)
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local c = getChar(src)
        if c and c.id == characterId then
            return src
        end
    end
    return nil
end

local function isTaxiDriver(source)
    local char = getChar(source)
    if not char then return false end
    local factionId = Sunset.GetCharacterFaction(char)
    if factionId ~= Sunset.Taxi.factionId then return false end
    return exports.sunset_factions:IsOnDuty(source)
end

-- [JOBS AUDIT] Client-supplied destination coordinates fed straight into fare math: strings / NaN / huge
-- values raised errors inside callbacks or produced absurd fares. Coerce to finite, map-bounded numbers.
local function finiteNum(v, fallback)
    v = tonumber(v)
    if not v or v ~= v or v == math.huge or v == -math.huge then return fallback end
    return math.max(-10000.0, math.min(10000.0, v + 0.0))
end

local function encodeCoords(coords)
    if type(coords) ~= 'table' and type(coords) ~= 'vector3' then coords = {} end
    return {
        x = finiteNum(coords.x or coords[1], 0.0),
        y = finiteNum(coords.y or coords[2], 0.0),
        z = finiteNum(coords.z or coords[3], 0.0),
    }
end

local function getPlayerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    local c = GetEntityCoords(ped)
    if type(c) == 'vector3' then return c end
    return vector3(c.x or c[1] or 0.0, c.y or c[2] or 0.0, c.z or c[3] or 0.0)
end

local function distanceBetween(a, b)
    if not a or not b then return 999999.0 end
    return #(vector3(a.x, a.y, a.z) - vector3(b.x, b.y, b.z))
end

local function getDriverVehicleModel(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    local veh = GetVehiclePedIsIn(ped, false)
    if not veh or veh == 0 then return nil end
    return GetEntityModel(veh)
end

local function requireTaxiVehicle(source)
    local model = getDriverVehicleModel(source)
    if not model then
        return false, { localeKey = 'taxi.message.you_must_be_in_a_cab_vehicle' }
    end
    if not Sunset.Taxi.IsValidTaxiVehicle(model) then
        return false, { localeKey = 'taxi.message.you_must_use_a_company_cab_not_a_personal' }
    end
    return true
end

local function rideForPassenger(charId)
    for _, ride in pairs(Rides) do
        if ride.passengerCharId == charId and ride.status ~= 'completed' and ride.status ~= 'cancelled' then
            return ride
        end
    end
end

local function rideForDriver(charId)
    for _, ride in pairs(Rides) do
        if ride.driverCharId == charId and ride.status ~= 'completed' and ride.status ~= 'cancelled' then
            return ride
        end
    end
end

local function serializeRide(ride, viewerSource)
    if not ride then return nil end
    local viewerChar = getChar(viewerSource)
    local out = {
        id = ride.id,
        status = ride.status,
        fare = ride.fare,
        meterFare = ride.meterFare,
        distanceKm = ride.distanceKm,
        meterKm = ride.meterKm,
        pickup = ride.pickup,
        destination = ride.destination,
        passengerName = ride.passengerName,
        driverName = ride.driverName,
        createdAt = ride.createdAt,
        isPassenger = viewerChar and viewerChar.id == ride.passengerCharId,
        isDriver = viewerChar and viewerChar.id == ride.driverCharId,
        passengerServerId = ride.passengerSource,
        driverServerId = ride.driverSource,
    }
    return out
end

local function pushTaxiUpdate(source)
    TriggerClientEvent('sunset:client:taxiRefresh', source)
end

local function recordTaxiActivity(driverSource, ride, amount)
    local char = getChar(driverSource)
    if not char then return end
    local factionId = Sunset.GetCharacterFaction(char)
    if factionId ~= Sunset.Taxi.factionId then return end
    pcall(function()
        if FactionCore and FactionCore.auditLog then
            FactionCore.auditLog(factionId, char.id, 'taxi_ride_complete', ride.passengerCharId, {
                fare = amount,
                distanceKm = ride.meterKm or ride.distanceKm,
                rideId = ride.id,
            })
        end
    end)
    TriggerEvent('sunset:faction:activityComplete', driverSource, 'transport', {
        fare = amount,
        distanceKm = ride.meterKm or ride.distanceKm,
    })
end

local function createDispatchForRide(ride)
    pcall(function()
        local call = exports.sunset_dispatch:CreateServiceCall(
            ride.passengerSource,
            'taxi',
            ride.pickup,
            { rideId = ride.id, fare = ride.fare },
            ('Cab to %s — $%s'):format(ride.destination.label or 'destination', ride.fare)
        )
        if call and call.id then
            ride.dispatchCallId = call.id
        end
    end)
end

local function stopMeter(rideId)
    MeterThreads[rideId] = nil
end

local function startMeter(ride)
    local cfg = Sunset.Taxi.meter or {}
    local tickMs = cfg.tickMs or 2000
    local minMove = cfg.minMoveMeters or 4.0
    local idleSec = cfg.idleTimeoutSec or 45
    ride.meterKm = 0.0
    ride.meterFare = ride.fare or Sunset.Taxi.minFare
    ride.lastMeterPos = getPlayerCoords(ride.driverSource)
    ride.lastMoveAt = os.time()
    MeterThreads[ride.id] = true

    CreateThread(function()
        while MeterThreads[ride.id] and ride.status == 'in_progress' do
            Wait(tickMs)
            if not ride.driverSource or ride.status ~= 'in_progress' then break end

            local coords = getPlayerCoords(ride.driverSource)
            local last = ride.lastMeterPos
            if coords and last then
                local moved = distanceBetween(coords, last)
                if moved >= minMove then
                    ride.meterKm = (ride.meterKm or 0) + (moved / 1000.0)
                    ride.lastMeterPos = coords
                    ride.lastMoveAt = os.time()
                    local baseFare = Sunset.Taxi.baseFare or 75
                    local perKm = Sunset.Taxi.perKm or 35
                    local computed = math.floor(baseFare + ride.meterKm * perKm)
                    local maxFare = math.floor((ride.fare or computed) * (cfg.maxFareMultiplier or 1.5))
                    ride.meterFare = math.min(math.max(computed, Sunset.Taxi.minFare or 100), maxFare)
                elseif ride.lastMoveAt and (os.time() - ride.lastMoveAt) >= idleSec then
                    if not ride.idleNotified then
                        ride.idleNotified = true
                        TriggerClientEvent('sunset:client:notify', ride.driverSource,
                            'Meter paused — vehicle idle too long', 'warning')
                        local passengerSrc = findSourceByCharacterId(ride.passengerCharId)
                        if passengerSrc then
                            TriggerClientEvent('sunset:client:notify', passengerSrc,
                                'Taxi meter paused — vehicle idle', 'info')
                        end
                    end
                end
            end

            TriggerClientEvent('sunset:client:taxiMeterUpdate', ride.driverSource, {
                rideId = ride.id,
                meterKm = ride.meterKm,
                meterFare = ride.meterFare,
            })
            local passengerSrc = findSourceByCharacterId(ride.passengerCharId)
            if passengerSrc then
                TriggerClientEvent('sunset:client:taxiMeterUpdate', passengerSrc, {
                    rideId = ride.id,
                    meterKm = ride.meterKm,
                    meterFare = ride.meterFare,
                })
            end
        end
        MeterThreads[ride.id] = nil
    end)
end

local function broadcastDrivers(event, payload)
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        if isTaxiDriver(src) and DriverAvailable[src] ~= false then
            TriggerClientEvent(event, src, payload)
        end
    end
end

-- [AUDIT P6-02] Cancel a ride for both parties and stop the meter. Previously a
-- downed/jailed passenger wedged the ride permanently: the meter kept running,
-- complete required destination proximity, and in_progress rides could not be
-- cancelled by either side.
local function cancelRideForParty(ride, reason)
    if not ride then return end
    if ride.status == 'completed' or ride.status == 'cancelled' or ride.status == 'settling' then return end
    ride.status = 'cancelled'
    stopMeter(ride.id)
    if ride.frameworkId then
        -- end WITHOUT re-entering cancelRideForParty (framework onEnd is guarded
        -- by ride.status ~= 'cancelled' above)
        sessionsCall('EndSession', ride.frameworkId, 'CANCELLED', reason or 'cancelled')
        ride.frameworkId = nil
    end
    for _, src in ipairs({ ride.driverSource, findSourceByCharacterId(ride.passengerCharId) }) do
        if src and GetPlayerName(src) then
            TriggerClientEvent('sunset:client:notify', src, reason, 'warning')
            TriggerClientEvent('sunset:client:taxiRideEnded', src)
            pushTaxiUpdate(src)
        end
    end
    broadcastDrivers('sunset:client:taxiRideTaken', { id = ride.id })
end

local function cancelRidesForSource(src, reason)
    local char = getChar(src)
    if not char then return end
    local ride = rideForPassenger(char.id) or rideForDriver(char.id)
    if ride then cancelRideForParty(ride, reason) end
end

-- [SESSIONS] Framework ended a mirrored ride (downed/jail/drop/deadline):
-- cancel the local ride so meter + UI stop for both parties.
AddEventHandler('sunset:taxi:frameworkRideEnded', function(sess, state)
    if type(sess) ~= 'table' then return end
    local rideId = sess.data and sess.data.rideId
    local ride = rideId and Rides[rideId] or nil
    if ride and ride.status ~= 'completed' and ride.status ~= 'cancelled' and ride.status ~= 'settling' then
        cancelRideForParty(ride, 'Ride ended - ' .. tostring(state or 'session closed'))
    end
end)

AddEventHandler('sunset:death:playerDowned', function(src)
    cancelRidesForSource(src, 'Ride ended - a party is downed')
end)

AddEventHandler('sunset:faction:playerJailed', function(src)
    cancelRidesForSource(src, 'Ride ended - a party was jailed')
end)

local function addSociety(amount)
    local cut = math.floor(amount or 0)
    if cut <= 0 then return end
    pcall(function()
        MySQL.update.await('UPDATE societies SET balance = balance + ? WHERE name = ?', { cut, 'taxi' })
    end)
end

local function getDriverStats(charId)
    local session = DriverSessionStats[charId] or { rides = 0, earnings = 0 }
    local todayRides, todayEarnings = 0, 0
    pcall(function()
        local row = MySQL.single.await([[
            SELECT COUNT(*) AS rides, COALESCE(SUM(fare), 0) AS earnings
            FROM taxi_rides
            WHERE driver_character_id = ? AND status = 'completed' AND DATE(completed_at) = CURDATE()
        ]], { charId })
        if row then
            todayRides = tonumber(row.rides) or 0
            todayEarnings = tonumber(row.earnings) or 0
        end
    end)
    return {
        sessionRides = session.rides or 0,
        sessionEarnings = session.earnings or 0,
        todayRides = todayRides,
        todayEarnings = todayEarnings,
    }
end

local function buildAppData(source)
    local char = getChar(source)
    if not char then return nil end

    local destinations = {}
    for _, dest in ipairs(Sunset.Taxi.BuildAllDestinations()) do
        local c = dest.coords
        destinations[#destinations + 1] = {
            id = dest.id,
            label = dest.label,
            category = dest.category,
            x = c.x,
            y = c.y,
        }
    end

    local ped = GetPlayerPed(source)
    local px, py = GetEntityCoords(ped)
    if type(px) == 'vector3' then
        px, py = px.x, px.y
    end

    local data = {
        appName = Sunset.Taxi.appName,
        appShort = Sunset.Taxi.appShort,
        isDriver = Sunset.GetCharacterFaction(char) == Sunset.Taxi.factionId,
        onDuty = isTaxiDriver(source),
        driverAvailable = DriverAvailable[source] ~= false,
        destinations = destinations,
        mapBounds = Sunset.Taxi.mapBounds,
        playerPos = { x = px + 0.0, y = py + 0.0 },
        activeRide = nil,
        pendingOffers = {},
        pricing = {
            base = Sunset.Taxi.baseFare,
            perKm = Sunset.Taxi.perKm,
            min = Sunset.Taxi.minFare,
            companyCut = math.floor((Sunset.Taxi.companyCut or 0.12) * 100),
        },
        tipOptions = Sunset.Taxi.tipOptions or { 25, 50, 100 },
    }

    if Sunset.GetCharacterFaction(char) == Sunset.Taxi.factionId then
        data.driverStats = getDriverStats(char.id)
    end

    local active = rideForPassenger(char.id) or rideForDriver(char.id)
    data.activeRide = serializeRide(active, source)

    if isTaxiDriver(source) and DriverAvailable[source] ~= false then
        local offers = {}
        for _, ride in pairs(Rides) do
            if ride.status == 'pending' and not ride.driverCharId then
                offers[#offers + 1] = serializeRide(ride, source)
            end
        end
        table.sort(offers, function(a, b) return (a.id or 0) < (b.id or 0) end)
        data.pendingOffers = offers
    end

    return data
end

exports.sunset_core:RegisterCallback('sunset:getTaxiAppData', function(source)
    return buildAppData(source)
end)

local function startRide(source, pickup, destination, destLabel)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'taxi.message.no_character' } end
    if isTaxiDriver(source) then return nil, { localeKey = 'taxi.message.go_off_duty_to_request_a_ride' } end
    if rideForPassenger(char.id) then return nil, { localeKey = 'taxi.message.you_already_have_an_active_ride' } end
    -- [JOBS AUDIT] request -> cancel -> request spam re-broadcast an offer + dispatch call each time.
    local nowMs = GetGameTimer()
    if RequestCooldown[source] and nowMs - RequestCooldown[source] < 8000 then
        return nil, { localeKey = 'taxi.message.you_already_have_an_active_ride' }
    end
    RequestCooldown[source] = nowMs

    pickup = encodeCoords(pickup)
    destination = encodeCoords(destination)
    local fare, km = Sunset.TaxiEstimateFare(pickup, destination)
    if not fare or fare ~= fare or fare > 100000 then return nil, { localeKey = 'taxi.message.invalid_destination' } end
    local label = tostring(destLabel or 'Custom destination'):sub(1, 64)

    rideSeq = rideSeq + 1
    local ride = {
        id = rideSeq,
        passengerSource = source,
        passengerCharId = char.id,
        passengerName = exports.sunset_core:GetPlayerDisplayName(source),
        driverSource = nil,
        driverCharId = nil,
        driverName = nil,
        pickup = pickup,
        destination = { x = destination.x, y = destination.y, z = destination.z, label = label },
        fare = fare,
        distanceKm = km,
        status = 'pending',
        createdAt = os.time(),
    }
    Rides[ride.id] = ride
    createDispatchForRide(ride)

    broadcastDrivers('sunset:client:taxiNewOffer', serializeRide(ride, source))
    TriggerClientEvent('sunset:client:notify', source,
        exports.sunset_core:TFor(source, 'taxi.message.ride_requested_value_to_value_waiting_for_a_driver', fare, label), 'success')

    SetTimeout((Sunset.Taxi.requestTimeout or 300) * 1000, function()
        local current = Rides[ride.id]
        if current and current.status == 'pending' then
            current.status = 'cancelled'
            local pSrc = findSourceByCharacterId(current.passengerCharId)
            if pSrc then
                TriggerClientEvent('sunset:client:notify', pSrc, exports.sunset_core:TFor(pSrc, 'taxi.message.no_drivers_accepted_your_ride'), 'error')
                pushTaxiUpdate(pSrc)
            end
            broadcastDrivers('sunset:client:taxiRideTaken', { id = ride.id })
            if current.dispatchCallId then
                pcall(function() exports.sunset_dispatch:CancelCall(source, 'taxi', current.dispatchCallId, 'Ride request expired') end)
            end
        end
    end)

    return serializeRide(ride, source)
end

local function estimateRide(pickup, destination, destLabel)
    pickup = encodeCoords(pickup)
    destination = encodeCoords(destination)
    local fare, km = Sunset.TaxiEstimateFare(pickup, destination)
    return {
        fare = fare,
        distanceKm = km,
        label = destLabel or 'Custom destination',
        destination = destination,
    }
end

exports.sunset_core:RegisterCallback('sunset:taxiEstimate', function(source, destinationId, pickup)
    pickup = pickup or {}
    local destRow = Sunset.Taxi.FindDestination(destinationId)
    if not destRow then return nil, { localeKey = 'taxi.message.invalid_destination' } end
    return estimateRide(pickup, destRow.coords, destRow.label)
end)

exports.sunset_core:RegisterCallback('sunset:taxiEstimateCoords', function(source, pickup, destination)
    if not destination or not destination.x then return nil, { localeKey = 'taxi.message.invalid_destination' } end
    return estimateRide(pickup, destination, destination.label)
end)

exports.sunset_core:RegisterCallback('sunset:taxiRequestRide', function(source, destinationId, pickup)
    pickup = encodeCoords(GetEntityCoords(GetPlayerPed(source)))
    local destRow = Sunset.Taxi.FindDestination(destinationId)
    if not destRow then return nil, { localeKey = 'taxi.message.pick_a_destination' } end
    return startRide(source, pickup, destRow.coords, destRow.label)
end)

exports.sunset_core:RegisterCallback('sunset:taxiRequestRideCoords', function(source, pickup, destination)
    if not destination or not destination.x then return nil, { localeKey = 'taxi.message.pick_a_destination_on_the_map' } end
    pickup = encodeCoords(GetEntityCoords(GetPlayerPed(source)))
    return startRide(source, pickup, destination, destination.label)
end)

exports.sunset_core:RegisterCallback('sunset:taxiAcceptRide', function(source, rideId)
    if not isTaxiDriver(source) then return nil, { localeKey = 'taxi.message.you_must_be_on_duty_as_a_taxi_driver' } end
    if DriverAvailable[source] == false then return nil, { localeKey = 'taxi.message.turn_on_availability_in_the_cab_app' } end

    local okVehicle, vehicleErr = requireTaxiVehicle(source)
    if not okVehicle then return nil, vehicleErr end

    local char = getChar(source)
    if not char then return nil, { localeKey = 'taxi.message.no_character' } end
    if rideForDriver(char.id) then return nil, { localeKey = 'taxi.message.finish_your_current_ride_first' } end

    rideId = tonumber(rideId)
    local ride = Rides[rideId]
    if not ride or ride.status ~= 'pending' then return nil, { localeKey = 'taxi.message.ride_no_longer_available' } end
    local passengerSrc = findSourceByCharacterId(ride.passengerCharId)
    if not passengerSrc then return nil, { localeKey = 'taxi.message.passenger_is_offline' } end

    ride.status = 'accepted'
    ride.driverSource = source
    ride.driverCharId = char.id
    ride.driverName = exports.sunset_core:GetPlayerDisplayName(source)

    TriggerClientEvent('sunset:client:notify', passengerSrc,
        exports.sunset_core:TFor(passengerSrc, 'taxi.message.driver_value_is_on_the_way_value', ride.driverName, ride.fare), 'success')
    pushTaxiUpdate(passengerSrc)

    broadcastDrivers('sunset:client:taxiRideTaken', { id = ride.id })
    TriggerClientEvent('sunset:client:taxiRideAccepted', source, serializeRide(ride, source))

    if ride.dispatchCallId then
        pcall(function() exports.sunset_dispatch:AcceptCall(source, 'taxi', ride.dispatchCallId) end)
        pcall(function() exports.sunset_dispatch:UpdateCallState(source, 'taxi', ride.dispatchCallId, 'EN_ROUTE') end)
    end

    return serializeRide(ride, source)
end)

exports.sunset_core:RegisterCallback('sunset:taxiCancelRide', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'taxi.message.no_character' } end

    local ride = rideForPassenger(char.id) or rideForDriver(char.id)
    if not ride then return nil, { localeKey = 'taxi.message.no_active_ride' } end
    if ride.status == 'in_progress' or ride.status == 'settling' then return nil, { localeKey = 'taxi.message.cannot_cancel_during_trip' } end

    ride.status = 'cancelled'
    if ride.frameworkId then
        sessionsCall('EndSession', ride.frameworkId, 'CANCELLED', 'cancelled')
        ride.frameworkId = nil
    end

    local otherSrc
    if ride.passengerCharId == char.id then
        otherSrc = ride.driverSource
    else
        otherSrc = findSourceByCharacterId(ride.passengerCharId)
    end

    if otherSrc then
        TriggerClientEvent('sunset:client:notify', otherSrc, exports.sunset_core:TFor(otherSrc, 'taxi.message.ride_was_cancelled'), 'warning')
        pushTaxiUpdate(otherSrc)
        TriggerClientEvent('sunset:client:taxiRideEnded', otherSrc)
    end
    TriggerClientEvent('sunset:client:taxiRideEnded', source)
    pushTaxiUpdate(source)
    Rides[ride.id] = nil

    if ride.dispatchCallId then
        pcall(function() exports.sunset_dispatch:CancelCall(source, 'taxi', ride.dispatchCallId, 'Ride cancelled') end)
    end

    broadcastDrivers('sunset:client:taxiRideTaken', { id = ride.id })
    return true
end)

exports.sunset_core:RegisterCallback('sunset:taxiPickupPassenger', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'taxi.message.no_character' } end

    local okVehicle, vehicleErr = requireTaxiVehicle(source)
    if not okVehicle then return nil, vehicleErr end

    local ride = rideForDriver(char.id)
    if not ride or ride.status ~= 'accepted' then return nil, { localeKey = 'taxi.message.no_passenger_to_pick_up' } end

    local coords = getPlayerCoords(source)
    local pickup = ride.pickup
    if coords and pickup then
        local dist = distanceBetween(coords, pickup)
        if dist > (Sunset.Taxi.pickupRadius or 18.0) then
            return nil, { localeKey = 'taxi.message.you_are_too_far_from_the_pickup_location' }
        end
    end

    local passengerSrc = findSourceByCharacterId(ride.passengerCharId)
    if not passengerSrc then return nil, { localeKey = 'taxi.message.passenger_is_offline' } end
    local passengerPed = GetPlayerPed(passengerSrc)
    local driverPed = GetPlayerPed(source)
    local taxiVehicle = driverPed and GetVehiclePedIsIn(driverPed, false) or 0
    if not passengerPed or passengerPed == 0 or taxiVehicle == 0
        or GetVehiclePedIsIn(passengerPed, false) ~= taxiVehicle then
        return nil, { localeKey = 'taxi.message.passenger_must_be_inside_your_cab' }
    end

    ride.status = 'in_progress'
    -- [SESSIONS] Mirror the live ride into the framework now that both parties
    -- are known (driver accepted + passenger boarded).
    if not ride.frameworkId then
        ride.frameworkId = createRideSession(source, char.id, ride.passengerCharId, ride.id)
    end
    TriggerClientEvent('sunset:client:notify', passengerSrc, exports.sunset_core:TFor(passengerSrc, 'taxi.message.you_are_on_your_way'), 'info')
    pushTaxiUpdate(passengerSrc)

    startMeter(ride)
    if ride.dispatchCallId then
        pcall(function() exports.sunset_dispatch:UpdateCallState(source, 'taxi', ride.dispatchCallId, 'IN_PROGRESS') end)
    end

    TriggerClientEvent('sunset:client:taxiRideInProgress', source, serializeRide(ride, source))
    return serializeRide(ride, source)
end)

exports.sunset_core:RegisterCallback('sunset:taxiCompleteRide', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'taxi.message.no_character' } end

    local okVehicle, vehicleErr = requireTaxiVehicle(source)
    if not okVehicle then return nil, vehicleErr end

    local ride = rideForDriver(char.id)
    if not ride or ride.status ~= 'in_progress' then return nil, { localeKey = 'taxi.message.no_trip_in_progress' } end

    local coords = getPlayerCoords(source)
    local dest = ride.destination
    if coords and dest then
        local dist = distanceBetween(coords, dest)
        local radius = Sunset.Taxi.completeRadius or Sunset.Taxi.dropoffRadius or 60.0
        if dist > radius then
            return nil, { localeKey = 'taxi.message.you_must_reach_the_destination_before_completing_the_trip' }
        end
    end

    local passengerSrc = findSourceByCharacterId(ride.passengerCharId)
    if not passengerSrc then
        ride.status = 'cancelled'
        return nil, { localeKey = 'taxi.message.passenger_is_offline' }
    end

    -- [AUDIT P5-04] Mark the ride settling SYNCHRONOUSLY before any await:
    -- two rapid complete callbacks both passed the 'in_progress' check while the
    -- first RemoveMoney was still awaiting, double-charging the passenger and
    -- double-paying the driver.
    ride.status = 'settling'

    local amount = ride.meterFare or ride.fare or Sunset.Taxi.minFare
    stopMeter(ride.id)
    local cutRate = Sunset.Taxi.companyCut or 0.12
    local companyCut = math.floor(amount * cutRate)
    local driverPay = amount - companyCut

    -- [JOBS AUDIT] An error thrown by the money exports used to leave the ride stuck in 'settling' forever
    -- (neither side could complete or cancel). Restore in_progress if nothing was charged yet.
    local chargedFrom
    local okPay, payErr = pcall(function()
        if exports.sunset_core:RemoveMoney(passengerSrc, 'cash', amount, 'taxi_ride') then
            chargedFrom = 'cash'
        elseif exports.sunset_core:RemoveMoney(passengerSrc, 'bank', amount, 'taxi_ride') then
            chargedFrom = 'bank'
        end
    end)
    if not okPay or not chargedFrom then
        ride.status = 'in_progress'
        MeterThreads[ride.id] = nil
        startMeter(ride)
        if not okPay then print(('[taxi] charge error ride %s: %s'):format(tostring(ride.id), tostring(payErr))) end
        return nil, { localeKey = 'taxi.message.passenger_cannot_pay' }
    end

    -- [AUDIT P5-18] The passenger was already debited; if the driver credit fails
    -- retry once, then REFUND the passenger (previously the money just vanished with a log line).
    if not exports.sunset_core:AddMoney(source, 'cash', driverPay, 'taxi_ride') then
        if not exports.sunset_core:AddMoney(source, 'cash', driverPay, 'taxi_ride_retry') then
            print(('[taxi] CRITICAL: driver payout FAILED for char %d, amount %d - refunding passenger')
                :format(char.id or 0, driverPay))
            exports.sunset_core:AddMoney(passengerSrc, chargedFrom, amount, 'taxi_ride_refund')
            ride.status = 'in_progress'
            startMeter(ride)
            return nil, { localeKey = 'taxi.message.passenger_cannot_pay' }
        end
    end
    addSociety(companyCut)
    ride.status = 'completed'
    if ride.frameworkId then
        sessionsCall('EndSession', ride.frameworkId, 'COMPLETED', 'ride paid')
        ride.frameworkId = nil
    end

    local session = DriverSessionStats[char.id] or { rides = 0, earnings = 0 }
    session.rides = (session.rides or 0) + 1
    session.earnings = (session.earnings or 0) + driverPay
    DriverSessionStats[char.id] = session

    TriggerClientEvent('sunset:client:notify', passengerSrc, exports.sunset_core:TFor(passengerSrc, 'taxi.message.trip_complete_paid_value', amount), 'info')
    TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'taxi.message.fare_collected_value_you_earned_value', amount, driverPay), 'success')
    TriggerClientEvent('sunset:client:taxiRideEnded', source)
    TriggerClientEvent('sunset:client:taxiRideEnded', passengerSrc)
    pushTaxiUpdate(passengerSrc)
    pushTaxiUpdate(source)

    pcall(function()
        MySQL.insert.await([[
            INSERT INTO taxi_rides (passenger_character_id, driver_character_id, pickup, destination, fare, status, completed_at)
            VALUES (?, ?, ?, ?, ?, 'completed', NOW())
        ]], {
            ride.passengerCharId,
            ride.driverCharId,
            json.encode(ride.pickup),
            json.encode(ride.destination),
            amount,
        })
    end)

    recordTaxiActivity(source, ride, amount)
    if ride.dispatchCallId then
        pcall(function() exports.sunset_dispatch:CompleteCall(source, 'taxi', ride.dispatchCallId) end)
    end

    return true
end)

exports.sunset_core:RegisterCallback('sunset:taxiSetAvailable', function(source, available)
    if not isTaxiDriver(source) then return nil, { localeKey = 'taxi.message.not_on_duty' } end
    DriverAvailable[source] = available == true
    return DriverAvailable[source]
end)

exports.sunset_core:RegisterCallback('sunset:taxiTip', function(source, amount)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'taxi.message.no_character' } end
    local ride = rideForPassenger(char.id)
    if not ride or ride.status ~= 'in_progress' then return nil, { localeKey = 'taxi.message.no_trip_in_progress' } end
    if not ride.driverCharId then return nil, { localeKey = 'taxi.message.no_driver_assigned' } end

    amount = tonumber(amount) or 0
    if amount ~= amount then amount = 0 end
    amount = math.floor(amount)
    -- [JOBS AUDIT] Tips were uncapped; cap to 5x the largest preset (default 500) so a typo / forged
    -- amount cannot drain a wallet. Also one tip per ride (idempotent against double-submit).
    local tipCap = 0
    for _, v in ipairs(Sunset.Taxi.tipOptions or { 25, 50, 100 }) do tipCap = math.max(tipCap, tonumber(v) or 0) end
    tipCap = math.max(100, tipCap * 5)
    if amount < 1 or amount > tipCap then return nil, { localeKey = 'taxi.message.invalid_tip' } end
    if ride.tipped then return nil, { localeKey = 'taxi.message.invalid_tip' } end
    ride.tipped = true

    if not exports.sunset_core:RemoveMoney(source, 'cash', amount, 'taxi_tip') then
        if not exports.sunset_core:RemoveMoney(source, 'bank', amount, 'taxi_tip') then
            ride.tipped = nil
            return nil, { localeKey = 'taxi.message.not_enough_money' }
        end
    end

    local driverSrc = ride.driverSource or findSourceByCharacterId(ride.driverCharId)
    if not driverSrc or not exports.sunset_core:AddMoney(driverSrc, 'cash', amount, 'taxi_tip') then
        -- driver not reachable / credit failed: give the tip back instead of destroying it
        exports.sunset_core:AddMoney(source, 'cash', amount, 'taxi_tip_refund')
        ride.tipped = nil
        return nil, { localeKey = 'taxi.message.no_driver_assigned' }
    end
    if driverSrc then
        TriggerClientEvent('sunset:client:notify', driverSrc, exports.sunset_core:TFor(driverSrc, 'taxi.message.tip_received_value', amount), 'success')
    end
    return true
end)

-- [AUDIT P7-06] Terminal-state rides were never removed from the Rides table
-- (completed + disconnect-cancelled), making every rideForPassenger/rideForDriver
-- scan grow forever. Sweep them periodically.
CreateThread(function()
    while true do
        Wait(300000)
        for id, ride in pairs(Rides) do
            if ride.status == 'completed' or ride.status == 'cancelled' then
                Rides[id] = nil
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local source = source
    DriverAvailable[source] = nil
    RequestCooldown[source] = nil
    local char = getChar(source)
    if not char then return end

    local ride = rideForPassenger(char.id) or rideForDriver(char.id)
    if not ride then return end
    if ride.status == 'completed' or ride.status == 'cancelled' then return end

    ride.status = 'cancelled'
    -- [SESSIONS] Release the mirrored framework session (its own playerDropped
    -- trigger may also fire; EndSession on a terminal session is a safe no-op).
    if ride.frameworkId then
        sessionsCall('EndSession', ride.frameworkId, 'PLAYER_DROPPED', 'disconnected')
        ride.frameworkId = nil
    end
    local otherSrc
    if ride.passengerCharId == char.id then
        otherSrc = ride.driverSource
    else
        otherSrc = findSourceByCharacterId(ride.passengerCharId)
    end
    if otherSrc then
        TriggerClientEvent('sunset:client:notify', otherSrc, exports.sunset_core:TFor(otherSrc, 'taxi.message.ride_ended_player_disconnected'), 'warning')
        TriggerClientEvent('sunset:client:taxiRideEnded', otherSrc)
        pushTaxiUpdate(otherSrc)
    end
    broadcastDrivers('sunset:client:taxiRideTaken', { id = ride.id })
end)

AddEventHandler('sunset:server:characterSelected', function(source)
    DriverAvailable[source] = true
end)

AddEventHandler('sunset:server:factionChanged', function(source, factionId)
    if factionId == Sunset.Taxi.factionId then
        DriverAvailable[source] = true
    else
        DriverAvailable[source] = nil
    end
end)

AddEventHandler('sunset:server:taxiDutySync', function(source, onDuty)
    if onDuty then
        DriverAvailable[source] = true
    else
        DriverAvailable[source] = nil
    end
end)

AddEventHandler('sunset:dispatch:callAccepted', function(callId, callType, providerSource)
    if callType ~= 'taxi' then return end
    local call = exports.sunset_dispatch:GetCall(callId)
    if not call or (call.metadata and call.metadata.rideId) then return end

    local char = getChar(providerSource)
    if not char or not isTaxiDriver(providerSource) then return end

    local pickup = call.coords
    local okVehicle = requireTaxiVehicle(providerSource)
    if not okVehicle then return end

    rideSeq = rideSeq + 1
    local ride = {
        id = rideSeq,
        passengerSource = call.callerSource,
        passengerCharId = call.callerCharacterId,
        passengerName = call.callerName,
        driverSource = providerSource,
        driverCharId = char.id,
        driverName = exports.sunset_core:GetPlayerDisplayName(providerSource),
        pickup = pickup,
        destination = { x = pickup.x, y = pickup.y, z = pickup.z, label = call.description or 'Service call' },
        fare = Sunset.Taxi.minFare,
        distanceKm = 0,
        status = 'accepted',
        createdAt = os.time(),
        dispatchCallId = callId,
        fromDispatch = true,
    }
    Rides[ride.id] = ride

    TriggerClientEvent('sunset:client:taxiRideAccepted', providerSource, serializeRide(ride, providerSource))
    local callerSrc = call.callerSource or findSourceByCharacterId(call.callerCharacterId)
    if callerSrc then
        TriggerClientEvent('sunset:client:notify', callerSrc,
            exports.sunset_core:TFor(callerSrc, 'taxi.message.driver_value_accepted_your_taxi_call', ride.driverName), 'success')
    end
end)
