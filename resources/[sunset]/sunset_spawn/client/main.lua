local spawned = false
local spawning = false

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
        pos = Sunset.Config.DefaultSpawn
        source = 'default_fallback'
    end
    return {
        x = tonumber(pos.x) or Sunset.Config.DefaultSpawn.x,
        y = tonumber(pos.y) or Sunset.Config.DefaultSpawn.y,
        z = tonumber(pos.z) or Sunset.Config.DefaultSpawn.z,
        w = tonumber(pos.w) or Sunset.Config.DefaultSpawn.w,
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
    logBoot('prepare_spawn:sent', ('requestId=%d'):format(reqId))
    TriggerServerEvent('sunset:server:prepareSpawn', reqId)

    local ackReceived = false
    local newBucket = nil
    local oldBucket = nil

    SetTimeout(2500, function()
        if pendingPrepareAck and pendingPrepareAck.id == reqId then
            pendingPrepareAck = nil
            p:resolve(nil)
        end
    end)

    local res = Citizen.Await(p)
    pendingPrepareAck = nil
    local rtt = GetGameTimer() - t0
    if res then
        ackReceived = true
        newBucket = res.newBucket
        oldBucket = res.oldBucket
        logBoot('prepare_spawn:ack', ('received oldBucket=%s newBucket=%s rtt=%dms'):format(
            tostring(oldBucket), tostring(newBucket), rtt))
    else
        logBoot('prepare_spawn:timeout', ('prepareSpawn ACK timed out after %dms (fail-safe continuing)'):format(rtt))
    end
    recordMilestone('prepareSpawn_bucket_rtt', rtt, ('rtt=%dms ack=%s newBucket=%s'):format(
        rtt, tostring(ackReceived), tostring(newBucket)))
    return ackReceived, newBucket, oldBucket, rtt
end

local function streamSpawnArea(ped, pos, isFallback, targetSource)
    local tStart = GetGameTimer()
    local sourceLabel = targetSource or (pos and pos.source) or (isFallback and 'fallback' or 'primary')
    logBoot(isFallback and 'stream_fallback:start' or 'stream:start',
        ('target=%s x=%.2f y=%.2f z=%.2f'):format(sourceLabel, pos.x, pos.y, pos.z))

    -- Guard: bail immediately if the ped handle is already stale.
    if not isValidPlayerPed(ped) then
        local currentPed = PlayerPedId()
        print(('^1[SPAWN CRITICAL] STALE PLAYER PED HANDLE^7 phase=streamSpawnArea:entry'
            .. ' cachedPed=%d currentPed=%d cachedModel=%d currentModel=%d'):format(
            ped, currentPed, GetEntityModel(ped), GetEntityModel(currentPed)))
        logBoot('stream:stale_ped_entry', ('cachedPed=%d currentPed=%d'):format(ped, currentPed))
        return false, { localeKey = 'spawn.message.stale_ped' }
    end

    local tFocusStart = GetGameTimer()
    SetFocusPosAndVel(pos.x, pos.y, pos.z, 0.0, 0.0, 0.0)
    logBootVerbose('stream:focus_set', ('elapsed=%dms'):format(GetGameTimer() - tFocusStart))

    RequestCollisionAtCoord(pos.x, pos.y, pos.z)
    NewLoadSceneStartSphere(pos.x, pos.y, pos.z, 80.0, 0)
    SetEntityCoordsNoOffset(ped, pos.x, pos.y, pos.z + 0.15, false, false, false)
    SetEntityHeading(ped, pos.w or 0.0)

    local deadline = GetGameTimer() + 18000
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
            return false, { localeKey = 'spawn.message.stale_ped' }
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

    if not loaded then
        local c = GetEntityCoords(ped)
        local sceneActive = false
        local sceneLoaded = false
        pcall(function() sceneActive = IsNewLoadSceneActive() == 1 or IsNewLoadSceneActive() == true end)
        pcall(function() sceneLoaded = IsNewLoadSceneLoaded() == 1 or IsNewLoadSceneLoaded() == true end)
        local streamingReqs = 0
        pcall(function() streamingReqs = GetNumberOfStreamingRequests() end)
        local bootId = (SunsetBoot and SunsetBoot.GetBootId) and SunsetBoot.GetBootId() or 'unknown'

        print(('^1[SPAWN TIMEOUT boot=%s]^7'):format(bootId))
        print(('  targetSource:                   %s'):format(sourceLabel))
        print(('  target:                         %.2f %.2f %.2f (heading: %.2f)'):format(pos.x, pos.y, pos.z, pos.w or 0.0))
        print(('  elapsed:                        %dms'):format(totalElapsed))
        print(('  HasCollisionLoadedAroundEntity: %s'):format(tostring(HasCollisionLoadedAroundEntity(ped))))
        print(('  IsEntityWaitingForWorldCollision: %s'):format(tostring(IsEntityWaitingForWorldCollision(ped))))
        print(('  newLoadSceneActive:             %s'):format(tostring(sceneActive)))
        print(('  newLoadSceneLoaded:             %s'):format(tostring(sceneLoaded)))
        print(('  ped coordinates:                %.2f, %.2f, %.2f'):format(c.x, c.y, c.z))
        print(('  bucketAck:                      %s (newBucket=%s)'):format(
            tostring(lastBucketAck ~= nil), tostring(lastBucketAck and lastBucketAck.newBucket or 'unknown')))
        print(('  screenFaded:                    %s'):format(tostring(IsScreenFadedOut())))
        print(('  model:                          %s'):format(tostring(GetEntityModel(ped))))
        print(('  streamingRequests:              %d'):format(streamingReqs))
    else
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
    pcall(function() exports.sunset_core:SetBootState('SPAWNING', 'spawn started') end)
    logBoot('spawn:enter', 'spawnPlayer ENTER')

    local pos = resolvePosition(char, spawnPosition)
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
    logBoot('model:request', ('model=%s hash=%s source=%s'):format(tostring(rawModel), tostring(model), tostring(modelSource)))
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(10) end
    local modelLoadDur = GetGameTimer() - tModelStart
    recordMilestone('model_load', modelLoadDur, ('model=%s'):format(tostring(rawModel)))
    logBoot('model:loaded', ('elapsed=%dms'):format(modelLoadDur))

    local pedBefore = PlayerPedId()
    local tSetModel = GetGameTimer()
    logBoot('player_model:set_start', ('pedBefore=%d'):format(pedBefore))
    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)
    local ped = PlayerPedId()
    local setModelDur = GetGameTimer() - tSetModel
    recordMilestone('SetPlayerModel', setModelDur, ('pedBefore=%d pedAfter=%d'):format(pedBefore, ped))
    logBoot('player_model:set_end', ('elapsed=%dms pedBefore=%d pedAfter=%d'):format(setModelDur, pedBefore, ped))

    local tVarStart = GetGameTimer()
    SetPedDefaultComponentVariation(ped)
    SetEntityCollision(ped, true, true)
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

    -- Explicit routing bucket transition handshake before streaming
    prepareSpawnBucket()

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

    logBoot('character_spawned:notify_server', ('charId=%s'):format(tostring(char.id)))
    TriggerServerEvent('sunset:server:characterSpawned', char.id)

    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, false)
    DoScreenFadeIn(650)
    Wait(100)

    local tGameplayStart = GetGameTimer()
    logBoot('gameplay:enter_send', 'sending enterGameplay to sunset_ui')
    exports.sunset_ui:Send('enterGameplay', { duration = 450 })
    exports.sunset_ui:MarkGameplayEntered()
    Wait(150)
    recordMilestone('gameplay_reveal', GetGameTimer() - tGameplayStart)

    -- Post-spawn world eviction watchdog.
    -- Uses PlayerPedId() each tick (not the cached spawn-time ped) so it
    -- never acts on a stale handle.  Fires at most once.
    local safePos = pos
    CreateThread(function()
        local deadline = GetGameTimer() + 14000
        local fired = false
        while GetGameTimer() < deadline and not fired do
            Wait(250)
            local livePed = PlayerPedId()
            -- Only act if the live ped is valid and we are post-spawn.
            if not DoesEntityExist(livePed) or GetEntityModel(livePed) == 0 then
                -- Ped is transitioning or invalid; skip this tick.
                goto continue
            end
            local current = GetEntityCoords(livePed)
            -- Ignore 0,0,0 — that is a stale/uninitialized state, not a real unsafe position.
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
    logBoot('spawn:complete', ('spawnPlayer EXIT total elapsed=%dms'):format(totalSpawnElapsed))

    TriggerEvent('sunset:client:characterFlowComplete')
    TriggerEvent('sunset:client:playerSpawned', char)
end

AddEventHandler('sunset:client:gameplayVisible', function()
    pcall(function() exports.sunset_core:SetBootState('GAMEPLAY', 'transition hidden') end)
end)

AddEventHandler('sunset:client:spawnCharacter', function(char, spawnPosition)
    CreateThread(function()
        spawnPlayer(char, spawnPosition)
    end)
end)

local function resumeIfAlreadySpawned()
    local char = exports.sunset_core:GetCharacter()
    if char and char.id then
        spawned = true
        local ped = PlayerPedId()
        SetEntityVisible(ped, true, false)
        FreezeEntityPosition(ped, false)
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
