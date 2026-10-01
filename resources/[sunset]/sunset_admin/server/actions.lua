-- ═══════════════════════════════════════════════════════════════
--  ADMIN PRESENCE TOOLS — freeze/slap/spectate/pullout/tpcar/
--  bringcar/ajail/aunjail/aclear/mass tools/gotoid/setclan.
--  (ADMIN_SYSTEM_SPEC.md §4). Server-authoritative; client does the
--  physical work via TriggerClientEvent.
-- ═══════════════════════════════════════════════════════════════

local hasPerm, notify, requirePerm, getTarget, guardSelfTarget, resolveTarget, registerServerCommand

-- injected by commands.lua via SunsetAdmin.ActionsInit (see bottom of commands.lua)
local A = {}

local Frozen = {} -- [target] = { by = adminSrc, at = os.time() }

local function adminLevelOf(src)
    if src == 0 then return 99 end
    local ok, lvl = pcall(function() return exports.sunset_admin:GetAdminLevel(src) end)
    return ok and tonumber(lvl) or 0
end

local function getDisplayName(src)
    if not src or src == 0 then return 'CONSOLE' end
    local ok, name = pcall(function() return exports.sunset_core:GetPlayerDisplayName(src) end)
    if ok and type(name) == 'string' and name ~= '' then return name end
    local okBase, base = pcall(function() return exports.sunset_core:GetPlayerBaseName(src) end)
    if okBase and type(base) == 'string' and base ~= '' then return base end
    return ('Player %d'):format(src)
end

local function markAnticheat(src, cmd)
    if GetResourceState('sunset_anticheat') == 'started' then
        pcall(function() exports.sunset_anticheat:MarkAdminAction(src, cmd) end)
    end
end

local function targetInProperty(target)
    local bucket = GetPlayerRoutingBucket(target)
    return bucket and bucket ~= 0
end

-- ── /freeze · /unfreeze (level 1) ──────────────────────────────
function A.freeze(source, args)
    if source ~= 0 and not requirePerm(source, 'freeze') then return end
    local target = getTarget(source, args[1], 'Usage: /freeze [player id]')
    if not target or not guardSelfTarget(source, target, args[1], 'freeze') then return end
    if adminLevelOf(target) >= adminLevelOf(source) and source ~= 0 then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.you_cannot_freeze_a_staff_member'), 'error')
        return
    end
    if Frozen[target] then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.is_already_frozen_by', { target = math.floor(tonumber(target) or 0), by = tostring(Frozen[target].by) }), 'info')
        return
    end
    Frozen[target] = { by = source, at = os.time() }
    TriggerClientEvent('sunset:admin:freeze', target, true)
    TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.you_have_been_frozen_by_staff_stay_where_you'), 'error', 10000)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.froze_unfreeze_to_release', { target = math.floor(tonumber(target) or 0), display_name = tostring(getDisplayName(target)), target_2 = math.floor(tonumber(target) or 0) }), 'success')
    pcall(function() exports.sunset_admin:BroadcastStaff(('[ADMIN] %s froze #%d (%s)')
        :format(getDisplayName(source), target, getDisplayName(target))) end)
    markAnticheat(target, 'freeze')
end

function A.unfreeze(source, args)
    if source ~= 0 and not requirePerm(source, 'unfreeze') then return end
    local target = getTarget(source, args[1], 'Usage: /unfreeze [player id]')
    if not target then return end
    if not Frozen[target] then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.is_not_frozen', { target = math.floor(tonumber(target) or 0) }), 'info')
        return
    end
    Frozen[target] = nil
    TriggerClientEvent('sunset:admin:freeze', target, false)
    TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.you_have_been_unfrozen_by_staff'), 'success', 6000)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.unfroze', { target = math.floor(tonumber(target) or 0) }), 'success')
end

-- failsafes: never leave a player frozen forever
AddEventHandler('playerDropped', function()
    local src = source
    if Frozen[src] then Frozen[src] = nil end
end)

