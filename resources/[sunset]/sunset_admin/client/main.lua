local adminLevel = 0
local noclip = false
local godmode = false
local vehicleDebugLabels = false
local debugLabelVehicles = {}

RegisterNetEvent('sunset:client:setAdmin', function(level)
    adminLevel = level or 0
end)

RegisterNetEvent('sunset:admin:teleport', function(x, y, z)
    local ped = PlayerPedId()
    TriggerEvent('sunset:world:clearTooltips')
    -- [FALL FIX] Request collision before teleporting; without it the ped
    -- falls through the map because the ground hasn't streamed in yet.
    RequestCollisionAtCoord(x + 0.0, y + 0.0, z + 0.0)
    FreezeEntityPosition(ped, true)
    SetEntityCoords(ped, x + 0.0, y + 0.0, z + 0.0, false, false, false, false)
    Wait(100)
    FreezeEntityPosition(ped, false)
end)

RegisterNetEvent('sunset:admin:giveWeapon', function(weapon, ammo, adminSource)
    local ped = PlayerPedId()
    local hash = joaat(weapon)
    if not IsWeaponValid(hash) then
        TriggerServerEvent('sunset:admin:weaponGiveFailed', adminSource, weapon)
        return
    end
    GiveWeaponToPed(ped, hash, ammo or 120, false, true)
    SetCurrentPedWeapon(ped, hash, true)
end)

RegisterNetEvent('sunset:admin:spawnVehicle', function(model)
    local hash = joaat(model)
    RequestModel(hash)
    local timeout = 0
    while not HasModelLoaded(hash) and timeout < 100 do Wait(10) timeout = timeout + 1 end
    if not HasModelLoaded(hash) then return end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    -- [ANTICHEAT] whitelist this spawn for the vehspawn ledger detector
    TriggerServerEvent('sunset:anticheat:markLegitLocal', 'vehicle_spawn', 15)
    local veh = CreateVehicle(hash, coords.x, coords.y, coords.z, heading, true, false)
    SetEntityAsMissionEntity(veh, true, true)
    SetVehicleHasBeenOwnedByPlayer(veh, true)
    SetPedIntoVehicle(ped, veh, -1)
    SetModelAsNoLongerNeeded(hash)
    exports.sunset_vehicles:SetFuelLevel(veh, 100.0)
end)

RegisterNetEvent('sunset:admin:deleteVehicle', function()
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    if veh == 0 then
        local coords = GetEntityCoords(ped)
        veh = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 0)
        if veh == 0 then
            local closest, closestDist = 0, 20.0
            for _, candidate in ipairs(GetGamePool('CVehicle')) do
                local dist = #(coords - GetEntityCoords(candidate))
                if dist < closestDist then
                    closest = candidate
                    closestDist = dist
                end
            end
            veh = closest
        end
    end
    if veh ~= 0 then DeleteEntity(veh) end
end)

RegisterNetEvent('sunset:admin:repairVehicle', function()
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    if veh == 0 then
        local coords = GetEntityCoords(ped)
        veh = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 0)
        if veh == 0 then
            local closest, closestDist = 0, 20.0
            for _, candidate in ipairs(GetGamePool('CVehicle')) do
                local dist = #(coords - GetEntityCoords(candidate))
                if dist < closestDist then
                    closest = candidate
                    closestDist = dist
                end
            end
            veh = closest
        end
    end

    if veh == 0 or not DoesEntityExist(veh) then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.no_vehicle_found_nearby'), 'error')
        return
    end

    SetVehicleFixed(veh)
    SetVehicleDeformationFixed(veh)
    SetVehicleEngineHealth(veh, 1000.0)
    SetVehicleBodyHealth(veh, 1000.0)
    SetVehicleDirtLevel(veh, 0.0)
    SetVehiclePetrolTankHealth(veh, 1000.0)
    SetVehicleUndriveable(veh, false)
    SetVehicleEngineOn(veh, true, true, false)
    if GetResourceState('sunset_vehicles') == 'started' then
        pcall(function()
            exports.sunset_vehicles:SetFuelLevel(veh, 100.0)
            local plate = GetVehicleNumberPlateText(veh)
            if plate then
                TriggerServerEvent('sunset:vehicles:adminRepairDatabase', plate)
            end
        end)
    end
    exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.vehicle_repaired'), 'success')
end)


RegisterNetEvent('sunset:admin:heal', function()
    local ped = PlayerPedId()
    SetEntityHealth(ped, GetEntityMaxHealth(ped))
    SetPedArmour(ped, 100)
end)

RegisterNetEvent('sunset:admin:revive', function()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetEntityHealth(ped, GetEntityMaxHealth(ped))
    ClearPedBloodDamage(ped)
end)

