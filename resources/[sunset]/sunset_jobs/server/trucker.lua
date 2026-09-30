local function checkCoordNear(pos, target, radius, zTol)
    if not target then return false end
    local t = type(target) == 'vector3' and target or vector3(target.x, target.y, target.z)
    local dx, dy = pos.x - t.x, pos.y - t.y
    if math.sqrt(dx * dx + dy * dy) > radius then return false end
    return math.abs(pos.z - t.z) <= zTol
end

local function validateTruckerCoords(source, targetOrRoute, cfg)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local pos = GetEntityCoords(ped)
    local rad = cfg.deliveryRadius or 85.0
    local zTol = cfg.deliveryZTolerance or 15.0

    if type(targetOrRoute) == 'table' and (targetOrRoute.delivery or targetOrRoute.parkingBay) then
        if checkCoordNear(pos, targetOrRoute.delivery, rad, zTol) then return true end
        if checkCoordNear(pos, targetOrRoute.parkingBay, rad, zTol) then return true end
        return false
    end
    return checkCoordNear(pos, targetOrRoute, rad, zTol)
end

-- Pay bonus per rank (level): rank 1 = +0%, rank 5 = +5%
local TRUCKER_RANK_BONUS = { [1] = 0.00, [2] = 0.01, [3] = 0.02, [4] = 0.035, [5] = 0.05 }

-- XP thresholds per level (XP needed to go from level N to N+1).
-- Mirrors the fisherman pattern; tuned so rank 5 requires ~30-35 deliveries.
-- Level 1→2: 300 XP  (~3 basic deliveries at $600)
-- Level 2→3: 700 XP  (~7 basic deliveries)
-- Level 3→4: 1200 XP (~12 deliveries)
-- Level 4→5: 2000 XP (~20 deliveries)
-- Total to rank 5: 4200 XP ≈ 30-35 deliveries ≈ 10-12 hours trucking.
local TRUCKER_XP_THRESHOLDS = { 300, 700, 1200, 2000 }

local function truckerXpForLevel(level)
    return TRUCKER_XP_THRESHOLDS[level] or math.max(100, level * 500)
end

-- Override job_progress XP for trucker only by hooking AddJobXP after PayReward.
-- PayReward calls SunsetJobs_AddJobProgress(jobId, amount/10 ...) with the generic
-- xpForLevel. We compensate by awarding an ADJUSTMENT after the fact so the
-- effective threshold matches TRUCKER_XP_THRESHOLDS.
-- NOTE: simpler approach — use a dedicated helper that bypasses the global formula.
local function truckerAddXP(source, xpAmount)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return end
    local row = MySQL.single.await(
        'SELECT xp, level, completed_tasks, total_earned FROM job_progress WHERE character_id = ? AND job_id = ?',
        { char.id, 'trucker' }
    )
    local xp     = (row and row.xp or 0) + xpAmount
    local level  = row and row.level or 1
    local tasks  = row and row.completed_tasks or 0
    local earned = row and row.total_earned or 0

    local needed = truckerXpForLevel(level)
    while xp >= needed do
        xp    = xp - needed
        level = level + 1
        needed = truckerXpForLevel(level)
        TriggerClientEvent('sunset:client:notify', source,
            ('Trucker rank %d!'):format(level), 'success', 5000)
        TriggerEvent('sunset:quest:progress', char.id, 'job_level_up', 1, { jobId = 'trucker', level = level })
    end

    if row then
        MySQL.update.await(
            'UPDATE job_progress SET xp = ?, level = ?, completed_tasks = ?, total_earned = ? WHERE character_id = ? AND job_id = ?',
            { xp, level, tasks, earned, char.id, 'trucker' }
        )
    else
        MySQL.insert.await(
            'INSERT INTO job_progress (character_id, job_id, xp, level, completed_tasks, total_earned) VALUES (?, ?, ?, ?, ?, ?)',
            { char.id, 'trucker', xp, level, tasks, earned }
        )
    end
end

-- Returns NPC menu data (job status for building hire/start/end actions).
exports.sunset_core:RegisterCallback('sunset:jobs:trucker:getNpcMenu', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return { job = nil, onShift = false } end
    local job = select(1, Sunset.GetCharacterJob(char))
    local session = SunsetJobs_GetSession(source)
    local onShift = session and session.jobId == 'trucker' and session.state ~= 'IDLE'
    return { job = job, onShift = onShift }
end)