CreateThread(function()
    local maxSec = tonumber(SunsetAdmin.FreezeMaxSec) or 600
    while true do
        Wait(30000)
        local now = os.time()
        for target, row in pairs(Frozen) do
            if not GetPlayerName(target) then
                Frozen[target] = nil
            elseif now - (row.at or 0) > maxSec then
                Frozen[target] = nil
                TriggerClientEvent('sunset:admin:freeze', target, false)
                TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.auto_unfrozen_staff_timeout'), 'info', 6000)
                pcall(function() exports.sunset_admin:BroadcastStaff(('[ADMIN] auto-unfroze #%d after %ds')
                    :format(target, maxSec)) end)
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for target in pairs(Frozen) do
        TriggerClientEvent('sunset:admin:freeze', target, false)
    end
    Frozen = {}
end)

exports('IsFrozen', function(src) return Frozen[tonumber(src or -1)] ~= nil end)

-- ── /slap (level 2) ────────────────────────────────────────────
function A.slap(source, args)
    if source == 0 then return end
    if not requirePerm(source, 'slap') then return end
    local target = getTarget(source, args[1], 'Usage: /slap [player id]')
    if not target or not guardSelfTarget(source, target, args[1], 'slap') then return end
    if GetResourceState('sunset_death') == 'started' then
        local ok, downed = pcall(function() return exports.sunset_death:IsPlayerDowned(target) end)
        if ok and downed then
            notify(source, exports.sunset_core:TFor(source, 'admin.msg.cannot_slap_a_downed_player'), 'error')
            return
        end
    end
    TriggerClientEvent('sunset:admin:slap', target, source)
    TriggerClientEvent('sunset:client:notify', target,
        ('You were slapped by %s. Behave.'):format(getDisplayName(source)), 'warning', 8000)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.slapped', { target = math.floor(tonumber(target) or 0) }), 'success')
    markAnticheat(target, 'slap')
end

-- ── /pullout (level 1) ─────────────────────────────────────────
function A.pullout(source, args)
    if source ~= 0 and not requirePerm(source, 'pullout') then return end
    local target = getTarget(source, args[1], 'Usage: /pullout [player id]')
    if not target then return end
    TriggerClientEvent('sunset:admin:pullout', target)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.pulled_out_of_their_vehicle', { target = math.floor(tonumber(target) or 0) }), 'success')
end

-- ── /spectate (level 2) ────────────────────────────────────────
local Spectating = {} -- [adminSrc] = target
local SavedBucket = {} -- [adminSrc] = bucket before we moved them (spectate/tpcar/bringcar)

-- [G7 FIX] Leaving a borrowed routing bucket must also release the property
-- registry, otherwise sunset_properties.Inside desyncs from the real bucket.
local function restoreBucket(src, bucket)
    if not GetPlayerName(src) then return end
    if GetResourceState('sunset_properties') == 'started' then
        pcall(function() exports.sunset_properties:LeaveProperty(src) end)
    end
    SetPlayerRoutingBucket(src, tonumber(bucket) or 0)
end

function A.spectate(source, args)
    if source == 0 then return end
    if not requirePerm(source, 'spectate') then return end
    local arg = args[1] and string.lower(tostring(args[1]))

    -- exit mode
    if not arg or arg == 'off' or arg == 'stop' then
        if Spectating[source] then
            Spectating[source] = nil
            -- [G7 FIX] return the admin to their original bucket (usually 0)
            restoreBucket(source, SavedBucket[source])
            SavedBucket[source] = nil
            TriggerClientEvent('sunset:admin:spectateEnd', source)
            notify(source, exports.sunset_core:TFor(source, 'admin.message.spectate_ended'), 'info')
        else
            notify(source, exports.sunset_core:TFor(source, 'admin.msg.you_are_not_spectating_anyone'), 'info')
        end
        return
    end

    local target = getTarget(source, arg, 'Usage: /spectate [player id|off]')
    if not target then return end
    if target == source then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.you_cannot_spectate_yourself'), 'error')
        return
    end
    Spectating[source] = target
    SavedBucket[source] = GetPlayerRoutingBucket(source) or 0
    -- [G7 FIX] join the target's routing bucket so properties are visible.
    local bucket = GetPlayerRoutingBucket(target) or 0
    SetPlayerRoutingBucket(source, bucket)
    -- [AUDIT SPECTATE-DIST] Pass the target's current coords so the admin client
    -- can teleport near the target before calling NetworkSetInSpectatorMode.
    -- Without this, if the target is >500 m away their ped is not streamed and
    -- the spectate cam shows nothing.
    local targetPed = GetPlayerPed(target)
    local initCoords = (targetPed and targetPed ~= 0) and GetEntityCoords(targetPed) or nil
    TriggerClientEvent('sunset:admin:spectateStart', source, target, initCoords and {x=initCoords.x,y=initCoords.y,z=initCoords.z} or nil)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.now_spectating_spectate_off_to_exit', { target = math.floor(tonumber(target) or 0), display_name = tostring(getDisplayName(target)) }), 'success', 8000)
    pcall(function() exports.sunset_admin:BroadcastStaff(('[ADMIN] %s started spectating #%d (%s)')
        :format(getDisplayName(source), target, getDisplayName(target))) end)
    markAnticheat(source, 'spectate')
