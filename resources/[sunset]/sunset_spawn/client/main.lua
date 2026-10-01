local spawned = false
local spawning = false
local spawnFlowTimer = nil
local lastSpawningCharId = nil

local CIVILIAN_MALE = `mp_m_freemode_01`
local CIVILIAN_FEMALE = `mp_f_freemode_01`

local function logBoot(stage, details)
    if SunsetBoot and SunsetBoot.Log then
        SunsetBoot.Log('spawn', stage, details)
    else
        pcall(function() exports.sunset_core:BootLog('spawn', stage, details) end)
    end
end

local function logBootVerbose(stage, details)
    if SunsetBoot and SunsetBoot.LogVerbose then
        SunsetBoot.LogVerbose('spawn', stage, details)
    else
        pcall(function() exports.sunset_core:BootLogVerbose('spawn', stage, details) end)
    end
end

local function recordMilestone(phase, durationMs, details)
    if SunsetBoot and SunsetBoot.RecordMilestone then
        SunsetBoot.RecordMilestone(phase, durationMs, details)
    else
        pcall(function() exports.sunset_core:RecordMilestone(phase, durationMs, details) end)
    end
end

local function decodeMetadata(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) == 'string' then
        local ok, decoded = pcall(json.decode, raw)
        return ok and type(decoded) == 'table' and decoded or {}
    end
    return {}
end

-- Resolve the model that should be applied for login.
-- Priority: meta.skin (skin-shop override) → char.model → meta.model → appearance.model → gender default.
local function resolveModel(char)
    local meta    = decodeMetadata(char.metadata)
    local gender  = tonumber(char.gender) or 0
    local defModel = (gender == 1) and CIVILIAN_FEMALE or CIVILIAN_MALE

    local skin = meta.skin
    if skin and skin ~= '' and skin ~= 'default' and skin ~= 'reset' then
        return skin, 'meta.skin'
    end
    if char.model and char.model ~= '' then return char.model, 'char.model' end
    if meta.model and meta.model ~= '' then return meta.model, 'meta.model' end
    if char.appearance and type(char.appearance) == 'table' and char.appearance.model and char.appearance.model ~= '' then
        return char.appearance.model, 'char.appearance.model'
    end
    return defModel, 'gender_default'
end

-- Returns true when ped is still the live player ped with a valid model.
local function isValidPlayerPed(ped)
    if not DoesEntityExist(ped) then return false end
    if ped ~= PlayerPedId()    then return false end
    if GetEntityModel(ped) == 0 then return false end
    return true
end

local function validCoordinate(value)
    value = tonumber(value)
    return value and value == value and math.abs(value) < 10000.0
end

local function resolvePosition(char, spawnPosition)
    local usingSaved = type(spawnPosition) ~= 'table'
    local pos = type(spawnPosition) == 'table' and spawnPosition or (char.position or {})
    local source = (type(spawnPosition) == 'table' and spawnPosition.source) or (usingSaved and 'saved_position' or 'custom')
    if usingSaved and Sunset.GetFactionDepotRescueSpawn then
        local rescued = Sunset.GetFactionDepotRescueSpawn(pos.x, pos.y, pos.z)
        if rescued then
            pos = rescued
            source = 'depot_rescue'
        end
    end
    if not validCoordinate(pos.x) or not validCoordinate(pos.y) or not validCoordinate(pos.z) then
        print(('^1[SPAWN]^7 invalid spawn coordinates (source=%s x=%s y=%s z=%s) -> falling back to DEFAULT spawn'):format(
            tostring(source), tostring(pos.x), tostring(pos.y), tostring(pos.z)))
        pos = Sunset.Config.DefaultSpawn or { x = -1037.6, y = -2737.8, z = 13.8, w = 330.0 }
        source = 'default_fallback'
    end
    return {
        x = tonumber(pos.x) or (Sunset.Config.DefaultSpawn and Sunset.Config.DefaultSpawn.x) or -1037.6,
        y = tonumber(pos.y) or (Sunset.Config.DefaultSpawn and Sunset.Config.DefaultSpawn.y) or -2737.8,
        z = tonumber(pos.z) or (Sunset.Config.DefaultSpawn and Sunset.Config.DefaultSpawn.z) or 13.8,
        w = tonumber(pos.w) or (Sunset.Config.DefaultSpawn and Sunset.Config.DefaultSpawn.w) or 330.0,
        source = source,
    }
