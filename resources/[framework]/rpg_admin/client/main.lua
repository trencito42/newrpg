local frozen = false
local spectate = nil

local function controlledEntity()
    local ped = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    return vehicle ~= 0 and vehicle or ped
end

RegisterNetEvent('rpg:admin:teleport', function(position)
    if type(position) ~= 'table' then return end
    local entity = controlledEntity()
    RequestCollisionAtCoord(position.x, position.y, position.z)
    SetEntityCoordsNoOffset(entity, position.x, position.y, position.z, false, false, false)
    SetEntityHeading(entity, position.heading or 0.0)
end)

RegisterNetEvent('rpg:admin:freeze', function(value)
    frozen = value == true
    FreezeEntityPosition(controlledEntity(), frozen)
end)

RegisterNetEvent('rpg:admin:heal', function()
    local ped = PlayerPedId(); SetEntityHealth(ped, 200); SetPedArmour(ped, 100); ClearPedBloodDamage(ped)
end)

RegisterNetEvent('rpg:admin:revive', function()
    local ped = PlayerPedId(); local coords = GetEntityCoords(ped)
    NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetEntityHealth(PlayerPedId(), 200); ClearPedBloodDamage(PlayerPedId())
end)

RegisterNetEvent('rpg:admin:spectateStart', function(targetServerId)
    local deadline = GetGameTimer() + 5000
    local player = GetPlayerFromServerId(targetServerId)
    while player == -1 and GetGameTimer() < deadline do Wait(0); player = GetPlayerFromServerId(targetServerId) end
    if player == -1 then TriggerServerEvent('rpg:admin:spectateFailed') return end
    local targetPed = GetPlayerPed(player); local ownPed = PlayerPedId()
    spectate = targetServerId
    SetEntityVisible(ownPed, false, false); SetEntityInvincible(ownPed, true); FreezeEntityPosition(ownPed, true)
    NetworkSetInSpectatorMode(true, targetPed)
end)

RegisterNetEvent('rpg:admin:spectateStop', function(origin)
    local ownPed = PlayerPedId()
    NetworkSetInSpectatorMode(false, ownPed)
    SetEntityVisible(ownPed, true, false); SetEntityInvincible(ownPed, false); FreezeEntityPosition(ownPed, false)
    if type(origin) == 'table' then SetEntityCoordsNoOffset(ownPed, origin.x, origin.y, origin.z, false, false, false); SetEntityHeading(ownPed, origin.heading or 0.0) end
    spectate = nil
end)

RegisterNetEvent('rpg:chat:clear', function()
    TriggerEvent('rpg:ui:chatClear')
    TriggerEvent('rpg:ui:chatMessage', 'Chat was cleared by staff.', 'system')
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    local ped = PlayerPedId()
    if spectate then NetworkSetInSpectatorMode(false, ped) end
    FreezeEntityPosition(controlledEntity(), false); SetEntityVisible(ped, true, false); SetEntityInvincible(ped, false)
end)
