SunsetTurfs = SunsetTurfs or {}

SunsetTurfs.WarDurationSec = 900 -- 15 minutes war
SunsetTurfs.PreparationDurationSec = 300 -- 5 minutes preparation
SunsetTurfs.NeutralCaptureSec = 180 -- 3 minutes solo hold to capture a free turf
SunsetTurfs.ScorePerSecond = 1
SunsetTurfs.ScorePerKill = 10
SunsetTurfs.WarScoreTarget = 300
SunsetTurfs.RespawnDelaySec = 5
SunsetTurfs.RallyDelaySec = 60
SunsetTurfs.TurfCooldownSec = 1800 -- 30 minutes cooldown after a war
SunsetTurfs.MinMembersToAttack = 1
SunsetTurfs.InterventionWindowSec = 240

-- [WAR REDESIGN] Armory loadout packages (clanwars.html UI 1:1).
SunsetTurfs.Loadouts = {
    {
        id = 'standard', name = 'Standard Package', rank = 1, cost = 0,
        weapons = {
            { weapon = 'WEAPON_PISTOL', ammo = 150, label = 'Pistol', tag = 'PISTOL' },
            { weapon = 'WEAPON_ASSAULTRIFLE', ammo = 300, label = 'Assault Rifle', tag = 'ASALT' },
        },
        armor = 100,
    },
    {
        id = 'advanced', name = 'Advanced Package', rank = 3, cost = 0,
        weapons = {
            { weapon = 'WEAPON_HEAVYPISTOL', ammo = 200, label = 'Heavy Pistol', tag = 'PISTOL' },
            { weapon = 'WEAPON_ADVANCEDRIFLE', ammo = 400, label = 'Advanced Rifle', tag = 'ASALT' },
        },
        armor = 100,
    },
    {
        id = 'sniper', name = 'Sniper Package', rank = 1, cost = 5000,
        weapons = {
            { weapon = 'WEAPON_PISTOL', ammo = 100, label = 'Pistol', tag = 'PISTOL' },
            { weapon = 'WEAPON_HEAVYSNIPER', ammo = 50, label = 'Heavy Sniper', tag = 'SNIPER' },
        },
        armor = 100,
    },
}

SunsetTurfs.WeaponBlacklist = {
    [`WEAPON_RPG`] = true,
    [`WEAPON_HOMINGLAUNCHER`] = true,
    [`WEAPON_MINIGUN`] = true,
    [`WEAPON_RAILGUN`] = true,
    [`WEAPON_GRENADE`] = true,
    [`WEAPON_STICKYBOMB`] = true,
    [`WEAPON_MOLOTOV`] = true,
    [`WEAPON_COMPACTLAUNCHER`] = true,
}

SunsetTurfs.TurfBlipAlpha = 80
SunsetTurfs.TurfBlipAlphaWar = 140
SunsetTurfs.FreeTurfBlipColour = 27

-- ═══════════════════════════════════════════════════════════════
--  POLYGON MATH & GEOMETRIC UTILITIES (Client & Server)
-- ═══════════════════════════════════════════════════════════════

--- Checks if a 3D/2D point is inside a polygon with optional vertical bounds
--- @param px number Point X
--- @param py number Point Y
--- @param pz number|nil Point Z
--- @param poly table Array of {x=.., y=..} or vec2/vec3
--- @param minZ number|nil Minimum Z
--- @param maxZ number|nil Maximum Z
--- @return boolean
function SunsetTurfs.IsPointInPolygon(px, py, pz, poly, minZ, maxZ)
    if not poly or type(poly) ~= 'table' or #poly < 3 then return false end
    if pz and minZ and pz < (minZ - 2.0) then return false end
    if pz and maxZ and pz > (maxZ + 5.0) then return false end

    local inside = false
    local n = #poly
    local j = n

    for i = 1, n do
        local pi = poly[i]
        local pj = poly[j]
        local xi = pi.x or pi[1]
        local yi = pi.y or pi[2]
        local xj = pj.x or pj[1]
        local yj = pj.y or pj[2]

        if xi and yi and xj and yj then
            if ((yi > py) ~= (yj > py)) and (px < (xj - xi) * (py - yi) / ((yj - yi) == 0 and 0.00001 or (yj - yi)) + xi) then
                inside = not inside
            end
        end
        j = i
    end

    return inside
end

--- Computes geometric centroid of polygon
--- @param poly table Array of {x=.., y=..}
--- @return number, number cx, cy
function SunsetTurfs.ComputePolygonCenter(poly)
    if not poly or #poly == 0 then return 0.0, 0.0 end
    local sumX, sumY = 0.0, 0.0
    local count = 0
    for _, pt in ipairs(poly) do
        local x = pt.x or pt[1]
        local y = pt.y or pt[2]
        if x and y then
            sumX = sumX + x
            sumY = sumY + y
            count = count + 1
        end
    end
    if count == 0 then return 0.0, 0.0 end
    return sumX / count, sumY / count
end

--- Computes maximum radius of polygon from centroid
--- @param poly table
--- @param cx number
--- @param cy number
--- @return number
function SunsetTurfs.ComputePolygonRadius(poly, cx, cy)
    if not poly or #poly == 0 then return 100.0 end
    local maxDist = 50.0
    for _, pt in ipairs(poly) do
        local x = pt.x or pt[1]
        local y = pt.y or pt[2]
        if x and y then
            local dist = math.sqrt((x - cx) ^ 2 + (y - cy) ^ 2)
            if dist > maxDist then maxDist = dist end
        end
    end
    return math.max(60.0, maxDist + 15.0)
end
