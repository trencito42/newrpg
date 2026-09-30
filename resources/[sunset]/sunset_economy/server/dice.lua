-- [FORMAT FIX] Lua's string.format does NOT support the %'d digit-grouping
-- conversion (C99-only): it crashed with "invalid conversion '%'' to 'format'"
-- on every /loto, /barbut and money Discord log. Helper instead:
local function groupDigits(n)
    local s = ('%d'):format(math.floor(tonumber(n) or 0))
    local formatted = s:reverse():gsub('(%d%d%d)', '%1,'):reverse()
    return (formatted:gsub('^,', ''))
end

-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Dice / Barbut System
--  Multiplayer wagering with anti-inflation house burn
-- ═══════════════════════════════════════════════════════════════

local PendingChallenges = {}
local DICE_TAX_RATE = 0.0 -- no house burn — winner takes the full pot
local MAX_DICE_BET = 500000 -- $500,000 max bet
local MIN_DICE_BET = 100

local function getDist(src1, src2)
    local p1 = GetPlayerPed(src1)
    local p2 = GetPlayerPed(src2)
    if not p1 or not p2 or p1 == 0 or p2 == 0 then return 999.0 end
    local c1 = GetEntityCoords(p1)
    local c2 = GetEntityCoords(p2)
    return #(c1 - c2)
end

local function broadcastNearby(src, msg)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return end
    local coords = GetEntityCoords(ped)
    for _, pid in ipairs(GetPlayers()) do
        local targetSrc = tonumber(pid)
        if targetSrc then
            local tPed = GetPlayerPed(targetSrc)
            if tPed and tPed ~= 0 and #(GetEntityCoords(tPed) - coords) <= 15.0 then
                TriggerClientEvent('chat:addMessage', targetSrc, {
                    color = { 255, 180, 0 },
                    args = { 'DICE', msg }
                })
            end
        end
    end
end

-- [AUDIT P5-07] Escrow safety net: track every in-flight wager by CHARACTER id
-- so it can be refunded even when the player is offline (disconnect mid-roll)
-- or the resource stops between debit and payout. Previously both bets were
-- silently destroyed in those windows.
local ActiveEscrows = {} -- [escrowId] = { charIds = {a, b}, amounts = {bet, bet}, settled = false }
local escrowSeq = 0

local function refundByCharId(charId, amount)
    charId = tonumber(charId)
    amount = math.floor(tonumber(amount) or 0)
    if not charId or charId < 1 or amount <= 0 then return end
    local changed = MySQL.update.await('UPDATE characters SET cash = cash + ? WHERE id = ?', { amount, charId })
    if changed and changed >= 1 then
        MySQL.insert.await([[INSERT INTO money_transactions
            (character_id, account, direction, amount, reason, balance_after)
            SELECT id, 'cash', 'in', ?, 'dice_refund', cash FROM characters WHERE id = ?]], { amount, charId })
    end
end

local function settleEscrow(escrowId)
    local e = ActiveEscrows[escrowId]
    if not e then return end
    ActiveEscrows[escrowId] = nil
end

AddEventHandler('playerDropped', function()
    local src = source
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
    if not ok or not char or not char.id then return end
    for escrowId, e in pairs(ActiveEscrows) do
        if not e.settled then
            for i, cid in ipairs(e.charIds) do
                if cid == char.id then
                    -- This player is leaving mid-roll: refund BOTH wagers and cancel
                    -- the round; the remaining player gets their money back too.
                    e.settled = true
                    refundByCharId(e.charIds[1], e.amounts[1])
                    if e.charIds[2] ~= e.charIds[1] then
                        refundByCharId(e.charIds[2], e.amounts[2])
                    end
                    ActiveEscrows[escrowId] = nil
                    break
                end
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    -- Refund every in-flight wager on stop so a restart never destroys bets.
    for _, e in pairs(ActiveEscrows) do
        if not e.settled then
            e.settled = true
            refundByCharId(e.charIds[1], e.amounts[1])
            if e.charIds[2] ~= e.charIds[1] then
                refundByCharId(e.charIds[2], e.amounts[2])
            end
        end
    end
    ActiveEscrows = {}
end)