end

local function defaultPosition()
    local res = resolvePosition({}, Sunset.Config.DefaultSpawn)
    res.source = 'default'
    return res
end

-- PrepareSpawn Routing Bucket Handshake
local pendingPrepareAck = nil
local lastBucketAck = nil

RegisterNetEvent('sunset:client:prepareSpawnAck', function(requestId, newBucket, oldBucket)
    lastBucketAck = { requestId = requestId, newBucket = newBucket, oldBucket = oldBucket }
    if pendingPrepareAck and pendingPrepareAck.id == requestId then
        pendingPrepareAck.p:resolve({ newBucket = newBucket, oldBucket = oldBucket })
    end
end)

local function prepareSpawnBucket()
    local reqId = math.random(100000, 999999)
    local p = promise.new()
    pendingPrepareAck = { id = reqId, p = p }
    local t0 = GetGameTimer()
    local elapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 18 SPAWN: prepareSpawn sent | requestId=%d elapsed=%dms^7'):format(reqId, elapsed))
    logBoot('prepare_spawn:sent', ('requestId=%d'):format(reqId))
    TriggerServerEvent('sunset:server:prepareSpawn', reqId)

    local ackReceived = false
    local newBucket = nil
    local oldBucket = nil

    SetTimeout(2000, function()
        if pendingPrepareAck and pendingPrepareAck.id == reqId then
            pendingPrepareAck = nil
            p:resolve(nil)
        end
    end)

    local res = Citizen.Await(p)
    pendingPrepareAck = nil
    local rtt = GetGameTimer() - t0
    local totalElapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or rtt
    if res then
        ackReceived = true
        newBucket = res.newBucket
        oldBucket = res.oldBucket
        print(('^2[LOGIN-FLOW] 19 SPAWN: prepareSpawn ACK received | oldBucket=%s newBucket=%s rtt=%dms elapsed=%dms^7'):format(
            tostring(oldBucket), tostring(newBucket), rtt, totalElapsed))
        print(('^2[LOGIN-FLOW] 20 SPAWN: routing bucket old=%s new=%s | elapsed=%dms^7'):format(
            tostring(oldBucket), tostring(newBucket), totalElapsed))
        logBoot('prepare_spawn:ack', ('received oldBucket=%s newBucket=%s rtt=%dms'):format(
            tostring(oldBucket), tostring(newBucket), rtt))
    else
        print(('^3[LOGIN-FLOW] 19 SPAWN: prepareSpawn ACK timed out after %dms (continuing fail-safe)^7'):format(rtt))
        logBoot('prepare_spawn:timeout', ('prepareSpawn ACK timed out after %dms (fail-safe continuing)'):format(rtt))
    end
    recordMilestone('prepareSpawn_bucket_rtt', rtt, ('rtt=%dms ack=%s newBucket=%s'):format(
        rtt, tostring(ackReceived), tostring(newBucket)))
    return ackReceived, newBucket, oldBucket, rtt
end

