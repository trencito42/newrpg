-- /glue — stay at exact position relative to nearest vehicle (SA-MP surf)
-- Uses manual per-frame teleport instead of AttachEntityToEntity so the
-- player never snaps — they stay at the exact coords they had when /glue ran.

local glued       = false
local glueVehicle = nil
local localOffset = nil  -- ped position in vehicle-local space

local function notify(msg, kind)
    exports.sunset_ui:Notify(msg, kind or 'info', 4000)
end

-- Convert a world position to vehicle-local space (yaw only — ground vehicles).
local function worldToLocal(veh, worldPos)
    local epos = GetEntityCoords(veh)
    local rot  = GetEntityRotation(veh, 2)
    local dx   = worldPos.x - epos.x
    local dy   = worldPos.y - epos.y
    local dz   = worldPos.z - epos.z
    local rad  = math.rad(-rot.z)
    return vector3(
        dx * math.cos(rad) - dy * math.sin(rad),
        dx * math.sin(rad) + dy * math.cos(rad),
        dz
    )
end

-- Convert vehicle-local position back to world space.
local function localToWorld(veh, lpos)
    local epos = GetEntityCoords(veh)
    local rot  = GetEntityRotation(veh, 2)
    local rad  = math.rad(rot.z)
    return vector3(
        epos.x + lpos.x * math.cos(rad) - lpos.y * math.sin(rad),
        epos.y + lpos.x * math.sin(rad) + lpos.y * math.cos(rad),
        epos.z + lpos.z
    )
end

local function detach()
    if not glued then return end
    glued       = false
    glueVehicle = nil
    localOffset = nil

    local ped = PlayerPedId()
    SetEntityCollision(ped, true, true)
    SetPedCanRagdoll(ped, true)
    ClearPedTasksImmediately(ped)
end

local function watchGlue()
    CreateThread(function()
        while glued do
            local ped = PlayerPedId()
            local veh = glueVehicle

            if not veh or not DoesEntityExist(veh) or IsEntityDead(veh) then
                detach()
                notify('Vehicle gone — detached.', 'warning')
                break
            end

            -- Recompute world position every frame from the saved local offset
            local target = localToWorld(veh, localOffset)
            SetEntityCoordsNoOffset(ped, target.x, target.y, target.z, false, false, false)

            SetEntityCollision(ped, false, false)
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

    -- Save the ped's position in the vehicle's local space right now.
    -- The loop will keep them at this exact relative spot as the vehicle moves.
    localOffset = worldToLocal(closest, origin)

    SetEntityCollision(ped, false, false)
    SetPedCanRagdoll(ped, false)
    ClearPedTasksImmediately(ped)

    glued       = true
    glueVehicle = closest
    watchGlue()

    local plate = GetVehicleNumberPlateText(closest) or ''
    plate = plate:match('^%s*(.-)%s*$')
    notify(('Glued to [%s]. /unglue to detach.'):format(plate ~= '' and plate or '???'), 'success')
end, false)

RegisterCommand('unglue', function()
    if not glued then
        notify('You are not glued to anything.', 'info')
        return
    end
    detach()
    notify('Detached.', 'success')
end, false)

TriggerEvent('chat:addSuggestion', '/glue',   'Attach yourself to the nearest vehicle at your current position')
TriggerEvent('chat:addSuggestion', '/unglue', 'Detach from the vehicle you are glued to')

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() and glued then detach() end
end)
