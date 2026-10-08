--[[
    Runtime handling overrides are disabled — stock GTA / pack handling.meta only.
    Exports remain for backward compatibility and return without mutating entities.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

SVD.appliedEntities = SVD.appliedEntities or {}

function SVD.ApplyHandling(_veh, _profile)
    return false
end

function SVD.FinalizeBaselineNatives(_veh, _handling)
    return false
end

function SVD.ApplyVehicleDynamics(_veh, _force)
    return false
end

exports('ApplyVehicleDynamics', function(veh, force)
    return SVD.ApplyVehicleDynamics(veh, force)
end)
