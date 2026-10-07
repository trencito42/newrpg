local function resolvePlayer(source, arg)
    local target = tonumber(arg)
    if target and GetPlayerName(target) then return target end
    local account = MySQL.single.await('SELECT id, username FROM accounts WHERE LOWER(username) = LOWER(?)', { arg })
    if not account then return nil end
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local player = exports.sunset_core:GetPlayer(src)
        if player and player.account_id == account.id then return src end
    end
    return nil
end

local function requireLeaderPerm(source, perm)
    local char = FactionCore.getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded_reconnect_and_select_it' } end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then return nil, { localeKey = 'factions.message.no_faction' } end
    if FactionCore.isFactionLeader(char.id, factionId) then return char, factionId end
    if not FactionCore.hasManagePerm(source, perm) then
        return nil, FactionCore.manageAccessError(source, perm, { localeKey = 'factions.action.manage_faction_members' })
    end
    return char, factionId
end

local function getFactionMotd(factionId)
    local ok, row = pcall(function()
        return MySQL.single.await('SELECT message FROM faction_motd WHERE faction_id = ?', { factionId })
    end)
    if not ok then
        print(('[sunset_factions] Failed to read MOTD for %s: %s'):format(factionId, tostring(row)))
        return ''
    end
    return row and tostring(row.message or '') or ''
end

local function sendFactionInfo(factionId, name, message, chatType)
    chatType = chatType or 'faction_motd'
    local faction = Sunset.Factions[factionId]
    local label = faction and faction.label or name
    for _, id in ipairs(GetPlayers()) do
        local target = tonumber(id)
        local targetChar = target and FactionCore.getChar(target)
        if targetChar and select(1, FactionCore.getFactionOf(targetChar)) == factionId then
            TriggerClientEvent('sunset:chat:message', target, {
                type = chatType,
                id = 0,
                time = '',
                factionId = factionId,
                factionLabel = label,
                name = label,
                message = message,
                command = '/fmotd',
            })
        end
    end
end