-- Returns the player's trucker rank (level) and XP.
exports.sunset_core:RegisterCallback('sunset:jobs:trucker:getRank', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return { level = 1, xp = 0, xpNext = TRUCKER_XP_THRESHOLDS[1] } end
    local row = MySQL.single.await(
        'SELECT xp, level FROM job_progress WHERE character_id = ? AND job_id = ?',
        { char.id, 'trucker' }
    )
    local level  = (row and row.level) or 1
    local xp     = (row and row.xp) or 0
    local xpNext = truckerXpForLevel(level)
    local bonus  = TRUCKER_RANK_BONUS[level] or 0
    return { level = level, xp = xp, xpNext = xpNext, bonusPct = math.floor(bonus * 100) }
end)

-- Returns all routes (no locking — all available; rank only affects pay bonus).
exports.sunset_core:RegisterCallback('sunset:jobs:trucker:getRoutes', function(source)
    local routesList = SunsetJobRoutes.GetRoutes('trucker')
    if not routesList or #routesList == 0 then
        local cfg = Sunset.GetJobConfig('trucker')
        routesList = cfg and cfg.routes or {}
    end
    local level = SunsetJobs_GetJobLevel(source, 'trucker')
    local bonus = TRUCKER_RANK_BONUS[level] or 0
    local routes = {}
    for i, route in ipairs(routesList) do
        local basePay = tonumber(route.pay) or 500
        local effectivePay = math.floor(basePay * (1 + bonus))
        routes[#routes + 1] = {
            id         = route.id or ('route_' .. i),
            index      = i,
            label      = route.label or ('Route ' .. i),
            category   = route.category or 'general',
            basePay    = basePay,
            pay        = effectivePay,   -- pay with rank bonus already applied
            bonusPct   = math.floor(bonus * 100),
        }
    end
    return routes
end)

local function safeHeading(v)
    if not v then return 0.0 end
    if type(v) == 'vector4' then return v.w end
    if type(v) == 'table' then return v.w or v.h or v.heading or 0.0 end
    return 0.0
end

local function safeVec3(v)
    if not v then return vector3(0.0, 0.0, 0.0) end
    if type(v) == 'vector3' or type(v) == 'vector4' then
        return vector3(v.x, v.y, v.z)
    end
    if type(v) == 'table' then
        return vector3(v.x or 0.0, v.y or 0.0, v.z or 0.0)
    end
    return vector3(0.0, 0.0, 0.0)
end

