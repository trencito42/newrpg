-- ============================================================
--  sunset_carjack  ·  server/main.lua
--  Handles lockpick attempt + chop-shop sale
-- ============================================================

local function getChar(source)
    return exports.sunset_core:GetCharacter(source)
end

-- Lockpick skill level for a player (stored in job_progress as job_id = 'lockpicking')
local function getLockpickLevel(source)
    local char = getChar(source)
    if not char then return 1 end
    local row = MySQL.single.await(
        'SELECT level FROM job_progress WHERE character_id = ? AND job_id = ?',
        { char.id, 'lockpicking' }
    )
    return (row and tonumber(row.level)) or 1
end

-- Add XP to lockpicking skill
local function addLockpickXP(source, amount)
    local char = getChar(source)
    if not char then return end
    local row = MySQL.single.await(
        'SELECT xp, level FROM job_progress WHERE character_id = ? AND job_id = ?',
        { char.id, 'lockpicking' }
    )
    local xp    = ((row and row.xp)    or 0) + amount
    local level = ((row and row.level) or 1)
    local function xpForLevel(l) return math.max(100, l * 100) end
    while xp >= xpForLevel(level) do
        xp = xp - xpForLevel(level)
        level = level + 1
    end
    if row then
        MySQL.update.await(
            'UPDATE job_progress SET xp = ?, level = ? WHERE character_id = ? AND job_id = ?',
            { xp, level, char.id, 'lockpicking' }
        )
    else
        MySQL.insert.await(
            'INSERT INTO job_progress (character_id, job_id, xp, level, completed_tasks, total_earned) VALUES (?, ?, ?, ?, 0, 0)',
            { char.id, 'lockpicking', xp, level }
        )
    end
end

-- ── Lockpick attempt ────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:carjack:hasLockpick', function(source)
    local char = getChar(source)
    if not char then return false end
    return exports.sunset_inventory:HasItem(source, 'lockpick', 1) == true
end)

exports.sunset_core:RegisterCallback('sunset:carjack:onLockpickSuccess', function(source)
    local char = getChar(source)
    if not char then return false, { localeKey = 'carjack.message.character_not_loaded' } end
    local access = exports.sunset_core:CanAccess(source, 'criminal.lockpicking')
    if access and access.allowed == false then
        return false, access.reason or { localeKey = 'core.gating.level_required', formatArgs = { 10 } }
    end

    local hasItem = exports.sunset_inventory:HasItem(source, 'lockpick', 1)
    if not hasItem then return false, { localeKey = 'carjack.message.you_need_a_lockpick' } end
    exports.sunset_inventory:RemoveItem(source, 'lockpick', 1)
    addLockpickXP(source, 35)
    TriggerEvent('sunset:quest:progress', char.id, 'lockpick_practiced', 1)
    return true
end)

exports.sunset_core:RegisterCallback('sunset:carjack:onLockpickFail', function(source)
    local char = getChar(source)
    if not char then return false end
    exports.sunset_inventory:RemoveItem(source, 'lockpick', 1)
    addLockpickXP(source, 8)
    return true
end)

exports.sunset_core:RegisterCallback('sunset:carjack:tryLockpick', function(source)
    local char = getChar(source)
    if not char then return false, { localeKey = 'carjack.message.character_not_loaded' } end
    local access = exports.sunset_core:CanAccess(source, 'criminal.lockpicking')
    if access and access.allowed == false then
        return false, access.reason or { localeKey = 'core.gating.level_required', formatArgs = { 10 } }
    end

    -- [SEC3] throttle: each call hit the DB (inventory + job_progress) and could be spammed
    if not exports.sunset_core:RateLimit(source, 'carjackLockpick', 2000) then
        return false, { localeKey = 'carjack.message.the_buyer_is_still_counting_the_last_cash_come' }
    end

    -- Need lockpick in inventory
    local hasItem = exports.sunset_inventory:HasItem(source, 'lockpick', 1)
    if not hasItem then return false, { localeKey = 'carjack.message.you_need_a_lockpick' } end

    -- Consume lockpick regardless of outcome (single use)
    if exports.sunset_inventory:RemoveItem(source, 'lockpick', 1) ~= true then
        return false, { localeKey = 'carjack.message.you_need_a_lockpick' }
    end

    -- Success chance: 35% base + 5% per level, max 95%
    local level   = getLockpickLevel(source)
    local chance  = math.min(95, 35 + (level - 1) * 5)
    local success = math.random(1, 100) <= chance

    if success then
        addLockpickXP(source, 30)
        TriggerEvent('sunset:quest:progress', char.id, 'lockpick_practiced', 1)
        return true
    else
        -- Small XP on fail so players still progress
        addLockpickXP(source, 8)
        return false, { localeKey = 'carjack.message.lockpick_broke_value_chance_level_up_lockpicking_to_improve', formatArgs = { chance } }
    end
end)

-- ── Chop-shop sale ──────────────────────────────────────────
-- Vehicle payout: 18% of dealership price, or $600-$1800 for unlisted cars
local function getVehiclePrice(model)
    local row = MySQL.single.await(
        'SELECT price FROM dealership_vehicles WHERE model = ? AND available = 1 LIMIT 1',
        { tostring(model):lower() }
    )
    -- [AUDIT ECONOMY] Was 18% of dealership price (~90k on an adder) with a 10s
    -- cooldown — an unlimited money printer. Halved to 9% and unlisted range
    -- reduced; combined with the 60s cooldown below this is a side income, not
    -- a primary one.
    if row and tonumber(row.price) and tonumber(row.price) > 0 then
        return math.floor(tonumber(row.price) * 0.09)
    end
    -- Unlisted / random spawn: fixed range based on hash parity (feels random but consistent per model)
    local hash = joaat and joaat(tostring(model)) or 0
    return 300 + (hash % 701) -- $300 – $1000
