local downed = false
local dead = false
local active = false
local respawning = false
local stabilized = false

local function getPed()
    return PlayerPedId()
end

local function cfg()
    return Sunset.Death or {}
end

-- Force-close every modal UI and release NUI focus across death transitions
local function closeAllModalUi()
    pcall(function() TriggerEvent('sunset:client:inventoryForceClose') end)
    pcall(function() TriggerEvent('sunset:phone:forceClose') end)
    pcall(function() TriggerEvent('sunset:ui:forceCloseAll') end)
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function()
            exports.sunset_ui:Send('tradeHide', {})
            exports.sunset_ui:Send('ticketReceiveHide', {})
            exports.sunset_ui:Send('mdcHide', {})
            exports.sunset_ui:Send('factionPanelsHide', {})
            exports.sunset_ui:Send('clanPanelsHide', {})
            exports.sunset_ui:SetFocus(false, false)
        end)
    end
end

local function doRespawn(coords, bill)
    respawning = true
    dead = false
    downed = false
    stabilized = false
    closeAllModalUi()

    local x = coords.x or 0.0
    local y = coords.y or 0.0
    local z = coords.z or 0.0
    local heading = coords.w or coords.heading or 0.0

    if not IsScreenFadedOut() and not IsScreenFadingOut() then
        DoScreenFadeOut(400)
        Wait(500)
    else
        Wait(300)
    end

    NetworkResurrectLocalPlayer(x, y, z, heading, true, false)
    local ped = getPed()
    ClearPedTasksImmediately(ped)
    SetEntityCoordsNoOffset(ped, x, y, z, false, false, false)
    SetEntityHeading(ped, heading)
    ClearPedBloodDamage(ped)
    SetEntityInvincible(ped, false)
    SetEntityHealth(ped, 200)
    SetPedArmour(ped, 0)
    SetPlayerControl(PlayerId(), true, 0)

    Wait(400)
    DoScreenFadeIn(800)
    respawning = false

    if bill and bill > 0 then
        exports.sunset_ui:Notify(('Hospital bill: $%s'):format(bill), 'warning')
    end
end

local function doReviveInPlace()
    if respawning then return end
    local ped = getPed()
    local coords = GetEntityCoords(ped)
    downed = false
    dead = false
    stabilized = false
    doRespawn({ x = coords.x, y = coords.y, z = coords.z, w = GetEntityHeading(ped) }, 0)
end

AddEventHandler('sunset:client:playerSpawned', function()
    active = true
    dead = false
    downed = false
    stabilized = false
    respawning = false
end)

RegisterNetEvent('sunset:client:respawn', function(pos, bill)
    local spawn = pos or {}
    if not spawn.x then
        local fallback = Sunset.Config.HospitalSpawn or Sunset.Config.DefaultSpawn
        spawn = { x = fallback.x, y = fallback.y, z = fallback.z, w = fallback.w }
    end
    doRespawn(spawn, bill)
end)

RegisterNetEvent('sunset:death:forceHospital', function(pos, bill)
    local spawn = pos or {}
    if not spawn.x then
        local fallback = Sunset.Config.HospitalSpawn or Sunset.Config.DefaultSpawn
        spawn = { x = fallback.x, y = fallback.y, z = fallback.z, w = fallback.w }
    end
    doRespawn(spawn, bill or Sunset.Config.HospitalBill)
end)

RegisterNetEvent('sunset:death:reviveInPlace', function()
    doReviveInPlace()
end)

RegisterNetEvent('sunset:admin:revive', function()
    doReviveInPlace()
end)

RegisterCommand('respawn', function()
    if not dead and not IsEntityDead(getPed()) and GetEntityHealth(getPed()) > 100 then
        exports.sunset_ui:Notify('You are not dead.', 'error')
        return
    end
    TriggerServerEvent('sunset:server:requestRespawn')
end, false)

-- SA:MP RPG Death Detection Loop
CreateThread(function()
    while true do
        if active then
            local ped = getPed()
            local isDead = IsEntityDead(ped) or IsPedFatallyInjured(ped) or (GetEntityHealth(ped) <= 100 and not respawning)
            if not respawning and not dead and isDead then
                local inWar = false
                if GetResourceState('sunset_turfs') == 'started' then
                    local ok, res = pcall(function() return exports.sunset_turfs:IsInWar() end)
                    inWar = ok and res == true
                end
                if not inWar then
                    dead = true
                    closeAllModalUi()
                    DoScreenFadeOut(500)
                    TriggerServerEvent('sunset:server:playerDied')
                end
            end
            Wait(150)
        else
            Wait(1000)
        end
    end
end)

exports('IsDead', function() return dead or downed end)
exports('IsDowned', function() return downed end)
exports('IsStabilized', function() return stabilized end)
exports('ClearDead', function()
    dead = false
    downed = false
    stabilized = false
    respawning = false
end)

RegisterCommand('112', function()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    local street = GetStreetNameFromHashKey(streetHash)
    if crossingHash ~= 0 then
        street = street .. ' & ' .. GetStreetNameFromHashKey(crossingHash)
    end
    local zone = GetLabelText(GetNameOfZone(coords.x, coords.y, coords.z))
    if not zone or zone == 'NULL' or zone == '' then zone = 'Los Santos' end

    exports.sunset_ui:Send('dispatch112Show', {
        street = street,
        area = zone,
        coords = { x = coords.x, y = coords.y, z = coords.z },
    })
    exports.sunset_ui:SetFocus(true, true, false, 'dispatch112')
end, false)
