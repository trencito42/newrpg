local spawning = false
local isDead = false
local revived = false

local function notify(message, kind)
    exports.rpg_ui:Notify(message, kind or 'error')
end

local function waitUntil(predicate, timeoutMs)
    local deadline = GetGameTimer() + timeoutMs
    while GetGameTimer() < deadline do
        if predicate() then return true end
        Wait(0)
    end
    return false
end

local function runCinematic()
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, true)
    SetEntityVisible(ped, false, false)
    SetEntityInvincible(ped, true)

    TriggerScreenblurFadeOut(0)
    ClearTimecycleModifier()
    ClearExtraTimecycleModifier()
    NetworkOverrideClockTime(12, 0, 0)
    SetWeatherTypeNowPersist('EXTRASUNNY')
    DoScreenFadeIn(500)

    for _, scene in ipairs(RPGSpawn.scenes) do
        local camera = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
        SetCamCoord(camera, scene.camera.x, scene.camera.y, scene.camera.z)
        PointCamAtCoord(camera, scene.target.x, scene.target.y, scene.target.z)
        SetCamFov(camera, 48.0)
        SetCamActive(camera, true)
        RenderScriptCams(true, true, 1000, true, false)

        -- Request collision and stream focus around the camera scene rather than moving the ped
        RequestCollisionAtCoord(scene.target.x, scene.target.y, scene.target.z)
        SetFocusPosAndVel(scene.camera.x, scene.camera.y, scene.camera.z, 0.0, 0.0, 0.0)

        exports.rpg_ui:Show('cinematic', {
            kicker = 'WELCOME TO', title = scene.title, description = scene.description, duration = scene.duration,
        })
        local endsAt = GetGameTimer() + scene.duration
        while GetGameTimer() < endsAt do
            DisableAllControlActions(0)
            Wait(0)
        end
        SetCamActive(camera, false)
        DestroyCam(camera, false)
    end
    ClearFocus()
    RenderScriptCams(false, true, 1000, true, false)
    DestroyAllCams(true)
    exports.rpg_ui:Hide('cinematic')
    return true
end

local function performSpawn(token, overrideCoords)
    if not token then
        notify('Spawn authorization token missing.')
        return false
    end

    local payload, err = exports.rpg_core:Await('spawn.prepare', token)
    if not payload then
        notify(err or 'Spawn preparation failed.')
        -- Keep gameplay protection intact on failure!
        return false
    end

    local model = GetHashKey(payload.model)
    if not IsModelInCdimage(model) or not IsModelValid(model) then
        notify('Your configured player model is invalid.')
        return false
    end

    RequestModel(model)
    if not waitUntil(function() return HasModelLoaded(model) end, RPGSpawn.modelTimeoutMs) then
        SetModelAsNoLongerNeeded(model)
        notify('The player model could not be loaded. Reconnect to retry.')
        return false
    end

    DoScreenFadeOut(200)
    Wait(250)

    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)
    local ped = PlayerPedId()

    local targetPos = overrideCoords or payload.spawn
    RequestCollisionAtCoord(targetPos.x, targetPos.y, targetPos.z)
    SetEntityCoordsNoOffset(ped, targetPos.x, targetPos.y, targetPos.z + 0.5, false, false, false)
    SetEntityHeading(ped, targetPos.heading or 0.0)
    NetworkResurrectLocalPlayer(targetPos.x, targetPos.y, targetPos.z + 0.5, targetPos.heading or 0.0, true, true, false)
    ClearPedTasksImmediately(ped)
    SetEntityHealth(ped, 200)
    ClearPedBloodDamage(ped)

    ped = PlayerPedId()
    local collisionDeadline = GetGameTimer() + 3000
    while not HasCollisionLoadedAroundEntity(ped) and GetGameTimer() < collisionDeadline do
        RequestCollisionAtCoord(targetPos.x, targetPos.y, targetPos.z)
        Wait(50)
    end

    RenderScriptCams(false, false, 0, true, false)
    DestroyAllCams(true)
    ClearFocus()
    SetFocusEntity(ped)

    local active, activeError = exports.rpg_core:Await('spawn.activate', token)
    if not active then
        notify(activeError or 'Spawn activation error.', 'error')
        return false
    end

    TriggerScreenblurFadeOut(0)
    ClearTimecycleModifier()
    ClearExtraTimecycleModifier()
    NetworkOverrideClockTime(12, 0, 0)
    SetWeatherTypeNowPersist('EXTRASUNNY')

    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, false)
    SetEntityInvincible(ped, false)
    ClearPedTasksImmediately(ped)
    DisplayRadar(true)
    DisplayHud(true)
    TriggerEvent('rpg:core:releaseProtection')

    DoScreenFadeIn(600)
    Wait(650)
    return true
