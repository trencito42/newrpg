local function getChar(source)
    return FactionCore.getChar(source)
end

local function getFactionOf(char)
    return FactionCore.getFactionOf(char)
end

local function hasPerm(source, perm)
    return FactionCore.hasPerm(source, perm)
end

local function memberManagePerm(source, perm)
    if type(FactionCore.hasManagePerm) == 'function' then
        return FactionCore.hasManagePerm(source, perm)
    end
    local char = getChar(source)
    if not char then return false end
    local factionId, grade = getFactionOf(char)
    if not factionId then return false end
    if FactionCore.isFactionLeader(char.id, factionId) then return true end
    if not Sunset.CapabilityAllowedForFaction(factionId, perm) and perm ~= 'invite' and perm ~= 'promote' then
        return false
    end
    return Sunset.HasFactionPerm(factionId, grade, perm)
end

local PendingFactionInvites = {}
local FACTION_INVITE_SECONDS = 120

local function addSociety(societyName, amount)
    if not societyName or amount <= 0 then return end
    pcall(function()
        MySQL.update.await('UPDATE societies SET balance = balance + ? WHERE name = ?', { amount, societyName })
    end)
end

local function nearFactionPoint(source, faction, point, radius)
    local coords = faction and faction[point]
    if not coords then return false end
    return FactionCore.distBetween(FactionCore.playerCoords(source), coords) <= (radius or 5.0)
end

function IsOnDuty(source)
    return FactionCore.isOnDuty(source)
end
exports('IsOnDuty', IsOnDuty)

local function setDuty(source, state)
    state = state == true
    FactionCore.setOnDuty(source, state)
    local char = getChar(source)
    if char then
        char.metadata = char.metadata or {}
        char.metadata.on_duty = state
        TriggerClientEvent('sunset:client:updateCharacter', source, char)
    end
    local factionId = char and select(1, getFactionOf(char)) or nil
    TriggerClientEvent('sunset:client:dutyState', source, state, factionId)
    TriggerEvent('sunset:server:taxiDutySync', source, state)
    -- [AUDIT P6-08] Let detention (escort release) and other systems react to duty changes.
    TriggerEvent('sunset:server:dutyChanged', source, state)
    if SyncPlayerCombatState then SyncPlayerCombatState(source) end
end

-- [AUDIT P6-09] Internal hook so police.lua (loaded later) can force duty off
-- on jail intake without a forward-reference to the local setDuty function.
AddEventHandler('sunset:faction:forceDutyOff', function(src)
    if FactionCore.isOnDuty(src) then
        setDuty(src, false)
    end
end)

exports.sunset_core:RegisterCallback('sunset:toggleDuty', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'factions.message.cannot_toggle_duty_your_character_is_not_loaded_reconnect' } end
    local factionId = getFactionOf(char)
    local faction = factionId and Sunset.Factions[factionId]
    if not faction or not faction.duty then return nil, { localeKey = 'factions.message.you_are_not_in_a_faction_with_duty_shifts' } end
    if not FactionCore.isOnDuty(source) and not nearFactionPoint(source, faction, 'hq', 6.0) then
        return nil, { localeKey = 'factions.message.go_to_your_faction_hq_to_start_duty' }
    end
    setDuty(source, not FactionCore.isOnDuty(source))
    return FactionCore.isOnDuty(source)
end)

exports.sunset_core:RegisterCallback('sunset:joinFactionHQ', function(source, factionId)
    local faction = Sunset.Factions[factionId]
    if not faction then return nil, { localeKey = 'factions.message.unknown_faction' } end
    return nil, faction.applicationsOpen
        and exports.sunset_core:TFor(source, 'factions.err.you_cannot_join_at_the_hq', { label = tostring(faction.label) })
        or exports.sunset_core:TFor(source, 'factions.err.is_not_recruiting_publicly_membership_requir', { label = tostring(faction.label) })
end)

local function leaveFactionForSource(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'factions.message.cannot_leave_the_faction_your_character_is_not_loaded' } end
    local oldFaction = getFactionOf(char)
    if not oldFaction then return nil, { localeKey = 'factions.message.you_are_not_in_a_faction' } end

    local wasLeader = FactionCore.isFactionLeader(char.id, oldFaction)
    setDuty(source, false)

    FactionCore.auditLog(oldFaction, char.id, 'leave', char.id, { voluntary = true, wasLeader = wasLeader })

    MySQL.update.await('DELETE FROM faction_leaders WHERE character_id = ?', { char.id })

    if not exports.sunset_core:SetFaction(source, nil, 0) then
        return nil, { localeKey = 'factions.message.could_not_leave_faction_try_again' }
    end

    -- [FP SYSTEM] Instant self-leave without a resignation request = +60 FP
    -- (decays 1/payday; blocks joining any faction until cleared/pardoned).
    if FactionManagement then
        pcall(function() FactionManagement.applySelfLeaveFP(source, char, oldFaction) end)
    end

    FactionCore.broadcastManagement(oldFaction, source, { localeKey = 'factions.msg.left_the_faction' }, {
        omitRank = true,
    })

    TriggerClientEvent('sunset:client:notify', source,
        ('You left %s. Your civilian job is unchanged.'):format(
            Sunset.Factions[oldFaction] and Sunset.Factions[oldFaction].label or oldFaction
        ), 'success')
    return true
end

exports.sunset_core:RegisterCallback('sunset:leaveFaction', function(source)
    return leaveFactionForSource(source)
end)

