-- Faction domain entry point for audited web-panel requests.
exports('ExecutePanelFactionSet', function(actorSource, targetCharacterId, factionId, grade, reason)
    actorSource = tonumber(actorSource)
    targetCharacterId = tonumber(targetCharacterId)
    grade = tonumber(grade) or 0
    if not actorSource or actorSource <= 0 or not GetPlayerName(actorSource) then return false, 'actor_offline' end
    if GetResourceState('sunset_admin') ~= 'started' or not exports.sunset_admin:IsAdmin(actorSource, 3) then
        return false, 'permission_denied'
    end
    local actorChar = exports.sunset_core:GetCharacter(actorSource)
    if not actorChar or not targetCharacterId or targetCharacterId == tonumber(actorChar.id) then
        return false, 'invalid_target'
    end
    if factionId == 'none' then factionId = nil end
    if factionId ~= nil then
        if type(factionId) ~= 'string' or not Sunset.Factions[factionId]
            or not Sunset.Factions[factionId].grades[grade] then
            return false, 'invalid_faction_or_grade'
        end
    else
        grade = 0
    end
    if not exports.sunset_core:SetFactionByCharacterId(targetCharacterId, factionId, grade) then
        return false, 'faction_change_failed'
    end
    FactionCore.auditLog(factionId or 'none', tonumber(actorChar.id), 'panel_set_faction', targetCharacterId, {
        grade = grade, reason = tostring(reason or ''):sub(1, 255),
    })
    return true, { factionId = factionId, grade = grade }
end)
