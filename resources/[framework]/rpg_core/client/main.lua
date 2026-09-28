local protected = true

CreateThread(function()
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, true)
    SetEntityVisible(ped, false, false)
    SetEntityInvincible(ped, true)
    DisplayRadar(false)
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

RegisterNetEvent('rpg:core:releaseProtection', function()
    protected = false
end)

RegisterNetEvent('rpg:core:restoreProtection', function()
    protected = true
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, true)
    SetEntityVisible(ped, false, false)
    SetEntityInvincible(ped, true)
    DisplayRadar(false)
end)
