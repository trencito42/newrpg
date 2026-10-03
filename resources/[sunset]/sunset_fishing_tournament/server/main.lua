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

-- [JOBS AUDIT] `exports.sunset_core.FormatMoney and ...` was always truthy (export proxies resolve any key)
-- and sunset_core exports no FormatMoney, so the call threw "No such export" in the middle of reward
-- payout/settlement (winners 2-3 unpaid, results never broadcast, state stuck in SETTLING).
local function formatMoney(n)
    n = math.floor(tonumber(n) or 0)
    local str = tostring(n)
    local formatted = str:reverse():gsub('(%d%d%d)', '%1,'):reverse():gsub('^,', '')
    return '$' .. formatted
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

local ClaimBusy = {}

local function claimPendingRewards(source, charId)
    if not charId or charId <= 0 then return end
    if ClaimBusy[charId] then return end
    ClaimBusy[charId] = true

    CreateThread(function()
        local okRun, runErr = pcall(function()
            local rows = MySQL.query.await([[
                SELECT id, tournament_id, `rank`, cash, xp
                FROM fishing_tournament_rewards
                WHERE character_id = ? AND claimed_at IS NULL
            ]], { charId })
            if not rows or #rows == 0 then return end

            for _, row in ipairs(rows) do
                local rewardId = row.id
                local rank = row.rank
                local cash = tonumber(row.cash) or 0
                local xp = tonumber(row.xp) or 0
                local tId = row.tournament_id or 'tournament'

                -- [JOBS AUDIT] Claim atomically BEFORE paying (conditional UPDATE): the old read-pay-then-mark
                -- flow double-paid when characterSelected fired twice, and marked rewards claimed even when
                -- AddMoney failed. Release the claim again if the payout fails.
                local claimed = MySQL.update.await(
                    'UPDATE fishing_tournament_rewards SET claimed_at = NOW() WHERE id = ? AND claimed_at IS NULL',
                    { rewardId })
                if claimed == 1 and GetPlayerName(source) and getCharId(source) == charId then
                    local paid = cash <= 0 or exports.sunset_core:AddMoney(source, 'cash', cash, 'fishing_tournament_reward')
                    if not paid then
                        MySQL.update.await('UPDATE fishing_tournament_rewards SET claimed_at = NULL WHERE id = ?', { rewardId })
                        logInfo('pending reward payout failed, left unclaimed id=%d char=%d', rewardId, charId)
                    else
                        if xp > 0 then
                            pcall(function() exports.sunset_core:AddXP(source, xp) end)
                        end
                        logInfo('claimed pending reward char=%d rank=%d cash=%d xp=%d tournament=%s',
                            charId, rank, cash, xp, tId)
                        notify(source, exports.sunset_core:TFor(source, 'fishing_tournament.msg.fishing_tournament_claimed_rank_reward_xp', { rank = math.floor(tonumber(rank) or 0), format_money = tostring(formatMoney(cash)), xp = math.floor(tonumber(xp) or 0) }), 'success', 10000)
                    end
                elseif claimed == 1 then
                    -- player left / switched character between the select and the claim: put it back
                    MySQL.update.await('UPDATE fishing_tournament_rewards SET claimed_at = NULL WHERE id = ?', { rewardId })
                end
            end
        end)
        ClaimBusy[charId] = nil
        if not okRun then logInfo('claimPendingRewards error: %s', tostring(runErr)) end
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

-- ── Persistence helpers (migration sql/70-fishing-tournament-persistence.sql) ──────────
-- The catches table is the single source of truth for scores. Memory is only a cache that is
-- rebuilt from the DB on resume/settle, so a restart can never lose or double-count a score.

local MAX_FISH_KG = Cfg.maxFishKg or 150.0

-- Rebuild participants (membership + aggregates) from the DB for one tournament.
-- Only catches made at or before endsAt count (deterministic cut-off).
local function loadParticipantsFromDb(tournamentId, endsAt, previous)
    local participants = {}
    local members = MySQL.query.await(
        'SELECT character_id, display_name, joined_at FROM fishing_tournament_participants WHERE tournament_id = ?',
        { tournamentId }) or {}
    for _, m in ipairs(members) do
        local cid = tonumber(m.character_id)
        local prev = previous and previous[cid]
        participants[cid] = {
            charId = cid,
            source = prev and prev.source or nil,
            name = (prev and prev.name) or m.display_name,
            joinedAt = tonumber(m.joined_at) or 0,
            fishCount = 0,
            totalWeight10 = 0,
            biggestFishWeight10 = 0,
            biggestFishItem = nil,
            lastCatchAt = nil,
            keys = {},
        }
    end
    local catches = MySQL.query.await(
        'SELECT character_id, catch_key, item, weight_10, caught_at FROM fishing_tournament_catches WHERE tournament_id = ? AND caught_at <= ? ORDER BY id ASC',
        { tournamentId, endsAt }) or {}
    for _, c in ipairs(catches) do
        local p = participants[tonumber(c.character_id)]
        if p then
            local w10 = tonumber(c.weight_10) or 0
            p.fishCount = p.fishCount + 1
            p.totalWeight10 = p.totalWeight10 + w10
            p.keys[c.catch_key] = true
            if w10 > p.biggestFishWeight10 then
                p.biggestFishWeight10 = w10
                p.biggestFishItem = c.item
            end
            local at = tonumber(c.caught_at) or 0
            if not p.lastCatchAt or at > p.lastCatchAt then p.lastCatchAt = at end
        end
    end
    return participants
end

local function broadcastStarted()
    TriggerClientEvent('sunset:fishingTournament:eventStarted', -1, {
        instanceId = TournamentData.instanceId,
        location = Cfg.joinLocation,
        radius = Cfg.joinRadius,
        endsAt = TournamentData.endsAt,
    })
end

local settleTournamentInner -- forward
local resumeFromDb -- forward

-- Start a new tournament or resume the persisted one with the same id. Refuses ids that were
-- already settled/cancelled so one tournament can never be run (and rewarded) twice.
local Starting = false
local function startTournament(instanceId, duration, isDevTest)
    if TournamentData.state ~= 'INACTIVE' or Starting then
        logInfo('startTournament ignored: state=%s starting=%s (id=%s)', TournamentData.state, tostring(Starting), tostring(TournamentData.instanceId))
        return
    end
    Starting = true
    local ok, err = pcall(function()
        local now = os.time()
        instanceId = instanceId or ('fishing_tournament:%s:%02d'):format(os.date('%Y-%m-%d', now), os.date('*t', now).hour)
        instanceId = tostring(instanceId):sub(1, 64)
        duration = tonumber(duration) or Cfg.duration or 3600

        local row = MySQL.single.await(
            'SELECT status, started_at, ends_at, is_dev_test FROM fishing_tournaments WHERE tournament_id = ?', { instanceId })
        local startedAt, endsAt, dev = now, now + duration, (isDevTest == true)
        if row then
            if row.status == 'settled' or row.status == 'cancelled' then
                logInfo('start refused: tournament %s already %s', instanceId, row.status)
                return
            end
            if row.status == 'settling' then
                logInfo('start deferred: tournament %s is mid-settlement (resume path settles it)', instanceId)
                SetTimeout(1000, function() if resumeFromDb then resumeFromDb() end end)
                return
            end
            startedAt, endsAt, dev = tonumber(row.started_at), tonumber(row.ends_at), tonumber(row.is_dev_test) == 1
        else
            MySQL.insert.await(
                'INSERT IGNORE INTO fishing_tournaments (tournament_id, status, is_dev_test, started_at, ends_at) VALUES (?, \'active\', ?, ?, ?)',
                { instanceId, dev and 1 or 0, startedAt, endsAt })
        end

        TournamentData.instanceId = instanceId
        TournamentData.startedAt = startedAt
        TournamentData.endsAt = endsAt
        TournamentData.isDevTest = dev
        TournamentData.participants = loadParticipantsFromDb(instanceId, endsAt, nil)
        TournamentData.state = 'ACTIVE'
        isDirty = true
        logInfo('%s id=%s endsIn=%ds devTest=%s', row and 'resumed' or 'started', instanceId, endsAt - now, tostring(dev))
        if endsAt > now then broadcastStarted() end
    end)
    Starting = false
    if not ok then logInfo('startTournament error: %s', tostring(err)) end
end

settleTournamentInner = function()
    if TournamentData.state ~= 'ACTIVE' then return end

    -- state flips synchronously (no yield before this line) so concurrent end triggers cannot double-settle
    TournamentData.state = 'SETTLING'
    local instanceId = TournamentData.instanceId
    local isDevTest = TournamentData.isDevTest
    local minFish = Cfg.minFish or 3

    MySQL.update.await("UPDATE fishing_tournaments SET status = 'settling' WHERE tournament_id = ? AND status = 'active'", { instanceId })

    -- Authoritative scores come from the persisted catches (cut-off = min(endsAt, now)).
    TournamentData.endsAt = math.min(TournamentData.endsAt, os.time())
    TournamentData.participants = loadParticipantsFromDb(instanceId, TournamentData.endsAt, TournamentData.participants)

    local ranked = getRankedParticipants()
    local qualified = {}
    for _, p in ipairs(ranked) do
        if p.fishCount >= minFish then qualified[#qualified + 1] = p end
    end
    logInfo('settling id=%s participants=%d qualified=%d', instanceId, #ranked, #qualified)

    -- 1. History (idempotent via uq_ft_hist)
    local endedAt = os.time()
    for rank, p in ipairs(ranked) do
        local rewardCfg = (rank <= 3 and p.fishCount >= minFish) and Cfg.rewards[rank] or nil
        MySQL.insert.await([[
            INSERT INTO fishing_tournament_history
                (tournament_id, character_id, display_name, `rank`, fish_count, total_weight_10,
                 biggest_fish_weight_10, biggest_fish_item, qualified, reward_cash, reward_xp, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE `rank` = VALUES(`rank`), fish_count = VALUES(fish_count),
                total_weight_10 = VALUES(total_weight_10), biggest_fish_weight_10 = VALUES(biggest_fish_weight_10)
        ]], {
            instanceId, p.charId, tostring(p.name or 'Unknown'):sub(1, 64), rank, p.fishCount, p.totalWeight10,
            p.biggestFishWeight10, p.biggestFishItem or 'fish', (p.fishCount >= minFish) and 1 or 0,
            (not isDevTest and rewardCfg) and rewardCfg.cash or 0, (not isDevTest and rewardCfg) and rewardCfg.xp or 0,
            TournamentData.startedAt, endedAt
        })
    end

    -- 2. Reward rows for the top 3 qualified. INSERT IGNORE on uq_ft_reward: the first insert wins, so a
    --    re-run of settlement (crash/restart) can never create a second reward. Payment itself is the
    --    single atomic claim path (claimPendingRewards: UPDATE ... WHERE claimed_at IS NULL before paying).
    local topWinners = {}
    for rank = 1, math.min(3, #qualified) do
        local entry = qualified[rank]
        local reward = Cfg.rewards[rank]
        if reward then
            topWinners[#topWinners + 1] = {
                rank = rank, name = entry.name, charId = entry.charId, fishCount = entry.fishCount,
                totalWeight = string.format('%.1f', entry.totalWeight10 / 10),
                biggestWeight = string.format('%.1f', entry.biggestFishWeight10 / 10),
                cash = reward.cash, xp = reward.xp,
            }
            if not isDevTest then
                MySQL.insert.await([[
                    INSERT IGNORE INTO fishing_tournament_rewards (tournament_id, character_id, `rank`, cash, xp, claimed_at)
                    VALUES (?, ?, ?, ?, ?, NULL)
                ]], { instanceId, entry.charId, rank, reward.cash, reward.xp })
            else
                logInfo('dev test event - rewards skipped for rank=%d char=%d', rank, entry.charId)
            end
        end
    end

    -- 3. Mark settled only after history + reward rows exist.
    MySQL.update.await("UPDATE fishing_tournaments SET status = 'settled', settled_at = ? WHERE tournament_id = ?", { os.time(), instanceId })

    -- 4. Pay online winners through the one claim path.
    if not isDevTest then
        for _, w in ipairs(topWinners) do
            local entry = TournamentData.participants[w.charId]
            if entry and entry.source and entry.source > 0 and getCharId(entry.source) == w.charId then
                claimPendingRewards(entry.source, w.charId)
            end
        end
    end

    -- 5. Broadcast results.
    local summaryTop = {}
    for i = 1, math.min(5, #ranked) do
        local entry = ranked[i]
        summaryTop[#summaryTop + 1] = {
            rank = i, name = entry.name,
            totalWeight = string.format('%.1f', entry.totalWeight10 / 10),
            fishCount = entry.fishCount, qualified = (entry.fishCount >= minFish),
        }
    end
    TriggerClientEvent('sunset:fishingTournament:showResults', -1, {
        tournamentId = instanceId, winners = topWinners, topParticipants = summaryTop,
        totalParticipants = #ranked, totalQualified = #qualified, isDevTest = isDevTest,
    })
    if #topWinners > 0 then
        local parts = {}
        for _, w in ipairs(topWinners) do
            parts[#parts + 1] = ('#%d %s (%s KG)'):format(w.rank, w.name, w.totalWeight)
        end
        TriggerClientEvent('sunset:client:notify', -1,
            ('Fishing Tournament Results: %s'):format(table.concat(parts, ' | ')), 'info', 12000)
    else
        Sunset.BroadcastLocalized('fishing_tournament.message.no_qualifiers', nil, 'info', 8000)
    end

    TournamentData.state = 'INACTIVE'
    TournamentData.participants = {}
    TournamentData.instanceId = nil
end

-- An error mid-settlement leaves the DB row in 'settling' (resumable); memory goes INACTIVE and a retry
-- is scheduled. All writes inside are idempotent, so the retry cannot double-pay.
local function settleTournament()
    if TournamentData.state ~= 'ACTIVE' then return end
    local ok, err = pcall(settleTournamentInner)
    if not ok then
        logInfo('settlement error: %s', tostring(err))
        TournamentData.state = 'INACTIVE'
        TournamentData.participants = {}
        TournamentData.instanceId = nil
        SetTimeout(60000, function() if resumeFromDb then resumeFromDb() end end)
    end
end

-- Resume after a resource/server restart: unfinished rows are either resumed (still running) or settled now.
resumeFromDb = function()
    if TournamentData.state ~= 'INACTIVE' or Starting then return end
    local rows = MySQL.query.await(
        "SELECT tournament_id, status, is_dev_test, started_at, ends_at FROM fishing_tournaments WHERE status IN ('active','settling') ORDER BY started_at ASC") or {}
    local now = os.time()
    for _, r in ipairs(rows) do
        if TournamentData.state ~= 'INACTIVE' then break end
        local endsAt = tonumber(r.ends_at) or 0
        if r.status == 'active' and endsAt > now then
            startTournament(r.tournament_id, endsAt - now, tonumber(r.is_dev_test) == 1)
        else
            TournamentData.instanceId = r.tournament_id
            TournamentData.startedAt = tonumber(r.started_at)
            TournamentData.endsAt = endsAt
            TournamentData.isDevTest = tonumber(r.is_dev_test) == 1
            TournamentData.participants = {}
            TournamentData.state = 'ACTIVE'
            settleTournament()
        end
    end
end

-- ═══════════════════════════════════════════════════════════════
--  Event Listeners (from sunset_events coordinator)
-- ═══════════════════════════════════════════════════════════════

AddEventHandler('sunset:events:serverStart', function(data)
    if data and data.type == 'fishing_tournament' then
        -- the scheduler event carries endTime, not duration (it used to fall back to the full default length)
        local dur = data.duration or (data.endTime and (data.endTime - os.time())) or nil
        startTournament(data.instanceId, dur, data.isDevTest)
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

-- Shared, idempotent join. Membership is persisted (uq_ftp_member) and tied to the character id.
local Joining = {}
local function registerParticipant(source, charId)
    local existing = TournamentData.participants[charId]
    if existing then
        existing.source = source
        existing.name = getCharName(source)
        return existing, true
    end
    if Joining[charId] then return nil end
    Joining[charId] = true
    local tid = TournamentData.instanceId
    local name = getCharName(source)
    local okIns = pcall(function()
        MySQL.insert.await(
            'INSERT IGNORE INTO fishing_tournament_participants (tournament_id, character_id, display_name, joined_at) VALUES (?, ?, ?, ?)',
            { tid, charId, tostring(name):sub(1, 64), os.time() })
    end)
    Joining[charId] = nil
    if not okIns or TournamentData.state ~= 'ACTIVE' or TournamentData.instanceId ~= tid then return nil end
    local p = TournamentData.participants[charId]
    if p then p.source = source return p, true end
    p = {
        charId = charId, source = source, name = name, joinedAt = os.time(),
        fishCount = 0, totalWeight10 = 0, biggestFishWeight10 = 0, biggestFishItem = nil, lastCatchAt = nil, keys = {},
    }
    TournamentData.participants[charId] = p
    isDirty = true
    logInfo('player joined char=%d name=%s source=%d', charId, name, source)
    return p, false
end

exports.sunset_core:RegisterCallback('sunset:fishingTournament:join', function(source)
    source = tonumber(source)
    if not source or source <= 0 then
        return { ok = false, error = exports.sunset_core:TFor(source, 'fishing_tournament.message.invalid_player_session') }
    end
    if TournamentData.state ~= 'ACTIVE' then
        return { ok = false, error = exports.sunset_core:TFor(source, 'fishing_tournament.ui.no_fishing_tournament_is_currently_active') }
    end
    local charId = getCharId(source)
    if not charId then
        return { ok = false, error = exports.sunset_core:TFor(source, 'businesses.message.character_not_loaded') }
    end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then
        return { ok = false, error = exports.sunset_core:TFor(source, 'fishing_tournament.ui.player_entity_not_available') }
    end
    local dist = #(GetEntityCoords(ped) - Cfg.joinLocation)
    if dist > (Cfg.joinRadius or 45.0) then
        return { ok = false, error = exports.sunset_core:TFor(source, 'fishing_tournament.ui.you_are_too_far_from_the') }
    end

    local p, already = registerParticipant(source, charId)
    if not p then return { ok = false, error = exports.sunset_core:TFor(source, 'fishing_tournament.ui.could_not_join_right_now') } end
    if not already then
        notify(source, exports.sunset_core:TFor(source, 'fishing_tournament.msg.fishing_tournament_joined_catch_at_least'), 'success', 8000)
    end
    local status = getParticipantStatus(charId)
    if not already then TriggerClientEvent('sunset:fishingTournament:syncHud', source, status) end
    return { ok = true, alreadyJoined = already, status = status }
end)

-- ═══════════════════════════════════════════════════════════════
--  Server Authoritative Catch Hook (from sunset_jobs/fisherman)
--  Only a server-side event (not a net event): the weight/item come from the server fishing
--  session. No client-provided score exists anywhere in this resource.
-- ═══════════════════════════════════════════════════════════════

AddEventHandler('sunset:fishing:caught', function(source, fishData)
    if TournamentData.state ~= 'ACTIVE' then return end
    source = tonumber(source)
    if not source or source <= 0 then return end
    local charId = getCharId(source)
    if not charId then return end

    local p = TournamentData.participants[charId]
    if not p then
        logDebug('catch ignored for unregistered participant char=%d', charId)
        return
    end
    p.source = source

    fishData = type(fishData) == 'table' and fishData or {}
    local now = os.time()
    if now >= TournamentData.endsAt then return end
    local rawKg = tonumber(fishData.weight)
    if not rawKg or rawKg ~= rawKg or rawKg <= 0 or rawKg > MAX_FISH_KG then
        logInfo('rejected implausible catch char=%d weight=%s', charId, tostring(fishData.weight))
        return
    end
    local item = tostring(fishData.item or 'fish'):sub(1, 64)
    local caughtAt = math.floor(tonumber(fishData.caughtAt) or now)
    if math.abs(now - caughtAt) > 30 then return end -- stale/replayed event
    local w10 = math.max(1, math.floor(rawKg * 10 + 0.5))

    -- Idempotency key per catch: identical re-delivery of the same catch is a no-op.
    local key = tostring(fishData.catchId or ('%d:%s:%d'):format(caughtAt, item, w10)):sub(1, 96)
    p.keys = p.keys or {}
    if p.keys[key] then return end
    p.keys[key] = true -- reserved synchronously, before any yield

    local tid = TournamentData.instanceId
    local okIns, affected = pcall(function()
        return MySQL.update.await(
            'INSERT IGNORE INTO fishing_tournament_catches (tournament_id, character_id, catch_key, item, weight_10, caught_at) VALUES (?, ?, ?, ?, ?, ?)',
            { tid, charId, key, item, w10, caughtAt })
    end)
    if not okIns then p.keys[key] = nil return end
    if affected ~= 1 then return end -- duplicate caught by the unique index
    if TournamentData.state ~= 'ACTIVE' or TournamentData.instanceId ~= tid then return end

    p.fishCount = p.fishCount + 1
    p.totalWeight10 = p.totalWeight10 + w10
    p.lastCatchAt = caughtAt
    if w10 > p.biggestFishWeight10 then
        p.biggestFishWeight10 = w10
        p.biggestFishItem = item
    end
    isDirty = true

    logDebug('catch char=%d item=%s weight=%.1fkg newTotal=%.1fkg count=%d',
        charId, item, w10 / 10, p.totalWeight10 / 10, p.fishCount)

    TriggerClientEvent('sunset:fishingTournament:catchFeedback', source, {
        item = item,
        weight = string.format('%.1f', w10 / 10),
        totalWeight = string.format('%.1f', p.totalWeight10 / 10),
        fishCount = p.fishCount,
        minFish = Cfg.minFish or 3,
        qualified = (p.fishCount >= (Cfg.minFish or 3)),
    })
end)

-- A leaving player keeps the score (tied to character id); only the live source link is dropped.
AddEventHandler('playerDropped', function()
    local src = source
    for _, p in pairs(TournamentData.participants) do
        if p.source == src then p.source = nil end
    end
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
    local isAdmin = isConsole or exports.sunset_admin:IsAdmin(source, 3) -- sunset_core exports no IsPlayerAdmin
    if not isAdmin then
        if source > 0 then notify(source, exports.sunset_core:TFor(source, 'fishing_tournament.msg.no_permission'), 'error') end
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
    CreateThread(function()
        -- 1) DB is the truth: resume a running tournament or settle expired/half-settled ones.
        local ok, err = pcall(resumeFromDb)
        if not ok then logInfo('resume error: %s', tostring(err)) end
        -- 2) the scheduler may know an event the DB does not (first start of the hour)
        if TournamentData.state == 'INACTIVE' and GetResourceState('sunset_events') == 'started' then
            pcall(function()
                local activeEv = exports.sunset_events:GetActiveEvent()
                if activeEv and activeEv.type == 'fishing_tournament' then
                    startTournament(activeEv.instanceId, math.max(1, (activeEv.endTime or 0) - os.time()), activeEv.isDevTest)
                end
            end)
        end
    end)
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
    if not source or source <= 0 then return nil, { localeKey = 'fishing_tournament.message.invalid_player_session' } end
    if TournamentData.state ~= 'ACTIVE' then return nil, { localeKey = 'fishing_tournament.message.no_fishing_tournament_is_active' } end
    local charId = getCharId(source)
    if not charId then return nil, { localeKey = 'fishing_tournament.message.character_not_loaded' } end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 or #(GetEntityCoords(ped) - Cfg.joinLocation) > (Cfg.joinRadius or 45.0) then
        return nil, { localeKey = 'fishing_tournament.message.invalid_player_session' }
    end
    local p, already = registerParticipant(source, charId)
    if not p then return nil, { localeKey = 'fishing_tournament.message.no_fishing_tournament_is_active' } end
    if not already then
        notify(source, exports.sunset_core:TFor(source, 'fishing_tournament.msg.fishing_tournament_joined_catch_at_least'), 'success', 8000)
        TriggerClientEvent('sunset:fishingTournament:syncHud', source, getParticipantStatus(charId))
    end
    return { ok = true, alreadyJoined = already }
end)

exports('GetTournamentData', function()
    return TournamentData
end)

print('^2[sunset_fishing_tournament]^7 Authoritative server system online')
