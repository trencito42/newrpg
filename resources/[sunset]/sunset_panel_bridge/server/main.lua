-- The panel reads this snapshot from MariaDB; no imaginary Lua HTTP listener.

exports('IsAccountOnline', function(accountId)
    accountId = tonumber(accountId)
    if not accountId then return false end
    local src = exports.sunset_core:GetSourceByAccountId(accountId)
    return src ~= nil and src > 0
end)

local function getTargetLicense(accountId)
    return MySQL.scalar.await(
        'SELECT license FROM players WHERE account_id = ? LIMIT 1',
        { tonumber(accountId) }
    )
end

local function getTargetCharacter(accountId, charId)
    if charId then
        return MySQL.single.await(
            'SELECT c.id, c.player_id, c.job, c.job_grade, c.firstname, c.lastname, p.account_id ' ..
            'FROM characters c JOIN players p ON p.id = c.player_id WHERE c.id = ? LIMIT 1',
            { tonumber(charId) }
        )
    end
    return MySQL.single.await(
        'SELECT c.id, c.player_id, c.job, c.job_grade, c.firstname, c.lastname, p.account_id ' ..
        'FROM characters c JOIN players p ON p.id = c.player_id WHERE p.account_id = ? ORDER BY c.id ASC LIMIT 1',
        { tonumber(accountId) }
    )
end

local function isLeaderOrSubleader(accountId, factionId)
    local char = MySQL.single.await([[
        SELECT c.id, c.job, c.job_grade, fl.id as leader_id
        FROM characters c
        JOIN players p ON p.id = c.player_id
        LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
        WHERE p.account_id = ? AND c.job = ? LIMIT 1
    ]], { factionId, tonumber(accountId), factionId })
    if not char then return false, 0, nil end
    local isLeader = (char.leader_id ~= nil) or (tonumber(char.job_grade or 0) >= 7)
    local isSubLeader = tonumber(char.job_grade or 0) >= 6
    return (isLeader or isSubLeader), tonumber(char.job_grade or 0), tonumber(char.id), isLeader
end

-- [SEC3] bounded, finite integer minutes (negative/NaN/inf/huge durations used to create instantly-expired
-- bans or absurd mutes/jails). Returns nil when the value is absent, false when invalid.
local function sanitizeMinutes(v, maxMin)
    if v == nil then return nil end
    v = tonumber(v)
    if not v or v ~= v or v == math.huge or v == -math.huge then return false end
    v = math.floor(v)
    if v < 1 or v > (maxMin or 5256000) then return false end
    return v
end

local function isClanManager(accountId, clanId)
    local member = MySQL.single.await([[
        SELECT cm.rank, cm.character_id, c.owner_character_id
        FROM clan_members cm
        JOIN characters ch ON ch.id = cm.character_id
        JOIN players p ON p.id = ch.player_id
        JOIN clans c ON c.id = cm.clan_id
        WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1
    ]], { tonumber(accountId), tonumber(clanId) })
    if not member then return false, 0, nil end
    local rank = tonumber(member.rank or 1)
    local isOwner = tonumber(member.owner_character_id) == tonumber(member.character_id)
    return (rank >= 5 or isOwner), (isOwner and 7 or rank), tonumber(member.character_id)
end