local function performFactionInvite(source, targetId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'factions.message.cannot_recruit_your_character_is_not_loaded_reconnect_and' } end
    FactionCore.ensureFactionMembership(source, char)
    char = getChar(source) or char
    local myFaction = getFactionOf(char)
    if not myFaction then return nil, { localeKey = 'factions.message.you_are_not_in_a_faction_6153f1' } end
    if not memberManagePerm(source, 'invite') then
        return nil, FactionCore.manageAccessError(source, 'invite', { localeKey = 'factions.action.invite_players' })
    end

    targetId = tonumber(targetId)
    if not targetId or targetId < 1 then
        return nil, { localeKey = 'factions.message.enter_a_valid_server_id_from_f10_scoreboard' }
    end
    if not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_value_is_not_online_use_f10_to_check', formatArgs = { targetId } }
    end
    if targetId == source then return nil, { localeKey = 'factions.message.you_cannot_invite_yourself' } end
    local target = getChar(targetId)
    if not target then return nil, { localeKey = 'factions.message.that_player_has_not_loaded_a_character_yet' } end
    local targetFaction = getFactionOf(target)
    if targetFaction then
        local label = Sunset.Factions[targetFaction] and Sunset.Factions[targetFaction].label or targetFaction
        return nil, { localeKey = 'factions.message.that_player_is_already_a_member_of_value', formatArgs = { label } }
    end
    -- [FP SYSTEM] Block inviting faction-punished characters early, so the
    -- leader learns why instead of the invite failing silently on accept.
    if FactionManagement then
        local fpOk, fpErr = FactionManagement.assertCanJoin(target.id)
        if not fpOk then return nil, fpErr end
    end
    if FactionCore.distBetween(FactionCore.playerCoords(source), FactionCore.playerCoords(targetId)) > 10.0 then
        return nil, { localeKey = 'factions.message.meet_the_accepted_applicant_first_they_must_be_within' }
    end
    local existing = PendingFactionInvites[targetId]
    if existing and existing.expiresAt > os.time() then
        return nil, { localeKey = 'factions.message.that_player_already_has_a_pending_faction_invitation_they' }
    end

    local faction = Sunset.Factions[myFaction]
    PendingFactionInvites[targetId] = {
        factionId = myFaction,
        inviterSource = source,
        inviterCharacterId = char.id,
        targetCharacterId = target.id,
        expiresAt = os.time() + FACTION_INVITE_SECONDS,
    }
    FactionCore.auditLog(myFaction, char.id, 'invite_sent', target.id, { expiresIn = FACTION_INVITE_SECONDS })
    FactionCore.broadcastManagement(myFaction, source,
        { localeKey = 'factions.msg.invited_to_join_the_faction', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(targetId)) } })
    TriggerClientEvent('sunset:faction:inviteReceived', targetId, {
        factionId = myFaction,
        label = faction and faction.label or myFaction,
        leader = exports.sunset_core:GetPlayerDisplayName(source),
        expiresIn = FACTION_INVITE_SECONDS,
    })
    return {
        label = faction and faction.label or myFaction,
        target = exports.sunset_core:GetPlayerDisplayName(targetId),
        expiresIn = FACTION_INVITE_SECONDS,
    }
end

exports.sunset_core:RegisterCallback('sunset:factionInvite', function(source, targetId)
    return performFactionInvite(source, targetId)
end)

local function performFactionAcceptInvite(source)
    local invite = PendingFactionInvites[source]
    if not invite then return nil, { localeKey = 'factions.message.you_do_not_have_a_pending_faction_invitation' } end
    PendingFactionInvites[source] = nil
    if invite.expiresAt <= os.time() then return nil, { localeKey = 'factions.message.your_faction_invitation_expired_ask_them_to_invite_you' } end

    local char = getChar(source)
    if not char or tonumber(char.id) ~= tonumber(invite.targetCharacterId) then
        return nil, { localeKey = 'factions.message.the_invitation_belongs_to_a_different_or_unloaded_character' }
    end
    if getFactionOf(char) then return nil, { localeKey = 'factions.message.you_are_already_a_member_of_a_faction' } end
    -- [FP SYSTEM] Faction-punished characters cannot join any faction.
    if FactionManagement then
        local fpOk, fpErr = FactionManagement.assertCanJoin(char.id)
        if not fpOk then return nil, fpErr end
    end
    local inviter = getChar(invite.inviterSource)
    if not inviter or select(1, getFactionOf(inviter)) ~= invite.factionId then
        return nil, { localeKey = 'factions.message.the_inviting_faction_member_is_no_longer_available_ask' }
    end
    if not exports.sunset_core:SetFaction(source, invite.factionId, 0) then
        return nil, { localeKey = 'factions.message.faction_membership_could_not_be_saved_please_try_again' }
    end

    local faction = Sunset.Factions[invite.factionId]
    FactionCore.auditLog(invite.factionId, invite.inviterCharacterId, 'invite_accepted', char.id, {})
    FactionCore.broadcastManagement(invite.factionId, source, ({ localeKey = 'factions.msg.joined_the_faction' }))
    if GetPlayerName(invite.inviterSource) then
        TriggerClientEvent('sunset:client:notify', invite.inviterSource,
            ('%s accepted the invitation to %s.'):format(
                exports.sunset_core:GetPlayerDisplayName(source), faction.label), 'success', 7000)
    end
    -- [QUESTS] faction chain: joined a faction.
    TriggerEvent('sunset:quest:progress', char.id, 'faction_joined', 1, { factionId = invite.factionId })
    return { factionId = invite.factionId, label = faction.label }
end

exports.sunset_core:RegisterCallback('sunset:factionAcceptInvite', function(source)
    return performFactionAcceptInvite(source)
end)

local function performFactionDeclineInvite(source)
    local invite = PendingFactionInvites[source]
    if not invite then return nil, { localeKey = 'factions.message.you_do_not_have_a_pending_faction_invitation' } end
    PendingFactionInvites[source] = nil
    local char = getChar(source)
    FactionCore.auditLog(invite.factionId, char and char.id or nil, 'invite_declined', invite.targetCharacterId, {})
    if char then
        FactionCore.broadcastManagement(invite.factionId, source, ({ localeKey = 'factions.msg.declined_the_faction_invitation' }))
    end
    if GetPlayerName(invite.inviterSource) then
        TriggerClientEvent('sunset:client:notify', invite.inviterSource,
            exports.sunset_core:TFor(invite.inviterSource, 'factions.message.value_declined_the_faction_invitation', exports.sunset_core:GetPlayerDisplayName(source)), 'info', 6000)
    end
    return true
end

exports.sunset_core:RegisterCallback('sunset:factionDeclineInvite', function(source)
    return performFactionDeclineInvite(source)
end)

function RunFactionInviteCommand(source, args)
    if source == 0 then return true end
    args = args or {}
    local targetId = tonumber(args[1])
    if not targetId then
        FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.msg.usage_finvite_server_id_use_f10'), 'error')
        return true
    end
    local ok, err = performFactionInvite(source, targetId)
    if ok then
        FactionCore.notify(source,
            exports.sunset_core:TFor(source, 'factions.msg.was_invited_to_and_has_seconds', { target = tostring(ok.target), label = tostring(ok.label), expires_in = math.floor(tonumber(ok.expiresIn) or 0) }),
            'success', 8000)
    else
        FactionCore.notify(source, err or exports.sunset_core:TFor(source, 'factions.msg.recruitment_failed_check_your_permission_and'), 'error', 8000)
    end
    return true
end
exports('RunFactionInviteCommand', RunFactionInviteCommand)

function RunFactionAcceptInviteCommand(source)
    if source == 0 then return true end
    local ok, err = performFactionAcceptInvite(source)
    if ok then
        FactionCore.notify(source,
            exports.sunset_core:TFor(source, 'factions.msg.you_joined_your_civilian_job_is', { label = tostring(ok.label) }),
            'success', 10000)
    else
        FactionCore.notify(source, err or exports.sunset_core:TFor(source, 'factions.msg.the_faction_invitation_could_not_be'), 'error', 8000)
    end
    return true