local function streamSpawnArea(ped, pos, isFallback, targetSource)
    local tStart = GetGameTimer()
    local sourceLabel = targetSource or (pos and pos.source) or (isFallback and 'fallback' or 'primary')
    local elapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 21 SPAWN: collision streaming started | target=%s coords=(%.2f,%.2f,%.2f) elapsed=%dms^7'):format(
        sourceLabel, pos.x, pos.y, pos.z, elapsed))
    logBoot(isFallback and 'stream_fallback:start' or 'stream:start',
        ('target=%s x=%.2f y=%.2f z=%.2f'):format(sourceLabel, pos.x, pos.y, pos.z))

    -- Guard: bail immediately if the ped handle is already stale.
    if not isValidPlayerPed(ped) then
        local currentPed = PlayerPedId()
        print(('^1[SPAWN CRITICAL] STALE PLAYER PED HANDLE^7 phase=streamSpawnArea:entry'
            .. ' cachedPed=%d currentPed=%d cachedModel=%d currentModel=%d'):format(
            ped, currentPed, GetEntityModel(ped), GetEntityModel(currentPed)))
        logBoot('stream:stale_ped_entry', ('cachedPed=%d currentPed=%d'):format(ped, currentPed))
        return false, 'STALE_PED'
    end

    local tFocusStart = GetGameTimer()
    SetFocusPosAndVel(pos.x, pos.y, pos.z, 0.0, 0.0, 0.0)
    logBootVerbose('stream:focus_set', ('elapsed=%dms'):format(GetGameTimer() - tFocusStart))

    RequestCollisionAtCoord(pos.x, pos.y, pos.z)
    NewLoadSceneStartSphere(pos.x, pos.y, pos.z, 80.0, 0)
    SetEntityCoordsNoOffset(ped, pos.x, pos.y, pos.z + 0.15, false, false, false)
    SetEntityHeading(ped, pos.w or 0.0)

    -- Cap collision timeout to 8 seconds max to guarantee no infinite loading screen
    local deadline = GetGameTimer() + 8000
    local nextPollLog = GetGameTimer() + 500
    local loaded = false

    while GetGameTimer() < deadline do
        -- Mid-loop stale ped detection: stop wasting time if ped was replaced.
        if not isValidPlayerPed(ped) then
            local currentPed = PlayerPedId()
            print(('^1[SPAWN CRITICAL] STALE PLAYER PED HANDLE^7 phase=streamSpawnArea:loop'
                .. ' cachedPed=%d currentPed=%d cachedModel=%d currentModel=%d elapsed=%dms'):format(
                ped, currentPed, GetEntityModel(ped), GetEntityModel(currentPed), GetGameTimer() - tStart))
            logBoot('stream:stale_ped_loop', ('cachedPed=%d currentPed=%d elapsed=%dms'):format(
                ped, currentPed, GetGameTimer() - tStart))
            NewLoadSceneStop()
            ClearFocus()
            return false, 'STALE_PED'
        end

        RequestCollisionAtCoord(pos.x, pos.y, pos.z)
        local hasColl = HasCollisionLoadedAroundEntity(ped)
        local waitColl = IsEntityWaitingForWorldCollision(ped)

        if GetGameTimer() >= nextPollLog then
            local now = GetGameTimer()
            local c = GetEntityCoords(ped)
            local dist = #(c - vector3(pos.x, pos.y, pos.z))
            local sceneActive = false
            local sceneLoaded = false
            pcall(function() sceneActive = IsNewLoadSceneActive() == 1 or IsNewLoadSceneActive() == true end)
            pcall(function() sceneLoaded = IsNewLoadSceneLoaded() == 1 or IsNewLoadSceneLoaded() == true end)
            local streamingReqs = 0
            pcall(function() streamingReqs = GetNumberOfStreamingRequests() end)

            logBootVerbose('collision:poll', ('elapsed=%dms HasCollision=%s WaitingWorld=%s ped=(%.2f,%.2f,%.2f) target=(%.2f,%.2f,%.2f) dist=%.2f sceneActive=%s sceneLoaded=%s streamingReqs=%d'):format(
                now - tStart, tostring(hasColl), tostring(waitColl),
                c.x, c.y, c.z, pos.x, pos.y, pos.z, dist,
                tostring(sceneActive), tostring(sceneLoaded), streamingReqs
            ))
            nextPollLog = now + 500
        end

        if hasColl and not waitColl then
            loaded = true
            break
        end
        Wait(50)
    end

    local totalElapsed = GetGameTimer() - tStart
    local fullElapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or totalElapsed

    if not loaded then
        print(('^3[LOGIN-FLOW] 22 SPAWN: collision loaded / timeout | loaded=false dur=%dms elapsed=%dms target=%s^7'):format(
            totalElapsed, fullElapsed, sourceLabel))
        logBoot(isFallback and 'stream_fallback:timeout' or 'stream:timeout',
            ('timeout after %dms target=%s'):format(totalElapsed, sourceLabel))
    else
        print(('^2[LOGIN-FLOW] 22 SPAWN: collision loaded / timeout | loaded=true dur=%dms elapsed=%dms target=%s^7'):format(
            totalElapsed, fullElapsed, sourceLabel))
        logBoot(isFallback and 'stream_fallback:success' or 'stream:success',
            ('loaded elapsed=%dms target=%s'):format(totalElapsed, sourceLabel))
    end

    NewLoadSceneStop()
    ClearFocus()

    local milestoneKey = isFallback and 'streamSpawnArea_fallback' or 'streamSpawnArea_primary'
    local statusLabel = loaded and 'OK' or 'TIMEOUT'
    recordMilestone(milestoneKey, totalElapsed, ('%s target=%s'):format(statusLabel, sourceLabel))

    return loaded
