-- ═══════════════════════════════════════════════════════════════
--  SUNSET ADMIN — 3D Vehicle & Trailer Gizmo Positioner
--  Allows admins to freely move, rotate, pitch, roll, and snap
--  vehicles/trailers in 3D space to set precise bays and coordinates.
-- ═══════════════════════════════════════════════════════════════

local isGizmoActive = false
local currentVeh = 0
local initialCoords = nil
local initialRot = nil
local vehHeading = 0.0
local vehCoords = vector3(0.0, 0.0, 0.0)
local vehRot = vector3(0.0, 0.0, 0.0)

local function round2(num)
    return math.floor(num * 100 + 0.5) / 100
end

local function notify(msg, typ)
    if exports.sunset_ui and exports.sunset_ui.Notify then
        exports.sunset_ui:Notify(msg, typ or 'info', 7000)
    else
        TriggerEvent('chat:addMessage', { color = { 255, 165, 0 }, args = { '[VEH GIZMO]', msg } })
    end
end

local function drawText2D(x, y, text, scale, r, g, b, a, font, center)
    SetTextFont(font or 4)
    SetTextScale(scale or 0.35, scale or 0.35)
    SetTextColour(r or 255, g or 255, b or 255, a or 255)
    SetTextDropshadow(2, 0, 0, 0, 200)
    SetTextEdge(1, 0, 0, 0, 255)
    SetTextOutline()
    if center then SetTextCentre(true) end
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayText(x, y)
end

local function drawGizmoHUD(modelName, x, y, z, h, pitch, roll, speedLabel)
    -- Background card
    DrawRect(0.81, 0.28, 0.34, 0.38, 15, 23, 42, 225)
    DrawRect(0.81, 0.095, 0.34, 0.035, 255, 140, 0, 240)
    drawText2D(0.81, 0.082, 'VEHICLE / TRAILER GIZMO (Placement Tool)', 0.38, 0, 0, 0, 255, 4, true)

    local startY = 0.125
    local gap = 0.024
    drawText2D(0.65, startY + gap * 0, ('Model: ~y~%s~s~ | Speed: ~g~%s~s~'):format(modelName, speedLabel), 0.32)
    drawText2D(0.65, startY + gap * 1, ('Position: ~b~X:~s~ %.2f  ~b~Y:~s~ %.2f  ~b~Z:~s~ %.2f'):format(x, y, z), 0.32)
    drawText2D(0.65, startY + gap * 2, ('Heading: ~y~%.2f°~s~ | Pitch: %.1f° | Roll: %.1f°'):format(h, pitch, roll), 0.32)

    -- Divider
    DrawRect(0.81, startY + gap * 3 + 0.008, 0.32, 0.002, 255, 255, 255, 60)

    local cY = startY + gap * 3.5
    drawText2D(0.65, cY + gap * 0, '~y~[W/A/S/D]~s~ or ~y~[Arrows]~s~ : Move X / Y', 0.29)
    drawText2D(0.65, cY + gap * 1, '~y~[PgUp / PgDn]~s~ / ~y~[Space / Ctrl]~s~ : Move Up / Down', 0.29)
    drawText2D(0.65, cY + gap * 2, '~y~[Q / E]~s~ : Rotate Heading (Yaw)', 0.29)
    drawText2D(0.65, cY + gap * 3, '~y~[Num 8/2]~s~ : Pitch | ~y~[Num 4/6]~s~ : Roll', 0.29)
    drawText2D(0.65, cY + gap * 4, '~y~[G]~s~ : Snap to Ground | ~y~[R]~s~ : Reset Level', 0.29)
    drawText2D(0.65, cY + gap * 5, '~y~[Shift]~s~ : Fast (x4) | ~y~[Alt]~s~ : Slow (0.1x)', 0.29)
    drawText2D(0.65, cY + gap * 6, '~g~[ENTER]~s~ : Save & Export | ~r~[BACKSPACE / X]~s~ : Exit', 0.30)
end

