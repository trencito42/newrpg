--[[
    Sunset Vehicle Dynamics - Server Bootstrap & Verification
]]

local vanillaCount = 0
local addonCount = 0
local emergencyCount = 0
local totalCount = 0
local archetypeCount = 0

for _ in pairs(SunsetVehicleDynamics.VanillaProfiles or {}) do vanillaCount = vanillaCount + 1 end
for _ in pairs(SunsetVehicleDynamics.AddonProfiles or {}) do addonCount = addonCount + 1 end
for _ in pairs(SunsetVehicleDynamics.EmergencyProfiles or {}) do emergencyCount = emergencyCount + 1 end
for _ in pairs(SunsetVehicleDynamics.Profiles or {}) do totalCount = totalCount + 1 end
for _ in pairs(SunsetVehicleDynamics.Archetypes or {}) do archetypeCount = archetypeCount + 1 end

if totalCount == 0 then
    print('^1[sunset_vehicle_dynamics] CRITICAL ERROR: 0 vehicle profiles registered at boot! Check manifest load order.^7')
else
    print(string.format('^2[sunset_vehicle_dynamics] Initialized successfully: vanilla=%d, addon=%d, emergency=%d, total=%d, archetypes=%d^7',
        vanillaCount, addonCount, emergencyCount, totalCount, archetypeCount))
end

exports('GetVehicleDynamicsProfile', function(modelIdentifier)
    return SunsetVehicleDynamics.Resolve(modelIdentifier, nil)
end)

exports('GetModelProfile', function(modelIdentifier)
    return SunsetVehicleDynamics.Resolve(modelIdentifier, nil)
end)

local function canDiagnose(source)
    if source == 0 then return true end
    if GetResourceState('sunset_admin') ~= 'started' then return false end
    local ok, allowed = pcall(function() return exports.sunset_admin:IsAdmin(source, 2) end)
    return ok and allowed == true
end

RegisterCommand('vehphysics', function(source)
    if not canDiagnose(source) then return end
    if source > 0 then TriggerClientEvent('sunset:vehicleDynamics:diagnose', source) end
end, false)

RegisterCommand('reapplyhandling', function(source)
    if not canDiagnose(source) then return end
    if source > 0 then TriggerClientEvent('sunset:vehicleDynamics:reapply', source) end
end, false)