end
exports('RunFactionAcceptInviteCommand', RunFactionAcceptInviteCommand)

function RunFactionDeclineInviteCommand(source)
    if source == 0 then return true end
    local ok, err = performFactionDeclineInvite(source)
    if ok then
        FactionCore.notify(source, exports.sunset_core:TFor(source, 'factions.message.faction_invitation_declined'), 'info')
    else
        FactionCore.notify(source, err or exports.sunset_core:TFor(source, 'factions.msg.the_faction_invitation_could_not_be_2'), 'error')
    end
    return true
end
exports('RunFactionDeclineInviteCommand', RunFactionDeclineInviteCommand)

exports.sunset_core:RegisterCallback('sunset:factionPromote', function(source, targetId, newGrade)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'factions.message.cannot_change_rank_your_character_is_not_loaded_reconnect' } end
    if not hasPerm(source, 'promote') and not FactionCore.isFactionLeader(char.id, select(1, getFactionOf(char))) then
        return nil, FactionCore.accessError(source, 'promote', { localeKey = 'factions.action.change_a_faction_member_rank' })
    end

    local myFaction, myGrade = getFactionOf(char)
    if not myFaction then return nil, { localeKey = 'factions.message.no_faction' } end

    targetId = tonumber(targetId)
    newGrade = tonumber(newGrade)
    if not targetId or newGrade == nil then return nil, { localeKey = 'factions.message.usage_fpromote_id_grade' } end
    if not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end

    local target = getChar(targetId)
    local targetFaction, targetGrade
    if target then targetFaction, targetGrade = getFactionOf(target) end
    if not target or targetFaction ~= myFaction then return nil, { localeKey = 'factions.message.target_is_not_in_your_faction' } end

    local faction = Sunset.Factions[myFaction]
    if newGrade % 1 ~= 0 or not faction or not faction.grades[newGrade] then return nil, { localeKey = 'factions.message.invalid_grade' } end
    -- [SEC3] rank ordering: use the leader-aware effective grade, forbid self-promotion
    -- (previously source==target skipped the ceiling check) and forbid touching peers/superiors.
    local effGrade = FactionCore.getEffectiveGrade(char, myFaction)
    if newGrade >= effGrade then
        return nil, { localeKey = 'factions.message.you_cannot_promote_to_your_rank_or_higher' }
    end
    if source ~= targetId and (tonumber(targetGrade) or 0) >= effGrade
        and not FactionCore.isFactionLeader(char.id, myFaction) then
        return nil, { localeKey = 'factions.message.you_cannot_promote_to_your_rank_or_higher' }
    end

    if newGrade > (tonumber(targetGrade) or 0) then
        local eligible, eligibilityError = FactionCore.checkPromotionEligibility(myFaction, target.id, newGrade)
        if not eligible then return nil, eligibilityError end
    end

    exports.sunset_core:SetFaction(targetId, myFaction, newGrade)
    local gradeLabel = FactionLabels.get(myFaction, newGrade)
    FactionCore.auditLog(myFaction, char.id, 'promote', target.id, { grade = newGrade })
    FactionCore.broadcastManagement(myFaction, source,
        { localeKey = 'factions.msg.promoted_to', params = { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(targetId)), grade_label = tostring(gradeLabel) } })
    TriggerClientEvent('sunset:client:notify', targetId, exports.sunset_core:TFor(targetId, 'factions.message.promoted_to_value', gradeLabel), 'success')
    TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'factions.message.promoted_player_to_value', gradeLabel), 'success')
    return true
end)

exports.sunset_core:RegisterCallback('sunset:policeFine', function(source, targetId, amount, reason)
    return nil, { localeKey = 'factions.message.the_old_instant_fine_command_is_disabled_use_ticket' }
end)

function HasFactionPerm(source, perm)
    return hasPerm(source, perm)
end
exports('HasFactionPerm', HasFactionPerm)