end

-- watchdog: end spectate when target drops
AddEventHandler('playerDropped', function()
    local src = source
    for admin, target in pairs(Spectating) do
        if target == src and GetPlayerName(admin) then
            Spectating[admin] = nil
            restoreBucket(admin, SavedBucket[admin])
            SavedBucket[admin] = nil
            TriggerClientEvent('sunset:admin:spectateEnd', admin)
            TriggerClientEvent('sunset:client:notify', admin, exports.sunset_core:TFor(admin, 'admin.message.spectate_ended_target_disconnected'), 'info')
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for admin in pairs(Spectating) do
        restoreBucket(admin, SavedBucket[admin])
        TriggerClientEvent('sunset:admin:spectateEnd', admin)
    end
    Spectating = {}
    SavedBucket = {}
end)

-- 1Hz coords sync while spectating (client cam follows target).
CreateThread(function()
    while true do
        Wait(1000)
        for admin, target in pairs(Spectating) do
            if GetPlayerName(admin) and GetPlayerName(target) then
                local ped = GetPlayerPed(target)
                if ped and ped ~= 0 then
                    local coords = GetEntityCoords(ped)
                    TriggerClientEvent('sunset:admin:spectateSync', admin, target,
                        { x = coords.x, y = coords.y, z = coords.z })
                end
            else
                Spectating[admin] = nil
            end
        end
    end
end)

exports('IsSpectating', function(src) return Spectating[tonumber(src or -1)] ~= nil end)

-- ── /tpcar · /bringcar (level 2) ───────────────────────────────
-- G6: move the WHOLE vehicle, not just the ped. G7: bucket normalization.
local function safeTpCoordsFor(target)
    local ped = GetPlayerPed(target)
    if not ped or ped == 0 then return nil end
    local coords = GetEntityCoords(ped)
    -- [G7] If the target is inside a property bucket, warn and use their
    -- coords anyway but normalize OUR bucket to theirs; the client-side move
    -- keeps the admin visible. (Property-entrance redirect = phase 2.)
    return coords
end

function A.tpcar(source, args)
    if source == 0 then return end
    if not requirePerm(source, 'tpcar') then return end
    local target = getTarget(source, args[1], 'Usage: /tpcar [player id]')
    if not target then return end
    local coords = safeTpCoordsFor(target)
    if not coords then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.could_not_resolve_the_target_position'), 'error')
        return
    end
    if targetInProperty(target) then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.target_is_inside_a_property_joining'), 'warning')
        if SavedBucket[source] == nil then SavedBucket[source] = GetPlayerRoutingBucket(source) or 0 end
    end
    SetPlayerRoutingBucket(source, GetPlayerRoutingBucket(target) or 0)
    TriggerClientEvent('sunset:admin:teleportVehicle', source, coords.x, coords.y, coords.z)
    markAnticheat(source, 'tpcar')
end

