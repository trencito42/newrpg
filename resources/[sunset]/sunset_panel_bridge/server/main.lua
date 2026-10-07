-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Panel Bridge Server (sunset_panel_bridge)
--  Synchronizes web panel actions with live FiveM runtime.
--  Emits authoritative AdmBot broadcasts and live in-game notifications.
-- ═══════════════════════════════════════════════════════════════

exports('IsAccountOnline', function(accountId)
    accountId = tonumber(accountId)
    if not accountId then return false end
    local src = exports.sunset_core:GetSourceByAccountId(accountId)
    return src ~= nil and src > 0
end)

local function broadcastAdmBot(msgRo, msgEn, msgType)
    if (not msgRo or msgRo == '') and (not msgEn or msgEn == '') then return end

    local text = msgRo
    if msgEn and msgEn ~= '' and msgEn ~= msgRo then
        text = msgRo .. ' / ' .. msgEn
    end

    TriggerClientEvent('chat:addMessage', -1, {
        color = { 239, 68, 68 },
        multiline = true,
        args = { '^1[AdmBot]', '^1' .. text .. '^7' }
    })
end

local function writeFactionLog(factionId, actorCharId, action, targetCharId, details)
    if GetResourceState('sunset_factions') ~= 'started' then return end
    pcall(function()
        exports.sunset_factions:WriteFactionLog(factionId, actorCharId, action, targetCharId, details or {})
    end)
end

local function notifyTarget(targetSrc, msgRo, msgEn, kind)
    if targetSrc and targetSrc > 0 then
        local text = msgRo
        if msgEn and msgEn ~= '' and msgEn ~= msgRo then
            text = msgRo .. ' / ' .. msgEn
        end
        TriggerClientEvent('sunset:client:notify', targetSrc, text, kind or 'info', 10000)
        TriggerClientEvent('chat:addMessage', targetSrc, {
            color = { 215, 181, 88 },
            args = { 'AdmBot', text }
        })
    end
end

local function getTargetLicense(accountId)
    return MySQL.scalar.await(
        'SELECT license FROM players WHERE account_id = ? LIMIT 1',
        { tonumber(accountId) }
    )
end

local function getTargetCharacter(accountId, charId)
    if charId then
        return MySQL.single.await(
            "SELECT c.id, c.player_id, c.cash, c.bank, c.level, c.paydays_received, " ..
            "JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) AS faction_id, " ..
            "CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction_grade')) AS UNSIGNED) AS faction_grade, " ..
            'c.firstname, c.lastname, p.account_id ' ..
            'FROM characters c JOIN players p ON p.id = c.player_id WHERE c.id = ? AND p.account_id = ? LIMIT 1',
            { tonumber(charId), tonumber(accountId) }
        )
    end
    return MySQL.single.await(
        "SELECT c.id, c.player_id, c.cash, c.bank, c.level, c.paydays_received, " ..
        "JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) AS faction_id, " ..
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction_grade')) AS UNSIGNED) AS faction_grade, " ..
        'c.firstname, c.lastname, p.account_id ' ..
        'FROM characters c JOIN players p ON p.id = c.player_id WHERE p.account_id = ? ORDER BY c.id ASC LIMIT 1',
        { tonumber(accountId) }
    )
end

local function isLeaderOrSubleader(accountId, factionId)
    local char = MySQL.single.await([[
        SELECT c.id,
               CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction_grade')) AS UNSIGNED) AS faction_grade,
               fl.id as leader_id
        FROM characters c
        JOIN players p ON p.id = c.player_id
        JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id = ?
        LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
        WHERE p.account_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) COLLATE utf8mb4_unicode_ci = fm.faction_id LIMIT 1
    ]], { factionId, factionId, tonumber(accountId) })
    if not char then return false, 0, nil end
    local factionGrade = tonumber(char.faction_grade or 0)
    local isLeader = (char.leader_id ~= nil) or factionGrade >= 7
    local isSubLeader = factionGrade >= 6
    return (isLeader or isSubLeader), factionGrade, tonumber(char.id), isLeader