local function handleSetLeader(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 4) then
        exports.sunset_core:CommandDenyAdmin(source, 'setleader')
        return true
    end
    local target = resolvePlayer(source, args[1])
    local factionId = args[2] and string.lower(args[2]) or nil
    if not target or not factionId then
        local msg = 'Usage: /setleader [server id|username] [faction]'
        if source == 0 then print(msg) else exports.sunset_core:CommandReply(source, msg, 'error') end
        return true
    end
    if not Sunset.Factions[factionId] then
        local list = exports.sunset_core:CommandListKeys(Sunset.Factions, 10)
        exports.sunset_core:CommandReply(source,
            exports.sunset_core:TFor(source, 'factions.msg.unknown_faction_valid_factions', { faction_id = tostring(factionId), list = tostring(list) }), 'error')
        return true
    end
    local char = FactionCore.getChar(target)
    if not char then
        exports.sunset_core:CommandNoCharacter(source, target)
        return true
    end
    local topGrade = FactionCore.highestFactionGrade(factionId)
    local current = select(1, FactionCore.getFactionOf(char))
    if current ~= factionId then
        if not exports.sunset_core:SetFaction(target, factionId, topGrade) then
            exports.sunset_core:CommandReply(source,
                exports.sunset_core:TFor(source, 'factions.msg.could_not_add_to_invalid_faction', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'factions.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0), faction_id = tostring(factionId) }), 'error')
            return true
        end
    elseif not exports.sunset_core:SetFaction(target, factionId, topGrade) then
        exports.sunset_core:CommandReply(source,
            exports.sunset_core:TFor(source, 'factions.msg.could_not_set_to_top_rank', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'factions.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0), faction_id = tostring(factionId) }), 'error')
        return true
    end
    MySQL.insert.await(
        'INSERT INTO faction_leaders (character_id, faction_id, assigned_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)',
        { char.id, factionId, source == 0 and 'console' or (exports.sunset_core:GetPlayerDisplayName(source) or ('Player %d'):format(source)) }
    )
    FactionCore.auditLog(factionId, char.id, 'setleader', char.id, { by = source })
    FactionCore.notify(target, exports.sunset_core:TFor(target, 'factions.msg.you_are_now_a_faction_leader'), 'success')
    if source ~= 0 then
        exports.sunset_core:CommandReply(source,
            exports.sunset_core:TFor(source, 'factions.msg.made_leader_of', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'factions.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0), faction_id = tostring(factionId) }), 'success')
    end
    return true
end

local function handleRemoveLeader(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 3) then
        exports.sunset_core:CommandDenyAdmin(source, 'removeleader')
        return true
    end
    local target = resolvePlayer(source, args[1])
    local factionId = args[2] and string.lower(args[2]) or nil
    if not target or not factionId then
        local msg = 'Usage: /removeleader [server id|username] [faction]'
        if source == 0 then print(msg) else exports.sunset_core:CommandReply(source, msg, 'error') end
        return true
    end
    if not Sunset.Factions[factionId] then
        local list = exports.sunset_core:CommandListKeys(Sunset.Factions, 10)
        exports.sunset_core:CommandReply(source,
            exports.sunset_core:TFor(source, 'factions.msg.unknown_faction_valid_factions', { faction_id = tostring(factionId), list = tostring(list) }), 'error')
        return true
    end
    local char = FactionCore.getChar(target)
    if not char then
        exports.sunset_core:CommandNoCharacter(source, target)
        return true
    end
    MySQL.update.await('DELETE FROM faction_leaders WHERE character_id = ? AND faction_id = ?', { char.id, factionId })
    FactionCore.auditLog(factionId, char.id, 'removeleader', char.id, { by = source })
    local factionLabel = Sunset.Factions[factionId] and Sunset.Factions[factionId].label or factionId
    local _, grade = FactionCore.getFactionOf(char)
    local topGrade = FactionCore.highestFactionGrade(factionId)
    if grade >= topGrade then
        exports.sunset_core:SetFaction(target, factionId, math.max(0, topGrade - 1))
    end
    FactionCore.broadcastManagement(factionId, target,
        { localeKey = 'factions.msg.was_removed_as_faction_leader_still', params = { faction_label = tostring(factionLabel) } }, {
            omitRank = true,
        })
    FactionCore.notify(target,
        exports.sunset_core:TFor(target, 'factions.msg.your_leader_role_in_was_removed', { faction_label = tostring(factionLabel) }),
        'info', 10000)
    if source ~= 0 then
        exports.sunset_core:CommandReply(source,
            exports.sunset_core:TFor(source, 'factions.msg.removed_as_leader_of', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'factions.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0), faction_id = tostring(factionId) }), 'success')
    end
    return true
end

RegisterCommand('setleader', function(source, args)
    handleSetLeader(source, args)
end, false)

RegisterCommand('removeleader', function(source, args)
    handleRemoveLeader(source, args)
end, false)

function ExecutePlayerCommand(source, name, args)
    name = string.lower(tostring(name or ''))
    if name == 'setleader' then
        return handleSetLeader(source, args or {}) == true
    end
    if name == 'removeleader' then
        return handleRemoveLeader(source, args or {}) == true
    end
    if name == 'finvite' then
        return exports.sunset_factions:RunFactionInviteCommand(source, args or {}) == true
    end
    if name == 'acceptfaction' then
        return exports.sunset_factions:RunFactionAcceptInviteCommand(source) == true
    end
    if name == 'declinefaction' then
        return exports.sunset_factions:RunFactionDeclineInviteCommand(source) == true
    end
    return false
end
exports('ExecutePlayerCommand', ExecutePlayerCommand)

exports.sunset_core:RegisterCallback('sunset:factionUninvite', function(source, targetId)
    local char, factionId = requireLeaderPerm(source, 'uninvite')
    if not char then return nil, factionId end

    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    local target = FactionCore.getChar(targetId)
    local targetFaction, targetGrade
    if target then targetFaction, targetGrade = FactionCore.getFactionOf(target) end
    if not target or targetFaction ~= factionId then
        return nil, { localeKey = 'factions.message.target_is_not_in_your_faction' }
    end
    -- [SEC3] rank ordering: leaders can only be removed by an admin (/removeleader), and
    -- non-leaders cannot remove members at their own rank or above.
    if FactionCore.isFactionLeader(target.id, factionId) and tonumber(target.id) ~= tonumber(char.id) then
        return nil, { localeKey = 'factions.message.you_cannot_warn_a_faction_leader' }
    end
    if tonumber(target.id) ~= tonumber(char.id) and not FactionCore.isFactionLeader(char.id, factionId)
        and (tonumber(targetGrade) or 0) >= (tonumber(select(2, FactionCore.getFactionOf(char))) or 0) then
        return nil, { localeKey = 'factions.message.you_cannot_warn_members_at_your_rank_or_higher' }
    end

    FactionCore.broadcastManagement(factionId, source,
        { localeKey = 'factions.msg.removed_from_the_faction_3', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(targetId)) } })
    exports.sunset_core:SetFaction(targetId, nil, 0)
    FactionCore.auditLog(factionId, char.id, 'uninvite', target.id, {})
    FactionCore.notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.you_were_removed_from_the_faction'), 'warning')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:factionGiveRank', function(source, targetId, newGrade)
    local char, factionId = requireLeaderPerm(source, 'giverank')
    if not char then return nil, factionId end
    local _, myGrade = FactionCore.getFactionOf(char)

    targetId = tonumber(targetId)
    newGrade = tonumber(newGrade)
    if not targetId or newGrade == nil then return nil, { localeKey = 'factions.message.usage_fgiverank_id_grade' } end
    if not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end

    local target = FactionCore.getChar(targetId)
    local targetFaction, targetGrade = FactionCore.getFactionOf(target)
    if not target or targetFaction ~= factionId then
        return nil, { localeKey = 'factions.message.target_is_not_in_your_faction' }
    end

    local faction = Sunset.Factions[factionId]
    if newGrade % 1 ~= 0 or not faction or not faction.grades[newGrade] then return nil, { localeKey = 'factions.message.invalid_grade' } end
    -- [SEC3] self-targeting used to skip the ceiling (self-promotion to any rank); also protect peers/superiors/leaders.
    local amLeader = FactionCore.isFactionLeader(char.id, factionId)
    if not amLeader then
        if newGrade >= (myGrade or 0) then
            return nil, { localeKey = 'factions.message.you_cannot_set_rank_to_your_level_or_higher' }
        end
        if source ~= targetId and ((tonumber(targetGrade) or 0) >= (myGrade or 0)
            or FactionCore.isFactionLeader(target.id, factionId)) then
            return nil, { localeKey = 'factions.message.you_cannot_set_rank_to_your_level_or_higher' }
        end
    end

    if newGrade > (tonumber(targetGrade) or 0) then
        local eligible, eligibilityError = FactionCore.checkPromotionEligibility(factionId, target.id, newGrade)
        if not eligible then return nil, eligibilityError end
    end

    exports.sunset_core:SetFaction(targetId, factionId, newGrade)
    local gradeLabel = FactionLabels.get(factionId, newGrade)
    FactionCore.auditLog(factionId, char.id, 'giverank', target.id, {
        grade = newGrade,
        previousGrade = tonumber(targetGrade) or 0,
    })
    FactionCore.broadcastManagement(factionId, source,
        { localeKey = 'factions.msg.set_s_rank_to', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(targetId)), grade_label = tostring(gradeLabel) } })
    FactionCore.notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.rank_set_to', { grade_label = tostring(gradeLabel) }), 'success')
    FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.msg.set_rank_to', { grade_label = tostring(gradeLabel) }), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:factionWarn', function(source, targetId, reason)
    local char, factionId = requireLeaderPerm(source, 'fwarn')
    if not char then return nil, factionId end

    targetId = tonumber(targetId)
    reason = tostring(reason or ''):gsub('[%c]', ' '):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 200) -- [SEC3] bound client text
    if reason == '' then reason = 'No reason given' end
    if not targetId or not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    local target = FactionCore.getChar(targetId)
    if not target or select(1, FactionCore.getFactionOf(target)) ~= factionId then
        return nil, { localeKey = 'factions.message.target_is_not_in_your_faction' }
    end
    if FactionCore.isFactionLeader(target.id, factionId) then
        return nil, { localeKey = 'factions.message.you_cannot_warn_a_faction_leader' }
    end
    local _, myGrade = FactionCore.getFactionOf(char)
    local _, targetGrade = FactionCore.getFactionOf(target)
    if (targetGrade or 0) >= (myGrade or 0)
        and tonumber(target.id) ~= tonumber(char.id)
        and not FactionCore.isFactionLeader(char.id, factionId) then
        return nil, { localeKey = 'factions.message.you_cannot_warn_members_at_your_rank_or_higher' }
    end

    local warnCount = tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM faction_warnings WHERE faction_id = ? AND character_id = ?',
        { factionId, target.id }
    )) or 0
    if warnCount >= 3 then
        return nil, { localeKey = 'factions.message.this_member_already_has_3_3_faction_warnings' }
    end

    pcall(function()
        MySQL.insert.await(
            'INSERT INTO faction_warnings (faction_id, character_id, issued_by, reason) VALUES (?, ?, ?, ?)',
            { factionId, target.id, char.id, reason }
        )
    end)
    local nextCount = warnCount + 1
    FactionCore.auditLog(factionId, char.id, 'fwarn', target.id, { reason = reason, count = nextCount })
    FactionCore.broadcastManagement(factionId, source,
        { localeKey = 'factions.msg.issued_a_faction_warning_3_to_2', params = { next_count = math.floor(tonumber(nextCount) or 0), player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(targetId)), reason = tostring(reason) } })
    FactionCore.notify(targetId, exports.sunset_core:TFor(targetId, 'factions.msg.faction_warning_3', { next_count = math.floor(tonumber(nextCount) or 0), reason = tostring(reason) }), 'warning', 8000)
    FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.msg.warning_issued_3', { next_count = math.floor(tonumber(nextCount) or 0), reason = tostring(reason) }), 'success')
    return { warns = nextCount, count = nextCount }
end)

