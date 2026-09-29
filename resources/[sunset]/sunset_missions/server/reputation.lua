function MSN_GetReputation(charId, contact)
    local row = MySQL.single.await(
        'SELECT reputation FROM sunset_mission_reputation WHERE character_id = ? AND contact = ?',
        { charId, contact }
    )
    return row and row.reputation or 0
end

function MSN_AddReputation(charId, contact, amount)
    MySQL.insert.await([[
        INSERT INTO sunset_mission_reputation (character_id, contact, reputation, missions_completed, last_mission)
        VALUES (?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
            reputation = reputation + VALUES(reputation),
            missions_completed = missions_completed + 1,
            last_mission = VALUES(last_mission)
    ]], { charId, contact, amount, os.time() })
end

function MSN_SetLastMission(charId, missionId)
    MySQL.insert.await([[
        INSERT INTO sunset_mission_reputation (character_id, mission, last_mission)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE last_mission = VALUES(last_mission)
    ]], { charId, missionId, os.time() })
end

function MSN_GetPlayerStats(charId)
    local rows = MySQL.query.await(
        'SELECT contact, reputation, missions_completed FROM sunset_mission_reputation WHERE character_id = ?',
        { charId }
    )
    local result = {}
    for _, row in ipairs(rows or {}) do
        result[row.contact] = { rep = row.reputation, completed = row.missions_completed }
    end
    return result
end
