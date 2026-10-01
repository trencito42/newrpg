-- The panel reads this snapshot from MariaDB; no imaginary Lua HTTP listener.

exports('IsAccountOnline', function(accountId)
    accountId = tonumber(accountId)
    if not accountId then return false end
    local src = exports.sunset_core:GetSourceByAccountId(accountId)
    return src ~= nil and src > 0
end)

local function actionResult(row)
    local actor = exports.sunset_core:GetSourceByAccountId(tonumber(row.actor_account_id))
    if not actor or actor <= 0 then return false, 'actor_offline' end
    local actorPlayer = exports.sunset_core:GetPlayer(actor)
    if not actorPlayer or tonumber(actorPlayer.account_id) ~= tonumber(row.actor_account_id) then
        return false, 'actor_session_mismatch'
    end
    local actorChar = exports.sunset_core:GetCharacter(actor)
    if not actorChar or tonumber(actorChar.id) ~= tonumber(row.actor_character_id) then
        return false, 'actor_character_mismatch'
    end
    local required = ({ ban = 2, unban = 3, mute = 1, warn = 1, set_faction = 3 })[row.action]
    if not required or GetResourceState('sunset_admin') ~= 'started'
        or not exports.sunset_admin:IsAdmin(actor, required) then
        return false, 'permission_denied'
    end
    if tonumber(row.actor_account_id) == tonumber(row.target_account_id) then return false, 'self_target' end
    local targetStaff = MySQL.single.await(
        'SELECT admin_level, helper_level FROM accounts WHERE id = ? LIMIT 1',
        { tonumber(row.target_account_id) })
    if targetStaff and tonumber(targetStaff.admin_level or 0) >= tonumber(exports.sunset_admin:GetAdminLevel(actor)) then
        return false, 'target_staff_level_protected'
    end

    local payload = row.payload_json
    if type(payload) == 'string' then
        local ok, decoded = pcall(json.decode, payload)
        if not ok then return false, 'invalid_payload' end
        payload = decoded
    end
    if type(payload) ~= 'table' then return false, 'invalid_payload' end

    if row.target_character_id then
        local owner = MySQL.scalar.await([[
            SELECT p.account_id FROM characters c JOIN players p ON p.id = c.player_id WHERE c.id = ? LIMIT 1
        ]], { tonumber(row.target_character_id) })
        if tonumber(owner) ~= tonumber(row.target_account_id) then return false, 'target_ownership_changed' end
    end

    if row.action == 'set_faction' then
        if not row.target_character_id or GetResourceState('sunset_factions') ~= 'started' then
            return false, 'faction_resource_or_target_unavailable'
        end
        local factionId = payload.factionId or 'none'
        return exports.sunset_factions:ExecutePanelFactionSet(actor, tonumber(row.target_character_id),
            factionId, tonumber(payload.factionGrade) or 0, row.reason)
    end

    if row.action == 'unban' then
        local license = MySQL.scalar.await(
            'SELECT p.license FROM players p JOIN bans b ON b.license = p.license WHERE p.account_id = ? ORDER BY b.id DESC LIMIT 1',
            { tonumber(row.target_account_id) })
        if not license then return false, 'ban_not_found_for_account' end
        return exports.sunset_admin:ExecutePanelModeration(actor, 'unban', nil, row.reason, nil, license)
    end

    local target = exports.sunset_core:GetSourceByAccountId(tonumber(row.target_account_id))
    if not target or target <= 0 then return false, 'target_offline' end
    local targetPlayer = exports.sunset_core:GetPlayer(target)
    if not targetPlayer or tonumber(targetPlayer.account_id) ~= tonumber(row.target_account_id) then
        return false, 'target_session_mismatch'
    end
    if row.target_character_id then
        local activeChar = exports.sunset_core:GetCharacter(target)
        if not activeChar or tonumber(activeChar.id) ~= tonumber(row.target_character_id) then
            return false, 'target_character_not_active'
        end
    end
    return exports.sunset_admin:ExecutePanelModeration(actor, row.action, target, row.reason,
        tonumber(payload.durationMin), nil)
