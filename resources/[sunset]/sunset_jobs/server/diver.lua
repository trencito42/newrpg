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

-- ── Active Contract Snapshots ────────────────────────────────
-- Snapshots[source] = { siteId, lootPoints=[{x,y,z,claimed=false}],
--                       required, recovered=0, pay, difficulty, gear, boatNetId }
local Snapshots = {}

-- Claimed salvage: ClaimedPoints[source][idx] = true
-- Per-source so they can't claim the same point twice
local ClaimedPoints = {}

-- Rented boats: RentedBoats[source] = netId
local RentedBoats = {}

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
    if not session then return nil, 'Start your shift first' end

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
    if not checkRate(source, 'startContract') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, 'Start your shift first' end

    if Snapshots[source] then
        return nil, ('You already have a contract active: %s. Abandon it first.'):format(Snapshots[source].siteId)
    end

    siteId = tostring(siteId or '')
    local site = getDiveSite(siteId)
    if not site then return nil, 'Unknown dive site' end

    local level = session.data.level or 1
    if site.minRank > level then
        return nil, ('Requires Diver Rank %d (you are Rank %d)'):format(site.minRank, level)
    end

    -- Boat license check for offshore sites (FAIL CLOSED)
    if site.requiresBoat then
        if GetResourceState('sunset_licenses') ~= 'started' then
            return nil, 'Licensing service unavailable. Try again in a moment.'
        end
        if exports.sunset_licenses:HasLicense(source, 'boat') ~= true then
            return nil, 'Offshore sites require a valid Boat License (BWC). Visit LSSI.'
        end
    end

    -- Check player has scuba gear (also accept advanced_tank)
    local hasScuba  = exports.sunset_inventory:HasItem(source, 'scuba_gear', 1)
    local hasAdv    = exports.sunset_inventory:HasItem(source, 'advanced_tank', 1)
    if not hasScuba and not hasAdv then
        return nil, 'You need Diving Gear. Rent from Terry first.'
    end

    -- Server randomly selects loot points (immutable snapshot)
    if not site.lootPoints or #site.lootPoints == 0 then
        return nil, 'Dive site has no loot points configured. Contact an admin.'
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
    if not checkRate(source, 'rentGear') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, 'Start your shift first' end

    tierName = tostring(tierName or 'basic')
    local cfgDiver = Sunset.JobsConfig.diver
    if not cfgDiver or not cfgDiver.gear then return nil, 'Gear config missing' end

    local gearCfg = cfgDiver.gear[tierName]
    if not gearCfg then return nil, ('Unknown gear tier: %s'):format(tierName) end

    local level = session.data.level or 1
    if level < (gearCfg.minRank or 1) then
        return nil, ('This gear requires Diver Rank %d'):format(gearCfg.minRank)
    end

    local cost = gearCfg.rentCost or 30
    local removed = exports.sunset_core:RemoveMoney(source, 'cash', cost, 'gear_rental')
    if not removed then return nil, ('Insufficient funds — gear costs $%d'):format(cost) end

    -- Grant gear item
    local item = tierName == 'advanced' and 'advanced_tank' or 'scuba_gear'
    local ok = exports.sunset_inventory:AddItem(source, item, 1)
    if not ok then
        exports.sunset_core:AddMoney(source, 'cash', cost, 'gear_rental_refund')
        return nil, 'Inventory full — could not add gear'
    end

    -- Store gear tier and O2 in session so contract start is server-authoritative
    session.data.gearTier = tierName
    session.data.o2Max    = gearCfg.o2Duration or 120
    -- Mark rental item so it can be cleaned up on shift end
    session.data.rentedGearItem = item

    exports.sunset_inventory:ReloadInventory(source)
    exports.sunset_core:RefreshMoney(source)
    dlog('char %s rented %s gear for $%d', charId(source), tierName, cost)
    return { tier = tierName, o2Duration = gearCfg.o2Duration, cost = cost }
end)

