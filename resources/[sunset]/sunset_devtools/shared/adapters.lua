-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — shared/adapters.lua
--  Adapter registry: each adapter bridges one gameplay system to
--  the generic placement editor without coupling them.
--
--  Adapter interface (all fields optional — nil = not supported):
--    label       : string            human-readable name
--    describe()  : {key, label, type, coords}[]  list of editable fields
--    load(key)   : {coords, heading?, model?, scenario?, ...}
--    export(key, v4, extra) : string  Lua snippet ready to paste
-- ═══════════════════════════════════════════════════════════════

SunsetDevTools = SunsetDevTools or {}
SunsetDevTools.Adapters = {}

local function register(id, adapter)
    SunsetDevTools.Adapters[id] = adapter
end

-- ── Missions / NPC contacts ───────────────────────────────────

register('missions', {
    label = 'Mission Contacts',

    describe = function()
        if not SunsetMissions or not SunsetMissions.Contacts then return {} end
        local fields = {}
        for id, c in pairs(SunsetMissions.Contacts) do
            fields[#fields + 1] = {
                key    = id,
                label  = c.name or id,
                type   = 'ped',
                coords = c.coords,
                model  = c.model,
            }
        end
        table.sort(fields, function(a, b) return a.label < b.label end)
        return fields
    end,

    load = function(key)
        if not SunsetMissions or not SunsetMissions.Contacts then return nil, 'SunsetMissions.Contacts not available' end
        local c = SunsetMissions.Contacts[string.lower(key)]
        if not c then return nil, ('Unknown contact: %s'):format(key) end
        return {
            label    = c.name or key,
            subtitle = c.subtitle,
            model    = c.model,
            coords   = vector3(c.coords.x, c.coords.y, c.coords.z),
            heading  = c.coords.w or 0.0,
            scenario = c.scenario,
        }
    end,

    export = function(key, v4, _extra)
        return ('coords = vector4(%.2f, %.2f, %.2f, %.2f),  -- %s'):format(
            v4.x, v4.y, v4.z, v4.w, key)
    end,
})

-- ── Trucker job ───────────────────────────────────────────────

local TRUCKER_STAGE_KEYS = { 'spawn', 'pickup', 'delivery', 'parkingBay', 'returnCoords' }
local TRUCKER_STAGE_LABELS = {
    spawn        = 'Truck Spawn',
    pickup       = 'Trailer Pickup',
    delivery     = 'Delivery',
    parkingBay   = 'Parking Bay',
    returnCoords = 'Return / Depot',
}
local TRUCKER_STAGE_TYPES = {
    spawn        = 'vehicle',
    pickup       = 'trailer',
    delivery     = 'point',
    parkingBay   = 'trailer',
    returnCoords = 'vehicle',
}

register('trucker', {
    label = 'Trucker Routes',

    describe = function()
        if not Sunset or not Sunset.JobsConfig or not Sunset.JobsConfig.trucker then return {} end
        local routes = Sunset.JobsConfig.trucker.routes or {}
        local fields = {}
        for i, route in ipairs(routes) do
            for _, sk in ipairs(TRUCKER_STAGE_KEYS) do
                local cv = route[sk] or (sk == 'spawn' and Sunset.JobsConfig.trucker.depot and Sunset.JobsConfig.trucker.depot.spawn)
                if cv then
                    fields[#fields + 1] = {
                        key    = ('route%d_%s'):format(i, sk),
                        label  = ('[%d] %s — %s'):format(i, route.label or ('Route '..i), TRUCKER_STAGE_LABELS[sk] or sk),
                        type   = TRUCKER_STAGE_TYPES[sk] or 'point',
                        coords = vector3(cv.x, cv.y, cv.z),
                        routeIndex = i,
                        stage  = sk,
                    }
                end
            end
        end
        -- Also list depot-level fields
        local depot = Sunset.JobsConfig.trucker.depot or {}
        for _, sk in ipairs({'spawn', 'returnCoords'}) do
            local cv = depot[sk]
            if cv then
                fields[#fields + 1] = {
                    key    = ('depot_%s'):format(sk),
                    label  = ('[Depot] %s'):format(TRUCKER_STAGE_LABELS[sk] or sk),
                    type   = TRUCKER_STAGE_TYPES[sk] or 'point',
                    coords = vector3(cv.x, cv.y, cv.z),
                    stage  = sk,
                }
            end
        end
        return fields
    end,

    load = function(key)
        if not Sunset or not Sunset.JobsConfig or not Sunset.JobsConfig.trucker then
            return nil, 'Sunset.JobsConfig.trucker not available'
        end
        local cfg = Sunset.JobsConfig.trucker
        -- Parse key: route1_pickup, depot_spawn, etc.
        local rIdx, stage = key:match('^route(%d+)_(.+)$')
        if rIdx then
            local route = cfg.routes[tonumber(rIdx)]
            if not route then return nil, ('Route %s not found'):format(rIdx) end
            local cv = route[stage]
            if not cv and stage == 'spawn' then cv = cfg.depot and cfg.depot.spawn end
            if not cv then return nil, ('Stage %s not found in route %s'):format(stage, rIdx) end
            return {
                label    = ('[%s] %s — %s'):format(rIdx, route.label or 'Route', TRUCKER_STAGE_LABELS[stage] or stage),
                coords   = vector3(cv.x, cv.y, cv.z),
                heading  = cv.w or 0.0,
                type     = TRUCKER_STAGE_TYPES[stage] or 'point',
                routeIndex = tonumber(rIdx),
                stage    = stage,
                route    = route,
            }
        end
        local depStage = key:match('^depot_(.+)$')
        if depStage then
            local cv = cfg.depot and cfg.depot[depStage]
            if not cv then return nil, 'Depot stage not found' end
            return {
                label  = ('[Depot] %s'):format(TRUCKER_STAGE_LABELS[depStage] or depStage),
                coords = vector3(cv.x, cv.y, cv.z),
                heading = cv.w or 0.0,
                type   = TRUCKER_STAGE_TYPES[depStage] or 'point',
                stage  = depStage,
            }
        end
        return nil, 'Unknown key: ' .. tostring(key)
    end,

    export = function(key, v4, _extra)
        local rIdx, stage = key:match('^route(%d+)_(.+)$')
        local path
        if rIdx then
            path = ('routes[%s].%s'):format(rIdx, stage)
        else
            local depStage = key:match('^depot_(.+)$')
            path = depStage and ('depot.%s'):format(depStage) or key
        end
        local luaType = (v4.w ~= nil) and
            ('vector4(%.2f, %.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z, v4.w) or
            ('vector3(%.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z)
        return ('-- Sunset.JobsConfig.trucker.%s\n%s = %s,'):format(path, path:match('[^.]+$'), luaType)
    end,
})
