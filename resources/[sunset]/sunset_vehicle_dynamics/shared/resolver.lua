--[[
    Sunset Vehicle Dynamics - Profile Resolver
    Resolves canonical handling profiles by model hash / name or fallback archetype.
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}

local resolvedCache = {}

function SunsetVehicleDynamics.InvalidateCache(modelName, modelHash)
    if modelName then resolvedCache[modelName] = nil end
    if modelHash then resolvedCache[modelHash] = nil end
end

local function deepCopy(orig)
    if type(orig) ~= 'table' then return orig end
    local copy = {}
    for k, v in pairs(orig) do
        copy[k] = deepCopy(v)
    end
    return copy
end

local function massLimitsForProfile(profile)
    if not profile then
        return SunsetVehicleDynamics.Config.HandlingLimits.fMass
    end
    if profile.archetype == 'motorcycle_sport'
        or profile.category == 'motorcycle'
        or profile.bodyStyle == 'motorcycle' then
        return { min = 120.0, max = 450.0, default = 210.0 }
    end
    return SunsetVehicleDynamics.Config.HandlingLimits.fMass
end

local function limitsForField(field, profile)
    if field == 'fMass' then
        return massLimitsForProfile(profile)
    end
    return SunsetVehicleDynamics.Config.HandlingLimits[field]
end

local function sanitizeValue(field, val, modelName, profile)
    local limits = limitsForField(field, profile)
    if not limits then return val end

    if type(val) == 'number' then
        if val ~= val then -- NaN check
            if SunsetVehicleDynamics.Config.Debug then
                print(string.format('^3[vehicle_dynamics] WARNING: NaN detected in %s for %s, using fallback limit^7', field, modelName or 'unknown'))
            end
            return limits.default or limits.min
        end
        if limits.min and val < limits.min then
            return limits.min
        elseif limits.max and val > limits.max then
            return limits.max
        end
    elseif type(val) == 'table' and limits.type == 'vector' then
        local cleaned = {}
        for _, axis in ipairs({'x', 'y', 'z'}) do
            local num = tonumber(val[axis]) or 0.0
            if num ~= num then num = 0.0 end
            if limits.min and num < limits.min then num = limits.min end
            if limits.max and num > limits.max then num = limits.max end
            cleaned[axis] = num
        end
        return cleaned
    end
    return val
end

local function isNativeDonorProfile(profile)
    return profile and profile.handlingMode == 'native_donor'
end

local function validateAndNormalizeProfile(profile, modelName)
    if not profile or type(profile) ~= 'table' then return nil end
    if isNativeDonorProfile(profile) then
        return profile
    end
    local h = profile.handling or {}

    -- Ensure traction curve consistency: Min <= Max
    if h.fTractionCurveMin and h.fTractionCurveMax and h.fTractionCurveMin > h.fTractionCurveMax then
        h.fTractionCurveMin = h.fTractionCurveMax * 0.95
    end

    -- Sanitize all configured handling properties using central HandledProperties schema
    for _, prop in ipairs(SunsetVehicleDynamics.Config.HandledProperties) do
        if h[prop.name] ~= nil then
            h[prop.name] = sanitizeValue(prop.name, h[prop.name], modelName, profile)
        end
    end

    profile.handling = h
    return profile
end

function SunsetVehicleDynamics.Resolve(modelIdentifier, classId)
    local modelKey = nil
    local modelHash = nil

    if type(modelIdentifier) == 'number' then
        modelHash = modelIdentifier
        modelKey = SunsetVehicleDynamics.GetModelNameFromHash(modelHash)
        if not modelKey and GetDisplayNameFromVehicleModel then
            local disp = GetDisplayNameFromVehicleModel(modelHash)
            if disp then modelKey = string.lower(disp) end
        end
    elseif type(modelIdentifier) == 'string' then
        modelKey = string.lower(string.gsub(modelIdentifier, '^%s*(.-)%s*$', '%1'))
        modelHash = joaat(modelKey)
    end

    if modelKey and resolvedCache[modelKey] then
        return deepCopy(resolvedCache[modelKey])
    end
    if modelHash and resolvedCache[modelHash] then
        return deepCopy(resolvedCache[modelHash])
    end

    -- 1. Direct explicit profile lookup
    local explicitProfile = nil
    if modelKey and SunsetVehicleDynamics.Profiles[modelKey] then
        explicitProfile = SunsetVehicleDynamics.Profiles[modelKey]
    elseif modelHash then
        local foundName = SunsetVehicleDynamics.GetModelNameFromHash(modelHash)
        if foundName and SunsetVehicleDynamics.Profiles[foundName] then
            explicitProfile = SunsetVehicleDynamics.Profiles[foundName]
        end
    end

    local resolved = nil
    local source = 'explicit'

    if explicitProfile then
        resolved = deepCopy(explicitProfile)
        -- Native donor vehicles keep Rockstar handling from vehicles.meta; never merge archetype physics.
        if isNativeDonorProfile(resolved) then
            resolved.source = 'native_donor'
        elseif resolved.archetype and SunsetVehicleDynamics.Archetypes[resolved.archetype] then
            local base = deepCopy(SunsetVehicleDynamics.Archetypes[resolved.archetype])
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
        local fallbackArchetypeKey = SunsetVehicleDynamics.ClassToArchetype[classId or 0] or 'sedan_rwd'
        local fallbackArch = SunsetVehicleDynamics.Archetypes[fallbackArchetypeKey] or SunsetVehicleDynamics.Archetypes['sedan_rwd']
        resolved = deepCopy(fallbackArch)
        resolved.model = modelKey or ('hash_' .. tostring(modelHash))
        resolved.isFallback = true
        source = 'fallback_' .. fallbackArchetypeKey

        if SunsetVehicleDynamics.Config.Debug then
            print(string.format('^3[vehicle_dynamics] Missing explicit profile for %s, using fallback archetype: %s^7', resolved.model, fallbackArchetypeKey))
        end
    end

    if resolved.archetype and SunsetVehicleDynamics.Archetypes[resolved.archetype] then
        local archMeta = SunsetVehicleDynamics.Archetypes[resolved.archetype]
        resolved.category = resolved.category or archMeta.category
    end

    resolved.source = source
    resolved = validateAndNormalizeProfile(resolved, resolved.model)

    if modelKey and modelKey ~= '' then
        resolvedCache[modelKey] = resolved
    end
    if modelHash then
        resolvedCache[modelHash] = resolved
    end

    return deepCopy(resolved)
end

function SunsetVehicleDynamics.GetProfile(modelIdentifier)
    return SunsetVehicleDynamics.Resolve(modelIdentifier, nil)
end
