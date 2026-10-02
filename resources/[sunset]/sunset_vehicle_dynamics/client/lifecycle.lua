--[[
    Sunset Vehicle Dynamics - Vehicle Lifecycle Manager
    Ensures vehicles receive their canonical dynamics baseline deterministically on entry,
    stream-in, and spawn, with zero per-frame CPU overhead.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

-- Clean up cached entity tracking when entity is removed from world
AddEventHandler('entityRemoved', function(entity)
    if SVD.appliedEntities[entity] then
        SVD.appliedEntities[entity] = nil
    end
end)

-- Hook player entering a vehicle via FiveM game event
AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkPlayerEnteredVehicle' then
        local playerPed = args[1]
        local veh = args[2]
        if playerPed == PlayerPedId() and veh and DoesEntityExist(veh) then
            SVD.ApplyVehicleDynamics(veh, false)
        end
    end
end)

-- Periodic low-frequency check on the player's current vehicle and nearby vehicles
CreateThread(function()
    while true do
        Wait(2000)
        local ped = PlayerPedId()
        if IsPedInAnyVehicle(ped, false) then
            local currentVeh = GetVehiclePedIsIn(ped, false)
            if currentVeh ~= 0 and DoesEntityExist(currentVeh) then
                if not SVD.appliedEntities[currentVeh] then
                    SVD.ApplyVehicleDynamics(currentVeh, false)
                end
            end
        end
    end
end)

-- Initial sweep on resource start
CreateThread(function()
    Wait(500)
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local veh = GetVehiclePedIsIn(ped, false)
        if veh ~= 0 then
            SVD.ApplyVehicleDynamics(veh, true)
        end
    end
end)
