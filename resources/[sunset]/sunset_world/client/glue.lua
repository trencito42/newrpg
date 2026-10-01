-- /glue — server-authoritative vehicle surf.
-- Sends the glue request to the server with the vehicle's network ID and
-- the ped's position in vehicle-local space (full 3-axis transform via
-- GetOffsetFromEntityGivenWorldCoords). The server broadcasts to all
-- clients; each client calls AttachEntityToEntity once both entities
-- are streamed, so remote players see the correct attachment.

local function notify(msg, kind)
    exports.sunset_ui:Notify(msg, kind or 'info', 4000)
end

-- Retry attaching until both entities are available on this client.
local function applyAttach(targetSrc, vehicleNetId, ox, oy, oz)
    CreateThread(function()
        local deadline = GetGameTimer() + 10000
        while GetGameTimer() < deadline do
            local ped = GetPlayerPed(GetPlayerFromServerId(targetSrc))
            local veh = NetworkGetEntityFromNetworkId(vehicleNetId)
            if DoesEntityExist(ped) and DoesEntityExist(veh) then
                AttachEntityToEntity(ped, veh, -1, ox, oy, oz, 0.0, 0.0, 0.0,
                    false, false, false, true, 0, true)
                return
            end
            Wait(250)
        end
    end)
end

local function applyDetach(targetSrc)
    local ped = GetPlayerPed(GetPlayerFromServerId(targetSrc))
    if DoesEntityExist(ped) then
        DetachEntity(ped, true, true)
    end
end

-- ── Server broadcast handlers ──────────────────────────────────────────────

RegisterNetEvent('sunset:client:glueApply', function(targetSrc, vehicleNetId, ox, oy, oz)
    applyAttach(targetSrc, vehicleNetId, ox, oy, oz)

    -- Local player also gets control feedback.
    local localSrc = GetPlayerServerId(PlayerId())
    if targetSrc == localSrc then
        local veh = NetworkGetEntityFromNetworkId(vehicleNetId)
        local plate = veh ~= 0 and GetVehicleNumberPlateText(veh) or '???'
        plate = plate:match('^%s*(.-)%s*$')
        notify(exports.sunset_core:Translate('world.msg.glued_to_unglue_to_detach', { plate = tostring(plate) }), 'success')

        -- Disable controls while glued (checked per-frame via a one-shot thread
        -- that exits when the entity is no longer attached).
        CreateThread(function()
            while true do
                local ped = PlayerPedId()
                if not IsEntityAttached(ped) then break end
                DisableControlAction(0, 23, true) -- enter vehicle
                DisableControlAction(0, 75, true) -- exit vehicle
                Wait(0)
            end
        end)
    end
end)

RegisterNetEvent('sunset:client:glueRemove', function(targetSrc)
    applyDetach(targetSrc)

    local localSrc = GetPlayerServerId(PlayerId())
    if targetSrc == localSrc then
        notify(exports.sunset_core:Translate('world.message.detached'), 'success')
    end
end)

-- Full state sync for late-joining clients.
RegisterNetEvent('sunset:client:glueSyncAll', function(states)
    for _, s in ipairs(states) do
        applyAttach(s.src, s.vehicleNetId, s.ox, s.oy, s.oz)
    end
end)

-- ── Commands ───────────────────────────────────────────────────────────────

RegisterCommand('glue', function()
    local ped    = PlayerPedId()
    local origin = GetEntityCoords(ped)

    if IsEntityAttached(ped) then
        notify(exports.sunset_core:Translate('world.message.already_glued_use_unglue_to_detach'), 'info')
        return
    end

    local closest, closestDist = nil, 10.0
    for _, veh in ipairs(GetGamePool('CVehicle')) do
        if DoesEntityExist(veh) then
            local d = #(origin - GetEntityCoords(veh))
            if d < closestDist then
                closest     = veh
                closestDist = d
            end
        end
    end

    if not closest then
        notify(exports.sunset_core:Translate('world.message.no_vehicle_nearby_within_10_m'), 'error')
        return
    end

    local netId = VehToNet(closest)
    if netId == 0 then
        notify(exports.sunset_core:Translate('world.message.vehicle_is_not_networked_cannot_glue'), 'error')
        return
    end

    -- Full 3D offset: accounts for pitch AND roll, not just yaw.
    local off = GetOffsetFromEntityGivenWorldCoords(closest, origin.x, origin.y, origin.z)

    TriggerServerEvent('sunset:server:glue', netId, off.x, off.y, off.z)
end, false)

RegisterCommand('unglue', function()
    local ped = PlayerPedId()
    if not IsEntityAttached(ped) then
        notify(exports.sunset_core:Translate('world.message.you_are_not_glued_to_anything'), 'info')
        return
    end
    TriggerServerEvent('sunset:server:unglue')
end, false)

TriggerEvent('chat:addSuggestion', '/glue',   'Attach yourself to the nearest vehicle at your current position')
TriggerEvent('chat:addSuggestion', '/unglue', 'Detach from the vehicle you are glued to')

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        local ped = PlayerPedId()
        if DoesEntityExist(ped) and IsEntityAttached(ped) then
            DetachEntity(ped, true, true)
        end
    end
end)
