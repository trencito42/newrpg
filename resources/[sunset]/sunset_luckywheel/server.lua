-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — 3D Lucky Wheel (server.lua)
-- ═══════════════════════════════════════════════════════════════

local isSpinning = false
local InFlight = nil -- { src, charId } while a spin is awaiting its prize
local cooldownReady = false

-- [CASINO-AUTH] Cooldown is persisted (survives restart/relog); only the DB value counts.
local function ensureCooldownTable()
    if cooldownReady then return end
    cooldownReady = true
    pcall(function()
        MySQL.query.await([[CREATE TABLE IF NOT EXISTS casino_wheel_cooldown (
            character_id INT UNSIGNED PRIMARY KEY,
            next_at BIGINT NOT NULL DEFAULT 0
        )]])
    end)
end

local function getCooldownEnd(charId)
    ensureCooldownTable()
    local ok, v = pcall(function()
        return MySQL.scalar.await('SELECT next_at FROM casino_wheel_cooldown WHERE character_id = ?', { charId })
    end)
    if not ok then return math.huge end -- fail closed
    return tonumber(v) or 0
end

local function setCooldownEnd(charId, untilTs)
    pcall(function()
        MySQL.update.await([[INSERT INTO casino_wheel_cooldown (character_id, next_at) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE next_at = VALUES(next_at)]], { charId, untilTs })
    end)
end

local function notify(src, key, kind, ...)
    local args = { ... }
    local ok, msg = pcall(function() return exports.sunset_core:TFor(src, key, table.unpack(args)) end)
    TriggerClientEvent('sunset:client:notify', src, ok and msg or key, kind or 'info', 5000)
end

local function countChips(source)
    if GetResourceState('sunset_inventory') ~= 'started' then return 0 end
    local ok, count = pcall(function()
        return exports.sunset_inventory:CountItem(source, 'casino_chips')
    end)
    return ok and (tonumber(count) or 0) or 0
end

local function takeChips(source, amount)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_inventory:RemoveItem(source, 'casino_chips', math.floor(amount))
    end)
    return ok and res == true
end

local function givePrize(source, prize)
    if prize.type == 'cash' then
        exports.sunset_core:AddMoney(source, 'cash', prize.amount, 'Lucky Wheel Prize')
        notify(source, 'luckywheel.message.you_won_value', 'success', prize.label)
    elseif prize.type == 'chips' then
        exports.sunset_inventory:AddItem(source, 'casino_chips', prize.amount)
        notify(source, 'luckywheel.message.you_won_value', 'success', prize.label)
    elseif prize.type == 'item' then
        exports.sunset_inventory:AddItem(source, prize.item, prize.count or 1)
        notify(source, 'luckywheel.message.you_won_value', 'success', prize.label)
    elseif prize.type == 'vehicle' then
        local char = exports.sunset_core:GetPlayer(source)
        if char and char.id then
            exports.sunset_vehicles:AddPersonalVehicle(char.id, prize.model, nil, function(ok)
                if ok then
                    notify(source, 'luckywheel.message.jackpot_vehicle', 'success', prize.label)
                end
            end)
        end
    end
end

-- Refund path (player offline / resource stop): chips go to the pending table.
local function refundStake(charId, reason)
    CasinoPending.Add(charId, Config.Amount or 100, 'wheel_' .. reason)
end

RegisterServerEvent('sunset:luckywheel:requestSpin', function()
    local src = source
    -- proximity to the physical wheel
    local ped0 = GetPlayerPed(src)
    if not ped0 or ped0 == 0 or #(GetEntityCoords(ped0) - Config.WheelPos) > 8.0 then return end
    -- Lock BEFORE any yielding call so concurrent/replayed requests are rejected.
    if isSpinning then
        notify(src, 'luckywheel.message.spinning', 'error')
        return
    end
    isSpinning = true
    local function release() isSpinning = false; InFlight = nil end

    local char = exports.sunset_core:GetPlayer(src)
    local charId = char and tonumber(char.id)
    if not charId then release() return end
    local now = os.time()
    local cooldownEnd = getCooldownEnd(charId)
    if now < cooldownEnd then
        release()
        local remainingMins = cooldownEnd == math.huge and 60 or math.ceil((cooldownEnd - now) / 60)
        notify(src, 'luckywheel.message.cooldown', 'error', remainingMins)
        return
    end

    local cost = Config.Amount or 100
    if countChips(src) < cost then
        release()
        notify(src, 'luckywheel.message.need_chips', 'error', cost)
        return
    end
    if not takeChips(src, cost) then
        release()
        notify(src, 'luckywheel.message.deduct_failed', 'error')
        return
    end

    setCooldownEnd(charId, now + ((Config.SpinCooldownMinutes or 60) * 60))
    InFlight = { src = src, charId = charId }

    -- Server picks the prize (CSPRNG). Weighted table unchanged from the original.
    local roll = CasinoRNG.Int(1, 100)
    local prizeIndex
    if roll == 1 then
        prizeIndex = 19 -- Car Jackpot
    elseif roll <= 4 then
        prizeIndex = 20 -- 100k grand prize
    elseif roll <= 10 then
        prizeIndex = 12 -- 50k cash
    elseif roll <= 20 then
        prizeIndex = 16 -- 10k chips
    elseif roll <= 35 then
        prizeIndex = 5 -- 25k cash
    elseif roll <= 50 then
        prizeIndex = 8 -- 2.5k chips
    elseif roll <= 70 then
        prizeIndex = 3 -- 5k cash
    else
        prizeIndex = CasinoRNG.Int(1, 18)
    end

    local ped = GetPlayerPed(src)
    local netId = ped and ped ~= 0 and NetworkGetNetworkIdFromEntity(ped) or nil
    TriggerClientEvent('sunset:luckywheel:doRoll', -1, prizeIndex, netId)
    CasinoLog.Record(charId, 'luckywheel', 'spin', cost, 0, 'prize=' .. prizeIndex)

    SetTimeout(8500, function()
        local flight = InFlight
        if not flight or flight.charId ~= charId then return end -- already refunded by stop handler
        release()
        local prize = Config.Prizes[prizeIndex] or Config.Prizes[1]
        -- src may be gone or recycled by a different player during the spin
        local cur = GetPlayerName(src) and exports.sunset_core:GetPlayer(src) or nil
        if not cur or tonumber(cur.id) ~= charId then
            refundStake(charId, 'offline')
            return
        end
        givePrize(src, prize)
        CasinoLog.Record(charId, 'luckywheel', 'prize', cost, prize.amount or 0, tostring(prize.type) .. ':' .. tostring(prize.label))
    end)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if InFlight then
        local f = InFlight
        InFlight = nil
        isSpinning = false
        refundStake(f.charId, 'resource_stop')
    end
end)