function A.bringcar(source, args)
    if source == 0 then return end
    if not requirePerm(source, 'bringcar') then return end
    local target = getTarget(source, args[1], 'Usage: /bringcar [player id]')
    if not target or not guardSelfTarget(source, target, args[1], 'bringcar') then return end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return end
    local coords = GetEntityCoords(ped)
    if targetInProperty(source) then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.you_are_inside_a_property_target'), 'warning')
    end
    -- [G7 FIX] If the target is inside a property, release their registry entry
    -- first, otherwise sunset_properties.Inside keeps a ghost record and their
    -- bucket silently desyncs from where they actually are.
    if targetInProperty(target) then
        if GetResourceState('sunset_properties') == 'started' then
            pcall(function() exports.sunset_properties:LeaveProperty(target) end)
        end
        TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.you_were_pulled_out_of_a_property_by_staff'), 'warning')
    end
    SetPlayerRoutingBucket(target, GetPlayerRoutingBucket(source) or 0)
    TriggerClientEvent('sunset:admin:teleportVehicle', target, coords.x + 2.0, coords.y + 2.0, coords.z)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.brought_with_their_vehicle_to_you', { target = math.floor(tonumber(target) or 0) }), 'success')
    TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.you_were_brought_to_an_admin'), 'warning')
    markAnticheat(target, 'bringcar')
end

-- ── /tpback — restore the bucket you had before spectate/tpcar/bringcar (level 2) ──
function A.tpback(source, args)
    if source == 0 then return end
    if not requirePerm(source, 'tpback') then return end
    local saved = SavedBucket[source]
    if saved == nil then
        -- Nothing saved: still useful as an escape hatch if stuck in a weird bucket.
        if (GetPlayerRoutingBucket(source) or 0) ~= 0 then
            restoreBucket(source, 0)
            notify(source, exports.sunset_core:TFor(source, 'admin.msg.no_saved_position_but_your_routing'), 'success')
            return
        end
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.nothing_to_return_to_your_bucket'), 'info')
        return
    end
    SavedBucket[source] = nil
    restoreBucket(source, saved)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.routing_bucket_restored_was', { saved = tostring(saved) }), 'success')
end

-- ── /ajail · /aunjail · /aclear (level 2, via faction exports) ─
function A.ajail(source, args)
    if source ~= 0 and not requirePerm(source, 'ajail') then return end
    local target = getTarget(source, args[1], 'Usage: /ajail [player id] [minutes] [reason]')
    if not target or not guardSelfTarget(source, target, args[1], 'ajail') then return end
    local minutes = tonumber(args[2])
    if not minutes or minutes < 1 or minutes > 1440 then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.duration_must_be_1_1440_minutes'), 'error')
        return
    end
    local reason = table.concat(args, ' ', 3)
    if reason == '' then reason = 'Admin jail' end
    if GetResourceState('sunset_factions') ~= 'started' then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.the_jail_system_is_unavailable_right'), 'error')
        return
    end
    local ok, err = pcall(function() return exports.sunset_factions:AdminJail(target, minutes, reason, source) end)
    if not ok then
        notify(source, err or exports.sunset_core:TFor(source, 'admin.msg.jail_failed'), 'error')
        return
    end
    SunsetAdmin.Sanctions.jail(source, target, minutes, reason)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.jailed_for_minutes', { target = math.floor(tonumber(target) or 0), minutes = math.floor(tonumber(minutes) or 0) }), 'success')
    markAnticheat(target, 'ajail')
end

function A.aunjail(source, args)
    if source ~= 0 and not requirePerm(source, 'aunjail') then return end
    local target = getTarget(source, args[1], 'Usage: /aunjail [player id]')
    if not target then return end
    if GetResourceState('sunset_factions') ~= 'started' then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.the_jail_system_is_unavailable_right'), 'error')
        return
    end
    local ok, err = pcall(function() return exports.sunset_factions:AdminUnjail(target) end)
    if not ok then
        notify(source, err or exports.sunset_core:TFor(source, 'admin.msg.unjail_failed'), 'error')
        return
    end
    SunsetAdmin.Sanctions.unjail(source, target)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.released_from_jail', { target = math.floor(tonumber(target) or 0) }), 'success')
    TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.you_were_released_from_jail_by_staff'), 'success')
end