local function executeDiceMatch(challengerSrc, targetSrc, bet)
    local cChar = exports.sunset_core:GetCharacter(challengerSrc)
    local tChar = exports.sunset_core:GetCharacter(targetSrc)
    if not cChar or not tChar then return end

    if not exports.sunset_core:RemoveMoney(challengerSrc, 'cash', bet, 'dice_wager') then
        TriggerClientEvent('sunset:client:notify', challengerSrc, exports.sunset_core:TFor(challengerSrc, 'economy.message.you_no_longer_have_the_required_money'), 'error')
        TriggerClientEvent('sunset:client:notify', targetSrc, exports.sunset_core:TFor(targetSrc, 'economy.message.your_opponent_no_longer_has_the_required_money'), 'error')
        return
    end

    if not exports.sunset_core:RemoveMoney(targetSrc, 'cash', bet, 'dice_wager') then
        exports.sunset_core:AddMoney(challengerSrc, 'cash', bet, 'dice_refund')
        TriggerClientEvent('sunset:client:notify', targetSrc, exports.sunset_core:TFor(targetSrc, 'economy.message.you_no_longer_have_the_required_money'), 'error')
        TriggerClientEvent('sunset:client:notify', challengerSrc, exports.sunset_core:TFor(challengerSrc, 'economy.message.your_opponent_no_longer_has_the_required_money'), 'error')
        return
    end

    -- [AUDIT P5-07] Register the escrow keyed by character ids so it survives a
    -- disconnect or resource stop during the 1.8s roll.
    escrowSeq = escrowSeq + 1
    local escrowId = escrowSeq
    ActiveEscrows[escrowId] = {
        charIds = { cChar.id, tChar.id },
        amounts = { bet, bet },
        settled = false,
    }

    TriggerClientEvent('sunset:economy:playDiceAnim', challengerSrc)
    TriggerClientEvent('sunset:economy:playDiceAnim', targetSrc)

    SetTimeout(1800, function()
        local escrow = ActiveEscrows[escrowId]
        -- Already refunded by the drop/stop handlers: do nothing (no double-pay).
        if not escrow or escrow.settled then return end
        if not GetPlayerName(challengerSrc) or not GetPlayerName(targetSrc) then
            -- Someone left mid-roll but the drop handler missed it: refund both.
            escrow.settled = true
            refundByCharId(escrow.charIds[1], escrow.amounts[1])
            if escrow.charIds[2] ~= escrow.charIds[1] then
                refundByCharId(escrow.charIds[2], escrow.amounts[2])
            end
            ActiveEscrows[escrowId] = nil
            return
        end

        local cDie1, cDie2 = math.random(1, 6), math.random(1, 6)
        local tDie1, tDie2 = math.random(1, 6), math.random(1, 6)
        local cTotal = cDie1 + cDie2
        local tTotal = tDie1 + tDie2

        while cTotal == tTotal do
            cDie1, cDie2 = math.random(1, 6), math.random(1, 6)
            tDie1, tDie2 = math.random(1, 6), math.random(1, 6)
            cTotal = cDie1 + cDie2
            tTotal = tDie1 + tDie2
        end

        local cName = (cChar.firstname or '') .. ' ' .. (cChar.lastname or '')
        local tName = (tChar.firstname or '') .. ' ' .. (tChar.lastname or '')

        local totalPot = bet * 2
        local tax = math.floor(totalPot * DICE_TAX_RATE)
        local prize = totalPot - tax

        local winnerSrc, winnerName, winnerScore, loserScore, loserName
        if cTotal > tTotal then
            winnerSrc = challengerSrc
            winnerName = cName
            winnerScore = ('%d (%d+%d)'):format(cTotal, cDie1, cDie2)
            loserScore = ('%d (%d+%d)'):format(tTotal, tDie1, tDie2)
            loserName = tName
        else
            winnerSrc = targetSrc
            winnerName = tName
            winnerScore = ('%d (%d+%d)'):format(tTotal, tDie1, tDie2)
            loserScore = ('%d (%d+%d)'):format(cTotal, cDie1, cDie2)
            loserName = cName
        end

        -- [AUDIT P5-07] Payout is terminal for this escrow. If AddMoney fails
        -- (DB hiccup), refund both wagers instead of destroying the pot.
        local paid = exports.sunset_core:AddMoney(winnerSrc, 'cash', prize, 'dice_win')
        escrow.settled = true
        ActiveEscrows[escrowId] = nil
        if not paid then
            refundByCharId(escrow.charIds[1], escrow.amounts[1])
            if escrow.charIds[2] ~= escrow.charIds[1] then
                refundByCharId(escrow.charIds[2], escrow.amounts[2])
            end
            return
        end

        local broadcastMsg = ('%s rolled %s vs %s rolled %s. %s won $%s!'):format(
            winnerName, winnerScore, loserName, loserScore, winnerName,
            groupDigits(prize)
        )
        broadcastNearby(winnerSrc, broadcastMsg)
    end)
