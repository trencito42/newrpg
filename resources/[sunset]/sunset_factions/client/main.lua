local onDuty = false
local myFaction = nil
local illegalBlip = nil
local fleetVehicle = nil
local isCuffed = false
local pendingFleetDepot = nil
local pendingFleetId = nil

local function clearIllegalBlip()
    if illegalBlip and DoesBlipExist(illegalBlip) then
        RemoveBlip(illegalBlip)
    end
    illegalBlip = nil
end

local function refreshIllegalBlip()
    clearIllegalBlip()
    local char = exports.sunset_core:GetCharacter()
    if not char then return end
    local factionId = Sunset.GetCharacterFaction(char)
    local faction = factionId and Sunset.Factions[factionId]
    if not faction or faction.type ~= 'illegal' or not faction.hq or not faction.blip then return end
    illegalBlip = Sunset.CreateSafeBlip(faction.hq, {
        sprite = faction.blip.sprite or 84,
        color = faction.blip.color or 1,
        scale = faction.blip.scale or 0.8,
        name = exports.sunset_core:Translate('factions.msg.hq', { label = tostring(faction.label) }),
        shortRange = true
    })
end

local function getServerJobInfo()
    local info = Sunset.AwaitCallback('sunset:getFactionPanel')
    if info and info.job then return info end
    local char = exports.sunset_core:GetCharacter()
    return { job = char and char.job or 'unemployed', label = exports.sunset_core:Translate('impound.word.unknown'), onDuty = onDuty }
end

local function deleteFleetVehicle()
    if fleetVehicle and DoesEntityExist(fleetVehicle) then
        SetEntityAsMissionEntity(fleetVehicle, true, true)
        DeleteVehicle(fleetVehicle)
    end
    fleetVehicle = nil
end

local function resolveSpawnZ(x, y, z)
    RequestCollisionAtCoord(x, y, z)
    local found, groundZ = GetGroundZFor_3dCoord(x, y, z + 50.0, false)
    if found then
        return groundZ + 0.35
    end
    return z
end

local function spawnFleetVehicle(depot, factionId, vehicleModel)
    if not depot or not depot.spawn then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.no_fleet_garage_configured'), 'error')
        return
    end

    local char = exports.sunset_core:GetCharacter()
    local myFaction = char and Sunset.GetCharacterFaction(char)
    if not myFaction or myFaction ~= factionId then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.you_do_not_work_here'), 'error')
        return
    end
    if not exports.sunset_factions:IsOnDuty() then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.go_on_duty_at_hq_first_e'), 'error')
        return
    end

    local authorized, err = Sunset.AwaitCallback('sunset:factionRequestFleet', factionId, vehicleModel)
    if not authorized then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.fleet_request_denied'), 'error')
        return
    end

    deleteFleetVehicle()

    local modelName = authorized.vehicle or vehicleModel or depot.vehicle or 'sultan'
    local model = joaat(modelName)
    RequestModel(model)
    local timeout = GetGameTimer() + 8000
    while not HasModelLoaded(model) do
        if GetGameTimer() > timeout then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.failed_to_load_vehicle_model'), 'error')
            return
        end
        Wait(10)
    end

    local s = depot.spawn
    local spawnZ = resolveSpawnZ(s.x, s.y, s.z)
    -- [ANTICHEAT] whitelist fleet spawn for the vehspawn ledger detector
    TriggerServerEvent('sunset:anticheat:markLegitLocal', 'vehicle_spawn', 15)
    local veh = CreateVehicle(model, s.x, s.y, spawnZ, s.w, true, false)
    if veh == 0 then
        SetModelAsNoLongerNeeded(model)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.could_not_spawn_vehicle_clear_the_area'), 'error')
        return
    end

    SetEntityCoords(veh, s.x, s.y, spawnZ, false, false, false, false)
    SetEntityHeading(veh, s.w)
    SetVehicleOnGroundProperly(veh)
    local prefix = authorized.platePrefix or depot.platePrefix or 'SUN'
    SetVehicleNumberPlateText(veh, prefix .. math.random(100, 999))
    SetEntityAsMissionEntity(veh, true, true)
    SetVehicleHasBeenOwnedByPlayer(veh, true)
    SetVehicleNeedsToBeHotwired(veh, false)
    SetVehRadioStation(veh, 'OFF')
    if factionId == 'taxi' then
        SetVehicleColours(veh, 88, 88)
    end
    SetModelAsNoLongerNeeded(model)

    fleetVehicle = veh
    TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)
    Wait(0)
    TriggerServerEvent('sunset:factionRegisterFleetVehicle', NetworkGetNetworkIdFromEntity(veh), factionId, modelName)

    if depot.exitSpawn then
        Wait(150)
        TriggerEvent('sunset:world:fadeTeleport', depot.exitSpawn, true)
    end

    exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.vehicle_ready', { label = depot.label or exports.sunset_core:Translate('vehicles.entry.fleet') }), 'success')