RegisterNetEvent('sunset:admin:setHealth', function(hp)
    local ped = PlayerPedId()
    hp = tonumber(hp) or 200
    if hp <= 100 and hp > 0 then
        hp = 100 + hp
    end
    if hp > 200 then hp = 200 end
    if hp < 100 then hp = 100 end
    SetEntityHealth(ped, hp)
end)

RegisterNetEvent('sunset:admin:disarm', function()
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)
end)

RegisterNetEvent('sunset:admin:enterClosestVehicle', function()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local veh = GetClosestVehicle(coords.x, coords.y, coords.z, 15.0, 0, 70)
    if veh == 0 or not DoesEntityExist(veh) then
        local closest, closestDist = 0, 15.0
        for _, candidate in ipairs(GetGamePool('CVehicle')) do
            local dist = #(coords - GetEntityCoords(candidate))
            if dist < closestDist then
                closest = candidate
                closestDist = dist
            end
        end
        veh = closest
    end
    if veh ~= 0 and DoesEntityExist(veh) then
        for seat = -1, GetVehicleMaxNumberOfPassengers(veh) - 1 do
            if IsVehicleSeatFree(veh, seat) then
                TaskWarpPedIntoVehicle(ped, veh, seat)
                exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.teleportat_in_vehicul'), 'success')
                return
            end
        end
        TaskWarpPedIntoVehicle(ped, veh, -1)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.teleported_into_vehicle'), 'success')
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.no_vehicle_nearby'), 'error')
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  SA-MP-style /dl vehicle debug labels
--  Local entity diagnostics only; no DB queries and no work while disabled.
-- ═══════════════════════════════════════════════════════════════
local DL_RADIUS = 45.0
local DL_MAX_VEHICLES = 32
local DL_REFRESH_MS = 250

-- /dlp — prop / object debug labels (xray)
local DLP_RADIUS      = 30.0
local DLP_MAX_OBJECTS = 64
local DLP_REFRESH_MS  = 400
local propDebugLabels  = false
local debugLabelProps  = {}

local function trimPlate(value)
    value = tostring(value or '')
    return (value:gsub('^%s+', ''):gsub('%s+$', ''))
end

RegisterNetEvent('sunset:admin:toggleNoclip', function()
    noclip = not noclip
    exports.sunset_ui:Notify(noclip and exports.sunset_core:Translate('admin.msg.noclip_on') or exports.sunset_core:Translate('admin.msg.noclip_off'), 'info')
end)

RegisterNetEvent('sunset:admin:toggleGod', function()
    godmode = not godmode
    SetEntityInvincible(PlayerPedId(), godmode)
    exports.sunset_ui:Notify(godmode and exports.sunset_core:Translate('admin.msg.godmode_on') or exports.sunset_core:Translate('admin.msg.godmode_off'), 'info')
end)

-- ═══════════════════════════════════════════════════════════════
--  [ADMIN TOOLS] freeze / slap / pullout / spectate / tpcar / dvall
-- ═══════════════════════════════════════════════════════════════
local isFrozen = false

RegisterNetEvent('sunset:admin:freeze', function(state)
    isFrozen = state == true
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, isFrozen)
    if isFrozen then
        ClearPedTasksImmediately(ped)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.you_have_been_frozen_by_staff_do_not_disconnect'), 'error', 10000)
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.unfrozen_by_staff'), 'success', 5000)
    end
end)

CreateThread(function()
    while true do
        if isFrozen then
            DisableAllControlActions(0)
            local ped = PlayerPedId()
            local veh = GetVehiclePedIsIn(ped, false)
            if veh ~= 0 then FreezeEntityPosition(veh, true) end
            Wait(0)
        else
            Wait(500)
        end
    end
end)

RegisterNetEvent('sunset:admin:slap', function(adminSrc)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local dirX, dirY = 0.0, 0.0
    local adminPed = adminSrc and GetPlayerPed(GetPlayerFromServerId(adminSrc)) or 0
    if adminPed and adminPed ~= 0 and DoesEntityExist(adminPed) then
        local ac = GetEntityCoords(adminPed)
        local dx, dy = coords.x - ac.x, coords.y - ac.y
        local len = math.sqrt(dx * dx + dy * dy)
        if len > 0.1 then dirX, dirY = dx / len, dy / len end
    end
    ClearPedTasksImmediately(ped)
    ApplyForceToEntity(ped, 1, dirX * 10.0, dirY * 10.0, 15.0, 0.0, 0.0, 0.0, 0, false, true, true, false, true)
end)

RegisterNetEvent('sunset:admin:pullout', function()
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    if veh == 0 then return end
    TaskLeaveVehicle(ped, veh, 16) -- 16 = force out immediately
end)