end

RegisterCommand('barbut', function(source, args)
    local sub = args[1] and string.lower(args[1])
    if sub == 'accept' then
        local challenge = PendingChallenges[source]
        if not challenge then
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_have_no_active_dice_challenge'), 'error')
            return
        end
        -- [AUDIT P6-05] Downed/jailed players cannot gamble.
        if exports.sunset_core:IsIncapacitated(source) or exports.sunset_core:IsIncapacitated(challenge.from) then
            PendingChallenges[source] = nil
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_cannot_play_dice_right_now'), 'error')
            return
        end
        PendingChallenges[source] = nil

        local challenger = challenge.from
        if not GetPlayerName(challenger) then
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.the_player_who_challenged_you_has_disconnected'), 'error')
            return
        end

        if getDist(source, challenger) > 5.0 then
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_must_be_next_to_the_player_to_play'), 'error')
            return
        end

        executeDiceMatch(challenger, source, challenge.bet)
        return
    elseif sub == 'decline' then
        if PendingChallenges[source] then
            local challenger = PendingChallenges[source].from
            PendingChallenges[source] = nil
            TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_declined_the_dice_game'), 'info')
            if GetPlayerName(challenger) then
                TriggerClientEvent('sunset:client:notify', challenger, exports.sunset_core:TFor(challenger, 'economy.message.your_dice_challenge_was_declined'), 'warning')
            end
        end
        return
    end

    local targetId = tonumber(args[1])
    local bet = tonumber(args[2])

    if not targetId or not bet or bet < MIN_DICE_BET then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.usage_barbut_player_id_min_bet_value', MIN_DICE_BET), 'info')
        return
    end

    if bet > MAX_DICE_BET then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.the_maximum_bet_is_value', groupDigits(MAX_DICE_BET)), 'error')
        return
    end

    if targetId == source then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_cannot_play_dice_with_yourself'), 'error')
        return
    end

    -- [AUDIT P6-05] Downed/jailed players cannot challenge or be challenged.
    if exports.sunset_core:IsIncapacitated(source) or exports.sunset_core:IsIncapacitated(targetId) then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_cannot_play_dice_right_now'), 'error')
        return
    end

    if not GetPlayerName(targetId) then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.player_not_found'), 'error')
        return
    end

    if getDist(source, targetId) > 4.0 then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.the_player_is_too_far_away_you_must_be'), 'error')
        return
    end

    local cCash = exports.sunset_core:GetCharacter(source)
    local tCash = exports.sunset_core:GetCharacter(targetId)
    if not cCash or (tonumber(cCash.cash) or 0) < bet then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.you_do_not_have_enough_cash_on_you'), 'error')
        return
    end
    if not tCash or (tonumber(tCash.cash) or 0) < bet then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'economy.message.the_challenged_player_does_not_have_enough_cash'), 'error')
        return
    end

    PendingChallenges[targetId] = { from = source, bet = bet, expires = os.time() + 30 }

    local cName = (cCash.firstname or '') .. ' ' .. (cCash.lastname or '')
    TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source,
        'economy.message.you_sent_a_dice_challenge_to_value_for_value',
        (tCash.firstname or '') .. ' ' .. (tCash.lastname or ''), groupDigits(bet)
    ), 'info')

    TriggerClientEvent('chat:addMessage', targetId, {
        color = { 255, 180, 0 },
        args = { 'DICE', ('^2%s^7 challenged you to a dice game for ^2$%s^7! Type ^3/barbut accept^7 or ^1/barbut decline^7 (30s).'):format(
            cName, groupDigits(bet)
        ) }
    })

    SetTimeout(30000, function()
        if PendingChallenges[targetId] and PendingChallenges[targetId].from == source then
            PendingChallenges[targetId] = nil
        end
    end)
end, false)

RegisterCommand('dice', function(source, args)
    ExecuteCommand(('barbut %s'):format(table.concat(args, ' ')))
end, false)

TriggerEvent('chat:addSuggestion', '/barbut', 'Challenge a nearby player to a dice game', {
    { name = 'id/accept/decline', help = 'Player ID or accept/decline' },
    { name = 'amount', help = 'Bet amount (cash)' }
})
TriggerEvent('chat:addSuggestion', '/dice', 'Alias for /barbut', {
    { name = 'id/accept/decline', help = 'Player ID or accept/decline' },
    { name = 'amount', help = 'Bet amount (cash)' }
})
