-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Job Route Store (server/route_store.lua)
--  Canonical server-authoritative persistence and in-memory cache
--  for authored job routes (Trucker, Garbage, and future jobs).
--  Production gameplay remains fully functional even when devtools is disabled.
-- ═══════════════════════════════════════════════════════════════

SunsetJobRoutes = SunsetJobRoutes or {}

local ROUTE_DATA_PATH = 'data/job_routes.json'
local ROUTE_BACKUP_PATH = 'data/job_routes.json.bak'
local CURRENT_SCHEMA_VERSION = 1

local Cache = {
    trucker = {},
    garbage = {},
}

-- ═══════════════════════════════════════════════════════════════
--  Normalization & Validation Helpers
-- ═══════════════════════════════════════════════════════════════

local function toVec3(t)
    if not t then return vector3(0.0, 0.0, 0.0) end
    if type(t) == 'vector3' or type(t) == 'vector4' then
        return vector3(t.x, t.y, t.z)
    end
    if type(t) == 'table' then
        return vector3(tonumber(t.x) or 0.0, tonumber(t.y) or 0.0, tonumber(t.z) or 0.0)
    end
    return vector3(0.0, 0.0, 0.0)
end

local function toVec4(t)
    if not t then return vector4(0.0, 0.0, 0.0, 0.0) end
    if type(t) == 'vector4' then return t end
    if type(t) == 'vector3' then return vector4(t.x, t.y, t.z, 0.0) end
    if type(t) == 'table' then
        return vector4(
            tonumber(t.x) or 0.0,
            tonumber(t.y) or 0.0,
            tonumber(t.z) or 0.0,
            tonumber(t.h or t.w or t.heading) or 0.0
        )
    end
    return vector4(0.0, 0.0, 0.0, 0.0)
end

local function normalizeTruckerRoute(raw, index)
    if type(raw) ~= 'table' then return nil end
    local id = raw.id and tostring(raw.id):gsub('[^%w_%-]', '') or ('trucker_route_%d'):format(index or 1)
    if id == '' then id = ('trucker_route_%d'):format(index or 1) end

    local pickupV4 = toVec4(raw.pickup or raw.trailerSpawn)
    local delivV4 = toVec4(raw.delivery)
    local bayV4 = toVec4(raw.parkingBay or raw.delivery)

    return {
        id         = id,
        label      = tostring(raw.label or ('Trucker Route ' .. id)):sub(1, 100),
        category   = tostring(raw.category or 'fuel'):sub(1, 50),
        pay        = math.max(50, math.min(100000, math.floor(tonumber(raw.pay) or 500))),
        pickup     = { x = pickupV4.x, y = pickupV4.y, z = pickupV4.z, h = pickupV4.w, w = pickupV4.w },
        delivery   = { x = delivV4.x, y = delivV4.y, z = delivV4.z, h = delivV4.w, w = delivV4.w },
        parkingBay = { x = bayV4.x, y = bayV4.y, z = bayV4.z, h = bayV4.w, w = bayV4.w },
    }
end

