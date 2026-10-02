--[[
    Sunset Vehicle Dynamics - Server Bootstrap & Verification
]]

local profileCount = 0
for _ in pairs(SunsetVehicleDynamics.Profiles or {}) do
    profileCount = profileCount + 1
end

print(string.format('^2[sunset_vehicle_dynamics] Initialized with %d canonical vehicle profiles and %d archetypes.^7',
    profileCount, 16))

exports('GetVehicleDynamicsProfile', function(modelIdentifier)
    return SunsetVehicleDynamics.Resolve(modelIdentifier, nil)
end)

exports('GetModelProfile', function(modelIdentifier)
    return SunsetVehicleDynamics.Resolve(modelIdentifier, nil)
end)
