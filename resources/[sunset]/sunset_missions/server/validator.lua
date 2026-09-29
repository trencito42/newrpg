function MSN_ValidateCoords(source, target, radius)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local pos = GetEntityCoords(ped)
    local dx, dy = pos.x - target.x, pos.y - target.y
    local dz = math.abs(pos.z - target.z)
    return (dx*dx + dy*dy) <= (radius*radius) and dz < 12.0
end

-- Cooldown stored per character_id + contact (matches reputation row structure).
-- mission_cooldowns is a separate table keyed by (character_id, mission).
function MSN_ValidateCooldown(charId, missionId, cooldownSec)
    local row = MySQL.single.await(
        'SELECT last_mission FROM sunset_mission_cooldowns WHERE character_id = ? AND mission = ?',
        { charId, missionId }
    )
    if not row then return true end
    return (os.time() - (row.last_mission or 0)) >= cooldownSec
end

function MSN_SetCooldown(charId, missionId)
    MySQL.insert.await([[
        INSERT INTO sunset_mission_cooldowns (character_id, mission, last_mission)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE last_mission = VALUES(last_mission)
    ]], { charId, missionId, os.time() })
end

function MSN_GetCooldowns(charId)
    local rows = MySQL.query.await(
        'SELECT mission, last_mission FROM sunset_mission_cooldowns WHERE character_id = ?',
        { charId }
    )
    local result = {}
    for _, row in ipairs(rows or {}) do
        result[row.mission] = row.last_mission
    end
    return result
end

function MSN_ValidateRequirements(source, mission)
    local req = mission.requirements
    if not req then return true end
    local char = nil
    if (req.level and req.level > 0) or (req.reputation and req.reputation > 0) then
        char = exports.sunset_core:GetCharacter(source)
        if not char then return false, 'Not logged in' end
    end
    if req.level and req.level > 0 then
        if (char.level or 1) < req.level then
            return false, ('Requires level %d'):format(req.level)
        end
    end
    if req.reputation and req.reputation > 0 then
        local rep = MSN_GetReputation(char.id, mission.contact)
        if rep < req.reputation then
            return false, ('Need %d reputation with %s'):format(req.reputation, mission.contact)
        end
    end
    return true
end
