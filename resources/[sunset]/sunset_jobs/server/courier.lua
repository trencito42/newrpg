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

    local netId = tonumber(vehicleNetId) or session.vehicleNetId
    if not netId then return nil end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return nil end

    session.vehicleNetId = netId
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
    if not entity then return false, 'Your assigned delivery van must be nearby' end

    local rear = getVanRearCoords(entity, cfg.vanRearOffset or -3.2)
    if not SunsetJobs_ValidateCoords(source, rear, cfg.dumpRadius or 3.8) then
        return false, 'Go to the back of your delivery van'
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
    if session.data.stage ~= 'loading' then return nil, 'All packages already loaded' end
    if session.data.carryingPackage then return nil, 'You are already carrying a package' end
    if (session.data.loaded or 0) >= (session.data.total or 6) then return nil, 'Van is fully loaded' end

    if not playerOnFoot(source) then
        return nil, 'Pick up packages on foot'
    end

    local cfg = Sunset.GetJobConfig('courier')
    local pickupPos = cfg.packagePickup or vector3(112.48, 103.98, 81.15)
    local pPos = type(pickupPos) == 'vector4' and vector3(pickupPos.x, pickupPos.y, pickupPos.z) or pickupPos
    if not SunsetJobs_ValidateCoords(source, pPos, cfg.loadingRadius or 3.5) then
        return nil, 'Go to the package stack at the loading dock'
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
    if session.data.stage ~= 'loading' then return nil, 'All packages already loaded' end
    if not session.data.carryingPackage then return nil, 'Pick up a package from the dock first' end

    if not playerOnFoot(source) then
        return nil, 'Load packages on foot'
    end

    local cfg = Sunset.GetJobConfig('courier')
    local ok, rearErr = validateVanRear(source, cfg, vehicleNetId)
    if not ok then return nil, rearErr or 'Go to the back doors of your delivery van' end

    session.data.carryingPackage = false
    session.data.loaded = (session.data.loaded or 0) + 1

    if session.data.loaded >= session.data.total then
        session.data.stage = 'delivering'
        session.data.hasPackage = true
    end

    return session.data
end)

-- Step 3: Deliver package at customer address
exports.sunset_core:RegisterCallback('sunset:jobs:courier:deliver', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'courier', { 'ACTIVE' })
    if not session then return nil, err end
    if not session.data.hasPackage then return nil, 'No package loaded' end
    if not playerOnFoot(source) then return nil, 'Deliver the package on foot' end

    local cfg = Sunset.GetJobConfig('courier')
    local idx = session.data.deliveryIndex or 1
    local target = session.data.deliveries[idx]
    if not target then return nil, 'No delivery assigned' end

    if not SunsetJobs_ValidateCoords(source, target.coords, cfg.deliveryRadius or 3.0) then
        return nil, 'Not at delivery address'
    end

    local pay = cfg.payPerPackage or 90
    SunsetJobs_PayReward(source, 'courier', pay, 'courier_delivery', false)
    SunsetJobs_AddJobXP(source, 'courier', cfg.xpPerPackage or 18)
    if GetResourceState('sunset_pass') == 'started' then
        exports.sunset_pass:AddMissionProgress(source, 'courier_deliveries', 1)
    end

    session.data.delivered    = (session.data.delivered or 0) + 1
    session.data.deliveryIndex = idx + 1

    if session.data.delivered >= session.data.total then
        SunsetJobs_ClearSession(source, 'COMPLETED', 'All packages delivered')
        return { pay = pay, completed = true }
    end

    -- Next package comes from the van
    session.data.hasPackage = true
    return { pay = pay, completed = false, data = session.data }
end)
