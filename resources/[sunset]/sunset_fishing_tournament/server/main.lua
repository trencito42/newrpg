-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Fishing Tournament Server Authority (server/main.lua)
--  Server-authoritative tournament lifecycle, weight scoring,
--  deterministic tie-breaking, idempotent rewards, and persistence.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetFishingTournament.Config

local TournamentData = {
    state = 'INACTIVE', -- 'INACTIVE' | 'ACTIVE' | 'SETTLING' | 'FINISHED'
    instanceId = nil,
    startedAt = 0,
    endsAt = 0,
    isDevTest = false,
    participants = {}, -- [charId] = { charId, source, name, joinedAt, fishCount, totalWeight10, biggestFishWeight10, biggestFishItem, lastCatchAt }
}

local isDirty = false

-- ═══════════════════════════════════════════════════════════════
--  Logging & Helpers
-- ═══════════════════════════════════════════════════════════════

local function isDebug()
    return GetConvar(Cfg.debugConvar or 'sv_sunset_fishing_tournament_debug', '0') == '1'
end

local function logInfo(msg, ...)
    print(('[FISH TOURNAMENT] ' .. msg):format(...))
end

local function logDebug(msg, ...)
    if isDebug() then
        print(('[FISH TOURNAMENT DEBUG] ' .. msg):format(...))
    end
end

local function getCharId(source)
    if not source or source <= 0 then return nil end
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.id) or nil
end

local function getCharName(source)
    if not source or source <= 0 then return 'Unknown' end
    local name = exports.sunset_core:GetPlayerDisplayName(source)
    if name and name ~= '' then return name end
    local char = exports.sunset_core:GetCharacter(source)
    if char and char.first_name then
        return ('%s %s'):format(char.first_name, char.last_name or '')
    end
    return GetPlayerName(source) or 'Unknown'
end

local function notify(source, msg, kind, duration)
    if source and source > 0 then
        TriggerClientEvent('sunset:client:notify', source, msg, kind or 'info', duration or 5000)
    end
end

-- ═══════════════════════════════════════════════════════════════
--  Deterministic Ranking & Tie Breaking
-- ═══════════════════════════════════════════════════════════════

-- Tie-breaker order:
-- 1. highest total catch weight (totalWeight10 descending)
-- 2. highest single fish weight (biggestFishWeight10 descending)
-- 3. highest fish count (fishCount descending)
-- 4. earliest lastCatchAt (lastCatchAt ascending)
-- 5. character ID fallback (charId ascending)
local function compareParticipants(a, b)
    if a.totalWeight10 ~= b.totalWeight10 then
        return a.totalWeight10 > b.totalWeight10
    end
    if a.biggestFishWeight10 ~= b.biggestFishWeight10 then
        return a.biggestFishWeight10 > b.biggestFishWeight10
    end
    if a.fishCount ~= b.fishCount then
        return a.fishCount > b.fishCount
    end
    local tA = a.lastCatchAt or a.joinedAt or 0
    local tB = b.lastCatchAt or b.joinedAt or 0
    if tA ~= tB then
        return tA < tB
    end
    return (tonumber(a.charId) or 0) < (tonumber(b.charId) or 0)
end