-- /tpcar /bringcar: move ped AND vehicle together.
RegisterNetEvent('sunset:admin:teleportVehicle', function(x, y, z)
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    CreateThread(function()
        RequestCollisionAtCoord(x, y, z)
        local groundZ = z
        for _ = 1, 60 do
            local found, gz = GetGroundZFor_3dCoord(x, y, z + 100.0, false)
            if found then groundZ = gz + 1.0 break end
            Wait(50)
        end
        DoScreenFadeOut(250)
        Wait(300)
        if veh ~= 0 and DoesEntityExist(veh) then
            SetEntityCoords(veh, x, y, groundZ, false, false, false, false)
            SetEntityHeading(veh, GetEntityHeading(veh))
            if GetPedInVehicleSeat(veh, -1) ~= ped then
                SetPedIntoVehicle(ped, veh, -1)
            end
        else
            SetEntityCoords(ped, x, y, groundZ, false, false, false, false)
        end
        Wait(250)
        DoScreenFadeIn(400)
    end)
end)

-- ── Spectate (server pushes target coords at 1Hz) ──────────────
local specTarget = nil
local specLastCoords = nil
local specLastSync = 0

RegisterNetEvent('sunset:admin:spectateStart', function(targetSrc, initCoords)
    specTarget = targetSrc
    local ped = PlayerPedId()
    -- [AUDIT SPECTATE-DIST] Teleport admin near target before activating spectate
    -- mode so the target's ped is within streaming range on the first sync tick.
    if initCoords and type(initCoords) == 'table' and initCoords.x then
        -- Move admin 2 m beside the target (offset avoids overlap with the target ped)
        SetEntityCoordsNoOffset(ped, initCoords.x + 2.0, initCoords.y, initCoords.z, false, false, false)
    end
    -- keep coords, invisible + frozen (per spec §4.1)
    SetEntityVisible(ped, false, false)
    FreezeEntityPosition(ped, true)
    SetEntityCollision(ped, false, false)
    NetworkSetInSpectatorMode(true, ped)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.msg.spectating_spectate_off_to_exit', { target_src = math.floor(tonumber(targetSrc) or 0) }), 'info', 8000)
end)

RegisterNetEvent('sunset:admin:spectateSync', function(targetSrc, coords)
    if not specTarget or specTarget ~= targetSrc then return end
    specLastCoords = coords
    specLastSync = GetGameTimer()
    local targetPed = GetPlayerPed(GetPlayerFromServerId(targetSrc))
    if targetPed and targetPed ~= 0 and DoesEntityExist(targetPed) then
        NetworkSetInSpectatorMode(true, targetPed)
    end
end)

RegisterNetEvent('sunset:admin:spectateEnd', function()
    specTarget = nil
    specLastCoords = nil
    local ped = PlayerPedId()
    NetworkSetInSpectatorMode(false, ped)
    SetEntityVisible(ped, true, false)
    FreezeEntityPosition(ped, false)
    SetEntityCollision(ped, true, true)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.spectate_ended'), 'info', 4000)
end)

-- watchdog: no sync for 6s or target gone -> restore (spec failsafe)
CreateThread(function()
    while true do
        Wait(1000)
        if specTarget then
            local stale = specLastSync > 0 and (GetGameTimer() - specLastSync) > 6000
            local targetPed = GetPlayerPed(GetPlayerFromServerId(specTarget))
            if stale or not targetPed or targetPed == 0 then
                TriggerEvent('sunset:admin:spectateEnd')
            end
        end
    end
end)

local function hasCoordsPerm()
    local need = SunsetAdmin.Commands.coords or 2
    return adminLevel >= need
end

local function coordChat(line)
    exports.sunset_ui:Send('chatMessage', { id = 0, name = 'COORDS', message = line, time = '' })
end

local currentPosition

local function showPosition(args)
    if not hasCoordsPerm() then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.no_permission'), 'error')
        return
    end

    local x, y, z, heading = currentPosition()
    local useV4 = args and args[1] and string.lower(tostring(args[1])) == 'v4'

    if useV4 then
        local line = ('vector4(%.2f, %.2f, %.2f, %.2f)'):format(x, y, z, heading)
        print('[Sunset] ' .. line)
        coordChat(line)
    else
        local v3 = ('vector3(%.2f, %.2f, %.2f)'):format(x, y, z)
        local raw = ('%.2f, %.2f, %.2f, %.2f'):format(x, y, z, heading)
        print('[Sunset] ' .. v3)
        print('[Sunset] ' .. raw)
        coordChat(v3)
        coordChat(raw)
    end

    exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.position_in_chat_and_f8_use_coords_v4_for'), 'info')
end

RegisterNetEvent('sunset:admin:copyCoords', function(args)
    showPosition(args or {})
end)