end

local function spawnPlayer(char, spawnPosition)
    local tSpawnStart = GetGameTimer()
    spawning = true
    lastSpawningCharId = char and char.id or 'unknown'
    pcall(function() exports.sunset_core:SetBootState('SPAWNING', 'spawn started') end)

    local elapsed13 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 13 SPAWN: spawnPlayer entered | charId=%s elapsed=%dms^7'):format(
        tostring(lastSpawningCharId), elapsed13))
    logBoot('spawn:enter', 'spawnPlayer ENTER')

    local pos = resolvePosition(char, spawnPosition)
    local elapsed14 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 14 SPAWN: spawn position resolved | source=%s coords=(%.2f,%.2f,%.2f) elapsed=%dms^7'):format(
        tostring(pos.source), pos.x, pos.y, pos.z, elapsed14))
    logBoot('position:resolved', ('source=%s coords=%.2f,%.2f,%.2f'):format(tostring(pos.source), pos.x, pos.y, pos.z))

    local tFadeStart = GetGameTimer()
    DoScreenFadeOut(300)
    Wait(350)
    logBoot('screen_fade:out_complete', ('elapsed=%dms'):format(GetGameTimer() - tFadeStart))

    local rawModel, modelSource = resolveModel(char)
    local model = type(rawModel) == 'string' and GetHashKey(rawModel) or rawModel
    if not IsModelInCdimage(model) or not IsModelValid(model) then
        local gender = tonumber(char.gender) or 0
        model = (gender == 1) and CIVILIAN_FEMALE or CIVILIAN_MALE
        rawModel = tostring(model)
        modelSource = 'fallback_invalid'
    end

    local tModelStart = GetGameTimer()
    local elapsed15 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 15 SPAWN: model requested | model=%s source=%s elapsed=%dms^7'):format(
        tostring(rawModel), tostring(modelSource), elapsed15))
    logBoot('model:request', ('model=%s hash=%s source=%s'):format(tostring(rawModel), tostring(model), tostring(modelSource)))

    RequestModel(model)
    local modelDeadline = GetGameTimer() + 6000
    while not HasModelLoaded(model) and GetGameTimer() < modelDeadline do Wait(10) end
    if not HasModelLoaded(model) then
        print(('^3[LOGIN-FLOW] SPAWN: model %s failed to load in 6s -> fallback freemode^7'):format(tostring(rawModel)))
        local gender = tonumber(char.gender) or 0
        model = (gender == 1) and CIVILIAN_FEMALE or CIVILIAN_MALE
        RequestModel(model)
        local fallbackDeadline = GetGameTimer() + 4000
        while not HasModelLoaded(model) and GetGameTimer() < fallbackDeadline do Wait(10) end
    end
    local modelLoadDur = GetGameTimer() - tModelStart
    local elapsed16 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or modelLoadDur
    print(('^2[LOGIN-FLOW] 16 SPAWN: model loaded | model=%s dur=%dms elapsed=%dms^7'):format(
        tostring(rawModel), modelLoadDur, elapsed16))
    recordMilestone('model_load', modelLoadDur, ('model=%s'):format(tostring(rawModel)))
    logBoot('model:loaded', ('elapsed=%dms'):format(modelLoadDur))

    local pedBefore = PlayerPedId()
    local tSetModel = GetGameTimer()
    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)
    local ped = PlayerPedId()
    local setModelDur = GetGameTimer() - tSetModel
    local elapsed17 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or setModelDur
    print(('^2[LOGIN-FLOW] 17 SPAWN: SetPlayerModel complete | pedBefore=%d pedAfter=%d dur=%dms elapsed=%dms^7'):format(
        pedBefore, ped, setModelDur, elapsed17))
    recordMilestone('SetPlayerModel', setModelDur, ('pedBefore=%d pedAfter=%d'):format(pedBefore, ped))
    logBoot('player_model:set_end', ('elapsed=%dms pedBefore=%d pedAfter=%d'):format(setModelDur, pedBefore, ped))

    local tVarStart = GetGameTimer()
    SetPedDefaultComponentVariation(ped)
    SetEntityCollision(ped, true, true)
    TriggerServerEvent('sunset:server:updatePlayerPed')
    logBootVerbose('ped_variation:applied', ('elapsed=%dms'):format(GetGameTimer() - tVarStart))

    if model == `mp_m_freemode_01` or model == `mp_f_freemode_01` then
        local app = char.appearance
        if type(app) == 'string' then
            local ok, dec = pcall(json.decode, app)
            app = ok and dec or {}
        end
        if not app or type(app) ~= 'table' or not next(app) then
            if GetResourceState('sunset_appearance') == 'started' then
                app = exports.sunset_appearance:GetDefaultAppearance(char.gender or 0)
            end
        end
        if app and GetResourceState('sunset_appearance') == 'started' then
            local tAppStart = GetGameTimer()
            logBoot('appearance:start', 'calling exports.sunset_appearance:ApplyAppearance')
            exports.sunset_appearance:ApplyAppearance(ped, app, char.gender or 0)
            local appDur = GetGameTimer() - tAppStart
            recordMilestone('ApplyAppearance', appDur)
            logBoot('appearance:end', ('elapsed=%dms'):format(appDur))
        end
    end

    FreezeEntityPosition(ped, true)

    -- Explicit routing bucket transition handshake before streaming (Traces 18, 19, 20)
    prepareSpawnBucket()

    -- Collision streaming (Traces 21, 22)
    local collisionLoaded, streamReason = streamSpawnArea(ped, pos, false, pos.source)
    if not collisionLoaded then
        if streamReason == 'STALE_PED' then
            logBoot('collision:stale_ped_abort', 'ped became invalid; skipping fallback stream')
        else
            local fallback = defaultPosition()
            logBoot('collision:timeout_fallback',
                ('primary timed out at %.2f,%.2f,%.2f reason=%s; using fallback default'):format(
                    pos.x, pos.y, pos.z, tostring(streamReason or 'TIMEOUT')))
            pos = fallback
            collisionLoaded = streamSpawnArea(ped, pos, true, 'default_fallback')
        end
    end

    local elapsed23 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 23 SPAWN: characterSpawned sent | charId=%s elapsed=%dms^7'):format(
        tostring(char.id), elapsed23))
    logBoot('character_spawned:notify_server', ('charId=%s'):format(tostring(char.id)))
    TriggerServerEvent('sunset:server:characterSpawned', char.id)

    -- Re-fetch: the cached handle can be stale if the ped was replaced mid-spawn,
    -- and unfreezing a stale handle leaves the live ped frozen.
    ped = PlayerPedId()
    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, false)
    DoScreenFadeIn(650)
    Wait(100)

    local tGameplayStart = GetGameTimer()
    local elapsed24 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 24 SPAWN: enterGameplay sent | duration=450ms elapsed=%dms^7'):format(elapsed24))
    logBoot('gameplay:enter_send', 'sending enterGameplay to sunset_ui')
    exports.sunset_ui:Send('enterGameplay', { duration = 450 })
    exports.sunset_ui:MarkGameplayEntered()
    Wait(150)
    recordMilestone('gameplay_reveal', GetGameTimer() - tGameplayStart)

    -- Post-spawn world eviction watchdog.
    local safePos = pos
    CreateThread(function()
        local deadline = GetGameTimer() + 14000
        local fired = false
        while GetGameTimer() < deadline and not fired do
            Wait(250)
            local livePed = PlayerPedId()
            if not DoesEntityExist(livePed) or GetEntityModel(livePed) == 0 then
                goto continue
            end
            local current = GetEntityCoords(livePed)
            local isPosNull = math.abs(current.x) < 0.01 and math.abs(current.y) < 0.01 and math.abs(current.z) < 0.01
            if not isPosNull then
                if IsEntityWaitingForWorldCollision(livePed) or current.z < safePos.z - 8.0 then
                    local reason = IsEntityWaitingForWorldCollision(livePed) and 'WORLD_COLLISION_LOST' or 'Z_DROP'
                    fired = true
                    local fallback = defaultPosition()
                    logBoot('world_eviction:recovered', ('reason=%s relocating from %.2f,%.2f,%.2f'):format(
                        reason, current.x, current.y, current.z))
                    DoScreenFadeOut(200)
                    Wait(250)
                    FreezeEntityPosition(livePed, true)
                    streamSpawnArea(livePed, fallback, true, 'eviction_recovery')
                    SetEntityCoordsNoOffset(livePed, fallback.x, fallback.y, fallback.z + 0.15, false, false, false)
                    SetEntityHeading(livePed, fallback.w)
                    FreezeEntityPosition(livePed, false)
                    DoScreenFadeIn(500)
                    exports.sunset_ui:Notify(exports.sunset_core:Translate('spawn.message.your_saved_location_was_not_safe_so_you_were'), 'warning', 7000)
                end
            end
            ::continue::
        end
    end)

    if not collisionLoaded then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('spawn.message.the_map_loaded_slowly_if_the_world_is_missing'), 'warning', 7000)
    end
    spawned = true
    spawning = false

    local totalSpawnElapsed = GetGameTimer() - tSpawnStart
    local totalFlowElapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or totalSpawnElapsed
    print(('^2[LOGIN-FLOW] 26 SPAWN: CHARACTER FLOW COMPLETE | totalElapsed=%dms spawnElapsed=%dms charId=%s^7'):format(
        totalFlowElapsed, totalSpawnElapsed, tostring(char.id)))
    logBoot('spawn:complete', ('spawnPlayer EXIT total elapsed=%dms'):format(totalSpawnElapsed))

    TriggerEvent('sunset:client:characterFlowComplete')
    TriggerEvent('sunset:client:playerSpawned', char)
    spawnFlowTimer = nil
