--[[
    Sunset Vehicle Dynamics - Profile Registry
    Central storage and registration methods for model handling profiles.
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}
SunsetVehicleDynamics.Profiles = SunsetVehicleDynamics.Profiles or {}
SunsetVehicleDynamics.VanillaProfiles = SunsetVehicleDynamics.VanillaProfiles or {}
SunsetVehicleDynamics.AddonProfiles = SunsetVehicleDynamics.AddonProfiles or {}
SunsetVehicleDynamics.EmergencyProfiles = SunsetVehicleDynamics.EmergencyProfiles or {}

local hashLookup = {}

function SunsetVehicleDynamics.RegisterProfile(modelName, data, sourceGroup)
    if not modelName or type(data) ~= 'table' then return end
    local cleanName = string.lower(string.gsub(modelName, '^%s*(.-)%s*$', '%1'))
    data.model = cleanName
    data.sourceGroup = sourceGroup or 'custom'
    SunsetVehicleDynamics.Profiles[cleanName] = data

    local hash = joaat(cleanName)
    hashLookup[hash] = cleanName

    -- Invalidate resolver cache if resolver already loaded
    if SunsetVehicleDynamics.InvalidateCache then
        SunsetVehicleDynamics.InvalidateCache(cleanName, hash)
    end
end

function SunsetVehicleDynamics.RegisterBatch(tbl, sourceGroup)
    if type(tbl) ~= 'table' then return end
    for model, data in pairs(tbl) do
        SunsetVehicleDynamics.RegisterProfile(model, data, sourceGroup)
    end
end

function SunsetVehicleDynamics.GetAllProfiles()
    return SunsetVehicleDynamics.Profiles
end

function SunsetVehicleDynamics.GetModelNameFromHash(hash)
    return hashLookup[hash]
end