exports.sunset_core:RegisterCallback('sunset:factionHeal', function(source, targetId)
    if not hasPerm(source, 'heal') then return nil, FactionCore.accessError(source, 'heal', { localeKey = 'factions.action.heal_a_patient' }) end
    targetId = tonumber(targetId) or source
    if not FactionCore.isOnline(targetId) then
        return nil, { localeKey = 'factions.message.patient_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end
    -- [SEC3] heal needs proximity (was heal-anyone-anywhere) and the same routing bucket
    if targetId ~= source then
        if GetPlayerRoutingBucket(source) ~= GetPlayerRoutingBucket(targetId)
            or FactionCore.distBetween(FactionCore.playerCoords(source), FactionCore.playerCoords(targetId)) > 6.0 then
            return nil, { localeKey = 'factions.message.you_must_be_near_the_patient' }
        end
    end
    TriggerClientEvent('sunset:admin:heal', targetId)
    return true
end)

exports.sunset_core:RegisterCallback('sunset:factionRevive', function(source, targetId)
    if not hasPerm(source, 'revive') then return nil, FactionCore.accessError(source, 'revive', { localeKey = 'factions.action.revive_a_patient' }) end
    targetId = tonumber(targetId)
    if not targetId or not GetPlayerName(targetId) then return nil, { localeKey = 'factions.message.usage_revive_player_id' } end

    local officerPos = FactionCore.playerCoords(source)
    local targetPos = FactionCore.playerCoords(targetId)
    if FactionCore.distBetween(officerPos, targetPos) > 4.0 then
        return nil, { localeKey = 'factions.message.you_must_be_near_the_patient' }
    end

    local isDowned = false
    pcall(function() isDowned = exports.sunset_death:IsPlayerDowned(targetId) end)
    if not isDowned then return nil, { localeKey = 'factions.message.target_is_not_downed' } end

    local ok, err = exports.sunset_death:RevivePlayer(targetId)
    if not ok then return nil, err end
    return true
end)

exports.sunset_core:RegisterCallback('sunset:mechanicShopRepair', function(source)
    local price = 250
    local faction = Sunset.Factions.mechanic
    if not nearFactionPoint(source, faction, 'hq', 8.0) then return nil, { localeKey = 'factions.message.you_must_be_at_ls_customs' } end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 or GetVehiclePedIsIn(ped, false) == 0 then return nil, { localeKey = 'factions.message.you_must_be_in_a_vehicle' } end
    if exports.sunset_core:RemoveMoney(source, 'cash', price, 'ls_customs_repair') then
        addSociety('mechanic', math.floor(price * 0.5))
        return true
    end
    if exports.sunset_core:RemoveMoney(source, 'bank', price, 'ls_customs_repair') then
        addSociety('mechanic', math.floor(price * 0.5))
        return true
    end
    return nil, { localeKey = 'factions.message.not_enough_money_value', formatArgs = { price } }
end)

local function nearFactionDepot(source, depot)
    if not depot or not depot.coords then return false end
    local coords = FactionCore.playerCoords(source)
    if FactionCore.distBetween(coords, depot.coords) <= 15.0 then return true end
    if depot.spawn and FactionCore.distBetween(coords, vector3(depot.spawn.x, depot.spawn.y, depot.spawn.z)) <= 15.0 then return true end
    if depot.lift and depot.lift.garage then
        local g = depot.lift.garage
        if FactionCore.distBetween(coords, vector3(g.x, g.y, g.z)) <= 15.0 then return true end
    end
    return false
end

local fleetVehicleLabel -- [SEC3] forward declaration (used below before its definition)
local function fleetEntryLabel(depot, vehicleModel)
    vehicleModel = string.lower(tostring(vehicleModel or ''))
    if depot and depot.vehicles then
        for _, entry in ipairs(depot.vehicles) do
            if string.lower(tostring(entry.model or '')) == vehicleModel then
                return entry.label or fleetVehicleLabel(entry.model)
            end
        end
    end
    return fleetVehicleLabel(vehicleModel)
end

local function broadcastFleetTake(source, factionId, faction, vehicleModel)
    local char = getChar(source)
    if not char or not faction or not faction.depot then return end
    local depot = faction.depot
    local vehicleLabel = fleetEntryLabel(depot, vehicleModel)
    local grade = FactionCore.getEffectiveGrade(char, factionId)
    local rank = FactionLabels.get(factionId, grade)
    local depotLabel = depot.label or 'fleet garage'
    FactionCore.broadcastManagement(factionId, source,
        { localeKey = 'factions.msg.took_out_from', params = { vehicle_label = tostring(vehicleLabel), depot_label = tostring(depotLabel) } },
        { actorId = source, rank = rank })
    FactionCore.auditLog(factionId, char.id, 'fleet_take', char.id, {
        vehicle = vehicleModel,
        label = vehicleLabel,
        depot = depotLabel,
    })
end

fleetVehicleLabel = function(model, fallback)
    model = tostring(model or '')
    if model == '' then return fallback or 'Vehicle' end
    return exports.sunset_vehicles:GetVehicleDisplayName(model)
end

local function fleetVehiclesForGrade(depot, grade, factionId)
    local list = {}
    grade = tonumber(grade) or 0
    if depot.vehicles then
        for _, entry in ipairs(depot.vehicles) do
            local minGrade = tonumber(entry.minGrade)
            if minGrade == nil then minGrade = 0 end
            if grade >= minGrade then
                list[#list + 1] = {
                    model = entry.model,
                    label = entry.label or fleetVehicleLabel(entry.model),
                    minGrade = minGrade,
                    minGradeLabel = factionId and FactionLabels.get(factionId, minGrade) or ('Rank ' .. minGrade),
                }
            end
        end
    elseif depot.vehicle then
        list[#list + 1] = {
            model = depot.vehicle,
            label = fleetVehicleLabel(depot.vehicle),
            minGrade = 0,
            minGradeLabel = factionId and FactionLabels.get(factionId, 0) or 'Trainee',
        }
    end
    return list
end

local function isAllowedFleetModel(depot, model, grade, factionId)
    model = string.lower(tostring(model or ''))
    for _, entry in ipairs(fleetVehiclesForGrade(depot, grade, factionId)) do
        if string.lower(entry.model) == model then return true end
    end
    return false
end

exports.sunset_core:RegisterCallback('sunset:factionFleetList', function(source, factionId)
    local char = getChar(source)
    local ownFaction = char and select(1, getFactionOf(char))
    local grade = char and ownFaction and FactionCore.getEffectiveGrade(char, ownFaction) or 0
    local faction = ownFaction and Sunset.Factions[ownFaction]
    if ownFaction ~= factionId or not faction or not faction.depot then return nil, { localeKey = 'factions.message.you_do_not_work_here' } end
    if not FactionCore.isOnDuty(source) then return nil, { localeKey = 'factions.message.go_on_duty_first' } end
    if not nearFactionDepot(source, faction.depot) then return nil, { localeKey = 'factions.message.you_must_be_at_the_fleet_garage' } end
    local vehicles = fleetVehiclesForGrade(faction.depot, grade, ownFaction)
    if #vehicles == 0 then return nil, { localeKey = 'factions.message.no_fleet_vehicles_available_for_your_rank' } end
    return vehicles
end)

exports.sunset_core:RegisterCallback('sunset:factionRequestFleet', function(source, factionId, vehicleModel)
    local char = getChar(source)
    local ownFaction = char and select(1, getFactionOf(char))
    local grade = char and ownFaction and FactionCore.getEffectiveGrade(char, ownFaction) or 0
    local faction = ownFaction and Sunset.Factions[ownFaction]
    if ownFaction ~= factionId or not faction or not faction.depot then return nil, { localeKey = 'factions.message.you_do_not_work_here' } end
    if not FactionCore.isOnDuty(source) then return nil, { localeKey = 'factions.message.go_on_duty_first' } end
    if not nearFactionDepot(source, faction.depot) then return nil, { localeKey = 'factions.message.you_must_be_at_the_fleet_garage' } end

    local depot = faction.depot
    local model = vehicleModel or depot.vehicle
    if not model then return nil, { localeKey = 'factions.message.no_vehicle_selected' } end
    if not isAllowedFleetModel(depot, model, grade, ownFaction) then return nil, { localeKey = 'factions.message.vehicle_not_available_for_your_rank' } end
    return { vehicle = model, platePrefix = depot.platePrefix }
end)

RegisterNetEvent('sunset:factionRegisterFleetVehicle', function(networkId, factionId, vehicleModel)
    local src = source
    if not exports.sunset_core:RateLimit(src, 'fleetRegister', 3000) then return end -- [SEC3] spam/duplicate fleet-take broadcasts
    networkId = tonumber(networkId)
    factionId = tostring(factionId or '')
    vehicleModel = tostring(vehicleModel or '')
    local char = getChar(src)
    local ownFaction = char and select(1, getFactionOf(char))
    local grade = char and ownFaction and FactionCore.getEffectiveGrade(char, ownFaction) or 0
    local faction = ownFaction and Sunset.Factions[ownFaction]
    if not networkId or ownFaction ~= factionId or not faction or not faction.depot then return end
    if not FactionCore.isOnDuty(src) then return end
    if vehicleModel == '' or not isAllowedFleetModel(faction.depot, vehicleModel, grade, ownFaction) then return end

    local vehicle = 0
    for _ = 1, 20 do
        vehicle = NetworkGetEntityFromNetworkId(networkId)
        if vehicle ~= 0 and DoesEntityExist(vehicle) then break end
        Wait(100)
    end
    local ped = GetPlayerPed(src)
    if vehicle == 0 or not DoesEntityExist(vehicle) or ped == 0 then return end
    if GetPedInVehicleSeat(vehicle, -1) ~= ped then return end
    if GetEntityModel(vehicle) ~= joaat(vehicleModel) then return end

    local vehCoords = GetEntityCoords(vehicle)
    local depot = faction.depot
    local nearSpawn = FactionCore.distBetween(vehCoords, depot.spawn) <= 30.0
    local nearExit = depot.exitSpawn and FactionCore.distBetween(vehCoords, depot.exitSpawn) <= 35.0
    if not nearSpawn and not nearExit then return end

    Entity(vehicle).state:set('sunsetFactionVehicle', factionId, true)
    Entity(vehicle).state:set('sunsetVehicleDisplayName', fleetEntryLabel(depot, vehicleModel), true)
    Entity(vehicle).state:set('sunsetProtectedVehicle', true, true)
    broadcastFleetTake(src, factionId, faction, vehicleModel)
end)

exports.sunset_core:RegisterCallback('sunset:mechanicRepair', function(source, targetId)
    if not hasPerm(source, 'repair') then return nil, FactionCore.accessError(source, 'repair', { localeKey = 'factions.action.repair_a_customer_vehicle' }) end
    targetId = tonumber(targetId) or source
    if not GetPlayerName(targetId) then
        return nil, { localeKey = 'factions.message.player_id_value_is_not_online_use_f10_to', formatArgs = { tostring(targetId or '?') } }
    end

    local officerPos = FactionCore.playerCoords(source)
    local targetPos = FactionCore.playerCoords(targetId)
    if FactionCore.distBetween(officerPos, targetPos) > 6.0 then
        return nil, { localeKey = 'factions.message.you_must_be_near_the_vehicle' }
    end
    local targetPed = GetPlayerPed(targetId)
    if not targetPed or targetPed == 0 or GetVehiclePedIsIn(targetPed, false) == 0 then
        return nil, { localeKey = 'factions.message.target_must_be_inside_a_vehicle' }
    end

    TriggerClientEvent('sunset:faction:repairVehicle', targetId)
    return true
end)

local PendingTaxiFares = {}

exports.sunset_core:RegisterCallback('sunset:taxiFare', function(source, targetId, amount)
    if not hasPerm(source, 'fare') then return nil, FactionCore.accessError(source, 'fare', { localeKey = 'factions.action.charge_a_taxi_fare' }) end
    targetId = tonumber(targetId)
    amount = math.floor(tonumber(amount) or 0)
    if not targetId or amount < 1 or amount > 1000 then
        return nil, { localeKey = 'factions.message.invalid_fare_amount_1_1_000' }
    end
    if not GetPlayerName(targetId) then return nil, { localeKey = 'factions.message.passenger_not_found' } end
    if targetId == source then return nil, { localeKey = 'factions.message.you_cannot_charge_yourself_a_fare' } end

    local driverPed = GetPlayerPed(source)
    local passengerPed = GetPlayerPed(targetId)
    if not driverPed or not passengerPed or driverPed == 0 or passengerPed == 0 then
        return nil, { localeKey = 'factions.message.invalid_player_entity' }
    end

    local driverVeh = GetVehiclePedIsIn(driverPed, false)
    local passVeh = GetVehiclePedIsIn(passengerPed, false)
    if driverVeh == 0 or driverVeh ~= passVeh then
        return nil, { localeKey = 'factions.message.the_passenger_must_be_inside_your_taxi_vehicle' }
    end

    local driverChar = getChar(source)
    local driverName = driverChar and (driverChar.firstname .. ' ' .. driverChar.lastname) or (exports.sunset_core:GetPlayerDisplayName(source) or ('Player %d'):format(source))

    PendingTaxiFares[targetId] = {
        driverSource = source,
        driverName = driverName,
        amount = amount,
        expiresAt = os.time() + 30,
    }

    TriggerClientEvent('sunset:faction:taxiFareOffered', targetId, {
        driverName = driverName,
        amount = amount,
        expiresIn = 30,
    })

    return { sent = true, amount = amount }
end)

exports.sunset_core:RegisterCallback('sunset:taxiAcceptFare', function(source)
    local fare = PendingTaxiFares[source]
    if not fare or fare.expiresAt < os.time() then
        PendingTaxiFares[source] = nil
        return nil, { localeKey = 'factions.message.no_active_taxi_fare_offer_or_offer_has_expired' }
    end

    local driverSrc = fare.driverSource
    if not GetPlayerName(driverSrc) then
        PendingTaxiFares[source] = nil
        return nil, { localeKey = 'factions.message.taxi_driver_is_no_longer_online' }
    end

    local amount = fare.amount
    PendingTaxiFares[source] = nil -- [SEC2] consume the offer before yielding money calls (double-accept)
    if not exports.sunset_core:RemoveMoney(source, 'cash', amount, 'taxi') then
        if not exports.sunset_core:RemoveMoney(source, 'bank', amount, 'taxi') then
            return nil, { localeKey = 'factions.message.you_do_not_have_enough_cash_or_bank_balance' }
        end
    end

    local cut = math.floor(amount * (Sunset.Taxi and Sunset.Taxi.companyCut or 0.12))
    exports.sunset_core:AddMoney(driverSrc, 'cash', amount - cut, 'taxi_fare')
    addSociety('taxi', cut)

    PendingTaxiFares[source] = nil

    TriggerClientEvent('sunset:client:notify', driverSrc, exports.sunset_core:TFor(driverSrc, 'factions.message.passenger_paid_fare_value', amount), 'success')
    return { paid = true, amount = amount, driverName = fare.driverName }
end)

exports.sunset_core:RegisterCallback('sunset:taxiDeclineFare', function(source)
    local fare = PendingTaxiFares[source]
    if not fare then return nil, { localeKey = 'factions.message.no_pending_fare_offer' } end

    local driverSrc = fare.driverSource
    PendingTaxiFares[source] = nil

    if GetPlayerName(driverSrc) then
        TriggerClientEvent('sunset:client:notify', driverSrc, exports.sunset_core:TFor(driverSrc, 'factions.message.passenger_declined_the_taxi_fare_offer'), 'error')
    end
    return true
end)

local function sellIllegalAtHQ(source, factionId)
    local char = getChar(source)
    if not char or getFactionOf(char) ~= factionId then return nil, { localeKey = 'factions.message.wrong_faction' } end
    if not FactionCore.isOnDuty(source) then return nil, { localeKey = 'factions.message.you_must_be_on_duty' } end

    local prices = Sunset.IllegalSellPrices and Sunset.IllegalSellPrices[factionId]
    if not prices then return nil, { localeKey = 'factions.message.nothing_to_sell_here' } end

    -- [SEC2] /sellpouch and /fence were callable from anywhere: require the faction stash
    -- (where the sell marker lives) and serialise per source.
    if not nearFactionPoint(source, Sunset.Factions[factionId], 'stash', 6.0) then
        return nil, { localeKey = 'factions.message.nothing_to_sell_here' }
    end
    if not exports.sunset_core:RateLimit(source, 'illegalSell', 1500) then
        return nil, { localeKey = 'factions.message.nothing_to_sell_here' }
    end

    local sold = 0
    local total = 0

    if prices.item then
        if not hasPerm(source, 'sell') then return nil, { localeKey = 'factions.message.rank_too_low' } end
        if not exports.sunset_inventory:HasItem(source, prices.item, 1) then
            return nil, { localeKey = 'factions.message.you_need_value_to_sell', formatArgs = { prices.label or prices.item } }
        end
        -- [SEC2] pay ONLY if the item was really removed (parallel calls used to be paid twice)
        if exports.sunset_inventory:RemoveItem(source, prices.item, 1) ~= true then
            return nil, { localeKey = 'factions.message.you_need_value_to_sell', formatArgs = { prices.label or prices.item } }
        end
        exports.sunset_core:AddMoney(source, 'cash', prices.price, 'illegal_sale')
        sold = 1
        total = prices.price
    else
        if not hasPerm(source, 'fence') then return nil, { localeKey = 'factions.message.rank_too_low' } end
        for _, row in ipairs(prices) do
            if exports.sunset_inventory:HasItem(source, row.item, 1) then
                if exports.sunset_inventory:RemoveItem(source, row.item, 1) == true then
                    exports.sunset_core:AddMoney(source, 'cash', row.price, 'fence_sale')
                    sold = sold + 1
                    total = total + row.price
                    break
                end
            end
        end
        if sold < 1 then return nil, { localeKey = 'factions.message.no_fenceable_items_in_inventory' } end
    end

    return { sold = sold, total = total }
end

exports.sunset_core:RegisterCallback('sunset:illegalSell', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'factions.message.cannot_sell_faction_goods_your_character_is_not_loaded' } end
    local factionId = getFactionOf(char)
    if not factionId then return nil, { localeKey = 'factions.message.not_in_a_faction' } end
    return sellIllegalAtHQ(source, factionId)
end)