function A.aclear(source, args)
    if source ~= 0 and not requirePerm(source, 'aclear') then return end
    local target = getTarget(source, args[1], 'Usage: /aclear [player id]')
    if not target then return end
    if GetResourceState('sunset_factions') ~= 'started' then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.the_wanted_system_is_unavailable_right'), 'error')
        return
    end
    local ok, err = pcall(function() return exports.sunset_factions:AdminClearWanted(target) end)
    if not ok then
        notify(source, err or exports.sunset_core:TFor(source, 'admin.msg.could_not_clear_wanted_level'), 'error')
        return
    end
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.cleared_wanted_stars_for', { target = math.floor(tonumber(target) or 0) }), 'success')
    TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.your_wanted_stars_were_cleared_by_staff'), 'info')
end

-- ── mass tools (level 3) ───────────────────────────────────────
local PendingMass = {} -- [src] = { cmd, at, timer }

local function requireConfirm(source, cmd)
    local pending = PendingMass[source]
    local now = os.time()
    local gameTimer = GetGameTimer()
    if pending and pending.cmd == cmd and (now - pending.at) <= 30 then
        -- Debounce: prevent same-frame double triggers from accidentally consuming the state
        if (gameTimer - (pending.timer or 0)) < 400 then
            return false
        end
        PendingMass[source] = nil
        return true
    end
    PendingMass[source] = { cmd = cmd, at = now, timer = gameTimer }
    return false
end

function A.ahealall(source)
    if source ~= 0 and not requirePerm(source, 'ahealall') then return end
    if source ~= 0 and not requireConfirm(source, 'ahealall') then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.mass_action_type_ahealall_again_within'), 'warning')
        return
    end
    local count = 0
    for _, pid in ipairs(GetPlayers()) do
        local src = tonumber(pid)
        TriggerClientEvent('sunset:admin:heal', src)
        count = count + 1
    end
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.healed_players', { count = math.floor(tonumber(count) or 0) }), 'success')
    pcall(function() exports.sunset_admin:BroadcastStaff(('[ADMIN] %s healed ALL players')
        :format(getDisplayName(source))) end)
end

function A.fixall(source)
    if source ~= 0 and not requirePerm(source, 'fixall') then return end
    if source ~= 0 and not requireConfirm(source, 'fixall') then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.mass_action_type_fixall_again_within'), 'warning')
        return
    end
    local count = 0
    for _, pid in ipairs(GetPlayers()) do
        local src = tonumber(pid)
        TriggerClientEvent('sunset:admin:repairVehicle', src)
        count = count + 1
    end
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.sent_repair_to_players', { count = math.floor(tonumber(count) or 0) }), 'success')
end

function A.dvall(source, args)
    if source == 0 then return end
    if not requirePerm(source, 'dvall') then return end
    if not requireConfirm(source, 'dvall') then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.destructive_mass_action_type_dvall_again'), 'warning')
        return
    end
    -- Server-side sweep: find unoccupied vehicles near the admin that are NOT
    -- registered in the vehicles table (owned cars are never touched).
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return end
    local center = GetEntityCoords(ped)
    local ownedPlates = {}
    local rows = MySQL.query.await('SELECT plate FROM vehicles') or {}
    for _, row in ipairs(rows) do
        ownedPlates[tostring(row.plate or ''):gsub('%s+', ''):upper()] = true
    end
    local deleted = 0
    for _, veh in ipairs(GetAllVehicles()) do
        if veh ~= 0 and DoesEntityExist(veh) then
            local vc = GetEntityCoords(veh)
            if #(vc - center) <= 60.0 then
                local occupied = GetPedInVehicleSeat(veh, -1) ~= 0 or GetVehicleNumberOfPassengers(veh) > 0
                local plate = (GetVehicleNumberPlateText(veh) or ''):gsub('%s+', ''):upper()
                if not occupied and not ownedPlates[plate] then
                    DeleteEntity(veh)
                    deleted = deleted + 1
                end
            end
        end
    end
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.deleted_unowned_vehicle_s_within_60m', { deleted = math.floor(tonumber(deleted) or 0) }), 'success')
    pcall(function() exports.sunset_admin:BroadcastStaff(('[ADMIN] %s dvall: deleted %d vehicle(s)')
        :format(getDisplayName(source), deleted)) end)
end

