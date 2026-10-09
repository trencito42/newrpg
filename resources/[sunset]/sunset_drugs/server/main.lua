-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Drug Pipeline Server (server/main.lua)
--  Manufacture (Harvest) → Process (Clandestine Lab) → Street Sale.
--  100% Server-Authoritative with Tokens & Anti-Exploit Security.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetDrugs.Config

-- Security State Tables
local HarvestSessions = {}   -- [source] = { token, spotIndex, drugType, lastHitMs, count }
local LabOpen = {}           -- [source] = { labIndex, openedAt }
local LabAttempts = {}       -- [source] = { token, recipeType, labIndex, startedAt, completing }
local SaleSessions = {}      -- [source] = { token, netPed, drugType, qty, basePrice, risk, startedAt }
local PedCooldowns = {}      -- [pedNetId] = expiryTime

local function notify(source, msg, kind, duration)
    TriggerClientEvent('sunset:client:notify', source, msg, kind or 'info', duration or 5000)
end

local function dlog(msg)
    if GetConvar('sv_sunset_drugs_debug', '0') == '1' then
        print('[DRUGS-SERVER] ' .. msg)
    end
end

local function pedCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

local function nearAny(coords, list, radius)
    if not coords then return false end
    for i, point in ipairs(list or {}) do
        local p = type(point) == 'table' and point.coords or point
        if p and #(coords - p) < radius then return true, i end
    end
    return false
end

local function hasChar(source)
    local ok, c = pcall(function() return exports.sunset_core:GetCharacter(source) end)
    return ok and c ~= nil
end

local function generateToken()
    return tostring(GetGameTimer()) .. '_' .. tostring(math.random(100000, 999999))
end

local LAB_SNAPSHOT_ITEMS = {
    'weed_leaf', 'coke_leaf', 'meth_chemical', 'chemicals',
    'weed_brick', 'coke_brick', 'meth_bag',
}

local function labInventorySnapshot(source)
    local inventorySnap = {}
    for _, itemKey in ipairs(LAB_SNAPSHOT_ITEMS) do
        pcall(function()
            inventorySnap[itemKey] = exports.sunset_inventory:CountItem(source, itemKey) or 0
        end)
    end
    return inventorySnap
end

local function newSaleNegotiation()
    return {
        token = generateToken(),
        targetPos = math.random(8, 72),
        targetWidth = 20,
        resolved = false,
        verified = false,
    }
end

local function negotiationPayload(challenge)
    if not challenge then return nil end
    return {
        token = challenge.token,
        targetPos = challenge.targetPos,
        targetWidth = challenge.targetWidth,
    }
end

local function validateStreetPed(source, pedNetId)
    pedNetId = tonumber(pedNetId)
    if not pedNetId or pedNetId <= 0 or not NetworkDoesNetworkIdExist(pedNetId) then
        return nil, 'INVALID_PED_NETWORK_ID'
    end
    local entity = NetworkGetEntityFromNetworkId(pedNetId)
    if not entity or entity == 0 or not DoesEntityExist(entity) or GetEntityType(entity) ~= 1 then
        return nil, 'INVALID_PED_ENTITY'
    end
    if IsPedAPlayer(entity) or IsEntityDead(entity) then return nil, 'PROTECTED_PED' end
    local owner = NetworkGetEntityOwner(entity)
    if owner == nil or owner < 0 then return nil, 'INVALID_PED_OWNER' end
    if GetEntityRoutingBucket(entity) ~= GetPlayerRoutingBucket(source) then return nil, 'ROUTING_BUCKET_MISMATCH' end
    local playerPos = pedCoords(source)
    local entityPos = GetEntityCoords(entity)
    if not playerPos or not entityPos or #(playerPos - entityPos) > ((Cfg.streetSale.interactionDistance or 2.5) + 1.5) then
        return nil, 'PED_TOO_FAR'
    end
    local state = Entity(entity).state
    if state and (state.sunsetProtected == true or state.jobPed == true or state.factionPed == true) then
        return nil, 'PROTECTED_PED'
    end
    local model = GetEntityModel(entity)
    for _, blocked in ipairs(Cfg.streetSale.blacklistedPedModels or {}) do
        if model == joaat(blocked) then return nil, 'PROTECTED_PED_MODEL' end
    end
    return entity
end