local function getRankedParticipants()
    local list = {}
    for _, p in pairs(TournamentData.participants) do
        list[#list + 1] = p
    end
    table.sort(list, compareParticipants)
    return list
end

local function getParticipantStatus(charId)
    local p = TournamentData.participants[charId]
    if not p then return nil end

    local ranked = getRankedParticipants()
    local myRank = #ranked
    for r, entry in ipairs(ranked) do
        if entry.charId == charId then
            myRank = r
            break
        end
    end

    local leader = ranked[1]
    local minFish = Cfg.minFish or 3
    local qualified = (p.fishCount >= minFish)

    local miniLb = {}
    for i = 1, math.min(Cfg.leaderboardSize or 5, #ranked) do
        local entry = ranked[i]
        miniLb[#miniLb + 1] = {
            rank = i,
            name = entry.name,
            weight = string.format('%.1f', entry.totalWeight10 / 10),
            fishCount = entry.fishCount,
            qualified = (entry.fishCount >= minFish),
            isSelf = (entry.charId == charId),
        }
    end

    return {
        active = (TournamentData.state == 'ACTIVE'),
        joined = true,
        rank = myRank,
        fishCount = p.fishCount,
        minFish = minFish,
        qualified = qualified,
        totalWeight = string.format('%.1f', p.totalWeight10 / 10),
        biggestWeight = string.format('%.1f', p.biggestFishWeight10 / 10),
        biggestItem = p.biggestFishItem or 'fish',
        leaderName = leader and leader.name or '—',
        leaderWeight = leader and string.format('%.1f', leader.totalWeight10 / 10) or '0.0',
        remaining = math.max(0, TournamentData.endsAt - os.time()),
        leaderboard = miniLb,
    }
end

-- ═══════════════════════════════════════════════════════════════
--  Pending Offline Rewards Settlement & Claim Flow
-- ═══════════════════════════════════════════════════════════════

local function claimPendingRewards(source, charId)
    if not charId or charId <= 0 then return end

    MySQL.query([[
        SELECT id, tournament_id, `rank`, cash, xp
        FROM fishing_tournament_rewards
        WHERE character_id = ? AND claimed_at IS NULL
    ]], { charId }, function(rows)
        if not rows or #rows == 0 then return end

        for _, row in ipairs(rows) do
            local rewardId = row.id
            local rank = row.rank
            local cash = tonumber(row.cash) or 0
            local xp = tonumber(row.xp) or 0
            local tId = row.tournament_id or 'tournament'

            if cash > 0 then
                exports.sunset_core:AddMoney(source, 'cash', cash, 'fishing_tournament_reward')
            end
            if xp > 0 then
                pcall(function() exports.sunset_core:AddXP(source, xp) end)
            end

            MySQL.update('UPDATE fishing_tournament_rewards SET claimed_at = NOW() WHERE id = ?', { rewardId })

            logInfo('claimed pending reward char=%d rank=%d cash=%d xp=%d tournament=%s',
                charId, rank, cash, xp, tId)

            notify(source, ('🎣 Fishing Tournament Claimed — Rank #%d! Reward: $%s + %d XP.'):format(
                rank, exports.sunset_core:FormatMoney and exports.sunset_core:FormatMoney(cash) or tostring(cash), xp), 'success', 10000)
        end
    end)
end

-- Character select hook from sunset_core
AddEventHandler('sunset:server:characterSelected', function(source, charId)
    source = tonumber(source)
    charId = tonumber(charId)
    if not source or not charId then return end

    claimPendingRewards(source, charId)

    -- If reconnecting during an active tournament, restore participant mapping & sync HUD
    if TournamentData.state == 'ACTIVE' and TournamentData.participants[charId] then
        local p = TournamentData.participants[charId]
        p.source = source
        p.name = getCharName(source)
        logInfo('restored participant connection char=%d source=%d', charId, source)

        local status = getParticipantStatus(charId)
        if status then
            TriggerClientEvent('sunset:fishingTournament:syncHud', source, status)
        end
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  Tournament Lifecycle
-- ═══════════════════════════════════════════════════════════════

local function startTournament(instanceId, duration, isDevTest)
    if TournamentData.state == 'ACTIVE' then
        logInfo('startTournament called but tournament is already active (id=%s)', tostring(TournamentData.instanceId))
        return
    end

    local now = os.time()
    instanceId = instanceId or ('fishing_tournament:%s:%02d'):format(os.date('%Y-%m-%d', now), os.date('*t', now).hour)
    duration = tonumber(duration) or Cfg.duration or 3600

    TournamentData.state = 'ACTIVE'
    TournamentData.instanceId = instanceId
    TournamentData.startedAt = now
    TournamentData.endsAt = now + duration
    TournamentData.isDevTest = (isDevTest == true)
    TournamentData.participants = {}
    isDirty = false

    logInfo('started id=%s duration=%ds devTest=%s', instanceId, duration, tostring(TournamentData.isDevTest))

    -- Tell all connected clients tournament has started
    TriggerClientEvent('sunset:fishingTournament:eventStarted', -1, {
        instanceId = instanceId,
        location = Cfg.joinLocation,
        radius = Cfg.joinRadius,
        endsAt = TournamentData.endsAt,
    })
end

local function settleTournament()
    if TournamentData.state ~= 'ACTIVE' then return end

    TournamentData.state = 'SETTLING'
    local instanceId = TournamentData.instanceId
    local isDevTest = TournamentData.isDevTest
    local minFish = Cfg.minFish or 3

    logInfo('settling id=%s participants=%d', instanceId, (function()
        local c = 0
        for _ in pairs(TournamentData.participants) do c = c + 1 end
        return c
    end)())

    local ranked = getRankedParticipants()
    local qualified = {}
    for _, p in ipairs(ranked) do
        if p.fishCount >= minFish then
            qualified[#qualified + 1] = p
        end
    end

    -- 1. Record History in Database
    for rank, p in ipairs(ranked) do
        local totalKg = p.totalWeight10 / 10
        local biggestKg = p.biggestFishWeight10 / 10
        MySQL.insert([[
            INSERT INTO fishing_tournament_history
                (tournament_id, started_at, ended_at, character_id, `rank`, fish_count, total_weight, biggest_fish_weight, biggest_fish_item)
            VALUES (?, FROM_UNIXTIME(?), NOW(), ?, ?, ?, ?, ?, ?)
        ]], {
            instanceId, TournamentData.startedAt, p.charId, rank, p.fishCount, totalKg, biggestKg, p.biggestFishItem or 'fish'
        })
    end

    -- 2. Distribute Rewards for Top 3 Qualified
    local topWinners = {}
    for rank = 1, math.min(3, #qualified) do
        local entry = qualified[rank]
        local reward = Cfg.rewards[rank]
        if reward then
            topWinners[#topWinners + 1] = {
                rank = rank,
                name = entry.name,
                charId = entry.charId,
                fishCount = entry.fishCount,
                totalWeight = string.format('%.1f', entry.totalWeight10 / 10),
                biggestWeight = string.format('%.1f', entry.biggestFishWeight10 / 10),
                cash = reward.cash,
                xp = reward.xp,
            }

            if not isDevTest then
                -- Check if participant source is online
                local activeSource = nil
                if entry.source and entry.source > 0 then
                    local currentCid = getCharId(entry.source)
                    if currentCid == entry.charId then
                        activeSource = entry.source
                    end
                end

                if activeSource then
                    -- Direct payout
                    exports.sunset_core:AddMoney(activeSource, 'cash', reward.cash, 'fishing_tournament')
                    pcall(function() exports.sunset_core:AddXP(activeSource, reward.xp) end)

                    MySQL.insert([[
                        INSERT INTO fishing_tournament_rewards (tournament_id, character_id, `rank`, cash, xp, claimed_at)
                        VALUES (?, ?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE `rank` = VALUES(`rank`), claimed_at = NOW()
                    ]], { instanceId, entry.charId, rank, reward.cash, reward.xp })

                    logInfo('rewarded online winner char=%d source=%d rank=%d cash=%d xp=%d',
                        entry.charId, activeSource, rank, reward.cash, reward.xp)

                    notify(activeSource, ('🎣 Fishing Tournament — %s! %d fish (Total: %.1f KG). Reward: $%s + %d XP.'):format(
                        reward.label, entry.fishCount, entry.totalWeight10 / 10,
                        exports.sunset_core:FormatMoney and exports.sunset_core:FormatMoney(reward.cash) or tostring(reward.cash),
                        reward.xp), 'success', 15000)
                else
                    -- Pending offline reward
                    MySQL.insert([[
                        INSERT INTO fishing_tournament_rewards (tournament_id, character_id, `rank`, cash, xp, claimed_at)
                        VALUES (?, ?, ?, ?, ?, NULL)
                        ON DUPLICATE KEY UPDATE `rank` = VALUES(`rank`)
                    ]], { instanceId, entry.charId, rank, reward.cash, reward.xp })

                    logInfo('queued offline reward char=%d rank=%d cash=%d xp=%d',
                        entry.charId, rank, reward.cash, reward.xp)
                end
            else
                logInfo('dev test event — rewards skipped for rank=%d char=%d', rank, entry.charId)
            end
        end
    end

    -- 3. Broadcast Results to All Clients
    local summaryTop = {}
    for i = 1, math.min(5, #ranked) do
        local entry = ranked[i]
        summaryTop[#summaryTop + 1] = {
            rank = i,
            name = entry.name,
            totalWeight = string.format('%.1f', entry.totalWeight10 / 10),
            fishCount = entry.fishCount,
            qualified = (entry.fishCount >= minFish),
        }
    end

    local resultsBroadcast = {
        tournamentId = instanceId,
        winners = topWinners,
        topParticipants = summaryTop,
        totalParticipants = #ranked,
        totalQualified = #qualified,
        isDevTest = isDevTest,
    }

    TriggerClientEvent('sunset:fishingTournament:showResults', -1, resultsBroadcast)

    -- Announce podium in chat / notice
    if #topWinners > 0 then
        local parts = {}
        for _, w in ipairs(topWinners) do
            parts[#parts + 1] = ('#%d %s (%s KG)'):format(w.rank, w.name, w.totalWeight)
        end
        TriggerClientEvent('sunset:client:notify', -1,
            ('🎣 Fishing Tournament Results: %s'):format(table.concat(parts, ' · ')), 'info', 12000)
    else
        TriggerClientEvent('sunset:client:notify', -1,
            '🎣 Fishing Tournament ended. No player caught enough fish to qualify.', 'info', 8000)
    end

    TournamentData.state = 'FINISHED'
    SetTimeout(5000, function()
        if TournamentData.state == 'FINISHED' then
            TournamentData.state = 'INACTIVE'
            TournamentData.participants = {}
        end
    end)
end

-- ═══════════════════════════════════════════════════════════════
--  Event Listeners (from sunset_events coordinator)
-- ═══════════════════════════════════════════════════════════════

AddEventHandler('sunset:events:serverStart', function(data)
    if data and data.type == 'fishing_tournament' then
        startTournament(data.instanceId, data.duration, data.isDevTest)
    end
end)

AddEventHandler('sunset:events:serverEnd', function(data)
    if data and data.type == 'fishing_tournament' then
        settleTournament()
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  Join Callback & Interaction
-- ═══════════════════════════════════════════════════════════════

exports.sunset_core:RegisterCallback('sunset:fishingTournament:join', function(source)
    source = tonumber(source)
    if not source or source <= 0 then
        return { ok = false, error = 'Invalid player session.' }
    end

    if TournamentData.state ~= 'ACTIVE' then
        return { ok = false, error = 'No fishing tournament is currently active.' }
    end

    local charId = getCharId(source)
    if not charId then
        return { ok = false, error = 'Character not loaded.' }
    end

    -- Server-side proximity check
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then
        return { ok = false, error = 'Player entity not available.' }
    end

    local pCoords = GetEntityCoords(ped)
    local loc = Cfg.joinLocation
    local dist = #(pCoords - loc)
    if dist > (Cfg.joinRadius or 45.0) then
        return { ok = false, error = 'You are too far from the tournament location.' }
    end

    -- Idempotent check
    if TournamentData.participants[charId] then
        local p = TournamentData.participants[charId]
        p.source = source
        p.name = getCharName(source)
        local status = getParticipantStatus(charId)
        return { ok = true, alreadyJoined = true, status = status }
    end

    -- Register participant
    local name = getCharName(source)
    TournamentData.participants[charId] = {
        charId = charId,
        source = source,
        name = name,
        joinedAt = os.time(),
        fishCount = 0,
        totalWeight10 = 0,
        biggestFishWeight10 = 0,
        biggestFishItem = nil,
        lastCatchAt = nil,
    }

    isDirty = true
    logInfo('player joined char=%d name=%s source=%d', charId, name, source)

    notify(source, '🎣 Fishing Tournament joined! Catch at least 3 fish. Highest total weight wins.', 'success', 8000)

    local status = getParticipantStatus(charId)
    TriggerClientEvent('sunset:fishingTournament:syncHud', source, status)

    return { ok = true, alreadyJoined = false, status = status }
end)

-- ═══════════════════════════════════════════════════════════════
--  Server Authoritative Catch Hook (from sunset_jobs/fisherman)
-- ═══════════════════════════════════════════════════════════════

AddEventHandler('sunset:fishing:caught', function(source, fishData)
    if TournamentData.state ~= 'ACTIVE' then return end

    source = tonumber(source)
    if not source or source <= 0 then return end

    local charId = getCharId(source)
    if not charId then return end

    local p = TournamentData.participants[charId]
    if not p then
        -- Catches made before joining do NOT count toward tournament
        logDebug('catch ignored for unregistered participant char=%d', charId)
        return
    end

    -- Maintain source link
    p.source = source

    fishData = type(fishData) == 'table' and fishData or {}
    local rawKg = tonumber(fishData.weight) or 1.0
    -- Avoid floating point inaccuracies by storing integer hectograms (round(kg * 10))
    local w10 = math.max(1, math.floor(rawKg * 10 + 0.5))

    p.fishCount = p.fishCount + 1
    p.totalWeight10 = p.totalWeight10 + w10
    p.lastCatchAt = os.time()

    if w10 > p.biggestFishWeight10 then
        p.biggestFishWeight10 = w10
        p.biggestFishItem = fishData.item or 'fish'
    end

    isDirty = true

    logDebug('catch char=%d item=%s weight=%.1fkg newTotal=%.1fkg count=%d',
        charId, tostring(fishData.item), w10 / 10, p.totalWeight10 / 10, p.fishCount)

    -- Instant visual feedback to the participant
    TriggerClientEvent('sunset:fishingTournament:catchFeedback', source, {
        item = fishData.item or 'fish',
        weight = string.format('%.1f', w10 / 10),
        totalWeight = string.format('%.1f', p.totalWeight10 / 10),
        fishCount = p.fishCount,
        minFish = Cfg.minFish or 3,
        qualified = (p.fishCount >= (Cfg.minFish or 3)),
    })
end)

-- ═══════════════════════════════════════════════════════════════
--  Throttled Broadcast Thread
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    local lastBroadcast = 0
    while true do
        Wait(1000)

        if TournamentData.state == 'ACTIVE' then
            local now = os.time()

            -- Check time expiry
            if now >= TournamentData.endsAt then
                settleTournament()
            else
                -- Broadcast sync to joined participants if dirty or every 5 seconds
                if isDirty or (now - lastBroadcast >= 5) then
                    isDirty = false
                    lastBroadcast = now

                    local ranked = getRankedParticipants()
                    local leader = ranked[1]
                    local minFish = Cfg.minFish or 3

                    -- Build compact top 5
                    local miniLb = {}
                    for i = 1, math.min(Cfg.leaderboardSize or 5, #ranked) do
                        local entry = ranked[i]
                        miniLb[#miniLb + 1] = {
                            rank = i,
                            name = entry.name,
                            weight = string.format('%.1f', entry.totalWeight10 / 10),
                            fishCount = entry.fishCount,
                            qualified = (entry.fishCount >= minFish),
                        }
                    end

                    for charId, p in pairs(TournamentData.participants) do
                        if p.source and p.source > 0 then
                            local currentCid = getCharId(p.source)
                            if currentCid == charId then
                                -- Find my rank
                                local myRank = #ranked
                                for r, entry in ipairs(ranked) do
                                    if entry.charId == charId then
                                        myRank = r
                                        break
                                    end
                                end

                                local payload = {
                                    active = true,
                                    joined = true,
                                    rank = myRank,
                                    fishCount = p.fishCount,
                                    minFish = minFish,
                                    qualified = (p.fishCount >= minFish),
                                    totalWeight = string.format('%.1f', p.totalWeight10 / 10),
                                    biggestWeight = string.format('%.1f', p.biggestFishWeight10 / 10),
                                    biggestItem = p.biggestFishItem or 'fish',
                                    leaderName = leader and leader.name or '—',
                                    leaderWeight = leader and string.format('%.1f', leader.totalWeight10 / 10) or '0.0',
                                    remaining = math.max(0, TournamentData.endsAt - now),
                                    leaderboard = miniLb,
                                }

                                TriggerClientEvent('sunset:fishingTournament:syncHud', p.source, payload)
                            end
                        end
                    end
                end
            end
        end
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  Status Callback & Debug Command
-- ═══════════════════════════════════════════════════════════════

exports.sunset_core:RegisterCallback('sunset:fishingTournament:status', function(source)
    source = tonumber(source)
    local charId = getCharId(source)

    if TournamentData.state ~= 'ACTIVE' then
        return {
            active = false,
            joined = false,
            remaining = 0,
        }
    end

    if not charId or not TournamentData.participants[charId] then
        return {
            active = true,
            joined = false,
            remaining = math.max(0, TournamentData.endsAt - os.time()),
            location = Cfg.joinLocation,
            radius = Cfg.joinRadius,
        }
    end

    return getParticipantStatus(charId)
end)

-- Dev / Admin diagnostic command
RegisterCommand('fishtournamentdebug', function(source, args, raw)
    local isConsole = (source == 0)
    local isAdmin = isConsole or (exports.sunset_core:IsPlayerAdmin and exports.sunset_core:IsPlayerAdmin(source))
    if not isAdmin then
        if source > 0 then notify(source, 'No permission.', 'error') end
        return
    end

    local ranked = getRankedParticipants()
    local qCount = 0
    for _, p in ipairs(ranked) do
        if p.fishCount >= (Cfg.minFish or 3) then qCount = qCount + 1 end
    end

    local info = {
        state = TournamentData.state,
        instanceId = TournamentData.instanceId or 'none',
        remaining = TournamentData.state == 'ACTIVE' and math.max(0, TournamentData.endsAt - os.time()) or 0,
        participantsCount = #ranked,
        qualifiedCount = qCount,
        isDevTest = TournamentData.isDevTest,
        top = {},
    }

    for i = 1, math.min(5, #ranked) do
        local entry = ranked[i]
        info.top[#info.top + 1] = {
            rank = i,
            name = entry.name,
            weight = string.format('%.1f', entry.totalWeight10 / 10),
            catches = entry.fishCount,
            biggest = string.format('%.1f', entry.biggestFishWeight10 / 10),
            qualified = (entry.fishCount >= (Cfg.minFish or 3)),
        }
    end

    local out = json.encode(info)
    if isConsole then
        print('^2[FISH TOURNAMENT DEBUG]^7 ' .. out)
    else
        TriggerClientEvent('chat:addMessage', source, {
            color = { 56, 189, 248 },
            multiline = true,
            args = { '[FISH TOURNAMENT DEBUG]', out }
        })
    end
end, false)

-- ═══════════════════════════════════════════════════════════════
--  On Resource Start (Mid-Event Recovery)
-- ═══════════════════════════════════════════════════════════════

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end

    -- Check if sunset_events has an active tournament running
    if GetResourceState('sunset_events') == 'started' then
        pcall(function()
            local activeEv = exports.sunset_events:GetActiveEvent()
            if activeEv and activeEv.type == 'fishing_tournament' then
                logInfo('recovered active tournament on resource start (id=%s remaining=%ds)',
                    tostring(activeEv.instanceId), activeEv.remaining or 0)
                startTournament(activeEv.instanceId, activeEv.remaining, activeEv.isDevTest)
            end
        end)
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  Server Exports
-- ═══════════════════════════════════════════════════════════════

exports('StartFishingTournament', function(eventData)
    eventData = eventData or {}
    startTournament(eventData.instanceId, eventData.duration or (eventData.endTime and (eventData.endTime - os.time())), eventData.isDevTest)
end)

exports('EndFishingTournament', function()
    settleTournament()
end)

exports('JoinTournament', function(source)
    source = tonumber(source)
    if not source or source <= 0 then return nil, 'Invalid player session.' end
    if TournamentData.state ~= 'ACTIVE' then return nil, 'No fishing tournament is active.' end
    local charId = getCharId(source)
    if not charId then return nil, 'Character not loaded.' end

    if TournamentData.participants[charId] then
        local p = TournamentData.participants[charId]
        p.source = source
        p.name = getCharName(source)
        return { ok = true, alreadyJoined = true }
    end

    local name = getCharName(source)
    TournamentData.participants[charId] = {
        charId = charId,
        source = source,
        name = name,
        joinedAt = os.time(),
        fishCount = 0,
        totalWeight10 = 0,
        biggestFishWeight10 = 0,
        biggestFishItem = nil,
        lastCatchAt = nil,
    }
    isDirty = true
    logInfo('player joined via export char=%d name=%s source=%d', charId, name, source)
    notify(source, '🎣 Fishing Tournament joined! Catch at least 3 fish. Highest total weight wins.', 'success', 8000)
    local status = getParticipantStatus(charId)
    TriggerClientEvent('sunset:fishingTournament:syncHud', source, status)
    return { ok = true, alreadyJoined = false }
end)

exports('GetTournamentData', function()
    return TournamentData
end)

print('^2[sunset_fishing_tournament]^7 Authoritative server system online')
