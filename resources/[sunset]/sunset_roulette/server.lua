-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — 3D Diamond Casino Roulette (server.lua)
-- ═══════════════════════════════════════════════════════════════

local takenChair, activeTables = {}, {}

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

local function notify(source, key, kind, ...)
    local args = { ... }
    local ok, msg = pcall(function() return exports.sunset_core:TFor(source, key, table.unpack(args)) end)
    TriggerClientEvent('sunset:client:notify', source, ok and msg or key, kind or 'info', 5000)
end

-- [CASINO-AUTH] limits (server-side only)
local MIN_BET, MAX_BET, MAX_TOTAL_BET, MAX_BET_LINES = 10, 50000, 200000, 40

local function charIdOf(src)
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
    return ok and char and tonumber(char.id) or nil
end

-- In-flight stakes (charged, not yet settled) so a resource stop refunds them once.
local Escrows = {}

-- Single credit path: online + same character -> inventory, else persisted.
local function settleCredit(entry, amount, reason)
    amount = math.floor(amount)
    if amount <= 0 then return end
    local delivered = false
    if GetPlayerName(entry.source) and charIdOf(entry.source) == entry.charId then
        delivered = giveChips(entry.source, amount)
    end
    if not delivered then CasinoPending.Add(entry.charId, amount, 'roulette_' .. reason) end
end

RegisterNetEvent('dc-casino:roulette:server:syncChairs', function(actionType, chairCoords)
    local src = source
    local playerCoords = GetEntityCoords(GetPlayerPed(src))

    if actionType ~= 'enter' and actionType ~= 'leave' then return end
    if actionType == 'enter' then
        if type(chairCoords) ~= 'vector3' or #(playerCoords - chairCoords) >= 5 then return end
    elseif takenChair[src] then
        -- a client may only release the chair it actually holds
        chairCoords = takenChair[src]
    else
        return
    end

    if actionType == 'enter' then
        if takenChair[src] then
            TriggerClientEvent('dc-casino:roulette:client:syncChairs', -1, 'leave', takenChair[src])
        end
        takenChair[src] = chairCoords
    elseif actionType == 'leave' then
        takenChair[src] = nil
    end
    TriggerClientEvent('dc-casino:roulette:client:syncChairs', -1, actionType, chairCoords)
end)

local function checkActivePlayers(tableIndex)
    ::redo::
    for i = 1, #activeTables[tableIndex] do
        local pSrc = activeTables[tableIndex][i]
        if not DoesPlayerExist(pSrc) or not takenChair[pSrc] then
            table.remove(activeTables[tableIndex], i)
            goto redo
        end
    end

    return #activeTables[tableIndex] > 0
end