local function setFactionMotd(source, message)
    local char, factionId = requireLeaderPerm(source, 'fmotd')
    if not char then return nil, factionId end
    message = tostring(message or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 512)
    if message == '' then return nil, { localeKey = 'factions.message.the_motd_cannot_be_empty_use_fmotd_with_no' } end
    local saved, saveError = pcall(function()
        MySQL.insert.await([[
            INSERT INTO faction_motd (faction_id, message, updated_by) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE message = VALUES(message), updated_by = VALUES(updated_by)
        ]], { factionId, message, char.id })
    end)
    if not saved then
        print(('[sunset_factions] Failed to save MOTD for %s: %s'):format(factionId, tostring(saveError)))
        return nil, { localeKey = 'factions.message.the_faction_motd_could_not_be_saved_please_try' }
    end
    FactionCore.auditLog(factionId, char.id, 'fmotd', nil, { message = message })
    local faction = Sunset.Factions[factionId]
    sendFactionInfo(factionId, ('%s MOTD'):format(faction and faction.label or 'FACTION'), message)
    return { message = message }
end

exports.sunset_core:RegisterCallback('sunset:factionSetMotd', function(source, message)
    return setFactionMotd(source, message)
end)

exports.sunset_core:RegisterCallback('sunset:factionGetMotd', function(source)
    local char = FactionCore.getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded_reconnect_and_select_it' } end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then return nil, { localeKey = 'factions.message.you_are_not_a_member_of_a_faction' } end
    local faction = Sunset.Factions[factionId]
    return { factionId = factionId, label = faction and faction.label or factionId, message = getFactionMotd(factionId) }
end)