-- Noclip thread
local noclipSpeedLevel = 0 -- 0 = normal, + = faster, - = slower
local NOCLIP_SPEEDS = { 0.4, 0.8, 1.2, 1.8, 3.0, 5.0, 8.0, 12.0, 18.0, 25.0 }
local NOCLIP_BASE_IDX = 4 -- index of 1.8 (normal speed)
local lastShiftPress = 0
local lastCtrlPress = 0
local speedHudUntil = 0   -- GetGameTimer() until the speed HUD stays visible
local speedHudValue = nil -- speed shown in the HUD

-- [SPEED HUD] Temporary indicator + subtle tick sound on every speed change.
local function setSpeedLevel(newLevel, speed)
    if newLevel == noclipSpeedLevel and speedHudValue == speed then return end
    noclipSpeedLevel = newLevel
    speedHudValue = speed
    speedHudUntil = GetGameTimer() + 1500 -- fade after 1.5s
    PlaySoundFrontend(-1, 'NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
end

local function drawNoclipSpeedHud(speed)
    -- Fade: alpha ramps down over the last 300ms of the 1.5s window.
    local remaining = speedHudUntil - GetGameTimer()
    if remaining <= 0 then return end
    local alpha = remaining < 300 and math.floor(255 * (remaining / 300)) or 255

    SetTextFont(4)
    SetTextScale(0.42, 0.42)
    SetTextCentre(true)
    SetTextColour(255, 255, 255, alpha)
    SetTextDropshadow(0, 0, 0, 0, 255)
    SetTextOutline()
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('admin.msg.noclip_speed', { speed = string.format('%.1f', speed) }))
    EndTextCommandDisplayText(0.5, 0.02)
end

