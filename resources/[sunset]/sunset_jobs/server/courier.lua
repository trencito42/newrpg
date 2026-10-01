local function buildDeliveryQueue(cfg)
    local deliveries = cfg.deliveries or {}
    local count = math.min(cfg.packagesPerRun or 5, #deliveries)
    local indices = {}
    for i = 1, #deliveries do indices[i] = i end
    for i = #indices, 2, -1 do
        local j = math.random(1, i)
        indices[i], indices[j] = indices[j], indices[i]
    end
    local queue = {}
    for i = 1, count do
        local d = deliveries[indices[i]]
        queue[#queue + 1] = {
            coords = { x = d.coords.x, y = d.coords.y, z = d.coords.z },
            label = d.label,
        }
    end
    return queue
end

local function playerOnFoot(source)
    local ped = GetPlayerPed(source)
    return ped and ped ~= 0 and GetVehiclePedIsIn(ped, false) == 0
end

local function validateWarehouseCoords(source, cfg)
    local pos = GetEntityCoords(GetPlayerPed(source))
    if not pos then return false end
    local target = cfg.warehouse.coords
    local t = type(target) == 'vector3' and target or vector3(target.x, target.y, target.z)
    local dx = pos.x - t.x
    local dy = pos.y - t.y
    local horiz = math.sqrt(dx * dx + dy * dy)
    if horiz > (cfg.loadingRadius or cfg.pickupRadius or 6.0) then return false end
    return math.abs(pos.z - t.z) <= (cfg.pickupZTolerance or 5.0)
end

local function resolveWorkVan(session, cfg, vehicleNetId)
    if not session or not cfg then return nil end

    -- [JOBS AUDIT] The van is the one registered at shift start. The client-supplied netId used to
    -- be adopted as the session vehicle (any entity, any model, e.g. another player's car).
    local netId = session.vehicleNetId
    if not netId then return nil end
    if vehicleNetId ~= nil and tonumber(vehicleNetId) ~= netId then return nil end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return nil end
    return entity
end

local function getVanRearCoords(entity, offsetY)
    local coords = GetEntityCoords(entity)
    local heading = math.rad(GetEntityHeading(entity))
    local off = offsetY or -3.2
    local forwardX = -math.sin(heading)
    local forwardY = math.cos(heading)
    return vector3(
        coords.x + forwardX * off,
        coords.y + forwardY * off,
        coords.z
    )
end

local function validateVanRear(source, cfg, vehicleNetId)
    local session = SunsetJobs_GetSession(source)
    local entity = resolveWorkVan(session, cfg, vehicleNetId)
    if not entity then return false, { localeKey = 'jobs.message.your_assigned_delivery_van_must_be_nearby' } end

    local rear = getVanRearCoords(entity, cfg.vanRearOffset or -3.2)
    if not SunsetJobs_ValidateCoords(source, rear, cfg.dumpRadius or 3.8) then
        return false, { localeKey = 'jobs.message.go_to_the_back_of_your_delivery_van' }
    end
    return true
end

-- Start: initialise session with all deliveries queued, stage=loading, loaded=0
exports.sunset_core:RegisterCallback('sunset:jobs:courier:start', function(source)
    local cfg = Sunset.GetJobConfig('courier')
    local queue = buildDeliveryQueue(cfg)

    local session, err = SunsetJobs_StartSession(source, 'courier', {
        deliveries   = queue,
        delivered    = 0,
        total        = #queue,
        stage        = 'loading',
        loaded       = 0,
        carryingPackage = false,
        hasPackage   = false,
        deliveryIndex = 1,
    })
    if not session then return nil, err end
    return session.data
end)

-- Step 1: Pick up a single package from the warehouse stack
exports.sunset_core:RegisterCallback('sunset:jobs:courier:pickupWarehousePackage', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'courier', { 'ACTIVE', 'STARTING' })
    if not session then return nil, err end
    if session.data.stage ~= 'loading' then return nil, { localeKey = 'jobs.message.all_packages_already_loaded' } end
    if session.data.carryingPackage then return nil, { localeKey = 'jobs.message.you_are_already_carrying_a_package' } end
    if (session.data.loaded or 0) >= (session.data.total or 6) then return nil, { localeKey = 'jobs.message.van_is_fully_loaded' } end

    if not playerOnFoot(source) then
        return nil, { localeKey = 'jobs.message.pick_up_packages_on_foot' }
    end

    local cfg = Sunset.GetJobConfig('courier')
    local pickupPos = cfg.packagePickup or vector3(112.48, 103.98, 81.15)
    local pPos = type(pickupPos) == 'vector4' and vector3(pickupPos.x, pickupPos.y, pickupPos.z) or pickupPos
    if not SunsetJobs_ValidateCoords(source, pPos, cfg.loadingRadius or 3.5) then
        return nil, { localeKey = 'jobs.message.go_to_the_package_stack_at_the_loading_dock' }
    end

    if session.state == 'STARTING' then
        SunsetJobs_SetState(source, 'ACTIVE')
    end

    session.data.carryingPackage = true
    return session.data
end)

-- Step 2: Load the carried package into the back of the van
exports.sunset_core:RegisterCallback('sunset:jobs:courier:loadPackageIntoVan', function(source, vehicleNetId)
    local session, err = SunsetJobs_RequireSession(source, 'courier', { 'ACTIVE' })
    if not session then return nil, err end
    if session.data.stage ~= 'loading' then return nil, { localeKey = 'jobs.message.all_packages_already_loaded' } end
    if not session.data.carryingPackage then return nil, { localeKey = 'jobs.message.pick_up_a_package_from_the_dock_first' } end

    if not playerOnFoot(source) then
        return nil, { localeKey = 'jobs.message.load_packages_on_foot' }
    end

    local cfg = Sunset.GetJobConfig('courier')
    local ok, rearErr = validateVanRear(source, cfg, vehicleNetId)
    if not ok then return nil, rearErr or exports.sunset_core:TFor(source, 'jobs.err.go_to_the_back_doors_of') end

    session.data.carryingPackage = false
    session.data.loaded = (session.data.loaded or 0) + 1

    if session.data.loaded >= session.data.total then
        session.data.stage = 'delivering'
        session.data.hasPackage = true
        -- [JOBS AUDIT] anchor for the delivery travel-plausibility check
        local p = GetEntityCoords(GetPlayerPed(source))
        session.lastStepPos = vector3(p.x, p.y, p.z)
        session.lastStepAt = os.time()
    end

    return session.data
end)

-- Step 3: Deliver package at customer address
exports.sunset_core:RegisterCallback('sunset:jobs:courier:deliver', function(source)
    return SunsetJobs_WithLock(source, 'courier_deliver', function()
        local session, err = SunsetJobs_RequireSession(source, 'courier', { 'ACTIVE' })
        if not session then return nil, err end
        if not session.data.hasPackage then return nil, { localeKey = 'jobs.message.no_package_loaded' } end
        -- [JOBS AUTHORITY] a wrecked/missing van forfeits the run: cancel, no payout.
        if SunsetJobs_WorkVehicleStatus(session) ~= 'ok' then
            SunsetJobs_ClearSession(source, 'FAILED', 'Work vehicle destroyed - shift cancelled, no reward')
            return nil, { localeKey = 'jobs.message.your_assigned_delivery_van_must_be_nearby' }
        end
        if not playerOnFoot(source) then return nil, { localeKey = 'jobs.message.deliver_the_package_on_foot' } end

        local cfg = Sunset.GetJobConfig('courier')
        local idx = session.data.deliveryIndex or 1
        local target = session.data.deliveries[idx]
        if not target then return nil, { localeKey = 'jobs.message.no_delivery_assigned' } end

        if not SunsetJobs_ValidateCoords(source, target.coords, cfg.deliveryRadius or 3.0) then
            return nil, { localeKey = 'jobs.message.not_at_delivery_address' }
        end

        -- [JOBS AUDIT] Travel plausibility: the van must actually have driven between stops
        -- (<= ~70 m/s) and the hand-over takes >= 1.5s. Blocks teleport/macro chain-delivering.
        local now = os.time()
        local pos = GetEntityCoords(GetPlayerPed(source))
        local last = session.lastStepPos
        local lastAt = session.lastStepAt or session.startedAt
        local minElapsed = 1.5
        if last then
            local d = #(vector3(pos.x, pos.y, pos.z) - last)
            minElapsed = math.max(minElapsed, d / 70.0)
        end
        if now - lastAt < math.floor(minElapsed) then
            return nil, { localeKey = 'jobs.message.too_many_requests' }
        end

        -- [JOBS AUDIT] Advance state BEFORE the yielding payout so a duplicate request cannot pay twice,
        -- and roll it back if the money write fails (no partial progress for unpaid work).
        local prevIdx = idx
        local pay = cfg.payPerPackage or 90
        session.data.hasPackage = false
        session.data.deliveryIndex = idx + 1
        session.data.delivered = (session.data.delivered or 0) + 1
        session.lastStepAt = now
        session.lastStepPos = vector3(pos.x, pos.y, pos.z)

        if not SunsetJobs_PayReward(source, 'courier', pay, 'courier_delivery', false) then
            session.data.hasPackage = true
            session.data.deliveryIndex = prevIdx
            session.data.delivered = session.data.delivered - 1
            return nil, { localeKey = 'jobs.message.payment_could_not_be_processed_try_delivering_once_more' }
        end
        SunsetJobs_AddJobXP(source, 'courier', cfg.xpPerPackage or 18)
        if GetResourceState('sunset_pass') == 'started' then
            pcall(function() exports.sunset_pass:AddMissionProgress(source, 'courier_deliveries', 1) end)
        end

        if SunsetJobs_GetSession(source) ~= session then
            -- session ended during the payout (death/drop): the pay stands, nothing else to advance
            return { pay = pay, completed = false }
        end

        if session.data.delivered >= session.data.total then
            SunsetJobs_ClearSession(source, 'COMPLETED', 'All packages delivered')
            return { pay = pay, completed = true }
        end

        -- Next package comes from the van
        session.data.hasPackage = true
        return { pay = pay, completed = false, data = session.data }
    end)
end)
