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
    if not modelName or type(data) ~= 'table' then return false end
    local cleanName = string.lower(string.gsub(modelName, '^%s*(.-)%s*$', '%1'))
    if cleanName == '' then return false end
    if SunsetVehicleDynamics.Profiles[cleanName] then
        print(string.format('^1[vehicle_dynamics] Duplicate profile rejected: %s (%s)^7', cleanName, sourceGroup or 'custom'))
        return false
    end

    local hash = joaat(cleanName)
    if hashLookup[hash] and hashLookup[hash] ~= cleanName then
        print(string.format('^1[vehicle_dynamics] Model hash collision rejected: %s conflicts with %s^7', cleanName, hashLookup[hash]))
        return false
    end

    data.model = cleanName
    data.sourceGroup = sourceGroup or 'custom'
    SunsetVehicleDynamics.Profiles[cleanName] = data
    hashLookup[hash] = cleanName

    -- Invalidate resolver cache if resolver already loaded
    if SunsetVehicleDynamics.InvalidateCache then
        SunsetVehicleDynamics.InvalidateCache(cleanName, hash)
    end
    return true
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
