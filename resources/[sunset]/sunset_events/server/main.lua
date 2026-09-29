-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Server Events (server/main.lua)
--  Scheduled events: car meet, race night, fishing tournament.
--  Robust daily scheduler (date-keyed, window recovery, idempotent).
--
--  OWNERSHIP:
--    - sunset_events: schedules events, announces globally, creates map blip.
--    - Specialized events (race_night, fishing_tournament) own their
--      participation, competition rules, scoring, and placement rewards.
--    - Generic events (car_meet) use generic participation flow.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetEvents.Config
local ActiveEvent = nil       -- { type, label, startTime, endTime, location, instanceId, isDevTest }
local EventParticipants = {}  -- [src] = { type, joinedAt, score } (for generic non-specialized events)
local LastStartedKey = {}     -- [type] = 'YYYY-MM-DD:type:hour' (prevents double-start same day)

local SPECIALIZED_EVENTS = {
    race_night = true,
    fishing_tournament = true,
}

local function notify(source, msg, kind, duration)
    TriggerClientEvent('sunset:client:notify', source, msg, kind or 'info', duration or 5000)
end

local function broadcast(msg, kind)
    for _, id in ipairs(GetPlayers()) do
        TriggerClientEvent('sunset:client:notify', tonumber(id), msg, kind or 'info', 8000)
    end
end

-- ═══ ROBUST DAILY SCHEDULER & WINDOW RECOVERY ═══
-- Checks every 30s. Starts an event if:
--   - current hour matches configured hour
--   - event not already active
--   - not already started today for this hour (date-keyed)
-- Catches missed windows if server restarts mid-window (e.g. at 14:25 for 14:00-15:00).
-- Does NOT start missed events if current time is past the window.

CreateThread(function()
    Wait(5000) -- Short boot wait
    while true do
        local now = os.time()
        local today = os.date('%Y-%m-%d')
        local srvHour = tonumber(os.date('%H'))
        local srvMin = tonumber(os.date('%M'))
        local srvSec = tonumber(os.date('%S'))

        for _, ev in ipairs(Cfg.schedule or {}) do
            local todayKey = ('%s:%s:%02d'):format(today, ev.type, ev.hour)
            local isScheduledHour = (srvHour == ev.hour)
            local notAlreadyActive = (not ActiveEvent or ActiveEvent.type ~= ev.type)
            local notStartedToday = (LastStartedKey[ev.type] ~= todayKey)

            if isScheduledHour and notAlreadyActive and notStartedToday then
                local duration = ev.duration or 3600
                local elapsedSec = (srvMin * 60) + srvSec
                if elapsedSec < duration then
                    local remainingSec = duration - elapsedSec
                    LastStartedKey[ev.type] = todayKey
                    startEvent(ev, remainingSec, todayKey)
                else
                    -- Window has already expired
                    LastStartedKey[ev.type] = todayKey
                end
            end
        end

        -- Check active event expiry
        if ActiveEvent and now > ActiveEvent.endTime then
            endEvent()
        end

        Wait(30000) -- Check every 30s
    end
end)

