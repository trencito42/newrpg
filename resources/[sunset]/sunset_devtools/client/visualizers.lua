-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/visualizers.lua
--  DrawRect/DrawMarker/DrawLine helpers + world-space labels.
-- ═══════════════════════════════════════════════════════════════

DevViz = {}

local function r2(n) return math.floor(n * 100 + 0.5) / 100 end

-- 2D text at normalized screen coords
function DevViz.text2d(x, y, str, scale, r, g, b, a, font, center)
    SetTextFont(font or 4)
    SetTextScale(scale or 0.32, scale or 0.32)
    SetTextColour(r or 255, g or 255, b or 255, a or 255)
    SetTextDropshadow(2, 0, 0, 0, 200)
    SetTextEdge(1, 0, 0, 0, 255)
    SetTextOutline()
    if center then SetTextCentre(true) end
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(str)
    EndTextCommandDisplayText(x, y)
end

-- Panel background rect
function DevViz.panel(cx, cy, w, h, r, g, b, a)
    DrawRect(cx, cy, w, h, r or 10, g or 18, b or 36, a or 230)
end

-- Thin accent line
function DevViz.accent(cx, cy, w, r, g, b)
    DrawRect(cx, cy, w, 0.003, r or 255, g or 140, b or 0, 240)
end

-- World-space 3D label at a position (call inside a Wait(0) thread)
function DevViz.worldLabel(wx, wy, wz, text, r, g, b)
    local onScreen, sx, sy = World3dToScreen2d(wx, wy, wz)
    if not onScreen then return end
    DevViz.text2d(sx, sy, text, 0.30, r or 255, g or 255, b or 255, 255, 4, true)
end

-- Bounding box lines around an entity
function DevViz.entityBox(ent, r, g, b)
    if not ent or ent == 0 or not DoesEntityExist(ent) then return end
    local ok, model = pcall(GetEntityModel, ent)
    if not ok or not model then return end
    local okDim, min, max = pcall(GetModelDimensions, model)
    if not okDim or not min or not max then return end
    local corners = {
        GetOffsetFromEntityInWorldCoords(ent, min.x, min.y, min.z),
        GetOffsetFromEntityInWorldCoords(ent, max.x, min.y, min.z),
        GetOffsetFromEntityInWorldCoords(ent, max.x, max.y, min.z),
        GetOffsetFromEntityInWorldCoords(ent, min.x, max.y, min.z),
        GetOffsetFromEntityInWorldCoords(ent, min.x, min.y, max.z),
        GetOffsetFromEntityInWorldCoords(ent, max.x, min.y, max.z),
        GetOffsetFromEntityInWorldCoords(ent, max.x, max.y, max.z),
        GetOffsetFromEntityInWorldCoords(ent, min.x, max.y, max.z),
    }
    r, g, b = r or 0, g or 220, b or 180
    local function ln(a, b2)
        DrawLine(corners[a].x, corners[a].y, corners[a].z,
                 corners[b2].x, corners[b2].y, corners[b2].z, r, g, b, 220)
    end
    -- Bottom loop
    ln(1,2) ln(2,3) ln(3,4) ln(4,1)
    -- Top loop
    ln(5,6) ln(6,7) ln(7,8) ln(8,5)
    -- Verticals
    ln(1,5) ln(2,6) ln(3,7) ln(4,8)
end

-- Forward arrow from an entity
function DevViz.forwardArrow(ent, len, r, g, b)
    if not DoesEntityExist(ent) then return end
    local center = GetEntityCoords(ent)
    local fwd    = GetEntityForwardVector(ent)
    local tip    = center + fwd * (len or 3.0)
    DrawLine(center.x, center.y, center.z, tip.x, tip.y, tip.z, r or 255, g or 200, b or 0, 255)
    DrawMarker(21, tip.x, tip.y, tip.z, 0, 0, 0, 0, 0, 0, 0.6, 0.6, 0.6, r or 255, g or 200, b or 0, 200, false, false, 2, false, nil, nil, false)
end

-- Ground plane cross at a world position
function DevViz.groundCross(wx, wy, wz, size, r, g, b)
    size = size or 1.0
    DrawLine(wx - size, wy, wz, wx + size, wy, wz, r or 0, g or 255, b or 100, 255)
    DrawLine(wx, wy - size, wz, wx, wy + size, wz, r or 0, g or 255, b or 100, 255)
end

-- Circle (approximated as polygon) in XY plane at world coords
function DevViz.circle(wx, wy, wz, radius, segs, r, g, b, a)
    segs = segs or 32
    r, g, b, a = r or 255, g or 255, b or 255, a or 180
    local prev
    for i = 0, segs do
        local ang = (i / segs) * 2 * math.pi
        local px  = wx + math.cos(ang) * radius
        local py  = wy + math.sin(ang) * radius
        local cur = vector3(px, py, wz)
        if prev then
            DrawLine(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z, r, g, b, a)
        end
        prev = cur
    end
end

-- Cylinder (two circles + verticals)
function DevViz.cylinder(wx, wy, wz, radius, height, r, g, b)
    DevViz.circle(wx, wy, wz, radius, 24, r, g, b, 180)
    DevViz.circle(wx, wy, wz + height, radius, 24, r, g, b, 90)
    -- 4 vertical pillars
    for i = 0, 3 do
        local ang = (i / 4) * 2 * math.pi
        local px = wx + math.cos(ang) * radius
        local py = wy + math.sin(ang) * radius
        DrawLine(px, py, wz, px, py, wz + height, r or 255, g or 255, b or 255, 80)
    end
end

-- Line between two world points with optional color
function DevViz.line(ax, ay, az, bx, by, bz, r, g, b, a)
    DrawLine(ax, ay, az, bx, by, bz, r or 255, g or 255, b or 255, a or 200)
end

-- Draw a dot / sphere marker at world coords
function DevViz.dot(wx, wy, wz, size, r, g, b, a)
    DrawMarker(28, wx, wy, wz, 0, 0, 0, 0, 0, 0, size or 0.3, size or 0.3, size or 0.3,
        r or 255, g or 255, b or 0, a or 200, false, false, 2, false, nil, nil, false)
end
