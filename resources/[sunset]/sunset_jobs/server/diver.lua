-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — server/diver.lua
--  Server-authoritative Marine Salvage Diver job.
--  Handles: contract snapshots, salvage validation, boat spawning,
--  O2 state, sell, session management.
-- ═══════════════════════════════════════════════════════════════

local DEBUG = GetConvar('sv_sunset_diving_debug', '0') == '1'
local function dlog(fmt, ...) if DEBUG then print(('^5[diver]^7 ' .. fmt):format(...)) end end

-- ── Rate Limits ──────────────────────────────────────────────
local RateLimit = {}
local RATE_LIMIT_SEC = 2

local function checkRate(source, action)
    local key = ('%d:%s'):format(source, action)
    local now = os.time()
    if RateLimit[key] and now - RateLimit[key] < RATE_LIMIT_SEC then return false end
    RateLimit[key] = now
    return true
end

-- ── Dive gear items per rental tier ──────────────────────────
-- Granted on rental (sunset:jobs:diver:rentGear, tier gated by diver rank via
-- JobsConfig.diver.gear[tier].minRank) and consumed on shift end through
-- session.data.rentedGearItem. Contract start accepts any tier.
local DIVE_GEAR_ITEMS = {
    basic = 'scuba_gear',
    standard = 'standard_tank',
    advanced = 'advanced_tank',
}

-- ── Active Contract Snapshots ────────────────────────────────
-- Snapshots[source] = { siteId, lootPoints=[{x,y,z,claimed=false}],
--                       required, recovered=0, pay, difficulty, gear, boatNetId }
local Snapshots = {}

-- Claimed salvage: ClaimedPoints[source][idx] = true
-- Per-source so they can't claim the same point twice
local ClaimedPoints = {}

-- Rented boats: RentedBoats[source] = netId
local RentedBoats = {}

-- [SECTION 31] Pending boat rentals: PendingBoatRentals[source] = {token, expectedModelHash, expectedSpawn, cost, createdAt}
local PendingBoatRentals = {}
local BOAT_TOKEN_EXPIRY_SEC = 30

-- [SECTION 33] Salvage hold tokens: SalvageTokens[source] = {token, pointIndex, issuedAt, minDuration=4}
local SalvageTokens = {}
local SellBusy = {}

-- Terry (Vespucci waterfront) - handoff + sell location (matches Sunset.JobWorkplaces.diver.npc.coords)
local TERRY_COORDS = { x = -812.0, y = -1282.0, z = 5.0 }
local TERRY_HANDOFF_RADIUS = 15.0
local SALVAGE_MIN_HOLD_SEC = 4

-- Token generator (replay-attack prevention)
local function genToken()
    return ('%x%x%x'):format(math.random(0xFFFF), math.random(0xFFFF), math.random(0xFFFF))
end

-- ── Helpers ──────────────────────────────────────────────────
local function getChar(source)
    return exports.sunset_core:GetCharacter(source)
end

local function charId(source)
    local char = getChar(source)
    return char and tonumber(char.id)
end

local function diverLevel(source)
    return SunsetJobs_GetJobLevel(source, 'diver')
end

local function getDiveSite(siteId)
    local sites = SunsetJobRoutes.GetRoutes('diving')
    for _, s in ipairs(sites) do
        if s.id == siteId then return s end
    end
    return nil
end

local function distV3(a, b)
    if not a or not b then return 9999 end
    local dx = a.x - b.x; local dy = a.y - b.y; local dz = a.z - b.z
    return math.sqrt(dx*dx + dy*dy + dz*dz)
end

-- Weighted random loot pick
local function pickLootItem(lootTable)
    local totalWeight = 0
    for _, entry in ipairs(lootTable) do totalWeight = totalWeight + (entry.weight or 1) end
    local roll = math.random() * totalWeight
    local cumulative = 0
    for _, entry in ipairs(lootTable) do
        cumulative = cumulative + (entry.weight or 1)
        if roll <= cumulative then return entry end
    end
    return lootTable[#lootTable]
end

-- ── Get Contracts ─────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:getContracts', function(source)
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.start_your_shift_first' } end

    local level = session.data.level or 1
    local sites  = SunsetJobRoutes.GetRoutes('diving') or {}
    local available = {}
    for _, site in ipairs(sites) do
        if site.minRank <= level then
            available[#available + 1] = {
                id             = site.id,
                label          = site.label,
                minRank        = site.minRank,
                requiresBoat   = site.requiresBoat or false,
                difficulty     = site.difficulty or 'easy',
                requiredSalvage = site.requiredSalvage or 3,
                pay            = site.pay or 0,
                searchZone     = site.searchZone,
            }
        end
    end
    return available
end)

