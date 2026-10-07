FactionRoster = FactionRoster or {}

local function rosterLeaderPerm(source, perm)
    local char = FactionCore.getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded' } end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then return nil, { localeKey = 'factions.message.no_faction' } end
    if FactionCore.isFactionLeader(char.id, factionId) then return char, factionId end
    if not FactionCore.hasManagePerm(source, perm) then
        return nil, FactionCore.manageAccessError(source, perm, { localeKey = 'factions.action.manage_faction_members' })
    end
    return char, factionId
end

local function getMemberRow(characterId)
    characterId = tonumber(characterId)
    if not characterId then return nil end
    local row = MySQL.single.await(
        'SELECT id, firstname, lastname, job, job_grade, metadata FROM characters WHERE id = ? LIMIT 1',
        { characterId }
    )
    if not row then return nil end
    local metadata = row.metadata
    if type(metadata) == 'string' then
        local ok, decoded = pcall(json.decode, metadata)
        metadata = ok and decoded or {}
    end
    metadata = type(metadata) == 'table' and metadata or {}
    local charLike = {
        job = row.job,
        job_grade = tonumber(row.job_grade) or 0,
        metadata = metadata,
    }
    local factionId, grade = Sunset.GetCharacterFaction(charLike)
    return {
        id = tonumber(row.id),
        name = (('%s %s'):format(row.firstname or '', row.lastname or '')):gsub('^%s+', ''):gsub('%s+$', ''),
        factionId = factionId,
        grade = grade or 0,
    }
end

local function rosterRankPerm(source)
    local char = FactionCore.getChar(source)
    if not char then return nil, nil, 'Your character is not loaded.' end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then return nil, nil, 'No faction' end
    if FactionCore.isFactionLeader(char.id, factionId) then
        return char, factionId, nil
    end
    if FactionCore.hasManagePerm(source, 'giverank') or FactionCore.hasManagePerm(source, 'promote') then
        return char, factionId, nil
    end
    return nil, nil, FactionCore.manageAccessError(source, 'giverank', { localeKey = 'factions.action.manage_faction_ranks' })
end

local function onlineSourceForCharacter(characterId)
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local char = src and FactionCore.getChar(src)
        if char and tonumber(char.id) == tonumber(characterId) then return src end
    end
    return nil
end

local function canManageMember(actorSource, actorChar, factionId, targetGrade, targetCharacterId)
    local isLeader = FactionCore.isFactionLeader(actorChar.id, factionId)
    if isLeader then return true end
    if not FactionCore.hasManagePerm(actorSource, 'giverank') and not FactionCore.hasManagePerm(actorSource, 'promote') then
        return false, FactionCore.manageAccessError(actorSource, 'giverank', { localeKey = 'factions.action.manage_faction_ranks' })
    end
    local _, myGrade = FactionCore.getFactionOf(actorChar)
    if targetGrade >= (myGrade or 0) and tonumber(targetCharacterId) ~= tonumber(actorChar.id) then
        return false, { localeKey = 'factions.message.you_cannot_manage_members_at_your_rank_or_higher' }
    end
    return true
end

function FactionRoster.adjustGrade(source, characterId, delta)
    local char, factionId, permErr = rosterRankPerm(source)
    if not char or not factionId then return nil, permErr or exports.sunset_core:TFor(source, 'factions.message.no_faction') end

    characterId = tonumber(characterId)
    delta = tonumber(delta) or 0
    if not characterId or delta == 0 or delta % 1 ~= 0 then return nil, { localeKey = 'factions.message.invalid_roster_action' } end

    local member = getMemberRow(characterId)
    if not member or member.factionId ~= factionId then return nil, { localeKey = 'factions.message.that_member_is_not_in_your_faction' } end
    if FactionCore.isFactionLeader(characterId, factionId) and delta < 0 then
        return nil, { localeKey = 'factions.message.you_cannot_demote_a_faction_leader' }
    end

    local allowed, err = canManageMember(source, char, factionId, member.grade, characterId)
    if not allowed then return nil, err end

    local faction = Sunset.Factions[factionId]
    local newGrade = member.grade + delta
    if not faction or not faction.grades[newGrade] then
        if delta > 0 then
            return nil, { localeKey = 'factions.message.member_is_already_at_the_highest_rank' }
        end
        return nil, { localeKey = 'factions.message.member_is_already_at_the_lowest_rank' }
    end
    -- [SEC3] removed the "~= self" exemption: a non-leader could self-promote +1 repeatedly.
    if newGrade >= (select(2, FactionCore.getFactionOf(char)) or 0)
        and not FactionCore.isFactionLeader(char.id, factionId) then
        return nil, { localeKey = 'factions.message.you_cannot_set_rank_to_your_level_or_higher' }
    end
    if delta > 0 then
        local eligible, eligibilityError = FactionCore.checkPromotionEligibility(factionId, characterId, newGrade)
        if not eligible then return nil, eligibilityError end
    end

    local targetSource = onlineSourceForCharacter(characterId)
    local setOk
    if targetSource then
        setOk = exports.sunset_core:SetFaction(targetSource, factionId, newGrade)
    else
        setOk = exports.sunset_core:SetFactionByCharacterId(characterId, factionId, newGrade)
    end
    if not setOk then
        return nil, { localeKey = 'factions.message.could_not_save_the_new_rank_reconnect_and_try' }
    end

    local label = FactionLabels.get(factionId, newGrade)
    local auditAction = delta > 0 and 'rank_up' or 'rank_down'
    FactionCore.auditLog(factionId, char.id, auditAction, characterId, {
        grade = newGrade,
        previousGrade = member.grade,
    })
    local targetName = FactionCore.memberDisplayName(characterId)
    FactionCore.broadcastManagement(factionId, source,
        { localeKey = delta > 0 and 'factions.msg.promoted_target_to' or 'factions.msg.demoted_target_to', params = { target_name = tostring(targetName), label = tostring(label) } })
    if targetSource then
        FactionCore.notify(targetSource, exports.sunset_core:TFor(targetSource, 'factions.msg.your_rank_is_now', { label = tostring(label) }), 'info')
    end
    return { grade = newGrade, gradeLabel = label }