end

local function handleDeath()
    if isDead or spawning then return end
    local ped = PlayerPedId()
    if not IsEntityDead(ped) and GetEntityHealth(ped) > 0 then return end
    
    isDead = true
    revived = false
    exports.rpg_ui:Notify('You are critically injured. Transporting to Pillbox Hill Hospital...', 'error', 5000)

    TriggerServerEvent('rpg:core:playerDied')

    -- Death loop and countdown
    local respawnAt = GetGameTimer() + (RPGSpawn.respawnDelayMs or 5000)
    while GetGameTimer() < respawnAt do
        if revived then
            isDead = false
            return
        end
        DisableAllControlActions(0)
        Wait(0)
    end

    if revived then
        isDead = false
        return
    end
end

RegisterNetEvent('rpg:spawn:readyToRespawn', function(token)
    if not isDead then return end
    spawning = true
    DoScreenFadeOut(800)
    Wait(900)

    local hospital = RPGSpawn.hospital or RPGSpawn.airport
    performSpawn(token, hospital)

    exports.rpg_ui:Notify('You have been discharged from Pillbox Hill Medical Center.', 'info', 4000)
    isDead = false
    spawning = false
end)

-- Continuous Death Monitoring Thread
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        if ped and ped ~= 0 and (IsEntityDead(ped) or GetEntityHealth(ped) <= 0 or IsPedFatallyInjured(ped)) then
            handleDeath()
        end
        Wait(250)
    end
end)

RegisterNetEvent('rpg:admin:revive', function()
    revived = true
    isDead = false
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetEntityHealth(PlayerPedId(), 200)
    ClearPedBloodDamage(PlayerPedId())
    ClearPedTasksImmediately(PlayerPedId())
    exports.rpg_ui:Notify('You have been revived by an administrator.', 'success')
end)

RegisterNetEvent('rpg:spawn:begin', function(profile)
    if spawning or type(profile) ~= 'table' then return end
    spawning = true
    TriggerEvent('rpg:core:restoreProtection')
    
    local spawnToken = nil

    if not profile.tutorialCompleted then
        local onboardingSession, err = exports.rpg_core:Await('spawn.beginOnboarding')
        if not onboardingSession then notify(err or 'Onboarding could not start.') spawning = false return end
        runCinematic()
        local completedResult, completeError = exports.rpg_core:Await('spawn.completeOnboarding', onboardingSession.token)
        if not completedResult or not completedResult.ok then
            notify(completeError or 'Onboarding progress could not be saved.')
            spawning = false
            return
        end
        spawnToken = completedResult.spawnToken
    else
        local entitlementResult, entError = exports.rpg_core:Await('spawn.requestEntitlement')
        if not entitlementResult or not entitlementResult.spawnToken then
            notify(entError or 'Spawn entitlement denied.')
            spawning = false
            return
        end
        spawnToken = entitlementResult.spawnToken
    end

    performSpawn(spawnToken)
    spawning = false
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    RenderScriptCams(false, false, 0, true, false)
    DestroyAllCams(true)
end)

RegisterNetEvent('rpg:spawn:adminRespawn', function(token)
    if spawning then return end
    spawning = true
    TriggerEvent('rpg:core:restoreProtection')
    performSpawn(token, RPGSpawn.hospital)
    spawning = false
end)