end

local function openFleetGarage(factionId, depot)
    local char = exports.sunset_core:GetCharacter()
    local myFaction = char and Sunset.GetCharacterFaction(char)
    if not myFaction or myFaction ~= factionId then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.you_do_not_work_here'), 'error')
        return
    end
    if not exports.sunset_factions:IsOnDuty() then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.go_on_duty_at_hq_first_e'), 'error')
        return
    end

    local vehicles, err = Sunset.AwaitCallback('sunset:factionFleetList', factionId)
    if not vehicles or #vehicles == 0 then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.no_fleet_vehicles_available'), 'error')
        return
    end

    pendingFleetDepot = depot
    pendingFleetId = factionId
    TriggerEvent('sunset:world:uiModalOpen')
    exports.sunset_ui:SetFocus(true, true)
    exports.sunset_ui:Send('fleetGarageShow', {
        label = depot.label or exports.sunset_core:Translate('world.blip.fleet_garage'),
        factionId = factionId,
        vehicles = vehicles,
    })
end

RegisterNetEvent('sunset:client:updateCharacter', function()
    refreshIllegalBlip()
end)

RegisterNetEvent('sunset:client:characterLoaded', function()
    refreshIllegalBlip()
end)

RegisterNetEvent('sunset:client:dutyState', function(state, job, silent)
    onDuty = state == true
    myFaction = job
    if silent then return end
    local faction = job and Sunset.Factions[job]
    if not faction or faction.duty ~= true then return end
    local label = faction.label or 'Faction'
    exports.sunset_ui:Notify(onDuty and (exports.sunset_core:Translate('factions.msg.on_duty', { label = tostring(label) })) or (exports.sunset_core:Translate('factions.msg.off_duty', { label = tostring(label) })), onDuty and 'success' or 'info')
end)

function IsOnDutyLocal()
    return onDuty
end
exports('IsOnDuty', function() return onDuty end)

local fleetAccessWarningAt = 0
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local current = GetVehiclePedIsIn(ped, false)
        local entering = GetVehiclePedIsTryingToEnter(ped)
        local vehicle = current ~= 0 and current or entering
        local wait = 500

        if vehicle and vehicle ~= 0 and DoesEntityExist(vehicle) then
            local restrictedTo = Entity(vehicle).state.sunsetFactionVehicle
            if restrictedTo then
                wait = 100
                local char = exports.sunset_core:GetCharacter()
                local factionId = char and Sunset.GetCharacterFaction(char)
                local allowed = factionId == restrictedTo
                SetVehicleDoorsLockedForPlayer(vehicle, PlayerId(), not allowed)
                if not allowed then
                    if current == vehicle then
                        TaskLeaveVehicle(ped, vehicle, 16)
                    else
                        ClearPedTasks(ped)
                    end
                    local now = GetGameTimer()
                    if now >= fleetAccessWarningAt then
                        fleetAccessWarningAt = now + 4000
                        local faction = Sunset.Factions and Sunset.Factions[restrictedTo]
                        exports.sunset_ui:Notify(
                            exports.sunset_core:Translate('factions.msg.this_vehicle_is_reserved_for_members', { faction = tostring(faction and faction.label or restrictedTo) }),
                            'error', 6000)
                    end
                end
            end
        end
        Wait(wait)
    end
end)

local function blocked()
    return IsNuiFocused()
end

local function leaveFactionCommand()
    local ok, err = Sunset.AwaitCallback('sunset:leaveFaction')
    if ok then
        onDuty = false
        myFaction = nil
        deleteFleetVehicle()
        refreshIllegalBlip()
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.could_not_leave_faction'), 'error')
    end
end

RegisterCommand('leavefaction', leaveFactionCommand, false)
RegisterCommand('quitfaction', leaveFactionCommand, false)
RegisterCommand('factionquit', leaveFactionCommand, false)

RegisterCommand('quitgroup', function()
    leaveFactionCommand()
end, false)