local function startTableHandler(tableIndex)
    CreateThread(function()
        while #activeTables[tableIndex] > 0 do
            if not checkActivePlayers(tableIndex) then break end

            for i = 1, #activeTables[tableIndex] do
                TriggerClientEvent('dc-casino:roulette:client:startBetting', activeTables[tableIndex][i], tableIndex)
            end

            Wait(30000)

            if not checkActivePlayers(tableIndex) then break end

            -- [SEC2] Collect, sanitise and charge bets BEFORE the result exists/is sent
            -- to any client (previously the result was broadcast first, letting a
            -- modified client place a guaranteed winning bet).
            local playerBets = {}
            for i = 1, #activeTables[tableIndex] do
                local pSrc = activeTables[tableIndex][i]
                local okIn, clientInput = pcall(lib.callback.await, 'dc-casino:roulette:callback:getClientInput', pSrc)
                local clean, total = {}, 0
                if okIn and type(clientInput) == 'table' and #clientInput <= MAX_BET_LINES then
                    for j = 1, #clientInput do
                        local c = clientInput[j]
                        local amount = type(c) == 'table' and tonumber(c.amount) or nil
                        local nums, seen, valid = {}, {}, type(c) == 'table' and type(c.bets) == 'table'
                        if valid then
                            for k = 1, #c.bets do
                                local n = tonumber(c.bets[k])
                                if not n or n ~= math.floor(n) or n < 1 or n > 38 or seen[n] then valid = false break end
                                seen[n] = true
                                nums[#nums + 1] = n
                            end
                            if not RouletteRewards[#nums] then valid = false end
                        end
                        if valid and amount and amount == amount and amount >= MIN_BET and amount <= MAX_BET and amount == math.floor(amount) then
                            clean[#clean + 1] = { amount = amount, bets = nums }
                            total = total + amount
                        end
                    end
                end
                if total > MAX_TOTAL_BET then
                    notify(pSrc, 'roulette.message.bet_limit_exceeded', 'error', MAX_TOTAL_BET)
                elseif total > 0 then
                    local cid = charIdOf(pSrc)
                    if cid and countChips(pSrc) >= total and takeChips(pSrc, total) then
                        local entry = { source = pSrc, charId = cid, chosen = clean, total = total }
                        playerBets[#playerBets + 1] = entry
                        Escrows[entry] = true
                    else
                        notify(pSrc, 'roulette.message.not_enough_chips', 'error')
                    end
                end
            end

            -- Result is generated only AFTER every stake was charged; server CSPRNG.
            local randomResult = CasinoRNG.Int(1, 38)
            TriggerClientEvent('dc-casino:roulette:client:startRoulette', -1, randomResult, tableIndex)
            lib.callback.await('dc-casino:roulette:callback:checkObject', activeTables[tableIndex][1])

            for i = 1, #playerBets do
                local pSrc = playerBets[i].source
                local potentialReward = 0
                for j = 1, #playerBets[i].chosen do
                    local c = playerBets[i].chosen[j]
                    for k = 1, #c.bets do
                        if c.bets[k] == randomResult then
                            local mult = RouletteRewards[#c.bets] or 1
                            potentialReward = potentialReward + (c.amount * mult + c.amount)
                        end
                    end
                end
                local entry = playerBets[i]
                if Escrows[entry] then
                    Escrows[entry] = nil -- settle exactly once
                    settleCredit(entry, potentialReward, 'win')
                    CasinoLog.Record(entry.charId, 'roulette', 'settle', entry.total, potentialReward, 'number=' .. randomResult)
                    if GetPlayerName(pSrc) then
                        if potentialReward > 0 then
                            notify(pSrc, 'roulette.message.you_won_value_chips', 'success', potentialReward)
                        else
                            notify(pSrc, 'roulette.message.no_win_this_round', 'info')
                        end
                    end
                end
            end

            Wait(1000)
        end
    end)
end

RegisterNetEvent('dc-casino:roulette:server:enterTable', function(rouletteIndex)
    local src = source
    local playerCoords = GetEntityCoords(GetPlayerPed(src))

    if not takenChair[src] then return end
    if type(rouletteIndex) ~= 'number' then return end
    if activeTables[rouletteIndex] then
        for _, existing in ipairs(activeTables[rouletteIndex]) do
            if existing == src then return end
        end
    end
    if not RouletteLocations[rouletteIndex] or #(playerCoords - RouletteLocations[rouletteIndex].coords.xyz) >= 8 then return end

    if activeTables[rouletteIndex] and activeTables[rouletteIndex][1] then
        activeTables[rouletteIndex][#activeTables[rouletteIndex]+1] = src
    else
        activeTables[rouletteIndex] = { src }
        startTableHandler(rouletteIndex)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    if takenChair[src] then
        TriggerClientEvent('dc-casino:roulette:client:syncChairs', -1, 'leave', takenChair[src])
        takenChair[src] = nil
    end
end)


-- [CASINO-AUTH] Resource stop mid-round: refund every charged-but-unsettled stake once.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for entry in pairs(Escrows) do
        Escrows[entry] = nil
        settleCredit(entry, entry.total, 'stop_refund')
        CasinoLog.Record(entry.charId, 'roulette', 'refund', entry.total, entry.total, 'resource_stop')
    end
end)
