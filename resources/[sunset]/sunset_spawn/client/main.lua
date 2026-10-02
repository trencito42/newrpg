local spawned = false
local spawning = false
local spawnFlowTimer = nil
local lastSpawningCharId = nil

local function decodeMetadata(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) == 'string' then
        local ok, decoded = pcall(json.decode, raw)
        return ok and type(decoded) == 'table' and decoded or {}
    end
    return {}
end

-- Resolve the model that should be applied for login.
local function resolveModel(char)
    if Sunset.GetEffectivePlayerModel then
        return Sunset.GetEffectivePlayerModel(char)
    end
    local meta = decodeMetadata(char and char.metadata)
    local skin = meta.skin
    if skin and skin ~= '' and skin ~= 'default' and skin ~= 'reset' then
        return skin, 'meta.skin'
    end
    return (Sunset.Config and Sunset.Config.DefaultPlayerPed) or 'ig_bankman', 'default'
end

local function isValidPlayerPed(ped)
    if not DoesEntityExist(ped) then return false end
    if ped ~= PlayerPedId() then return false end
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

RegisterNetEvent('sunset:client:prepareSpawnAck', function(requestId, newBucket, oldBucket)
    if pendingPrepareAck and pendingPrepareAck.id == requestId then
        pendingPrepareAck.p:resolve({ newBucket = newBucket, oldBucket = oldBucket })
    end
end)

local function prepareSpawnBucket()
    local reqId = math.random(100000, 999999)
    local p = promise.new()
    pendingPrepareAck = { id = reqId, p = p }
    local t0 = GetGameTimer()
    TriggerServerEvent('sunset:server:prepareSpawn', reqId)

    SetTimeout(1000, function()
        if pendingPrepareAck and pendingPrepareAck.id == reqId then
            pendingPrepareAck = nil
            p:resolve(nil)
        end
    end)

    local res = Citizen.Await(p)
    pendingPrepareAck = nil
    local rtt = GetGameTimer() - t0
    local totalElapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or rtt
    local oldBucket = res and res.oldBucket or 'unknown'
    local newBucket = res and res.newBucket or '0'
    print(('^2[LOGIN-PERF] BUCKET_PREPARED +%dms (rtt=%dms) | old=%s new=%s^7'):format(
        totalElapsed, rtt, tostring(oldBucket), tostring(newBucket)))
    return true, newBucket, oldBucket, rtt
end

local function streamSpawnArea(ped, pos, isFallback, targetSource)
    local tStart = GetGameTimer()
    local sourceLabel = targetSource or (pos and pos.source) or (isFallback and 'fallback' or 'primary')

    ped = PlayerPedId()
    if not DoesEntityExist(ped) or GetEntityModel(ped) == 0 then
        return false, 'INVALID_PED' -- i18n-ignore: protocol code
    end

    SetFocusPosAndVel(pos.x, pos.y, pos.z, 0.0, 0.0, 0.0)
    RequestCollisionAtCoord(pos.x, pos.y, pos.z)
    NewLoadSceneStartSphere(pos.x, pos.y, pos.z, 50.0, 0)
    SetEntityCoordsNoOffset(ped, pos.x, pos.y, pos.z + 0.15, false, false, false)
    SetEntityHeading(ped, pos.w or 0.0)

    -- Max 1500ms collision streaming check (fast reveal, never stall player)
    local deadline = GetGameTimer() + 1500
    local loaded = false

    while GetGameTimer() < deadline do
        local currentPed = PlayerPedId()
        if not DoesEntityExist(currentPed) or GetEntityModel(currentPed) == 0 then
            NewLoadSceneStop()
            ClearFocus()
            return false, 'INVALID_PED' -- i18n-ignore: protocol code
        end
        if currentPed ~= ped then
            ped = currentPed
            SetEntityCoordsNoOffset(ped, pos.x, pos.y, pos.z + 0.15, false, false, false)
            SetEntityHeading(ped, pos.w or 0.0)
        end

        RequestCollisionAtCoord(pos.x, pos.y, pos.z)
        local hasColl = HasCollisionLoadedAroundEntity(ped)
        local waitColl = IsEntityWaitingForWorldCollision(ped)

        if hasColl and not waitColl then
            loaded = true
            break
        end
        Wait(20)
    end

    local totalElapsed = GetGameTimer() - tStart
    local fullElapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or totalElapsed

    NewLoadSceneStop()
    ClearFocus()

    print(('^2[LOGIN-PERF] COLLISION_STREAMED +%dms (dur=%dms) | loaded=%s target=%s^7'):format(
        fullElapsed, totalElapsed, tostring(loaded), sourceLabel))
    return loaded
