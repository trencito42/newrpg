local resolved = {}
local entityCache = {}
local hashModels = {}
local unresolved = {}
local catalogVersion = -1

local function catalog()
    local bundle = GlobalState.sunsetVehicleCatalog or {}
    local version = tonumber(bundle.version) or 0
    if version ~= catalogVersion then
        resolved = {}
        entityCache = {}
        hashModels = {}
        for model in pairs(SunsetVehicleNames.Addons) do hashModels[joaat(model)] = model end
        for model in pairs(bundle.entries or {}) do hashModels[joaat(model)] = model end
        catalogVersion = version
    end
    return bundle.entries or {}
end

local function isTechnicalLabel(value, technicalName)
    if not SunsetVehicleNames.Valid(value) then return true end
    local clean = value:match('^%s*(.-)%s*$')
    if technicalName and technicalName ~= '' and clean:lower() == technicalName:lower() then return true end
    if clean:match('^[A-Z0-9_]+$') and clean:find('_', 1, true) then return true end
    return false
end

local function gtaName(hash, technicalName)
    if not hash or hash == 0 then return nil end
    local gameName = GetDisplayNameFromVehicleModel(hash)
    if not SunsetVehicleNames.Valid(gameName) then return nil end

    local label = GetLabelText(gameName)
    if SunsetVehicleNames.Valid(label) and not isTechnicalLabel(label, technicalName) then
        return label
    end

    -- Third-party packs often put a human-readable literal in <gameName>
    -- without shipping a matching GXT/text entry. Use that literal only when
    -- it is clearly different from the technical spawn/model id.
    if not isTechnicalLabel(gameName, technicalName) then
        return gameName
    end

    return nil
end

local function registerAddonNativeLabels()
    for model, metadata in pairs(SunsetVehicleNames.Addons or {}) do
        if metadata and SunsetVehicleNames.Valid(metadata.label) then
            -- Covers packs whose <gameName> is literally the spawn code.
            AddTextEntry(model, metadata.label)

            -- Covers packs whose <gameName> is a separate unregistered label.
            local gameName = GetDisplayNameFromVehicleModel(joaat(model))
            if SunsetVehicleNames.Valid(gameName) then
                AddTextEntry(gameName, metadata.label)
            end
        end
    end
end

local function scheduleAddonNativeLabels()
    SetTimeout(250, registerAddonNativeLabels)
end

CreateThread(function()
    -- Let streamed vehicle metas register first, then make our curated labels
    -- authoritative over raw pack entries such as `tolm5cs22 -> tolm5cs22`.
    Wait(1000)
    registerAddonNativeLabels()
end)

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName == GetCurrentResourceName()
        or resourceName == 'pitd_tol_car_pack_a'
        or resourceName == 'showcasecars'
        or resourceName == 'showcasecars2' then
        scheduleAddonNativeLabels()
    end
end)

local function displayName(modelOrVehicle)
    local model, hash, fleetLabel
    local entries = catalog()
    if type(modelOrVehicle) == 'number' and DoesEntityExist(modelOrVehicle) and IsEntityAVehicle(modelOrVehicle) then
        hash = GetEntityModel(modelOrVehicle)
        fleetLabel = Entity(modelOrVehicle).state.sunsetVehicleDisplayName
        local cached = entityCache[modelOrVehicle]
        if cached and cached.hash == hash and cached.fleetLabel == fleetLabel then return cached.name end
        model = GetEntityArchetypeName(modelOrVehicle)
        if not model or model == '' then model = hashModels[hash] end
    elseif type(modelOrVehicle) == 'string' then
        model = modelOrVehicle
        hash = joaat(modelOrVehicle)
    elseif type(modelOrVehicle) == 'number' then
        hash = modelOrVehicle
        model = hashModels[hash]
    else
        return 'Vehicle'
    end

    local key = SunsetVehicleNames.Key(model)
    local explicit = entries[key]
    if explicit and SunsetVehicleNames.Valid(explicit.label) then
        if type(modelOrVehicle) == 'number' then entityCache[modelOrVehicle] = { hash = hash, fleetLabel = fleetLabel, name = explicit.label } end
        return explicit.label
    end
    if SunsetVehicleNames.Valid(fleetLabel) then
        entityCache[modelOrVehicle] = { hash = hash, fleetLabel = fleetLabel, name = fleetLabel }
        return fleetLabel
    end
    explicit = SunsetVehicleNames.Addons[key]
    if explicit and SunsetVehicleNames.Valid(explicit.label) then
        if type(modelOrVehicle) == 'number' then entityCache[modelOrVehicle] = { hash = hash, fleetLabel = fleetLabel, name = explicit.label } end
        return explicit.label
    end
    local cacheKey = key ~= '' and key or tostring(hash)
    if resolved[cacheKey] then return resolved[cacheKey] end
    local nativeName = gtaName(hash, key)
    local name = nativeName or SunsetVehicleNames.Fallback(model)
    if not nativeName and key ~= '' and not unresolved[key] then
        unresolved[key] = true
        if GetConvarInt('sunset_dev', 0) == 1 then
            print(('[sunset_vehicles] missing friendly vehicle label for model=%s'):format(key))
        end
    end
    resolved[cacheKey] = name
    if type(modelOrVehicle) == 'number' then entityCache[modelOrVehicle] = { hash = hash, fleetLabel = fleetLabel, name = name } end
    return name
end

exports('GetVehicleDisplayName', displayName)
exports('GetUnresolvedVehicleNames', function() return unresolved end)
