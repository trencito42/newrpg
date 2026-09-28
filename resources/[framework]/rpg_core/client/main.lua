local protected = true

-- Protection & Input loop
CreateThread(function()
    while true do
        if protected then
            DisableAllControlActions(0)
            HideHudAndRadarThisFrame()
            Wait(0)
        else
            Wait(250)
        end
    end
end)

-- Game Environment / Anti-Wanted / Dispatch / Density Controller
CreateThread(function()
    -- Initial dispatch shutdown
    for serviceId = 1, 15 do
        EnableDispatchService(serviceId, false)
    end
    SetMaxWantedLevel(0)
    SetCreateRandomCops(false)
    SetCreateRandomCopsNotOnScenarios(false)
    SetCreateRandomCopsOnScenarios(false)
    SetAudioFlag('DisableFlightMusic', true)

    while true do
        Wait(0)
        local playerId = PlayerId()

        -- Clear GTA V singleplayer wanted system
        if GetPlayerWantedLevel(playerId) ~= 0 then
            ClearPlayerWantedLevel(playerId)
            SetPlayerWantedLevelNoDrop(playerId, 0, false)
            SetPlayerWantedLevelNow(playerId, false)
        end

        SetPoliceIgnorePlayer(playerId, true)
        SetDispatchCopsForPlayer(playerId, false)

        -- Ambient traffic & ped density multiplier (keeps streets alive without singleplayer chaos)
        SetPedDensityMultiplierThisFrame(0.5)
        SetScenarioPedDensityMultiplierThisFrame(0.5, 0.5)
        SetVehicleDensityMultiplierThisFrame(0.4)
        SetRandomVehicleDensityMultiplierThisFrame(0.4)
        SetParkedVehicleDensityMultiplierThisFrame(0.4)

        -- Prevent singleplayer AFK idle cinematic camera takeover
        InvalidateIdleCam()
        InvalidateVehicleIdleCam()
    end
end)

RegisterNetEvent('rpg:core:releaseProtection', function()
    protected = false
    local ped = PlayerPedId()
    if ped and ped ~= 0 then
        FreezeEntityPosition(ped, false)
        SetEntityVisible(ped, true, false)
        SetEntityInvincible(ped, false)
        SetFocusEntity(ped)
    end
    TriggerScreenblurFadeOut(0)
    ClearTimecycleModifier()
    ClearExtraTimecycleModifier()
    DisplayRadar(true)
    DisplayHud(true)
end)

RegisterNetEvent('rpg:core:restoreProtection', function()
    protected = true
    local ped = PlayerPedId()
    if ped and ped ~= 0 then
        FreezeEntityPosition(ped, true)
        SetEntityVisible(ped, false, false)
        SetEntityInvincible(ped, true)
    end
    DisplayRadar(false)
end)