end

local function consumeAction(row)
    local claimed = MySQL.update.await([[
        UPDATE panel_action_queue SET status = 'processing', claimed_at = NOW()
        WHERE id = ? AND status = 'pending'
    ]], { row.id })
    if claimed ~= 1 then return end

    local ok, success, result = pcall(actionResult, row)
    if not ok then
        success, result = false, tostring(success)
    end
    local status = success and 'completed' or 'failed'
    local resultJson = success and json.encode(type(result) == 'table' and result or { ok = true }) or nil
    local errorMessage = success and nil or tostring(result or 'unknown_error'):sub(1, 255)
    MySQL.update.await([[
        UPDATE panel_action_queue SET status = ?, completed_at = NOW(), result_json = ?, error_message = ?
        WHERE id = ? AND status = 'processing'
    ]], { status, resultJson, errorMessage, row.id })
    pcall(function()
        MySQL.insert.await([[
            INSERT INTO panel_audit_log
              (actor_account_id, actor_character_id, action, target_entity, target_id, reason, details)
            VALUES (?, ?, ?, 'account', ?, ?, ?)
        ]], { row.actor_account_id, row.actor_character_id, 'executed_' .. tostring(row.action),
            row.target_account_id, row.reason,
            json.encode({ requestId = row.request_id, queueId = row.id, status = status, error = errorMessage }) })
    end)
end

CreateThread(function()
    local interval = math.max(2, GetConvarInt('panel_action_poll_seconds', 3)) * 1000
    local lastFailure = false
    local lastCleanup = 0
    while true do
        local ok, err = pcall(function()
            -- Never auto-retry an action after a crash: it may have executed.
            if os.time() - lastCleanup >= 60 then
                MySQL.update.await([[
                    UPDATE panel_action_queue
                    SET status = 'failed', completed_at = NOW(), error_message = 'execution_unknown_after_restart'
                    WHERE status = 'processing' AND claimed_at < NOW() - INTERVAL 2 MINUTE
                ]])
                lastCleanup = os.time()
            end
            local rows = MySQL.query.await([[
                SELECT id, request_id, actor_account_id, actor_character_id, action,
                       target_account_id, target_character_id, payload_json, reason
                FROM panel_action_queue WHERE status = 'pending' ORDER BY id LIMIT 5
            ]]) or {}
            for _, row in ipairs(rows) do consumeAction(row) end
        end)
        if not ok and not lastFailure then
            print(('^1[sunset_panel_bridge] Action queue unavailable: %s^7'):format(tostring(err)))
        end
        lastFailure = not ok
        Wait(interval)
    end
end)

exports('GetLiveServerStats', function()
    return {
        online = true,
        playerCount = #GetPlayers(),
        maxClients = GetConvarInt('sv_maxclients', 64),
    }
end)

print('^2[sunset_panel_bridge]^7 Resource initialized.')

CreateThread(function()
    local interval = math.max(5, GetConvarInt('panel_snapshot_seconds', 15)) * 1000
    local lastFailure = false
    while true do
        local ok, err = pcall(function()
            MySQL.update.await([[
                INSERT INTO panel_runtime_snapshot (id, player_count, max_players, resource_version, updated_at)
                VALUES (1, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE player_count = VALUES(player_count),
                    max_players = VALUES(max_players),
                    resource_version = VALUES(resource_version), updated_at = NOW()
            ]], { #GetPlayers(), GetConvarInt('sv_maxclients', 64), GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or 'unknown' })
        end)
        if not ok and not lastFailure then
            print(('^1[sunset_panel_bridge] Snapshot unavailable: %s^7'):format(tostring(err)))
        end
        lastFailure = not ok
        Wait(interval)
    end
end)
