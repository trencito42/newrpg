-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — shared/adapters.lua
--  Adapter registry for the Visual Job Route Creator & Placement Studio.
-- ═══════════════════════════════════════════════════════════════

SunsetDevTools = SunsetDevTools or {}
SunsetDevTools.Adapters = {}

local function register(id, adapter)
    adapter.id = id
    SunsetDevTools.Adapters[id] = adapter
end

-- ── Missions / NPC Contacts ──────────────────────────────────

register('missions', {
    label = 'Mission Contacts',
    jobName = nil,

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

-- ── Job Workplaces & Supervisor NPCs ─────────────────────────

register('workplaces', {
    label = 'Job Workplaces',
    jobName = nil,

    describe = function()
        if not Sunset or not Sunset.JobWorkplaces then return {} end
        local fields = {}
        for jobId, wp in pairs(Sunset.JobWorkplaces) do
            local npc = wp.npc or {}
            fields[#fields + 1] = {
                key    = jobId .. '_npc',
                label  = ('[%s] %s (%s)'):format(wp.jobLabel or jobId, npc.name or 'Supervisor', wp.locationLabel or 'Workplace'),
                type   = 'ped',
                coords = npc.coords,
                model  = npc.model,
            }
            if wp.secondaryLocation and wp.secondaryLocation.coords then
                fields[#fields + 1] = {
                    key    = jobId .. '_secondary',
                    label  = ('[%s] %s'):format(wp.jobLabel or jobId, wp.secondaryLocation.label or 'Secondary Location'),
                    type   = 'point',
                    coords = wp.secondaryLocation.coords,
                }
            end
        end
        table.sort(fields, function(a, b) return a.label < b.label end)
        return fields
    end,

    load = function(key)
        if not Sunset or not Sunset.JobWorkplaces then return nil, 'Sunset.JobWorkplaces not available' end
        local jobId, part = key:match('^([^_]+)_(.+)$')
        local wp = jobId and Sunset.JobWorkplaces[jobId]
        if not wp then return nil, ('Unknown workplace: %s'):format(key) end

        if part == 'npc' and wp.npc and wp.npc.coords then
            local c = wp.npc.coords
            return {
                label    = ('[%s] %s'):format(wp.jobLabel or jobId, wp.npc.name or 'Supervisor'),
                subtitle = wp.locationLabel or 'Workplace',
                model    = wp.npc.model,
                coords   = vector3(c.x, c.y, c.z),
                heading  = c.w or c.h or 0.0,
                scenario = wp.npc.scenario,
            }
        elseif part == 'secondary' and wp.secondaryLocation and wp.secondaryLocation.coords then
            local c = wp.secondaryLocation.coords
            return {
                label    = ('[%s] %s'):format(wp.jobLabel or jobId, wp.secondaryLocation.label or 'Secondary Location'),
                subtitle = wp.locationLabel or 'Workplace',
                coords   = vector3(c.x, c.y, c.z),
                heading  = c.w or c.h or 0.0,
            }
        end
        return nil, ('Unknown workplace field: %s'):format(key)
    end,

    export = function(key, v4, _extra)
        return ('coords = vector4(%.2f, %.2f, %.2f, %.2f),  -- %s'):format(
            v4.x, v4.y, v4.z, v4.w, key)
    end,
})

-- ── Trucker Route Adapter ────────────────────────────────────

register('trucker', {
    label = 'Trucker Routes',
    jobName = 'trucker',
    description = 'Trailer pickup bay, delivery entrance checkpoint, and oriented manual parking bay.',
    icon = 'truck',

    categories = {
        { id = 'fuel', label = 'Fuel (Tanker)' },
        { id = 'general', label = 'General Freight' },
        { id = 'heavy', label = 'Heavy Equipment' },
    },

    createDefault = function(id, label)
        id = id or ('route_' .. os.time())
        return {
            id = id,
            label = label or 'New Trucker Route',
            category = 'fuel',
            pay = 750,
            pickup = { x = 1234.3, y = -3104.2, z = 4.8, h = 3.5, w = 3.5 },
            delivery = { x = 1181.2, y = 2671.5, z = 37.9, h = 0.0, w = 0.0 },
            parkingBay = { x = 1181.2, y = 2671.5, z = 37.9, h = 0.0, w = 0.0 },
        }
    end,

    validate = function(route)
        local results = {}
        if not route.id or route.id == '' then
            table.insert(results, { status = 'FAIL', field = 'id', message = 'Route ID is required and must be unique.' })
        else
            table.insert(results, { status = 'PASS', field = 'id', message = 'ID: ' .. route.id })
        end

        if not route.label or route.label == '' then
            table.insert(results, { status = 'FAIL', field = 'label', message = 'Route label cannot be empty.' })
        else
            table.insert(results, { status = 'PASS', field = 'label', message = 'Label valid.' })
        end

        local pay = tonumber(route.pay)
        if not pay or pay <= 0 then
            table.insert(results, { status = 'FAIL', field = 'pay', message = 'Base pay must be a positive number.' })
        else
            table.insert(results, { status = 'PASS', field = 'pay', message = ('Base Pay: $%d'):format(pay) })
        end

        -- Coordinate checks
        local function checkPoint(pt, name)
            if not pt or type(pt) ~= 'table' or not pt.x or not pt.y or not pt.z then
                table.insert(results, { status = 'FAIL', field = name, message = name .. ' coordinates are missing or invalid.' })
                return nil
            end
            if math.abs(pt.x) > 10000 or math.abs(pt.y) > 10000 or math.abs(pt.z) > 2000 then
                table.insert(results, { status = 'FAIL', field = name, message = name .. ' coordinates are out of map bounds.' })
                return nil
            end
            table.insert(results, { status = 'PASS', field = name, message = ('%s (%.1f, %.1f, %.1f)'):format(name, pt.x, pt.y, pt.z) })
            return vector3(pt.x, pt.y, pt.z)
        end

        local pCoords = checkPoint(route.pickup, 'Pickup')
        local dCoords = checkPoint(route.delivery, 'Delivery')
        local bCoords = checkPoint(route.parkingBay, 'Parking Bay')

        if dCoords and bCoords then
            local dist = #(dCoords - bCoords)
            if dist > 200.0 then
                table.insert(results, { status = 'WARNING', field = 'distance', message = ('Delivery entrance and parking bay are %.1fm apart (unusually far).'):format(dist) })
            else
                table.insert(results, { status = 'PASS', field = 'distance', message = ('Delivery -> Bay distance: %.1fm'):format(dist) })
            end
        end

        return results
    end,

    visualize = function(route, isPreview, selStage)
        if not route then return end
        local viz = (SunsetJobVisuals and SunsetJobVisuals.DrawTruckerPickupPreview and SunsetJobVisuals)
            or (GetResourceState('sunset_jobs') == 'started' and exports.sunset_jobs) or nil
        if not viz then return end

        local pCoords = route.pickup
        local dCoords = route.delivery
        local bCoords = route.parkingBay

        -- 1. Pickup Bay
        if pCoords and viz.DrawTruckerPickupPreview then
            viz.DrawTruckerPickupPreview(pCoords, pCoords.h or pCoords.w or pCoords.heading,
                selStage == 'pickup' and '~y~[EDITING] Trailer Pickup' or 'Trailer Pickup')
        end

        -- 2. Delivery Entrance
        if dCoords and viz.DrawTruckerDeliveryPreview then
            viz.DrawTruckerDeliveryPreview(dCoords, selStage == 'delivery',
                selStage == 'delivery' and '~y~[EDITING] Delivery Entrance' or 'Delivery Entrance')
        end

        -- 3. Parking Bay
        if bCoords and viz.DrawTruckerParkingBayPreview then
            viz.DrawTruckerParkingBayPreview(bCoords, bCoords.h or bCoords.w or bCoords.heading,
                selStage == 'parkingBay',
                selStage == 'parkingBay' and '~y~[EDITING] Parking Bay' or 'Manual Parking Bay')
        end

        -- Connect delivery to parking bay
        if dCoords and bCoords then
            DrawLine(dCoords.x, dCoords.y, dCoords.z + 0.5, bCoords.x, bCoords.y, bCoords.z + 0.5, 255, 165, 0, 150)
        end
    end,
})

-- ── Garbage Route Adapter ────────────────────────────────────

register('garbage', {
    label = 'Garbage Routes',
    jobName = 'garbage',
    description = 'Ordered sequence of trash bin collection stops.',
    icon = 'trash',

    createDefault = function(id, label)
        id = id or ('garbage_route_' .. os.time())
        return {
            id = id,
            label = label or 'New Garbage Route',
            bins = {},
        }
    end,

    validate = function(route)
        local results = {}
        if not route.id or route.id == '' then
            table.insert(results, { status = 'FAIL', field = 'id', message = 'Route ID is required and must be unique.' })
        else
            table.insert(results, { status = 'PASS', field = 'id', message = 'ID: ' .. route.id })
        end

        if not route.label or route.label == '' then
            table.insert(results, { status = 'FAIL', field = 'label', message = 'Route label cannot be empty.' })
        else
            table.insert(results, { status = 'PASS', field = 'label', message = 'Label valid.' })
        end

        local binCount = route.bins and #route.bins or 0
        if binCount == 0 then
            table.insert(results, { status = 'FAIL', field = 'bins', message = 'Route must contain at least 1 trash bin.' })
        elseif binCount < 8 then
            table.insert(results, { status = 'WARNING', field = 'bins', message = ('Route has %d bins (recommended is 8 to fill truck capacity).'):format(binCount) })
        else
            table.insert(results, { status = 'PASS', field = 'bins', message = ('%d bins in sequence.'):format(binCount) })
        end

        return results
    end,

    visualize = function(route, isPreview, selIndex)
        if not route or not route.bins then return end
        local viz = (SunsetJobVisuals and SunsetJobVisuals.DrawGarbageBinPreview and SunsetJobVisuals)
            or (GetResourceState('sunset_jobs') == 'started' and exports.sunset_jobs) or nil
        if not viz or not viz.DrawGarbageBinPreview then return end

        local bins = route.bins
        local cfg = Sunset.JobsConfig and Sunset.JobsConfig.garbage or {}

        -- Draw depot unload marker
        if cfg.depot and cfg.depot.unload then
            viz.DrawGarbageBinPreview(cfg.depot.unload, 0, false, true)
        end

        for i, b in ipairs(bins) do
            local isCurrent = (i == selIndex)
            viz.DrawGarbageBinPreview(b, i, isCurrent, false)

            -- Draw line to next bin
            if i < #bins then
                local nextB = bins[i + 1]
                DrawLine(b.x, b.y, b.z + 1.0, nextB.x, nextB.y, nextB.z + 1.0, 56, 189, 248, 120)
            end
        end
    end,
})

-- ── Hunting Zone Adapter ─────────────────────────────────────

register('hunting', {
    label = 'Hunting Zones',
    jobName = 'hunting',
    description = 'Polygon hunting zone with ranked species and animal spawn points.',
    icon = 'target',

    createDefault = function(id, label)
        id = id or ('hunting_zone_' .. os.time())
        return {
            id = id,
            label = label or 'New Hunting Zone',
            minRank = 1,
            minZ = 0.0,
            maxZ = 300.0,
            maxAlive = 5,
            respawnSec = 180,
            species = { deer = 2 },
            polygon = {},
            spawnPoints = {},
        }
    end,

    validate = function(zone)
        local results = {}
        if not zone.id or zone.id == '' then
            table.insert(results, { status = 'FAIL', field = 'id', message = 'Zone ID is required.' })
        else
            table.insert(results, { status = 'PASS', field = 'id', message = 'ID: ' .. zone.id })
        end

        local polyCount = zone.polygon and #zone.polygon or 0
        if polyCount < 3 then
            table.insert(results, { status = 'FAIL', field = 'polygon',
                message = ('Polygon needs at least 3 vertices (has %d).'):format(polyCount) })
        else
            table.insert(results, { status = 'PASS', field = 'polygon',
                message = ('%d-vertex polygon.'):format(polyCount) })
        end

        local spawnCount = zone.spawnPoints and #zone.spawnPoints or 0
        if spawnCount == 0 then
            table.insert(results, { status = 'FAIL', field = 'spawnPoints',
                message = 'At least 1 spawn point required.' })
        else
            table.insert(results, { status = 'PASS', field = 'spawnPoints',
                message = ('%d spawn points.'):format(spawnCount) })
        end

        local maxAlive = tonumber(zone.maxAlive) or 0
        if maxAlive < 1 or maxAlive > 12 then
            table.insert(results, { status = 'FAIL', field = 'maxAlive',
                message = 'maxAlive must be 1–12.' })
        else
            table.insert(results, { status = 'PASS', field = 'maxAlive',
                message = ('Max alive: %d.'):format(maxAlive) })
        end

        return results
    end,

    visualize = function(zone, isPreview, selIndex)
        if not zone then return end

        -- Draw polygon outline
        local poly = zone.polygon or {}
        local n = #poly
        for i = 1, n do
            local a = poly[i]
            local b = poly[(i % n) + 1]
            if a and b then
                DrawLine(a.x, a.y, a.z + 0.5, b.x, b.y, b.z + 0.5, 34, 197, 94, 200)
                DrawMarker(1, a.x, a.y, a.z, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5,
                    34, 197, 94, 180, false, true, 2, false, nil, nil, false)
            end
        end

        -- Draw spawn points
        local spawnPts = zone.spawnPoints or {}
        for i, sp in ipairs(spawnPts) do
            local isSel = (i == selIndex)
            local r, g, b_ = isSel and 255 or 180, isSel and 200 or 120, 0
            DrawMarker(2, sp.x, sp.y, sp.z + 0.5, 0, 0, 0, 0, 0, 0, 0.7, 0.7, 0.7,
                r, g, b_, 200, false, true, 2, false, nil, nil, false)
            -- Draw heading arrow using a short line
            local rad = math.rad(sp.h or 0)
            local ex  = sp.x + math.cos(rad) * 2.0
            local ey  = sp.y + math.sin(rad) * 2.0
            DrawLine(sp.x, sp.y, sp.z + 0.6, ex, ey, sp.z + 0.6, r, g, b_, 180)
        end
    end,
})

-- ── Dive Site Adapter ────────────────────────────────────────
-- Loot points are underwater — no ground-snap, snapMode = none.

register('diving', {
    label = 'Dive Sites',
    jobName = 'diving',
    description = 'Underwater salvage site: search zone + loot points (no ground-snap).',
    icon = 'waves',
    snapMode = 'none',  -- underwater: don't snap to ground

    createDefault = function(id, label)
        id = id or ('dive_site_' .. os.time())
        return {
            id = id,
            label = label or 'New Dive Site',
            minRank = 1,
            requiresBoat = false,
            difficulty = 'easy',
            requiredSalvage = 3,
            pay = 300,
            searchZone = { x = 0, y = 0, z = -10.0, radius = 60.0 },
            diveEntry   = { x = 0, y = 0, z = 0.0 },
            returnPoint = { x = -812.0, y = -1282.0, z = 5.0 },
            lootPoints  = {},
        }
    end,

    validate = function(site)
        local results = {}
        if not site.id or site.id == '' then
            table.insert(results, { status = 'FAIL', field = 'id', message = 'Site ID required.' })
        else
            table.insert(results, { status = 'PASS', field = 'id', message = 'ID: ' .. site.id })
        end

        local sz = site.searchZone
        if not sz or not sz.radius or sz.radius <= 0 then
            table.insert(results, { status = 'FAIL', field = 'searchZone',
                message = 'searchZone radius must be > 0.' })
        else
            table.insert(results, { status = 'PASS', field = 'searchZone',
                message = ('Search zone: radius %.0fm at z=%.1f.'):format(sz.radius, sz.z or 0) })
        end

        local lpCount = site.lootPoints and #site.lootPoints or 0
        local required = site.requiredSalvage or 3
        if lpCount < required then
            table.insert(results, { status = 'FAIL', field = 'lootPoints',
                message = ('Need at least %d loot points (required salvage), have %d.'):format(required, lpCount) })
        elseif lpCount < required + 1 then
            table.insert(results, { status = 'WARNING', field = 'lootPoints',
                message = ('Recommend more loot points than requiredSalvage for randomness.') })
        else
            table.insert(results, { status = 'PASS', field = 'lootPoints',
                message = ('%d loot points (%d required).'):format(lpCount, required) })
        end

        -- Check all loot points have negative Z (underwater)
        for i, pt in ipairs(site.lootPoints or {}) do
            if pt.z >= 0 then
                table.insert(results, { status = 'WARNING', field = 'lootPoints',
                    message = ('Loot point %d has z=%.1f — should be negative (underwater).'):format(i, pt.z) })
            end
        end

        return results
    end,

    visualize = function(site, isPreview, selIndex)
        if not site then return end

        -- Draw search zone circle (approximate with 16-segment ring)
        local sz = site.searchZone
        if sz then
            local segments = 16
            for i = 0, segments - 1 do
                local a1 = (i / segments) * 2 * math.pi
                local a2 = ((i + 1) / segments) * 2 * math.pi
                local x1 = sz.x + math.cos(a1) * sz.radius
                local y1 = sz.y + math.sin(a1) * sz.radius
                local x2 = sz.x + math.cos(a2) * sz.radius
                local y2 = sz.y + math.sin(a2) * sz.radius
                DrawLine(x1, y1, (sz.z or 0) + 1.0, x2, y2, (sz.z or 0) + 1.0, 30, 144, 255, 180)
            end
        end

        -- Draw loot points (no ground-snap)
        local lpts = site.lootPoints or {}
        for i, pt in ipairs(lpts) do
            local isSel = (i == selIndex)
            local r, g, b_ = isSel and 255 or 30, isSel and 220 or 144, isSel and 50 or 255
            DrawMarker(1, pt.x, pt.y, pt.z, 0, 0, 0, 0, 0, 0, 0.8, 0.8, 0.8,
                r, g, b_, 200, false, true, 2, false, nil, nil, false)
        end

        -- Draw dive entry
        if site.diveEntry then
            local de = site.diveEntry
            DrawMarker(2, de.x, de.y, de.z + 0.5, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 1.0,
                0, 200, 255, 180, false, true, 2, false, nil, nil, false)
        end

        -- Draw return point
        if site.returnPoint then
            local rp = site.returnPoint
            DrawMarker(2, rp.x, rp.y, rp.z + 0.5, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 1.0,
                255, 165, 0, 180, false, true, 2, false, nil, nil, false)
        end
    end,
})