-- ═══════════════════════════════════════════════════════════════
-- 1. HARVEST SYSTEM (Recoltare)
-- ═══════════════════════════════════════════════════════════════

exports.sunset_core:RegisterCallback('sunset:drugs:requestHarvestSession', function(source, spotIndex)
    if not hasChar(source) then return nil, { localeKey = 'drugs.message.no_character' } end
    spotIndex = tonumber(spotIndex)
    local spot = spotIndex and Cfg.manufacture.spots[spotIndex]
    if not spot then return nil, { localeKey = 'drugs.message.invalid_harvest_spot' } end

    local coords = pedCoords(source)
    local near = nearAny(coords, { spot.coords }, (Cfg.manufacture.spotRadius or 15.0) + 2.0)
    if not near then return nil, { localeKey = 'drugs.message.you_are_not_at_that_harvest_spot' } end

    local drugConfig = Cfg.drugs[spot.drug]
    if not drugConfig then return nil, { localeKey = 'drugs.message.invalid_drug_type' } end

    local currentAmount = 0
    pcall(function()
        currentAmount = exports.sunset_inventory:CountItem(source, drugConfig.raw) or 0
    end)

    local token = generateToken()
    HarvestSessions[source] = {
        token = token,
        spotIndex = spotIndex,
        drugType = spot.drug,
        rawItem = drugConfig.raw,
        lastHitMs = 0,
    }

    dlog(('Harvest session opened for src=%d spot=%d drug=%s'):format(source, spotIndex, spot.drug))
    return {
        token = token,
        type = spot.drug,
        amount = currentAmount,
        maxAmount = Cfg.manufacture.maxBagCapacity or 50,
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:harvestHit', function(source, token, drugType)
    if not hasChar(source) then return { success = false, err = 'No character' } end
    local session = HarvestSessions[source]
    if not session or session.token ~= token then
        return { success = false, err = 'Invalid harvest session' }
    end

    local now = GetGameTimer()
    if (now - session.lastHitMs) < (Cfg.manufacture.minHitIntervalMs or 280) then
        dlog(('Harvest rate-limit hit for src=%d dt=%dms'):format(source, now - session.lastHitMs))
        return { success = false, err = 'Too fast' }
    end
    session.lastHitMs = now

    local spot = Cfg.manufacture.spots[session.spotIndex]
    if not spot then return { success = false, err = 'Invalid spot' } end

    local coords = pedCoords(source)
    if not nearAny(coords, { spot.coords }, (Cfg.manufacture.spotRadius or 15.0) + 3.0) then
        return { success = false, err = 'Left area' }
    end

    -- Check bag capacity
    local currentCount = exports.sunset_inventory:CountItem(source, session.rawItem) or 0
    if currentCount >= (Cfg.manufacture.maxBagCapacity or 50) then
        return { success = false, err = 'Bag full', full = true }
    end

    -- Add 1 raw material atomically
    local ok, added = pcall(function()
        return exports.sunset_inventory:AddItem(source, session.rawItem, 1)
    end)

    if not ok or added ~= true then
        return { success = false, err = 'Inventory full' }
    end

    local newCount = currentCount + 1
    dlog(('Harvested 1x %s for src=%d (total=%d)'):format(session.rawItem, source, newCount))
    return {
        success = true,
        amount = newCount,
        maxAmount = Cfg.manufacture.maxBagCapacity or 50,
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:closeHarvest', function(source)
    HarvestSessions[source] = nil
    return true
end)

-- ═══════════════════════════════════════════════════════════════
-- 2. CLANDESTINE LAB PROCESSING
-- ═══════════════════════════════════════════════════════════════

exports.sunset_core:RegisterCallback('sunset:drugs:openLab', function(source, labIndex)
    if not hasChar(source) then return nil, { localeKey = 'drugs.message.no_character' } end
    labIndex = tonumber(labIndex) or 1
    local lab = Cfg.process.labs[labIndex]
    if not lab then return nil, { localeKey = 'drugs.message.invalid_lab' } end

    local coords = pedCoords(source)
    local near = nearAny(coords, { lab.coords }, (Cfg.process.labRadius or 5.0) + 2.0)
    if not near then return nil, { localeKey = 'drugs.message.you_must_be_at_a_processing_lab' } end

    LabOpen[source] = {
        labIndex = labIndex,
        openedAt = GetGameTimer(),
    }
    LabAttempts[source] = nil

    return {
        inventory = labInventorySnapshot(source),
        recipes = Cfg.process.recipes,
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:closeLab', function(source)
    LabOpen[source] = nil
    LabAttempts[source] = nil
    return { ok = true }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:startLabAttempt', function(source, recipeType)
    if not hasChar(source) then return { success = false, err = 'No character' } end
    local open = LabOpen[source]
    if not open then return { success = false, err = 'Lab not open' } end

    local recipe = Cfg.process.recipes[recipeType]
    if not recipe then return { success = false, err = 'Invalid recipe' } end

    local attempt = LabAttempts[source]
    if attempt and not attempt.completing then
        return { success = false, err = 'ATTEMPT_IN_PROGRESS' }
    end

    local lab = Cfg.process.labs[open.labIndex]
    local coords = pedCoords(source)
    if not lab or not nearAny(coords, { lab.coords }, (Cfg.process.labRadius or 5.0) + 3.0) then
        return { success = false, err = 'Left lab area' }
    end

    local hasRaw = exports.sunset_inventory:HasItem(source, recipe.rawItem, recipe.rawCount) == true
    local hasSecondary = true
    if recipe.secondaryItem and recipe.secondaryCount > 0 then
        hasSecondary = exports.sunset_inventory:HasItem(source, recipe.secondaryItem, recipe.secondaryCount) == true
    end
    if not hasRaw or not hasSecondary then
        return { success = false, err = 'Missing materials', inventory = labInventorySnapshot(source) }
    end

    local token = generateToken()
    LabAttempts[source] = {
        token = token,
        recipeType = recipeType,
        labIndex = open.labIndex,
        startedAt = GetGameTimer(),
        completing = false,
    }

    return {
        success = true,
        attemptToken = token,
        minDurationMs = Cfg.process.minProcessDurationMs or 3500,
        inventory = labInventorySnapshot(source),
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:processSuccess', function(source, token, recipeType)
    if not hasChar(source) then return { success = false, err = 'No character' } end
    local attempt = LabAttempts[source]
    if not attempt or attempt.token ~= token or attempt.recipeType ~= recipeType then
        return { success = false, err = 'Invalid lab attempt', inventory = labInventorySnapshot(source) }
    end
    if attempt.completing then
        return { success = false, err = 'DUPLICATE_SUBMIT', inventory = labInventorySnapshot(source) }
    end
    attempt.completing = true

    local open = LabOpen[source]
    if not open or open.labIndex ~= attempt.labIndex then
        LabAttempts[source] = nil
        return { success = false, err = 'Lab closed', inventory = labInventorySnapshot(source) }
    end

    local recipe = Cfg.process.recipes[recipeType]
    if not recipe then
        LabAttempts[source] = nil
        return { success = false, err = 'Invalid recipe', inventory = labInventorySnapshot(source) }
    end

    local elapsed = GetGameTimer() - (attempt.startedAt or GetGameTimer())
    if elapsed < (Cfg.process.minProcessDurationMs or 3500) then
        LabAttempts[source] = nil
        return { success = false, err = 'PROCESS_TOO_FAST', inventory = labInventorySnapshot(source) }
    end

    local lab = Cfg.process.labs[attempt.labIndex]
    local coords = pedCoords(source)
    if not lab or not nearAny(coords, { lab.coords }, (Cfg.process.labRadius or 5.0) + 3.0) then
        LabAttempts[source] = nil
        return { success = false, err = 'Left lab area', inventory = labInventorySnapshot(source) }
    end

    -- One-shot before any inventory operation can yield.
    LabAttempts[source] = nil

    local removals = { { item = recipe.rawItem, count = recipe.rawCount } }
    if recipe.secondaryItem and recipe.secondaryCount > 0 then
        removals[#removals + 1] = { item = recipe.secondaryItem, count = recipe.secondaryCount }
    end

    local crafted, craftErr = exports.sunset_inventory:CraftRecipe(
        source,
        removals,
        recipe.productItem,
        recipe.productCount or 1
    )
    if not crafted then
        return {
            success = false,
            err = craftErr or 'CRAFT_FAILED',
            inventory = labInventorySnapshot(source),
        }
    end

    notify(source, ('Ai produs cu succes 1x %s!'):format(recipe.label), 'success')
    dlog(('Process complete for src=%d recipe=%s -> 1x %s'):format(source, recipeType, recipe.productItem))
    return {
        success = true,
        product = recipe.productItem,
        inventory = labInventorySnapshot(source),
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:processFail', function(source, token, recipeType)
    local attempt = LabAttempts[source]
    if not attempt or attempt.token ~= token or attempt.recipeType ~= recipeType then
        return { success = false, err = 'Invalid lab attempt', inventory = labInventorySnapshot(source) }
    end
    if attempt.completing then
        return { success = false, err = 'DUPLICATE_SUBMIT', inventory = labInventorySnapshot(source) }
    end
    attempt.completing = true
    LabAttempts[source] = nil

    local recipe = Cfg.process.recipes[recipeType]
    if recipe then
        exports.sunset_inventory:RemoveItem(source, recipe.rawItem, 1)
        notify(source, exports.sunset_core:TFor(source, 'drugs.message.temperature_out_of_control'), 'error')
    end
    return { success = true, inventory = labInventorySnapshot(source) }
end)

-- ═══════════════════════════════════════════════════════════════
-- 3. STREET SALE SYSTEM (Vanzare Stradala)
-- ═══════════════════════════════════════════════════════════════

exports.sunset_core:RegisterCallback('sunset:drugs:requestStreetOffer', function(source, pedNetId)
    if not hasChar(source) then return nil, { localeKey = 'drugs.message.no_character' } end
    if SaleSessions[source] then return nil, { err = 'SALE_SESSION_ALREADY_ACTIVE' } end

    pedNetId = tonumber(pedNetId)
    local ped, pedError = validateStreetPed(source, pedNetId)
    if not ped then return nil, { err = pedError } end

    local now = GetGameTimer()
    if PedCooldowns[pedNetId] and now < PedCooldowns[pedNetId] then
        return nil, { err = 'Clientul a cumparat deja recent sau nu mai este interesat!' }
    end

    -- Find sellable drugs in player inventory
    local availableDrugs = {}
    for drugKey, dInfo in pairs(Cfg.streetSale.drugs) do
        local count = exports.sunset_inventory:CountItem(source, dInfo.item) or 0
        if count > 0 then
            table.insert(availableDrugs, { key = drugKey, info = dInfo, count = count })
        end
    end

    if #availableDrugs == 0 then
        return nil, { err = 'Nu ai niciun drog procesat pe care sa il vinzi!' }
    end

    -- Pick a random drug from what player carries
    local chosen = availableDrugs[math.random(1, #availableDrugs)]
    local maxCanBuy = math.min(chosen.count, chosen.info.maxQty or 3)
    local qty = math.random(chosen.info.minQty or 1, maxCanBuy)

    -- Base price with variance
    local variance = 0.85 + (math.random() * 0.3) -- 0.85 to 1.15
    local basePrice = math.floor(chosen.info.basePrice * qty * variance)

    -- Determine Risk Level based on quantity and drug type
    local risk = 'low'
    if chosen.key == 'coca' or qty >= 3 then
        risk = 'med'
    end
    if chosen.key == 'meth' or qty >= 4 then
        risk = 'high'
    end

    local token = generateToken()
    SaleSessions[source] = {
        token = token,
        pedNetId = pedNetId,
        drugKey = chosen.key,
        item = chosen.info.item,
        qty = qty,
        basePrice = basePrice,
        risk = risk,
        startedAt = now,
        negotiation = newSaleNegotiation(),
    }

    dlog(('Street offer created src=%d ped=%d drug=%s qty=%d price=$%d risk=%s'):format(
        source, pedNetId or 0, chosen.key, qty, basePrice, risk))

    return {
        token = token,
        type = chosen.key,
        qty = qty,
        price = basePrice,
        risk = risk,
        negotiation = negotiationPayload(SaleSessions[source].negotiation),
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:beginSaleNegotiation', function(source, saleToken)
    local session = SaleSessions[source]
    if not session or session.token ~= saleToken then
        return { success = false, err = 'INVALID_SALE_SESSION' }
    end
    if not session.negotiation or session.negotiation.resolved then
        session.negotiation = newSaleNegotiation()
    end
    return {
        success = true,
        negotiation = negotiationPayload(session.negotiation),
    }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:resolveNegotiation', function(source, data)
    local session = SaleSessions[source]
    local challenge = session and session.negotiation
    if not challenge or challenge.resolved or not data or data.token ~= session.token
        or data.challengeToken ~= challenge.token then
        return { success = false, reason = 'INVALID_NEGOTIATION_SESSION' }
    end
    challenge.resolved = true
    local elapsed = GetGameTimer() - (session.startedAt or GetGameTimer())
    local cursor = tonumber(data.cursorPos)
    challenge.verified = elapsed >= 450 and cursor ~= nil
        and cursor >= challenge.targetPos
        and cursor <= (challenge.targetPos + challenge.targetWidth)
    if not challenge.verified then
        if session.pedNetId then
            PedCooldowns[session.pedNetId] = GetGameTimer() + ((Cfg.streetSale.pedCooldownSec or 60) * 1000)
        end
        SaleSessions[source] = nil
    end
    return { success = challenge.verified == true }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:acceptStreetSale', function(source, data)
    if not hasChar(source) then return { success = false, err = 'No character' } end
    local token = data and data.token
    local session = SaleSessions[source]
    if not session or session.token ~= token then
        return { success = false, err = 'Invalid sale session' }
    end

    if session.pedNetId then
        local ped, pedError = validateStreetPed(source, session.pedNetId)
        if not ped then
            SaleSessions[source] = nil
            return { success = false, err = pedError }
        end
    end

    -- Consume before inventory or money mutations. This serializes duplicate NUI
    -- posts and makes the offer exactly once regardless of callback retries.
    SaleSessions[source] = nil

    -- Verify authoritative price
    local maxAllowedPrice = session.basePrice
    if session.negotiation and session.negotiation.verified == true then
        maxAllowedPrice = math.floor(session.basePrice * (1.0 + (Cfg.streetSale.negotiationBonusPct or 0.25)))
    end

    local finalPrice = maxAllowedPrice

    -- Check and remove drug item
    local removeOk = exports.sunset_inventory:RemoveItem(source, session.item, session.qty)
    if not removeOk then
        return { success = false, err = 'Nu mai ai cantitatea necesara de droguri!' }
    end

    -- Give money (clean cash or black money)
    local addMoneyOk = exports.sunset_core:AddMoney(source, 'cash', finalPrice, 'street_drug_sale')
    if not addMoneyOk then
        -- Restore items
        exports.sunset_inventory:AddItem(source, session.item, session.qty)
        return { success = false, err = 'Eroare la transferul banilor' }
    end

    -- Put ped on cooldown
    if session.pedNetId then
        PedCooldowns[session.pedNetId] = GetGameTimer() + ((Cfg.streetSale.pedCooldownSec or 60) * 1000)
    end

    notify(source, ('Ai vandut %dx %s pentru $%s!'):format(session.qty, session.drugKey, tostring(finalPrice)), 'success')
    dlog(('Street sale completed src=%d price=$%d'):format(source, finalPrice))
    return { success = true }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:failNegotiation', function(source, data)
    local session = SaleSessions[source]
    if not session then return { success = true } end

    if session.pedNetId then
        PedCooldowns[session.pedNetId] = GetGameTimer() + ((Cfg.streetSale.pedCooldownSec or 60) * 1000)
    end

    -- Dispatch 911 police notification if roll passes
    local roll = math.random()
    if roll <= (Cfg.streetSale.alertPoliceChanceOnFail or 0.45) then
        local coords = pedCoords(source)
        if coords and exports.sunset_dispatch then
            pcall(function()
                exports.sunset_dispatch:CreateCall({
                    code = '10-31',
                    titleKey = "config.drugs.title.illegal_activity_drug_dealing.64703130", title = 'Activitate Ilegala / Vanzare de Droguri',
                    coords = coords,
                    messageKey = "config.drugs.message.a_citizen_reports_a_suspicious_attempt_to_sell_illegal_substance.58826659", message = 'Un cetatean raporteaza o tentativa suspecta de vanzare substante interzise.',
                    job = 'police',
                })
            end)
        end
    end

    SaleSessions[source] = nil
    return { success = true }
end)

exports.sunset_core:RegisterCallback('sunset:drugs:declineStreetSale', function(source, data)
    local session = SaleSessions[source]
    if session and session.pedNetId then
        PedCooldowns[session.pedNetId] = GetGameTimer() + ((Cfg.streetSale.pedCooldownSec or 60) * 1000)
    end
    SaleSessions[source] = nil
    return { success = true }
end)

-- ═══════════════════════════════════════════════════════════════
-- 4. WHOLESALE DELIVERY SYSTEM (Locatii Livrare Droguri pe Rank)
-- ═══════════════════════════════════════════════════════════════

exports.sunset_core:RegisterCallback('sunset:drugs:requestDeliveryOffer', function(source, dropoffId)
    if not hasChar(source) then return nil, { localeKey = 'drugs.message.no_character' } end
    local char = exports.sunset_core:GetCharacter(source)
    local playerRank = tonumber(char and char.level) or 1

    local dropoff = nil
    for _, d in ipairs((Cfg.delivery and Cfg.delivery.dropoffs) or {}) do
        if d.id == dropoffId then
            dropoff = d
            break
        end
    end

    if not dropoff then return nil, { err = 'Punct de livrare invalid!' } end

    -- Distance check
    local coords = pedCoords(source)
    local targetCoords = vector3(dropoff.coords.x, dropoff.coords.y, dropoff.coords.z)
    if not coords or #(coords - targetCoords) > ((Cfg.delivery.interactionRadius or 2.5) + 5.0) then
        return nil, { err = 'Esti prea departe de contactul de livrare!' }
    end

    -- Rank check: Player must have at least minRank (Rank 13 unlocks ALL spots!)
    if playerRank < (dropoff.minRank or 1) then
        return nil, { 
            err = ('Acces refuzat! Acest contact accepta livrari incepand de la Rank %d+ (Rank-ul tau: %d)'):format(dropoff.minRank, playerRank) 
        }
    end

    -- Find sellable drugs in player inventory
    local availableDrugs = {}
    for drugKey, dInfo in pairs(Cfg.streetSale.drugs) do
        local count = exports.sunset_inventory:CountItem(source, dInfo.item) or 0
        if count > 0 then
            table.insert(availableDrugs, { key = drugKey, info = dInfo, count = count })
        end
    end

    if #availableDrugs == 0 then
        return nil, { err = 'Nu ai niciun pachet de droguri procesate in inventar pentru livrare!' }
    end

    -- Pick the primary drug carried with all available units (bulk delivery)
    local chosen = availableDrugs[1]
    local qty = chosen.count
    local bonusPct = dropoff.bonusPct or 0.0
    local unitPrice = math.floor(chosen.info.basePrice * (1.0 + bonusPct))
    local totalPrice = unitPrice * qty

    local risk = (dropoff.id == 3 and 'high') or (dropoff.id == 2 and 'med') or 'low'

    local token = generateToken()
    SaleSessions[source] = {
        token = token,
        pedNetId = nil,
        dropoffId = dropoff.id,
        drugKey = chosen.key,
        item = chosen.info.item,
        qty = qty,
        basePrice = totalPrice,
        risk = risk,
        startedAt = GetGameTimer(),
        isWholesale = true,
        negotiation = newSaleNegotiation(),
    }

    dlog(('Wholesale offer created src=%d dropoff=%d drug=%s qty=%d price=$%d rank=%d'):format(
        source, dropoff.id, chosen.key, qty, totalPrice, playerRank))

    return {
        token = token,
        type = chosen.key,
        qty = qty,
        price = totalPrice,
        risk = risk,
        dealerName = dropoff.dealerLabel,
        rankBadge = dropoff.rankBadge,
        negotiation = negotiationPayload(SaleSessions[source].negotiation),
    }
end)



-- ═══════════════════════════════════════════════════════════════
-- CLEANUP & LIFECYCLE
-- ═══════════════════════════════════════════════════════════════

AddEventHandler('playerDropped', function()
    local src = source
    HarvestSessions[src] = nil
    LabOpen[src] = nil
    LabAttempts[src] = nil
    SaleSessions[src] = nil
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    HarvestSessions = {}
    LabOpen = {}
    LabAttempts = {}
    SaleSessions = {}
    PedCooldowns = {}
end)

print('^2[sunset_drugs]^7 Secure drug pipeline online (Harvest HUD + Lab Processing + Street Sale)')
