-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Shared Job Visual Primitives (client/visual_shared.lua)
--  Single source of truth for marker shapes, dimensions, colors,
--  tolerances, and previews across both production gameplay and devtools.
-- ═══════════════════════════════════════════════════════════════

SunsetJobVisuals = SunsetJobVisuals or {}

-- ═══════════════════════════════════════════════════════════════
--  Ground & Coordinate Diagnostics
-- ═══════════════════════════════════════════════════════════════

function SunsetJobVisuals.GetGroundCoords(cp)
    if not cp then return vector3(0, 0, 0) end
    local found, groundZ = GetGroundZFor_3dCoord(cp.x, cp.y, cp.z + 50.0, false)
    if not found then
        found, groundZ = GetGroundZFor_3dCoord(cp.x, cp.y, cp.z + 150.0, false)
    end
    if found then
        return vector3(cp.x, cp.y, groundZ)
    end
    return vector3(cp.x, cp.y, cp.z)
end

function SunsetJobVisuals.Draw3DText(coords, text, scale, r, g, b, a)
    local onScreen, sx, sy = World3dToScreen2d(coords.x, coords.y, coords.z)
    if not onScreen then return end
    SetTextScale(scale or 0.35, scale or 0.35)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextColour(r or 255, g or 255, b or 255, a or 220)
    SetTextDropshadow(2, 0, 0, 0, 200)
    SetTextEdge(1, 0, 0, 0, 255)
    SetTextOutline()
    SetTextEntry('STRING')
    SetTextCentre(1)
    AddTextComponentString(text)
    DrawText(sx, sy)
end

-- ═══════════════════════════════════════════════════════════════
--  Trucker Visual Primitives
-- ═══════════════════════════════════════════════════════════════

-- Delivery Entrance Marker (Circular loading dock beacon & cylinder)
function SunsetJobVisuals.DrawTruckerDeliveryPreview(coords, isNear, label)
    if not coords then return end
    local pos = SunsetJobVisuals.GetGroundCoords(coords)
    local r, g, b = 46, 204, 113
    if isNear == false then
        r, g, b = 50, 200, 255
    end

    -- Ground cylinder
    DrawMarker(1, pos.x, pos.y, pos.z - 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        6.0, 6.0, 1.5, r, g, b, 160, false, false, 2, false, nil, nil, false)
    -- Tall beacon column beam visible from far away
    DrawMarker(1, pos.x, pos.y, pos.z - 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        2.5, 2.5, 30.0, r, g, b, 70, false, false, 2, false, nil, nil, false)
    -- Floating chevron marker
    DrawMarker(0, pos.x, pos.y, pos.z + 2.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        2.0, 2.0, 1.5, r, g, b, 200, false, false, 2, false, nil, nil, false)

    if label and label ~= '' then
        SunsetJobVisuals.Draw3DText(vector3(pos.x, pos.y, pos.z + 3.8), label, 0.38, 255, 255, 255, 240)
    end
end

-- Manual Parking Bay (Oriented rectangular trailer footprint)
function SunsetJobVisuals.DrawTruckerParkingBayPreview(coords, heading, isDocked, label)
    if not coords then return end
    local hRad = math.rad(heading or 0.0)
    local cosH = math.cos(hRad)
    local sinH = math.sin(hRad)
    local forward = vector3(-sinH, cosH, 0.0)
    local right = vector3(cosH, sinH, 0.0)

    local halfW = 1.9 -- width 3.8m
    local halfL = 6.8 -- length 13.6m

    local ground = SunsetJobVisuals.GetGroundCoords(coords)
    local center = vector3(ground.x, ground.y, ground.z + 0.12)

    local c1 = center + (forward * halfL) + (right * halfW)
    local c2 = center + (forward * halfL) - (right * halfW)
    local c3 = center - (forward * halfL) - (right * halfW)
    local c4 = center - (forward * halfL) + (right * halfW)

    local r, g, b = 255, 165, 0
    if isDocked then
        r, g, b = 46, 204, 113
    end

    -- Draw perimeter rectangle
    DrawLine(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z, r, g, b, 240)
    DrawLine(c2.x, c2.y, c3.x, c3.y, c3.z, r, g, b, 240)
    DrawLine(c3.x, c3.y, c3.z, c4.x, c4.y, c4.z, r, g, b, 240)
    DrawLine(c4.x, c4.y, c4.z, c1.x, c1.y, c1.z, r, g, b, 240)

    -- Directional entry chevron & diagonals
    DrawLine(c1.x, c1.y, c1.z, center.x, center.y, center.z, r, g, b, 120)
    DrawLine(c2.x, c2.y, c2.z, center.x, center.y, center.z, r, g, b, 120)

    -- Center heading chevron
    DrawMarker(0, center.x, center.y, center.z + 1.2, forward.x, forward.y, 0.0, 0.0, 0.0, 0.0,
        1.5, 1.5, 1.0, r, g, b, 180, false, false, 2, false, nil, nil, false)

    if label and label ~= '' then
        SunsetJobVisuals.Draw3DText(vector3(center.x, center.y, center.z + 2.0), label, 0.35, r, g, b, 230)
    end