-- ── Start Contract ────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:startContract', function(source, siteId)
    if not checkRate(source, 'startContract') then return nil, { localeKey = 'jobs.message.too_many_requests' } end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.start_your_shift_first' } end

    if Snapshots[source] then
        return nil, { localeKey = 'jobs.message.you_already_have_a_contract_active_value_abandon_it', formatArgs = { Snapshots[source].siteId } }
    end

    siteId = tostring(siteId or '')
    local site = getDiveSite(siteId)
    if not site then return nil, { localeKey = 'jobs.message.unknown_dive_site' } end

    local level = session.data.level or 1
    if site.minRank > level then
        return nil, { localeKey = 'jobs.message.requires_diver_rank_value_you_are_rank_value', formatArgs = { site.minRank, level } }
    end

    -- Boat license check for offshore sites (FAIL CLOSED)
    if site.requiresBoat then
        if GetResourceState('sunset_licenses') ~= 'started' then
            return nil, { localeKey = 'jobs.message.licensing_service_unavailable_try_again_in_a_moment' }
        end
        if exports.sunset_licenses:HasLicense(source, 'boat') ~= true then
            return nil, { localeKey = 'jobs.message.offshore_sites_require_a_valid_boat_license_bwc_visit' }
        end
    end

    -- Check player has rented dive gear of any tier (scuba_gear / standard_tank / advanced_tank)
    local hasGear = false
    for _, gearItem in pairs(DIVE_GEAR_ITEMS) do
        if exports.sunset_inventory:HasItem(source, gearItem, 1) then hasGear = true break end
    end
    if not hasGear then
        return nil, { localeKey = 'jobs.message.you_need_diving_gear_rent_from_terry_first' }
    end

    -- Server randomly selects loot points (immutable snapshot)
    if not site.lootPoints or #site.lootPoints == 0 then
        return nil, { localeKey = 'jobs.message.dive_site_has_no_loot_points_configured_contact_an' }
    end

    -- Shuffle and pick required number of active loot points
    local required = site.requiredSalvage or 3
    local allPoints = {}
    for i, pt in ipairs(site.lootPoints) do allPoints[i] = pt end
    -- Fisher-Yates shuffle
    for i = #allPoints, 2, -1 do
        local j = math.random(i)
        allPoints[i], allPoints[j] = allPoints[j], allPoints[i]
    end
    local activePts = {}
    for i = 1, math.min(required, #allPoints) do
        activePts[i] = { x = allPoints[i].x, y = allPoints[i].y, z = allPoints[i].z, claimed = false }
    end

    -- Use gear tier stored in session at rental time (server-authoritative)
    local cfgDiver   = Sunset.JobsConfig.diver
    local gearTier   = session.data.gearTier or 'basic'
    local o2Duration = session.data.o2Max or 120
    if cfgDiver and cfgDiver.gear and cfgDiver.gear[gearTier] then
        o2Duration = cfgDiver.gear[gearTier].o2Duration or o2Duration
    end

    Snapshots[source] = {
        siteId     = siteId,
        lootPoints = activePts,
        required   = required,
        recovered  = 0,
        pay        = site.pay or 0,
        difficulty = site.difficulty or 'easy',
        gear       = gearTier,
        o2Duration = o2Duration,
        boatNetId  = nil,
        startedAt  = os.time(),
    }
    ClaimedPoints[source] = {}

    session.data.contractId   = siteId
    session.data.siteId       = siteId
    session.data.recovered    = 0
    session.data.required     = required
    session.data.o2Duration   = o2Duration
    session.data.stage        = 'diving'
    SunsetJobs_SetState(source, 'ACTIVE')
    TriggerClientEvent('sunset:jobs:stateChanged', source, 'ACTIVE', session.data)

    dlog('char %s started dive contract %s (%d loot points)', charId(source), siteId, #activePts)
    return {
        siteId      = siteId,
        lootPoints  = activePts,
        required    = required,
        pay         = site.pay,
        difficulty  = site.difficulty,
        o2Duration  = o2Duration,
        searchZone  = site.searchZone,
        diveEntry   = site.diveEntry,
        boatSpawn   = site.boatSpawn,
        requiresBoat = site.requiresBoat or false,
    }
end)

-- ── Rent Gear ─────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:rentGear', function(source, tierName)
    if not checkRate(source, 'rentGear') then return nil, { localeKey = 'jobs.message.too_many_requests' } end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.start_your_shift_first' } end

    tierName = tostring(tierName or 'basic')
    local cfgDiver = Sunset.JobsConfig.diver
    if not cfgDiver or not cfgDiver.gear then return nil, { localeKey = 'jobs.message.gear_config_missing' } end

    local gearCfg = cfgDiver.gear[tierName]
    if not gearCfg then return nil, { localeKey = 'jobs.message.unknown_gear_tier_value', formatArgs = { tierName } } end

    local level = session.data.level or 1
    if level < (gearCfg.minRank or 1) then
        return nil, { localeKey = 'jobs.message.this_gear_requires_diver_rank_value', formatArgs = { gearCfg.minRank } }
    end

    local cost = gearCfg.rentCost or 30
    local removed = exports.sunset_core:RemoveMoney(source, 'cash', cost, 'gear_rental')
    if not removed then return nil, { localeKey = 'jobs.message.insufficient_funds_gear_costs_value', formatArgs = { cost } } end

    -- Grant gear item
    -- [ITEM standard_tank] Each rental tier grants its own catalog item; the
    -- standard tier previously handed out scuba_gear, leaving standard_tank orphaned.
    local item = DIVE_GEAR_ITEMS[tierName] or 'scuba_gear'
    local ok = exports.sunset_inventory:AddItem(source, item, 1)
    if not ok then
        exports.sunset_core:AddMoney(source, 'cash', cost, 'gear_rental_refund')
        return nil, { localeKey = 'jobs.message.inventory_full_could_not_add_gear' }
    end

    -- Store gear tier and O2 in session so contract start is server-authoritative.
    -- [SECTIONS 27-28] o2Remaining is set to full at rental time — this is the ONLY
    -- server-side event that grants a full tank. Reconnects read o2Remaining, not o2Max.
    local o2Full = gearCfg.o2Duration or 120
    session.data.gearTier    = tierName
    session.data.o2Max       = o2Full
    session.data.o2Remaining = o2Full
    -- Mark rental item so it can be cleaned up on shift end
    session.data.rentedGearItem = item

    exports.sunset_inventory:ReloadInventory(source)
    exports.sunset_core:RefreshMoney(source)
    dlog('char %s rented %s gear for $%d', charId(source), tierName, cost)
    return { tier = tierName, o2Duration = gearCfg.o2Duration, cost = cost }
end)