end

-- Chop-shop NPC positions (mirrored from client/main.lua). Server must own these so
-- the sale can be validated by proximity instead of trusting the client menu.
local CHOP_SHOPS = {
    vector3(-1631.47, -968.58, 7.78),
    vector3(42.66, -1400.39, 29.35),
    vector3(167.63, -1284.35, 29.50),
    vector3(1522.59, -2114.32, 76.68),
    vector3(835.6, -3001.4, 5.9),
    vector3(2341.0, 3125.0, 48.2),
    vector3(-219.0, 6382.0, 31.5),
}
local CHOP_SELL_DIST = 8.0
local SellCooldown = {}

local function nearChopShop(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local pos = GetEntityCoords(ped)
    for _, shop in ipairs(CHOP_SHOPS) do
        if #(pos - shop) <= CHOP_SELL_DIST then return true end
    end
    return false
end

-- [AUDIT P2-01] CRIT: this callback used to pay out purely from client-sent model+netId
-- with zero validation, allowing unlimited money minting at 12 calls/sec. It now
-- resolves the entity server-side and enforces: driver seat, chop-shop proximity,
-- cooldown, vehicle is not player-owned, not a protected/faction vehicle, then deletes it.
local SellBusy = {}
local function doChopSell(source, data)
    local char = getChar(source)
    if not char then return false, { localeKey = 'carjack.message.character_not_loaded' } end

    local access = exports.sunset_core:CanAccess(source, 'criminal.carjack')
    if access and access.allowed == false then
        return false, access.reason or { localeKey = 'core.gating.level_required', formatArgs = { 10 } }
    end

    local netId = tonumber(type(data) == 'table' and data.netId)
    if not netId then return false, { localeKey = 'carjack.message.invalid_vehicle_data' } end

    local now = os.time()
    if SellCooldown[source] and (now - SellCooldown[source]) < 60 then
        return false, { localeKey = 'carjack.message.the_buyer_is_still_counting_the_last_cash_come' }
    end

    if not nearChopShop(source) then return false, { localeKey = 'carjack.message.you_need_to_be_at_a_chop_shop' } end

    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false, { localeKey = 'carjack.message.character_not_loaded' } end

    local veh = NetworkGetEntityFromNetworkId(netId)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return false, { localeKey = 'carjack.message.that_vehicle_is_gone' } end
    if GetVehicleClass(veh) == -1 then return false, { localeKey = 'carjack.message.invalid_vehicle_data' } end
    if GetPedInVehicleSeat(veh, -1) ~= ped then return false, { localeKey = 'carjack.message.you_must_be_driving_the_vehicle' } end

    local entityState = Entity(veh).state
    if entityState:get('sunsetProtectedVehicle') or entityState:get('sunsetFactionVehicle') then
        return false, { localeKey = 'carjack.message.nobody_will_touch_that_vehicle' }
    end

    local plate = (GetVehicleNumberPlateText(veh) or ''):gsub('%s+', ''):upper()

    -- Player-owned vehicles must go through the garage/insurance flow, not the chop shop.
    if plate ~= '' then
        local owned = MySQL.scalar.await(
            'SELECT id FROM vehicles WHERE REPLACE(UPPER(plate), " ", "") = ? LIMIT 1',
            { plate }
        )
        if owned then return false, { localeKey = 'carjack.message.the_buyer_does_not_want_a_registered_car' } end
    end

    -- The client may send a model name, but it is only trusted if its hash matches the
    -- actual server-side entity model. Otherwise fall back to the unlisted-car range.
    local modelHash = GetEntityModel(veh)
    local model = tostring(type(data) == 'table' and data.model or ''):lower()
    if model == '' or GetHashKey(model) ~= modelHash then
        model = nil
    end

    SellCooldown[source] = now

    local payout
    if model then
        payout = getVehiclePrice(model)
    else
        payout = 300 + (modelHash % 701) -- unlisted car: $300-$1000, deterministic per model
    end

    DeleteEntity(veh)

    exports.sunset_core:AddMoney(source, 'cash', payout, 'carjack_sale')
    addLockpickXP(source, 50)
    -- Chop shops are the controlled illicit source for ammunition components.
    if math.random(100) <= 20 and exports.sunset_inventory:AddItem(source, 'gunpowder', 1) then
        exports.sunset_inventory:ReloadInventory(source)
    end

    -- [QUESTS 7-9] criminal chain: chop-shop sales drive quest progress.
    local okQ, charQ = pcall(function() return exports.sunset_core:GetCharacter(source) end)
    if okQ and charQ and charQ.id then
        TriggerEvent('sunset:quest:progress', charQ.id, 'carjack_sold', 1, { payout = payout })
    end

    print(('[carjack] %s sold a vehicle (hash %d) for $%d'):format(GetPlayerName(source) or '?', modelHash, payout))

    return true, payout
end

-- [SEC2] in-flight lock: parallel sells of the same vehicle used to both pass the
-- cooldown check (the cooldown was only stamped after yielding DB calls).
exports.sunset_core:RegisterCallback('sunset:carjack:sell', function(source, data)
    if SellBusy[source] then return false, { localeKey = 'carjack.message.the_buyer_is_still_counting_the_last_cash_come' } end
    SellBusy[source] = true
    local ok, a, b = pcall(doChopSell, source, data)
    SellBusy[source] = nil
    if not ok then error(a) end
    return a, b
end)

AddEventHandler('playerDropped', function()
    SellBusy[source] = nil
    SellCooldown[source] = nil
end)
