local frozen = false
local spectate = nil
local noclip = false

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

RegisterNetEvent('rpg:admin:disarm', function()
    RemoveAllPedWeapons(PlayerPedId(), true)
end)

RegisterNetEvent('rpg:admin:setHealth', function(value)
    value = tonumber(value)
    if value then SetEntityHealth(PlayerPedId(), math.max(1, math.min(200, math.floor(value)))) end
end)

RegisterNetEvent('rpg:admin:giveWeapon', function(weapon)
    if type(weapon) ~= 'string' or not weapon:match('^WEAPON_[A-Z0-9_]+$') then return end
    GiveWeaponToPed(PlayerPedId(), GetHashKey(weapon), 250, false, true)
end)

RegisterNetEvent('rpg:admin:fixVehicle', function()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if vehicle == 0 then exports.rpg_ui:Notify('You must be inside a vehicle.', 'error') return end
    SetVehicleFixed(vehicle); SetVehicleDeformationFixed(vehicle); SetVehicleEngineHealth(vehicle, 1000.0)
    SetVehicleBodyHealth(vehicle, 1000.0); SetVehiclePetrolTankHealth(vehicle, 1000.0); SetVehicleFuelLevel(vehicle, 100.0)
end)

RegisterNetEvent('rpg:admin:enterNearestVehicle', function()
    local ped = PlayerPedId(); local origin = GetEntityCoords(ped); local nearest, distance
    for _, vehicle in ipairs(GetGamePool('CVehicle')) do
        local current = #(GetEntityCoords(vehicle) - origin)
        if current <= 10.0 and (not distance or current < distance) then nearest, distance = vehicle, current end
    end
    if not nearest then exports.rpg_ui:Notify('No vehicle within 10 metres.', 'error') return end
    local seat = -1
    if not IsVehicleSeatFree(nearest, seat) then
        for index = 0, GetVehicleMaxNumberOfPassengers(nearest) - 1 do if IsVehicleSeatFree(nearest, index) then seat = index break end end
    end
    if not IsVehicleSeatFree(nearest, seat) then exports.rpg_ui:Notify('The nearest vehicle has no free seat.', 'error') return end
    TaskWarpPedIntoVehicle(ped, nearest, seat)
end)

local function noclipEntity()
    local ped = PlayerPedId(); local vehicle = GetVehiclePedIsIn(ped, false)
    return vehicle ~= 0 and vehicle or ped
end

local function stopNoclip()
    noclip = false
    local entity = noclipEntity(); FreezeEntityPosition(entity, false); SetEntityCollision(entity, true, true)
    SetEntityInvincible(PlayerPedId(), false); SetEntityVisible(PlayerPedId(), true, false)
end

RegisterNetEvent('rpg:admin:noclip', function()
    noclip = not noclip
    if not noclip then stopNoclip() return end
    CreateThread(function()
        while noclip do
            Wait(0)
            local entity = noclipEntity(); local coords = GetEntityCoords(entity); local rotation = GetGameplayCamRot(2)
            local yaw, pitch = math.rad(rotation.z), math.rad(rotation.x)
            local forward = vector3(-math.sin(yaw) * math.cos(pitch), math.cos(yaw) * math.cos(pitch), math.sin(pitch))
            local right = vector3(math.cos(yaw), math.sin(yaw), 0.0)
            local speed = IsControlPressed(0, 21) and 2.5 or 0.65
            if IsControlPressed(0, 32) then coords = coords + forward * speed end
            if IsControlPressed(0, 33) then coords = coords - forward * speed end
            if IsControlPressed(0, 34) then coords = coords - right * speed end
            if IsControlPressed(0, 35) then coords = coords + right * speed end
            if IsControlPressed(0, 22) then coords = coords + vector3(0.0, 0.0, speed) end
            if IsControlPressed(0, 36) then coords = coords - vector3(0.0, 0.0, speed) end
            FreezeEntityPosition(entity, true); SetEntityCollision(entity, false, false); SetEntityInvincible(PlayerPedId(), true)
            SetEntityCoordsNoOffset(entity, coords.x, coords.y, coords.z, true, true, true); SetEntityHeading(entity, rotation.z)
        end
    end)
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    local ped = PlayerPedId()
    if spectate then NetworkSetInSpectatorMode(false, ped) end
    if noclip then stopNoclip() end
    FreezeEntityPosition(controlledEntity(), false); SetEntityVisible(ped, true, false); SetEntityInvincible(ped, false)
end)