-- ── /gotoid alias (G15/4.10) ───────────────────────────────────
function A.gotoid(source, args)
    -- alias of /tp [id] (muscle memory from other frameworks)
    if source == 0 then return end
    if not requirePerm(source, 'tp') then return end
    local target = getTarget(source, args[1], 'Usage: /gotoid [player id]')
    if not target then return end
    local ped = GetPlayerPed(target)
    if not ped or ped == 0 then return end
    local coords = GetEntityCoords(ped)
    if targetInProperty(target) and SavedBucket[source] == nil then
        SavedBucket[source] = GetPlayerRoutingBucket(source) or 0
    end
    SetPlayerRoutingBucket(source, GetPlayerRoutingBucket(target) or 0)
    TriggerClientEvent('sunset:admin:teleport', source, coords.x, coords.y, coords.z)
    markAnticheat(source, 'gotoid')
end

-- ── /setclan (level 3, G18) ────────────────────────────────────
-- Domain rule: sunset_clans owns clan_members — go through its Admin*
-- exports (server/admin_ops.lua) instead of writing the table here.
function A.setclan(source, args)
    if source ~= 0 and not requirePerm(source, 'setclan') then return end
    local target = getTarget(source, args[1], 'Usage: /setclan [player id] [clanId|none] [rank]')
    if not target then return end
    if GetResourceState('sunset_clans') ~= 'started' then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.the_clan_system_is_unavailable_right'), 'error')
        return
    end
    local clanArg = tostring(args[2] or ''):lower()
    local rank = math.max(1, math.min(10, math.floor(tonumber(args[3]) or 1)))
    local char = exports.sunset_core:GetCharacter(target)
    if not char then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.player_has_no_character_loaded', { target = math.floor(tonumber(target) or 0) }), 'error')
        return
    end

    if clanArg == '' or clanArg == 'none' then
        local ok, removedOrErr = pcall(function() return exports.sunset_clans:AdminRemoveFromClan(char.id) end)
        if not ok then
            notify(source, tostring(removedOrErr), 'error')
            return
        end
        pcall(function() exports.sunset_clans:SyncPlayerClan(target) end)
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.removed_from_their_clan_row_s', { target = math.floor(tonumber(target) or 0), removed_or_err = tostring(removedOrErr) }), 'success')
        TriggerClientEvent('sunset:client:notify', target, exports.sunset_core:TFor(target, 'admin.message.staff_removed_you_from_your_clan'), 'warning')
        return
    end

    local ok, resultOrErr = pcall(function() return exports.sunset_clans:AdminSetClan(char.id, tonumber(clanArg), rank) end)
    if not ok or not resultOrErr then
        notify(source, tostring(resultOrErr or 'Could not set the clan.'), 'error')
        return
    end
    pcall(function() exports.sunset_clans:SyncPlayerClan(target) end)
    notify(source, exports.sunset_core:TFor(source, 'admin.msg.set_to_clan_rank', { target = math.floor(tonumber(target) or 0), tag = tostring(resultOrErr.tag or '--'), name = tostring(resultOrErr.name or '?'), rank = math.floor(tonumber(resultOrErr.rank or rank) or 0) }), 'success')
    TriggerClientEvent('sunset:client:notify', target,
        ('Staff moved you to clan [%s] %s.'):format(resultOrErr.tag or '--', resultOrErr.name or '?'), 'info')
end

-- ── /aduty — toggle helper on-duty flag (ADMIN_SYSTEM_SPEC §2.3) ──
-- Sets a statebag flag so sunset_chat can inject the [HELPER] prefix.
-- Off-duty helpers act silently (same perms, no visible prefix).
local AdminDuty = {} -- [src] = true
local HelperDuty = {} -- [src] = true

function A.aduty(source, args)
    if source == 0 then return end
    if not IsAdmin(source, 1) then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.doar_administratorii_pot_folosi_aduty'), 'error')
        return
    end
    AdminDuty[source] = not AdminDuty[source] or nil
    local on = AdminDuty[source] == true
    pcall(function()
        Player(source).state:set('adminDuty', on, true)
    end)
    local name = getDisplayName(source)
    notify(source, on
        and exports.sunset_core:TFor(source, 'admin.msg.te_ai_pus_on_duty_ca')
        or exports.sunset_core:TFor(source, 'admin.msg.te_ai_pus_off_duty_ca'), 'info')
    local dutyMsg = ('Admin %s este acum %s.'):format(name, on and 'ON DUTY' or 'OFF DUTY')
    for _, pid in ipairs(GetPlayers()) do
        local p = tonumber(pid)
        if p and IsStaff(p) then
            TriggerClientEvent('sunset:chat:system', p, dutyMsg, 'info')
        end
    end
    if GetResourceState('sunset_anticheat') == 'started' then
        pcall(function() exports.sunset_anticheat:MarkAdminAction(source, 'aduty') end)
    end
