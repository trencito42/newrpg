-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/validators.lua
--  Ground probe, clearance raycast, and entity overlap check.
--  All functions return structured results — never silently auto-fix.
-- ═══════════════════════════════════════════════════════════════

DevValidate = {}

local Cfg = SunsetDevTools.Config

-- Ground probe: probe downward from (x, y, z + offset).
-- Returns { found, groundZ, delta, surfaceEntity, surfaceModel }.
function DevValidate.groundProbe(x, y, z, offsetUp)
    offsetUp = offsetUp or Cfg.groundProbeOffset
    local probeZ = z + offsetUp

    -- Request collision at probe point
    RequestCollisionAtCoord(x, y, probeZ)

    local found, gz = GetGroundZFor_3dCoord(x, y, probeZ, false)
    if found and gz and gz > 0 then
        -- Cast downward to find what surface we hit
        local handle = StartShapeTestRay(x, y, probeZ, x, y, gz - 0.5, 1 | 2 | 4 | 8 | 16, 0, 0)
        local result, hit, endCoords, _normal, entityHit = GetShapeTestResult(handle)
        local surfModel = nil
        if result == 2 and hit and DoesEntityExist(entityHit) and entityHit ~= 0 then
            surfModel = string.format('0x%X', GetEntityModel(entityHit))
        end
        return {
            found        = true,
            groundZ      = math.floor(gz * 100 + 0.5) / 100,
            configuredZ  = math.floor(z * 100 + 0.5) / 100,
            delta        = math.floor((z - gz) * 100 + 0.5) / 100,
            surfaceEntity = (entityHit ~= 0) and entityHit or nil,
            surfaceModel = surfModel,
        }
    end

    -- Fallback: try a shape test straight down a long distance
    local handle = StartShapeTestRay(x, y, probeZ, x, y, z - 50.0, 1 | 2 | 4 | 8 | 16, 0, 0)
    local result, hit, endCoords, _n, entityHit = GetShapeTestResult(handle)
    if result == 2 and hit then
        local gz2 = endCoords.z
        local surfModel = nil
        if DoesEntityExist(entityHit) and entityHit ~= 0 then
            surfModel = string.format('0x%X', GetEntityModel(entityHit))
        end
        return {
            found        = true,
            groundZ      = math.floor(gz2 * 100 + 0.5) / 100,
            configuredZ  = math.floor(z * 100 + 0.5) / 100,
            delta        = math.floor((z - gz2) * 100 + 0.5) / 100,
            surfaceEntity = (entityHit ~= 0) and entityHit or nil,
            surfaceModel = surfModel,
            source       = 'raycast',
        }
    end

    return { found = false, groundZ = nil, delta = nil, configuredZ = math.floor(z * 100 + 0.5) / 100 }
end

-- Head clearance: cast upward from (x, y, z + headOffset).
-- Returns { clearance, blocked, blockEntity, blockModel, status }.
function DevValidate.headClearance(x, y, z, headOffset, castDist)
    headOffset = headOffset or Cfg.headClearanceOffset
    castDist   = castDist or 4.0  -- how far up to check (ceiling detection)
    local startZ = z + headOffset
    local endZ   = startZ + castDist

    local handle = StartShapeTestRay(x, y, startZ, x, y, endZ, 1 | 2 | 4 | 16, 0, 0)
    local result, hit, endCoords, _n, entityHit = GetShapeTestResult(handle)

    if result == 2 and hit then
        local clearance = math.floor((endCoords.z - (z + headOffset)) * 100 + 0.5) / 100
        local blockModel = nil
        if DoesEntityExist(entityHit) and entityHit ~= 0 then
            blockModel = string.format('0x%X', GetEntityModel(entityHit))
        end
        return {
            clearance  = clearance,
            blocked    = true,
            blockEntity = (entityHit ~= 0) and entityHit or nil,
            blockModel  = blockModel,
            status      = clearance < 0.5 and 'BLOCKED' or 'TIGHT',
        }
    end

    return { clearance = castDist, blocked = false, status = 'OK' }
end

-- Forward obstruction: cast forward from (x, y, z+1) in heading direction.
-- Returns { distance, hit, status }.
function DevValidate.forwardObstruction(x, y, z, heading, dist)
    dist = dist or 3.0
    local rad  = math.rad(heading)
    local fx   = -math.sin(rad)
    local fy   =  math.cos(rad)
    local ex   = x + fx * dist
    local ey   = y + fy * dist
    local ez   = z + 1.0

    local handle = StartShapeTestRay(x + fx * 0.5, y + fy * 0.5, ez, ex, ey, ez, 1 | 2 | 4 | 16, 0, 0)
    local result, hit, endCoords, _n, entityHit = GetShapeTestResult(handle)

    if result == 2 and hit then
        local d = #(vector3(x, y, ez) - endCoords)
        return { distance = math.floor(d * 100 + 0.5) / 100, hit = true, status = 'BLOCKED' }
    end
    return { distance = dist, hit = false, status = 'CLEAR' }
end

-- Full placement diagnostic for a world position + heading.
-- Returns a table with ground, head, forward fields.
function DevValidate.fullCheck(x, y, z, heading)
    return {
        ground  = DevValidate.groundProbe(x, y, z),
        head    = DevValidate.headClearance(x, y, z),
        forward = DevValidate.forwardObstruction(x, y, z, heading or 0.0),
    }
end

-- Format a diagnostic result as a multiline string for HUD display.
function DevValidate.format(diag)
    local lines = {}
    -- Ground
    local g = diag.ground
    if g.found then
        lines[#lines + 1] = ('Ground Z:    %.2f  (delta: %+.2fm)'):format(g.groundZ, g.delta)
        if g.surfaceModel then
            lines[#lines + 1] = ('Surface:     OBJ %s'):format(g.surfaceModel)
        else
            lines[#lines + 1] = 'Surface:     World geometry'
        end
    else
        lines[#lines + 1] = 'Ground:      UNKNOWN'
    end
    -- Head
    local h = diag.head
    if h.blocked then
        lines[#lines + 1] = ('Headroom:    %.2fm  [%s]%s'):format(
            h.clearance, h.status, h.blockModel and (' OBJ '..h.blockModel) or '')
    else
        lines[#lines + 1] = 'Headroom:    OK'
    end
    -- Forward
    local f = diag.forward
    if f.hit then
        lines[#lines + 1] = ('Forward:     BLOCKED @ %.1fm'):format(f.distance)
    else
        lines[#lines + 1] = 'Forward:     CLEAR'
    end
    return table.concat(lines, '\n')
end