-- ── Rent Boat ─────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:rentBoat', function(source)
    if not checkRate(source, 'rentBoat') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, 'Start your shift first' end

    -- Must hold boat license
    if GetResourceState('sunset_licenses') ~= 'started' then
        return nil, 'Licensing service unavailable. Try again in a moment.'
    end
    if exports.sunset_licenses:HasLicense(source, 'boat') ~= true then
        return nil, 'Requires a valid Boat License (BWC). Visit LSSI Maritime School.'
    end

    if RentedBoats[source] then
        return nil, 'You already have a boat rented. Return it first.'
    end

    local cfgDiver = Sunset.JobsConfig.diver
    local cost = cfgDiver and cfgDiver.boatRentCost or 80
    local removed = exports.sunset_core:RemoveMoney(source, 'cash', cost, 'boat_rental')
    if not removed then return nil, ('Insufficient funds — boat rental costs $%d'):format(cost) end

    local model = cfgDiver and cfgDiver.boatModel or 'dinghy'
    -- Boat spawn coords from active contract or default dock
    local spawnCoords = { x = -798.2, y = -1502.5, z = 0.12, h = 110.0 }
    local snap = Snapshots[source]
    if snap and snap.siteId then
        local site = getDiveSite(snap.siteId)
        if site and site.boatSpawn then spawnCoords = site.boatSpawn end
    end

    -- Ask the client to spawn the boat entity and report back the netId
    -- (boats are physical entities best spawned on client-side)
    exports.sunset_core:RefreshMoney(source)
    TriggerClientEvent('sunset:diving:spawnBoat', source, model, spawnCoords, cost)
    return { spawning = true, model = model, spawnCoords = spawnCoords }
end)

-- Client reports back boat netId after spawning
RegisterNetEvent('sunset:diving:boatSpawned', function(netId)
    local src = source
    netId = tonumber(netId)
    if not netId or netId == 0 then return end
    -- Validate entity is a vehicle
    local ent = NetworkGetEntityFromNetworkId(netId)
    if not ent or ent == 0 or not DoesEntityExist(ent) or GetEntityType(ent) ~= 2 then return end
    RentedBoats[src] = netId
    dlog('char %s boat registered netId=%d', charId(src), netId)
end)

-- ── Salvage Item ──────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:salvage', function(source, pointIndex)
    if not checkRate(source, 'salvage') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, 'No active Diver shift' end

    local snap = Snapshots[source]
    if not snap then return nil, 'No active contract — choose a contract first' end

    pointIndex = tonumber(pointIndex)
    if not pointIndex then return nil, 'Invalid loot point index' end

    local pt = snap.lootPoints[pointIndex]
    if not pt then return nil, 'Loot point not found' end
    if pt.claimed then return nil, 'Already salvaged' end

    -- Idempotency: also check per-source claim table
    if ClaimedPoints[source] and ClaimedPoints[source][pointIndex] then
        return nil, 'Already salvaged'
    end

    -- Proximity check
    if not SunsetJobs_ValidateCoords(source,
        vector3(pt.x, pt.y, pt.z),
        Sunset.JobsConfig.diver.salvageRadius or 4.0) then
        return nil, 'Move closer to the salvage point'
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
        return nil, 'Loot table not configured. Contact an admin.'
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
        return nil, 'Inventory full — drop something and try again'
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
    if not checkRate(source, 'sell') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, 'No active Diver shift' end

    local salvageItems = { 'salvage_parts', 'marine_electronics', 'sealed_cargo', 'marine_artifact' }
    local totalValue = 0
    local sold = {}

    -- [SECTION 24] Atomic sell: snapshot → remove → pay → restore on failure.
    -- Preserve site/condition/value/rarity/salvageIdx/savedAt metadata for restore.
    local inv = exports.sunset_inventory:GetInventory(source)
    if not inv then return nil, 'Could not load inventory' end

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

    if #sold == 0 then return nil, 'No salvage items to sell. Go dive first.' end

    -- Remove items first; restore with full metadata if payment fails.
    for _, s in ipairs(sold) do
        exports.sunset_inventory:RemoveItem(source, s.item, 1)
    end

    local paid = exports.sunset_core:AddMoney(source, 'cash', totalValue, 'diver_sell')
    if not paid then
        for _, snap in ipairs(snapshots) do
            exports.sunset_inventory:AddItem(source, snap.item, snap.count, nil, snap.metadata)
        end
        exports.sunset_inventory:ReloadInventory(source)
        return nil, 'Payment failed — your salvage items have been returned. Try again.'
    end

    SunsetJobs_AddJobProgress(source, 'diver', math.max(5, math.floor(totalValue / 10)), 0, totalValue)
    exports.sunset_inventory:ReloadInventory(source)
    exports.sunset_core:RefreshMoney(source)
    dlog('char %d sold %d salvage items for $%d', charId(source), #sold, totalValue)
    return { total = totalValue, count = #sold }
end)

-- ── Start Shift ───────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:diver:start', function(source)
    local char = getChar(source)
    if not char then return nil, 'Character not loaded' end

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

    -- Remove rented gear item on shift end
    local session = SunsetJobs_GetSession(source)
    if session and session.data and session.data.rentedGearItem then
        exports.sunset_inventory:RemoveItem(source, session.data.rentedGearItem, 1)
    end

    Snapshots[source]     = nil
    ClaimedPoints[source] = nil
    SunsetJobs_ClearSession(source, 'COMPLETED', 'Shift ended by player')
    return true
end)