end

-- Trailer Pickup Bay (Depot pickup trailer bay)
function SunsetJobVisuals.DrawTruckerPickupPreview(coords, heading, label)
    if not coords then return end
    local pos = SunsetJobVisuals.GetGroundCoords(coords)
    local r, g, b = 50, 200, 255

    DrawMarker(1, pos.x, pos.y, pos.z - 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        5.0, 5.0, 1.2, r, g, b, 150, false, false, 2, false, nil, nil, false)
    DrawMarker(0, pos.x, pos.y, pos.z + 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        1.5, 1.5, 1.0, r, g, b, 180, false, false, 2, false, nil, nil, false)

    if label and label ~= '' then
        SunsetJobVisuals.Draw3DText(vector3(pos.x, pos.y, pos.z + 3.0), label, 0.35, r, g, b, 240)
    end
end

-- ═══════════════════════════════════════════════════════════════
--  Garbage Visual Primitives
-- ═══════════════════════════════════════════════════════════════

function SunsetJobVisuals.DrawGarbageBinPreview(coords, index, isCurrent, isUnload)
    if not coords then return end
    local pos = SunsetJobVisuals.GetGroundCoords(coords)

    local r, g, b = 46, 204, 113
    if isUnload then
        r, g, b = 255, 140, 0
    elseif not isCurrent then
        r, g, b = 56, 189, 248
    end

    -- Ground disc marker
    DrawMarker(1, pos.x, pos.y, pos.z - 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        2.5, 2.5, 0.8, r, g, b, isCurrent and 180 or 120, false, false, 2, false, nil, nil, false)

    -- Chevron above
    DrawMarker(0, pos.x, pos.y, pos.z + 1.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.8, 0.8, 0.6, r, g, b, 180, false, false, 2, false, nil, nil, false)

    local text = isUnload and 'UNLOAD DEPOT' or ('#%d BIN'):format(index or 1)
    SunsetJobVisuals.Draw3DText(vector3(pos.x, pos.y, pos.z + 2.0), text, 0.35, r, g, b, 240)
end

-- ═══════════════════════════════════════════════════════════════
--  Client Exports
-- ═══════════════════════════════════════════════════════════════

exports('DrawTruckerDeliveryPreview', function(coords, isNear, label)
    SunsetJobVisuals.DrawTruckerDeliveryPreview(coords, isNear, label)
end)

exports('DrawTruckerParkingBayPreview', function(coords, heading, isDocked, label)
    SunsetJobVisuals.DrawTruckerParkingBayPreview(coords, heading, isDocked, label)
end)

exports('DrawTruckerPickupPreview', function(coords, heading, label)
    SunsetJobVisuals.DrawTruckerPickupPreview(coords, heading, label)
end)

exports('DrawGarbageBinPreview', function(coords, index, isCurrent, isUnload)
    SunsetJobVisuals.DrawGarbageBinPreview(coords, index, isCurrent, isUnload)
end)

exports('GetGroundCoords', function(coords)
    return SunsetJobVisuals.GetGroundCoords(coords)
end)