end

function A.hduty(source, args)
    if source == 0 then return end
    if not IsHelper(source, 1) then
        notify(source, exports.sunset_core:TFor(source, 'admin.msg.doar_helperii_pot_folosi_hduty'), 'error')
        return
    end
    HelperDuty[source] = not HelperDuty[source] or nil
    local on = HelperDuty[source] == true
    pcall(function()
        Player(source).state:set('helperDuty', on, true)
    end)
    local name = getDisplayName(source)
    notify(source, on
        and exports.sunset_core:TFor(source, 'admin.msg.you_are_now_on_duty_as')
        or exports.sunset_core:TFor(source, 'admin.msg.you_are_now_off_duty_as'), 'info')
    local dutyMsg = ('Helper %s este acum %s.'):format(name, on and 'ON DUTY' or 'OFF DUTY')
    for _, pid in ipairs(GetPlayers()) do
        local p = tonumber(pid)
        if p and IsStaff(p) then
            TriggerClientEvent('sunset:chat:system', p, dutyMsg, 'info')
        end
    end
end

exports('IsOnAdminDuty', function(src)
    return AdminDuty[tonumber(src or -1)] == true
end)

exports('IsOnHelperDuty', function(src)
    return HelperDuty[tonumber(src or -1)] == true
end)

AddEventHandler('playerDropped', function()
    AdminDuty[tonumber(source)] = nil
    HelperDuty[tonumber(source)] = nil
end)

-- ── registration (commands are registered here; requirePerm etc.
--    are injected from commands.lua via SunsetAdmin.ActionsInit) ──
function A.init(env)
    hasPerm = env.hasPerm
    notify = env.notify
    requirePerm = env.requirePerm
    getTarget = env.getTarget
    guardSelfTarget = env.guardSelfTarget
    resolveTarget = env.resolveTarget
    registerServerCommand = env.registerServerCommand

    registerServerCommand('freeze', function(source, args) A.freeze(source, args) end, false)
    registerServerCommand('unfreeze', function(source, args) A.unfreeze(source, args) end, false)
    registerServerCommand('slap', function(source, args) A.slap(source, args) end, false)
    registerServerCommand('pullout', function(source, args) A.pullout(source, args) end, false)
    registerServerCommand('spec', function(source, args) A.spectate(source, args) end, false)
    registerServerCommand('spectate', function(source, args) A.spectate(source, args) end, false)
    registerServerCommand('tpcar', function(source, args) A.tpcar(source, args) end, false)
    registerServerCommand('bringcar', function(source, args) A.bringcar(source, args) end, false)
    registerServerCommand('tpback', function(source, args) A.tpback(source, args) end, false)
    registerServerCommand('ajail', function(source, args) A.ajail(source, args) end, false)
    registerServerCommand('aunjail', function(source, args) A.aunjail(source, args) end, false)
    registerServerCommand('aclear', function(source, args) A.aclear(source, args) end, false)
    registerServerCommand('ahealall', function(source) A.ahealall(source) end, false)
    registerServerCommand('fixall', function(source) A.fixall(source) end, false)
    registerServerCommand('dvall', function(source, args) A.dvall(source, args) end, false)
    registerServerCommand('gotoid', function(source, args) A.gotoid(source, args) end, false)
    registerServerCommand('setclan', function(source, args) A.setclan(source, args) end, false)
    registerServerCommand('aduty', function(source, args) A.aduty(source, args) end, false)
    registerServerCommand('hduty', function(source, args) A.hduty(source, args) end, false)
end

SunsetAdmin.Actions = A
print('^2[sunset_admin]^7 presence tools loaded (freeze/slap/spectate/tpcar/ajail/mass)')