function startEvent(ev, overrideDuration, instanceId)
    local location = Cfg.locations[ev.type]
    local duration = overrideDuration or ev.duration or 3600
    local instId = instanceId or ('%s:%s:%02d%02d%02d'):format(ev.type, os.date('%Y-%m-%d'), tonumber(os.date('%H')), tonumber(os.date('%M')), tonumber(os.date('%S')))

    ActiveEvent = {
        type       = ev.type,
        label      = ev.label,
        startTime  = os.time(),
        endTime    = os.time() + duration,
        location   = location,
        instanceId = instId,
        isDevTest  = ev.isDevTest or false,
    }

    broadcast(('🎉 %s is starting! Head to the event location.'):format(ev.label), 'success')

    -- [SERVER-SIDE] Notify other server resources
    TriggerEvent('sunset:events:serverStart', ActiveEvent)

    -- Delegate to specialized resources
    if ev.type == 'race_night' and GetResourceState('sunset_racing') == 'started' then
        pcall(function() exports.sunset_racing:StartRaceNight() end)
    elseif ev.type == 'fishing_tournament' and GetResourceState('sunset_fishing_tournament') == 'started' then
        pcall(function() exports.sunset_fishing_tournament:StartFishingTournament(ActiveEvent) end)
    end

    -- Periodic global announcement thread
    CreateThread(function()
        while ActiveEvent and ActiveEvent.type == ev.type do
            Wait((Cfg.announceInterval or 300) * 1000)
            if ActiveEvent and ActiveEvent.type == ev.type then
                local remaining = math.floor((ActiveEvent.endTime - os.time()) / 60)
                if remaining > 0 then
                    broadcast(('🎉 %s in progress — %d minutes remaining!'):format(ev.label, remaining), 'info')
                end
            end
        end
    end)

    -- Notify all clients with event info (blip, duration)
    for _, id in ipairs(GetPlayers()) do
        TriggerClientEvent('sunset:events:start', tonumber(id), {
            type       = ev.type,
            label      = ev.label,
            location   = location,
            endTime    = ActiveEvent.endTime,
            instanceId = instId,
        })
    end
end

function endEvent()
    if not ActiveEvent then return end

    local ev = ActiveEvent
    local evType = ev.type

    -- Delegate settlement to specialized resource
    if evType == 'race_night' and GetResourceState('sunset_racing') == 'started' then
        pcall(function() exports.sunset_racing:EndRaceNight() end)
    elseif evType == 'fishing_tournament' and GetResourceState('sunset_fishing_tournament') == 'started' then
        pcall(function() exports.sunset_fishing_tournament:EndFishingTournament() end)
    else
        -- Non-specialized events (e.g. car_meet): reward participants
        local reward = Cfg.rewards[evType] or { cash = 1000, xp = 50 }
        local participantCount = 0
        for src, data in pairs(EventParticipants) do
            if data.type == evType and GetPlayerName(src) then
                participantCount = participantCount + 1
                exports.sunset_core:AddMoney(src, 'cash', reward.cash, 'event_reward')
                pcall(function()
                    exports.sunset_core:AddXP(src, reward.xp)
                end)
                notify(src, ('🏆 %s complete! Reward: $%s + %d XP.'):format(ev.label, reward.cash, reward.xp), 'success', 10000)
            end
        end
        broadcast(('🏁 %s has ended. %d participants rewarded.'):format(ev.label, participantCount), 'info')
    end

    -- Notify all clients to clean up
    for _, id in ipairs(GetPlayers()) do
        TriggerClientEvent('sunset:events:end', tonumber(id), { type = evType })
    end

    -- [SERVER-SIDE] Notify other server resources
    TriggerEvent('sunset:events:serverEnd', { type = evType, instanceId = ev.instanceId })

    ActiveEvent = nil
    EventParticipants = {}
end

-- ═══ GENERIC PARTICIPATION CALLBACK ═══
-- Used for generic events (car_meet).
-- Specialized events route to their respective domains.

exports.sunset_core:RegisterCallback('sunset:events:join', function(source)
    if not ActiveEvent then
        return nil, 'No event is currently active.'
    end

    if ActiveEvent.type == 'race_night' then
        return nil, 'Race Night participation is through racing. Press E at the race hub to join a race.'
    end

    if ActiveEvent.type == 'fishing_tournament' then
        if GetResourceState('sunset_fishing_tournament') == 'started' then
            return exports.sunset_fishing_tournament:JoinTournament(source)
        end
        return nil, 'Fishing Tournament system is currently unavailable.'
    end

    local location = ActiveEvent.location
    if location then
        local ped = GetPlayerPed(source)
        if not ped or ped == 0 or #(GetEntityCoords(ped) - location) > 50.0 then
            return nil, 'You must be at the event location to participate.'
        end
    end

    EventParticipants[source] = { type = ActiveEvent.type, joinedAt = os.time(), score = 0 }
    notify(source, ('Joined %s!'):format(ActiveEvent.label), 'success')
    return { type = ActiveEvent.type, label = ActiveEvent.label }
end)

