-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Slot Machines (server.lua)  — 100% SERVER AUTHORITATIVE
--
--  The client (NUI) only ever sends: spin{bet}, collect, gamble{color}, exit.
--  The server owns: session balance, bet validation, RNG, reel grid, payline
--  evaluation, payout, the red/black gamble, and chip settlement.
--  Funds model: on sit, up to SlotsServer.SessionMax chips are taken from the
--  inventory with the atomic conditional UPDATE inside sunset_inventory
--  RemoveItem (count >= ?). From then on the balance is a server-memory
--  number; it is credited back to the inventory exactly once by
--  CloseSession (exit / leave / disconnect / resource stop). If credit is
--  impossible the amount is persisted in casino_pending_chips and claimed on
--  the player's next slots session or casino status call.
-- ═══════════════════════════════════════════════════════════════

local function T(src, key, ...)
    local args = { ... }
    local ok, s = pcall(function() return exports.sunset_core:TFor(src, key, table.unpack(args)) end)
    return ok and s or key
end

local function notify(src, key, kind, ...)
    TriggerClientEvent('sunset:client:notify', src, T(src, key, ...), kind or 'info', 5000)
end

local function countChips(source)
    if GetResourceState('sunset_inventory') ~= 'started' then return 0 end
    local ok, count = pcall(function()
        return exports.sunset_inventory:CountItem(source, 'casino_chips')
    end)
    return ok and (tonumber(count) or 0) or 0
end

local function giveChips(source, amount)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_inventory:AddItem(source, 'casino_chips', math.floor(amount))
    end)
    return ok and res ~= false
end

local function takeChips(source, amount)
    if GetResourceState('sunset_inventory') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_inventory:RemoveItem(source, 'casino_chips', math.floor(amount))
    end)
    return ok and res == true
end

local function getCharId(src)
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
    return ok and char and tonumber(char.id) or nil
end

-- ── State ──
local Sessions = {}   -- [src] = session
local SeatsTaken = {} -- [slotKey] = src
local Opening = {}    -- [src] = true while tryPlay is yielding
local BetSet = {}
for _, b in ipairs(SlotsServer.Bets) do BetSet[b] = true end
local MinBet = SlotsServer.Bets[1]

local SlotById = {}
for _, s in ipairs(Config.Slots or {}) do SlotById[tostring(s.id)] = s end

-- ═══════════════════════════════════════════════════════════════
--  PAYTABLE (all values from SlotsServer in server_config.lua)
-- ═══════════════════════════════════════════════════════════════

local function randomSymbol()
    return CasinoRNG.Weighted(SlotsServer.SymbolWeights)
end

-- grid[reel][row], reel 1..5, row 1..3
local function generateGrid()
    local grid = {}
    for reel = 1, 5 do
        grid[reel] = { randomSymbol(), randomSymbol(), randomSymbol() }
    end
    return grid
end

local DIAGONALS = {
    { { 1, 3 }, { 2, 2 }, { 3, 1 } }, { { 2, 3 }, { 3, 2 }, { 4, 1 } }, { { 3, 3 }, { 4, 2 }, { 5, 1 } },
    { { 1, 1 }, { 2, 2 }, { 3, 3 } }, { { 2, 1 }, { 3, 2 }, { 4, 3 } }, { { 3, 1 }, { 4, 2 }, { 5, 3 } },
}