end

function FactionRoster.kickMember(source, characterId, options)
    options = type(options) == 'table' and options or {}
    local char, factionId = rosterLeaderPerm(source, 'uninvite')
    if not char then return nil, factionId end

    characterId = tonumber(characterId)
    if not characterId then return nil, { localeKey = 'factions.message.invalid_member' } end

    local member = getMemberRow(characterId)
    if not member or member.factionId ~= factionId then return nil, { localeKey = 'factions.message.that_member_is_not_in_your_faction' } end
    if FactionCore.isFactionLeader(characterId, factionId) then return nil, { localeKey = 'factions.message.you_cannot_remove_a_faction_leader' } end

    local allowed, err = canManageMember(source, char, factionId, member.grade, characterId)
    if not allowed then return nil, err end

    -- [OFFLINE KICK FIX] FP is a pure DB record (faction_punish), so Kick + FP
    -- works on offline members too. Apply it BEFORE the offline early-return;
    -- previously offline members were removed without their FP penalty.
    if options.withFp == true then
        pcall(function()
            MySQL.insert.await(
                'INSERT INTO faction_warnings (faction_id, character_id, issued_by, reason) VALUES (?, ?, ?, ?)',
                { factionId, characterId, char.id, 'Removed from faction (FP)' }
            )
        end)
        -- [FP SYSTEM] Apply the actual faction punish (60 FP, decays 1/payday,
        -- blocks joining any faction until cleared/pardoned).
        if FactionManagement then
            pcall(function()
                FactionManagement.setFP(characterId, 60, 'Kicked from faction with FP by ' .. tostring(char.id), char.id)
            end)
        end
    end

    local targetSource = onlineSourceForCharacter(characterId)
    if not targetSource then
        FactionCore.broadcastManagement(factionId, source,
            { localeKey = options.withFp == true and 'factions.msg.removed_from_the_faction_offline_fp' or 'factions.msg.removed_from_the_faction_offline', params = { member_display_name = tostring(FactionCore.memberDisplayName(characterId)) } })
        exports.sunset_core:SetFactionByCharacterId(characterId, nil, 0)
        FactionCore.auditLog(factionId, char.id, options.withFp == true and 'uninvite_fp_offline' or 'uninvite_offline', characterId, {})
        return { offline = true }
    end

    local targetName = FactionCore.memberDisplayName(characterId)
    if options.withFp then
        FactionCore.broadcastManagement(factionId, source,
            { localeKey = 'factions.msg.removed_from_the_faction_with_fp', params = { target_name = tostring(targetName) } })
    else
        FactionCore.broadcastManagement(factionId, source,
            { localeKey = 'factions.msg.removed_from_the_faction_2', params = { target_name = tostring(targetName) } })
    end
    exports.sunset_core:SetFaction(targetSource, nil, 0)
    local auditAction = options.withFp and 'uninvite_fp' or 'uninvite'
    FactionCore.auditLog(factionId, char.id, auditAction, characterId, {})
    FactionCore.notify(targetSource, exports.sunset_core:TFor(targetSource, 'factions.msg.you_were_removed_from_the_faction'), 'warning')
    return { offline = false, serverId = targetSource }
end

