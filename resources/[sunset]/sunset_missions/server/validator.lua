function MSN_ValidateCoords(source, target, radius)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local pos = GetEntityCoords(ped)
    local dx, dy = pos.x - target.x, pos.y - target.y
    local dz = math.abs(pos.z - target.z)
    return (dx*dx + dy*dy) <= (radius*radius) and dz < 12.0
end

function MSN_ValidateCooldown(charId, missionId, cooldownSec)
    local row = MySQL.single.await(
        'SELECT last_mission FROM sunset_mission_reputation WHERE character_id = ? AND mission = ?',
        { charId, missionId }
    )
    if not row then return true end
    return (os.time() - row.last_mission) >= cooldownSec
end

function MSN_ValidateRequirements(source, mission)
    local req = mission.requirements
    if not req then return true end
    if req.reputation and req.reputation > 0 then
        local char = exports.sunset_core:GetCharacter(source)
        if not char then return false, 'not_logged_in' end
        local rep = MSN_GetReputation(char.id, mission.contact)
        if rep < req.reputation then
            return false, ('Need %d reputation with %s'):format(req.reputation, mission.contact)
        end
    end
    return true
end
