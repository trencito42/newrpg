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
local function resolveModel(char)
    local meta = decodeMetadata(char.metadata)
    local gender = tonumber(char.gender) or 0
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
        return false, 'INVALID_PED'
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
            return false, 'INVALID_PED'
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

    -- Model Loading (fast 1500ms deadline)
    local rawModel, modelSource = resolveModel(char)
    local model = type(rawModel) == 'string' and GetHashKey(rawModel) or rawModel
    if not IsModelInCdimage(model) or not IsModelValid(model) then
        local gender = tonumber(char.gender) or 0
        model = (gender == 1) and CIVILIAN_FEMALE or CIVILIAN_MALE
        rawModel = tostring(model)
        modelSource = 'fallback_invalid'
    end

    local tModelStart = GetGameTimer()
    RequestModel(model)
    local modelDeadline = GetGameTimer() + 1500
    while not HasModelLoaded(model) and GetGameTimer() < modelDeadline do Wait(10) end

    if not HasModelLoaded(model) then
        local gender = tonumber(char.gender) or 0
        model = (gender == 1) and CIVILIAN_FEMALE or CIVILIAN_MALE
        RequestModel(model)
        local fbDeadline = GetGameTimer() + 1000
        while not HasModelLoaded(model) and GetGameTimer() < fbDeadline do Wait(10) end
    end

    local modelLoadDur = GetGameTimer() - tModelStart
    local elapsedModel = spawnFlowTimer and (GetGameTimer() - spawnFlowTimer) or modelLoadDur
    print(('^2[LOGIN-PERF] MODEL_READY +%dms (dur=%dms) | model=%s source=%s^7'):format(
        elapsedModel, modelLoadDur, tostring(rawModel), tostring(modelSource)))

    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)

    local pedDeadline = GetGameTimer() + 1000
    while (GetEntityModel(PlayerPedId()) ~= model or not DoesEntityExist(PlayerPedId())) and GetGameTimer() < pedDeadline do
        Wait(0)
    end
    local ped = PlayerPedId()

    SetPedDefaultComponentVariation(ped)
    SetEntityCollision(ped, true, true)
    TriggerServerEvent('sunset:server:updatePlayerPed')

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
            exports.sunset_appearance:ApplyAppearance(ped, app, char.gender or 0)
        end
    end

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