exports.sunset_core:RegisterCallback('sunset:getFactionPanel', function(source)
    local char = getChar(source)
    if not char then return nil end
    local factionId, grade = getFactionOf(char)
    local faction = factionId and Sunset.Factions[factionId]
    if not faction then
        local jobId = select(1, Sunset.GetCharacterJob(char))
        local job = Sunset.CivilianJobs[jobId]
        return {
            job = jobId,
            label = job and job.label or exports.sunset_core:TFor(source, 'admin.word.unemployed'),
            onDuty = false,
            isFaction = false,
        }
    end
    local gradeRow = Sunset.GetFactionGrade(factionId, grade)
    local motd = ''
    pcall(function()
        local row = MySQL.single.await('SELECT message FROM faction_motd WHERE faction_id = ?', { factionId })
        motd = row and row.message or ''
    end)
    return {
        job = factionId,
        label = faction.label,
        type = faction.type,
        factionType = faction.factionType,
        description = faction.description,
        grade = grade,
        gradeLabel = gradeRow and gradeRow.label or '—',
        onDuty = FactionCore.isOnDuty(source),
        salary = gradeRow and gradeRow.salary or 0,
        depot = faction.depot and faction.depot.label or nil,
        commands = Sunset.GetFactionCommandsForGrade(factionId, grade, FactionCore.isFactionLeader(char.id, factionId)),
        isFaction = true,
        civilianJob = select(1, Sunset.GetCharacterJob(char)),
        motd = motd,
        isLeader = FactionCore.isFactionLeader(char.id, factionId),
    }
end)

