-- Central faction activity logging (faction_logs table).

FactionLog = FactionLog or {}

local LEGACY_ACTION_TO_EVENT = {
    invite_sent = 'member_invited',
    invite_accepted = 'member_joined',
    invite_declined = 'application_declined',
    leave = 'member_left',
    uninvite = 'member_kicked',
    uninvite_fp = 'member_kicked',
    uninvite_offline = 'member_kicked',
    uninvite_fp_offline = 'member_kicked',
    promote = 'member_rank_changed',
    giverank = 'member_rank_changed',
    rank_up = 'member_promoted',
    rank_down = 'member_demoted',
    fwarn = 'member_warned',
    panel_warn = 'member_warned',
    setleader = 'leader_assigned',
    removeleader = 'leader_removed',
    panel_set_faction = 'member_rank_changed',
    panel_set_rank = 'member_rank_changed',
    faction_set_member = 'application_accepted',
    application_accepted = 'application_accepted',
    application_rejected = 'application_rejected',
    faction_kick = 'member_kicked',
    faction_kick_fp = 'member_kicked',
    panel_pardon_fp = 'member_unsuspended',
    fp_pardon = 'member_unsuspended',
    leave_fp = 'member_suspended',
    resign_accepted = 'member_left',
    resign_accepted_fp = 'member_kicked',
    resign_submitted = 'member_left',
    resign_declined = 'leadership_other',
    fmotd = 'leadership_other',
    grade_labels = 'rank_structure_changed',
}

local function asTable(details)
    if type(details) == 'table' then return details end
    return {}
end

function FactionLog.resolveUsername(characterId)
    characterId = tonumber(characterId)
    if not characterId then return nil end
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local char = src and FactionCore.getChar(src)
        if char and tonumber(char.id) == characterId then
            local ok, name = pcall(function()
                return exports.sunset_core:GetPlayerDisplayName(src)
            end)
            if ok and type(name) == 'string' and name ~= '' then
                local acc = FactionCore.getChar(src)
                if acc and acc.account_id then
                    local row = MySQL.single.await(
                        'SELECT username FROM accounts WHERE id = ? LIMIT 1',
                        { acc.account_id }
                    )
                    if row and row.username then return row.username end
                end
            end
        end
    end
    local row = MySQL.single.await([[
        SELECT a.username
        FROM characters c
        JOIN players p ON p.id = c.player_id
        JOIN accounts a ON a.id = p.account_id
        WHERE c.id = ?
        LIMIT 1
    ]], { characterId })
    return row and row.username or nil
end

function FactionLog.resolveEventType(action, details, factionId, targetCharId)
    action = tostring(action or 'unknown')
    details = asTable(details)

    if action == 'panel_set_faction' or action == 'set_faction' then
        if factionId == 'none' or factionId == '' or factionId == nil then
            return 'member_left'
        end
        if details.previousFaction and details.previousFaction ~= factionId then
            return 'member_joined'
        end
        if details.joining == true then return 'member_joined' end
        if details.grade ~= nil then return 'member_rank_changed' end
        return 'member_rank_changed'
    end

    if action == 'promote' or action == 'panel_set_rank' or action == 'giverank' then
        local prev = tonumber(details.previousGrade or details.oldGrade)
        local newG = tonumber(details.grade or details.newGrade)
        if prev and newG then
            if newG > prev then return 'member_promoted' end
            if newG < prev then return 'member_demoted' end
        end
        return 'member_rank_changed'
    end

    if action == 'faction_set_member' then
        return 'application_accepted'
    end

    return LEGACY_ACTION_TO_EVENT[action] or action
end

function FactionLog.enrichValues(eventType, details, factionId)
    details = asTable(details)
    local previousValue, newValue, reason = nil, nil, nil

    if type(details.reason) == 'string' and details.reason ~= '' then
        reason = details.reason:sub(1, 512)
    end

    local grade = details.grade or details.newGrade
    local prevGrade = details.previousGrade or details.oldGrade
    if grade ~= nil then
        newValue = tostring(grade)
    end
    if prevGrade ~= nil then
        previousValue = tostring(prevGrade)
    end

    if eventType == 'member_warned' and details.count then
        newValue = tostring(details.count)
    end
    if eventType == 'member_suspended' and details.fp then
        newValue = tostring(details.fp) .. ' FP'
    end
    if eventType == 'member_unsuspended' and details.previousFp then
        previousValue = tostring(details.previousFp) .. ' FP'
        newValue = '0 FP'
    end
    if eventType == 'leader_assigned' or eventType == 'leader_removed' then
        newValue = factionId and tostring(factionId) or newValue
    end

    return previousValue, newValue, reason
end

function FactionLog.write(factionId, actorCharId, action, targetCharId, details)
    factionId = tostring(factionId or 'none')
    if factionId == '' then factionId = 'none' end
    details = asTable(details)

    local eventType = FactionLog.resolveEventType(action, details, factionId, targetCharId)
    local actorName = FactionLog.resolveUsername(actorCharId)
    local targetName = FactionLog.resolveUsername(targetCharId)
    local previousValue, newValue, reason = FactionLog.enrichValues(eventType, details, factionId)

    local metadata = {}
    for k, v in pairs(details) do metadata[k] = v end
    metadata.legacy_action = action

    pcall(function()
        MySQL.insert.await([[
            INSERT INTO faction_logs (
                faction_id, event_type, actor_character_id, target_character_id,
                actor_name_snapshot, target_name_snapshot,
                previous_value, new_value, reason, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            factionId,
            eventType,
            actorCharId,
            targetCharId,
            actorName,
            targetName,
            previousValue,
            newValue,
            reason,
            json.encode(metadata),
        })
    end)
end

function FactionCore.auditLog(factionId, actorCharId, action, targetCharId, details)
    FactionLog.write(factionId, actorCharId, action, targetCharId, details)
end

exports('WriteFactionLog', function(factionId, actorCharId, action, targetCharId, details)
    FactionLog.write(factionId, actorCharId, action, targetCharId, details)
end)