end

local function spawnPlayer(char, spawnPosition)
    local tSpawnStart = GetGameTimer()
    spawning = true
    lastSpawningCharId = char and char.id or 'unknown'
    LocalPlayer.state:set('isSpawning', true, false)
    LocalPlayer.state:set('spawnPhase', 'SPAWNING_MODEL', false)
    pcall(function() exports.sunset_core:SetBootState('SPAWNING', 'spawn started') end)

    local pos = resolvePosition(char, spawnPosition)

    -- Model Loading
    local rawModel, modelSource = resolveModel(char)
    local model = type(rawModel) == 'string' and joaat(rawModel) or rawModel
    local defPedName = (Sunset.Config and Sunset.Config.DefaultPlayerPed) or 'ig_bankman'
    local defPedHash = joaat(defPedName)

    if not IsModelInCdimage(model) or not IsModelValid(model) then
        print(('^3[SPAWN] Model %s is invalid/missing from CD image, falling back to default %s^7'):format(tostring(rawModel), defPedName))
        model = defPedHash
        rawModel = defPedName
        modelSource = 'fallback_invalid'
    end

    local tModelStart = GetGameTimer()
    RequestModel(model)
    local modelDeadline = GetGameTimer() + 2000
    while not HasModelLoaded(model) and GetGameTimer() < modelDeadline do Wait(10) end

    if not HasModelLoaded(model) then
        print(('^1[SPAWN] Model %s failed to load within deadline, falling back to %s^7'):format(tostring(rawModel), defPedName))
        model = defPedHash
        rawModel = defPedName
        modelSource = 'fallback_timeout'
        RequestModel(model)
        local fbDeadline = GetGameTimer() + 2000
        while not HasModelLoaded(model) and GetGameTimer() < fbDeadline do Wait(10) end
    end

    local modelLoadDur = GetGameTimer() - tModelStart
    local elapsedModel = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or modelLoadDur
    print(('^2[LOGIN-PERF] MODEL_LOADED +%dms (dur=%dms) | model=%s source=%s hash=%s^7'):format(
        elapsedModel, modelLoadDur, tostring(rawModel), tostring(modelSource), tostring(model)))

    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)

    local pedDeadline = GetGameTimer() + 1500
    while (GetEntityModel(PlayerPedId()) ~= model or not DoesEntityExist(PlayerPedId())) and GetGameTimer() < pedDeadline do
        Wait(0)
    end
    local ped = PlayerPedId()
    local actualModel = GetEntityModel(ped)

    if actualModel ~= model then
        print(('^1[SPAWN CRITICAL] SetPlayerModel mismatch: expected=%s actual=%s -> retrying default ped %s^7'):format(tostring(model), tostring(actualModel), defPedName))
        RequestModel(defPedHash)
        local fbModelDeadline = GetGameTimer() + 2000
        while not HasModelLoaded(defPedHash) and GetGameTimer() < fbModelDeadline do Wait(10) end
        if not HasModelLoaded(defPedHash) then
            print(('^1[SPAWN CRITICAL] Default ped model %s also failed to load within deadline; proceeding with current ped^7'):format(defPedName))
        else
            SetPlayerModel(PlayerId(), defPedHash)
            SetModelAsNoLongerNeeded(defPedHash)
        end
        ped = PlayerPedId()
        actualModel = GetEntityModel(ped)
    end

    print(('^2[LOGIN-PERF] MODEL_APPLIED +%dms | model=%s actualHash=%s^7'):format(
        GetGameTimer() - (spawnFlowTimer or tSpawnStart), tostring(rawModel), tostring(actualModel)))

    SetPedDefaultComponentVariation(ped)
    SetEntityCollision(ped, true, true)
    TriggerServerEvent('sunset:server:updatePlayerPed')

    FreezeEntityPosition(ped, true)

    -- Routing bucket transition
    prepareSpawnBucket()

    LocalPlayer.state:set('spawnPhase', 'SPAWNING_WORLD', false)

    -- Collision streaming (max 1500ms) with live ped reacquisition
    streamSpawnArea(ped, pos, false, pos.source)

    TriggerServerEvent('sunset:server:characterSpawned', char.id)

    -- Unfreeze and reveal world immediately!
    ped = PlayerPedId()
    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, false)
    DoScreenFadeIn(300)

    local totalFlowElapsed = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or (GetGameTimer() - tSpawnStart)
    print(('^2[LOGIN-PERF] WORLD_VISIBLE +%dms | charId=%s^7'):format(totalFlowElapsed, tostring(char.id)))

    -- Notify sunset_ui to remove transition and show gameplay
    exports.sunset_ui:Send('enterGameplay', { duration = 200 })
    exports.sunset_ui:MarkGameplayEntered()
    exports.sunset_ui:HideTransition()

    spawned = true
    spawning = false
    LocalPlayer.state:set('spawnPhase', 'GAMEPLAY', false)
    LocalPlayer.state:set('isSpawning', false, false)

    TriggerEvent('sunset:client:characterFlowComplete')
    TriggerEvent('sunset:client:playerSpawned', char)
    spawnFlowTimer = nil
