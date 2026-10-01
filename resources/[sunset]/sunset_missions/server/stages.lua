-- [MISSIONS AUTHORITY] Server-side stage transition rules.
-- The client may REQUEST a transition; the server grants it only when the previous stage is
-- the immediate predecessor, the minimum dwell has elapsed and a bounded position / entity
-- sanity check passes. No client event can mean "completed" on its own.

local function dist2(p, t)
    local dx, dy = p.x - t.x, p.y - t.y
    return dx * dx + dy * dy, math.abs(p.z - t.z)
end

function MSN_NearCoords(source, target, radius, zTol)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local d2, dz = dist2(GetEntityCoords(ped), target)
    return d2 <= radius * radius and dz < (zTol or 40.0)
end

-- Server-side view of the vehicle the player is driving: model + plate must match the variant.
function MSN_PlayerInMissionVehicle(source, s)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local veh = GetVehiclePedIsIn(ped, false)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return false end
    local d = s.data or {}
    if d.vehicleModel and GetEntityModel(veh) ~= GetHashKey(d.vehicleModel) then return false end
    if d.vehiclePlate then
        local plate = tostring(GetVehicleNumberPlateText(veh) or ''):gsub('%s+', '')
        if plate ~= d.vehiclePlate:gsub('%s+', '') then return false end
    end
    return true, veh
end

-- Condition 0..100 read from the networked vehicle, never from the client.
function MSN_ReadVehicleCondition(veh)
    local okB, body = pcall(GetVehicleBodyHealth, veh)
    local okE, eng  = pcall(GetVehicleEngineHealth, veh)
    if not okB or not okE or not body or not eng then return 50 end
    if eng <= 0 then return 0 end
    return math.max(0, math.min(100, math.floor(((body / 1000.0) * 0.6 + (math.max(eng, 0) / 1000.0) * 0.4) * 100)))
end

local function inZone(source, s, def, pad)
    local zone = def.searchZones and def.searchZones[(s.data or {}).searchZone]
    if not zone then return false end
    return MSN_NearCoords(source, zone.center, zone.radius + (pad or 60.0))
end

local function nearAnyExit(source, def)
    for _, ex in ipairs(def.exitPoints or {}) do
        if MSN_NearCoords(source, ex.coords, 45.0) then return true end
    end
    return false
end

-- [mission][fromState][toState] = { dwell = seconds, check = fn(source, s, def) }
MSN_Transitions = {
    vehicle_recovery = {
        BRIEFING       = { SEARCH_AREA    = { dwell = 0 } },
        SEARCH_AREA    = { LOCATE_VEHICLE = { dwell = 3, check = function(src, s, def) return inZone(src, s, def, 80.0) end } },
        LOCATE_VEHICLE = { STEAL_VEHICLE  = { dwell = 0, check = function(src, s, def) return inZone(src, s, def, 80.0) end } },
        -- STEAL_VEHICLE -> PURSUIT happens only through vr:vehicleEntered
        PURSUIT        = { DELIVER        = { dwell = 8, check = function(src, s, def)
            return MSN_NearCoords(src, def.deliveryCoords, SunsetMissions.Config.deliveryRadius + 30.0) and MSN_PlayerInMissionVehicle(src, s)
        end } },
    },
    container_47 = {
        BRIEFING    = { ENTER_PORT = { dwell = 0 } },
        ENTER_PORT  = { SEARCH = { dwell = 2, check = function(src, s, def)
            return MSN_NearCoords(src, def.portEnterCoords, def.portEnterRadius + 25.0) end } },
        -- SEARCH -> IDENTIFY only through c47:identify
        IDENTIFY    = { BREAK_SEAL = { dwell = 1, check = function(src, s)
            return MSN_NearCoords(src, s.data.targetCoords, 9.0) end } },
        BREAK_SEAL  = { TAKE_CARGO = { dwell = 3, check = function(src, s)
            return MSN_NearCoords(src, s.data.targetCoords, 9.0) end } },
        TAKE_CARGO  = { ALERT = { dwell = 1, check = function(src, s)
            return MSN_NearCoords(src, s.data.targetCoords, 9.0) end } },
        ALERT       = { ESCAPE = { dwell = 0 } },
        ESCAPE      = { DELIVER = { dwell = 6, check = function(src, s, def) return nearAnyExit(src, def) end } },
    },
}

-- Returns ok, reason. Grants the transition (mutates state) when allowed.
function MSN_RequestTransition(source, s, toStage)
    local rules = MSN_Transitions[s.mission]
    local rule = rules and rules[s.state] and rules[s.state][toStage]
    if not rule then return false, 'invalid_transition' end
    if s.busy then return false, 'busy' end
    if s.stageAt and rule.dwell and (os.time() - s.stageAt) < rule.dwell then return false, 'too_fast' end
    if rule.check then
        local def = SunsetMissions.GetMission(s.mission)
        if not rule.check(source, s, def) then return false, 'position' end
    end
    s.seq = (s.seq or 0) + 1
    MSN_SetState(source, toStage)
    return true
end