RegisterCommand('duty', function()
    if blocked() then return end
    local state, err = Sunset.AwaitCallback('sunset:toggleDuty')
    if state == nil then exports.sunset_ui:Notify(err or exports.sunset_core:Translate('menu.msg.cannot_toggle_duty'), 'error') end
end, false)

RegisterCommand('fine', function(_, args)
    local target = tonumber(args[1])
    ExecuteCommand(target and ('ticket %d'):format(target) or 'ticket')
end, false)

RegisterCommand('cuff', function(_, args)
    local target = tonumber(args[1])
    if not target then return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.usage_cuff_id'), 'error') end
    local ok, err = Sunset.AwaitCallback('sunset:detentionCuff', target)
    if not ok then exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.could_not_cuff_the_suspect_check'), 'error') end
end, false)

RegisterCommand('uncuff', function(_, args)
    local target = tonumber(args[1])
    if not target then return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.usage_uncuff_id'), 'error') end
    local ok, err = Sunset.AwaitCallback('sunset:detentionUncuff', target)
    if not ok then exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.could_not_remove_the_cuffs_check'), 'error') end
end, false)

RegisterCommand('repairveh', function(_, args)
    local ok, err = Sunset.AwaitCallback('sunset:mechanicRepair', tonumber(args[1]))
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.vehicle_repaired'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.repair_could_not_start_check_duty'), 'error') end
end, false)

RegisterNetEvent('sunset:faction:repairVehicle', function()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return end
    local veh = GetVehiclePedIsIn(ped, false)
    SetVehicleFixed(veh)
    SetVehicleEngineHealth(veh, 1000.0)
    SetVehicleBodyHealth(veh, 1000.0)
    SetVehicleDirtLevel(veh, 0.0)
end)

RegisterCommand('fare', function(_, args)
    local ok, err = Sunset.AwaitCallback('sunset:taxiFare', tonumber(args[1]), tonumber(args[2]))
    if ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.fare_offer_sent_to_passenger_waiting', { amount = math.floor(tonumber(ok.amount) or 0) }), 'success')
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.fare_could_not_be_offered_check'), 'error')
    end
end, false)

RegisterNetEvent('sunset:faction:taxiFareOffered', function(data)
    exports.sunset_ui:Notify(
        exports.sunset_core:Translate('factions.msg.offered_a_taxi_fare_of_use', { driver_name = tostring(data.driverName), amount = tostring(data.amount), expires_in = math.floor(tonumber(data.expiresIn or 30) or 0) }),
        'info', 10000)
    exports.sunset_ui:Send('chatMessage', {
        id = 0, type = 'faction_info', name = 'TAXI FARE',
        message = exports.sunset_core:Translate('factions.ui.is_requesting_a_taxi_fare_of', { driver_name = tostring(data.driverName), amount = tostring(data.amount) }), time = '',
    })
end)

local function acceptTaxiFare()
    local result, err = Sunset.AwaitCallback('sunset:taxiAcceptFare')
    if result then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.paid_to_for_taxi_ride', { amount = tostring(result.amount), driver_name = tostring(result.driverName) }), 'success')
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.could_not_pay_taxi_fare'), 'error')
    end
end

RegisterCommand('acceptfare', acceptTaxiFare, false)
RegisterCommand('declinefare', function()
    local ok, err = Sunset.AwaitCallback('sunset:taxiDeclineFare')
    if ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.taxi_fare_declined'), 'info')
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.no_pending_fare_to_decline'), 'error')
    end
end, false)

RegisterCommand('finvite', function(_, args)
    local ok, err = Sunset.AwaitCallback('sunset:factionInvite', tonumber(args[1]))
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.was_invited_to_and_has_seconds', { target = tostring(ok.target), label = tostring(ok.label), expires_in = math.floor(tonumber(ok.expiresIn) or 0) }), 'success', 8000)
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.recruitment_failed_check_your_leader_permiss'), 'error') end
end, false)

RegisterNetEvent('sunset:faction:inviteReceived', function(invite)
    exports.sunset_ui:Notify(
        exports.sunset_core:Translate('factions.msg.invited_you_to_use_acceptfaction_or', { leader = invite.leader or exports.sunset_core:Translate('factions.word.the_leader'), label = invite.label or exports.sunset_core:Translate('factions.word.a_faction'), expires_in = math.floor(tonumber(invite.expiresIn or 120) or 0) }),
        'info', 12000)
    exports.sunset_ui:Send('chatMessage', {
        id = 0, type = 'faction_info', name = 'FACTION INVITATION',
        message = exports.sunset_core:Translate('factions.ui.invited_you_to_type_acceptfaction_to', { leader = invite.leader or exports.sunset_core:Translate('factions.word.the_leader'), label = invite.label or exports.sunset_core:Translate('factions.word.a_faction') }), time = '',
    })
end)