exports.sunset_core:RegisterCallback('sunset:events:status', function(source)
    if not ActiveEvent then
        return { active = false }
    end
    return {
        active = true,
        type = ActiveEvent.type,
        label = ActiveEvent.label,
        instanceId = ActiveEvent.instanceId,
        remaining = math.max(0, ActiveEvent.endTime - os.time()),
        participating = EventParticipants[source] ~= nil,
    }
end)

AddEventHandler('playerDropped', function()
    EventParticipants[source] = nil
end)

-- ═══ ADMIN / DEV COMMANDS ═══

RegisterCommand('eventstart', function(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 3) then
        TriggerClientEvent('sunset:client:notify', source, 'Requires Admin Level 3.', 'error')
        return
    end

    local evType = tostring(args[1] or ''):lower()
    local duration = tonumber(args[2]) or 3600
    local isDevTest = (tostring(args[3] or ''):lower() == 'test' or tostring(args[3] or ''):lower() == 'dev')

    local matched = nil
    for _, ev in ipairs(Cfg.schedule or {}) do
        if ev.type == evType then matched = ev; break end
    end

    if not matched then
        local names = {}
        for _, ev in ipairs(Cfg.schedule or {}) do names[#names + 1] = ev.type end
        local msg = ('Usage: /eventstart [%s] [durationSec] [test]'):format(table.concat(names, '|'))
        if source == 0 then print(msg) else TriggerClientEvent('sunset:client:notify', source, msg, 'error', 7000) end
        return
    end

    if ActiveEvent then
        endEvent()
    end

    local evDef = {
        type = matched.type,
        label = matched.label,
        duration = duration,
        isDevTest = isDevTest,
    }
    local instId = ('%s:manual:%s'):format(matched.type, os.date('%Y%m%d_%H%M%S'))
    startEvent(evDef, duration, instId)
    local confirmMsg = ('Started event "%s" for %d seconds (instance: %s, testMode: %s)'):format(matched.label, duration, instId, tostring(isDevTest))
    if source == 0 then print(confirmMsg) else TriggerClientEvent('sunset:client:notify', source, confirmMsg, 'success', 8000) end
end, false)

RegisterCommand('eventend', function(source)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 3) then
        TriggerClientEvent('sunset:client:notify', source, 'Requires Admin Level 3.', 'error')
        return
    end

    if not ActiveEvent then
        local msg = 'No event is currently active.'
        if source == 0 then print(msg) else TriggerClientEvent('sunset:client:notify', source, msg, 'info') end
        return
    end

    local endedLabel = ActiveEvent.label
    endEvent()
    local msg = ('Event "%s" has been ended.'):format(endedLabel)
    if source == 0 then print(msg) else TriggerClientEvent('sunset:client:notify', source, msg, 'success') end
end, false)

-- Cleanup on resource stop
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if ActiveEvent then
        if ActiveEvent.type == 'race_night' and GetResourceState('sunset_racing') == 'started' then
            pcall(function() exports.sunset_racing:EndRaceNight() end)
        elseif ActiveEvent.type == 'fishing_tournament' and GetResourceState('sunset_fishing_tournament') == 'started' then
            pcall(function() exports.sunset_fishing_tournament:EndFishingTournament() end)
        end
        for _, id in ipairs(GetPlayers()) do
            TriggerClientEvent('sunset:events:end', tonumber(id), { type = ActiveEvent.type })
        end
    end
end)

exports('GetActiveEvent', function() return ActiveEvent end)

print('^2[sunset_events]^7 Server events scheduler online (car meet, race night, fishing tournament)')
