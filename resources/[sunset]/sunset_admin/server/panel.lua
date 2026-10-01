-- Called only by the server-side panel queue consumer, never by a client event.
-- Reuses the same sanction/command implementations as in-game moderation.
exports('ExecutePanelModeration', function(actorSource, action, targetSource, reason, durationMin, targetLicense)
    actorSource = tonumber(actorSource)
    targetSource = tonumber(targetSource)
    durationMin = tonumber(durationMin)
    if not actorSource or actorSource <= 0 or not GetPlayerName(actorSource) then
        return false, 'actor_offline'
    end
    local required = ({ ban = 2, unban = 3, mute = 1, warn = 1 })[action]
    if not required or not IsAdmin(actorSource, required) then return false, 'permission_denied' end
    if action ~= 'unban' then
        if not targetSource or not GetPlayerName(targetSource) then return false, 'target_offline' end
        if actorSource == targetSource then return false, 'self_target' end
    end
    reason = tostring(reason or ''):sub(1, 255)
    if #reason < 3 then return false, 'reason_required' end

    if action == 'warn' then
        local result, err = SunsetAdmin.Sanctions.warn(actorSource, targetSource, reason)
        if not result then return false, type(err) == 'table' and (err.localeKey or 'warn_failed') or tostring(err) end
        return true, { warns = result.warns, autoBanned = result.banned == true }
    elseif action == 'ban' then
        if durationMin and (durationMin < 1 or durationMin > 43200) then return false, 'invalid_duration' end
        local ok, err = SunsetAdmin.Sanctions.ban(actorSource, targetSource, durationMin, reason)
        if not ok then return false, type(err) == 'table' and (err.localeKey or 'ban_failed') or tostring(err) end
        return true, { durationMin = durationMin }
    elseif action == 'mute' then
        if not durationMin or durationMin < 1 or durationMin > 43200 then return false, 'invalid_duration' end
        local handler = SunsetAdmin.ServerHandlers and SunsetAdmin.ServerHandlers.mute
        if not handler then return false, 'mute_handler_unavailable' end
        handler(actorSource, { tostring(targetSource), tostring(durationMin), reason })
        local muted = exports.sunset_admin:IsMuted(targetSource)
        if not muted then return false, 'mute_not_applied' end
        return true, { durationMin = durationMin }
    elseif action == 'unban' then
        if type(targetLicense) ~= 'string' or not targetLicense:match('^license:[0-9a-fA-F]+$') then
            return false, 'invalid_license'
        end
        local existing = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM bans WHERE license = ?', { targetLicense })) or 0
        if existing == 0 then return false, 'ban_not_found' end
        local handler = SunsetAdmin.ServerHandlers and SunsetAdmin.ServerHandlers.unban
        if not handler then return false, 'unban_handler_unavailable' end
        handler(actorSource, { targetLicense })
        local remaining = tonumber(MySQL.scalar.await('SELECT COUNT(*) FROM bans WHERE license = ?', { targetLicense })) or 0
        if remaining > 0 then return false, 'unban_not_applied' end
        return true, { removed = existing }
    end
    return false, 'unsupported_action'
end)