end

AddEventHandler('sunset:client:gameplayVisible', function()
    local elapsed25 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    print(('^2[LOGIN-FLOW] 25 SPAWN: gameplayVisible received | elapsed=%dms^7'):format(elapsed25))
    pcall(function() exports.sunset_core:SetBootState('GAMEPLAY', 'transition hidden') end)
end)

AddEventHandler('sunset:client:spawnCharacter', function(char, spawnPosition)
    if not spawnFlowTimer then spawnFlowTimer = GetGameTimer() end
    local elapsed12 = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or 0
    local charId = char and char.id or 'unknown'
    local posStr = type(spawnPosition) == 'table' and ('%.2f,%.2f,%.2f (%s)'):format(spawnPosition.x or 0, spawnPosition.y or 0, spawnPosition.z or 0, tostring(spawnPosition.source or 'unknown')) or 'default'
    print(('^2[LOGIN-FLOW] 12 SPAWN: sunset:client:spawnCharacter received | charId=%s pos=%s elapsed=%dms^7'):format(
        tostring(charId), posStr, elapsed12))

    -- [LOGIN PIPELINE] Single-flight: two triggers (auto spawn + picker, retry,
    -- duplicate event) must never run two spawn sequences on one ped.
    if spawning then
        logBoot('spawn:duplicate_ignored', ('spawnCharacter ignored: spawn already in progress (charId=%s)'):format(tostring(charId)))
        return
    end
    spawning = true
    CreateThread(function()
        local ok, err = pcall(spawnPlayer, char, spawnPosition)
        if not ok then
            -- A Lua error mid-spawn used to leave `spawning=true`, the ped frozen
            -- and the screen faded out forever. Recover deterministically.
            print(('^1[SPAWN CRITICAL]^7 spawnPlayer error: %s -> releasing player'):format(tostring(err)))
            logBoot('spawn:error_recovered', tostring(err))
            local livePed = PlayerPedId()
            FreezeEntityPosition(livePed, false)
            SetEntityVisible(livePed, true, false)
            DoScreenFadeIn(500)
            spawning = false
            spawned = true
            pcall(function() exports.sunset_ui:Send('enterGameplay', { duration = 450 }) end)
            pcall(function() exports.sunset_ui:MarkGameplayEntered() end)
            pcall(function() exports.sunset_ui:HideTransition() end)
            TriggerEvent('sunset:client:characterFlowComplete')
            spawnFlowTimer = nil
        end
    end)
end)