function RunFactionMotdCommand(source, args)
    if source == 0 then return true end
    args = args or {}
    local msg = table.concat(args, ' ')
    if msg == '' then
        local char = FactionCore.getChar(source)
        if not char then
            FactionCore.notify(source, exports.sunset_core:TFor(source, 'crafting.message.your_character_is_not_loaded_reconnect_and_select_it'), 'error')
            return true
        end
        local factionId = select(1, FactionCore.getFactionOf(char))
        if not factionId then
            FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.message.you_are_not_a_member_of_a_faction'), 'error')
            return true
        end
        local faction = Sunset.Factions[factionId]
        local message = getFactionMotd(factionId)
        TriggerClientEvent('sunset:chat:message', source, {
            type = 'faction_motd',
            id = 0,
            time = '',
            factionId = factionId,
            factionLabel = faction and faction.label or factionId,
            name = faction and faction.label or factionId,
            message = message ~= '' and message or exports.sunset_core:TFor(source, 'factions.ui.no_message_of_the_day_has'),
            command = '/fmotd',
        })
        return true
    end
    local ok, err = setFactionMotd(source, msg)
    if ok then
        FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.message.faction_motd_updated_caa52e'), 'success')
    else
        FactionCore.notify(source, err or exports.sunset_core:TFor(source, 'factions.msg.motd_update_failed_check_your_faction'), 'error')
    end
    return true
end
exports('RunFactionMotdCommand', RunFactionMotdCommand)

function GetConnectMotd(source, char)
    char = char or FactionCore.getChar(source)
    if not char then return nil end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then
        factionId = select(1, FactionCore.ensureFactionMembership(source, char))
    end
    if not factionId then return nil end
    local message = getFactionMotd(factionId)
    if not message or message == '' then return nil end
    local faction = Sunset.Factions[factionId]
    local label = faction and faction.label or factionId
    return {
        type = 'faction_motd',
        id = 0,
        time = '',
        factionId = factionId,
        factionLabel = label,
        name = label,
        message = message,
        command = '/fmotd',
    }
end
exports('GetConnectMotd', GetConnectMotd)

exports.sunset_core:RegisterCallback('sunset:factionMembers', function(source)
    local char = FactionCore.getChar(source)
    if not char then return nil end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then return nil, { localeKey = 'factions.message.no_faction' } end

    local motd = getFactionMotd(factionId)

    local members = {}
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local c = FactionCore.getChar(src)
        if c and select(1, FactionCore.getFactionOf(c)) == factionId then
            local _, grade = FactionCore.getFactionOf(c)
            local gradeRow = Sunset.GetFactionGrade(factionId, grade)
            members[#members + 1] = {
                id = src,
                name = exports.sunset_core:GetPlayerBaseName(src),
                grade = grade,
                gradeLabel = FactionLabels.get(factionId, grade),
                onDuty = FactionCore.isOnDuty(src),
                leader = FactionCore.isFactionLeader(c.id, factionId),
            }
        end
    end
    table.sort(members, function(a, b) return (a.grade or 0) > (b.grade or 0) end)
    return { motd = motd, members = members }
end)