local function acceptFactionInvite()
    local result, err = Sunset.AwaitCallback('sunset:factionAcceptInvite')
    if not result then return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.the_faction_invitation_could_not_be'), 'error', 8000) end
    exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.you_joined_your_civilian_job_is', { label = tostring(result.label) }), 'success', 10000)
    refreshIllegalBlip()
end

RegisterCommand('acceptfaction', acceptFactionInvite, false)
RegisterCommand('accept', function(_, args)
    local sub = string.lower(tostring(args[1] or ''))
    if sub == 'faction' then
        acceptFactionInvite()
    elseif sub == 'fare' or sub == 'taxi' then
        acceptTaxiFare()
    else
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.usage_accept_faction_fare'), 'error')
    end
end, false)

RegisterCommand('declinefaction', function()
    local ok, err = Sunset.AwaitCallback('sunset:factionDeclineInvite')
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.faction_invitation_declined'), 'info')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.the_faction_invitation_could_not_be_2'), 'error') end
end, false)

RegisterCommand('fpromote', function(_, args)
    local ok, err = Sunset.AwaitCallback('sunset:factionPromote', tonumber(args[1]), tonumber(args[2]))
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.member_promoted'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.promotion_failed_check_your_leader_permissio'), 'error') end
end, false)

RegisterCommand('fgiverank', function(_, args)
    local ok, err = Sunset.AwaitCallback('sunset:factionGiveRank', tonumber(args[1]), tonumber(args[2]))
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.rank_updated'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.rank_change_failed_check_your_leader'), 'error') end
end, false)

RegisterCommand('funinvite', function(_, args)
    local ok, err = Sunset.AwaitCallback('sunset:factionUninvite', tonumber(args[1]))
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.member_removed'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.member_removal_failed_check_your_leader'), 'error') end
end, false)

RegisterCommand('fwarn', function(_, args)
    local target = tonumber(args[1])
    local reason = table.concat(args, ' ', 2)
    if not target or reason == '' then return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.usage_fwarn_id_reason'), 'error') end
    local ok, err = Sunset.AwaitCallback('sunset:factionWarn', target, reason)
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.warning_issued'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_warning_failed_check_your_leader'), 'error') end
end, false)

RegisterCommand('fw', function(_, args)
    ExecuteCommand(('fwarn %s'):format(table.concat(args, ' ')))
end, false)

RegisterCommand('fmotd', function(_, args)
    local msg = table.concat(args, ' ')
    if msg == '' then
        local data, err = Sunset.AwaitCallback('sunset:factionGetMotd')
        if not data then return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_motd_could_not_be_loaded'), 'error') end
        exports.sunset_ui:Send('chatMessage', {
            id = 0,
            type = 'faction_motd',
            factionId = data.factionId,
            factionLabel = data.label,
            name = data.label,
            message = data.message ~= '' and data.message or exports.sunset_core:Translate('factions.ui.no_message_of_the_day_has'),
            command = '/fmotd',
            time = '',
        })
        return
    end
    local ok, err = Sunset.AwaitCallback('sunset:factionSetMotd', msg)
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.faction_motd_updated'), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.motd_update_failed_check_your_faction'), 'error') end
end, false)

RegisterCommand('fmembers', function()
    local data, err = Sunset.AwaitCallback('sunset:factionMembers')
    if not data then return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_members_could_not_be_loaded'), 'error') end
    local chat = function(line)
        exports.sunset_ui:Send('chatMessage', { id = 0, name = 'FACTION', message = line, time = '' })
    end
    chat(exports.sunset_core:Translate('factions.msg.faction_members_online'))
    if data.motd and data.motd ~= '' then chat(exports.sunset_core:Translate('factions.msg.motd', { motd = tostring(data.motd) })) end
    for _, m in ipairs(data.members or {}) do
        chat(('#%d %s — %s%s%s'):format(
            m.id, m.name, m.gradeLabel,
            m.onDuty and ' [ON DUTY]' or '',
            m.leader and ' [LEADER]' or ''))
    end
end, false)