local function drawVehicleBox(veh)
    local min, max = GetModelDimensions(GetEntityModel(veh))
    local fwd = GetEntityForwardVector(veh)

    -- Draw bounding box lines
    local corners = {
        GetOffsetFromEntityInWorldCoords(veh, min.x, min.y, min.z),
        GetOffsetFromEntityInWorldCoords(veh, max.x, min.y, min.z),
        GetOffsetFromEntityInWorldCoords(veh, max.x, max.y, min.z),
        GetOffsetFromEntityInWorldCoords(veh, min.x, max.y, min.z),
        GetOffsetFromEntityInWorldCoords(veh, min.x, min.y, max.z),
        GetOffsetFromEntityInWorldCoords(veh, max.x, min.y, max.z),
        GetOffsetFromEntityInWorldCoords(veh, max.x, max.y, max.z),
        GetOffsetFromEntityInWorldCoords(veh, min.x, max.y, max.z),
    }

    local r, g, b = 0, 255, 204
    -- Bottom loop
    DrawLine(corners[1].x, corners[1].y, corners[1].z, corners[2].x, corners[2].y, corners[2].z, r, g, b, 255)
    DrawLine(corners[2].x, corners[2].y, corners[2].z, corners[3].x, corners[3].y, corners[3].z, r, g, b, 255)
    DrawLine(corners[3].x, corners[3].y, corners[3].z, corners[4].x, corners[4].y, corners[4].z, r, g, b, 255)
    DrawLine(corners[4].x, corners[4].y, corners[4].z, corners[1].x, corners[1].y, corners[1].z, r, g, b, 255)
    -- Top loop
    DrawLine(corners[5].x, corners[5].y, corners[5].z, corners[6].x, corners[6].y, corners[6].z, r, g, b, 255)
    DrawLine(corners[6].x, corners[6].y, corners[6].z, corners[7].x, corners[7].y, corners[7].z, r, g, b, 255)
    DrawLine(corners[7].x, corners[7].y, corners[7].z, corners[8].x, corners[8].y, corners[8].z, r, g, b, 255)
    DrawLine(corners[8].x, corners[8].y, corners[8].z, corners[5].x, corners[5].y, corners[5].z, r, g, b, 255)
    -- Vertical pillars
    DrawLine(corners[1].x, corners[1].y, corners[1].z, corners[5].x, corners[5].y, corners[5].z, r, g, b, 255)
    DrawLine(corners[2].x, corners[2].y, corners[2].z, corners[6].x, corners[6].y, corners[6].z, r, g, b, 255)
    DrawLine(corners[3].x, corners[3].y, corners[3].z, corners[7].x, corners[7].y, corners[7].z, r, g, b, 255)
    DrawLine(corners[4].x, corners[4].y, corners[4].z, corners[8].x, corners[8].y, corners[8].z, r, g, b, 255)

    -- Direction pointer (Front arrow)
    local center = GetEntityCoords(veh)
    local frontPoint = center + fwd * (max.y + 2.5)
    DrawLine(center.x, center.y, center.z, frontPoint.x, frontPoint.y, frontPoint.z, 255, 200, 0, 255)
    DrawMarker(21, frontPoint.x, frontPoint.y, frontPoint.z, 0, 0, 0, 0, 0, 0, 0.8, 0.8, 0.8, 255, 200, 0, 200, false, false, 2, false, nil, nil, false)
end

