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

        SetEntityCoordsNoOffset(ped, scene.target.x, scene.target.y, scene.target.z, false, false, false)
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

local function performSpawn(overrideCoords)
    local payload, err = exports.rpg_core:Await('spawn.prepare')
    if not payload then
        notify(err or 'Spawn preparation failed.')
        TriggerEvent('rpg:core:releaseProtection')
        DoScreenFadeIn(500)
        return false
    end
    local model = GetHashKey(payload.model)
    if not IsModelInCdimage(model) or not IsModelValid(model) then
        notify('Your configured player model is invalid.')
        TriggerEvent('rpg:core:releaseProtection')
        DoScreenFadeIn(500)
        return false
    end
    RequestModel(model)
    if not waitUntil(function() return HasModelLoaded(model) end, RPGSpawn.modelTimeoutMs) then
        SetModelAsNoLongerNeeded(model)
        notify('The player model could not be loaded. Reconnect to retry.')
        TriggerEvent('rpg:core:releaseProtection')
        DoScreenFadeIn(500)
        return false
    end

    DoScreenFadeOut(200)
    Wait(250)

    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)
    local ped = PlayerPedId()
    SetEntityVisible(ped, true, false)
    SetEntityInvincible(ped, false)
    FreezeEntityPosition(ped, false)

    local targetPos = overrideCoords or payload.spawn
    RequestCollisionAtCoord(targetPos.x, targetPos.y, targetPos.z)
    SetEntityCoordsNoOffset(ped, targetPos.x, targetPos.y, targetPos.z + 0.5, false, false, false)
    SetEntityHeading(ped, targetPos.heading or 0.0)
    NetworkResurrectLocalPlayer(targetPos.x, targetPos.y, targetPos.z + 0.5, targetPos.heading or 0.0, true, true, false)
    ClearPedTasksImmediately(ped)
    SetEntityHealth(ped, 200)
    ClearPedBloodDamage(ped)

    ped = PlayerPedId()
    SetEntityVisible(ped, true, false)
    SetEntityInvincible(ped, false)
    FreezeEntityPosition(ped, false)

    local collisionDeadline = GetGameTimer() + 3000
    while not HasCollisionLoadedAroundEntity(ped) and GetGameTimer() < collisionDeadline do
        RequestCollisionAtCoord(targetPos.x, targetPos.y, targetPos.z)
        Wait(50)
    end

    RenderScriptCams(false, false, 0, true, false)
    DestroyAllCams(true)
    ClearFocus()
    SetFocusEntity(ped)

    local active, activeError = exports.rpg_core:Await('spawn.activate')
    if not active then
        notify(activeError or 'Spawn activation warning.', 'warning')
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

    -- Hospital Respawn
    DoScreenFadeOut(800)
    Wait(900)

    local hospital = RPGSpawn.hospital or RPGSpawn.airport
    RequestCollisionAtCoord(hospital.x, hospital.y, hospital.z)
    NetworkResurrectLocalPlayer(hospital.x, hospital.y, hospital.z, hospital.heading or 0.0, true, true, false)
    
    local newPed = PlayerPedId()
    ClearPedTasksImmediately(newPed)
    SetEntityHealth(newPed, 200)
    ClearPedBloodDamage(newPed)
    SetEntityCoordsNoOffset(newPed, hospital.x, hospital.y, hospital.z, false, false, false)
    SetEntityHeading(newPed, hospital.heading or 0.0)

    Wait(300)
    DoScreenFadeIn(800)
    exports.rpg_ui:Notify('You have been discharged from Pillbox Hill Medical Center.', 'info', 4000)
    isDead = false
end

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
    if not profile.tutorialCompleted then
        local onboardingSession, err = exports.rpg_core:Await('spawn.beginOnboarding')
        if not onboardingSession then notify(err or 'Onboarding could not start.') spawning = false return end
        runCinematic()
        local completed, completeError = exports.rpg_core:Await('spawn.completeOnboarding', onboardingSession.token)
        if not completed then notify(completeError or 'Onboarding progress could not be saved.') spawning = false return end
    end
    performSpawn()
    spawning = false
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    RenderScriptCams(false, false, 0, true, false)
    DestroyAllCams(true)
end)

RegisterNetEvent('rpg:spawn:adminRespawn', function()
    if spawning then return end
    spawning = true
    TriggerEvent('rpg:core:restoreProtection')
    performSpawn(RPGSpawn.hospital)
    spawning = false
end)