-- Returns payout (integer chips) and a list of winning cell groups for the animation.
local function evaluate(grid, bet)
    local wins = {} -- { len = 3|4|5, sym = n, cells = { {reel,row}, ... } }
    -- Horizontal: maximal runs (>= 3) in each row.
    for row = 1, 3 do
        local i = 1
        while i <= 5 do
            local j = i
            while j < 5 and grid[j + 1][row] == grid[i][row] do j = j + 1 end
            local len = j - i + 1
            if len >= 3 then
                local cells = {}
                for r = i, j do cells[#cells + 1] = { r, row } end
                wins[#wins + 1] = { len = len, sym = grid[i][row], cells = cells }
            end
            i = j + 1
        end
    end
    -- Diagonals (3 long).
    for _, line in ipairs(DIAGONALS) do
        local a = grid[line[1][1]][line[1][2]]
        local b = grid[line[2][1]][line[2][2]]
        local c = grid[line[3][1]][line[3][2]]
        if a == b and b == c then
            wins[#wins + 1] = { len = 3, sym = a, cells = { line[1], line[2], line[3] } }
        end
    end
    -- Vertical (a whole reel showing one symbol).
    for reel = 1, 5 do
        if grid[reel][1] == grid[reel][2] and grid[reel][2] == grid[reel][3] then
            wins[#wins + 1] = { len = 3, sym = grid[reel][1], cells = { { reel, 1 }, { reel, 2 }, { reel, 3 } } }
        end
    end

    local total = 0
    for _, w in ipairs(wins) do
        local mult
        if w.len == 3 then mult = SlotsServer.TripleMult[w.sym]
        elseif w.len == 4 then mult = SlotsServer.QuadrupleMult[w.sym]
        else mult = SlotsServer.QuintupleMult[w.sym] end
        total = total + bet * (mult or 0)
    end
    local lines = #wins
    if lines > 2 then total = total * (1 + SlotsServer.MultiLineBonus3)
    elseif lines > 1 then total = total * (1 + SlotsServer.MultiLineBonus2) end
    total = math.floor(total + 0.5)
    if total > SlotsServer.MaxWin then total = SlotsServer.MaxWin end
    return total, wins
end

-- ═══════════════════════════════════════════════════════════════
--  SESSION SETTLEMENT (the single place chips return to the inventory)
-- ═══════════════════════════════════════════════════════════════

local function creditChips(src, charId, amount)
    if amount <= 0 then return true end
    local cur = GetPlayerName(src) and getCharId(src) or nil
    if cur and cur == charId and giveChips(src, amount) then return true end
    CasinoPending.Add(charId, amount, 'slots_settle')
    return false
end

-- Idempotent: the session is removed from the table BEFORE any yielding call.
local function CloseSession(src, reason)
    local sess = Sessions[src]
    if not sess then return 0 end
    Sessions[src] = nil
    if SeatsTaken[sess.slotKey] == src then SeatsTaken[sess.slotKey] = nil end
    local total = (sess.balance or 0) + (sess.pending or 0)
    sess.balance, sess.pending = 0, 0
    CasinoLog.Record(sess.charId, 'slots', 'close', sess.wagered or 0, total,
        ('reason=%s taken=%d spins=%d'):format(reason, sess.taken or 0, sess.spins or 0))
    if total > 0 then
        local ok = creditChips(src, sess.charId, total)
        if ok and GetPlayerName(src) then
            notify(src, 'slots.message.you_cashed_out_value_chips', 'success', total)
        end
    end
    return total
end

-- ═══════════════════════════════════════════════════════════════
--  CALLBACKS
-- ═══════════════════════════════════════════════════════════════

local function claimPending(src, charId)
    local got = CasinoPending.Claim(charId, function(n) return giveChips(src, n) end)
    if got > 0 then notify(src, 'slots.message.recovered_value_chips', 'success', got) end
end

local function nearSlot(src, slot)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end
    return #(GetEntityCoords(ped) - slot.coords) <= SlotsServer.MaxDistance
end

exports.sunset_core:RegisterCallback('sunset:slots:tryPlay', function(source, slotId)
    local src = source
    if type(slotId) ~= 'number' and type(slotId) ~= 'string' then
        return nil, { localeKey = 'slots.message.invalid_slot_machine' }
    end
    local slot = SlotById[tostring(slotId)]
    if not slot then return nil, { localeKey = 'slots.message.invalid_slot_machine' } end
    if Sessions[src] or Opening[src] then
        return nil, { localeKey = 'slots.message.you_are_already_playing' }
    end
    if not nearSlot(src, slot) then return nil, { localeKey = 'slots.message.invalid_slot_machine' } end
    local key = tostring(slot.id)
    if SeatsTaken[key] and SeatsTaken[key] ~= src then
        return nil, { localeKey = 'slots.message.this_slot_machine_is_currently_in_use' }
    end
    local charId = getCharId(src)
    if not charId then return nil, { localeKey = 'slots.message.invalid_slot_machine' } end

    Opening[src] = true
    SeatsTaken[key] = src -- reserve before yielding
    claimPending(src, charId)

    local chips = countChips(src)
    if chips < MinBet then
        Opening[src] = nil
        SeatsTaken[key] = nil
        return nil, { localeKey = 'slots.message.you_need_at_least_value_casino_chips_to_play', formatArgs = { MinBet } }
    end
    local sessionChips = math.min(chips, SlotsServer.SessionMax)
    if not takeChips(src, sessionChips) then
        Opening[src] = nil
        SeatsTaken[key] = nil
        return nil, { localeKey = 'slots.message.could_not_deduct_chips_from_inventory' }
    end
    Opening[src] = nil

    if not GetPlayerName(src) then -- left while we were yielding
        CasinoPending.Add(charId, sessionChips, 'slots_open_dropped')
        SeatsTaken[key] = nil
        return nil
    end

    Sessions[src] = {
        slotKey = key, charId = charId, balance = sessionChips, taken = sessionChips,
        pending = 0, doubles = 0, token = CasinoRNG.Token(), lastSpin = 0, spins = 0, wagered = 0,
    }
    CasinoLog.Record(charId, 'slots', 'open', 0, 0, ('taken=%d slot=%s'):format(sessionChips, key))
    return { balance = sessionChips, token = Sessions[src].token, bets = SlotsServer.Bets }
end)

local function failResult(sess, errKey, ...)
    return { ok = false, errKey = errKey, balance = sess and sess.balance or 0, pending = sess and sess.pending or 0,
        token = sess and sess.token or nil }
end

local function tokenOk(sess, token)
    return type(token) == 'string' and #token == 16 and sess.token == token
end

exports.sunset_core:RegisterCallback('sunset:slots:spin', function(source, token, bet)
    local src = source
    local sess = Sessions[src]
    if not sess then return nil, { localeKey = 'slots.message.invalid_slot_machine' } end
    if sess.busy then return failResult(sess, 'slots.message.too_fast') end
    if not tokenOk(sess, token) then return failResult(sess, 'slots.message.too_fast') end
    if not CasinoRNG.IsInt(bet) or not BetSet[bet] then return failResult(sess, 'slots.message.invalid_bet') end
    if sess.pending > 0 then return failResult(sess, 'slots.message.collect_first') end
    local now = GetGameTimer()
    if now - sess.lastSpin < SlotsServer.MinSpinIntervalMs then return failResult(sess, 'slots.message.too_fast') end
    local slot = SlotById[sess.slotKey]
    if not slot or not nearSlot(src, slot) then return failResult(sess, 'slots.message.invalid_slot_machine') end
    if bet > sess.balance then return failResult(sess, 'slots.message.not_enough_credits') end

    -- No yields below this point: the debit/result/credit is one atomic step.
    sess.busy = true
    sess.lastSpin = now
    sess.balance = sess.balance - bet
    sess.wagered = sess.wagered + bet
    sess.spins = sess.spins + 1
    local grid = generateGrid()
    local win, wins = evaluate(grid, bet)
    sess.pending = win
    sess.doubles = 0
    sess.token = CasinoRNG.Token()
    sess.busy = false

    local cells = {}
    for _, w in ipairs(wins) do cells[#cells + 1] = w.cells end
    CasinoLog.Record(sess.charId, 'slots', 'spin', bet, win,
        ('bal=%d lines=%d'):format(sess.balance, #wins))
    return {
        ok = true, grid = grid, win = win, wins = cells, lines = #wins,
        balance = sess.balance, token = sess.token,
        canGamble = win > 0 and win <= SlotsServer.MaxDoublePending,
    }
end)

exports.sunset_core:RegisterCallback('sunset:slots:collect', function(source, token)
    local sess = Sessions[source]
    if not sess then return nil, { localeKey = 'slots.message.invalid_slot_machine' } end
    if sess.busy or not tokenOk(sess, token) then return failResult(sess, 'slots.message.too_fast') end
    if sess.pending <= 0 then return failResult(sess, 'slots.message.nothing_to_collect') end
    local won = sess.pending
    sess.balance = sess.balance + won
    sess.pending = 0
    sess.doubles = 0
    sess.token = CasinoRNG.Token()
    CasinoLog.Record(sess.charId, 'slots', 'collect', 0, won, ('bal=%d'):format(sess.balance))
    return { ok = true, collected = won, balance = sess.balance, token = sess.token }
end)

exports.sunset_core:RegisterCallback('sunset:slots:gamble', function(source, token, color)
    local sess = Sessions[source]
    if not sess then return nil, { localeKey = 'slots.message.invalid_slot_machine' } end
    if sess.busy or not tokenOk(sess, token) then return failResult(sess, 'slots.message.too_fast') end
    if color ~= 0 and color ~= 1 then return failResult(sess, 'slots.message.invalid_bet') end
    if sess.pending <= 0 or sess.pending > SlotsServer.MaxDoublePending then
        return failResult(sess, 'slots.message.nothing_to_collect')
    end
    sess.busy = true
    local drawn = CasinoRNG.Int(0, 1) -- 0 = red, 1 = black
    local before = sess.pending
    local won = drawn == color
    local autoCollected = 0
    if won then
        sess.pending = before * 2
        sess.doubles = sess.doubles + 1
        if sess.doubles >= SlotsServer.MaxDoubles then
            autoCollected = sess.pending
            sess.balance = sess.balance + sess.pending
            sess.pending = 0
            sess.doubles = 0
        end
    else
        sess.pending = 0
        sess.doubles = 0
    end
    sess.token = CasinoRNG.Token()
    sess.busy = false
    CasinoLog.Record(sess.charId, 'slots', 'gamble', before, won and before * 2 or 0,
        ('drawn=%d won=%s auto=%d'):format(drawn, tostring(won), autoCollected))
    return {
        ok = true, won = won, drawn = drawn, pending = sess.pending, balance = sess.balance,
        token = sess.token, autoCollected = autoCollected,
        canGamble = sess.pending > 0 and sess.pending <= SlotsServer.MaxDoublePending,
    }
end)

exports.sunset_core:RegisterCallback('sunset:slots:exit', function(source)
    local sess = Sessions[source]
    if not sess then return { ok = true, closed = 0 } end
    local total = CloseSession(source, 'exit')
    return { ok = true, closed = total }
end)

-- Client unsit hook: if the player stands up without using exit, settle now.
RegisterServerEvent('sunset_slots:leavePlace')
AddEventHandler('sunset_slots:leavePlace', function()
    CloseSession(source, 'leave')
end)

exports.sunset_core:RegisterCallback('sunset:slots:getPlace', function(source, id)
    if type(id) ~= 'number' and type(id) ~= 'string' then return false end
    return SeatsTaken[tostring(id)] ~= nil
end)

AddEventHandler('playerDropped', function()
    local src = source
    Opening[src] = nil
    CloseSession(src, 'dropped')
    for id, playerSrc in pairs(SeatsTaken) do
        if playerSrc == src then SeatsTaken[id] = nil end
    end
end)

-- Resource restart/stop mid-session: refund every open session (balance + any
-- unclaimed win) to the owner; anything that cannot be credited is persisted.
-- A hard crash of the whole server cannot run this handler: chips taken for an
-- open session are lost in that case (documented in docs/release/IMPL_CASINO.md).
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for src in pairs(Sessions) do
        CloseSession(src, 'resource_stop')
    end
end)

print('^2[sunset_slots]^7 Sizzling 5-reel slot machines online (server-authoritative)')