local function factionRoster(factionId)
    local leaders = {}
    for _, row in ipairs(MySQL.query.await([[
        SELECT fl.character_id, c.firstname, c.lastname
        FROM faction_leaders fl
        LEFT JOIN characters c ON c.id = fl.character_id
        WHERE fl.faction_id = ?
        ORDER BY fl.assigned_at ASC
    ]], { factionId }) or {}) do
        leaders[tonumber(row.character_id)] = true
    end

    local online = {}
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local member = src and getChar(src)
        if member and select(1, getFactionOf(member)) == factionId then
            online[tonumber(member.id)] = { serverId = src, onDuty = FactionCore.isOnDuty(src) }
        end
    end

    local warnRows = MySQL.query.await(
        'SELECT character_id, COUNT(*) AS total FROM faction_warnings WHERE faction_id = ? GROUP BY character_id',
        { factionId }
    ) or {}
    local warnCounts = {}
    for _, row in ipairs(warnRows) do
        warnCounts[tonumber(row.character_id)] = tonumber(row.total) or 0
    end

    local roster = {}
    for _, row in ipairs(MySQL.query.await([[
        SELECT c.id, c.firstname, c.lastname, c.metadata
        FROM faction_membership fm
        JOIN characters c ON c.id = fm.character_id
        WHERE fm.faction_id = ?
    ]], { factionId }) or {}) do
        local metadata = row.metadata
        if type(metadata) == 'string' then
            local ok, decoded = pcall(json.decode, metadata)
            metadata = ok and decoded or {}
        end
        metadata = type(metadata) == 'table' and metadata or {}
        if metadata.faction == factionId then
            local grade = tonumber(metadata.faction_grade) or 0
            local gradeRow = Sunset.GetFactionGrade(factionId, grade)
            local presence = online[tonumber(row.id)]
            roster[#roster + 1] = {
                characterId = tonumber(row.id),
                serverId = presence and presence.serverId or nil,
                name = (('%s %s'):format(row.firstname or '', row.lastname or '')):gsub('^%s+', ''):gsub('%s+$', ''),
                grade = grade,
                gradeLabel = FactionLabels.get(factionId, grade),
                leader = leaders[tonumber(row.id)] == true,
                online = presence ~= nil,
                onDuty = presence and presence.onDuty or false,
                warns = warnCounts[tonumber(row.id)] or 0,
            }
        end
    end
    table.sort(roster, function(a, b)
        if a.leader ~= b.leader then return a.leader end
        if a.online ~= b.online then return a.online end
        if a.grade ~= b.grade then return a.grade > b.grade end
        return a.name < b.name
    end)
    return roster