RegisterCommand('sellpouch', function()
    local ok, err = Sunset.AwaitCallback('sunset:illegalSell')
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.sold_for', { total = tostring(ok.total or 0) }), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.sale_failed'), 'error') end
end, false)

RegisterCommand('fence', function()
    local ok, err = Sunset.AwaitCallback('sunset:illegalSell')
    if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.fenced_for', { total = tostring(ok.total or 0) }), 'success')
    else exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.fence_failed'), 'error') end
end, false)

local factionPanelOpen = false

RegisterCommand('faction', function()
    local data, err = Sunset.AwaitCallback('sunset:factionDashboard')
    if not data then return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_panel_could_not_be_opened'), 'error', 7000) end
    factionPanelOpen = true
    exports.sunset_ui:Send('factionPanelShow', data)
    exports.sunset_ui:SetFocus(true, true)
end, false)

exports('IsFactionPanelOpen', function()
    return factionPanelOpen
end)

RegisterCommand('factions', function()
    local data, err = Sunset.AwaitCallback('sunset:factionDirectory')
    if not data then return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_directory_could_not_be_opened'), 'error', 7000) end
    exports.sunset_ui:Send('factionDirectoryShow', { factions = data })
    exports.sunset_ui:SetFocus(true, true)
end, false)

AddEventHandler('sunset:nui:factionBrowse', function()
    local data, err = Sunset.AwaitCallback('sunset:factionDirectory')
    if not data then
        exports.sunset_ui:Send('factionBrowseInline', { factions = {}, error = err })
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_directory_could_not_be_loaded'), 'error', 7000)
    end
    exports.sunset_ui:Send('factionBrowseInline', { factions = data })
end)

AddEventHandler('sunset:nui:factionDirectoryDetail', function(data)
    local factionId = data and data.factionId
    if not factionId then return end
    local detail, err = Sunset.AwaitCallback('sunset:factionDirectoryDetail', factionId)
    if not detail then
        exports.sunset_ui:Send('factionDirectoryDetail', { error = err })
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.could_not_load_faction_details'), 'error')
    end
    exports.sunset_ui:Send('factionDirectoryDetail', detail)
end)

AddEventHandler('sunset:nui:factionManage', function(data)
    data = data or {}
    local action = data.action
    local ok, err

    if action == 'invite' then
        ok, err = Sunset.AwaitCallback('sunset:factionInvite', tonumber(data.targetId))
        if ok then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.was_invited_to', { target = tostring(ok.target), label = tostring(ok.label) }), 'success', 8000)
        end
    elseif action == 'motd' then
        ok, err = Sunset.AwaitCallback('sunset:factionSetMotd', data.message)
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.faction_motd_updated_caa52e'), 'success') end
    elseif action == 'rankDelta' then
        ok, err = Sunset.AwaitCallback('sunset:factionMemberRankDelta', tonumber(data.characterId), tonumber(data.delta))
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.rank_updated_to', { grade_label = tostring(ok.gradeLabel or '?') }), 'success') end
    elseif action == 'kick' then
        ok, err = Sunset.AwaitCallback('sunset:factionMemberKick', tonumber(data.characterId), data.mode or 'online')
        if ok then
            local msg = ok.offline and 'Offline member removed.' or 'Member removed from faction.'
            exports.sunset_ui:Notify(msg, 'success')
        end
    elseif action == 'warn' then
        local characterId = tonumber(data.characterId)
        local targetId = tonumber(data.targetId)
        local reason = data.reason or 'No reason given'
        if characterId then
            ok, err = Sunset.AwaitCallback('sunset:factionMemberWarn', characterId, reason)
        elseif targetId then
            ok, err = Sunset.AwaitCallback('sunset:factionWarn', targetId, reason)
        else
            return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.invalid_member_for_faction_warning'), 'error')
        end
        if ok then
            local count = type(ok) == 'table' and (ok.warns or ok.count) or nil
            exports.sunset_ui:Notify(count and exports.sunset_core:Translate('factions.msg.faction_warning_issued_3', { count = math.floor(tonumber(count) or 0) }) or exports.sunset_core:Translate('factions.msg.faction_warning_issued'), 'warning')
        end
    elseif action == 'gradeLabels' then
        ok, err = Sunset.AwaitCallback('sunset:factionSetGradeLabels', data.labels or {})
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.rank_names_saved'), 'success') end
    elseif action == 'resign' then
        -- [FP SYSTEM] Member submits a resignation request for the leader.
        ok, err = Sunset.AwaitCallback('sunset:factionResignSubmit', data.reason or '')
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.resignation_submitted_the_leader_can_accept_it_cleanly_no'), 'success', 12000) end
    elseif action == 'resignAccept' then
        ok, err = Sunset.AwaitCallback('sunset:factionResignHandle', tonumber(data.resignationId), 'accept')
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.resignation_accepted_clean_no_fp'), 'success') end
    elseif action == 'resignAcceptFp' then
        ok, err = Sunset.AwaitCallback('sunset:factionResignHandle', tonumber(data.resignationId), 'accept_fp')
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.resignation_accepted_with_fp_60'), 'warning') end
    elseif action == 'resignDecline' then
        ok, err = Sunset.AwaitCallback('sunset:factionResignHandle', tonumber(data.resignationId), 'decline')
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.resignation_declined'), 'info') end
    elseif action == 'pardonFp' then
        ok, err = Sunset.AwaitCallback('sunset:factionPardonFP', tonumber(data.characterId))
        if ok then exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.fp_pardoned'), 'success') end
    else
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.unknown_faction_action'), 'error')
    end

    if not ok then
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('factions.msg.faction_action_failed'), 'error', 8000)
    end

    local dashboard, dashErr = Sunset.AwaitCallback('sunset:factionDashboard')
    if dashboard then
        factionPanelOpen = true
        exports.sunset_ui:Send('factionPanelRefresh', dashboard)
    elseif dashErr then
        exports.sunset_ui:Notify(dashErr, 'error', 7000)
    end
