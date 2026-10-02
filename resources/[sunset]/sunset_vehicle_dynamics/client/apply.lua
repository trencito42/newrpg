--[[
    Sunset Vehicle Dynamics - Vehicle Application Engine
    Applies the canonical baseline handling table to FiveM vehicle entities.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

SVD.appliedEntities = SVD.appliedEntities or {}

function SVD.ApplyHandling(veh, profile)
    if not veh or not DoesEntityExist(veh) then return false end
    if not profile or not profile.handling then return false end

    local handling = profile.handling

    -- Apply all configured handling properties
    for _, prop in ipairs(SunsetVehicleDynamicsConfig.HandledProperties) do
        local val = handling[prop.name]
        if val ~= nil then
            if prop.type == 'float' and type(val) == 'number' then
                SetVehicleHandlingFloat(veh, 'CHandlingData', prop.name, val + 0.0)
            elseif prop.type == 'vector' and type(val) == 'table' then
                local vec = vector3(val.x or 0.0, val.y or 0.0, val.z or 0.0)
                SetVehicleHandlingVector(veh, 'CHandlingData', prop.name, vec)
            elseif prop.type == 'int' and type(val) == 'number' then
                SetVehicleHandlingInt(veh, 'CHandlingData', prop.name, math.floor(val))
            end
        end
    end

    return true
end

function SVD.ApplyVehicleDynamics(veh, force)
    if not veh or not DoesEntityExist(veh) then return false end

    local classId = GetVehicleClass(veh)
    if SunsetVehicleDynamicsConfig.ExcludedClasses[classId] then
        return false
    end

    local modelHash = GetEntityModel(veh)
    local stateKey = string.format('%d_%d', veh, modelHash)

    if not force and SVD.appliedEntities[veh] == stateKey then
        return true -- Already applied
    end

    local profile = SunsetVehicleDynamics.Resolve(modelHash, classId)
    if not profile then return false end

    local success = SVD.ApplyHandling(veh, profile)
    if success then
        SVD.appliedEntities[veh] = stateKey
        if SunsetVehicleDynamicsConfig.Debug then
            print(string.format('^2[vehicle_dynamics] Applied baseline to veh %d (model: %s, source: %s)^7', veh, profile.model, profile.source))
        end
    end

    return success
end

exports('ApplyVehicleDynamics', function(veh, force)
    return SVD.ApplyVehicleDynamics(veh, force)
end)