local function normalizeGarbageRoute(raw, index)
    if type(raw) ~= 'table' then return nil end
    local id = raw.id and tostring(raw.id):gsub('[^%w_%-]', '') or ('garbage_route_%d'):format(index or 1)
    if id == '' then id = ('garbage_route_%d'):format(index or 1) end

    local bins = {}
    if type(raw.bins) == 'table' then
        for bIdx, b in ipairs(raw.bins) do
            local v = toVec3(b)
            if v.x ~= 0.0 or v.y ~= 0.0 or v.z ~= 0.0 then
                bins[#bins + 1] = { x = v.x, y = v.y, z = v.z }
            end
        end
    end

    return {
        id    = id,
        label = tostring(raw.label or ('Garbage Route ' .. id)):sub(1, 100),
        bins  = bins,
    }
end

-- ═══════════════════════════════════════════════════════════════
--  Load & Parse
-- ═══════════════════════════════════════════════════════════════

function SunsetJobRoutes.Load()
    local resourceName = GetCurrentResourceName()
    local raw = LoadResourceFile(resourceName, ROUTE_DATA_PATH)
    if not raw or raw == '' then
        print(('^3[sunset_jobs:route_store]^7 No %s found. Loading fallback routes from jobs_config.lua.^7'):format(ROUTE_DATA_PATH))
        SunsetJobRoutes.LoadFallback()
        return true
    end

    local ok, parsed = pcall(json.decode, raw)
    if not ok or type(parsed) ~= 'table' then
        print(('^1[sunset_jobs:route_store] ERROR: Failed to parse %s: %s. Preserving existing cache.^7'):format(ROUTE_DATA_PATH, tostring(parsed)))
        return false
    end

    local truckerList = {}
    if type(parsed.trucker) == 'table' then
        for i, r in ipairs(parsed.trucker) do
            local normalized = normalizeTruckerRoute(r, i)
            if normalized then truckerList[#truckerList + 1] = normalized end
        end
    end

    local garbageList = {}
    if type(parsed.garbage) == 'table' then
        for i, r in ipairs(parsed.garbage) do
            local normalized = normalizeGarbageRoute(r, i)
            if normalized then garbageList[#garbageList + 1] = normalized end
        end
    end

    Cache.trucker = truckerList
    Cache.garbage = garbageList

    print(('^2[sunset_jobs:route_store]^7 Loaded %d trucker routes, %d garbage routes from canonical store.^7'):format(#Cache.trucker, #Cache.garbage))
    return true
end

function SunsetJobRoutes.LoadFallback()
    -- Fallback from jobs_config if json is completely missing on first boot
    local cfg = Sunset.JobsConfig or {}
    local truckerCfg = cfg.trucker or {}
    local truckerRoutes = {}
    if truckerCfg.routes then
        for i, r in ipairs(truckerCfg.routes) do
            local norm = normalizeTruckerRoute(r, i)
            if norm then truckerRoutes[#truckerRoutes + 1] = norm end
        end
    end
    Cache.trucker = truckerRoutes

    local garbageCfg = cfg.garbage or {}
    local garbageRoutes = {}
    if garbageCfg.bins then
        local bins = {}
        for _, b in ipairs(garbageCfg.bins) do
            local v = toVec3(b)
            bins[#bins + 1] = { x = v.x, y = v.y, z = v.z }
        end
        garbageRoutes[1] = {
            id = 'legacy_south_ls',
            label = 'South Los Santos Loop',
            bins = bins,
        }
    end
    Cache.garbage = garbageRoutes
end

-- ═══════════════════════════════════════════════════════════════
--  Getters & Snapshot APIs
-- ═══════════════════════════════════════════════════════════════

function SunsetJobRoutes.GetRoutes(jobName)
    jobName = tostring(jobName or ''):lower()
    return Cache[jobName] or {}
end

function SunsetJobRoutes.GetRouteById(jobName, routeId)
    jobName = tostring(jobName or ''):lower()
    local list = Cache[jobName] or {}
    for _, r in ipairs(list) do
        if r.id == routeId then
            return r
        end
    end
    return nil
end

-- ═══════════════════════════════════════════════════════════════
--  Save & Persistence
-- ═══════════════════════════════════════════════════════════════

function SunsetJobRoutes.SaveJobRoutes(jobName, routesList)
    jobName = tostring(jobName or ''):lower()
    if type(routesList) ~= 'table' then
        return false, 'Invalid routes payload'
    end

    local normalizedList = {}
    local seenIds = {}

    if jobName == 'trucker' then
        for i, r in ipairs(routesList) do
            local norm = normalizeTruckerRoute(r, i)
            if not norm then return false, ('Malformed trucker route at index %d'):format(i) end
            if seenIds[norm.id] then return false, ('Duplicate route ID: %s'):format(norm.id) end
            seenIds[norm.id] = true
            normalizedList[#normalizedList + 1] = norm
        end
    elseif jobName == 'garbage' then
        for i, r in ipairs(routesList) do
            local norm = normalizeGarbageRoute(r, i)
            if not norm then return false, ('Malformed garbage route at index %d'):format(i) end
            if seenIds[norm.id] then return false, ('Duplicate route ID: %s'):format(norm.id) end
            seenIds[norm.id] = true
            normalizedList[#normalizedList + 1] = norm
        end
    else
        return false, 'Unsupported job name: ' .. tostring(jobName)
    end

    -- Update Cache
    Cache[jobName] = normalizedList

    -- Assemble full data payload for persistence
    local fullPayload = {
        schemaVersion = CURRENT_SCHEMA_VERSION,
        trucker = Cache.trucker,
        garbage = Cache.garbage,
    }

    local resourceName = GetCurrentResourceName()
    local serialized = json.encode(fullPayload, { indent = true })

    -- 1. Create safety backup
    local currentDisk = LoadResourceFile(resourceName, ROUTE_DATA_PATH)
    if currentDisk and currentDisk ~= '' then
        SaveResourceFile(resourceName, ROUTE_BACKUP_PATH, currentDisk, -1)
    end

    -- 2. Write new canonical file
    local written = SaveResourceFile(resourceName, ROUTE_DATA_PATH, serialized, -1)
    if not written then
        print(('^1[sunset_jobs:route_store] ERROR: SaveResourceFile failed for %s^7'):format(ROUTE_DATA_PATH))
        return false, 'Failed to write file to disk'
    end

    print(('^2[sunset_jobs:route_store] Successfully saved %d %s routes to %s.^7'):format(#normalizedList, jobName, ROUTE_DATA_PATH))
    TriggerClientEvent('sunset:jobs:routesReloaded', -1, jobName)
    return true
end

-- ═══════════════════════════════════════════════════════════════
--  Exports
-- ═══════════════════════════════════════════════════════════════

exports('GetRoutes', function(jobName)
    return SunsetJobRoutes.GetRoutes(jobName)
end)

exports('GetRouteById', function(jobName, routeId)
    return SunsetJobRoutes.GetRouteById(jobName, routeId)
end)

exports('SaveRoutes', function(jobName, routesList)
    return SunsetJobRoutes.SaveJobRoutes(jobName, routesList)
end)

exports('ReloadRoutes', function()
    return SunsetJobRoutes.Load()
end)

-- Initial Load
CreateThread(function()
    SunsetJobRoutes.Load()
end)