end

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
            'SELECT id, username, email, admin_level, helper_level, premium_points FROM accounts WHERE id = ? LIMIT 1',
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

    local targetSrc = targetAccount and exports.sunset_core:GetSourceByAccountId(targetAccount.id) or nil
    if targetSrc and targetSrc <= 0 then targetSrc = nil end

    -- ═══════════════════════════════════════════════════════════════
    -- 1. STAFF ROLES MANAGEMENT (Only Level 6 Admin)
    -- ═══════════════════════════════════════════════════════════════
    if row.action == 'staff_set_admin' or row.action == 'staff_set_helper' or row.action == 'staff_remove_role'
       or row.action == 'set_admin_level' or row.action == 'set_helper_level' then
        if actorAdminLevel < 6 then return false, 'permission_denied' end
        if not targetAccount then return false, 'invalid_target' end
        if targetAccount.id == actorAccount.id then return false, 'self_target' end

        local newAdminLevel = targetAccount.admin_level or 0
        local newHelperLevel = targetAccount.helper_level or 0

        if row.action == 'staff_set_admin' or row.action == 'set_admin_level' then
            local lvl = tonumber(payload.level or payload.admin_level) or 0
            if lvl < 0 or lvl > 6 then return false, 'invalid_level' end
            newAdminLevel = lvl
            if lvl > 0 then newHelperLevel = 0 end
        elseif row.action == 'staff_set_helper' or row.action == 'set_helper_level' then
            local lvl = tonumber(payload.level or payload.helper_level) or 0
            if lvl < 0 or lvl > 3 then return false, 'invalid_level' end
            newHelperLevel = lvl
            if lvl > 0 then newAdminLevel = 0 end
        elseif row.action == 'staff_remove_role' then
            newAdminLevel = 0
            newHelperLevel = 0
        end

        if targetAccount.admin_level == 6 and newAdminLevel < 6 then
            local countLvl6 = MySQL.scalar.await('SELECT COUNT(*) FROM accounts WHERE admin_level = 6')
            if tonumber(countLvl6 or 0) <= 1 then return false, 'cannot_remove_last_admin_6' end
        end

        MySQL.update.await(
            'UPDATE accounts SET admin_level = ?, helper_level = ? WHERE id = ?',
            { newAdminLevel, newHelperLevel, targetAccount.id }
        )

        if targetSrc then
            local player = exports.sunset_core:GetPlayer(targetSrc)
            if player then
                player.admin_level = newAdminLevel
                player.helper_level = newHelperLevel
            end
            notifyTarget(targetSrc, ('Rolul tau staff a fost actualizat: Admin %d / Helper %d'):format(newAdminLevel, newHelperLevel), 'info')
        end

        return true, { admin_level = newAdminLevel, helper_level = newHelperLevel }
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 2. MODERATION (Warn, Ban, Unban, Mute, Unmute, Jail, Unjail, Kick)
    -- ═══════════════════════════════════════════════════════════════
    local modReq = {
        warn = 1, mute = 1, unmute = 1,
        ban = 2, jail = 2, unjail = 2, kick = 2,
        unban = 3, set_faction = 3, set_clan = 4,
        set_cash = 4, set_bank = 4, set_level = 4, set_hours = 4, set_fp = 4,
        give_item = 4, remove_item = 4, clear_inventory = 4,
        set_premium_points = 5, set_email = 5, reset_password = 5, remove_sanction = 5
    }
    local reqLvl = modReq[row.action]
    if reqLvl then
        local hasAdmin = actorAdminLevel >= reqLvl
        local hasHelperMute = (row.action == 'mute' or row.action == 'unmute') and actorHelperLevel >= 1
        if not hasAdmin and not hasHelperMute then return false, 'permission_denied' end

        if targetAccount and targetAccount.id == actorAccount.id and not row.action:match('dissolve') then
            return false, 'self_target'
        end
        if targetAccount and tonumber(targetAccount.admin_level or 0) >= actorAdminLevel and actorAdminLevel < 6 then
            return false, 'target_staff_level_protected'
        end
    end

    if row.action == 'ban' then
        if not targetAccount then return false, 'invalid_target' end
        local license = getTargetLicense(targetAccount.id)
        if not license then return false, 'license_not_found' end
        local durationMin = sanitizeMinutes(payload.durationMin) or 43200
        if durationMin == false then return false, 'invalid_duration' end

        MySQL.insert.await([[
            INSERT INTO bans (license, reason, banned_by, expires_at)
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
        ]], { license, row.reason, actorAccount.username, durationMin })

        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, target_license, admin_account_id, admin_name, reason, duration_min)
            VALUES ('ban', ?, ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, license, actorAccount.id, actorAccount.username, row.reason, durationMin })

        local durationDays = math.ceil(durationMin / 1440)
        local durText = durationMin >= 43200 and 'Permanent' or (durationDays .. ' zile')
        broadcastAdmBot(('Admin %s l-a banat pe %s (%s). Motiv: %s'):format(
            actorAccount.username, targetAccount.username, durText, row.reason), 'ban')

        if targetSrc then
            DropPlayer(targetSrc, ('[BAN] Ai fost banat de %s (%s). Motiv: %s'):format(actorAccount.username, durText, row.reason))
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
            ]], { license or ('account:' .. targetAccount.id), 'Auto-ban: 3 avertismente active (' .. row.reason .. ')' })
            
            MySQL.insert.await([[
                INSERT INTO admin_sanctions
                  (action, target_account_id, target_name, target_license, admin_account_id, admin_name, reason, duration_min)
                VALUES ('ban', ?, ?, ?, ?, 'SYSTEM', 'Auto-ban: 3 avertismente active', 1440)
            ]], { targetAccount.id, targetAccount.username, license, actorAccount.id })

            broadcastAdmBot(('Admin %s i-a acordat un avertisment (Warn) lui %s [3/3]. Jucatorul a primit Auto-Ban 24h.'):format(
                actorAccount.username, targetAccount.username), 'ban')

            if targetSrc then
                DropPlayer(targetSrc, '[AUTO-BAN] Ai acumulat 3 avertismente (Warn). Contul tau este suspendat 24h.')
            end
        else
            broadcastAdmBot(('Admin %s i-a acordat un avertisment (Warn) lui %s. Motiv: %s [%d/3]'):format(
                actorAccount.username, targetAccount.username, row.reason, activeWarns), 'warn')

            if targetSrc then
                notifyTarget(targetSrc, ('Ai primit un Warn de la %s: %s [%d/3]'):format(actorAccount.username, row.reason, activeWarns), 'warning')
            end
        end
        return true, { warns = activeWarns, autoBanned = autoBanned }
    end

    if row.action == 'kick' then
        if not targetAccount then return false, 'invalid_target' end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason)
            VALUES ('kick', ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason })

        broadcastAdmBot(('Admin %s l-a dat afara (Kick) pe %s. Motiv: %s'):format(
            actorAccount.username, targetAccount.username, row.reason), 'kick')

        if targetSrc then
            DropPlayer(targetSrc, ('[KICK] Ai fost deconectat de %s. Motiv: %s'):format(actorAccount.username, row.reason))
        end
        return true, { kicked = true }
    end

    if row.action == 'mute' then
        local durationMin = sanitizeMinutes(payload.durationMin, 43200) or 10
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

        broadcastAdmBot(('Admin %s i-a dat mute lui %s pentru %d minute. Motiv: %s'):format(
            actorAccount.username, targetAccount.username, durationMin, row.reason), 'mute')

        if targetSrc then
            notifyTarget(targetSrc, ('Ai primit Mute pentru %d min de la %s. Motiv: %s'):format(durationMin, actorAccount.username, row.reason), 'error')
        end
        return true, { durationMin = durationMin }
    end

    if row.action == 'unmute' then
        if not targetAccount then return false, 'invalid_target' end
        if targetSrc and GetResourceState('sunset_admin') == 'started' then
            pcall(function() exports.sunset_admin:Unmute(targetSrc) end)
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason)
            VALUES ('unmute', ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason })

        if targetSrc then
            notifyTarget(targetSrc, 'Mute-ul tau a fost ridicat de un administrator.', 'success')
        end
        return true, { ok = true }
    end

    if row.action == 'jail' then
        local minutes = sanitizeMinutes(payload.durationMin, 10080) or 30
        if not targetAccount then return false, 'invalid_target' end
        if targetSrc and GetResourceState('sunset_factions') == 'started' then
            pcall(function() exports.sunset_factions:AdminJail(targetSrc, minutes, row.reason) end)
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason, duration_min)
            VALUES ('jail', ?, ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason, minutes })

        broadcastAdmBot(('Admin %s l-a trimis la inchisoare (Jail) pe %s pentru %d minute. Motiv: %s'):format(
            actorAccount.username, targetAccount.username, minutes, row.reason), 'jail')

        if targetSrc then
            notifyTarget(targetSrc, ('Ai fost trimis la inchisoare (%d min) de %s. Motiv: %s'):format(minutes, actorAccount.username, row.reason), 'error')
        end
        return true, { minutes = minutes }
    end

    if row.action == 'unjail' then
        if not targetAccount then return false, 'invalid_target' end
        if targetSrc and GetResourceState('sunset_factions') == 'started' then
            pcall(function() exports.sunset_factions:AdminUnjail(targetSrc) end)
        end
        MySQL.insert.await([[
            INSERT INTO admin_sanctions
              (action, target_account_id, target_name, admin_account_id, admin_name, reason)
            VALUES ('unjail', ?, ?, ?, ?, ?)
        ]], { targetAccount.id, targetAccount.username, actorAccount.id, actorAccount.username, row.reason })

        if targetSrc then
            notifyTarget(targetSrc, 'Ai fost eliberat din inchisoare de catre un administrator.', 'success')
        end
        return true, { ok = true }
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 3. ECONOMY & CHARACTER MODIFICATIONS (Cash, Bank, Level, Hours, FP)
    -- ═══════════════════════════════════════════════════════════════
    if row.action == 'set_cash' or row.action == 'set_bank' or row.action == 'set_level'
       or row.action == 'set_hours' or row.action == 'set_fp' or row.action == 'set_premium_points'
       or row.action == 'set_email' or row.action == 'reset_password' then
        if not targetAccount then return false, 'invalid_target' end
        local targetChar = getTargetCharacter(targetAccount.id, row.target_character_id)

        if row.action == 'set_cash' then
            local amount = math.max(0, tonumber(payload.amount or payload.cash) or 0)
            if targetChar then
                MySQL.update.await('UPDATE characters SET cash = ? WHERE id = ?', { amount, targetChar.id })
                if targetSrc then
                    exports.sunset_core:SetMoney(targetSrc, 'cash', amount, 'admin_panel')
                    notifyTarget(targetSrc, ('Balanta cash a fost setata la $%s de catre Admin %s'):format(tostring(amount), actorAccount.username), 'info')
                end
            end
            return true, { cash = amount }
        end

        if row.action == 'set_bank' then
            local amount = math.max(0, tonumber(payload.amount or payload.bank) or 0)
            if targetChar then
                MySQL.update.await('UPDATE characters SET bank = ? WHERE id = ?', { amount, targetChar.id })
                if targetSrc then
                    exports.sunset_core:SetMoney(targetSrc, 'bank', amount, 'admin_panel')
                    notifyTarget(targetSrc, ('Balanta bancara a fost setata la $%s de catre Admin %s'):format(tostring(amount), actorAccount.username), 'info')
                end
            end
            return true, { bank = amount }
        end

        if row.action == 'set_level' then
            local lvl = math.max(1, math.min(100, tonumber(payload.level) or 1))
            if targetChar then
                MySQL.update.await('UPDATE characters SET level = ? WHERE id = ?', { lvl, targetChar.id })
                if targetSrc then
                    local p = exports.sunset_core:GetPlayer(targetSrc)
                    if p and p.character then p.character.level = lvl end
                    notifyTarget(targetSrc, ('Nivelul tau a fost setat la %d de catre Admin %s'):format(lvl, actorAccount.username), 'info')
                end
            end
            return true, { level = lvl }
        end

        if row.action == 'set_hours' then
            local hours = math.max(0, tonumber(payload.hours or payload.paydays) or 0)
            if targetChar then
                MySQL.update.await('UPDATE characters SET paydays_received = ? WHERE id = ?', { hours, targetChar.id })
                if targetSrc then
                    local p = exports.sunset_core:GetPlayer(targetSrc)
                    if p and p.character then p.character.paydays_received = hours end
                    notifyTarget(targetSrc, ('Orele tale au fost actualizate la %d de catre Admin %s'):format(hours, actorAccount.username), 'info')
                end
            end
            return true, { hours = hours }
        end

        if row.action == 'set_fp' then
            local fp = math.max(0, math.min(100, tonumber(payload.fp) or 0))
            if targetChar then
                if fp > 0 then
                    MySQL.update.await([[
                        INSERT INTO faction_punish (character_id, fp, reason, set_by_character_id)
                        VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE fp = VALUES(fp), reason = VALUES(reason)
                    ]], { targetChar.id, fp, row.reason or 'Admin panel update', actorAccount.id })
                else
                    MySQL.update.await('DELETE FROM faction_punish WHERE character_id = ?', { targetChar.id })
                end
                if targetSrc then
                    notifyTarget(targetSrc, ('Punctele tale FP au fost setate la %d FP.'):format(fp), 'info')
                end
            end
            return true, { fp = fp }
        end

        if row.action == 'set_premium_points' then
            local pts = math.max(0, tonumber(payload.points or payload.premium_points) or 0)
            MySQL.update.await('UPDATE accounts SET premium_points = ? WHERE id = ?', { pts, targetAccount.id })
            if targetSrc then
                notifyTarget(targetSrc, ('Punctele tale Premium au fost actualizate: %d PP'):format(pts), 'info')
            end
            return true, { premium_points = pts }
        end

        if row.action == 'set_email' then
            local newEmail = tostring(payload.email or ''):lower():match('^%s*(.-)%s*$')
            if not newEmail or not newEmail:match('^[%w%.%+%-]+@[%w%-]+%.[%a%.]+$') then
                return false, 'invalid_email'
            end
            MySQL.update.await('UPDATE accounts SET email = ? WHERE id = ?', { newEmail, targetAccount.id })
            return true, { email = newEmail }
        end

        if row.action == 'reset_password' then
            local newPass = tostring(payload.password or '')
            if #newPass < 6 then return false, 'password_too_short' end
            local hash = exports.sunset_auth:HashPassword(newPass)
            if not hash then return false, 'hash_failed' end
            MySQL.update.await('UPDATE accounts SET password_hash = ?, password_salt = ? WHERE id = ?', { hash, '', targetAccount.id })
            return true, { ok = true }
        end
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 4. INVENTORY MANAGEMENT (Give, Remove, Clear)
    -- ═══════════════════════════════════════════════════════════════
    if row.action == 'give_item' or row.action == 'remove_item' or row.action == 'clear_inventory' then
        if not targetAccount then return false, 'invalid_target' end
        local targetChar = getTargetCharacter(targetAccount.id, row.target_character_id)
        if not targetChar then return false, 'invalid_character' end

        if row.action == 'give_item' then
            local item = tostring(payload.item or ''):lower()
            local count = math.floor(math.max(1, tonumber(payload.count) or 1))
            if item == '' then return false, 'invalid_item' end
            local result = exports.sunset_inventory:ApplyOperation(targetSrc or 0, {
                { type = 'add', item = item, count = count },
            }, { characterId = targetChar.id, opId = ('panel:%s:give'):format(row.id) })
            if not result or not result.ok then return false, result and result.error or 'inventory_error' end
            if targetSrc then notifyTarget(targetSrc, ('Ai primit %dx %s de la Admin %s'):format(count, item, actorAccount.username), 'success') end
            return true, { item = item, count = count }
        end

        if row.action == 'remove_item' then
            local item = tostring(payload.item or ''):lower()
            local count = math.floor(math.max(1, tonumber(payload.count) or 1))
            if item == '' then return false, 'invalid_item' end
            local result = exports.sunset_inventory:ApplyOperation(targetSrc or 0, {
                { type = 'remove', item = item, count = count },
            }, { characterId = targetChar.id, opId = ('panel:%s:remove'):format(row.id) })
            if not result or not result.ok then return false, result and result.error or 'inventory_error' end
            if targetSrc then notifyTarget(targetSrc, ('Ti-au fost retrase %dx %s de catre Admin %s'):format(count, item, actorAccount.username), 'warning') end
            return true, { item = item, count = count }
        end

        if row.action == 'clear_inventory' then
            local cleared, clearError = exports.sunset_inventory:ClearCharacterInventory(targetChar.id)
            if not cleared then return false, clearError or 'inventory_error' end
            if targetSrc then
                exports.sunset_inventory:ReloadInventory(targetSrc)
                notifyTarget(targetSrc, 'Inventarul tau a fost golit de catre un administrator.', 'warning')
            end
            return true, { cleared = true }
        end
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 5. SANCTION REMOVAL (Revoke Ban / Delete Sanction Row)
    -- ═══════════════════════════════════════════════════════════════
    if row.action == 'remove_sanction' then
        local sanctionId = tonumber(payload.sanctionId or payload.id)
        if not sanctionId then return false, 'invalid_sanction_id' end
        MySQL.update.await('DELETE FROM admin_sanctions WHERE id = ?', { sanctionId })
        return true, { removedSanctionId = sanctionId }
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 6. FACTIONS MANAGEMENT
    -- ═══════════════════════════════════════════════════════════════
    if row.action:match('^faction_') or row.action == 'set_faction' then
        local factionId = payload.factionId
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

        if actorAdminLevel < 3 then
            local tj = targetChar.faction_id
            local own = tj == factionId
            if not own and not ((tj == nil or tj == '' or tj == 'none') and (row.action == 'set_faction' or row.action == 'faction_set_member'))
                and row.action ~= 'faction_pardon_fp' then
                return false, 'target_not_in_faction'
            end
            local cap = actorIsLeader and 7 or math.max(actorGrade or 0, 0)
            if (row.action == 'set_faction' or row.action == 'faction_set_member' or row.action == 'faction_set_rank') and grade >= cap then
                return false, 'grade_too_high'
            end
            if own and tonumber(targetChar.faction_grade or 0) >= cap and not actorIsLeader then
                return false, 'target_rank_protected'
            end
        end

        if row.action == 'set_faction' or row.action == 'faction_set_member' then
            if factionId == 'none' or factionId == '' then factionId = nil; grade = 0 end
            local currentFaction = targetChar.faction_id
            local joining = factionId and currentFaction ~= factionId
            if joining and actorAdminLevel < 3 and GetResourceState('sunset_quests') == 'started' then
                local gateOk, allowed = pcall(function()
                    return exports.sunset_quests:CanAccessCharacter(targetChar.id, 'faction.apply')
                end)
                if not gateOk or allowed ~= true then
                    return false, 'faction_progression_required'
                end
            end
            if not exports.sunset_core:SetFactionByCharacterId(targetChar.id, factionId, grade) then
                return false, 'faction_change_failed'
            end
            if factionId then
                MySQL.update.await([[
                    INSERT INTO faction_membership (character_id, faction_id, joined_at)
                    VALUES (?, ?, NOW())
                    ON DUPLICATE KEY UPDATE joined_at = IF(faction_id = VALUES(faction_id), joined_at, NOW()),
                        faction_id = VALUES(faction_id)
                ]], { targetChar.id, factionId })
            else
                MySQL.update.await('DELETE FROM faction_membership WHERE character_id = ?', { targetChar.id })
            end

            local logFactionId = factionId or currentFaction or 'none'
            local auditAction = row.action == 'faction_set_member' and 'faction_set_member' or 'panel_set_faction'
            writeFactionLog(logFactionId, actorCharId, auditAction, targetChar.id, {
                grade = grade,
                reason = row.reason,
                previousFaction = currentFaction,
                previousGrade = tonumber(targetChar.faction_grade or 0) or 0,
                joining = joining,
            })

            if targetSrc then
                notifyTarget(targetSrc, factionId and ('Ai fost setat in factiunea %s (Rank %d)'):format(factionId, grade) or 'Ai fost scos din factiune.', 'info')
            end
            return true, { factionId = factionId, grade = grade }
        end

        if row.action == 'faction_set_rank' then
            if targetChar.faction_id ~= factionId then return false, 'target_not_in_faction' end
            if not exports.sunset_core:SetFactionByCharacterId(targetChar.id, factionId, grade) then
                return false, 'faction_change_failed'
            end
            writeFactionLog(factionId, actorCharId, 'panel_set_rank', targetChar.id, {
                grade = grade,
                reason = row.reason,
                previousGrade = tonumber(targetChar.faction_grade or 0) or 0,
            })
            return true, { grade = grade }
        end

        if row.action == 'faction_warn' then
            MySQL.insert.await([[
                INSERT INTO faction_warnings (faction_id, character_id, issued_by, reason)
                VALUES (?, ?, ?, ?)
            ]], { factionId, targetChar.id, actorCharId or 0, row.reason })
            writeFactionLog(factionId, actorCharId, 'panel_warn', targetChar.id, { reason = row.reason })
            if targetSrc then
                notifyTarget(targetSrc, ('Ai primit un Faction Warning (FW) in %s: %s'):format(factionId, row.reason), 'warning')
            end
            return true, { ok = true }
        end

        if row.action == 'faction_kick' or row.action == 'faction_kick_fp' then
            if targetChar.faction_id ~= factionId then return false, 'target_not_in_faction' end
            if not exports.sunset_core:SetFactionByCharacterId(targetChar.id, nil, 0) then
                return false, 'faction_change_failed'
            end
            MySQL.update.await('DELETE FROM faction_membership WHERE character_id = ?', { targetChar.id })
            local fp = (row.action == 'faction_kick_fp') and math.min(60, math.max(1, math.floor(tonumber(payload.fp) or 60))) or 0
            if fp > 0 then
                MySQL.update.await([[
                    INSERT INTO faction_punish (character_id, fp, reason, set_by_character_id)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE fp = VALUES(fp), reason = VALUES(reason), set_by_character_id = VALUES(set_by_character_id)
                ]], { targetChar.id, fp, row.reason, actorCharId })
            end
            writeFactionLog(factionId, actorCharId, row.action, targetChar.id, { reason = row.reason, fp = fp })

            if targetSrc then
                notifyTarget(targetSrc, ('Ai fost demis din factiunea %s%s. Motiv: %s'):format(
                    factionId, fp > 0 and (' cu ' .. fp .. ' FP') or '', row.reason), 'error')
            end
            return true, { kicked = true, fp = fp }
        end

        if row.action == 'faction_pardon_fp' then
            if actorAdminLevel < 3 and not actorIsLeader then return false, 'faction_permission_denied' end
            MySQL.update.await('DELETE FROM faction_punish WHERE character_id = ?', { targetChar.id })
            writeFactionLog(factionId, actorCharId, 'panel_pardon_fp', targetChar.id, { reason = row.reason })
            return true, { fp = 0 }
        end

        if row.action == 'faction_set_leader' then
            if actorAdminLevel < 4 then return false, 'permission_denied' end
            if not exports.sunset_core:SetFactionByCharacterId(targetChar.id, factionId, 7) then
                return false, 'faction_change_failed'
            end
            MySQL.update.await('DELETE FROM faction_leaders WHERE faction_id = ?', { factionId })
            MySQL.insert.await([[
                INSERT INTO faction_leaders (faction_id, character_id, assigned_by)
                VALUES (?, ?, ?)
            ]], { factionId, targetChar.id, actorAccount.username })
            MySQL.update.await([[
                INSERT INTO faction_membership (character_id, faction_id, joined_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE joined_at = IF(faction_id = VALUES(faction_id), joined_at, NOW()),
                    faction_id = VALUES(faction_id)
            ]], { targetChar.id, factionId })

            writeFactionLog(factionId, actorCharId, 'setleader', targetChar.id, {
                reason = row.reason,
                assignedBy = actorAccount.username,
            })

            broadcastAdmBot(('Admin %s l-a numit pe %s ca Lider al factiunii %s!'):format(
                actorAccount.username, targetAccount.username, factionId), 'success')
            return true, { leader_char_id = targetChar.id }
        end
    end

    -- ═══════════════════════════════════════════════════════════════
    -- 7. CLANS MANAGEMENT
    -- ═══════════════════════════════════════════════════════════════
    if row.action:match('^clan_') or row.action == 'set_clan' then
        local clanId = tonumber(payload.clanId)
        if payload.clanId ~= nil and (not clanId or clanId ~= clanId or clanId < 1 or clanId % 1 ~= 0) then return false, 'invalid_clan' end
        local targetChar = getTargetCharacter(row.target_account_id, row.target_character_id)
        if not targetChar and row.action ~= 'clan_dissolve' then return false, 'invalid_target_character' end

        local hasPerm, actorRank, actorCharId = false, 0, nil
        if actorAdminLevel >= 4 then
            hasPerm = true
        elseif clanId then
            hasPerm, actorRank, actorCharId = isClanManager(actorAccount.id, clanId)
        end
        if not hasPerm then return false, 'clan_permission_denied' end

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

    -- ═══════════════════════════════════════════════════════════════
    -- 8. RACKET SHOP (panel → sunset_shop settlement)
    -- ═══════════════════════════════════════════════════════════════
    if row.action == 'shop_purchase' then
        if tonumber(row.actor_account_id) ~= tonumber(row.target_account_id) then
            return false, 'invalid_target'
        end
        if GetResourceState('sunset_shop') ~= 'started' then
            return false, 'shop_unavailable'
        end
        local productId = type(payload.productId) == 'string' and payload.productId or nil
        if not productId then return false, 'invalid_product' end
        local purchaseParams = type(payload.params) == 'table' and payload.params or {}
        local purchaseResponse
        local okPurchase, callErr = pcall(function()
            purchaseResponse = exports.sunset_shop:PurchaseProductForPanel(
                row.actor_account_id,
                row.actor_character_id or row.target_character_id,
                productId,
                row.request_id,
                { tag = purchaseParams.tag, color = purchaseParams.color }
            )
        end)
        if not okPurchase then
            return false, tostring(callErr)
        end
        if type(purchaseResponse) ~= 'table' or purchaseResponse.ok ~= true then
            local err = type(purchaseResponse) == 'table' and purchaseResponse.err or nil
            local key = type(err) == 'table' and err.localeKey
                or (type(err) == 'string' and err)
                or 'shop.purchase.failed'
            return false, key
        end
        local result = purchaseResponse.result
        local js = type(result) == 'table' and result or { ok = true }
        if js.replay then js.replay = true end
        return true, js
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
    local status = (success == true) and 'completed' or 'failed'
    local resultJson = (success == true) and json.encode(type(result) == 'table' and result or { ok = true }) or nil
    local errorMessage = nil
    if success ~= true then
        errorMessage = tostring(result or 'unknown_error'):sub(1, 255)
    end
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

print('^2[sunset_panel_bridge]^7 Enhanced AdmBot bridge and action queue processor initialized.')

-- Real-time in-game push for panel notifications
CreateThread(function()
    local interval = 2000
    while true do
        Wait(interval)
        pcall(function()
            local unDelivered = MySQL.query.await([[
                SELECT id, account_id, type, title_en, title_ro, message_en, message_ro, link_url
                FROM panel_notifications
                WHERE delivered_ingame = 0
                ORDER BY id ASC
                LIMIT 10
            ]]) or {}

            for _, n in ipairs(unDelivered) do
                local targetSrc = exports.sunset_core:GetSourceByAccountId(n.account_id)
                if targetSrc and targetSrc > 0 then
                    local locale = exports.sunset_core:GetPlayerLocale(targetSrc)
                    local title = locale == 'ro' and n.title_ro or n.title_en
                    local msg = locale == 'ro' and n.message_ro or n.message_en
                    title = title or (locale == 'ro' and n.title_en or n.title_ro)
                        or exports.sunset_core:TFor(targetSrc, 'panel.notification.default_title')
                    msg = msg or (locale == 'ro' and n.message_en or n.message_ro) or ''

                    TriggerClientEvent('sunset:client:notify', targetSrc,
                        exports.sunset_core:TFor(targetSrc, 'panel.notification.message', { title = title, message = msg }),
                        'info', 10000)
                    TriggerClientEvent('chat:addMessage', targetSrc, {
                        color = { 215, 181, 88 },
                        multiline = true,
                        args = { '^3[Panel]', ('^3%s: ^7%s'):format(title, msg) }
                    })
                end
                MySQL.update.await('UPDATE panel_notifications SET delivered_ingame = 1 WHERE id = ?', { n.id })
            end
        end)
    end
end)

local function collectOnlineRoster()
    local roster = {}
    for _, srcStr in ipairs(GetPlayers()) do
        local src = tonumber(srcStr)
        if not src or src <= 0 then goto continue end
        local char = exports.sunset_core:GetCharacter(src)
        local player = exports.sunset_core:GetPlayer(src)
        if not char or not player then goto continue end
        local charId = tonumber(char.id)
        if not charId or charId <= 0 then goto continue end

        local meta = char.metadata
        if type(meta) == 'string' then
            meta = json.decode(meta) or {}
        elseif type(meta) ~= 'table' then
            meta = {}
        end

        local factionId = meta.faction
        if type(factionId) ~= 'string' or factionId == '' then factionId = nil end

        local skin = meta.skin and tostring(meta.skin) or nil
        local username = player.name
        if type(username) ~= 'string' or username == '' then
            username = ('Player%d'):format(src)
        end
        if #username > 64 then username = username:sub(1, 64) end

        local job = char.job
        if type(job) ~= 'string' or job == '' then job = 'unemployed' end
        if #job > 64 then job = job:sub(1, 64) end

        roster[#roster + 1] = {
            character_id = charId,
            username = username,
            level = math.max(1, math.floor(tonumber(char.level) or 1)),
            job = job,
            faction_id = factionId,
            paydays_received = math.max(0, math.floor(tonumber(char.paydays_received) or 0)),
            skin = skin and (#skin <= 64 and skin or skin:sub(1, 64)) or nil,
        }
        ::continue::
    end

    table.sort(roster, function(a, b)
        if a.level ~= b.level then return a.level > b.level end
        return a.username:lower() < b.username:lower()
    end)
    return roster
end

local function syncOnlineRosterSnapshot()
    local roster = collectOnlineRoster()
    local maxClients = GetConvarInt('sv_maxclients', 64)
    local version = GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or 'unknown'

    MySQL.update.await('DELETE FROM panel_online_roster')

    for _, row in ipairs(roster) do
        MySQL.insert.await([[
            INSERT INTO panel_online_roster
                (character_id, username, level, job, faction_id, paydays_received, skin)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            row.character_id,
            row.username,
            row.level,
            row.job,
            row.faction_id,
            row.paydays_received,
            row.skin,
        })
    end

    MySQL.update.await([[
        INSERT INTO panel_runtime_snapshot (id, player_count, max_players, resource_version, updated_at)
        VALUES (1, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE player_count = VALUES(player_count),
            max_players = VALUES(max_players),
            resource_version = VALUES(resource_version), updated_at = NOW()
    ]], { #roster, maxClients, version })
end

CreateThread(function()
    local interval = math.max(5, GetConvarInt('panel_snapshot_seconds', 15)) * 1000
    local lastFailure = false
    while true do
        local ok, err = pcall(syncOnlineRosterSnapshot)
        if not ok and not lastFailure then
            print(('^1[sunset_panel_bridge] Snapshot unavailable: %s^7'):format(tostring(err)))
        end
        lastFailure = not ok
        Wait(interval)
    end
end)