local function handleTruckerStart(source, selectedRouteParam)
    print(('[TRUCKER SERVER] start callback called by src=%s routeParam=%s'):format(tostring(source), tostring(selectedRouteParam)))
    local cfg = Sunset.GetJobConfig('trucker')
    local routesList = SunsetJobRoutes.GetRoutes('trucker')
    if not routesList or #routesList == 0 then
        routesList = cfg and cfg.routes or {}
    end
    if not routesList or #routesList == 0 then
        print('[TRUCKER SERVER] FAIL: no routes')
        return nil, { localeKey = 'jobs.message.no_routes_configured' }
    end

    -- Validate player is in the trucker depot area (120m radius)
    if not SunsetJobs_ValidateCoords(source, cfg.depot.coords, 120.0) then
        local ped = GetPlayerPed(source)
        local pos = ped and ped ~= 0 and GetEntityCoords(ped) or vector3(0, 0, 0)
        print(('[TRUCKER SERVER] FAIL coords: player=(%.1f,%.1f,%.1f) depot=(%.1f,%.1f,%.1f)'):format(pos.x, pos.y, pos.z, cfg.depot.coords.x, cfg.depot.coords.y, cfg.depot.coords.z))
        return nil, { localeKey = 'jobs.message.go_to_the_trucker_depot_to_start_work' }
    end

    -- Auto-hire as trucker if not currently employed as trucker
    local char = exports.sunset_core:GetCharacter(source)
    if char then
        local curJob = select(1, Sunset.GetCharacterJob(char))
        if curJob ~= 'trucker' then
            print(('[TRUCKER SERVER] auto-hiring src=%s (curJob=%s) as trucker'):format(tostring(source), tostring(curJob)))
            exports.sunset_core:SetJob(source, 'trucker', 0)
        end
    end

    -- Automatically clear any leftover or stuck session so route selection always works
    local currentSession = SunsetJobs_GetSession(source)
    if currentSession then
        print(('[TRUCKER SERVER] clearing existing session for src=%s'):format(tostring(source)))
        SunsetJobs_ClearSession(source, 'CANCELLED', 'Restarted shift from laptop')
    end

    -- Resolve route by ID or numeric index
    local route = nil
    local routeIdx = 1
    if type(selectedRouteParam) == 'string' and selectedRouteParam ~= '' and not tonumber(selectedRouteParam) then
        for i, r in ipairs(routesList) do
            if r.id == selectedRouteParam then
                route = r
                routeIdx = i
                break
            end
        end
    end
    if not route then
        local numericIdx = tonumber(selectedRouteParam)
        if numericIdx then
            routeIdx = math.max(1, math.min(#routesList, numericIdx))
            route = routesList[routeIdx]
        else
            routeIdx = math.random(1, #routesList)
            route = routesList[routeIdx]
        end
    end
    if not route then return nil, { localeKey = 'jobs.message.selected_route_does_not_exist' } end

    -- Pick truck model for this route's category
    local catTrucks    = cfg.categoryTrucks or {}
    local catData      = catTrucks[route.category or 'general'] or {}
    local models       = catData.models or { cfg.truckModel or 'phantom' }
    local truckModel   = models[math.random(#models)]
    local hasTrailer   = catData.hasTrailer ~= false   -- default true if unset
    local trailerModel = catData.trailerModel or cfg.trailerModel or 'tanker'

    -- Pick a trailer bay dynamically from route pickup, trailerBays pool, or default
    local bays = (cfg.depot and cfg.depot.trailerBays) or { cfg.depot.trailerSpawn }
    local chosenBay = route.trailerSpawn or route.pickup or bays[routeIdx] or bays[math.random(#bays)] or cfg.depot.trailerSpawn
    local pickupCoords = safeVec3(chosenBay)
    local pickupHeading = safeHeading(chosenBay)

    local delivCoords = safeVec3(route.delivery)
    local delivHeading = safeHeading(route.delivery)

    local bayCoords = safeVec3(route.parkingBay or route.delivery)
    local bayHeading = safeHeading(route.parkingBay or route.delivery)

    -- Player spawns in truck; trailer is pre-parked at the selected trailer bay
    -- Session stores an IMMUTABLE snapshot of the route data
    local session, err = SunsetJobs_StartSession(source, 'trucker', {
        routeId       = route.id or ('route_' .. routeIdx),
        routeIndex    = routeIdx,
        pickup        = { x = pickupCoords.x, y = pickupCoords.y, z = pickupCoords.z, heading = pickupHeading, w = pickupHeading },
        delivery      = { x = delivCoords.x, y = delivCoords.y, z = delivCoords.z, heading = delivHeading, w = delivHeading },
        parkingBay    = { x = bayCoords.x, y = bayCoords.y, z = bayCoords.z, heading = bayHeading, w = bayHeading },
        pay           = tonumber(route.pay) or 500,
        label         = route.label,
        category      = route.category or 'general',
        stage         = 'to_pickup',
        truckModel    = truckModel,
        hasTrailer    = hasTrailer,
        trailerModel  = trailerModel,
        trailerSpawn  = { x = pickupCoords.x, y = pickupCoords.y, z = pickupCoords.z, heading = pickupHeading, w = pickupHeading },
    })
    if not session then
        print(('[TRUCKER SERVER] SunsetJobs_StartSession FAIL: %s'):format(tostring(err)))
        return nil, err or 'Could not create trucker session'
    end
    return session.data
end

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:start', handleTruckerStart)
exports.sunset_core:RegisterCallback('sunset:jobs:trucker:startShift', handleTruckerStart)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:atPickup', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'trucker', { 'ACTIVE' })
    if not session then print('[TRUCKER] atPickup FAIL session: ' .. tostring(err)) return nil, err end
    if session.data.stage ~= 'to_pickup' then print('[TRUCKER] atPickup FAIL stage: ' .. tostring(session.data.stage)) return nil, { localeKey = 'jobs.message.not_heading_to_pickup' } end

    local cfg = Sunset.GetJobConfig('trucker')
    local vehOk, vehErr = SunsetJobs_ValidateVehicle(source, session.data.truckModel or cfg.truckModel, true, 20.0)
    if not vehOk then print('[TRUCKER] atPickup FAIL vehicle: ' .. tostring(vehErr)) return nil, { localeKey = 'jobs.message.use_your_assigned_work_truck' } end
    if session.data.hasTrailer then
        local trailerOk, trailerErr = SunsetJobs_ValidateTrailer(source, true, 18.0)
        if not trailerOk then print('[TRUCKER] atPickup FAIL trailer: ' .. tostring(trailerErr)) return nil, trailerErr end
    end

    -- Validate against the immutable session snapshot
    local pickupTarget = session.data.pickup and vector3(session.data.pickup.x, session.data.pickup.y, session.data.pickup.z)
    if not pickupTarget or not validateTruckerCoords(source, pickupTarget, cfg) then
        local ped = GetPlayerPed(source)
        local pos = GetEntityCoords(ped)
        print(('[TRUCKER] atPickup FAIL coords: player=(%.1f,%.1f,%.1f) pickup=(%.1f,%.1f,%.1f)'):format(pos.x, pos.y, pos.z, pickupTarget and pickupTarget.x or 0, pickupTarget and pickupTarget.y or 0, pickupTarget and pickupTarget.z or 0))
        return nil, { localeKey = 'jobs.message.not_at_pickup_location_drive_into_the_loading_dock' }
    end

    session.data.stage = 'to_delivery'
    SunsetJobs_SetState(source, 'ACTIVE')
    print('[TRUCKER] atPickup OK src=' .. tostring(source))
    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:deliver', function(source, isManual)
    local session, err = SunsetJobs_RequireSession(source, 'trucker', { 'ACTIVE' })
    if not session then return nil, err end
    if session.data.stage ~= 'to_delivery' then return nil, { localeKey = 'jobs.message.cargo_not_loaded' } end

    local cfg = Sunset.GetJobConfig('trucker')
    if not SunsetJobs_ValidateVehicle(source, session.data.truckModel or cfg.truckModel, true, 35.0) then
        return nil, { localeKey = 'jobs.message.use_your_assigned_work_truck' }
    end
    if session.data.hasTrailer then
        local trailerOk, trailerErr = SunsetJobs_ValidateTrailer(source, true, 35.0)
        if not trailerOk then return nil, trailerErr end
    end

    -- Validate delivery against immutable session snapshot
    local delivTarget = {
        delivery = session.data.delivery and vector3(session.data.delivery.x, session.data.delivery.y, session.data.delivery.z),
        parkingBay = session.data.parkingBay and vector3(session.data.parkingBay.x, session.data.parkingBay.y, session.data.parkingBay.z),
    }
    if not validateTruckerCoords(source, delivTarget, cfg) then
        return nil, { localeKey = 'jobs.message.not_at_delivery_location_drive_into_the_loading_dock' }
    end

    -- Flip stage synchronously before any yielding payout
    session.data.stage = 'return_depot'
    session.trailerNetId = nil
    local delivered = session.data.deliveredAt
    if delivered then return nil, { localeKey = 'jobs.message.cargo_already_delivered_on_this_route' } end
    session.data.deliveredAt = os.time()

    -- Apply rank bonus to pay (rank 1 = +0%, rank 5 = +5%)
    local level = SunsetJobs_GetJobLevel(source, 'trucker')
    local bonus = TRUCKER_RANK_BONUS[level] or 0
    local basePay = tonumber(session.data.pay) or 500

    -- Manual Parking 2x Bonus
    local manualMult = 1.0
    if isManual == true then
        manualMult = (cfg and cfg.manualParkingBonusMultiplier) or 2.0
    end

    local pay = math.floor(basePay * (1 + bonus) * manualMult)
    local xp  = math.max(10, math.floor((basePay / 10) * manualMult))

    -- Use AddMoney directly to avoid double-XP from SunsetJobs_PayReward.
    local paid = exports.sunset_core:AddMoney(source, 'cash', pay, isManual and 'trucker_manual_delivery' or 'trucker_delivery')
    if not paid then
        session.data.stage = 'to_delivery'
        session.data.deliveredAt = nil
        return nil, { localeKey = 'jobs.message.payment_could_not_be_processed_try_delivering_once_more' }
    end
    truckerAddXP(source, xp)

    -- Battlepass mission progress
    if GetResourceState('sunset_pass') == 'started' then
        exports.sunset_pass:AddMissionProgress(source, 'trucker_delivery', 1)
        if isManual then
            exports.sunset_pass:AddMissionProgress(source, 'trucker_manual_park', 1)
        end
    end

    SunsetJobs_SetState(source, 'RETURNING')
    return {
        pay = pay,
        basePay = basePay,
        isManual = isManual == true,
        manualMultiplier = manualMult,
        xpAwarded = xp,
        bonusPct = math.floor(bonus * 100),
        stage = 'return_depot'
    }
end)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:returnDepot', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'trucker', { 'RETURNING', 'ACTIVE' })
    if not session then return nil, err end

    local cfg = Sunset.GetJobConfig('trucker')
    if not SunsetJobs_ValidateVehicle(source, session.data.truckModel or cfg.truckModel, true, 20.0) then
        return nil, { localeKey = 'jobs.message.return_your_assigned_work_truck' }
    end
    -- Trailer was already left at the delivery point; no trailer check needed here.
    local retPoint = (cfg.depot.returnCoords and vector3(cfg.depot.returnCoords.x, cfg.depot.returnCoords.y, cfg.depot.returnCoords.z)) or (cfg.depot.spawn and vector3(cfg.depot.spawn.x, cfg.depot.spawn.y, cfg.depot.spawn.z)) or cfg.depot.coords
    if not (SunsetJobs_ValidateCoords(source, retPoint, cfg.returnRadius or 30.0) or SunsetJobs_ValidateCoords(source, cfg.depot.coords, cfg.returnRadius or 30.0)) then
        return nil, { localeKey = 'jobs.message.return_the_truck_to_the_depot' }
    end

    SunsetJobs_ClearSession(source, 'COMPLETED', 'Route complete')
    return true
end)

-- ═══ ADMIN TRUCKER ROUTE MANAGEMENT ═══
-- /aaddroute [categorie] [plata] [label]
--   Admin trebuie sa fie la locul de ridicare. Destinatia se seteaza cu /aaddroute delivery dupa ce ia ruta.
--
-- Doua moduri de utilizare:
--   MODUL 1 — ruta completa dintr-o comanda (pickup = pozitia ta, delivery = coords manual):
--     /aaddroute [categorie] [plata] [dest_x] [dest_y] [dest_z] [label]
--   MODUL 2 — doi pasi (pickup = pozitia ta cand dai prima comanda, delivery = pozitia ta cand dai a doua):
--     Pasul 1: /aaddroute [categorie] [plata] [label]   (salveaza pickup = pozitia ta)
--     Pasul 2: /aaddroute delivery                      (salveaza delivery = pozitia ta)

local AdminRoutePending = {}  -- [source] = { category, pay, label, pickup }

RegisterCommand('aaddroute', function(source, args)
    if source == 0 then print('[trucker] aaddroute is player-only') return end
    if not exports.sunset_admin:IsAdmin(source, 3) then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.necesita_admin_level_3'), 'error', 4000)
        return
    end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.pozitia_ta_nu_a_putut_fi_determinata'), 'error') return
    end
    local pos = GetEntityCoords(ped)

    -- Pasul 2: /aaddroute delivery
    if tostring(args[1] or ''):lower() == 'delivery' then
        local pending = AdminRoutePending[source]
        if not pending then
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.you_have_no_pending_route_start_with_aaddroute_category'), 'error', 5000)
            return
        end
        local cfg = Sunset.GetJobConfig('trucker')
        cfg.routes[#cfg.routes + 1] = {
            category = pending.category,
            pay      = pending.pay,
            label    = pending.label,
            pickup   = pending.pickup,
            delivery = vector3(pos.x, pos.y, pos.z),
        }
        AdminRoutePending[source] = nil
        local idx = #cfg.routes
        TriggerClientEvent('sunset:client:notify', source,
            ('Ruta #%d "%s" adaugata! Pickup=(%.0f,%.0f,%.0f) Delivery=(%.0f,%.0f,%.0f)'):format(
                idx, pending.label, pending.pickup.x, pending.pickup.y, pending.pickup.z,
                pos.x, pos.y, pos.z), 'success', 8000)
        return
    end

    -- Pasul 1 (sau ruta completa cu coords)
    local category = tostring(args[1] or 'general'):lower()
    local pay      = tonumber(args[2])
    if not pay or pay < 1 then
        TriggerClientEvent('sunset:client:notify', source,
            'Usage: /aaddroute [categorie] [plata] [label]\nDupa asta vino la destinatie si fa /aaddroute delivery\nSau: /aaddroute [categorie] [plata] [dest_x] [dest_y] [dest_z] [label]',
            'error', 8000)
        return
    end

    -- Detectam daca sunt trimise si coordonatele destinatiei direct (6 argumente)
    local dx, dy, dz = tonumber(args[3]), tonumber(args[4]), tonumber(args[5])
    if dx and dy and dz then
        -- Ruta completa: /aaddroute category pay dest_x dest_y dest_z label...
        local label = table.concat(args, ' ', 6)
        if #label < 3 then
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.add_a_label_for_the_route_minimum_3_characters'), 'error', 4000) return
        end
        local cfg = Sunset.GetJobConfig('trucker')
        cfg.routes[#cfg.routes + 1] = {
            category = category,
            pay      = math.floor(pay),
            label    = label,
            pickup   = vector3(pos.x, pos.y, pos.z),
            delivery = vector3(dx, dy, dz),
        }
        local idx = #cfg.routes
        TriggerClientEvent('sunset:client:notify', source,
            ('Ruta #%d "%s" adaugata! Pickup=pozitia ta, Delivery=(%.0f,%.0f,%.0f)'):format(idx, label, dx, dy, dz), 'success', 7000)
    else
        -- Doi pasi: salveaza pickup, asteapta /aaddroute delivery
        local label = table.concat(args, ' ', 3)
        if #label < 3 then
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.add_a_label_for_the_route_minimum_3_characters'), 'error', 4000) return
        end
        AdminRoutePending[source] = {
            category = category,
            pay      = math.floor(pay),
            label    = label,
            pickup   = vector3(pos.x, pos.y, pos.z),
        }
        TriggerClientEvent('sunset:client:notify', source,
            ('Pickup salvat la (%.0f,%.0f,%.0f). Du-te la destinatie si fa /aaddroute delivery'):format(pos.x, pos.y, pos.z), 'info', 7000)
    end
end, false)

RegisterCommand('alistroutes', function(source)
    if source == 0 then
        local cfg = Sunset.GetJobConfig('trucker')
        if not cfg or #cfg.routes == 0 then print('[trucker] No routes.') return end
        for i, r in ipairs(cfg.routes) do
            print(('[trucker] #%d [%s] "%s" $%d | del=(%.0f,%.0f,%.0f)'):format(
                i, r.category or '?', r.label or '?', r.pay or 0,
                (r.delivery and r.delivery.x) or 0, (r.delivery and r.delivery.y) or 0, (r.delivery and r.delivery.z) or 0))
        end
        return
    end
    if not exports.sunset_admin:IsAdmin(source, 1) then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.necesita_admin_level_1'), 'error', 4000) return
    end
    local cfg = Sunset.GetJobConfig('trucker')
    if not cfg or #cfg.routes == 0 then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.no_trucker_routes_are_configured'), 'info', 4000) return
    end
    local lines = {'=== Rute Trucker ==='}
    for i, r in ipairs(cfg.routes) do
        lines[#lines + 1] = ('#%d [%s] "%s" $%d | del=(%.0f,%.0f,%.0f)'):format(
            i, r.category or '?', r.label or '?', r.pay or 0,
            (r.delivery and r.delivery.x) or 0, (r.delivery and r.delivery.y) or 0, (r.delivery and r.delivery.z) or 0)
    end
    TriggerClientEvent('sunset:client:notify', source, table.concat(lines, '\n'), 'info', 15000)
end, false)

RegisterCommand('adelroute', function(source, args)
    if source == 0 then print('[trucker] adelroute is player-only') return end
    if not exports.sunset_admin:IsAdmin(source, 3) then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'jobs.message.necesita_admin_level_3'), 'error', 4000) return
    end
    local idx = tonumber(args[1])
    local cfg = Sunset.GetJobConfig('trucker')
    if not idx or not cfg or not cfg.routes[idx] then
        local count = cfg and #cfg.routes or 0
        TriggerClientEvent('sunset:client:notify', source,
            ('Usage: /adelroute [nr]. Exista %d rute. Vezi /alistroutes.'):format(count), 'error', 5000)
        return
    end
    local removed = table.remove(cfg.routes, idx)
    TriggerClientEvent('sunset:client:notify', source,
        ('Ruta #%d "%s" stearsa. Au ramas %d rute.'):format(idx, removed.label or '?', #cfg.routes), 'success', 5000)
end, false)
