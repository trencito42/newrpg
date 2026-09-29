-- /glue — attach player ped to the roof of the nearest vehicle (SA-MP style surf)
-- /unglue — detach

local glued        = false
local glueVehicle  = nil
local glueThread   = nil

local function notify(msg, kind)
    exports.sunset_ui:Notify(msg, kind or 'info', 4000)
end

local function detach()
    if not glued then return end
    glued       = false
    glueVehicle = nil

    local ped = PlayerPedId()
    DetachEntity(ped, true, true)
    SetEntityCollision(ped, true, true)
    SetPedCanRagdoll(ped, true)
    ClearPedTasksImmediately(ped)
end

local function watchGlue()
    CreateThread(function()
        while glued do
            local ped = PlayerPedId()
            local veh = glueVehicle

            -- Auto-detach if vehicle no longer exists or was destroyed
            if not veh or not DoesEntityExist(veh) or IsEntityDead(veh) then
                detach()
                notify('Vehicle gone — detached.', 'warning')
                break
            end

            -- Suppress ragdoll and keep ped invisible controls frozen every frame
            SetPedCanRagdoll(ped, false)
            DisableControlAction(0, 23, true)  -- block enter vehicle
            DisableControlAction(0, 75, true)  -- block exit vehicle

            Wait(0)
        end
    end)
end

RegisterCommand('glue', function()
    if glued then
        notify('Already glued. Use /unglue to detach.', 'info')
        return
    end

    local ped    = PlayerPedId()
    local origin = GetEntityCoords(ped)

    -- Find closest vehicle within 10 m
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
        notify('No vehicle nearby (within 10 m).', 'error')
        return
    end

    -- Get vehicle roof bone for attachment point
    local boneIdx = GetEntityBoneIndexByName(closest, 'roof')
    if boneIdx < 0 then boneIdx = GetEntityBoneIndexByName(closest, 'chassis') end
    local boneToUse = boneIdx >= 0 and boneIdx or -1

    -- Offset above the roof so the ped stands on top
    local offZ = 1.1

    -- Force player out of any vehicle first
    if IsPedInAnyVehicle(ped, false) then
        TaskLeaveVehicle(ped, GetVehiclePedIsIn(ped, false), 4160)
        Wait(400)
    end

    SetEntityCollision(ped, false, false)
    SetPedCanRagdoll(ped, false)

    AttachEntityToEntity(
        ped, closest,
        boneToUse,
        0.0, 0.0, offZ,   -- forward, right, up offset
        0.0, 0.0, 0.0,    -- rotation
        false, false,
        false, false,
        2, true
    )

    glued       = true
    glueVehicle = closest
    watchGlue()

    local plate = GetVehicleNumberPlateText(closest) or ''
    plate = plate:match('^%s*(.-)%s*$')
    notify(('Glued to vehicle [%s]. /unglue to detach.'):format(plate ~= '' and plate or '???'), 'success')
end, false)

RegisterCommand('unglue', function()
    if not glued then
        notify('You are not glued to anything.', 'info')
        return
    end
    detach()
    notify('Detached.', 'success')
end, false)

TriggerEvent('chat:addSuggestion', '/glue',   'Attach yourself to the roof of the nearest vehicle (SA-MP surf style)')
TriggerEvent('chat:addSuggestion', '/unglue', 'Detach from the vehicle you are glued to')

-- Clean up on resource stop
AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() and glued then
        detach()
    end
end)