end)

AddEventHandler('sunset:nui:factionPanelsClose', function()
    factionPanelOpen = false
end)

-- [STALE FLAG FIX] Death/respawn force-closes every modal: clear the flag so
-- ReleaseFocusUnlessModal is never blocked by a phantom faction panel.
AddEventHandler('sunset:ui:forceCloseAll', function()
    factionPanelOpen = false
end)

-- [AUDIT P8-12] Force-hidden by another modal: clear the flag only (no focus
-- release; the superseding modal owns focus).
AddEventHandler('sunset:nui:modalSuperseded', function(panel)
    if panel == 'factionPanel' then
        factionPanelOpen = false
    end
end)

AddEventHandler('sunset:world:factionHQ', function(factionId, faction)
    if blocked() then return end
    local label = faction.label or factionId
    local ped = PlayerPedId()
    local char = exports.sunset_core:GetCharacter()
    local myFaction = char and Sunset.GetCharacterFaction(char)

    if factionId == 'mechanic' and IsPedInAnyVehicle(ped, false) then
        TriggerEvent('sunset:tuning:openLsCustomsMenu')
        return
    end

    if myFaction == factionId then
        ExecuteCommand('duty')
        return
    end

    if myFaction then
        local myLabel = Sunset.Factions[myFaction] and Sunset.Factions[myFaction].label or myFaction
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.msg.you_are_a_member_of_this', { my_label = tostring(myLabel), label = tostring(label) }), 'warning', 7000)
    end

    exports.sunset_ui:Notify(
        faction.applicationsOpen
            and exports.sunset_core:Translate('factions.msg.recruitment_uses_applications_on_discord_the', { label = tostring(label) })
            or exports.sunset_core:Translate('factions.msg.is_not_accepting_public_applications_only', { label = tostring(label) }),
        'info', 10000)
end)

AddEventHandler('sunset:world:factionDepot', function(factionId, depot)
    openFleetGarage(factionId, depot)
end)

AddEventHandler('sunset:nui:fleetGarageSpawn', function(data)
    CreateThread(function()
        local depot = pendingFleetDepot
        local factionId = pendingFleetId
        pendingFleetDepot = nil
        pendingFleetId = nil
        exports.sunset_ui:Send('fleetGarageHide', {})
        if depot and factionId and data and data.model then
            spawnFleetVehicle(depot, factionId, data.model)
        else
            exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.could_not_take_out_vehicle_try_again'), 'error')
        end
    end)
end)

AddEventHandler('sunset:nui:fleetGarageClose', function()
    pendingFleetDepot = nil
    pendingFleetId = nil
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('fleetGarageHide', {})
end)

AddEventHandler('sunset:world:illegalSell', function(factionId)
    local char = exports.sunset_core:GetCharacter()
    if not char or Sunset.GetCharacterFaction(char) ~= factionId then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.members_only'), 'error')
        return
    end
    if factionId == 'sunset_cartel' then
        ExecuteCommand('sellpouch')
    else
        ExecuteCommand('fence')
    end
end)