end

AddEventHandler('sunset:client:gameplayVisible', function()
    pcall(function() exports.sunset_core:SetBootState('GAMEPLAY', 'transition hidden') end)
end)

AddEventHandler('sunset:client:spawnCharacter', function(char, spawnPosition)
    if not spawnFlowTimer then spawnFlowTimer = GetGameTimer() end
    local charId = char and char.id or 'unknown'

    if spawning then
        return
    end
    spawning = true
    CreateThread(function()
        local ok, err = pcall(spawnPlayer, char, spawnPosition)
        if not ok then
            print(('^1[SPAWN CRITICAL]^7 spawnPlayer error: %s -> releasing player'):format(tostring(err)))
            local livePed = PlayerPedId()
            FreezeEntityPosition(livePed, false)
            SetEntityVisible(livePed, true, false)
            DoScreenFadeIn(300)
            spawning = false
            spawned = true
            LocalPlayer.state:set('spawnPhase', 'GAMEPLAY', false)
            LocalPlayer.state:set('isSpawning', false, false)
            pcall(function() exports.sunset_ui:Send('enterGameplay', { duration = 200 }) end)
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
        spawning = false
        LocalPlayer.state:set('spawnPhase', 'GAMEPLAY', false)
        LocalPlayer.state:set('isSpawning', false, false)
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

-- [RESTART SAFETY] Stopping mid-spawn must not leave a frozen/invisible ped, a
-- black screen, or an orphan load-scene/focus. (A restart re-freezes via onResourceStart
-- if the player has no character yet, or resumes if they already spawned.)
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    pcall(NewLoadSceneStop)
    pcall(ClearFocus)
    if spawning or spawned then
        local ped = PlayerPedId()
        SetEntityVisible(ped, true, false)
        FreezeEntityPosition(ped, false)
        SetEntityInvincible(ped, false)
        if IsScreenFadedOut() and not IsScreenFadingIn() then DoScreenFadeIn(300) end
    end
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
