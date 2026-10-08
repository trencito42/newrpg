--[[ Legacy poison guard disabled — pack handling is authoritative. ]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

function SVD.HasLegacyAddonPoisonHandling(_veh)
    return false
end

function SVD.NotifyLegacyPoisonHandling(_veh, _modelName, _donorId)
end

exports('HasLegacyAddonPoisonHandling', function(veh)
    return SVD.HasLegacyAddonPoisonHandling(veh)
end)