-- ── Terry Handoff (contract completion) ──────────────────────
-- Called when player returns to Terry with recovered salvage.
local TERRY_COORDS = { x = -812.0, y = -1282.0, z = 5.0 }
local TERRY_HANDOFF_RADIUS = 15.0

exports.sunset_core:RegisterCallback('sunset:jobs:diver:handoff', function(source)
    if not checkRate(source, 'handoff') then return nil, 'Too many requests' end

    local session = SunsetJobs_RequireSession(source, 'diver', nil)
    if not session then return nil, 'No active Diver shift' end

    local snap = Snapshots[source]
    if not snap then return nil, 'No active contract — choose a contract first' end

    if session.data.stage ~= 'return_to_terry' then
        return nil, 'Nothing to hand off yet. Recover all salvage first.'
    end

    if snap.recovered < snap.required then
        return nil, ('Recover all salvage first (%d/%d).'):format(snap.recovered, snap.required)
    end

    -- Proximity check to Terry NPC
    if not SunsetJobs_ValidateCoords(source,
        vector3(TERRY_COORDS.x, TERRY_COORDS.y, TERRY_COORDS.z),
        TERRY_HANDOFF_RADIUS) then
        return nil, 'Return to Terry at the Vespucci waterfront to hand off the salvage.'
    end

    -- Pay out the contract bonus
    local cfgDiver = Sunset.JobsConfig.diver
    local bonus  = snap.pay or 0
    local xpBonus = (cfgDiver and cfgDiver.xpPerContract) or 80

    local paid = exports.sunset_core:AddMoney(source, 'cash', bonus, 'diver_contract_complete')
    if paid then
        SunsetJobs_AddJobProgress(source, 'diver', xpBonus, 1, bonus)
        exports.sunset_core:RefreshMoney(source)
    end

    local siteId = snap.siteId
    Snapshots[source]     = nil
    ClaimedPoints[source] = nil
    session.data.contractId = nil
    session.data.recovered  = 0
    session.data.stage      = 'idle'
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
AddEventHandler('sunset:jobs:sessionEnded', function(src, jobId)
    src = tonumber(src) or source
    if jobId ~= 'diver' then return end
    -- Delete rented boat
    local boatNetId = RentedBoats[src]
    if boatNetId then
        local ent = NetworkGetEntityFromNetworkId(boatNetId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
        RentedBoats[src] = nil
    end
    Snapshots[src]     = nil
    ClaimedPoints[src] = nil
end)

AddEventHandler('playerDropped', function()
    local src = source
    local boatNetId = RentedBoats[src]
    if boatNetId then
        local ent = NetworkGetEntityFromNetworkId(boatNetId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
        RentedBoats[src] = nil
    end
    Snapshots[src]     = nil
    ClaimedPoints[src] = nil
    RateLimit[src]     = nil
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for src, netId in pairs(RentedBoats) do
        local ent = NetworkGetEntityFromNetworkId(netId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then DeleteEntity(ent) end
    end
    Snapshots     = {}
    ClaimedPoints = {}
    RentedBoats   = {}
end)
