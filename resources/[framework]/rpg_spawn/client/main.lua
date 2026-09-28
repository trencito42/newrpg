local spawning = false

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
    for _, scene in ipairs(RPGSpawn.scenes) do
        local camera = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
        SetCamCoord(camera, scene.camera.x, scene.camera.y, scene.camera.z)
        PointCamAtCoord(camera, scene.target.x, scene.target.y, scene.target.z)
        SetCamFov(camera, 48.0)
        SetCamActive(camera, true)
        RenderScriptCams(true, true, 1000, true, false)
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
    RenderScriptCams(false, true, 1000, true, false)
    DestroyAllCams(true)
    exports.rpg_ui:Hide('cinematic')
    return true
end

local function performSpawn()
    local payload, err = exports.rpg_core:Await('spawn.prepare')
    if not payload then notify(err or 'Spawn preparation failed.') return false end
    local model = GetHashKey(payload.model)
    if not IsModelInCdimage(model) or not IsModelValid(model) then notify('Your configured player model is invalid.') return false end
    RequestModel(model)
    if not waitUntil(function() return HasModelLoaded(model) end, RPGSpawn.modelTimeoutMs) then
        SetModelAsNoLongerNeeded(model)
        notify('The player model could not be loaded. Reconnect to retry.')
        return false
    end

    DoScreenFadeOut(0)
    SetPlayerModel(PlayerId(), model)
    SetModelAsNoLongerNeeded(model)
    local ped = PlayerPedId()
    SetEntityVisible(ped, false, false)
    SetEntityInvincible(ped, true)
    FreezeEntityPosition(ped, true)
    RequestCollisionAtCoord(payload.spawn.x, payload.spawn.y, payload.spawn.z)
    SetEntityCoordsNoOffset(ped, payload.spawn.x, payload.spawn.y, payload.spawn.z, false, false, false)
    SetEntityHeading(ped, payload.spawn.heading)
    NetworkResurrectLocalPlayer(payload.spawn.x, payload.spawn.y, payload.spawn.z, payload.spawn.heading, true, false, false)
    if not waitUntil(function() return HasCollisionLoadedAroundEntity(ped) end, RPGSpawn.collisionTimeoutMs) then
        notify('World collision did not load in time. Reconnect to retry.')
        return false
    end
    local active, activeError = exports.rpg_core:Await('spawn.activate')
    if not active then notify(activeError or 'Spawn activation failed.') return false end

    FreezeEntityPosition(ped, false)
    SetEntityVisible(ped, true, false)
    SetEntityInvincible(ped, false)
    ClearPedTasksImmediately(ped)
    DisplayRadar(true)
    TriggerEvent('rpg:core:releaseProtection')
    DoScreenFadeIn(700)
    return true
end

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
    performSpawn()
    spawning = false
end)