function FactionRoster.warnMember(source, characterId, reason)
    local char, factionId = rosterLeaderPerm(source, 'fwarn')
    if not char then return nil, factionId end

    characterId = tonumber(characterId)
    reason = tostring(reason or 'No reason given'):gsub('^%s+', ''):gsub('%s+$', '')
    if reason == '' then reason = 'No reason given' end
    reason = reason:sub(1, 256)
    if not characterId then return nil, { localeKey = 'factions.message.invalid_member' } end

    local member = getMemberRow(characterId)
    if not member or member.factionId ~= factionId then return nil, { localeKey = 'factions.message.that_member_is_not_in_your_faction' } end
    if FactionCore.isFactionLeader(characterId, factionId) then return nil, { localeKey = 'factions.message.you_cannot_warn_a_faction_leader' } end

    local allowed, err = canManageMember(source, char, factionId, member.grade, characterId)
    if not allowed then return nil, err end

    local targetSource = onlineSourceForCharacter(characterId)
    if not targetSource then
        return nil, { localeKey = 'factions.message.that_player_must_be_online_to_receive_a_faction' }
    end

    local warnCount = tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM faction_warnings WHERE faction_id = ? AND character_id = ?',
        { factionId, characterId }
    )) or 0
    if warnCount >= 3 then
        return nil, { localeKey = 'factions.message.this_member_already_has_3_3_faction_warnings' }
    end

    pcall(function()
        MySQL.insert.await(
            'INSERT INTO faction_warnings (faction_id, character_id, issued_by, reason) VALUES (?, ?, ?, ?)',
            { factionId, characterId, char.id, reason }
        )
    end)
    local nextCount = warnCount + 1
    FactionCore.auditLog(factionId, char.id, 'fwarn', characterId, { reason = reason, count = nextCount })
    FactionCore.broadcastManagement(factionId, source,
        { localeKey = 'factions.msg.issued_a_faction_warning_3_to', params = { next_count = math.floor(tonumber(nextCount) or 0), member_display_name = tostring(FactionCore.memberDisplayName(characterId)), reason = tostring(reason) } })
    FactionCore.notify(targetSource, exports.sunset_core:TFor(targetSource, 'factions.msg.faction_warning_3', { next_count = math.floor(tonumber(nextCount) or 0), reason = tostring(reason) }), 'warning', 8000)
    FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.msg.warning_issued_3', { next_count = math.floor(tonumber(nextCount) or 0), reason = tostring(reason) }), 'success')
    return { warns = nextCount, reason = reason }
end

exports.sunset_core:RegisterCallback('sunset:factionMemberRankDelta', function(source, characterId, delta)
    local ok, result, err = pcall(FactionRoster.adjustGrade, source, characterId, delta)
    if not ok then
        print(('[sunset:factionMemberRankDelta] error src=%s charId=%s delta=%s: %s'):format(
            tostring(source), tostring(characterId), tostring(delta), tostring(result)))
        return nil, { localeKey = 'factions.message.could_not_update_rank_try_again_or_contact_staff' }
    end
    return result, err
end)

exports.sunset_core:RegisterCallback('sunset:factionMemberKick', function(source, characterId, mode)
    mode = string.lower(tostring(mode or 'online'))
    if mode == 'offline' or mode == 'without_fp' then
        return FactionRoster.kickMember(source, characterId, { requireOnline = false, withFp = false })
    end
    if mode == 'with_fp' or mode == 'fp' then
        return FactionRoster.kickMember(source, characterId, { requireOnline = true, withFp = true })
    end
    return FactionRoster.kickMember(source, characterId, { requireOnline = true, withFp = false })
end)

exports.sunset_core:RegisterCallback('sunset:factionMemberWarn', function(source, characterId, reason)
    return FactionRoster.warnMember(source, characterId, reason)
end)

exports.sunset_core:RegisterCallback('sunset:factionSetGradeLabels', function(source, labels)
    local char = FactionCore.getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded' } end
    local factionId = select(1, FactionCore.getFactionOf(char))
    if not factionId then return nil, { localeKey = 'factions.message.no_faction' } end
    if not FactionCore.isFactionLeader(char.id, factionId) then
        return nil, { localeKey = 'factions.message.only_the_faction_leader_can_rename_ranks' }
    end
    local ok, err = FactionLabels.save(factionId, labels, char.id)
    if not ok then return nil, err or exports.sunset_core:TFor(source, 'factions.err.could_not_save_rank_names') end
    FactionCore.auditLog(factionId, char.id, 'grade_labels', nil, {})
    FactionCore.broadcastManagement(factionId, source, { localeKey = 'factions.msg.updated_faction_rank_names' })
    return { grades = FactionLabels.listForFaction(factionId) }
end)