-- ── Rent Boat ─────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:rentBoat', function(source)
    if not checkRate(source, 'rentBoat') then return nil, { localeKey = 'jobs.message.too_many_requests' } end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.start_your_shift_first' } end

    -- Must hold boat license
    if GetResourceState('sunset_licenses') ~= 'started' then
        return nil, { localeKey = 'jobs.message.licensing_service_unavailable_try_again_in_a_moment' }
    end
    if exports.sunset_licenses:HasLicense(source, 'boat') ~= true then
        return nil, { localeKey = 'jobs.message.requires_a_valid_boat_license_bwc_visit_lssi_maritime' }
    end

    -- [JOBS AUDIT] a boat that was destroyed/despawned used to block renting forever (RentedBoats kept
    -- the dead netId until shift end), and a second rent while a spawn was pending lost the first fee.
    if RentedBoats[source] then
        local old = NetworkGetEntityFromNetworkId(RentedBoats[source])
        if old and old ~= 0 and DoesEntityExist(old) then
            return nil, { localeKey = 'jobs.message.you_already_have_a_boat_rented_return_it_first' }
        end
        RentedBoats[source] = nil
    end
    if PendingBoatRentals[source] and os.time() - PendingBoatRentals[source].createdAt <= BOAT_TOKEN_EXPIRY_SEC + 5 then
        return nil, { localeKey = 'jobs.message.too_many_requests' }
    end

    local cfgDiver = Sunset.JobsConfig.diver
    local cost = cfgDiver and cfgDiver.boatRentCost or 80
    local removed = exports.sunset_core:RemoveMoney(source, 'cash', cost, 'boat_rental')
    if not removed then return nil, { localeKey = 'jobs.message.insufficient_funds_boat_rental_costs_value', formatArgs = { cost } } end

    local model = cfgDiver and cfgDiver.boatModel or 'dinghy'
    -- Boat spawn coords from active contract or default dock
    local spawnCoords = { x = -798.2, y = -1502.5, z = 0.12, h = 110.0 }
    local snap = Snapshots[source]
    if snap and snap.siteId then
        local site = getDiveSite(snap.siteId)
        if site and site.boatSpawn then spawnCoords = site.boatSpawn end
    end

    -- [SECTION 31] Generate token AFTER charging. Store pending rental so boatSpawned
    -- can validate the spawn is legitimate before registering the boat.
    exports.sunset_core:RefreshMoney(source)
    local token            = genToken()
    local expectedModelHash = GetHashKey(model)
    PendingBoatRentals[source] = {
        token             = token,
        expectedModelHash = expectedModelHash,
        expectedSpawn     = spawnCoords,
        cost              = cost,
        createdAt         = os.time(),
    }
    -- [JOBS AUDIT] If the client never confirms the spawn (crash, model load failure, dropped event) the fee
    -- was kept with no boat. Refund automatically when the pending rental expires unclaimed.
    local pendingRef = PendingBoatRentals[source]
    SetTimeout((BOAT_TOKEN_EXPIRY_SEC + 5) * 1000, function()
        if PendingBoatRentals[source] == pendingRef and GetPlayerName(source) then
            PendingBoatRentals[source] = nil
            exports.sunset_core:AddMoney(source, 'cash', pendingRef.cost, 'boat_rental_refund')
            exports.sunset_core:RefreshMoney(source)
            TriggerClientEvent('sunset:client:notify', source,
                ('Boat rental was not completed. Your $%d has been refunded.'):format(pendingRef.cost), 'warning', 6000)
        end
    end)
    -- Send token alongside model+spawn so the client can echo it back in boatSpawned
    TriggerClientEvent('sunset:diving:spawnBoat', source, model, spawnCoords, cost, token)
    return { spawning = true, model = model, spawnCoords = spawnCoords }
