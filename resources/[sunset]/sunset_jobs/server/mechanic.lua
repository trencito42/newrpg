local MechanicProviders = {}
local LastRepair = {}

local function charJob(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return 'unemployed' end
    return select(1, Sunset.GetCharacterJob(char))
end

exports.sunset_core:RegisterCallback('sunset:jobs:mechanic:start', function(source)
    if charJob(source) ~= 'mechanic' then return nil, { localeKey = 'jobs.message.not_employed_as_mechanic' } end

    local cfg = Sunset.GetJobConfig('mechanic')
    if not SunsetJobs_ValidateCoords(source, cfg.depot.coords, 12.0) then return nil, { localeKey = 'jobs.message.go_to_the_mechanic_depot_to_start_work' } end
    local session, err = SunsetJobs_StartSession(source, 'mechanic', {
        repairs = 0,
        activeCallId = nil,
        stage = 'on_duty',
    })
    if not session then return nil, err end

    MechanicProviders[source] = true
    SunsetJobs_SetState(source, 'ACTIVE')

    return session.data
end)

exports.sunset_core:RegisterCallback('sunset:jobs:mechanic:acceptCall', function(source, callId)
    local session, err = SunsetJobs_RequireSession(source, 'mechanic', { 'ACTIVE' })
    if not session then return nil, err end
    if session.data.activeCallId then return nil, { localeKey = 'jobs.message.already_on_a_call' } end

    callId = tonumber(callId)
    if GetResourceState('sunset_dispatch') == 'started' then
        local ok, result = pcall(function()
            return exports.sunset_dispatch:AcceptCall(source, 'mechanic', callId)
        end)
        if ok and result then
            session.data.activeCallId = callId
            session.data.stage = 'en_route'
            session.data.acceptedAt = os.time()
            return { callId = callId }
        end
    end

    return nil, { localeKey = 'jobs.message.could_not_accept_call' }
end)

exports.sunset_core:RegisterCallback('sunset:jobs:mechanic:repair', function(source, targetSource)
    return SunsetJobs_WithLock(source, 'mechanic_repair', function()
        local session, err = SunsetJobs_RequireSession(source, 'mechanic', { 'ACTIVE' })
        if not session then return nil, err end

        if not session.data.activeCallId then return nil, { localeKey = 'jobs.message.accept_a_mechanic_service_call_first' } end
        local now = GetGameTimer()
        if now - (LastRepair[source] or -100000) < 10000 then return nil, { localeKey = 'jobs.message.wait_before_repairing_again' } end
        targetSource = tonumber(targetSource)
        if not targetSource or targetSource == source or not GetPlayerName(targetSource) then
            return nil, { localeKey = 'jobs.message.customer_not_found' }
        end

        local cfg = Sunset.GetJobConfig('mechanic')
        -- [JOBS AUDIT] the client plays a repairDurationMs animation before calling; the server never
        -- checked it, so a macro could be paid every 10s straight after accepting.
        local minWork = math.max(3, math.floor((cfg.repairDurationMs or 12000) / 1000) - 3)
        if session.data.acceptedAt and os.time() - session.data.acceptedAt < minWork then
            return nil, { localeKey = 'jobs.message.wait_before_repairing_again' }
        end
        local mePos = GetEntityCoords(GetPlayerPed(source))
        local themPos = GetEntityCoords(GetPlayerPed(targetSource))
        if #(mePos - themPos) > (cfg.repairRadius or 6.0) then
            return nil, { localeKey = 'jobs.message.too_far_from_the_vehicle' }
        end
        local targetPed = GetPlayerPed(targetSource)
        if not targetPed or targetPed == 0 or GetVehiclePedIsIn(targetPed, false) == 0 then return nil, { localeKey = 'jobs.message.customer_must_be_in_a_vehicle' } end
        if GetResourceState('sunset_dispatch') ~= 'started' then return nil, { localeKey = 'jobs.message.could_not_accept_call' } end
        local okCall, call = pcall(function() return exports.sunset_dispatch:GetCall(session.data.activeCallId) end)
        if not okCall or not call or tonumber(call.callerSource) ~= targetSource then return nil, { localeKey = 'jobs.message.repair_the_customer_assigned_to_this_call' } end
        LastRepair[source] = now

        -- [JOBS AUDIT] Close the call in session state BEFORE the yielding reads/payout (no double pay),
        -- restore it if the money write fails.
        local callId = session.data.activeCallId
        local prevAcceptedAt = session.data.acceptedAt
        session.data.activeCallId = nil
        session.data.acceptedAt = nil
        session.data.stage = 'on_duty'

        local level = 1
        local char = exports.sunset_core:GetCharacter(source)
        if char then
            local row = MySQL.single.await(
                'SELECT level FROM job_progress WHERE character_id = ? AND job_id = ?',
                { char.id, 'mechanic' }
            )
            level = row and row.level or 1
        end

        local minH = cfg.healthRestoreMin or 400
        local maxH = cfg.healthRestoreMax or 1000
        local restore = math.min(1000, minH + math.floor((maxH - minH) * (level / 10)))

        local pay = cfg.payPerRepair or 200
        if not SunsetJobs_PayReward(source, 'mechanic', pay, 'mechanic_repair', true) then
            session.data.activeCallId = callId
            session.data.acceptedAt = prevAcceptedAt
            session.data.stage = 'en_route'
            LastRepair[source] = nil
            return nil, { localeKey = 'jobs.message.payment_could_not_be_processed_try_delivering_once_more' }
        end
        TriggerClientEvent('sunset:jobs:mechanic:applyRepair', targetSource, restore)
        SunsetJobs_AddJobXP(source, 'mechanic', cfg.xpPerRepair or 20)

        session.data.repairs = (session.data.repairs or 0) + 1

        if callId then
            pcall(function()
                exports.sunset_dispatch:CompleteCall(source, 'mechanic', callId)
            end)
        end

        return { pay = pay, restore = restore }
    end)
end)

exports.sunset_core:RegisterCallback('sunset:jobs:mechanic:endShift', function(source)
    local session = SunsetJobs_GetSession(source)
    if not session or session.jobId ~= 'mechanic' then return nil, { localeKey = 'jobs.message.not_on_duty' } end

    MechanicProviders[source] = nil
    SunsetJobs_EndShift(source, 'Off duty')
    return true
end)

-- [JOBS AUDIT] MechanicProviders was only cleared by the endShift callback / playerDropped, so a
-- death, jail, timeout, cancel or job change left the player a dispatch "provider" forever.
local function pruneProviders()
    for src in pairs(MechanicProviders) do
        local sess = SunsetJobs_GetSession(src)
        if not sess or sess.jobId ~= 'mechanic' or not GetPlayerName(src) then
            MechanicProviders[src] = nil
        end
    end
end

AddEventHandler('sunset:jobs:serverSessionEnded', function(src, jobId)
    if jobId == 'mechanic' then
        MechanicProviders[src] = nil
        LastRepair[src] = nil
    end
end)

AddEventHandler('sunset:jobs:notifyMechanicCall', function(callData)
    pruneProviders()
    for src, _ in pairs(MechanicProviders) do
        TriggerClientEvent('sunset:jobs:mechanic:newCall', src, callData)
    end
end)

AddEventHandler('sunset:dispatch:callAccepted', function(callId, callType, providerSource, callerSource)
    if callType ~= 'mechanic' or not MechanicProviders[providerSource] then return end
    local session = SunsetJobs_GetSession(providerSource)
    if not session or session.jobId ~= 'mechanic' then return end
    session.data.activeCallId = tonumber(callId)
    session.data.stage = 'en_route'
    session.data.acceptedAt = session.data.acceptedAt or os.time()
    TriggerClientEvent('sunset:jobs:stateChanged', providerSource, 'ACTIVE', session.data)
end)

exports('GetMechanicProviders', function()
    pruneProviders()
    return MechanicProviders
end)

AddEventHandler('playerDropped', function()
    MechanicProviders[source] = nil
    LastRepair[source] = nil
end)
