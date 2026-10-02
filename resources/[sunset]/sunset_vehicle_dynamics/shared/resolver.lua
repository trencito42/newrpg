--[[
    Sunset Vehicle Dynamics - Profile Resolver
    Resolves canonical handling profiles by model hash / name or fallback archetype.
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}
SunsetVehicleDynamics.Profiles = SunsetVehicleDynamics.Profiles or {}
SunsetVehicleDynamics.VanillaProfiles = SunsetVehicleDynamics.VanillaProfiles or {}
SunsetVehicleDynamics.AddonProfiles = SunsetVehicleDynamics.AddonProfiles or {}
SunsetVehicleDynamics.EmergencyProfiles = SunsetVehicleDynamics.EmergencyProfiles or {}

local resolvedCache = {}
local hashLookup = {}

local function deepCopy(orig)
    if type(orig) ~= 'table' then return orig end
    local copy = {}
    for k, v in pairs(orig) do
        copy[k] = deepCopy(v)
    end
    return copy
end

local function sanitizeValue(field, val, modelName)
    local limits = SunsetVehicleDynamicsConfig.HandlingLimits[field]
    if not limits then return val end

    if type(val) == 'number' then
        if val ~= val then -- NaN check
            print(string.format('^3[vehicle_dynamics] WARNING: NaN detected in %s for %s, using min limit^7', field, modelName or 'unknown'))
            return limits.min
        end
        if val < limits.min then
            return limits.min
        elseif val > limits.max then
            return limits.max
        end
    elseif type(val) == 'table' and limits.type == 'vector' then
        local cleaned = {}
        for _, axis in ipairs({'x', 'y', 'z'}) do
            local num = tonumber(val[axis]) or 0.0
            if num ~= num then num = 0.0 end
            if num < limits.min then num = limits.min end
            if num > limits.max then num = limits.max end
            cleaned[axis] = num
        end
        return cleaned
    end
    return val
end

local function validateAndNormalizeProfile(profile, modelName)
    if not profile or type(profile) ~= 'table' then return nil end
    local h = profile.handling or {}
    
    -- Ensure traction curve consistency: Min <= Max
    if h.fTractionCurveMin and h.fTractionCurveMax and h.fTractionCurveMin > h.fTractionCurveMax then
        h.fTractionCurveMin = h.fTractionCurveMax * 0.95
    end

    -- Sanitize all configured handling properties
    for _, prop in ipairs(SunsetVehicleDynamicsConfig.HandledProperties) do
        if h[prop.name] ~= nil then
            h[prop.name] = sanitizeValue(prop.name, h[prop.name], modelName)
        end
    end

    profile.handling = h
    return profile
end

function SunsetVehicleDynamics.RegisterProfile(modelName, data, sourceGroup)
    if not modelName or type(data) ~= 'table' then return end
    local cleanName = string.lower(string.gsub(modelName, '^%s*(.-)%s*$', '%1'))
    data.model = cleanName
    data.sourceGroup = sourceGroup or 'custom'
    SunsetVehicleDynamics.Profiles[cleanName] = data

    local hash = joaat(cleanName)
    hashLookup[hash] = cleanName
    resolvedCache[cleanName] = nil
    resolvedCache[hash] = nil
end

function SunsetVehicleDynamics.RegisterBatch(tbl, sourceGroup)
    if type(tbl) ~= 'table' then return end
    for model, data in pairs(tbl) do
        SunsetVehicleDynamics.RegisterProfile(model, data, sourceGroup)
    end
end

function SunsetVehicleDynamics.Resolve(modelIdentifier, classId)
    local modelKey = nil
    local modelHash = nil

    if type(modelIdentifier) == 'number' then
        modelHash = modelIdentifier
        modelKey = hashLookup[modelHash] or string.lower(GetDisplayNameFromVehicleModel(modelHash) or '')
    elseif type(modelIdentifier) == 'string' then
        modelKey = string.lower(string.gsub(modelIdentifier, '^%s*(.-)%s*$', '%1'))
        modelHash = joaat(modelKey)
    end

    if modelKey and resolvedCache[modelKey] then
        return resolvedCache[modelKey]
    end
    if modelHash and resolvedCache[modelHash] then
        return resolvedCache[modelHash]
    end

    -- 1. Direct explicit profile lookup
    local explicitProfile = (modelKey and SunsetVehicleDynamics.Profiles[modelKey]) or (modelHash and SunsetVehicleDynamics.Profiles[hashLookup[modelHash]])
    local resolved = nil
    local source = 'explicit'

    if explicitProfile then
        resolved = deepCopy(explicitProfile)
        -- If profile specifies archetype inheritance, merge with archetype baseline
        if resolved.archetype and SunsetVehicleDynamicsArchetypes[resolved.archetype] then
            local base = deepCopy(SunsetVehicleDynamicsArchetypes[resolved.archetype])
            local baseHandling = base.handling or {}
            local explicitHandling = resolved.handling or {}
            for k, v in pairs(explicitHandling) do
                baseHandling[k] = v
            end
            resolved.handling = baseHandling
            resolved.drivetrain = resolved.drivetrain or base.drivetrain
            resolved.category = resolved.category or base.category
            resolved.weightKg = resolved.weightKg or base.weightKg
        end
    else
        -- 2. Fallback to GTA Vehicle Class Archetype
        local fallbackArchetypeKey = SunsetVehicleDynamicsClassMapping[classId or 0] or 'sedan_rwd'
        local fallbackArch = SunsetVehicleDynamicsArchetypes[fallbackArchetypeKey] or SunsetVehicleDynamicsArchetypes['sedan_rwd']
        resolved = deepCopy(fallbackArch)
        resolved.model = modelKey or ('hash_' .. tostring(modelHash))
        resolved.isFallback = true
        source = 'fallback_' .. fallbackArchetypeKey

        if SunsetVehicleDynamicsConfig.Debug then
            print(string.format('^3[vehicle_dynamics] Missing explicit profile for %s, using fallback archetype: %s^7', resolved.model, fallbackArchetypeKey))
        end
    end

    resolved.source = source
    resolved = validateAndNormalizeProfile(resolved, resolved.model)

    if modelKey and modelKey ~= '' then
        resolvedCache[modelKey] = resolved
    end
    if modelHash then
        resolvedCache[modelHash] = resolved
    end

    return resolved
end

function SunsetVehicleDynamics.GetProfile(modelIdentifier)
    return SunsetVehicleDynamics.Resolve(modelIdentifier, nil)
end

function SunsetVehicleDynamics.GetAllProfiles()
    return SunsetVehicleDynamics.Profiles
end