end)

-- [SECTION 32] Client reports back token+netId after spawning.
-- Server validates token, expiry, entity type, model hash, and proximity before registering.
RegisterNetEvent('sunset:diving:boatSpawned', function(netId, clientToken)
    local src = source
    netId = tonumber(netId)
    if not netId or netId == 0 then return end

    local pending = PendingBoatRentals[src]
    if not pending then
        dlog('boatSpawned: no pending rental for src=%d — ignoring', src)
        return
    end

    -- Always consume the pending slot (one-shot token)
    PendingBoatRentals[src] = nil

    local function refundAndDelete(reason)
        dlog('boatSpawned REJECTED (%s) src=%d — refunding $%d', reason, src, pending.cost)
        exports.sunset_core:AddMoney(src, 'cash', pending.cost, 'boat_rental_refund')
        exports.sunset_core:RefreshMoney(src)
        local ent = NetworkGetEntityFromNetworkId(netId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
        TriggerClientEvent('sunset:client:notify', src,
            ('Boat rental invalid (%s). Your $%d has been refunded.'):format(reason, pending.cost),
            'error', 6000)
    end

    -- Token exact match
    if tostring(clientToken) ~= tostring(pending.token) then
        return refundAndDelete('token_mismatch')
    end

    -- Expiry check (30 seconds)
    if os.time() - pending.createdAt > BOAT_TOKEN_EXPIRY_SEC then
        return refundAndDelete('token_expired')
    end

    -- Entity must exist and be a vehicle
    local ent = NetworkGetEntityFromNetworkId(netId)
    if not ent or ent == 0 or not DoesEntityExist(ent) or GetEntityType(ent) ~= 2 then
        return refundAndDelete('entity_invalid')
    end

    -- Model hash must match what the server told the client to spawn
    local actualHash = GetEntityModel(ent)
    if actualHash ~= pending.expectedModelHash then
        return refundAndDelete('model_mismatch')
    end

    -- Entity must be within 30m of expected spawn position
    local epos = GetEntityCoords(ent)
    local esp  = pending.expectedSpawn
    local dist = math.sqrt((epos.x - esp.x)^2 + (epos.y - esp.y)^2 + (epos.z - esp.z)^2)
    if dist > 30.0 then
        return refundAndDelete('out_of_range')
    end

    -- All checks passed — register boat
    RentedBoats[src] = netId
    dlog('char %s boat registered netId=%d model=%d dist=%.1f', charId(src), netId, actualHash, dist)
end)

-- ── Salvage Phase 1: Begin Salvage (issues token, does NOT claim) ─────────────
-- [SECTION 33] Phase 1: server validates player+point, issues a hold token.
-- The point is NOT claimed yet — that happens in completeSalvage after minDuration.
exports.sunset_core:RegisterCallback('sunset:jobs:diver:beginSalvage', function(source, pointIndex)
    if not checkRate(source, 'beginSalvage') then return nil, { localeKey = 'jobs.message.too_many_requests' } end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.no_active_diver_shift' } end

    local snap = Snapshots[source]
    if not snap then return nil, { localeKey = 'jobs.message.no_active_contract_choose_a_contract_first' } end

    -- Gear revalidation (player must still have a valid gear tier in session)
    if not session.data.gearTier then return nil, { localeKey = 'jobs.message.no_diving_gear_return_to_terry_first' } end

    pointIndex = tonumber(pointIndex)
    if not pointIndex then return nil, { localeKey = 'jobs.message.invalid_loot_point_index' } end

    local pt = snap.lootPoints[pointIndex]
    if not pt then return nil, { localeKey = 'jobs.message.loot_point_not_found' } end
    if pt.claimed then return nil, { localeKey = 'jobs.message.already_salvaged' } end
    if ClaimedPoints[source] and ClaimedPoints[source][pointIndex] then
        return nil, { localeKey = 'jobs.message.already_salvaged' }
    end

    -- Player must be alive
    local ped = GetPlayerPed(source)
    if IsEntityDead(ped) then return nil, { localeKey = 'jobs.message.cannot_salvage_while_dead' } end

    -- Proximity check at begin (server-side)
    if not SunsetJobs_ValidateCoords(source,
        vector3(pt.x, pt.y, pt.z),
        Sunset.JobsConfig.diver.salvageRadius or 4.0) then
        return nil, { localeKey = 'jobs.message.move_closer_to_the_salvage_point' }
    end

    -- Issue token — one per player at a time
    local token = genToken()
    SalvageTokens[source] = {
        token       = token,
        pointIndex  = pointIndex,
        issuedAt    = os.time(),
        minDuration = SALVAGE_MIN_HOLD_SEC,
    }
    dlog('char %s beginSalvage pointIndex=%d token=%s', charId(source), pointIndex, token)
    return { token = token, minDuration = SALVAGE_MIN_HOLD_SEC }
end)

-- ── Salvage Phase 2: Complete Salvage (validates hold, claims point) ──────────
-- [SECTION 34] Phase 2: validates token, elapsed time, point still unclaimed,
-- session active, gear still valid, player alive, proximity. THEN claims.
exports.sunset_core:RegisterCallback('sunset:jobs:diver:completeSalvage', function(source, pointIndex, clientToken)
    if not checkRate(source, 'completeSalvage') then return nil, { localeKey = 'jobs.message.too_many_requests' } end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.no_active_diver_shift' } end

    local snap = Snapshots[source]
    if not snap then return nil, { localeKey = 'jobs.message.no_active_contract_choose_a_contract_first' } end

    pointIndex = tonumber(pointIndex)
    if not pointIndex then return nil, { localeKey = 'jobs.message.invalid_loot_point_index' } end

    -- Token validation
    local hold = SalvageTokens[source]
    if not hold then return nil, { localeKey = 'jobs.message.no_salvage_in_progress_hold_e_on_a_point' } end
    if tostring(clientToken) ~= tostring(hold.token) then
        SalvageTokens[source] = nil
        return nil, { localeKey = 'jobs.message.salvage_token_invalid' }
    end
    if hold.pointIndex ~= pointIndex then
        SalvageTokens[source] = nil
        return nil, { localeKey = 'jobs.message.salvage_point_mismatch' }
    end

    -- Elapsed time check
    local elapsed = os.time() - hold.issuedAt
    if elapsed < (hold.minDuration or SALVAGE_MIN_HOLD_SEC) then
        SalvageTokens[source] = nil
        return nil, { localeKey = 'jobs.message.hold_the_point_for_value_seconds', formatArgs = { hold.minDuration or SALVAGE_MIN_HOLD_SEC } }
    end

    -- Consume token (one-shot)
    SalvageTokens[source] = nil

    local pt = snap.lootPoints[pointIndex]
    if not pt then return nil, { localeKey = 'jobs.message.loot_point_not_found' } end
    if pt.claimed then return nil, { localeKey = 'jobs.message.already_salvaged' } end
    if ClaimedPoints[source] and ClaimedPoints[source][pointIndex] then
        return nil, { localeKey = 'jobs.message.already_salvaged' }
    end

    -- Gear revalidation (must still have a valid gear tier in session)
    if not session.data.gearTier then return nil, { localeKey = 'jobs.message.gear_missing_return_to_terry' } end

    -- Player must be alive
    local ped = GetPlayerPed(source)
    if IsEntityDead(ped) then return nil, { localeKey = 'jobs.message.cannot_salvage_while_dead' } end

    -- Proximity re-check at completion
    if not SunsetJobs_ValidateCoords(source,
        vector3(pt.x, pt.y, pt.z),
        Sunset.JobsConfig.diver.salvageRadius or 4.0) then
        return nil, { localeKey = 'jobs.message.moved_too_far_from_the_salvage_point' }
    end

    -- Mark claimed BEFORE inventory add (idempotency guard)
    pt.claimed = true
    ClaimedPoints[source][pointIndex] = true

    -- Server-authoritative loot selection
    local cfgDiver = Sunset.JobsConfig.diver
    local lootTables = cfgDiver and cfgDiver.lootTables
    local difficulty  = snap.difficulty or 'easy'
    local lootTable   = lootTables and lootTables[difficulty] or {}
    if #lootTable == 0 then
        pt.claimed = false
        ClaimedPoints[source][pointIndex] = nil
        return nil, { localeKey = 'jobs.message.loot_table_not_configured_contact_an_admin' }
    end

    local lootEntry = pickLootItem(lootTable)
    local itemMeta  = {
        salvageFrom = snap.siteId,
        difficulty  = difficulty,
        condition   = lootEntry.condition or 'worn',
        value       = lootEntry.value or 50,
        salvageIdx  = pointIndex,
        savedAt     = os.time(),
    }

    local ok = exports.sunset_inventory:AddItem(source, lootEntry.item, 1, nil, itemMeta)
    if not ok then
        pt.claimed = false
        ClaimedPoints[source][pointIndex] = nil
        return nil, { localeKey = 'jobs.message.inventory_full_drop_something_and_try_again' }
    end
    exports.sunset_inventory:ReloadInventory(source)

    snap.recovered = snap.recovered + 1
    session.data.recovered = snap.recovered
    SunsetJobs_AddJobXP(source, 'diver', cfgDiver and cfgDiver.xpPerSalvage or 25)

    -- All salvage recovered? Move to return-to-Terry stage instead of paying immediately.
    local allRecovered = snap.recovered >= snap.required
    if allRecovered then
        session.data.stage = 'return_to_terry'
        TriggerClientEvent('sunset:jobs:stateChanged', source, session.state, session.data)
        TriggerClientEvent('sunset:diving:returnToTerry', source)
    else
        TriggerClientEvent('sunset:jobs:stateChanged', source, session.state, session.data)
    end

    dlog('char %s salvaged %d/%d at site %s', charId(source), snap.recovered, snap.required, snap.siteId)
    return {
        item       = lootEntry.item,
        condition  = itemMeta.condition,
        value      = itemMeta.value,
        recovered  = snap.recovered,
        required   = snap.required,
        completed  = allRecovered,
    }
end)

-- ── Sell Salvage ──────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:sell', function(source)
    if not checkRate(source, 'sell') then return nil, { localeKey = 'jobs.message.too_many_requests' } end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.no_active_diver_shift' } end

    -- [JOBS AUDIT] No proximity check existed: salvage could be sold from anywhere. Sell at Terry.
    if not SunsetJobs_ValidateCoords(source, vector3(TERRY_COORDS.x, TERRY_COORDS.y, TERRY_COORDS.z), 20.0) then
        return nil, { localeKey = 'jobs.message.return_to_terry_at_the_vespucci_waterfront_to_hand' }
    end
    if SellBusy[source] then return nil, { localeKey = 'jobs.message.sale_already_being_processed' } end
    SellBusy[source] = true
    local okRun, resA, resB = pcall(function()
    local salvageItems = { 'salvage_parts', 'marine_electronics', 'sealed_cargo', 'marine_artifact' }
    local totalValue = 0
    local sold = {}

    -- [SECTION 24] Atomic sell: snapshot → remove → pay → restore on failure.
    -- Preserve site/condition/value/rarity/salvageIdx/savedAt metadata for restore.
    local inv = exports.sunset_inventory:GetInventory(source)
    if not inv then return nil, { localeKey = 'jobs.message.could_not_load_inventory' } end

    local salvageSet = {}
    for _, si in ipairs(salvageItems) do salvageSet[si] = true end

    local snapshots = {}  -- full slot snapshot for restore-on-failure
    for _, slot in ipairs(inv) do
        if salvageSet[slot.item] then
            local meta = type(slot.metadata) == 'table' and slot.metadata or {}
            local itemVal = tonumber(meta.value) or 30
            totalValue = totalValue + itemVal
            sold[#sold + 1] = { item = slot.item, slot = slot.slot, value = itemVal }
            snapshots[#snapshots + 1] = {
                item     = slot.item,
                count    = slot.count or 1,
                metadata = meta,
            }
        end
    end

    if #sold == 0 then return nil, { localeKey = 'jobs.message.no_salvage_items_to_sell_go_dive_first' } end

    -- Remove items first (every removal verified); restore with full metadata if anything fails.
    local removedUpTo = 0
    for i, s2 in ipairs(sold) do
        if exports.sunset_inventory:RemoveItem(source, s2.item, 1) then
            removedUpTo = i
        else
            break
        end
    end
    if removedUpTo < #sold then
        for i = 1, removedUpTo do
            local snap = snapshots[i]
            exports.sunset_inventory:AddItem(source, snap.item, 1, nil, snap.metadata)
        end
        exports.sunset_inventory:ReloadInventory(source)
        return nil, { localeKey = 'jobs.message.could_not_load_inventory' }
    end

    local paid = totalValue <= 0 or exports.sunset_core:AddMoney(source, 'cash', totalValue, 'diver_sell')
    if not paid then
        for _, snap in ipairs(snapshots) do
            exports.sunset_inventory:AddItem(source, snap.item, 1, nil, snap.metadata)
        end
        exports.sunset_inventory:ReloadInventory(source)
        return nil, { localeKey = 'jobs.message.payment_failed_your_salvage_items_have_been_returned_try' }
    end

    pcall(SunsetJobs_AddJobProgress, source, 'diver', math.max(5, math.floor(totalValue / 10)), 0, totalValue)
    exports.sunset_inventory:ReloadInventory(source)
    exports.sunset_core:RefreshMoney(source)
    dlog('char %d sold %d salvage items for $%d', charId(source), #sold, totalValue)
    return { total = totalValue, count = #sold }
    end)
    SellBusy[source] = nil
    if not okRun then error(resA, 0) end
    return resA, resB
end)

-- ── O2 State Persistence ─────────────────────────────────────
-- [SECTIONS 27-28] O2 belongs to the rented tank. The client reports its
-- current O2 remaining when surfacing (and every 15s while diving) so the
-- server can persist it to session.data. On reconnect the client reads
-- session.data.o2Remaining instead of resetting to o2Max (free refill bug).
RegisterNetEvent('sunset:diving:reportO2', function(o2Remaining)
    local src = source
    if not checkRate(src, 'reportO2') then return end
    local session = SunsetJobs_GetSession(src)
    if not session or session.jobId ~= 'diver' then return end
    -- Clamp to [0, o2Max] — never allow client to inflate O2 above the rented max
    local o2Max = session.data.o2Max or 120
    o2Remaining = math.max(0, math.min(o2Max, tonumber(o2Remaining) or 0))
    session.data.o2Remaining = o2Remaining
    dlog('char %s reported o2Remaining=%d', charId(src), o2Remaining)
end)

-- ── Start Shift ───────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:start', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'jobs.message.character_not_loaded' } end

    local existing = SunsetJobs_GetSession(source)
    if existing and existing.jobId == 'diver' then return existing.data end

    local level = diverLevel(source)
    local session, err = SunsetJobs_StartSession(source, 'diver', {
        level      = level,
        contractId = nil,
        siteId     = nil,
        recovered  = 0,
        stage      = 'idle',
    })
    if not session then return nil, err end
    return session.data
end)

-- ── End Shift ─────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:endShift', function(source)
    -- Return boat if rented
    local boatNetId = RentedBoats[source]
    if boatNetId then
        local ent = NetworkGetEntityFromNetworkId(boatNetId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then
            DeleteEntity(ent)
        end
        RentedBoats[source] = nil
    end

    -- Gear/boat/snapshots are cleaned by the serverSessionEnded hook raised from ClearSession.
    -- [JOBS AUDIT] COMPLETED from STARTING is an illegal transition -> shift stuck; use the legal-ending helper.
    local session = SunsetJobs_GetSession(source)
    if not session or session.jobId ~= 'diver' then return nil, { localeKey = 'jobs.message.no_active_diver_shift' } end
    Snapshots[source]     = nil
    ClaimedPoints[source] = nil
    SunsetJobs_EndShift(source, 'Shift ended by player')
    return true
end)

-- ── Terry Handoff (contract completion) ──────────────────────
-- Called when player returns to Terry with recovered salvage.

exports.sunset_core:RegisterCallback('sunset:jobs:diver:handoff', function(source)
    if not checkRate(source, 'handoff') then return nil, { localeKey = 'jobs.message.too_many_requests' } end

    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, { localeKey = 'jobs.message.no_active_diver_shift' } end

    local snap = Snapshots[source]
    if not snap then return nil, { localeKey = 'jobs.message.no_active_contract_choose_a_contract_first' } end

    if session.data.stage ~= 'return_to_terry' then
        return nil, { localeKey = 'jobs.message.nothing_to_hand_off_yet_recover_all_salvage_first' }
    end

    if snap.recovered < snap.required then
        return nil, { localeKey = 'jobs.message.recover_all_salvage_first_value_value', formatArgs = { snap.recovered, snap.required } }
    end

    -- Proximity check to Terry NPC
    if not SunsetJobs_ValidateCoords(source,
        vector3(TERRY_COORDS.x, TERRY_COORDS.y, TERRY_COORDS.z),
        TERRY_HANDOFF_RADIUS) then
        return nil, { localeKey = 'jobs.message.return_to_terry_at_the_vespucci_waterfront_to_hand' }
    end

    -- [SECTION 35] Idempotency guard: transition stage to 'idle' BEFORE paying out.
    -- If the callback fires twice (double-tap, lag) the stage check above exits on
    -- the second call. Clearing the snapshot first ensures payment cannot happen twice.
    local cfgDiver = Sunset.JobsConfig.diver
    local bonus  = snap.pay or 0
    local xpBonus = (cfgDiver and cfgDiver.xpPerContract) or 80
    local siteId = snap.siteId

    -- Atomically disarm the handoff BEFORE payment
    local claimed = ClaimedPoints[source]
    session.data.stage      = 'idle'
    session.data.contractId = nil
    session.data.recovered  = 0
    Snapshots[source]     = nil
    ClaimedPoints[source] = nil

    -- Pay out the contract bonus
    local paid = bonus <= 0 or exports.sunset_core:AddMoney(source, 'cash', bonus, 'diver_contract_complete')
    if not paid then
        -- [JOBS AUDIT] The contract used to be disarmed and the client told "Contract complete" even though
        -- the payout failed. Restore the armed handoff so the player can simply retry.
        session.data.stage      = 'return_to_terry'
        session.data.contractId = siteId
        session.data.recovered  = snap.recovered
        Snapshots[source]       = snap
        ClaimedPoints[source]   = claimed
        return nil, { localeKey = 'jobs.message.payment_failed_your_salvage_items_have_been_returned_try' }
    end
    if bonus > 0 then
        SunsetJobs_AddJobProgress(source, 'diver', xpBonus, 1, bonus)
        exports.sunset_core:RefreshMoney(source)
    end
    TriggerClientEvent('sunset:diving:contractComplete', source, {
        siteId = siteId,
        bonus  = bonus,
        xp     = xpBonus,
    })

    dlog('char %s completed handoff at Terry, site=%s bonus=$%d', charId(source), siteId, bonus)
    return { total = bonus, xp = xpBonus, siteId = siteId }
end)

-- ── Return Boat ───────────────────────────────────────────────
RegisterNetEvent('sunset:diving:returnBoat', function()
    local src = source
    local boatNetId = RentedBoats[src]
    if not boatNetId then return end
    local ent = NetworkGetEntityFromNetworkId(boatNetId)
    if ent and ent ~= 0 and DoesEntityExist(ent) then
        DeleteEntity(ent)
    end
    RentedBoats[src] = nil
    TriggerClientEvent('sunset:diving:boatReturned', src)
end)

-- ── Abandon Contract ──────────────────────────────────────────
RegisterNetEvent('sunset:diving:abandonContract', function()
    local src = source
    Snapshots[src]     = nil
    ClaimedPoints[src] = nil
    SalvageTokens[src] = nil
    PendingBoatRentals[src] = nil
    local session = SunsetJobs_GetSession(src)
    if session and session.jobId == 'diver' then
        session.data.contractId = nil
        session.data.recovered  = 0
        session.data.stage      = 'idle'
        SunsetJobs_SetState(src, 'ACTIVE')
        TriggerClientEvent('sunset:jobs:stateChanged', src, 'ACTIVE', session.data)
    end
end)

-- ── Cleanup ───────────────────────────────────────────────────
-- [JOBS AUDIT] was AddEventHandler('sunset:jobs:sessionEnded') - a CLIENT-only event, so this cleanup
-- (rented boat, rented gear, snapshots) never ran on cancel/death/timeout. Core now raises
-- 'sunset:jobs:serverSessionEnded' with the ended session table (the live session is already gone).
AddEventHandler('sunset:jobs:serverSessionEnded', function(src, jobId, state, reason, endedSession)
    src = tonumber(src)
    if not src or jobId ~= 'diver' then return end
    -- Delete rented boat
    local boatNetId = RentedBoats[src]
    if boatNetId then
        local ent = NetworkGetEntityFromNetworkId(boatNetId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
        RentedBoats[src] = nil
    end
    -- [SECTION 29] Recover rented gear on ANY session end path (endShift, cancelWork, death, timeout).
    local data = endedSession and endedSession.data
    if data and data.rentedGearItem and GetPlayerName(src) then
        pcall(function()
            exports.sunset_inventory:RemoveItem(src, data.rentedGearItem, 1)
            exports.sunset_inventory:ReloadInventory(src)
        end)
        data.rentedGearItem = nil
    end
    -- Fee paid for a boat whose spawn was never confirmed: refund (the client deletes its own spawn on session end).
    local pendingRental = PendingBoatRentals[src]
    if pendingRental and GetPlayerName(src) then
        exports.sunset_core:AddMoney(src, 'cash', pendingRental.cost, 'boat_rental_refund')
        exports.sunset_core:RefreshMoney(src)
    end
    Snapshots[src]          = nil
    ClaimedPoints[src]      = nil
    SalvageTokens[src]      = nil
    PendingBoatRentals[src] = nil
end)

AddEventHandler('playerDropped', function()
    local src = source
    local boatNetId = RentedBoats[src]
    if boatNetId then
        local ent = NetworkGetEntityFromNetworkId(boatNetId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
        RentedBoats[src] = nil
    end
    Snapshots[src]          = nil
    ClaimedPoints[src]      = nil
    SalvageTokens[src]      = nil
    PendingBoatRentals[src] = nil
    RateLimit[src]          = nil
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for src, netId in pairs(RentedBoats) do
        local ent = NetworkGetEntityFromNetworkId(netId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
    end
    Snapshots          = {}
    ClaimedPoints      = {}
    RentedBoats        = {}
    SalvageTokens      = {}
    PendingBoatRentals = {}
end)
