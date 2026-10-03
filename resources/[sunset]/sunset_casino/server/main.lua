-- Racket RPG casino hub. This resource owns entry, cashier and bar only.
-- Gameplay is owned by sunset_blackjack, sunset_slots, sunset_roulette and
-- sunset_luckywheel; all four share this resource's audited RNG/payout module.

local Cfg = SunsetCasino.Config

local function getCharId(source)
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.id) or nil
end

local function nearCasino(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local coords = GetEntityCoords(ped)
    return (Cfg.exit and #(coords - Cfg.exit) <= 180.0)
        or (Cfg.entrance and #(coords - Cfg.entrance) <= 60.0)
end

local function countChips(source)
    if GetResourceState('sunset_inventory') ~= 'started' then return 0 end
    local ok, count = pcall(function() return exports.sunset_inventory:CountItem(source, 'casino_chips') end)
    return ok and (tonumber(count) or 0) or 0
end

local function giveChips(source, amount)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, result = pcall(function()
        return exports.sunset_inventory:AddItem(source, 'casino_chips', math.floor(amount))
    end)
    return ok and result ~= false
end

local function takeChips(source, amount)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, result = pcall(function()
        return exports.sunset_inventory:RemoveItem(source, 'casino_chips', math.floor(amount))
    end)
    return ok and result == true
end

exports.sunset_core:RegisterCallback('sunset:casino:buyChips', function(source, amount)
    if not nearCasino(source) then return nil, exports.sunset_core:TFor(source, 'casino.err.you_must_be_at_the_casino') end
    amount = math.floor(tonumber(amount) or 0)
    if amount < (Cfg.minChipExchange or 100) then
        return nil, { localeKey = 'casino.message.minimum_chip_exchange_is_value', formatArgs = { Cfg.minChipExchange or 100 } }
    end
    if amount > (Cfg.maxChipExchange or 100000) then
        return nil, { localeKey = 'casino.message.maximum_chip_exchange_is_value', formatArgs = { Cfg.maxChipExchange or 100000 } }
    end
    local cost = math.floor(amount * (Cfg.chipExchangeRate or 1))
    if not exports.sunset_core:RemoveMoney(source, 'cash', cost, 'casino_buy_chips') then
        return nil, { localeKey = 'casino.message.not_enough_cash_you_need_value', formatArgs = { cost } }
    end
    if not giveChips(source, amount) then
        exports.sunset_core:AddMoney(source, 'cash', cost, 'casino_buy_chips_refund')
        return nil, { localeKey = 'casino.message.inventory_full_make_room_for_your_chips' }
    end
    return { chips = amount, cost = cost, totalChips = countChips(source), cash = exports.sunset_core:GetMoney(source, 'cash') }
end)

exports.sunset_core:RegisterCallback('sunset:casino:sellChips', function(source, amount)
    if not nearCasino(source) then return nil, exports.sunset_core:TFor(source, 'casino.err.you_must_be_at_the_casino') end
    amount = math.floor(tonumber(amount) or 0)
    if amount < 1 then return nil, { localeKey = 'casino.message.enter_an_amount_to_sell' } end
    local current = countChips(source)
    if current < amount then
        return nil, { localeKey = 'casino.message.you_only_have_value_chips', formatArgs = { current } }
    end
    if not takeChips(source, amount) then
        return nil, { localeKey = 'casino.message.could_not_take_chips_from_your_inventory' }
    end
    local cash = math.floor(amount * (Cfg.chipExchangeRate or 1))
    if not exports.sunset_core:AddMoney(source, 'cash', cash, 'casino_sell_chips') then
        giveChips(source, amount)
        return nil, { localeKey = 'casino.message.could_not_pay_you_try_again' }
    end
    return { chips = amount, earned = cash, cash = exports.sunset_core:GetMoney(source, 'cash'), remainingChips = countChips(source) }
end)

exports.sunset_core:RegisterCallback('sunset:casino:buyDrink', function(source, drinkId)
    if not nearCasino(source) then return nil, exports.sunset_core:TFor(source, 'casino.err.you_must_be_at_the_casino') end
    local drink
    for _, candidate in ipairs(Cfg.barDrinks or {}) do
        if candidate.id == tostring(drinkId or '') then drink = candidate break end
    end
    if not drink then return nil, { localeKey = 'casino.message.unknown_drink' } end
    if not exports.sunset_core:RemoveMoney(source, 'cash', drink.price, 'casino_bar') then
        return nil, { localeKey = 'casino.message.not_enough_cash_value_costs_value', formatArgs = { drink.label, drink.price } }
    end
    local ok, added = pcall(function() return exports.sunset_inventory:AddItem(source, drink.id, 1) end)
    if not ok or added == false then
        exports.sunset_core:AddMoney(source, 'cash', drink.price, 'casino_bar_refund')
        return nil, { localeKey = 'casino.message.inventory_full_could_not_hold_the_drink' }
    end
    return { label = drink.label, price = drink.price, cash = exports.sunset_core:GetMoney(source, 'cash') }
end)

exports.sunset_core:RegisterCallback('sunset:casino:status', function(source)
    local charId = getCharId(source)
    if not charId then return nil end
    return {
        chips = countChips(source),
        cash = exports.sunset_core:GetMoney(source, 'cash'),
        drinks = Cfg.barDrinks or {},
        pendingClaimed = CasinoPending.Claim(charId, function(amount) return giveChips(source, amount) end),
    }
end)

local ProbeBudget = {}
local function writeProbeLine(value, src)
    local now = GetGameTimer()
    local budget = ProbeBudget[src or 0]
    if not budget or now - budget.startedAt > 60000 then
        budget = { startedAt = now, count = 0 }
        ProbeBudget[src or 0] = budget
    end
    budget.count = budget.count + 1
    if budget.count > 60 then return end
    local isAdmin = false
    if src and GetResourceState('sunset_admin') == 'started' then
        local ok, result = pcall(function() return exports.sunset_admin:IsAdmin(src, 3) end)
        isAdmin = ok and result == true
    end
    if isAdmin then print('^3' .. value .. '^7') end
end

RegisterNetEvent('sunset:casino:probeLog', function(line)
    writeProbeLine(('[CASINOPROBE #%d] %s'):format(source, tostring(line):sub(1, 400)), source)
end)

RegisterNetEvent('sunset:casino:probeLogBatch', function(lines)
    if type(lines) ~= 'table' then return end
    for index, line in ipairs(lines) do
        if index > 5 then break end
        writeProbeLine(('[CASINOPROBE #%d] %s'):format(source, tostring(line):sub(1, 400)), source)
    end
end)

AddEventHandler('playerDropped', function() ProbeBudget[source] = nil end)

print('^2[sunset_casino]^7 casino hub online (entry, cashier, bar)')