local function registerFactionChatSuggestions()
    TriggerEvent('chat:addSuggestion', '/duty', 'Toggle faction duty shift')
    TriggerEvent('chat:addSuggestion', '/fskins', 'Browse all available authentic real skins for your faction')
    TriggerEvent('chat:addSuggestion', '/fskin', 'Equip a specific real faction skin', { { name = 'number or name', help = 'ex: 1, 2, swat, hway' } })
    TriggerEvent('chat:addSuggestion', '/faction', 'Open your faction dashboard, roster and weekly report')
    TriggerEvent('chat:addSuggestion', '/factions', 'Browse every server faction and application status')
    TriggerEvent('chat:addSuggestion', '/leavefaction', 'Leave your faction; keeps your civilian job')
    TriggerEvent('chat:addSuggestion', '/quitfaction', 'Same as /leavefaction; keeps your civilian job')
    TriggerEvent('chat:addSuggestion', '/quitgroup', 'Same as /leavefaction; keeps your civilian job')
    TriggerEvent('chat:addSuggestion', '/f', 'Faction radio (illegal/civilian factions — not LSPD/EMS/LSFD)', { { name = 'message' } })
    TriggerEvent('chat:addSuggestion', '/r', 'Faction radio (your department)', { { name = 'message' } })
    TriggerEvent('chat:addSuggestion', '/d', 'Department radio (LSPD, Sheriff, FIB, EMS, LSFD)', { { name = 'message' } })
    TriggerEvent('chat:addSuggestion', '/service', 'Request emergency/service dispatch', {
        { name = 'type', help = 'taxi|medic|fire|mechanic' },
        { name = 'message', help = 'optional details' },
    })
    TriggerEvent('chat:addSuggestion', '/gov', 'Government announcement — everyone on the server sees it (on-duty LSPD/Sheriff/FIB/EMS/LSFD)', { { name = 'message' } })
    TriggerEvent('chat:addSuggestion', '/finvite', 'Leader: invite an accepted applicant nearby', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/acceptfaction', 'Accept your pending faction invitation')
    TriggerEvent('chat:addSuggestion', '/declinefaction', 'Decline your pending faction invitation')
    TriggerEvent('chat:addSuggestion', '/funinvite', 'Remove member', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/fgiverank', 'Set member rank', { { name = 'id' }, { name = 'grade' } })
    TriggerEvent('chat:addSuggestion', '/fwarn', 'Faction warning', { { name = 'id' }, { name = 'reason' } })
    TriggerEvent('chat:addSuggestion', '/fw', 'Alias for /fwarn', { { name = 'id' }, { name = 'reason' } })
    TriggerEvent('chat:addSuggestion', '/fmembers', 'List online faction members')
    TriggerEvent('chat:addSuggestion', '/fmotd', 'Read MOTD, or set it if you have permission', { { name = 'message', help = 'optional new MOTD' } })
    TriggerEvent('chat:addSuggestion', '/fine', 'Issue fine (PD)', { { name = 'id' }, { name = 'amount' }, { name = 'reason' } })
    TriggerEvent('chat:addSuggestion', '/cuff', 'Cuff player (PD)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/uncuff', 'Uncuff player (PD)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/heal', 'Treat injuries (EMS/LSFD)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/stabilize', 'Stabilize downed patient (EMS/LSFD)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/revive', 'Revive downed player (EMS/LSFD)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/repairveh', 'Repair vehicle (Mechanic)', { { name = 'id' } })
    TriggerEvent('chat:addSuggestion', '/fare', 'Collect taxi fare', { { name = 'id' }, { name = 'amount' } })
    TriggerEvent('chat:addSuggestion', '/sellpouch', 'Sell sealed pouch at Cartel HQ')
    TriggerEvent('chat:addSuggestion', '/fence', 'Fence contraband at Syndicate HQ')
    TriggerEvent('chat:addSuggestion', '/pd', 'LSPD commands and help')
    TriggerEvent('chat:addSuggestion', '/pdgarage', 'Spawn MRPD patrol car (on duty)')
    TriggerEvent('chat:addSuggestion', '/fd', 'LSFD how-to: duty, garage, fires, extinguisher')
    TriggerEvent('chat:addSuggestion', '/firestart', 'Dispatch a vehicle fire if none is active (LSFD on duty)')
    TriggerEvent('chat:addSuggestion', '/firecalls', 'List active fire incidents and set GPS (LSFD on duty)')
end

CreateThread(function()
    Wait(3000)
    for id, faction in pairs(Sunset.Factions or {}) do
        if faction.hq then
            TriggerEvent('sunset:world:registerFactionHQ', id, faction)
        end
        if faction.depot then
            TriggerEvent('sunset:world:registerFactionDepot', id, faction.depot, faction)
            if faction.depot.lift then
                TriggerEvent('sunset:world:registerElevator', id, faction.depot.lift, faction)
            end
        end
        if faction.entrance then
            TriggerEvent('sunset:world:registerFactionEntrance', id, faction.entrance, faction)
        end
        if faction.stash and faction.type == 'illegal' then
            TriggerEvent('sunset:world:registerIllegalSell', id, faction.stash, faction)
        end
    end

    registerFactionChatSuggestions()
end)

AddEventHandler('sunset:chat:rebuildSuggestions', registerFactionChatSuggestions)

local PD_HELP = {
    '=== LSPD (on duty) ===',
    '/duty — Toggle shift (uniform + gear when ON)',
    '/pdgarage — Spawn patrol car at MRPD garage',
    '[E] at MRPD garage marker — same as /pdgarage',
    '[E] at LSPD Armory inside MRPD — craft bandages (on duty)',
    '/su [id] [reason] — Set wanted (type /su for reason codes)',
    '/so [id] — Summon suspect (must be nearby)',
    '/clear [id] — Clear wanted status',
    '/wanted — List active wanted (persisted)',
    '/booking — GPS to nearest MRPD/Bolingbroke booking marker',
    '/arrest [id] — Book a CUFFED + WANTED suspect inside that marker',
    '/cuff [id] — Restrain suspect',
    '/uncuff [id] — Remove restraints',
    '/ticket [id] (or /fine [id]) — choose an official citation in UI',
    '/mdc — Mobile data terminal',
    '/confiscate [id] — Confiscate contraband',
    '/startradar [limit_kmh] — Activate mobile radar and monitor traffic',
    '/stopradar — Deactivate speed radar',
    '/radars — List fixed speed cameras',
    '/r [msg] — Faction radio (LSPD only)',
    '/d [msg] — Department radio (LSPD, Sheriff, FIB, EMS, LSFD)',
    '/faction — Your rank, salary, commands',
    '/help — personalized list filtered to commands your current rank can use',
    'Payday: every hour at :00 — must be ON DUTY — salary goes to bank',
}

RegisterCommand('pd', function()
    for _, line in ipairs(PD_HELP) do
        exports.sunset_ui:Send('chatMessage', { id = 0, name = 'LSPD', message = line, time = '' })
    end
end, false)

local FD_HELP = {
    '=== LSFD (on duty) ===',
    '/duty — Toggle shift at LS Fire Department HQ (orange marker)',
    '[E] at Fire Station Garage — spawn firetruk',
    '/firestart — Create a vehicle fire if none is active',
    '/firecalls — List fires and put GPS on the first one',
    '/calls — Accept civilian /service fire requests',
    'At the wreck: you get a fire extinguisher — hold LMB and spray until it dies',
    'Stay within ~8m of the burning car. When health hits 0 you get paid (~$350)',
    'Engineer+ can /revive, Firefighter+ can /heal, all ranks /stabilize',
    '/f [msg] — Faction radio  |  /r [msg] — LSFD radio  |  /d [msg] — Emergency dept radio',
    '/help — same commands filtered to your current rank',
}

RegisterCommand('fd', function()
    for _, line in ipairs(FD_HELP) do
        exports.sunset_ui:Send('chatMessage', { id = 0, type = 'faction_info', name = 'LSFD', message = line, time = '' })
    end
end, false)

RegisterCommand('pdgarage', function()
    local char = exports.sunset_core:GetCharacter()
    local factionId = char and Sunset.GetCharacterFaction(char)
    if not factionId or not Sunset.FactionTypeMatches(factionId, 'law_enforcement') then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.you_must_be_law_enforcement'), 'error')
    end
    if not exports.sunset_factions:IsOnDuty() then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('factions.message.go_on_duty_first_duty_at_hq'), 'error')
    end
    local faction = Sunset.Factions[factionId]
    if faction and faction.depot then
        openFleetGarage(factionId, faction.depot)
    end
end, false)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    clearIllegalBlip()
    deleteFleetVehicle()
end)