CreateThread(function()
    while true do
        if noclip then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local cam = GetGameplayCamRot(2)
            local heading = cam.z
            local pitch = cam.x

            -- [INCREMENTAL SPEED] Shift = speed up, Ctrl = slow down.
            -- Each press steps one level; held keys repeat every 300ms.
            local now = GetGameTimer()
            if IsControlJustPressed(0, 21) or (IsControlPressed(0, 21) and now - lastShiftPress > 300) then
                lastShiftPress = now
                local lvl = math.min(noclipSpeedLevel + 1, #NOCLIP_SPEEDS - 1 - NOCLIP_BASE_IDX)
                if lvl ~= noclipSpeedLevel then
                    setSpeedLevel(lvl, NOCLIP_SPEEDS[NOCLIP_BASE_IDX + lvl])
                end
            end
            if IsControlJustPressed(0, 36) or (IsControlPressed(0, 36) and now - lastCtrlPress > 300) then
                lastCtrlPress = now
                local lvl = math.max(noclipSpeedLevel - 1, -(NOCLIP_BASE_IDX))
                if lvl ~= noclipSpeedLevel then
                    setSpeedLevel(lvl, NOCLIP_SPEEDS[NOCLIP_BASE_IDX + lvl])
                end
            end
            local speedIdx = NOCLIP_BASE_IDX + noclipSpeedLevel
            local speed = NOCLIP_SPEEDS[speedIdx] or 1.8

            if speedHudValue and GetGameTimer() < speedHudUntil then
                drawNoclipSpeedHud(speedHudValue)
            end

            SetEntityVelocity(ped, 0.0, 0.0, 0.0)
            SetEntityCollision(ped, false, false)
            FreezeEntityPosition(ped, true)
            SetEntityHeading(ped, heading)

            local function camForward()
                local rz, rx = math.rad(heading), math.rad(pitch)
                return vector3(-math.sin(rz) * math.cos(rx), math.cos(rz) * math.cos(rx), math.sin(rx))
            end
            local function camRight()
                local rz = math.rad(heading)
                return vector3(math.cos(rz), math.sin(rz), 0.0)
            end

            if IsControlPressed(0, 32) then coords = coords + camForward() * speed end
            if IsControlPressed(0, 33) then coords = coords - camForward() * speed end
            if IsControlPressed(0, 34) then coords = coords - camRight() * speed end
            if IsControlPressed(0, 35) then coords = coords + camRight() * speed end
            if IsControlPressed(0, 44) then coords = vector3(coords.x, coords.y, coords.z + speed) end
            if IsControlPressed(0, 38) then coords = vector3(coords.x, coords.y, coords.z - speed) end

            SetEntityCoordsNoOffset(ped, coords.x, coords.y, coords.z, false, false, false)
            Wait(0)
        else
            noclipSpeedLevel = 0
            local ped = PlayerPedId()
            SetEntityCollision(ped, true, true)
            FreezeEntityPosition(ped, false)
            Wait(500)
        end
    end
end)

exports('GetAdminLevel', function() return adminLevel end)

local speedMultiplier = 1.0

local function resetVehicleSpeed(veh)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return end
    SetVehicleEnginePowerMultiplier(veh, 1.0)
    SetVehicleEngineTorqueMultiplier(veh, 1.0)
    SetVehicleCheatPowerIncrease(veh, 0.0)
    ModifyVehicleTopSpeed(veh, 0.0)
    SetVehicleMaxSpeed(veh, 0.0)
end

local function applyVehicleSpeedBoost(veh, mult)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return end
    if mult <= 1.01 then
        resetVehicleSpeed(veh)
        return
    end

    SetVehicleMaxSpeed(veh, 0.0)
    -- Power multiplier is additive in GTA; small values like 2.5 have almost no effect.
    SetVehicleEnginePowerMultiplier(veh, (mult - 1.0) * 20.0)
    SetVehicleEngineTorqueMultiplier(veh, mult)
    SetVehicleCheatPowerIncrease(veh, (mult - 1.0) * 2.0)
    ModifyVehicleTopSpeed(veh, mult - 1.0)
end

local function setSpeedMultiplier(mult)
    mult = tonumber(mult) or 1.0
    mult = math.max(0.5, math.min(mult, 10.0))
    speedMultiplier = mult

    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        applyVehicleSpeedBoost(GetVehiclePedIsIn(ped, false), mult)
    end

    if mult <= 1.01 then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.speed_boost_disabled'), 'info')
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.msg.speed_boost_x', { mult = string.format('%.1f', mult) }), 'success')
    end
end

RegisterNetEvent('sunset:admin:setSpeed', setSpeedMultiplier)

-- GTA resets vehicle multipliers every frame while driving; re-apply while boosted.
CreateThread(function()
    while true do
        if speedMultiplier > 1.01 then
            local ped = PlayerPedId()
            if IsPedInAnyVehicle(ped, false) then
                local veh = GetVehiclePedIsIn(ped, false)
                if GetPedInVehicleSeat(veh, -1) == ped then
                    applyVehicleSpeedBoost(veh, speedMultiplier)
                    Wait(0)
                else
                    Wait(250)
                end
            else
                Wait(500)
            end
        else
            Wait(500)
        end
    end
end)

CreateThread(function()
    local lastVeh = 0
    while true do
        Wait(200)
        local ped = PlayerPedId()
        local veh = IsPedInAnyVehicle(ped, false) and GetVehiclePedIsIn(ped, false) or 0
        if veh ~= lastVeh then
            if lastVeh ~= 0 and DoesEntityExist(lastVeh) then
                resetVehicleSpeed(lastVeh)
            end
            if veh ~= 0 and speedMultiplier > 1.01 then
                applyVehicleSpeedBoost(veh, speedMultiplier)
            end
            lastVeh = veh
        end
    end
end)

currentPosition = function()
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    return c.x, c.y, c.z, GetEntityHeading(ped)
end

local function registerCoordsCommand(name)
    RegisterCommand(name, function(_, args)
        showPosition(args)
    end, false)
end

registerCoordsCommand('coords')
registerCoordsCommand('getpos')
registerCoordsCommand('pos')

RegisterCommand('setcp', function(_, args)
    local name = table.concat(args, ' ')
    local x, y, z, heading = currentPosition()
    TriggerServerEvent('sunset:admin:setcp', name, x, y, z, heading)
end, false)

RegisterCommand('delcp', function(_, args)
    TriggerServerEvent('sunset:admin:delcp', table.concat(args, ' '))
end, false)

RegisterCommand('gotocp', function(_, args)
    TriggerServerEvent('sunset:admin:gotocp', table.concat(args, ' '))
end, false)

RegisterCommand('gotoloc', function(_, args)
    TriggerServerEvent('sunset:admin:gotoloc', table.concat(args, ' '))
end, false)

RegisterCommand('speed', function(_, args)
    TriggerServerEvent('sunset:admin:requestSpeed', args[1])
end, false)

local function tpToWaypoint()
    if adminLevel < 1 then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.no_permission'), 'error')
        return
    end
    local blip = GetFirstBlipInfoId(8) -- 8 = waypoint blip
    if not DoesBlipExist(blip) then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.no_waypoint_set_on_map'), 'error')
        return
    end
    local coord = GetBlipInfoIdCoord(blip)
    -- Teleport immediately at a safe height so there is no visible delay.
    -- Pre-loading collision before moving caused up to 10s of apparent freeze
    -- (100 iterations × 100ms Wait) while the game streamed distant terrain.
    SetEntityCoords(PlayerPedId(), coord.x, coord.y, coord.z + 3.0, false, false, false, false)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.message.teleported_to_waypoint'), 'success')
    -- Silently snap to ground once collision has streamed in at the new location.
    -- The player being on-site forces GTA to load terrain much faster than
    -- requesting it remotely, so this usually resolves in 1-2 iterations.
    CreateThread(function()
        local found, groundZ
        for _ = 1, 30 do
            Wait(100)
            found, groundZ = GetGroundZFor_3dCoord(coord.x, coord.y, coord.z + 100.0, false)
            if found then break end
        end
        if found then
            SetEntityCoords(PlayerPedId(), coord.x, coord.y, groundZ + 0.5, false, false, false, false)
        end
    end)
end

RegisterCommand('tpwp', function() tpToWaypoint() end, false)

RegisterKeyMapping('tpwp', 'Teleport to waypoint (admin)', 'keyboard', 'F7')

CreateThread(function()
    Wait(4000)
    TriggerEvent('chat:addSuggestion', '/dl', 'Toggle SA-MP-style vehicle debug labels (admin)')
    TriggerEvent('chat:addSuggestion', '/coords', 'Show your position for configs (admin)', {
        { name = 'v4', help = 'Optional — output vector4 with heading' },
    })
    TriggerEvent('chat:addSuggestion', '/getpos', 'Alias for /coords (admin)')
    TriggerEvent('chat:addSuggestion', '/pos', 'Alias for /coords (admin)')
    TriggerEvent('chat:addSuggestion', '/setcp', 'Save your current position as a named checkpoint (admin)', {
        { name = 'name', help = 'e.g. staging, event_spawn' },
    })
    TriggerEvent('chat:addSuggestion', '/delcp', 'Delete a saved checkpoint (admin)', {
        { name = 'name', help = 'Checkpoint name saved with /setcp' },
    })
    TriggerEvent('chat:addSuggestion', '/gotocp', 'Teleport to a saved admin checkpoint', {
        { name = 'name', help = 'Omit or use list to show saved checkpoints' },
    })
    TriggerEvent('chat:addSuggestion', '/gotoloc', 'Teleport to a predefined world location (admin)', {
        { name = 'id or name', help = 'e.g. hq_medic, hospital — omit or use list' },
    })
    TriggerEvent('chat:addSuggestion', '/speed', 'Vehicle speed multiplier while driving (admin)', {
        { name = 'multiplier', help = 'e.g. 2.5 — omit or use off/1 to reset' },
    })
    TriggerEvent('chat:addSuggestion', '/tpwp', 'Teleport to your map waypoint (admin)')
    TriggerEvent('chat:addSuggestion', '/tp', 'Teleport to a player or coordinates (admin)', {
        { name = 'id or x', help = 'Player server id, or X coordinate / vector3(...)' },
        { name = 'y', help = 'Y coordinate (when using x y z)' },
        { name = 'z', help = 'Z coordinate (when using x y z)' },
    })
end)

local function vehicleModelLabel(model)
    return exports.sunset_vehicles:GetVehicleDisplayName(model)
end

local function networkOwnerServerId(veh)
    if not NetworkGetEntityIsNetworked(veh) then return nil end
    local owner = NetworkGetEntityOwner(veh)
    if owner == nil or owner < 0 or not NetworkIsPlayerActive(owner) then return nil end
    local sid = GetPlayerServerId(owner)
    return sid and sid > 0 and sid or nil
end

local function drawVehicleDebugLabel(veh, distance)
    if veh == 0 or not DoesEntityExist(veh) then return end

    local model = GetEntityModel(veh)
    local _, maxDim = GetModelDimensions(model)
    local roofOffset = (maxDim and maxDim.z or 1.2) + 0.45
    local pos = GetOffsetFromEntityInWorldCoords(veh, 0.0, 0.0, roofOffset)
    local visible, sx, sy = World3dToScreen2d(pos.x, pos.y, pos.z)
    if not visible then return end

    local entityId = veh
    local netId = NetworkGetEntityIsNetworked(veh) and NetworkGetNetworkIdFromEntity(veh) or 0
    local plate = trimPlate(GetVehicleNumberPlateText(veh))
    local modelName = vehicleModelLabel(model)
    local speed = GetEntitySpeed(veh) * 3.6
    local engine = GetVehicleEngineHealth(veh)
    local body = GetVehicleBodyHealth(veh)
    local ownerSid = networkOwnerServerId(veh)

    local line1 = ('~b~V:%d~s~  ~p~N:%s~s~  ~y~%s~s~  [%s]'):format(
        entityId,
        netId > 0 and tostring(netId) or '-',
        modelName,
        plate ~= '' and plate or 'NO PLATE'
    )
    local vpos = GetEntityCoords(veh)
    local line2 = ('%.1fm  |  %.0f km/h  |  ENG %.0f  BODY %.0f  |  NETOWN %s'):format(
        distance,
        speed,
        engine,
        body,
        ownerSid and ('#' .. ownerSid) or '-'
    )
    local vheading = GetEntityHeading(veh)
    local line3 = ('~o~%.1f, %.1f, %.1f  h=%.1f'):format(vpos.x, vpos.y, vpos.z, vheading)

    local scale = math.max(0.24, math.min(0.34, 0.38 - distance * 0.003))
    SetTextFont(0)
    SetTextScale(scale, scale)
    SetTextCentre(true)
    SetTextColour(255, 255, 255, 235)
    SetTextDropshadow(1, 0, 0, 0, 220)
    SetTextOutline()

    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(line1)
    EndTextCommandDisplayText(sx, sy)

    SetTextScale(math.max(0.22, scale - 0.025), math.max(0.22, scale - 0.025))
    SetTextColour(220, 225, 232, 225)
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(line2)
    EndTextCommandDisplayText(sx, sy + 0.015)

    SetTextScale(math.max(0.20, scale - 0.04), math.max(0.20, scale - 0.04))
    SetTextColour(200, 200, 200, 200)
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(line3)
    EndTextCommandDisplayText(sx, sy + 0.029)
end

local function refreshVehicleDebugCache()
    local ped = PlayerPedId()
    local origin = GetEntityCoords(ped)
    local candidates = {}

    for _, veh in ipairs(GetGamePool('CVehicle')) do
        if DoesEntityExist(veh) then
            local distance = #(origin - GetEntityCoords(veh))
            if distance <= DL_RADIUS then
                candidates[#candidates + 1] = { veh = veh, distance = distance }
            end
        end
    end

    table.sort(candidates, function(a, b) return a.distance < b.distance end)
    debugLabelVehicles = {}
    for i = 1, math.min(#candidates, DL_MAX_VEHICLES) do
        debugLabelVehicles[i] = candidates[i]
    end
end

RegisterNetEvent('sunset:admin:toggleVehicleDebugLabels', function()
    vehicleDebugLabels = not vehicleDebugLabels
    if not vehicleDebugLabels then
        debugLabelVehicles = {}
    end
    exports.sunset_ui:Notify(
        vehicleDebugLabels and exports.sunset_core:Translate('admin.msg.vehicle_debug_labels_on_m_radius', { dl_radius = math.floor(tonumber(DL_RADIUS) or 0) }) or exports.sunset_core:Translate('admin.msg.vehicle_debug_labels_off'),
        'info'
    )
end)

-- ═══ /dlp — PROP / OBJECT DEBUG LABELS ═══
local function drawPropDebugLabel(obj, distance, isVehicle)
    if obj == 0 or not DoesEntityExist(obj) then return end

    local objCoords = GetEntityCoords(obj)
    local visible, sx, sy = World3dToScreen2d(objCoords.x, objCoords.y, objCoords.z + 0.4)
    if not visible then return end

    local model = GetEntityModel(obj)
    local modelHex = ('0x%08X'):format(model & 0xFFFFFFFF)

    local modelName = modelHex
    if isVehicle then
        pcall(function() modelName = exports.sunset_vehicles:GetVehicleDisplayName(obj) end)
    end

    local netId   = NetworkGetEntityIsNetworked(obj) and NetworkGetNetworkIdFromEntity(obj) or 0
    local entType = isVehicle and '~r~VEH~s~' or '~b~OBJ~s~'
    local heading = GetEntityHeading(obj)

    local line1 = ('%s ~y~%s~s~  E:%d N:%s'):format(
        entType, modelName, obj,
        netId > 0 and tostring(netId) or '-'
    )
    local line2 = ('~o~%.1f, %.1f, %.1f~s~  ~g~h=%.1f~s~  ~w~%.1fm'):format(
        objCoords.x, objCoords.y, objCoords.z, heading, distance)

    local scale = math.max(0.22, math.min(0.32, 0.36 - distance * 0.004))
    SetTextFont(0)
    SetTextScale(scale, scale)
    SetTextCentre(true)
    SetTextColour(255, 255, 255, 230)
    SetTextDropshadow(1, 0, 0, 0, 200)
    SetTextOutline()

    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(line1)
    EndTextCommandDisplayText(sx, sy)

    SetTextScale(math.max(0.19, scale - 0.025), math.max(0.19, scale - 0.025))
    SetTextColour(200, 220, 200, 210)
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(line2)
    EndTextCommandDisplayText(sx, sy + 0.016)
end

local function refreshPropDebugCache()
    local ped    = PlayerPedId()
    local myVeh  = GetVehiclePedIsIn(ped, false)
    local origin = GetEntityCoords(ped)
    local candidates = {}

    -- Obiecte de mapping (CObject)
    for _, obj in ipairs(GetGamePool('CObject')) do
        if DoesEntityExist(obj) then
            local d = #(origin - GetEntityCoords(obj))
            if d <= DLP_RADIUS then
                candidates[#candidates + 1] = { obj = obj, dist = d, isVehicle = false }
            end
        end
    end

    -- Vehicule statice / remorci (exceptie vehiculul propriu)
    for _, v in ipairs(GetGamePool('CVehicle')) do
        if DoesEntityExist(v) and v ~= myVeh then
            local d = #(origin - GetEntityCoords(v))
            if d <= DLP_RADIUS then
                candidates[#candidates + 1] = { obj = v, dist = d, isVehicle = true }
            end
        end
    end

    table.sort(candidates, function(a, b) return a.dist < b.dist end)
    debugLabelProps = {}
    for i = 1, math.min(#candidates, DLP_MAX_OBJECTS) do
        debugLabelProps[i] = candidates[i]
    end
end

RegisterNetEvent('sunset:admin:togglePropDebugLabels', function()
    propDebugLabels = not propDebugLabels
    if not propDebugLabels then debugLabelProps = {} end
    exports.sunset_ui:Notify(
        propDebugLabels and exports.sunset_core:Translate('admin.msg.prop_debug_labels_on_m_radius', { dlp_radius = math.floor(tonumber(DLP_RADIUS) or 0), dlp_max_objects = math.floor(tonumber(DLP_MAX_OBJECTS) or 0) })
            or exports.sunset_core:Translate('admin.msg.prop_debug_labels_off'),
        'info'
    )
end)

CreateThread(function()
    local nextRefresh = 0
    while true do
        if propDebugLabels then
            local now = GetGameTimer()
            if now >= nextRefresh then
                refreshPropDebugCache()
                nextRefresh = now + DLP_REFRESH_MS
            end
            local ped    = PlayerPedId()
            local origin = GetEntityCoords(ped)
            for i = #debugLabelProps, 1, -1 do
                local entry = debugLabelProps[i]
                if entry.obj == 0 or not DoesEntityExist(entry.obj) then
                    table.remove(debugLabelProps, i)
                else
                    local d = #(origin - GetEntityCoords(entry.obj))
                    if d <= DLP_RADIUS then
                        drawPropDebugLabel(entry.obj, d, entry.isVehicle)
                    end
                end
            end
            Wait(0)
        else
            Wait(500)
        end
    end
end)

RegisterCommand('dlp', function()
    TriggerServerEvent('sunset:admin:requestTogglePropDebug')
end, false)

CreateThread(function()
    local nextRefresh = 0
    while true do
        if vehicleDebugLabels then
            local now = GetGameTimer()
            if now >= nextRefresh then
                refreshVehicleDebugCache()
                nextRefresh = now + DL_REFRESH_MS
            end

            local ped = PlayerPedId()
            local origin = GetEntityCoords(ped)
            for i = #debugLabelVehicles, 1, -1 do
                local entry = debugLabelVehicles[i]
                local veh = entry.veh
                if veh == 0 or not DoesEntityExist(veh) then
                    table.remove(debugLabelVehicles, i)
                else
                    local distance = #(origin - GetEntityCoords(veh))
                    if distance <= DL_RADIUS then
                        drawVehicleDebugLabel(veh, distance)
                    end
                end
            end
            Wait(0)
        else
            Wait(500)
        end
    end
end)

-- FNC (Force Name Change) Modal Flow
RegisterNetEvent('sunset:admin:openFncModal', function(data)
    data = data or {}
    local pName = LocalPlayer.state.sunsetName or LocalPlayer.state.name or 'Player'
    exports.sunset_ui:Send('fncModalShow', {
        currentName = data.currentName or pName,
        reason = data.reason or 'Forced name change by an admin',
        forced = data.forced == true,
        tokens = data.tokens or 1,
    })
    exports.sunset_ui:SetFocus(true, true)
end)

AddEventHandler('sunset:nui:fncClose', function()
    exports.sunset_ui:Send('fncModalHide', {})
    exports.sunset_ui:SetFocus(false, false)
end)

AddEventHandler('sunset:nui:fncSubmit', function(payload)
    local name = payload and payload.name
    Sunset.Callback('sunset:admin:submitFncName', function(ok, result)
        if ok then
            exports.sunset_ui:Send('fncModalHide', {})
            exports.sunset_ui:SetFocus(false, false)
            exports.sunset_ui:Notify(exports.sunset_core:Translate('admin.msg.your_name_has_been_updated', { result = tostring(result) }), 'success')
            TriggerEvent('sunset:client:onCharacterUpdated', { name = result, firstname = result })
        else
            exports.sunset_ui:Send('fncModalError', { error = result or exports.sunset_core:Translate('admin.ui.failed_to_change_name') })
        end
    end, name)
end)

-- [CLIENT_PERF_ENTITY_AUDIT] Resource-restart safety: never leave the local ped
-- invincible / frozen / invisible / collision-less when this resource stops.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    local ped = PlayerPedId()
    if ped and ped ~= 0 then
        if godmode then SetEntityInvincible(ped, false) end
        if noclip or isFrozen or specTarget then
            FreezeEntityPosition(ped, false)
            SetEntityCollision(ped, true, true)
        end
        if specTarget then
            NetworkSetInSpectatorMode(false, ped)
            SetEntityVisible(ped, true, false)
        end
    end
    godmode, noclip, isFrozen, specTarget = false, false, false, nil
end)
