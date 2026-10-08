--[[
    Read-only live handling snapshot for optional diagnostics.
    Does not apply canonical profiles or cached generated baselines.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

local function readLiveHandlingBaseline(veh)
    if not veh or not DoesEntityExist(veh) then return nil end
    local baseline = {}
    for _, prop in ipairs(SunsetVehicleDynamics.Config.HandledProperties) do
        if prop.type == 'float' then
            baseline[prop.name] = GetVehicleHandlingFloat(veh, 'CHandlingData', prop.name)
        elseif prop.type == 'vector' then
            local vec = GetVehicleHandlingVector(veh, 'CHandlingData', prop.name)
            baseline[prop.name] = { x = vec.x, y = vec.y, z = vec.z }
        elseif prop.type == 'int' then
            baseline[prop.name] = GetVehicleHandlingInt(veh, 'CHandlingData', prop.name)
        end
    end
    return baseline
end

function SVD.GetCanonicalBaseline(_modelHash, veh)
    return readLiveHandlingBaseline(veh)
end

exports('GetCanonicalBaseline', function(modelHash, veh)
    return SVD.GetCanonicalBaseline(modelHash, veh)
end)

exports('GetVehicleDynamicsProfile', function(modelHash, veh)
    local classId = (veh and DoesEntityExist(veh) and GetVehicleClass(veh)) or 0
    return SunsetVehicleDynamics.Resolve(modelHash, classId)
end)

exports('IsVehicleManaged', function(_veh)
    return false
end)

exports('UsesNativeDonorHandling', function(_modelHash, _veh)
    return true
end)