local function resumeIfAlreadySpawned()
    local char = exports.sunset_core:GetCharacter()
    if char and char.id then
        spawned = true
        local ped = PlayerPedId()
        SetEntityVisible(ped, true, false)
        FreezeEntityPosition(ped, false)
        pcall(function() exports.sunset_ui:HideTransition() end)
        TriggerEvent('sunset:client:playerSpawned', char)
        return true
    end
    return false
end

AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if resumeIfAlreadySpawned() then return end

    local ped = PlayerPedId()
    SetEntityVisible(ped, false, false)
    FreezeEntityPosition(ped, true)
end)

-- Background thread to keep ped hidden until spawned or editing
CreateThread(function()
    while not spawned do
        if spawning or (GetResourceState('sunset_appearance') == 'started' and exports.sunset_appearance:IsEditing()) then
            Wait(200)
        else
            local ped = PlayerPedId()
            SetEntityVisible(ped, false, false)
            FreezeEntityPosition(ped, true)
            Wait(500)
        end
    end
end)

-- Loading overlay watchdog: recover if spawning/character flow exceeds 20 seconds
CreateThread(function()
    while true do
        Wait(5000)
        if spawning and spawnFlowTimer and (GetGameTimer() - spawnFlowTimer > 20000) then
            local dur = GetGameTimer() - spawnFlowTimer
            print(('^1[LOGIN-FLOW TIMEOUT] spawning exceeded 20s (elapsed=%dms, charId=%s)^7'):format(
                dur, tostring(lastSpawningCharId)))
            print(('  sunset_core:       %s'):format(GetResourceState('sunset_core')))
            print(('  sunset_characters: %s'):format(GetResourceState('sunset_characters')))
            print(('  sunset_properties: %s'):format(GetResourceState('sunset_properties')))
            print(('  sunset_spawn:      %s'):format(GetResourceState('sunset_spawn')))
            print(('  sunset_ui:         %s'):format(GetResourceState('sunset_ui')))
            print('  -> Forcing deterministic recovery to gameplay...')

            local livePed = PlayerPedId()
            FreezeEntityPosition(livePed, false)
            SetEntityVisible(livePed, true, false)
            DoScreenFadeIn(500)
            spawning = false
            spawned = true
            pcall(function() exports.sunset_ui:Send('enterGameplay', { duration = 450 }) end)
            pcall(function() exports.sunset_ui:MarkGameplayEntered() end)
            pcall(function() exports.sunset_ui:HideTransition() end)
            TriggerEvent('sunset:client:characterFlowComplete')
            spawnFlowTimer = nil
        end
    end
end)