end

exports.sunset_core:RegisterCallback('sunset:factionDashboard', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'factions.message.your_character_is_not_loaded' } end
    FactionCore.ensureFactionMembership(source, char)
    char = getChar(source) or char
    local factionId, grade = getFactionOf(char)
    local faction = factionId and Sunset.Factions[factionId]
    if not faction then return nil, { localeKey = 'factions.message.you_are_not_a_member_of_a_faction_use' } end
    local gradeRow = Sunset.GetFactionGrade(factionId, grade)
    local motd = ''
    local motdOk, motdRow = pcall(function()
        return MySQL.single.await('SELECT message FROM faction_motd WHERE faction_id = ?', { factionId })
    end)
    if not motdOk then return nil, { localeKey = 'factions.message.faction_data_could_not_be_read_from_the_database' } end
    if motdRow then motd = tostring(motdRow.message or '') end
    local activityOk, activity = pcall(function()
        return MySQL.single.await([[
            SELECT COUNT(*) AS total FROM faction_audit_log
            WHERE faction_id = ? AND actor_character_id = ?
              AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
        ]], { factionId, char.id })
    end)
    if not activityOk then return nil, { localeKey = 'factions.message.weekly_faction_report_could_not_be_read_please_try' } end
    local rosterOk, roster = pcall(factionRoster, factionId)
    if not rosterOk then return nil, { localeKey = 'factions.message.faction_roster_could_not_be_read_please_try_again' } end
    -- [FP SYSTEM] batch-attach join days + FP to every roster member.
    pcall(function() roster = FactionManagement.enrichRoster(roster) end)
    local isLeader = FactionCore.isFactionLeader(char.id, factionId)
    local permissions = {
        leader = isLeader,
        invite = isLeader or memberManagePerm(source, 'invite'),
        motd = isLeader or memberManagePerm(source, 'fmotd'),
        giverank = isLeader or memberManagePerm(source, 'giverank'),
        uninvite = isLeader or memberManagePerm(source, 'uninvite'),
        promote = isLeader or memberManagePerm(source, 'promote'),
        warn = isLeader or memberManagePerm(source, 'fwarn'),
        renameRanks = isLeader,
        rankMembers = isLeader or memberManagePerm(source, 'giverank') or memberManagePerm(source, 'promote'),
        kickMembers = isLeader or memberManagePerm(source, 'uninvite'),
        manageResignations = isLeader or memberManagePerm(source, 'uninvite'),
        pardonFp = isLeader or memberManagePerm(source, 'uninvite'),
    }
    local grades = FactionLabels.listForFaction(factionId)
    local societyBalance = nil
    if faction.society then
        pcall(function()
            local row = MySQL.single.await('SELECT balance FROM societies WHERE name = ? LIMIT 1', { faction.society })
            societyBalance = row and tonumber(row.balance) or 0
        end)
    end
    -- [FP SYSTEM] pending resignations for leaders/managers
    local pendingResignations = {}
    if permissions.manageResignations and FactionManagement then
        local okR, rows = pcall(function()
            return MySQL.query.await([[
                SELECT fr.id, fr.character_id, fr.reason, fr.created_at,
                       c.firstname, c.lastname, fm.joined_at
                FROM faction_resignations fr
                LEFT JOIN characters c ON c.id = fr.character_id
                LEFT JOIN faction_membership fm ON fm.character_id = fr.character_id
                WHERE fr.faction_id = ? AND fr.status = 'pending'
                ORDER BY fr.created_at ASC LIMIT 50
            ]], { factionId })
        end)
        if okR and rows then
            local now = os.time()
            for _, row in ipairs(rows) do
                local joinedAt = row.joined_at and tonumber(row.joined_at) or nil
                pendingResignations[#pendingResignations + 1] = {
                    id = tonumber(row.id),
                    characterId = tonumber(row.character_id),
                    name = (('%s %s'):format(row.firstname or '', row.lastname or '')):gsub('^%s+', ''):gsub('%s+$', ''),
                    reason = row.reason or '',
                    daysInFaction = joinedAt and math.floor((now - joinedAt) / 86400) or nil,
                }
            end
        end
    end

    return {
        id = factionId,
        label = faction.label,
        type = faction.type,
        factionType = faction.factionType,
        description = faction.description,
        grade = grade,
        gradeLabel = FactionLabels.get(factionId, grade),
        salary = gradeRow and gradeRow.salary or 0,
        onDuty = FactionCore.isOnDuty(source),
        leader = isLeader,
        permissions = permissions,
        grades = grades,
        commands = Sunset.GetFactionCommandsForGrade(factionId, grade, isLeader),
        motd = motd,
        depot = faction.depot and faction.depot.label or 'No fleet garage',
        societyBalance = societyBalance,
        report = { current = tonumber(activity and activity.total) or 0, target = faction.weeklyReportTarget or 0 },
        members = roster,
        pendingResignations = pendingResignations,
        myFp = FactionManagement and select(1, FactionManagement.getFP(char.id)) or 0,
        viewerCharacterId = char.id,
        viewerGrade = grade,
    }
end)

