local function resolveWorkTruck(session, cfg, vehicleNetId)
    if not session or not cfg then return nil end

    local netId = tonumber(vehicleNetId) or session.vehicleNetId
    if not netId then return nil end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return nil end
    if GetEntityModel(entity) ~= joaat(cfg.truckModel) then return nil end

    session.vehicleNetId = netId
    return entity
end

-- GetOffsetFromEntityInWorldCoords is client-only in FiveM; use heading math on server.
local function getTruckRearCoords(entity, offsetY)
    local coords = GetEntityCoords(entity)
    local heading = math.rad(GetEntityHeading(entity))
    local off = offsetY or -4.5
    local forwardX = -math.sin(heading)
    local forwardY = math.cos(heading)
    return vector3(
        coords.x + forwardX * off,
        coords.y + forwardY * off,
        coords.z
    )
end

local function validateTruckRear(source, cfg, vehicleNetId)
    local session = SunsetJobs_GetSession(source)
    local entity = resolveWorkTruck(session, cfg, vehicleNetId)
    if not entity then return false, { localeKey = 'jobs.message.your_assigned_trash_truck_must_be_nearby' } end

    local rear = getTruckRearCoords(entity, cfg.truckRearOffset or -4.5)
    if not SunsetJobs_ValidateCoords(source, rear, cfg.dumpRadius or 4.5) then
        return false, { localeKey = 'jobs.message.go_to_the_back_of_your_trash_truck' }
    end
    return true
end

exports.sunset_core:RegisterCallback('sunset:jobs:garbage:start', function(source, selectedRouteId)
    local cfg = Sunset.GetJobConfig('garbage')
    if not SunsetJobs_ValidateCoords(source, cfg.depot.coords, 20.0) then
        return nil, { localeKey = 'jobs.message.go_to_the_garbage_depot_to_start_work' }
    end

    local routesList = SunsetJobRoutes.GetRoutes('garbage')
    local route = nil

    if selectedRouteId and type(selectedRouteId) == 'string' then
        for _, r in ipairs(routesList) do
            if r.id == selectedRouteId then
                route = r
                break
            end
        end
    end

    if not route then
        if routesList and #routesList > 0 then
            route = routesList[math.random(#routesList)]
        else
            -- Fallback
            local fallbackBins = {}
            if cfg and cfg.bins then
                for _, b in ipairs(cfg.bins) do
                    fallbackBins[#fallbackBins + 1] = { x = b.x, y = b.y, z = b.z }
                end
            end
            route = {
                id = 'legacy_south_ls',
                label = 'South Los Santos Loop',
                bins = fallbackBins,
            }
        end
    end

    if not route.bins or #route.bins == 0 then
        return nil, { localeKey = 'jobs.message.no_bins_available_on_route' }
    end

    -- Preserve the authored order in the immutable session snapshot
    local routeBins = {}
    for i, b in ipairs(route.bins) do
        routeBins[#routeBins + 1] = { x = b.x, y = b.y, z = b.z }
    end

    local routeCapacity = math.min(#routeBins, cfg.capacity or 8)

    local session, err = SunsetJobs_StartSession(source, 'garbage', {
        routeId   = route.id,
        label     = route.label or 'Garbage Route',
        bins      = routeBins,
        collected = 0,
        capacity  = routeCapacity,
        stage     = 'collecting',
        binIndex  = 1,
        carrying  = false,
    })
    if not session then return nil, err end
    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:garbage:pickupBin', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'garbage', { 'ACTIVE' })
    if not session then return nil, err end
    if session.data.stage ~= 'collecting' then return nil, { localeKey = 'jobs.message.unload_at_depot_first' } end
    if session.data.carrying then return nil, { localeKey = 'jobs.message.you_are_already_carrying_a_bag' } end

    local cfg = Sunset.GetJobConfig('garbage')
    local idx = session.data.binIndex or 1
    local bin = session.data.bins[idx]
    if not bin then return nil, { localeKey = 'jobs.message.no_more_bins_on_route' } end

    local binPos = vector3(bin.x, bin.y, bin.z)
    if not SunsetJobs_ValidateCoords(source, binPos, cfg.collectRadius or 3.0) then
        return nil, { localeKey = 'jobs.message.not_at_the_bin' }
    end

    session.data.carrying = true
    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:garbage:dumpBin', function(source, vehicleNetId)
    local session, err = SunsetJobs_RequireSession(source, 'garbage', { 'ACTIVE' })
    if not session then return nil, err or 'No active garbage shift' end
    if session.data.stage ~= 'collecting' then return nil, { localeKey = 'jobs.message.unload_at_depot_first' } end
    if not session.data.carrying then return nil, { localeKey = 'jobs.message.pick_up_trash_from_the_bin_first' } end

    local cfg = Sunset.GetJobConfig('garbage')
    if not cfg then return nil, { localeKey = 'jobs.message.garbage_job_is_not_configured' } end

    local ok, truckErr = validateTruckRear(source, cfg, vehicleNetId)
    if not ok then return nil, truckErr or 'Go to the back of your trash truck' end

    session.data.carrying = false
    session.data.collected = (session.data.collected or 0) + 1
    session.data.binIndex = (session.data.binIndex or 1) + 1
    SunsetJobs_PayReward(source, 'garbage', cfg.payPerBin or 48, 'garbage_bin', false)
    SunsetJobs_AddJobXP(source, 'garbage', cfg.xpPerBin or 12)

    if session.data.collected >= session.data.capacity then
        session.data.stage = 'return_unload'
        SunsetJobs_SetState(source, 'RETURNING')
    end

    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:garbage:unload', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'garbage', { 'RETURNING', 'ACTIVE' })
    if not session then return nil, err end
    if session.data.stage ~= 'return_unload' then return nil, { localeKey = 'jobs.message.truck_not_full_yet' } end
    if session.data.carrying then return nil, { localeKey = 'jobs.message.dump_the_bag_in_your_truck_first' } end

    local cfg = Sunset.GetJobConfig('garbage')
    if not SunsetJobs_ValidateVehicle(source, cfg.truckModel, true, 20.0) then return nil, { localeKey = 'jobs.message.use_your_assigned_trash_truck' } end
    local unload = cfg.depot.unload or cfg.depot.coords
    if not SunsetJobs_ValidateCoords(source, unload, 8.0) then
        return nil, { localeKey = 'jobs.message.drive_to_the_depot_unload_point' }
    end

    local bonus = cfg.payPerUnload or 120
    SunsetJobs_PayReward(source, 'garbage', bonus, 'garbage_unload', true)
    SunsetJobs_AddJobXP(source, 'garbage', cfg.xpPerUnload or 30)

    SunsetJobs_ClearSession(source, 'COMPLETED', 'Route complete')
    return { bonus = bonus }
end)