function StartVehGizmo(veh)
    if not veh or veh == 0 or not DoesEntityExist(veh) then
        notify(exports.sunset_core:Translate('admin.message.no_vehicle_selected_to_position'), 'error')
        return
    end

    if isGizmoActive then
        notify(exports.sunset_core:Translate('admin.message.gizmo_positioner_is_already_active'), 'error')
        return
    end

    currentVeh = veh
    isGizmoActive = true

    SetEntityAsMissionEntity(veh, true, true)
    FreezeEntityPosition(veh, true)
    SetVehicleEngineOn(veh, false, true, true)
    SetEntityCollision(veh, false, false)

    initialCoords = GetEntityCoords(veh)
    initialRot = GetEntityRotation(veh, 2)
    vehCoords = initialCoords
    vehRot = initialRot
    vehHeading = GetEntityHeading(veh)

    local modelHash = GetEntityModel(veh)
    local modelName = 'Vehicle'
    for name, _ in pairs({ phantom = true, tanker = true, trailers = true, trailers2 = true, docktrailer = true, tr2 = true, mule = true, benson = true, pounder2 = true }) do
        if joaat(name) == modelHash then modelName = name break end
    end

    notify(('Vehicle Gizmo activated for %s. Use keyboard controls.'):format(modelName), 'info', 7000)

    CreateThread(function()
        while isGizmoActive do
            Wait(0)
            if not DoesEntityExist(currentVeh) then
                isGizmoActive = false
                break
            end

            -- Disable default controls that conflict with gizmo
            DisableControlAction(0, 30, true)  -- D
            DisableControlAction(0, 31, true)  -- S
            DisableControlAction(0, 32, true)  -- W
            DisableControlAction(0, 34, true)  -- A
            DisableControlAction(0, 44, true)  -- Q
            DisableControlAction(0, 38, true)  -- E
            DisableControlAction(0, 23, true)  -- F (Enter vehicle)
            DisableControlAction(0, 75, true)  -- Exit vehicle
            DisableControlAction(0, 22, true)  -- Jump / Space
            DisableControlAction(0, 36, true)  -- LCtrl
            DisableControlAction(0, 21, true)  -- Shift

            -- Speed multiplier
            local speed = 0.08
            local speedLabel = 'NORMAL'
            if IsDisabledControlPressed(0, 21) or IsControlPressed(0, 21) then -- Shift
                speed = 0.35
                speedLabel = 'FAST (x4)'
            elseif IsDisabledControlPressed(0, 19) or IsControlPressed(0, 19) then -- Alt
                speed = 0.015
                speedLabel = 'SLOW (0.2x)'
            end

            local rotSpeed = speed > 0.1 and 2.0 or (speed < 0.05 and 0.25 or 1.0)

            -- Orientation vectors
            local rad = math.rad(vehHeading)
            local fwdX = -math.sin(rad)
            local fwdY = math.cos(rad)
            local rightX = math.cos(rad)
            local rightY = math.sin(rad)

            local dx, dy, dz = 0.0, 0.0, 0.0

            -- Forward / Backward (W / S / Up / Down)
            if IsDisabledControlPressed(0, 32) or IsControlPressed(0, 172) then
                dx = dx + fwdX * speed
                dy = dy + fwdY * speed
            end
            if IsDisabledControlPressed(0, 31) or IsControlPressed(0, 173) then
                dx = dx - fwdX * speed
                dy = dy - fwdY * speed
            end

            -- Left / Right (A / D / Left / Right)
            if IsDisabledControlPressed(0, 34) or IsControlPressed(0, 174) then
                dx = dx - rightX * speed
                dy = dy - rightY * speed
            end
            if IsDisabledControlPressed(0, 30) or IsControlPressed(0, 175) then
                dx = dx + rightX * speed
                dy = dy + rightY * speed
            end

            -- Up / Down (PageUp / PageDown / Space / Ctrl / Q / Z)
            if IsDisabledControlPressed(0, 22) or IsControlPressed(0, 10) then -- Space / PageUp
                dz = dz + speed
            end
            if IsDisabledControlPressed(0, 36) or IsControlPressed(0, 11) then -- Ctrl / PageDown
                dz = dz - speed
            end

            -- Rotation: Yaw / Heading (Q / E)
            if IsDisabledControlPressed(0, 44) or IsControlPressed(0, 117) then -- Q / Num 7
                vehHeading = (vehHeading + rotSpeed) % 360.0
            end
            if IsDisabledControlPressed(0, 38) or IsControlPressed(0, 118) then -- E / Num 9
                vehHeading = (vehHeading - rotSpeed) % 360.0
            end

            -- Pitch (Numpad 8 / 2)
            if IsControlPressed(0, 111) then -- Num 8
                vehRot = vector3(vehRot.x + rotSpeed * 0.5, vehRot.y, vehRot.z)
            end
            if IsControlPressed(0, 112) then -- Num 2
                vehRot = vector3(vehRot.x - rotSpeed * 0.5, vehRot.y, vehRot.z)
            end

            -- Roll (Numpad 4 / 6)
            if IsControlPressed(0, 114) then -- Num 4
                vehRot = vector3(vehRot.x, vehRot.y - rotSpeed * 0.5, vehRot.z)
            end
            if IsControlPressed(0, 115) then -- Num 6
                vehRot = vector3(vehRot.x, vehRot.y + rotSpeed * 0.5, vehRot.z)
            end

            -- Ground Snap (G)
            if IsControlJustPressed(0, 47) or IsDisabledControlJustPressed(0, 47) then
                SetEntityCoordsNoOffset(currentVeh, vehCoords.x, vehCoords.y, vehCoords.z, false, false, false)
                SetEntityHeading(currentVeh, vehHeading)
                SetVehicleOnGroundProperly(currentVeh)
                vehCoords = GetEntityCoords(currentVeh)
                vehRot = GetEntityRotation(currentVeh, 2)
                vehHeading = GetEntityHeading(currentVeh)
                PlaySoundFrontend(-1, 'NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false)
                notify(exports.sunset_core:Translate('admin.message.snapped_vehicle_to_ground_level'), 'info')
            end

            -- Reset Level (R)
            if IsControlJustPressed(0, 45) then
                vehRot = vector3(0.0, 0.0, vehRot.z)
                SetEntityRotation(currentVeh, 0.0, 0.0, vehHeading, 2, true)
                notify(exports.sunset_core:Translate('admin.message.reset_pitch_and_roll_to_0_0'), 'info')
            end

            -- Apply translation / rotation updates
            if dx ~= 0.0 or dy ~= 0.0 or dz ~= 0.0 then
                vehCoords = vector3(vehCoords.x + dx, vehCoords.y + dy, vehCoords.z + dz)
                SetEntityCoordsNoOffset(currentVeh, vehCoords.x, vehCoords.y, vehCoords.z, false, false, false)
            end

            SetEntityRotation(currentVeh, vehRot.x, vehRot.y, vehHeading, 2, true)
            SetEntityHeading(currentVeh, vehHeading)

            -- Render visual bounding box & HUD
            drawVehicleBox(currentVeh)
            drawGizmoHUD(modelName, vehCoords.x, vehCoords.y, vehCoords.z, vehHeading, vehRot.x, vehRot.y, speedLabel)

            -- CONFIRM & SAVE COORDS (ENTER)
            if IsControlJustPressed(0, 18) or IsControlJustPressed(0, 191) or IsControlJustPressed(0, 201) then
                isGizmoActive = false
                SetEntityCollision(currentVeh, true, true)
                FreezeEntityPosition(currentVeh, true)

                local rx = round2(vehCoords.x)
                local ry = round2(vehCoords.y)
                local rz = round2(vehCoords.z)
                local rh = round2(vehHeading)

                local v4Str = ('vector4(%.2f, %.2f, %.2f, %.2f)'):format(rx, ry, rz, rh)
                local v3Str = ('vector3(%.2f, %.2f, %.2f)'):format(rx, ry, rz)
                local tableStr = ('{ coords = vector4(%.2f, %.2f, %.2f, %.2f), label = "Bay" },'):format(rx, ry, rz, rh)

                PlaySoundFrontend(-1, 'CHECKPOINT_PERFECT', 'HUD_MINI_GAME_SOUNDSET', false)

                -- Print to F8 console
                print('^2═══════════════════════════════════════════════════════════════^7')
                print('^3[SUNSET VEH GIZMO] SAVED COORDINATES:^7')
                print(('^2vector4:^7 %s'):format(v4Str))
                print(('^2table:  ^7 %s'):format(tableStr))
                print(('^2vector3:^7 %s'):format(v3Str))
                print('^2═══════════════════════════════════════════════════════════════^7')

                -- Send to server for log & chat echo
                TriggerServerEvent('sunset:admin:saveGizmoCoords', {
                    model = modelName,
                    v4 = v4Str,
                    tbl = tableStr,
                    v3 = v3Str,
                    x = rx, y = ry, z = rz, h = rh
                })

                notify(('Coords saved! %s — check F8 / chat'):format(v4Str), 'success', 9000)
                break
            end

            -- CANCEL & EXIT (BACKSPACE / X)
            if IsControlJustPressed(0, 177) or IsControlJustPressed(0, 73) then
                isGizmoActive = false
                SetEntityCollision(currentVeh, true, true)
                FreezeEntityPosition(currentVeh, false)
                notify(exports.sunset_core:Translate('admin.message.exited_vehicle_gizmo_mode'), 'info')
                break
            end
        end
    end)
end

RegisterNetEvent('sunset:admin:startVehGizmo', function()
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    if veh == 0 or not DoesEntityExist(veh) then
        local ppos = GetEntityCoords(ped)
        veh = GetClosestVehicle(ppos.x, ppos.y, ppos.z, 20.0, 0, 71)
    end
    if not veh or veh == 0 or not DoesEntityExist(veh) then
        notify(exports.sunset_core:Translate('admin.message.no_vehicle_trailer_found_nearby_use_spawntrailer_to_spawn'), 'error')
        return
    end
    StartVehGizmo(veh)
end)

RegisterNetEvent('sunset:admin:spawnTrailerGizmo', function(model)
    model = model or 'tanker'
    local hash = joaat(model)
    if not IsModelInCdimage(hash) then
        notify(('Invalid trailer model: %s'):format(model), 'error')
        return
    end

    RequestModel(hash)
    local deadline = GetGameTimer() + 5000
    while not HasModelLoaded(hash) do
        if GetGameTimer() > deadline then
            notify(exports.sunset_core:Translate('admin.message.failed_to_load_model_in_time'), 'error')
            return
        end
        Wait(10)
    end

    local ped = PlayerPedId()
    local ppos = GetEntityCoords(ped)
    local fwd = GetEntityForwardVector(ped)
    local heading = GetEntityHeading(ped)
    local spawnPos = ppos + fwd * 6.0

    TriggerServerEvent('sunset:anticheat:markLegitLocal', 'vehicle_spawn', 15)
    local veh = CreateVehicle(hash, spawnPos.x, spawnPos.y, spawnPos.z, heading, true, false)
    SetModelAsNoLongerNeeded(hash)

    if veh == 0 or not DoesEntityExist(veh) then
        notify(exports.sunset_core:Translate('admin.message.could_not_create_trailer_entity'), 'error')
        return
    end

    SetVehicleOnGroundProperly(veh)
    StartVehGizmo(veh)
end)

-- [CLIENT_PERF_ENTITY_AUDIT] Restore the vehicle if the resource stops mid-gizmo.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if isGizmoActive and currentVeh ~= 0 and DoesEntityExist(currentVeh) then
        SetEntityCollision(currentVeh, true, true)
        FreezeEntityPosition(currentVeh, false)
    end
    isGizmoActive = false
end)