exports.sunset_core:RegisterCallback('sunset:factionDirectory', function(source)
    local viewerChar = getChar(source)
    if not viewerChar then return nil, { localeKey = 'factions.message.your_character_is_not_loaded' } end
    local viewerFaction = getFactionOf(viewerChar) -- [SEC3]
    local result, byId = {}, {}
    for factionId, faction in pairs(Sunset.Factions or {}) do
        local entry = {
            id = factionId, label = faction.label, type = faction.type,
            factionType = faction.factionType, description = faction.description,
            marker = faction.marker, blipColor = faction.blip and faction.blip.color,
            applicationsOpen = faction.applicationsOpen == true,
            applicationLabel = faction.type == 'illegal' and 'Invite only'
                or (faction.applicationsOpen and 'Applications open — Discord / website' or 'Applications closed'),
            online = 0, onDuty = 0, total = 0, leaders = {},
        }
        byId[factionId] = entry
        result[#result + 1] = entry
    end
    local memberFactionByCharId = {}
    local memberCountsOk, memberCountRows = pcall(function()
        return MySQL.query.await([[
            SELECT fm.faction_id, fm.character_id
            FROM faction_membership fm
        ]], {})
    end)
    if not memberCountsOk then return nil, { localeKey = 'factions.message.faction_directory_could_not_read_member_data_please_try' } end
    for _, row in ipairs(memberCountRows or {}) do
        memberFactionByCharId[row.character_id] = row.faction_id
        local entry = byId[row.faction_id]
        if entry then entry.total = entry.total + 1 end
    end
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local member = src and getChar(src)
        local factionId = member and select(1, getFactionOf(member))
        local entry = factionId and byId[factionId]
        if entry then
            entry.online = entry.online + 1
            if FactionCore.isOnDuty(src) then entry.onDuty = entry.onDuty + 1 end
        end
    end
    local leadersOk, leaderRows = pcall(function()
        return MySQL.query.await([[
            SELECT fl.faction_id, fl.character_id, c.firstname, c.lastname FROM faction_leaders fl
            LEFT JOIN characters c ON c.id = fl.character_id ORDER BY fl.assigned_at ASC
        ]], {})
    end)
    if not leadersOk then return nil, { localeKey = 'factions.message.faction_directory_could_not_read_leadership_data_please_try' } end
    for _, row in ipairs(leaderRows or {}) do
        if memberFactionByCharId[row.character_id] ~= row.faction_id then goto continue_leader end
        local entry = byId[row.faction_id]
        -- [SEC3] do not expose illegal-faction leadership to non-members
        if entry and entry.type == 'illegal' and row.faction_id ~= viewerFaction then goto continue_leader end
        if entry then entry.leaders[#entry.leaders + 1] = (('%s %s'):format(row.firstname or '', row.lastname or '')):gsub('%s+$', '') end
        ::continue_leader::
    end
    table.sort(result, function(a, b)
        if a.type ~= b.type then return a.type == 'legal' end
        return a.label < b.label
    end)
    return result
end)

exports.sunset_core:RegisterCallback('sunset:factionDirectoryDetail', function(source, factionId)
    local viewerChar = getChar(source)
    if not viewerChar then return nil, { localeKey = 'factions.message.your_character_is_not_loaded' } end
    factionId = tostring(factionId or '')
    local faction = Sunset.Factions[factionId]
    if not faction then return nil, { localeKey = 'factions.message.faction_not_found' } end
    -- [SEC3] illegal factions: roster/leaders/server ids only for their own members
    local hideRoster = faction.type == 'illegal' and getFactionOf(viewerChar) ~= factionId

    local motd = ''
    pcall(function()
        local row = MySQL.single.await('SELECT message FROM faction_motd WHERE faction_id = ?', { factionId })
        motd = row and tostring(row.message or '') or ''
    end)

    local leaders = {}
    for _, row in ipairs(hideRoster and {} or MySQL.query.await([[
        SELECT fl.character_id, c.firstname, c.lastname
        FROM faction_leaders fl
        LEFT JOIN characters c ON c.id = fl.character_id
        WHERE fl.faction_id = ?
        ORDER BY fl.assigned_at ASC
    ]], { factionId }) or {}) do
        leaders[#leaders + 1] = (('%s %s'):format(row.firstname or '', row.lastname or '')):gsub('%s+$', '')
    end

    local roster = factionRoster(factionId)
    local members = {}
    local onlineCount = 0
    for _, m in ipairs(roster or {}) do
        if m.online then onlineCount = onlineCount + 1 end
        if not hideRoster then members[#members + 1] = {
            name = m.name,
            rank = m.gradeLabel,
            online = m.online,
            onDuty = m.onDuty,
            leader = m.leader,
            serverId = m.serverId,
        } end
    end

    return {
        id = factionId,
        label = faction.label,
        type = faction.type,
        factionType = faction.factionType,
        description = faction.description,
        applicationsOpen = faction.applicationsOpen == true,
        applicationLabel = faction.type == 'illegal' and 'Invite only'
            or (faction.applicationsOpen and 'Applications open — Discord / website' or 'Applications closed'),
        motd = motd,
        leaders = leaders,
        members = members,
        online = onlineCount,
        total = #roster,
    }
end)

AddEventHandler('playerDropped', function()
    PendingFactionInvites[source] = nil
    for target, invite in pairs(PendingFactionInvites) do
        if invite.inviterSource == source then PendingFactionInvites[target] = nil end
    end
    FactionCore.setOnDuty(source, false)
    if Detention and Detention.clear then Detention.clear(source) end
end)

AddEventHandler('sunset:server:characterSelected', function(source, _charId)
    FactionCore.setOnDuty(source, false)
    local char = getChar(source)
    if char then
        FactionCore.ensureFactionMembership(source, char)
        char = getChar(source) or char
    end
    local factionId = char and select(1, getFactionOf(char)) or nil
    TriggerClientEvent('sunset:client:dutyState', source, false, factionId, true)
end)

AddEventHandler('sunset:server:factionChanged', function(source, factionId, _grade, previousFactionId)
    local newFactionId = factionId or nil
    local oldFactionId = previousFactionId or nil
    if newFactionId ~= oldFactionId then
        FactionCore.setOnDuty(source, false)
        TriggerClientEvent('sunset:client:dutyState', source, false, newFactionId, true)
    end
end)

function GetDutyState(source)
    return FactionCore.isOnDuty(source)
end
exports('GetDutyState', GetDutyState)

function IsFactionLeader(source)
    local char = getChar(source)
    local factionId = char and select(1, getFactionOf(char))
    return factionId ~= nil and FactionCore.isFactionLeader(char.id, factionId)
end
exports('IsFactionLeader', IsFactionLeader)

local function factionHqPayload(source)
    local char = getChar(source)
    if not char then return nil end
    local factionId = select(1, getFactionOf(char))
    if not factionId then return nil end
    local faction = Sunset.Factions[factionId]
    local hq = faction and faction.hq
    if not hq then return nil end
    local heading = 0.0
    if faction.depot and faction.depot.spawn then
        heading = faction.depot.spawn.w or 0.0
    end
    return {
        factionId = factionId,
        label = faction.label or factionId,
        hidden = faction.type == 'illegal',
        x = hq.x,
        y = hq.y,
        z = hq.z,
        w = heading,
    }
end

function GetLeaderHqSpawn(source)
    return factionHqPayload(source)
end
exports('GetLeaderHqSpawn', GetLeaderHqSpawn)

function GetFactionHqSpawn(source)
    return factionHqPayload(source)
end
exports('GetFactionHqSpawn', GetFactionHqSpawn)

exports.sunset_core:RegisterCallback('sunset:getLeaderSpawnHq', function(source)
    local hq = factionHqPayload(source)
    if not hq then return nil end
    return { factionId = hq.factionId, label = hq.label, hidden = hq.hidden == true }
end)

exports('AddSocietyMoney', addSociety)
