ranks = {'02', '03', '04', '05', '06', '07', '08', '09', '10', --[['11',]] 'JACK', 'QUEEN', 'KING', 'ACE'}
suits = {'SPD', 'HRT', 'DIA', 'CLUB'}

function shuffle(tbl)
	-- [CASINO-AUTH] CSPRNG shuffle (sunset_casino/shared/rng.lua)
	CasinoRNG.Shuffle(tbl)

	--[[
	for i = 1, #tbl, 1 do
		DebugPrint(tbl[i])
	end
	]]--

  return tbl
end

function getDeck()
	local tDeck = {}
	for _,rank in pairs(ranks) do
		for _,suit in pairs(suits) do
			table.insert(tDeck, suit .. "_" .. rank)
		end
	end
	return shuffle(tDeck)
end

function takeCard(tDeck)
	--local card_pick = math.random(1,#tDeck)
	--DebugPrint(card_pick)

	return table.remove(tDeck, 1)
end

function cardValue(card)
	local rank = 10
	for i=2,11 do
		if string.find(card, tostring(i)) then
			rank = i
		end
	end
	if string.find(card, 'ACE') then
		rank = 11
	end

	return rank
end

function handValue(hand)
	local tmpValue = 0
	local numAces = 0

	for i,v in pairs(hand) do
		tmpValue = tmpValue + cardValue(v)
	end

	for i,v in pairs(hand) do
		if string.find(v, 'ACE') then numAces = numAces + 1 end
	end

	repeat
		if tmpValue > 21 and numAces > 0 then
			tmpValue = tmpValue - 10
			numAces = numAces - 1
		else
			break
		end
	until numAces == 0

	return tmpValue
end

players = {
	-- [1] = { -- table
		-- [1] = { -- player
			-- player = source
			-- seat = 1
			-- hand = {},
			-- splitHand = {}
			-- player_in = true,
			-- bet = 1500,
		-- }
	-- },
	-- [2] = {},
	-- [3] = {},
	-- [4] = {},
}
timeTracker = {}

tableTracker = {
	-- ["2"] = 1,
}

--[===[
	exports["kgv-blackjack"]:SetGetChipsCallback(function(source)
		return 0 -- [[ return money ]]
	end)

	exports["kgv-blackjack"]:SetTakeChipsCallback(function(source, amount)
		--[[ money = money - amount? ]]
	end)

	exports["kgv-blackjack"]:SetGiveChipsCallback(function(source, amount)
		--[[ money = money + amount? ]]
	end)
--]===]

local function defaultGetChips(src)
	if GetResourceState('sunset_inventory') == 'started' then
		local ok, count = pcall(function()
			return exports.sunset_inventory:CountItem(src, 'casino_chips')
		end)
		return ok and (tonumber(count) or 0) or 0
	end
	return 0
end

local function defaultTakeChips(src, amount)
	if GetResourceState('sunset_inventory') == 'started' then
		local ok, res = pcall(function()
			return exports.sunset_inventory:RemoveItem(src, 'casino_chips', math.floor(amount))
		end)
		return ok and res == true
	end
	return false
end

local function defaultGiveChips(src, amount)
	if GetResourceState('sunset_inventory') == 'started' then
		local ok, res = pcall(function()
			return exports.sunset_inventory:AddItem(src, 'casino_chips', math.floor(amount))
		end)
		return ok and res ~= false
	end
	return false
end

getChipsCallback = defaultGetChips
takeChipsCallback = defaultTakeChips
giveChipsCallback = defaultGiveChips

function FindPlayerIdx(tbl, src)

	for i = 1, #tbl do
		if tbl[i].player == src then
			return i
		end
	end

	return nil
end

function SetGetChipsCallback(cb)
	getChipsCallback = cb
end

function SetTakeChipsCallback(cb)
	takeChipsCallback = cb
end

function SetGiveChipsCallback(cb)
	giveChipsCallback = cb
end

CharOf = CharOf or {} -- [src] = charId (set on sit-down; used to credit offline players)

local function currentCharId(src)
	local ok, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
	return ok and char and tonumber(char.id) or nil
end

-- [CASINO-AUTH] Single credit path for blackjack. If the player is gone, the
-- character changed, or the inventory refuses, the chips are persisted in
-- casino_pending_chips instead of being lost (claimed later exactly once).
function GiveMoney(player, money, reason)
	money = math.floor(tonumber(money) or 0)
	if money <= 0 then return end
	local charId = CharOf[player]
	local delivered = false
	if giveChipsCallback ~= nil and GetPlayerName(player) and (not charId or currentCharId(player) == charId) then
		delivered = giveChipsCallback(player, money) ~= false
	end
	if not delivered and charId then
		CasinoPending.Add(charId, money, 'blackjack_' .. tostring(reason or 'payout'))
	end
	CasinoLog.Record(charId or 0, 'blackjack', reason or 'payout', 0, money, delivered and 'credited' or 'pending')
	-- DebugPrint("MONEY: GIVE "..GetPlayerName(player):upper().." "..money)
end

function TakeMoney(player, money)
	-- [SEC2] returns true only when the chips were actually removed
	money = math.floor(tonumber(money) or 0)
	if money <= 0 then return false end
	if takeChipsCallback ~= nil then
		return takeChipsCallback(player, money) == true
	end
	return false
	-- DebugPrint("MONEY: TAKE "..GetPlayerName(player):upper().." "..money)
end

function HaveAllPlayersBetted(table)
	for i,v in pairs(table) do
		if v.bet < 1 then
			return false
		end
	end
	return true
end

function ArePlayersStillIn(table)
	for i,v in pairs(table) do
		if v.player_in == true then
			return true
		end
	end
	return false
end

function PlayDealerAnim(dealer, animDict, anim)
	TriggerClientEvent("BLACKJACK:PlayDealerAnim", -1, dealer, animDict, anim)
end

function PlayDealerSpeech(dealer, speech)
	TriggerClientEvent("BLACKJACK:PlayDealerSpeech", -1, dealer, speech)
end

local MAX_BJ_BET = 100000000
local LOW_STAKES_MAX = 50000
local ALLOWED_BETS = {}
for _, b in ipairs(bettingNums or {}) do ALLOWED_BETS[b] = true; ALLOWED_BETS[b * 10] = true end
RoundActive = {} -- [tableIndex] = true from deal until payout/reset finished

local function betAllowed(i, bet)
	if type(bet) ~= 'number' or bet ~= bet or bet ~= math.floor(bet) or bet < 1 or bet > MAX_BJ_BET then return false end
	if not ALLOWED_BETS[bet] then return false end
	if bet > LOW_STAKES_MAX and not (tables[i] and tables[i].highStakes == true) then return false end
	return true
end

-- Chips staked on this entry that were never resolved (refund on stop / pre-deal leave).
local function refundEntry(entry, reason)
	if (entry.bet or 0) > 0 and not entry.settled then
		entry.settled = true
		local amt = entry.bet
		entry.bet = 0
		GiveMoney(entry.player, amt, reason)
	end
end

function SetPlayerBet(i, seat, bet, betId, double, split)
	local src = source
	split = split == true
	double = double == true
	bet = tonumber(bet)
	seat = tonumber(seat)
	-- [SEC2] validate table, seat, bet (integer, positive, bounded) - client-controlled
	if type(i) ~= 'number' or players[i] == nil or tableTracker[tostring(src)] ~= i then return end
	if not seat or seat < 0 or seat > 8 then return end
	if not betAllowed(i, bet) then
		TriggerClientEvent("BLACKJACK:BetReceived", src, false)
		return
	end
	if RoundActive[i] then return end -- no bets once cards are dealt

	local num = FindPlayerIdx(players[i], src)

	if num ~= nil then
		if double == false and split == false then
			-- one bet per round, chips must really be taken before the bet counts
			if (players[i][num].bet or 0) > 0 or players[i][num].betting then return end
			players[i][num].betting = true -- lock across the yielding chip removal
			if not TakeMoney(src, bet) then
				players[i][num].betting = nil
				TriggerClientEvent("BLACKJACK:BetReceived", src, false)
				return
			end
			players[i][num].betting = nil
			-- player may have left/dropped while the removal yielded
			if FindPlayerIdx(players[i], src) ~= num or RoundActive[i] then
				GiveMoney(src, bet, 'bet_abort')
				return
			end
			players[i][num].bet = bet
			players[i][num].settled = false
		else
			-- double/split chip stacks are taken server-side in the move handler;
			-- only allow the visual when a bet already exists
			if (players[i][num].bet or 0) < 1 then return end
		end

		TriggerClientEvent("BLACKJACK:PlaceBetChip", -1, i, 5-seat, bet, double, split)
	else
		DebugPrint("TABLE "..i..": PLAYER "..src.." ATTEMPTED BET BUT NO LONGER TRACKED?")
	end
end

RegisterServerEvent("BLACKJACK:SetPlayerBet")
AddEventHandler('BLACKJACK:SetPlayerBet', SetPlayerBet)

function CheckPlayerBet(i, bet)
	bet = tonumber(bet)
	if not bet or bet ~= bet or bet < 1 or bet > 100000000 or bet ~= math.floor(bet) then
		TriggerClientEvent("BLACKJACK:BetReceived", source, false)
		return
	end

	local playerChips = 0 -- Get money

	if getChipsCallback ~= nil then
		playerChips = getChipsCallback(source)
	end

	local canBet = false

	if playerChips ~= nil then
		if playerChips >= bet then
			canBet = true
		end
	end

	TriggerClientEvent("BLACKJACK:BetReceived", source, canBet)
end

RegisterServerEvent("BLACKJACK:CheckPlayerBet")
AddEventHandler("BLACKJACK:CheckPlayerBet", CheckPlayerBet)

function SortPlayers(pTable)
    local temp

    for i=1,#pTable-1 do
        for j=i+1,#pTable do
            if pTable[i].seat < pTable[j].seat then
                temp = pTable[i]
                pTable[i] = pTable[j]
                pTable[j] = temp
            end
        end
    end

    return pTable
end

RegisterServerEvent("BLACKJACK:ReceivedMove")

-- [SEC2] Only known moves; double/split need chips actually available for the extra stake.
local VALID_MOVES = { hit = true, stand = true, double = true, split = true }
function ValidateBlackjackMove(v, m)
	if type(m) ~= 'string' or not VALID_MOVES[m] then return nil end
	if m == 'double' or m == 'split' then
		-- only as the first decision on an unsplit two-card hand
		if v.splitHand or #v.hand ~= 2 then return nil end
		if m == 'split' and cardValue(v.hand[1]) ~= cardValue(v.hand[2]) then return nil end
		local chips = getChipsCallback and getChipsCallback(v.player) or 0
		if (tonumber(chips) or 0) < (v.bet or 0) then return nil end
	end
	return m
end

function StartTableThread(i)
	Citizen.CreateThread(function()
		local index = i
		-- DebugPrint(index)
		while true do Wait(0)
			if players[index] and #players[index] ~= 0 then
				DebugPrint("WAITING FOR ALL PLAYERS AT TABLE "..index.." TO PLACE THEIR BETS.")

				PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_place_bet_request")
				PlayDealerSpeech(index, "MINIGAME_DEALER_PLACE_CHIPS")

				repeat
					for i,v in pairs(players[index]) do
						TriggerClientEvent("BLACKJACK:SyncTimer", v.player, bettingTime - timeTracker[index])
					end -- Remove players from round who didn't bet in time
					Wait(1000)
					timeTracker[index] = timeTracker[index] + 1
				until HaveAllPlayersBetted(players[index]) or #players[index] == 0 or timeTracker[index] >= bettingTime

				if #players[index] == 0 then
					DebugPrint("BETTING ENDED AT TABLE "..index..", NO MORE PLAYERS")
					-- break
				else
					for i,v in pairs(players[index]) do
						if v.bet < 1 then
							v.player_in = false
						end
					end -- Remove players from round who didn't bet in time

					if ArePlayersStillIn(players[index]) then -- did everyone just not bet?
						DebugPrint("BETS PLACED AT TABLE "..index..", STARTING GAME")

						PlayDealerSpeech(index, "MINIGAME_DEALER_CLOSED_BETS")
						RoundActive[index] = true

						local currentPlayers = {table.unpack(players[index])}
						for _, cp in ipairs(currentPlayers) do cp.natural = false; cp.inRound = (cp.bet or 0) > 0 end
						local deck = getDeck()
						local dealerHand = {}
						local dealerVisibleHand = {}
						TriggerClientEvent("BLACKJACK:UpdateDealerHand", -1, index, handValue(dealerVisibleHand))
						
						currentPlayers = SortPlayers(currentPlayers)

						local gameRunning = true

						Wait(1500)

						for x=1,2 do
							local card = takeCard(deck)
							table.insert(dealerHand, card)

							TriggerClientEvent("BLACKJACK:GiveCard", -1, index, 0, #dealerHand, card, #dealerHand == 1)

							if #dealerHand == 1 then
								PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_deal_card_self")
								DebugPrint("TABLE "..index..": DEALT DEALER [HIDDEN] ") -- ..card) -- Add this to see the Dealer's hidden card
							else
								PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_deal_card_self_second_card")
								DebugPrint("TABLE "..index..": DEALT DEALER "..card)
								table.insert(dealerVisibleHand, card)
							end
							Wait(2000)
							TriggerClientEvent("BLACKJACK:UpdateDealerHand", -1, index, handValue(dealerVisibleHand))

							if #dealerHand > 1 then
								PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..cardValue(dealerHand[2]))
							end

							for i,v in pairs(currentPlayers) do
								if v.player_in then
									local card = takeCard(deck)
									TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.hand+1, card)
									PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_deal_card_player_0" .. 5-v.seat)
									table.insert(v.hand, card)

									Wait(2000)


									DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

									if handValue(v.hand) == 21 then
										TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "good")
										DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS BLACKJACK")
										v.natural = true -- paid at settlement (push vs dealer blackjack)
										v.player_in = false
										PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_BLACKJACK")
									else
										PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
									end
								end
							end
						end

						-- female_dealer_focus_player_01_idle

						if handValue(dealerHand) == 21 then
							DebugPrint("TABLE "..index..": DEALER HAS BLACKJACK")
							PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_check_and_turn_card")
							dealerVisibleHand = dealerHand
							Wait(2000)
							PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_BLACKJACK")
							TriggerClientEvent("BLACKJACK:DealerTurnOverCard", -1, index)
							TriggerClientEvent("BLACKJACK:UpdateDealerHand", -1, index, handValue(dealerVisibleHand))

							for i,v in pairs(currentPlayers) do
								TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
							end

							gameRunning = false
						elseif cardValue(dealerHand[2]) == 10 or cardValue(dealerHand[2]) == 11 then
							DebugPrint("TABLE "..index..": DEALER HAS A 10, CHECKING..")
							PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_check_card")
							Wait(2000)
						end

						if gameRunning == true then
							for i,v in pairs(currentPlayers) do
								if v.player_in then
									if tableTracker[tostring(v.player)] == nil then
										DebugPrint("TABLE "..index..": "..v.player.." WAS PUT OUT DUE TO LEAVING")
										v.player_in = false
										TriggerClientEvent("BLACKJACK:RetrieveCards", -1, index, v.seat)
									else
										PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_intro")
										Wait(1500)
										PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_ANOTHER_CARD")
										while v.player_in == true and #v.hand < 5 do
											timeTracker[index] = 0
											Wait(0)
											PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle")
											DebugPrint("TABLE "..index..": AWAITING MOVE FROM "..GetPlayerName(v.player):upper())
											TriggerClientEvent("BLACKJACK:RequestMove", v.player, moveTime - timeTracker[index])
											local receivedMove = false
											local move = "stand"
											local eventHandler = AddEventHandler("BLACKJACK:ReceivedMove", function(m)
												if source ~= v.player then return end
												m = ValidateBlackjackMove(v, m)
												if not m then return end
												move = m
												receivedMove = true
											end)

											while receivedMove == false and tableTracker[tostring(v.player)] ~= nil and timeTracker[index] < moveTime do
												for i,v in pairs(currentPlayers) do
													TriggerClientEvent("BLACKJACK:SyncTimer", v.player, moveTime - timeTracker[index])
												end
												Wait(1000)
												timeTracker[index] = timeTracker[index] + 1
											end
											--repeat Wait(0) until receivedMove == true
											RemoveEventHandler(eventHandler)

											if tableTracker[tostring(v.player)] == nil then
												DebugPrint("TABLE "..index..": "..v.player.." WAS PUT OUT DUE TO LEAVING")
												v.player_in = false
												TriggerClientEvent("BLACKJACK:RetrieveCards", -1, index, v.seat)
											else
												if move == "hit" then
													local card = takeCard(deck)
													TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.hand+1, card)
													-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
													-- Wait(1500)
													PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_hit_card_player_0" .. 5-v.seat)
													table.insert(v.hand, card)
													Wait(1500)
													DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

													if handValue(v.hand) == 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS 21")
														-- v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
														break
													elseif handValue(v.hand) > 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." WENT BUST")
														v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_PLAYER_BUST")
													else
														-- Wait(1000)
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
													end
												elseif move == "double" then
													if not TakeMoney(v.player, v.bet) then break end
													v.bet = v.bet*2

													-- TriggerClientEvent("BLACKJACK:PlaceBetChip", -1, i, 5-v.seat, betId)

													local card = takeCard(deck)
													TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.hand+1, card)
													-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
													-- Wait(1500)
													PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_hit_card_player_0" .. 5-v.seat)
													table.insert(v.hand, card)
													Wait(1500)
													DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

													if handValue(v.hand) == 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS 21")
														-- v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
														break
													elseif handValue(v.hand) > 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." WENT BUST")
														v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_PLAYER_BUST")
													else
														-- Wait(2000)
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
													end

													break
												elseif move == "split" then
													if not TakeMoney(v.player, v.bet) then break end
													v.bet = v.bet*2

													-- TriggerClientEvent("BLACKJACK:PlaceBetChip", -1, i, 5-v.seat, betId)

													PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_split_card_player_0" .. 5-v.seat)

													v.splitHand = {}

													local splitCard = table.remove(v.hand, 2)
													table.insert(v.splitHand, splitCard)

													Wait(500)

													TriggerClientEvent("BLACKJACK:SplitHand", -1, index, v.seat, #v.splitHand, v.hand, v.splitHand)

													Wait(1000)

													local card = takeCard(deck)
													TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.hand+1, card, false, false)
													-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
													-- Wait(1500)
													PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_hit_card_player_0" .. 5-v.seat)

													-- female_dealer_focus_player_01_idle_split

													table.insert(v.hand, card)
													Wait(1500)
													DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

													if handValue(v.hand) == 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS 21")
														-- v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_BLACKJACK")
														break
													elseif handValue(v.hand) > 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." WENT BUST")
														-- v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_PLAYER_BUST")
													else
														-- Wait(2000)
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
													end

													local card = takeCard(deck)
													TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.splitHand+1, card, false, true)
													-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
													-- Wait(1500)
													PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_hit_second_card_player_0" .. 5-v.seat)

													table.insert(v.splitHand, card)
													Wait(1500)
													DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

													if handValue(v.splitHand) == 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS 21")
														-- v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.splitHand))
														break
													elseif handValue(v.splitHand) > 21 then
														-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														-- Wait(1500)
														TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
														DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." WENT BUST")
														-- v.player_in = false
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_PLAYER_BUST")
													else
														-- Wait(2000)
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.splitHand))
													end

													-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_intro")
													-- Wait(1500)
													PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_ANOTHER_CARD")
													repeat Wait(0)
														timeTracker[index] = 0
														PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle")
														DebugPrint("TABLE "..index..": AWAITING MOVE FROM "..GetPlayerName(v.player):upper())
														TriggerClientEvent("BLACKJACK:RequestMove", v.player, moveTime - timeTracker[index])
														local receivedMove = false
														local move = "stand"
														local eventHandler = AddEventHandler("BLACKJACK:ReceivedMove", function(m)
															if source ~= v.player then return end
															m = ValidateBlackjackMove(v, m)
															if not m then return end
															move = m
															receivedMove = true
														end)

														while receivedMove == false and tableTracker[tostring(v.player)] ~= nil and timeTracker[index] < moveTime do
															for i,v in pairs(currentPlayers) do
																TriggerClientEvent("BLACKJACK:SyncTimer", v.player, moveTime - timeTracker[index])
															end
															Wait(1000)
															timeTracker[index] = timeTracker[index] + 1
														end

														--repeat Wait(0) until receivedMove == true
														RemoveEventHandler(eventHandler)

														if tableTracker[tostring(v.player)] == nil then
															DebugPrint("TABLE "..index..": "..v.player.." WAS PUT OUT DUE TO LEAVING")
															v.player_in = false
															TriggerClientEvent("BLACKJACK:RetrieveCards", -1, index, v.seat)
															break
														else
															if move == "hit" then
																local card = takeCard(deck)
																TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.hand+1, card, false, false)
																-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
																-- Wait(1500)
																PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_hit_card_player_0" .. 5-v.seat)
																table.insert(v.hand, card)
																Wait(1500)
																DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

																if handValue(v.hand) == 21 then
																	-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
																	-- Wait(1500)
																	DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS 21")
																	-- v.player_in = false
																	PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
																	break
																elseif handValue(v.hand) > 21 then
																	-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
																	-- Wait(1500)
																	TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
																	DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." WENT BUST")
																	-- v.player_in = false
																	PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_PLAYER_BUST")
																else
																	-- Wait(1000)
																	PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.hand))
																end
															elseif move == "stand" then
																-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro_split")
																-- Wait(1500)
																break
															end
														end
													until handValue(v.hand) >= 21 or #v.hand == 5

													if v.player_in == true then
														PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
														Wait(1500)

														PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_intro_split")
														Wait(1500)
														PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_ANOTHER_CARD")

														repeat Wait(0)
															timeTracker[index] = 0
															PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_split")
															DebugPrint("TABLE "..index..": AWAITING MOVE FROM "..GetPlayerName(v.player):upper())
															TriggerClientEvent("BLACKJACK:RequestMove", v.player, moveTime - timeTracker[index])
															local receivedMove = false
															local move = "stand"
															local eventHandler = AddEventHandler("BLACKJACK:ReceivedMove", function(m)
																if source ~= v.player then return end
																m = ValidateBlackjackMove(v, m)
																if not m then return end
																move = m
																receivedMove = true
															end)

															while receivedMove == false and tableTracker[tostring(v.player)] ~= nil and timeTracker[index] < moveTime do
																for i,v in pairs(currentPlayers) do
																	TriggerClientEvent("BLACKJACK:SyncTimer", v.player, moveTime - timeTracker[index])
																end
																Wait(1000)
																timeTracker[index] = timeTracker[index] + 1
															end
															--repeat Wait(0) until receivedMove == true
															RemoveEventHandler(eventHandler)

															if tableTracker[tostring(v.player)] == nil then
																DebugPrint("TABLE "..index..": "..v.player.." WAS PUT OUT DUE TO LEAVING")
																v.player_in = false
																TriggerClientEvent("BLACKJACK:RetrieveCards", -1, index, v.seat)
																break
															else
																if move == "hit" then
																	local card = takeCard(deck)
																	TriggerClientEvent("BLACKJACK:GiveCard", -1, index, v.seat, #v.splitHand+1, card, false, true)
																	-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
																	-- Wait(1500)
																	PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_hit_second_card_player_0" .. 5-v.seat)
																	table.insert(v.splitHand, card)
																	Wait(1500)
																	DebugPrint("TABLE "..index..": DEALT "..GetPlayerName(v.player):upper().." "..card)

																	if handValue(v.splitHand) == 21 then
																		-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
																		-- Wait(1500)
																		DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." HAS 21")
																		-- v.player_in = false
																		PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.splitHand))
																		break
																	elseif handValue(v.splitHand) > 21 then
																		-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
																		-- Wait(1500)
																		TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, "bad")
																		DebugPrint("TABLE "..index..": "..GetPlayerName(v.player):upper().." WENT BUST")
																		-- v.player_in = false
																		PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_PLAYER_BUST")
																	else
																		-- Wait(1000)
																		PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(v.splitHand))
																	end
																elseif move == "stand" then
																	break
																end
															end
														until handValue(v.splitHand) >= 21 or #v.splitHand == 5

														if handValue(v.hand) > 21 and handValue(v.splitHand) > 21 then
															v.player_in = false
														end

														PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro_split")
														Wait(1500)
													end

													break

													-- end
												elseif move == "stand" then
													-- PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
													-- Wait(1500)
													break
												end
											end
										end

										if not v.splitHand then
											PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_dealer_focus_player_0".. 5-v.seat .."_idle_outro")
											Wait(1500)
										end
									end
								end
							end

							--  Remove offline players from table
							local j = 1

							while j <= #currentPlayers do
								local player = currentPlayers[j]

								if tableTracker[tostring(player.player)] == nil then
									DebugPrint("TABLE "..index..": "..player.player.." WAS REMOVED FROM PLAYERS LIST FOR LEAVING")
									table.remove(currentPlayers, j)
								else
									j = j + 1
								end
							end

							if ArePlayersStillIn(currentPlayers) then
								PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_turn_card")
								Wait(1000)
								TriggerClientEvent("BLACKJACK:DealerTurnOverCard", -1, index)
								dealerVisibleHand = dealerHand
								Wait(1000)
								PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(dealerHand))
								TriggerClientEvent("BLACKJACK:UpdateDealerHand", -1, index, handValue(dealerVisibleHand))
							end

							if handValue(dealerHand) < 17 and ArePlayersStillIn(currentPlayers) then
								repeat
									local card = takeCard(deck)
									table.insert(dealerHand, card)

									TriggerClientEvent("BLACKJACK:GiveCard", -1, index, 0, #dealerHand, card, #dealerHand == 1)

									PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_deal_card_self_second_card")
									DebugPrint("TABLE "..index..": DEALT DEALER "..card)
									Wait(2000)
									PlayDealerSpeech(index, "MINIGAME_BJACK_DEALER_"..handValue(dealerHand))
									TriggerClientEvent("BLACKJACK:UpdateDealerHand", -1, index, handValue(dealerVisibleHand))
								until handValue(dealerHand) >= 17
							end
						end

						if handValue(dealerHand) > 21 then
							PlayDealerSpeech(index, "MINIGAME_DEALER_BUSTS")
						-- elseif handValue(dealerHand) < 21 and ArePlayersStillIn(currentPlayers) then
							-- PlayDealerSpeech(index, "MINIGAME_DEALER_WINS")
						end

						DebugPrint("TABLE "..index..": DEALER HAS "..handValue(dealerHand))

						-- [CASINO-AUTH] Single settlement path: per hand, exactly once per entry.
						local dealerVal = handValue(dealerHand)
						local dealerBJ = (#dealerHand == 2 and dealerVal == 21)
						for _, v in pairs(currentPlayers) do
							if v.inRound and not v.settled and (v.bet or 0) > 0 then
								v.settled = true -- mark BEFORE paying (payout yields)
								local stake = v.splitHand and math.floor(v.bet / 2) or v.bet
								local hands = { v.hand }
								if v.splitHand then hands[2] = v.splitHand end
								local payout, wins, losses = 0, 0, 0
								for hi, h in ipairs(hands) do
									local hv = handValue(h)
									local pay = 0
									if hv > 21 then
										pay = 0
									elseif v.natural and hi == 1 and not v.splitHand then
										pay = dealerBJ and stake or math.floor(stake * 2.5)
									elseif dealerBJ then
										pay = 0
									elseif dealerVal > 21 or hv > dealerVal then
										pay = stake * 2
									elseif hv == dealerVal then
										pay = stake
									end
									payout = payout + pay
									if pay > stake then wins = wins + 1 elseif pay < stake then losses = losses + 1 end
								end
								local reaction = (payout > v.bet) and "good" or ((payout == v.bet) and "impartial" or "bad")
								TriggerClientEvent("BLACKJACK:GameEndReaction", v.player, reaction)
								local staked = v.bet
								v.bet = 0
								if payout > 0 then GiveMoney(v.player, payout, 'settle') end
								CasinoLog.Record(CharOf[v.player] or 0, 'blackjack', 'settle', staked, payout,
									('dealer=%d hands=%d'):format(dealerVal, #hands))
								v.player_in = false
							end
						end

						if handValue(dealerHand) >= 17 then
							PlayDealerAnim(index, "anim_casino_b@amb@casino@games@shared@dealer@", "female_dealer_reaction_impartial_var0"..CasinoRNG.Int(1,3))
						elseif handValue(dealerHand) > 21 then
							PlayDealerAnim(index, "anim_casino_b@amb@casino@games@shared@dealer@", "female_dealer_reaction_good_var0"..CasinoRNG.Int(1,3))
						else
							PlayDealerAnim(index, "anim_casino_b@amb@casino@games@shared@dealer@", "female_dealer_reaction_bad_var0"..CasinoRNG.Int(1,3))
						end

						Wait(2500)

						for i,v in pairs(currentPlayers) do
							PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_retrieve_cards_player_0".. 5-v.seat)
							Wait(500)
							TriggerClientEvent("BLACKJACK:RetrieveCards", -1, index, v.seat)
							Wait(1500)

							v.bet = 0
							v.player_in = true
							v.hand = {}
							v.splitHand = nil
							v.inRound = false
							v.natural = false
							v.settled = false
						end
						RoundActive[index] = false

						PlayDealerAnim(index, "anim_casino_b@amb@casino@games@blackjack@dealer", "female_retrieve_own_cards_and_remove")
						Wait(500)
						TriggerClientEvent("BLACKJACK:RetrieveCards", -1, index, 0)
						Wait(1500)

						timeTracker[index] = 0

						for i,v in pairs(currentPlayers) do
							TriggerClientEvent("BLACKJACK:RequestBets", v.player, index, timeTracker[index])
						end
						-- while true do Wait(0) end
					else
						for i,v in pairs(players[index]) do
							v.bet = 0
							v.player_in = true
							v.hand = {}
							v.splitHand = nil
						end

						timeTracker[index] = 0
					end
				end
			end
		end
	end)
end

Citizen.CreateThread(function() -- INIT
	for i,_ in pairs(tables) do
		StartTableThread(i)
		players[i] = {}
		timeTracker[i] = 0
	end
end)

function PlayerSatDown(i, seat)
	if type(i) ~= 'number' or players[i] == nil then return end
	if tableTracker[tostring(source)] ~= nil then return end
	-- [CASINO-AUTH] must physically be at the table
	do
		local ped = GetPlayerPed(source)
		local tc = tables[i] and tables[i].coords
		if not ped or ped == 0 or not tc or #(GetEntityCoords(ped) - vector3(tc.x, tc.y, tc.z)) > 8.0 then return end
		if not currentCharId(source) then return end
	end
	seat = tonumber(seat)
	if not seat or seat ~= math.floor(seat) or seat < 0 or seat > 8 then return end
	for _, p in ipairs(players[i]) do
		if p.seat == seat then return end
	end
	DebugPrint(GetPlayerName(source):upper() .. " SAT DOWN AT TABLE " .. i)

	-- player = source
	-- index = i
	-- chair = seat

	table.insert(players[i], {player = source, seat = seat, hand = {}, player_in = true, bet = 0})
	CharOf[source] = currentCharId(source)
	tableTracker[tostring(source)] = i

	-- PlayDealerSpeech(i, "MINIGAME_DEALER_GREET")

	TriggerClientEvent("BLACKJACK:RequestBets", source, i)

	-- DebugPrint(#players[i])

	-- Citizen.CreateThread(function()
		-- local deck = getDeck()

		-- local card1 = takeCard(deck)
		-- TriggerClientEvent("BLACKJACK:GiveCard", player, index, card1)
		-- TriggerClientEvent("BLACKJACK:ANIM:DealCard", -1, index, chair)

		-- Wait(3000)

		-- local card2 = takeCard(deck)
		-- TriggerClientEvent("BLACKJACK:GiveCard", player, index, card2)
		-- TriggerClientEvent("BLACKJACK:ANIM:DealCard", -1, index, chair)
	-- end)

	-- local card1 = takeCard(deck)
	-- local card2 = takeCard(deck)

	-- TriggerEvent('_chat:messageEntered', GetPlayerName(source), {0, 0, 0}, "has " .. handValue({card1, card2}) .. " ("..cardValue(card1)..", "..cardValue(card2)..")")
end

RegisterServerEvent("BLACKJACK:PlayerSatDown")
AddEventHandler('BLACKJACK:PlayerSatDown', PlayerSatDown)


function PlayerSatUp(i)
	if type(i) ~= 'number' or players[i] == nil then return end
	DebugPrint(GetPlayerName(source):upper() .. " LEFT TABLE "..i)

	local num = FindPlayerIdx(players[i], source)

	if num ~= nil then
		DebugPrint(GetPlayerName(source):upper() .. " SUCCESSFULLY REMOVED FROM TABLE "..i)

		-- Bet taken but no cards dealt yet: refund. Mid-hand: forfeited (logged).
		local entry = players[i][num]
		if not entry.inRound then refundEntry(entry, 'leave_refund')
		elseif (entry.bet or 0) > 0 then CasinoLog.Record(CharOf[source] or 0, 'blackjack', 'forfeit', entry.bet, 0, 'left mid-hand') end
		table.remove(players[i], num)
		tableTracker[tostring(source)] = nil

		PlayDealerSpeech(i, "MINIGAME_DEALER_LEAVE_NEUTRAL_GAME")
	end
end

RegisterServerEvent("BLACKJACK:PlayerSatUp")
AddEventHandler('BLACKJACK:PlayerSatUp', PlayerSatUp)

function PlayerLeft()
	local playerTbl = tableTracker[tostring(source)]

	if playerTbl ~= nil then
		DebugPrint(GetPlayerName(source):upper() .. " LEFT SERVER")

		local num = FindPlayerIdx(players[playerTbl], source)

		if num ~= nil then
			DebugPrint(GetPlayerName(source):upper() .. " REMOVED FROM TABLE FOR LEAVING")
			local entry = players[playerTbl][num]
			if not entry.inRound then refundEntry(entry, 'drop_refund')
			elseif (entry.bet or 0) > 0 then CasinoLog.Record(CharOf[source] or 0, 'blackjack', 'forfeit', entry.bet, 0, 'dropped mid-hand') end
			table.remove(players[playerTbl], num)
		end

		tableTracker[tostring(source)] = nil
	end
end

AddEventHandler("playerDropped", PlayerLeft)

function PlayerRemove(i)
	if type(i) ~= 'number' or players[i] == nil then return end
	DebugPrint(GetPlayerName(source):upper() .. " LEFT TABLE "..i)

	local num = FindPlayerIdx(players[i], source)

	if num ~= nil then
		DebugPrint(GetPlayerName(source):upper() .. " SUCCESSFULLY REMOVED FROM TABLE "..i)

		local playerInfo = players[i][num]

		-- [CASINO-AUTH] refund only before cards are dealt; leaving mid-hand forfeits the stake
		-- (previously a losing hand could be abandoned for a full refund).
		if not playerInfo.inRound then
			refundEntry(playerInfo, 'remove_refund')
		elseif (playerInfo.bet or 0) > 0 then
			CasinoLog.Record(CharOf[source] or 0, 'blackjack', 'forfeit', playerInfo.bet, 0, 'removed mid-hand')
		end

		table.remove(players[i], num)
		tableTracker[tostring(source)] = nil

		PlayDealerSpeech(i, "MINIGAME_DEALER_LEAVE_NEUTRAL_GAME")
	end
end

RegisterServerEvent("BLACKJACK:PlayerRemove")
AddEventHandler('BLACKJACK:PlayerRemove', PlayerRemove)

exports("SetGetChipsCallback", SetGetChipsCallback)
exports("SetTakeChipsCallback", SetTakeChipsCallback)
exports("SetGiveChipsCallback", SetGiveChipsCallback)

-- [CASINO-AUTH] Resource stop/restart: refund every unresolved stake (online ->
-- inventory, otherwise persisted in casino_pending_chips). Exactly once via entry.settled.
AddEventHandler('onResourceStop', function(res)
	if res ~= GetCurrentResourceName() then return end
	for _, plist in pairs(players) do
		for _, entry in ipairs(plist) do
			refundEntry(entry, 'resource_stop')
		end
	end
end)
