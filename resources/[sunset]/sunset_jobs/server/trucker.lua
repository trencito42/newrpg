local function validateTruckerCoords(source, target, cfg)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local pos = GetEntityCoords(ped)
    local t = type(target) == 'vector3' and target or vector3(target.x, target.y, target.z)
    local dx, dy = pos.x - t.x, pos.y - t.y
    if math.sqrt(dx * dx + dy * dy) > (cfg.deliveryRadius or 25.0) then return false end
    return math.abs(pos.z - t.z) <= (cfg.deliveryZTolerance or 8.0)
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
    local cfg = Sunset.GetJobConfig('trucker')
    if not cfg or not cfg.routes then return {} end
    local level = SunsetJobs_GetJobLevel(source, 'trucker')
    local bonus = TRUCKER_RANK_BONUS[level] or 0
    local routes = {}
    for i, route in ipairs(cfg.routes) do
        local effectivePay = math.floor((route.pay or 500) * (1 + bonus))
        routes[#routes + 1] = {
            index      = i,
            label      = route.label,
            category   = route.category or 'general',
            basePay    = route.pay,
            pay        = effectivePay,   -- pay with rank bonus already applied
            bonusPct   = math.floor(bonus * 100),
        }
    end
    return routes
end)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:start', function(source, selectedRouteIdx)
    local cfg = Sunset.GetJobConfig('trucker')
    if not cfg or not cfg.routes or #cfg.routes == 0 then return nil, 'No routes configured' end
    if not SunsetJobs_ValidateCoords(source, cfg.depot.coords, 45.0) then return nil, 'Go to the trucker depot to start work' end

    local routeIdx
    if selectedRouteIdx and tonumber(selectedRouteIdx) then
        routeIdx = math.max(1, math.min(#cfg.routes, tonumber(selectedRouteIdx)))
    else
        routeIdx = math.random(1, #cfg.routes)
    end
    local route = cfg.routes[routeIdx]

    -- Pick truck model for this route's category
    local catTrucks    = cfg.categoryTrucks or {}
    local catData      = catTrucks[route.category or 'general'] or {}
    local models       = catData.models or { cfg.truckModel or 'phantom' }
    local truckModel   = models[math.random(#models)]
    local hasTrailer   = catData.hasTrailer ~= false   -- default true if unset
    local trailerModel = catData.trailerModel or cfg.trailerModel or 'tanker'

    -- Pick a trailer bay dynamically from available trailer bays
    local bays = (cfg.depot and cfg.depot.trailerBays) or { cfg.depot.trailerSpawn }
    local chosenBay = bays[math.random(#bays)] or cfg.depot.trailerSpawn
    local pickupCoords = vector3(chosenBay.x, chosenBay.y, chosenBay.z)

    -- Player spawns in truck; trailer is pre-parked at the selected trailer bay
    local session, err = SunsetJobs_StartSession(source, 'trucker', {
        routeIndex    = routeIdx,
        pickup        = { x = pickupCoords.x, y = pickupCoords.y, z = pickupCoords.z, heading = chosenBay.w },
        delivery      = { x = route.delivery.x, y = route.delivery.y, z = route.delivery.z },
        pay           = route.pay,
        label         = route.label,
        stage         = 'to_pickup',
        truckModel    = truckModel,
        hasTrailer    = hasTrailer,
        trailerModel  = trailerModel,
        trailerSpawn  = { x = chosenBay.x, y = chosenBay.y, z = chosenBay.z, w = chosenBay.w },
    })
    if not session then return nil, err end
    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:atPickup', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'trucker', { 'ACTIVE' })
    if not session then print('[TRUCKER] atPickup FAIL session: ' .. tostring(err)) return nil, err end
    if session.data.stage ~= 'to_pickup' then print('[TRUCKER] atPickup FAIL stage: ' .. tostring(session.data.stage)) return nil, 'Not heading to pickup' end

    local cfg = Sunset.GetJobConfig('trucker')
    local vehOk, vehErr = SunsetJobs_ValidateVehicle(source, session.data.truckModel or cfg.truckModel, true, 20.0)
    if not vehOk then print('[TRUCKER] atPickup FAIL vehicle: ' .. tostring(vehErr)) return nil, 'Use your assigned work truck' end
    if session.data.hasTrailer then
        local trailerOk, trailerErr = SunsetJobs_ValidateTrailer(source, true, 18.0)
        if not trailerOk then print('[TRUCKER] atPickup FAIL trailer: ' .. tostring(trailerErr)) return nil, trailerErr end
    end
    local route = cfg.routes[session.data.routeIndex]
    if not route then print('[TRUCKER] atPickup FAIL no route idx=' .. tostring(session.data.routeIndex)) return nil, 'Route data is missing' end
    local pickupTarget = session.data.pickup and vector3(session.data.pickup.x, session.data.pickup.y, session.data.pickup.z) or route.pickup
    if not validateTruckerCoords(source, pickupTarget, cfg) then
        local ped = GetPlayerPed(source)
        local pos = GetEntityCoords(ped)
        print(('[TRUCKER] atPickup FAIL coords: player=(%.1f,%.1f,%.1f) pickup=(%.1f,%.1f,%.1f)'):format(pos.x,pos.y,pos.z,pickupTarget.x,pickupTarget.y,pickupTarget.z))
        return nil, 'Not at pickup location — drive into the loading dock marker'
    end

    session.data.stage = 'to_delivery'
    SunsetJobs_SetState(source, 'ACTIVE')
    print('[TRUCKER] atPickup OK src=' .. tostring(source))
    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:deliver', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'trucker', { 'ACTIVE' })
    if not session then return nil, err end
    if session.data.stage ~= 'to_delivery' then return nil, 'Cargo not loaded' end

    local cfg = Sunset.GetJobConfig('trucker')
    if not SunsetJobs_ValidateVehicle(source, session.data.truckModel or cfg.truckModel, true, 20.0) then
        return nil, 'Use your assigned work truck'
    end
    if session.data.hasTrailer then
        local trailerOk, trailerErr = SunsetJobs_ValidateTrailer(source, true, 18.0)
        if not trailerOk then return nil, trailerErr end
    end
    local route = cfg.routes[session.data.routeIndex]
    if not route then return nil, 'Route data is missing' end
    if not validateTruckerCoords(source, route.delivery, cfg) then
        return nil, 'Not at delivery location — drive into the green loading dock marker'
    end

    -- [AUDIT P2-SESSIONS] Scenario 14: flip the stage SYNCHRONOUSLY before any
    -- yielding payout call. Previously a second `deliver` arriving during the
    -- AddMoney/DB await still saw stage=='to_delivery' → double pay.
    session.data.stage = 'return_depot'
    local delivered = session.data.deliveredAt
    if delivered then return nil, 'Cargo already delivered on this route.' end
    session.data.deliveredAt = os.time()

    -- Apply rank bonus to pay (rank 1 = +0%, rank 5 = +5%)
    local level = SunsetJobs_GetJobLevel(source, 'trucker')
    local bonus = TRUCKER_RANK_BONUS[level] or 0
    local basePay = route.pay or 500
    local pay     = math.floor(basePay * (1 + bonus))

    -- Use AddMoney directly to avoid double-XP from SunsetJobs_PayReward.
    -- XP is awarded separately via truckerAddXP (uses trucker-specific thresholds).
    local paid = exports.sunset_core:AddMoney(source, 'cash', pay, 'trucker_delivery')
    if not paid then
        session.data.stage = 'to_delivery'
        session.data.deliveredAt = nil
        return nil, 'Payment could not be processed. Try delivering once more.'
    end
    -- XP = base pay / 10 (scales with route value, not fixed)
    truckerAddXP(source, math.max(5, math.floor(basePay / 10)))

    -- Battlepass mission progress
    if GetResourceState('sunset_pass') == 'started' then
        exports.sunset_pass:AddMissionProgress(source, 'trucker_delivery', 1)
    end

    SunsetJobs_SetState(source, 'RETURNING')
    return { pay = pay, basePay = basePay, bonusPct = math.floor(bonus * 100), stage = 'return_depot' }
end)

exports.sunset_core:RegisterCallback('sunset:jobs:trucker:returnDepot', function(source)
    local session, err = SunsetJobs_RequireSession(source, 'trucker', { 'RETURNING', 'ACTIVE' })
    if not session then return nil, err end

    local cfg = Sunset.GetJobConfig('trucker')
    if not SunsetJobs_ValidateVehicle(source, session.data.truckModel or cfg.truckModel, true, 20.0) then
        return nil, 'Return your assigned work truck'
    end
    -- Trailer was already left at the delivery point; no trailer check needed here.
    if not SunsetJobs_ValidateCoords(source, cfg.depot.coords, cfg.returnRadius or 25.0) then
        return nil, 'Return the truck to the depot'
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
        TriggerClientEvent('sunset:client:notify', source, 'Necesita Admin Level 3.', 'error', 4000)
        return
    end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then
        TriggerClientEvent('sunset:client:notify', source, 'Pozitia ta nu a putut fi determinata.', 'error') return
    end
    local pos = GetEntityCoords(ped)

    -- Pasul 2: /aaddroute delivery
    if tostring(args[1] or ''):lower() == 'delivery' then
        local pending = AdminRoutePending[source]
        if not pending then
            TriggerClientEvent('sunset:client:notify', source, 'Nu ai nicio ruta in asteptare. Incepe cu /aaddroute [categorie] [plata] [label]', 'error', 5000)
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
            TriggerClientEvent('sunset:client:notify', source, 'Adauga un label pentru ruta (minim 3 caractere).', 'error', 4000) return
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
            TriggerClientEvent('sunset:client:notify', source, 'Adauga un label pentru ruta (minim 3 caractere).', 'error', 4000) return
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
        TriggerClientEvent('sunset:client:notify', source, 'Necesita Admin Level 1.', 'error', 4000) return
    end
    local cfg = Sunset.GetJobConfig('trucker')
    if not cfg or #cfg.routes == 0 then
        TriggerClientEvent('sunset:client:notify', source, 'Nu exista nicio ruta de trucker configurata.', 'info', 4000) return
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
        TriggerClientEvent('sunset:client:notify', source, 'Necesita Admin Level 3.', 'error', 4000) return
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