local function actionResult(row)
    local actorAccount = MySQL.single.await(
        'SELECT id, username, admin_level, helper_level FROM accounts WHERE id = ? LIMIT 1',
        { tonumber(row.actor_account_id) }
    )
    if not actorAccount then return false, 'actor_account_not_found' end
    local actorAdminLevel = tonumber(actorAccount.admin_level or 0)
    local actorHelperLevel = tonumber(actorAccount.helper_level or 0)

    local targetAccount = nil
    if row.target_account_id then
        targetAccount = MySQL.single.await(
            'SELECT id, username, admin_level, helper_level FROM accounts WHERE id = ? LIMIT 1',
            { tonumber(row.target_account_id) }
        )
        if not targetAccount then return false, 'target_account_not_found' end
    end

    local payload = row.payload_json
    if type(payload) == 'string' then
        local ok, decoded = pcall(json.decode, payload)
        if not ok then return false, 'invalid_payload' end
        payload = decoded
    end
    if type(payload) ~= 'table' then payload = {} end

    -- ═══════════════════════════════════════════════════════════════
    -- 1. STAFF ROLES MANAGEMENT (Only Level 6 Admin / Hierarchy safe)
    -- ═══════════════════════════════════════════════════════════════
    if row.action == 'staff_set_admin' or row.action == 'staff_set_helper' or row.action == 'staff_remove_role' then
        if actorAdminLevel < 6 then return false, 'permission_denied' end
        if not targetAccount then return false, 'invalid_target' end
        if targetAccount.id == actorAccount.id then return false, 'self_target' end

        local newAdminLevel = targetAccount.admin_level or 0
        local newHelperLevel = targetAccount.helper_level or 0

        if row.action == 'staff_set_admin' then
            local lvl = tonumber(payload.level) or 0
            if lvl < 0 or lvl > 6 then return false, 'invalid_level' end
            newAdminLevel = lvl
            if lvl > 0 then newHelperLevel = 0 end -- Admin overrides helper
        elseif row.action == 'staff_set_helper' then
            local lvl = tonumber(payload.level) or 0
            if lvl < 0 or lvl > 3 then return false, 'invalid_level' end
            newHelperLevel = lvl
            if lvl > 0 then newAdminLevel = 0 end
        elseif row.action == 'staff_remove_role' then
            newAdminLevel = 0
            newHelperLevel = 0
        end

        -- Hierarchy protection: ensure at least one level 6 admin remains
        if targetAccount.admin_level == 6 and newAdminLevel < 6 then
            local countLvl6 = MySQL.scalar.await('SELECT COUNT(*) FROM accounts WHERE admin_level = 6')
            if tonumber(countLvl6 or 0) <= 1 then return false, 'cannot_remove_last_admin_6' end
        end

        MySQL.update.await(
            'UPDATE accounts SET admin_level = ?, helper_level = ? WHERE id = ?',
            { newAdminLevel, newHelperLevel, targetAccount.id }
        )

        -- Live runtime sync if target is online
        local targetSrc = exports.sunset_core:GetSourceByAccountId(targetAccount.id)
        if targetSrc and targetSrc > 0 then
            local player = exports.sunset_core:GetPlayer(targetSrc)
            if player then
                player.admin_level = newAdminLevel
                player.helper_level = newHelperLevel
            end
            TriggerClientEvent('sunset:client:notify', targetSrc,
                ('Staff role updated: Admin %d / Helper %d'):format(newAdminLevel, newHelperLevel), 'info', 8000)
        end
        return true, { admin_level = newAdminLevel, helper_level = newHelperLevel }
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 2. MODERATION (Warn, Ban, Unban, Mute, Unmute, Jail, Unjail)
    -- ═══════════════════════════════════════════════════════════════
    local modReq = {
        warn = 1, mute = 1, unmute = 1,
        ban = 2, jail = 2, unjail = 2,
        unban = 3, set_faction = 3, set_clan = 4
    }
    local reqLvl = modReq[row.action]
    if reqLvl then
        local hasAdmin = actorAdminLevel >= reqLvl
        local hasHelperMute = (row.action == 'mute' or row.action == 'unmute') and actorHelperLevel >= 1
        if not hasAdmin and not hasHelperMute then return false, 'permission_denied' end

        if targetAccount and targetAccount.id == actorAccount.id then return false, 'self_target' end
        if targetAccount and tonumber(targetAccount.admin_level or 0) >= actorAdminLevel and actorAdminLevel < 6 then
            return false, 'target_staff_level_protected'
        end
    end

    local targetSrc = targetAccount and exports.sunset_core:GetSourceByAccountId(targetAccount.id) or nil
    if targetSrc and targetSrc <= 0 then targetSrc = nil end

    if row.action == 'ban' then
        if not targetAccount then return false, 'invalid_target' end
        local license = getTargetLicense(targetAccount.id)
        if not license then return false, 'license_not_found' end
        local durationMin = sanitizeMinutes(payload.durationMin) -- [SEC3]
        if durationMin == false then return false, 'invalid_duration' end

        MySQL.insert.await([[
            INSERT INTO bans (license, reason, banned_by, expires_at)
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
        ]], { license, row.reason, actorAccount.username, durationMin or 43200 })

        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, target_license, admin_account_id, admin_name, reason, duration_min)
            VALUES ('ban', ?, ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, license, actorAccount.id, actorAccount.username, row.reason, durationMin })

        if targetSrc then
            DropPlayer(targetSrc, ('[Sunset RPG] Banned by %s: %s'):format(actorAccount.username, row.reason))
        end
        return true, { durationMin = durationMin }
    end

    if row.action == 'unban' then
        if not targetAccount then return false, 'invalid_target' end
        local license = getTargetLicense(targetAccount.id)
        if not license then return false, 'license_not_found' end
        local deleted = MySQL.update.await('DELETE FROM bans WHERE license = ?', { license })
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, target_license, admin_account_id, admin_name, reason)
            VALUES ('unban', ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, license, actorAccount.id, actorAccount.username, row.reason })
        return true, { removed = deleted }
    end

    if row.action == 'warn' then
        if not targetAccount then return false, 'invalid_target' end
        local license = getTargetLicense(targetAccount.id)
        local targetChar = getTargetCharacter(targetAccount.id, row.target_character_id)
        
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_character_id, target_name, target_license, admin_account_id, admin_name, reason)
            VALUES ('warn', ?, ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetChar and targetChar.id or nil, targetAccount.username, license, actorAccount.id, actorAccount.username, row.reason })

        local activeWarns = tonumber(MySQL.scalar.await([[
            SELECT COUNT(*) FROM admin_sanctions
            WHERE action = 'warn' AND target_account_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ]], { targetAccount.id })) or 1

        local autoBanned = false
        if activeWarns >= 3 then
            autoBanned = true
            MySQL.insert.await([[
                INSERT INTO bans (license, reason, banned_by, expires_at)
                VALUES (?, ?, 'SYSTEM (3 Warns)', DATE_ADD(NOW(), INTERVAL 1440 MINUTE))
            ]], { license or ('account:' .. targetAccount.id), 'Auto-ban: 3 active warnings (' .. row.reason .. ')' })
            
            MySQL.insert.await([[
                INSERT INTO admin_sanctions
                  (action, target_account_id, target_name, target_license, admin_account_id, admin_name, reason, duration_min)
                VALUES ('ban', ?, ?, ?, ?, 'SYSTEM', 'Auto-ban: 3 active warnings', 1440)
            ]], { targetAccount.id, targetAccount.username, license, actorAccount.id })

            if targetSrc then
                DropPlayer(targetSrc, ('[Sunset RPG] Auto-banned 24h for accumulating 3 warnings. Last: %s'):format(row.reason))
            end
        elseif targetSrc then
            TriggerClientEvent('sunset:client:notify', targetSrc,
                ('Warning from %s: %s (Active: %d/3)'):format(actorAccount.username, row.reason, activeWarns), 'warning', 10000)
        end
        return true, { warns = activeWarns, autoBanned = autoBanned }
    end

    if row.action == 'mute' then
        local durationMin = sanitizeMinutes(payload.durationMin, 43200) -- [SEC3]
        if durationMin == false then return false, 'invalid_duration' end
        durationMin = durationMin or 10
        if not targetAccount then return false, 'invalid_target' end
        if targetSrc and GetResourceState('sunset_admin') == 'started' then
            local handler = SunsetAdmin and SunsetAdmin.ServerHandlers and SunsetAdmin.ServerHandlers.mute
            if handler then
                handler(targetSrc, { tostring(targetSrc), tostring(durationMin), row.reason })
            end
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason, duration_min)
            VALUES ('mute', ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason, durationMin })
        return true, { durationMin = durationMin }
    end

    if row.action == 'unmute' then
        if not targetAccount then return false, 'invalid_target' end -- [SEC3]
        if targetSrc and GetResourceState('sunset_admin') == 'started' then
            pcall(function() exports.sunset_admin:Unmute(targetSrc) end)
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason)
            VALUES ('unmute', ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason })
        return true, { ok = true }
    end

    if row.action == 'jail' then
        local minutes = sanitizeMinutes(payload.durationMin, 10080) -- [SEC3]
        if minutes == false then return false, 'invalid_duration' end
        minutes = minutes or 30
        if not targetAccount then return false, 'invalid_target' end
        if targetSrc and GetResourceState('sunset_factions') == 'started' then
            pcall(function() exports.sunset_factions:AdminJail(targetSrc, minutes, row.reason) end)
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason, duration_min)
            VALUES ('jail', ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason, minutes })
        return true, { minutes = minutes }
    end

    if row.action == 'unjail' then
        if not targetAccount then return false, 'invalid_target' end -- [SEC3]
        if targetSrc and GetResourceState('sunset_factions') == 'started' then
            pcall(function() exports.sunset_factions:AdminUnjail(targetSrc) end)
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason)
            VALUES ('unjail', ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason })
        return true, { ok = true }
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 3. FACTIONS MANAGEMENT
    -- ═══════════════════════════════════════════════════════════════
    if row.action:match('^faction_') or row.action == 'set_faction' then
        local factionId = payload.factionId
        -- [SEC3] validate ids/grade: string charset, integer grade 0..10
        if factionId ~= nil and (type(factionId) ~= 'string' or #factionId > 32 or not factionId:match('^[%w_]*$')) then
            return false, 'invalid_faction'
        end
        local grade = tonumber(payload.factionGrade or payload.grade or 0)
        if not grade or grade ~= grade or grade < 0 or grade > 10 then return false, 'invalid_grade' end
        grade = math.floor(grade)
        local targetChar = getTargetCharacter(row.target_account_id, row.target_character_id)
        if not targetChar then return false, 'invalid_target_character' end

        local hasPerm, actorGrade, actorCharId, actorIsLeader = false, 0, nil, false
        if actorAdminLevel >= 3 then
            hasPerm = true
        elseif factionId then
            hasPerm, actorGrade, actorCharId, actorIsLeader = isLeaderOrSubleader(actorAccount.id, factionId)
        end
        if not hasPerm then return false, 'faction_permission_denied' end
        -- [SEC3] non-admin faction managers: only act on their own members (or unemployed for recruitment),
        -- and never grant a grade at/above their own (leaders cap at 6). Previously a leader of faction A could
        -- kick/warn anyone by naming factionId=A.
        if actorAdminLevel < 3 then
            local tj = targetChar.job
            local own = tj == factionId
            if not own and not (tj == 'unemployed' and (row.action == 'set_faction' or row.action == 'faction_set_member')) then
                return false, 'target_not_in_faction'
            end
            local cap = actorIsLeader and 7 or math.max(actorGrade or 0, 0)
            if grade >= cap then return false, 'grade_too_high' end
            if own and tonumber(targetChar.job_grade or 0) >= cap then return false, 'target_rank_protected' end
        end

        if row.action == 'set_faction' or row.action == 'faction_set_member' then
            if factionId == 'none' or factionId == '' then factionId = 'unemployed'; grade = 0 end
            MySQL.update.await('UPDATE characters SET job = ?, job_grade = ? WHERE id = ?', { factionId, grade, targetChar.id })
            
            if targetSrc and GetResourceState('sunset_core') == 'started' then
                pcall(function() exports.sunset_core:SetFactionByCharacterId(targetChar.id, factionId, grade) end)
            end

            MySQL.insert.await([[
                INSERT INTO faction_audit_log (faction_id, actor_character_id, action, target_character_id, details)
                VALUES (?, ?, 'panel_set_faction', ?, ?)
            ]], { factionId, actorCharId, targetChar.id, json.encode({ grade = grade, reason = row.reason }) })
            return true, { factionId = factionId, grade = grade }
        end

        if row.action == 'faction_set_rank' then
            MySQL.update.await('UPDATE characters SET job_grade = ? WHERE id = ? AND job = ?', { grade, targetChar.id, factionId })
            if targetSrc and GetResourceState('sunset_core') == 'started' then
                pcall(function() exports.sunset_core:SetFactionByCharacterId(targetChar.id, factionId, grade) end)
            end
            MySQL.insert.await([[
                INSERT INTO faction_audit_log (faction_id, actor_character_id, action, target_character_id, details)
                VALUES (?, ?, 'panel_set_rank', ?, ?)
            ]], { factionId, actorCharId, targetChar.id, json.encode({ grade = grade, reason = row.reason }) })
            return true, { grade = grade }
        end

        if row.action == 'faction_warn' then
            MySQL.insert.await([[
                INSERT INTO faction_warnings (faction_id, character_id, issued_by, reason)
                VALUES (?, ?, ?, ?)
            ]], { factionId, targetChar.id, actorCharId or 0, row.reason })
            MySQL.insert.await([[
                INSERT INTO faction_audit_log (faction_id, actor_character_id, action, target_character_id, details)
                VALUES (?, ?, 'panel_warn', ?, ?)
            ]], { factionId, actorCharId, targetChar.id, json.encode({ reason = row.reason }) })
            return true, { ok = true }
        end

        if row.action == 'faction_kick' or row.action == 'faction_kick_fp' then
            MySQL.update.await("UPDATE characters SET job = 'unemployed', job_grade = 0 WHERE id = ?", { targetChar.id })
            if targetSrc and GetResourceState('sunset_core') == 'started' then
                pcall(function() exports.sunset_core:SetFactionByCharacterId(targetChar.id, 'unemployed', 0) end)
            end
            local fp = (row.action == 'faction_kick_fp') and (tonumber(payload.fp) or 10) or 0
            if fp > 0 then
                MySQL.insert.await([[
                    INSERT INTO faction_punish (character_id, faction_id, fp_points, reason)
                    VALUES (?, ?, ?, ?)
                ]], { targetChar.id, factionId, fp, row.reason })
            end
            MySQL.insert.await([[
                INSERT INTO faction_audit_log (faction_id, actor_character_id, action, target_character_id, details)
                VALUES (?, ?, ?, ?, ?)
            ]], { factionId, actorCharId, row.action, targetChar.id, json.encode({ reason = row.reason, fp = fp }) })
            return true, { kicked = true, fp = fp }
        end

        if row.action == 'faction_set_leader' then
            if actorAdminLevel < 4 then return false, 'permission_denied' end
            MySQL.update.await('DELETE FROM faction_leaders WHERE faction_id = ?', { factionId })
            MySQL.insert.await([[
                INSERT INTO faction_leaders (faction_id, character_id, assigned_by)
                VALUES (?, ?, ?)
            ]], { factionId, targetChar.id, actorAccount.username })
            MySQL.update.await('UPDATE characters SET job = ?, job_grade = 7 WHERE id = ?', { factionId, targetChar.id })
            if targetSrc and GetResourceState('sunset_core') == 'started' then
                pcall(function() exports.sunset_core:SetFactionByCharacterId(targetChar.id, factionId, 7) end)
            end
            return true, { leader_char_id = targetChar.id }
        end
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 4. CLANS MANAGEMENT
    -- ═══════════════════════════════════════════════════════════════
    if row.action:match('^clan_') or row.action == 'set_clan' then
        local clanId = tonumber(payload.clanId)
        if payload.clanId ~= nil and (not clanId or clanId ~= clanId or clanId < 1 or clanId % 1 ~= 0) then return false, 'invalid_clan' end -- [SEC3]
        local targetChar = getTargetCharacter(row.target_account_id, row.target_character_id)
        if not targetChar and row.action ~= 'clan_dissolve' then return false, 'invalid_target_character' end

        local hasPerm, actorRank, actorCharId = false, 0, nil
        if actorAdminLevel >= 4 then
            hasPerm = true
        elseif clanId then
            hasPerm, actorRank, actorCharId = isClanManager(actorAccount.id, clanId)
        end
        if not hasPerm then return false, 'clan_permission_denied' end
        -- [SEC3] non-admin clan managers may not poach members of other clans or grant ranks >= their own
        if actorAdminLevel < 4 and targetChar and (row.action == 'set_clan' or row.action == 'clan_add_member' or row.action == 'clan_set_rank') then
            local curClan = MySQL.scalar.await('SELECT clan_id FROM clan_members WHERE character_id = ? LIMIT 1', { targetChar.id })
            if curClan and tonumber(curClan) ~= clanId then return false, 'target_in_other_clan' end
            if (tonumber(payload.rank) or 1) >= math.max(actorRank or 0, 1) and (actorRank or 0) < 7 then return false, 'rank_too_high' end
        end

        if row.action == 'set_clan' or row.action == 'clan_add_member' then
            local rank = math.max(1, math.min(7, tonumber(payload.rank) or 1))
            MySQL.update.await('DELETE FROM clan_members WHERE character_id = ?', { targetChar.id })
            MySQL.insert.await('INSERT INTO clan_members (clan_id, character_id, rank) VALUES (?, ?, ?)',
                { clanId, targetChar.id, rank })
            MySQL.insert.await([[
                INSERT INTO clan_audit_log (clan_id, actor_character_id, action, details)
                VALUES (?, ?, 'panel_add_member', ?)
            ]], { clanId, actorCharId, json.encode({ target_character_id = targetChar.id, rank = rank }) })
            return true, { clanId = clanId, rank = rank }
        end

        if row.action == 'clan_set_rank' then
            local rank = math.max(1, math.min(7, tonumber(payload.rank) or 1))
            MySQL.update.await('UPDATE clan_members SET rank = ? WHERE clan_id = ? AND character_id = ?',
                { rank, clanId, targetChar.id })
            MySQL.insert.await([[
                INSERT INTO clan_audit_log (clan_id, actor_character_id, action, details)
                VALUES (?, ?, 'panel_set_rank', ?)
            ]], { clanId, actorCharId, json.encode({ target_character_id = targetChar.id, rank = rank }) })
            return true, { rank = rank }
        end

        if row.action == 'clan_warn' then
            MySQL.update.await('UPDATE clan_members SET warns = warns + 1 WHERE clan_id = ? AND character_id = ?',
                { clanId, targetChar.id })
            MySQL.insert.await([[
                INSERT INTO clan_audit_log (clan_id, actor_character_id, action, details)
                VALUES (?, ?, 'panel_warn', ?)
            ]], { clanId, actorCharId, json.encode({ target_character_id = targetChar.id, reason = row.reason }) })
            return true, { ok = true }
        end

        if row.action == 'clan_kick' then
            MySQL.update.await('DELETE FROM clan_members WHERE clan_id = ? AND character_id = ?',
                { clanId, targetChar.id })
            MySQL.insert.await([[
                INSERT INTO clan_audit_log (clan_id, actor_character_id, action, details)
                VALUES (?, ?, 'panel_kick', ?)
            ]], { clanId, actorCharId, json.encode({ target_character_id = targetChar.id, reason = row.reason }) })
            return true, { kicked = true }
        end

        if row.action == 'clan_dissolve' then
            if actorAdminLevel < 5 and actorRank < 7 then return false, 'permission_denied' end
            MySQL.update.await('DELETE FROM clan_members WHERE clan_id = ?', { clanId })
            MySQL.update.await('DELETE FROM clans WHERE id = ?', { clanId })
            return true, { dissolved = clanId }
        end
    end

    return false, 'unsupported_action'
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
