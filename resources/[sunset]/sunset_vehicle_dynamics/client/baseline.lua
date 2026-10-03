--[[
    Sunset Vehicle Dynamics - Client Baseline
    Provides canonical realistic handling baselines to external resources (e.g. sunset_tuning).
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient
local baselineModelCache = {}

local function copyTable(value)
    if type(value) ~= 'table' then return value end
    local result = {}
    for key, child in pairs(value) do
        result[key] = copyTable(child)
    end
    return result
end

function SVD.GetCanonicalBaseline(modelHash, veh)
    if not modelHash and veh and DoesEntityExist(veh) then
        modelHash = GetEntityModel(veh)
    end
    if not modelHash then return nil end

    if baselineModelCache[modelHash] then
        return copyTable(baselineModelCache[modelHash])
    end

    local classId = (veh and DoesEntityExist(veh) and GetVehicleClass(veh)) or 0
    local resolved = SunsetVehicleDynamics.Resolve(modelHash, classId)
    if not resolved then return nil end

    local baseline = {}
    local handling = resolved.handling or {}

    -- Populate handling values from the resolved profile using central HandledProperties schema
    for _, prop in ipairs(SunsetVehicleDynamics.Config.HandledProperties) do
        if handling[prop.name] ~= nil then
            baseline[prop.name] = handling[prop.name]
        end
    end

    -- Add metadata
    baseline.drivetrain = resolved.drivetrain
    baseline.category = resolved.category
    baseline.weightKg = resolved.weightKg or handling.fMass or 1500.0
    baseline.model = resolved.model
    baseline.source = resolved.source
    baseline.isFallback = resolved.isFallback == true

    baselineModelCache[modelHash] = baseline
    return copyTable(baseline)
end

-- FiveM Client Exports
exports('GetCanonicalBaseline', function(modelHash, veh)
    return SVD.GetCanonicalBaseline(modelHash, veh)
end)

exports('GetVehicleDynamicsProfile', function(modelHash, veh)
    local classId = (veh and DoesEntityExist(veh) and GetVehicleClass(veh)) or 0
    return SunsetVehicleDynamics.Resolve(modelHash, classId)
end)

exports('GetModelProfile', function(modelHash, veh)
    local classId = (veh and DoesEntityExist(veh) and GetVehicleClass(veh)) or 0
    return SunsetVehicleDynamics.Resolve(modelHash, classId)
end)

exports('IsVehicleManaged', function(veh)
    if not veh or not DoesEntityExist(veh) then return false end
    local classId = GetVehicleClass(veh)
    return not SunsetVehicleDynamics.Config.ExcludedClasses[classId]
end)
