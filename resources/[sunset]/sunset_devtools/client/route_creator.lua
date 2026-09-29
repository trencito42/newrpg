-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/route_creator.lua
--  Visual Job Route Creator & Editor controller.
--  Coordinates NUI, Gizmo, World Preview, and Authoritative Persistence.
-- ═══════════════════════════════════════════════════════════════

DevRouteCreator = DevRouteCreator or {}

local isOpen = false
local currentAdapter = 'trucker'
local previewRoute = nil
local isWorldPreviewing = false
local previewBlips = {}

local function notify(msg, typ)
    if exports.sunset_ui and pcall(function() end) then
        pcall(function() exports.sunset_ui:Notify(msg, typ or 'info', 6000) end)
    else
        TriggerEvent('chat:addMessage', { color = { 56, 189, 248 }, args = { '[ROUTE CREATOR]', msg } })
    end
end

-- ═══════════════════════════════════════════════════════════════
--  Safe Teleport Helper
-- ═══════════════════════════════════════════════════════════════

local function safeTeleport(targetCoords, heading, inVehicle)
    if not targetCoords then return end
    local ped = PlayerPedId()
    local entity = (inVehicle and IsPedInAnyVehicle(ped, false)) and GetVehiclePedIsIn(ped, false) or ped

    local x = targetCoords.x
    local y = targetCoords.y
    local z = targetCoords.z + 1.0
    local h = heading or targetCoords.h or targetCoords.w or targetCoords.heading or GetEntityHeading(entity)

    DoScreenFadeOut(250)
    while not IsScreenFadedOut() do Wait(0) end

    RequestCollisionAtCoord(x, y, z)
    SetEntityCoordsNoOffset(entity, x, y, z, false, false, false)
    SetEntityHeading(entity, h)

    local timeout = GetGameTimer() + 2000
    while not HasCollisionLoadedAroundEntity(entity) and GetGameTimer() < timeout do
        Wait(50)
    end

    local found, groundZ = GetGroundZFor_3dCoord(x, y, z + 50.0, false)
    if found then
        SetEntityCoordsNoOffset(entity, x, y, groundZ + 0.2, false, false, false)
    end

    Wait(150)
    DoScreenFadeIn(300)
end

-- ═══════════════════════════════════════════════════════════════
--  Trailer Capture Helper
-- ═══════════════════════════════════════════════════════════════

local function captureTrailerEntity()
    local ped = PlayerPedId()
    local trailer = 0

    if IsPedInAnyVehicle(ped, false) then
        local veh = GetVehiclePedIsIn(ped, false)
        local hasTrailer, trailerEnt = GetVehicleTrailerVehicle(veh)
        if hasTrailer and DoesEntityExist(trailerEnt) then
            trailer = trailerEnt
        end
    end

    if trailer == 0 then
        -- Search nearest trailer in radius
        local pCoords = GetEntityCoords(ped)
        local vehicles = GetGamePool('CVehicle')
        local closestDist = 25.0
        for _, v in ipairs(vehicles) do
            if DoesEntityExist(v) and IsEntityAVehicle(v) then
                local model = GetEntityModel(v)
                -- Check trailer model or trailer vehicle class (11)
                if GetVehicleClass(v) == 11 or model == joaat('tanker') or model == joaat('trailers') then
                    local dist = #(pCoords - GetEntityCoords(v))
                    if dist < closestDist then
                        closestDist = dist
                        trailer = v
                    end
                end
            end
        end
    end

    if trailer ~= 0 and DoesEntityExist(trailer) then
        local coords = GetEntityCoords(trailer)
        local heading = GetEntityHeading(trailer)
        return {
            x = math.floor(coords.x * 100 + 0.5) / 100,
            y = math.floor(coords.y * 100 + 0.5) / 100,
            z = math.floor(coords.z * 100 + 0.5) / 100,
            h = math.floor(heading * 10 + 0.5) / 10,
            w = math.floor(heading * 10 + 0.5) / 10,
        }
    end

    return nil
end

-- ═══════════════════════════════════════════════════════════════
--  Open / Close Route Creator NUI
-- ═══════════════════════════════════════════════════════════════

function DevRouteCreator.Open(adapterName, selectedRouteId)
    adapterName = adapterName or 'trucker'
    currentAdapter = adapterName

    exports.sunset_core:TriggerCallback('sunset:devtools:getJobRoutes', function(routes, err)
        if not routes then
            notify(err or 'Permission denied or routes unavailable', 'error')
            return
        end

        isOpen = true
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'open',
            adapter = adapterName,
            routes = routes,
            selectedRouteId = selectedRouteId,
        })
    end, adapterName)
end

function DevRouteCreator.Close()
    if not isOpen then return end
    isOpen = false
    isWorldPreviewing = false
    previewRoute = nil
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    DevRouteCreator.ClearBlips()
end

-- ═══════════════════════════════════════════════════════════════
--  Blip Helpers
-- ═══════════════════════════════════════════════════════════════

function DevRouteCreator.ClearBlips()
    for _, b in ipairs(previewBlips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
    end
    previewBlips = {}
end

function DevRouteCreator.SetRouteBlips(route, adapter)
    DevRouteCreator.ClearBlips()
    if not route then return end

    if adapter == 'trucker' then
        if route.pickup then
            local bp = AddBlipForCoord(route.pickup.x, route.pickup.y, route.pickup.z)
            SetBlipSprite(bp, 477)
            SetBlipColour(bp, 38)
            SetBlipScale(bp, 0.8)
            BeginTextCommandSetBlipName("STRING")
            AddTextComponentString("[DEV] Trailer Pickup")
            EndTextCommandSetBlipName(bp)
            previewBlips[#previewBlips + 1] = bp
        end
        if route.delivery then
            local bd = AddBlipForCoord(route.delivery.x, route.delivery.y, route.delivery.z)
            SetBlipSprite(bd, 1)
            SetBlipColour(bd, 2)
            SetBlipScale(bd, 0.9)
            BeginTextCommandSetBlipName("STRING")
            AddTextComponentString("[DEV] Delivery Entrance")
            EndTextCommandSetBlipName(bd)
            previewBlips[#previewBlips + 1] = bd
        end
        if route.parkingBay then
            local bb = AddBlipForCoord(route.parkingBay.x, route.parkingBay.y, route.parkingBay.z)
            SetBlipSprite(bb, 357)
            SetBlipColour(bb, 46)
            SetBlipScale(bb, 0.8)
            BeginTextCommandSetBlipName("STRING")
            AddTextComponentString("[DEV] Parking Bay")
            EndTextCommandSetBlipName(bb)
            previewBlips[#previewBlips + 1] = bb
        end
    elseif adapter == 'garbage' and route.bins then
        for idx, b in ipairs(route.bins) do
            local bp = AddBlipForCoord(b.x, b.y, b.z)
            SetBlipSprite(bp, 318)
            SetBlipColour(bp, 2)
            SetBlipScale(bp, 0.7)
            BeginTextCommandSetBlipName("STRING")
            AddTextComponentString(('[DEV] Bin #%d'):format(idx))
            EndTextCommandSetBlipName(bp)
            previewBlips[#previewBlips + 1] = bp
        end
    end
end

-- ═══════════════════════════════════════════════════════════════
--  NUI Callbacks
-- ═══════════════════════════════════════════════════════════════

RegisterNUICallback('close', function(_, cb)
    DevRouteCreator.Close()
    cb({ ok = true })
end)

RegisterNUICallback('getRoutes', function(data, cb)
    local adapter = data.adapter or 'trucker'
    exports.sunset_core:TriggerCallback('sunset:devtools:getJobRoutes', function(routes, err)
        cb({ ok = routes ~= nil, routes = routes or {}, error = err })
    end, adapter)
end)

RegisterNUICallback('selectRoute', function(data, cb)
    local adapter = data.adapter or currentAdapter
    local routeId = data.routeId
    local ad = SunsetDevTools.Adapters[adapter]
    if ad then
        exports.sunset_core:TriggerCallback('sunset:devtools:getJobRoutes', function(routes)
            if routes then
                for _, r in ipairs(routes) do
                    if r.id == routeId then
                        previewRoute = r
                        DevRouteCreator.SetRouteBlips(r, adapter)
                        break
                    end
                end
            end
        end, adapter)
    end
    cb({ ok = true })
end)

RegisterNUICallback('saveJobRoutes', function(data, cb)
    local adapter = data.adapter or currentAdapter
    local routes = data.routes or {}

    exports.sunset_core:TriggerCallback('sunset:devtools:saveJobRoutes', function(ok, err)
        if ok then
            notify(('Saved %d %s routes to disk.'):format(#routes, adapter), 'success')
            cb({ ok = true })
        else
            notify(err or 'Failed to save routes', 'error')
            cb({ ok = false, error = err })
        end
    end, adapter, routes)
end)

RegisterNUICallback('reloadJobRoutes', function(_, cb)
    exports.sunset_core:TriggerCallback('sunset:devtools:reloadJobRoutes', function(ok, err)
        if ok then
            notify('Routes reloaded from disk.', 'success')
            exports.sunset_core:TriggerCallback('sunset:devtools:getJobRoutes', function(routes)
                cb({ ok = true, routes = { [currentAdapter] = routes or {} } })
            end, currentAdapter)
        else
            notify(err or 'Failed to reload routes', 'error')
            cb({ ok = false, error = err })
        end
    end)
end)

RegisterNUICallback('teleportToCoords', function(data, cb)
    safeTeleport(data.coords, nil, false)
    cb({ ok = true })
end)

RegisterNUICallback('testTeleport', function(data, cb)
    local coords = data.coords
    local tType = data.type

    if tType == 'rig_pickup' or tType == 'rig_delivery' or tType == 'rig_bay' then
        safeTeleport(coords, nil, true)
    else
        safeTeleport(coords, nil, false)
    end
    cb({ ok = true })
end)

RegisterNUICallback('captureFromTrailer', function(data, cb)
    local result = captureTrailerEntity()
    if not result then
        notify('No trailer detected hitched or nearby. Drive or park a trailer nearby first.', 'warning')
        cb({ ok = false })
        return
    end

    notify(('Captured trailer: (%.1f, %.1f, %.1f) Heading: %.1f°'):format(result.x, result.y, result.z, result.h), 'success')

    SendNUIMessage({
        action = 'updateFieldCoords',
        routeId = data.routeId,
        stageKey = data.stageKey,
        coords = result,
    })
    cb({ ok = true, coords = result })
end)

RegisterNUICallback('capturePlayerPosAsBin', function(data, cb)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local ground = (SunsetJobVisuals and SunsetJobVisuals.GetGroundCoords and SunsetJobVisuals.GetGroundCoords(coords)) or coords

    local bin = {
        x = math.floor(ground.x * 100 + 0.5) / 100,
        y = math.floor(ground.y * 100 + 0.5) / 100,
        z = math.floor(ground.z * 100 + 0.5) / 100,
    }

    notify(('Added bin at ped position: (%.1f, %.1f, %.1f)'):format(bin.x, bin.y, bin.z), 'success')

    SendNUIMessage({
        action = 'updateFieldCoords',
        routeId = data.routeId,
        stageKey = 9999, -- Appends
        coords = bin,
    })
    cb({ ok = true, coords = bin })
end)

-- [SECTION 37-39] Hunter: capture player position as polygon boundary point
RegisterNUICallback('capturePlayerPosAsPolygonPoint', function(data, cb)
    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local pt = {
        x = math.floor(coords.x * 100 + 0.5) / 100,
        y = math.floor(coords.y * 100 + 0.5) / 100,
    }
    notify(('Added polygon point at (%.1f, %.1f)'):format(pt.x, pt.y), 'success')
    SendNUIMessage({
        action   = 'updateFieldCoords',
        routeId  = data.routeId,
        stageKey = 'polygonPoint', -- handled in updateFieldCoords (hunting adapter branch)
        coords   = pt,
    })
    cb({ ok = true, coords = pt })
end)

-- [SECTION 37-39] Hunter: capture player position as animal spawn point (with heading)
RegisterNUICallback('capturePlayerPosAsSpawnPoint', function(data, cb)
    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local pt = {
        x = math.floor(coords.x * 100 + 0.5) / 100,
        y = math.floor(coords.y * 100 + 0.5) / 100,
        z = math.floor(coords.z * 100 + 0.5) / 100,
        h = math.floor(heading * 10 + 0.5) / 10,
    }
    notify(('Added spawn point at (%.1f, %.1f, %.1f) h=%.1f°'):format(pt.x, pt.y, pt.z, pt.h), 'success')
    SendNUIMessage({
        action   = 'updateFieldCoords',
        routeId  = data.routeId,
        stageKey = 'spawnPoint',
        coords   = pt,
    })
    cb({ ok = true, coords = pt })
end)

-- [SECTION 37-39] Diver: capture player position as loot point (no ground snap — may be underwater)
RegisterNUICallback('capturePlayerPosAsLootPoint', function(data, cb)
    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local pt = {
        x = math.floor(coords.x * 100 + 0.5) / 100,
        y = math.floor(coords.y * 100 + 0.5) / 100,
        z = math.floor(coords.z * 100 + 0.5) / 100,
    }
    notify(('Added loot point at (%.1f, %.1f, %.1f)'):format(pt.x, pt.y, pt.z), 'success')
    SendNUIMessage({
        action   = 'updateFieldCoords',
        routeId  = data.routeId,
        stageKey = 'lootPoint',
        coords   = pt,
    })
    cb({ ok = true, coords = pt })
end)

-- [SECTION 37-39] Diver: capture a named single-coord field at player position
-- groundSnap=false for dive/loot points (may be underwater)
RegisterNUICallback('capturePlayerPosAsField', function(data, cb)
    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = data.hasHeading and (math.floor(GetEntityHeading(ped) * 10 + 0.5) / 10) or nil

    local pt = {
        x = math.floor(coords.x * 100 + 0.5) / 100,
        y = math.floor(coords.y * 100 + 0.5) / 100,
        z = math.floor(coords.z * 100 + 0.5) / 100,
    }
    if heading then pt.h = heading end

    notify(('Captured %s at (%.1f, %.1f, %.1f)'):format(data.field or '?', pt.x, pt.y, pt.z), 'success')
    SendNUIMessage({
        action   = 'updateFieldCoords',
        routeId  = data.routeId,
        stageKey = data.field,
        coords   = pt,
    })
    cb({ ok = true, coords = pt })
end)

RegisterNUICallback('previewRouteInWorld', function(data, cb)
    previewRoute = data.route
    isWorldPreviewing = true
    SetNuiFocus(false, false)
    DevRouteCreator.SetRouteBlips(previewRoute, data.adapter)
    notify('World Preview active. Press [ESC] or [M] to return to Route Creator.', 'info')
    cb({ ok = true })
end)

-- ═══════════════════════════════════════════════════════════════
--  Gizmo Edit Integration
-- ═══════════════════════════════════════════════════════════════

RegisterNUICallback('startGizmoEdit', function(data, cb)
    local adapter = data.adapter
    local routeId = data.routeId
    local stageKey = data.stageKey
    local initialCoords = data.coords or {}

    local v3 = vector3(initialCoords.x or 0, initialCoords.y or 0, initialCoords.z or 0)
    local heading = initialCoords.h or initialCoords.w or initialCoords.heading or 0.0

    -- Temporarily release NUI focus and hide window while gizmo is active
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'hideForGizmo' })

    DevGizmo.start({
        mode = (stageKey == 'parkingBay' or stageKey == 'pickup') and 'vehicle' or 'point',
        coords = v3,
        heading = heading,
        meta = {
            label = ('%s [%s]'):format(routeId, tostring(stageKey)),
        },
        onCapture = function(v4, meta, diag)
            local updated = {
                x = v4.x,
                y = v4.y,
                z = v4.z,
                h = v4.w,
                w = v4.w,
            }
            SendNUIMessage({
                action = 'updateFieldCoords',
                routeId = routeId,
                stageKey = stageKey,
                coords = updated,
            })
            notify(('Updated %s coordinates via Gizmo.'):format(tostring(stageKey)), 'success')
            SetNuiFocus(true, true)
            SendNUIMessage({ action = 'showAfterGizmo' })
        end,
        onCancel = function()
            SetNuiFocus(true, true)
            SendNUIMessage({ action = 'showAfterGizmo' })
        end,
    })

    cb({ ok = true })
end)

RegisterNUICallback('startCrosshairAddBin', function(data, cb)
    local routeId = data.routeId
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'hideForGizmo' })

    local pPos = GetEntityCoords(PlayerPedId())
    local fwd = GetEntityForwardVector(PlayerPedId())
    local targetPos = pPos + fwd * 3.0

    DevGizmo.start({
        mode = 'point',
        coords = targetPos,
        heading = 0.0,
        meta = { label = ('%s [New Bin]'):format(routeId) },
        onCapture = function(v4, meta, diag)
            local updated = {
                x = v4.x,
                y = v4.y,
                z = v4.z,
            }
            SendNUIMessage({
                action = 'updateFieldCoords',
                routeId = routeId,
                stageKey = 9999, -- append
                coords = updated,
            })
            notify('Added bin via Placement Gizmo.', 'success')
            SetNuiFocus(true, true)
            SendNUIMessage({ action = 'showAfterGizmo' })
        end,
        onCancel = function()
            SetNuiFocus(true, true)
            SendNUIMessage({ action = 'showAfterGizmo' })
        end,
    })

    cb({ ok = true })
end)

-- ═══════════════════════════════════════════════════════════════
--  World Preview & Visualization Thread
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    while true do
        local sleep = 500

        if isOpen or isWorldPreviewing or DevGizmo.isActive() then
            sleep = 0

            if previewRoute and SunsetDevTools.Adapters[currentAdapter] then
                local ad = SunsetDevTools.Adapters[currentAdapter]
                if ad.visualize then
                    ad.visualize(previewRoute, true, nil)
                end
            end

            -- If in world preview mode, listen for Esc / M to reopen NUI
            if isWorldPreviewing then
                if IsControlJustPressed(0, 200) or IsControlJustPressed(0, 244) or IsControlJustPressed(0, 288) then -- ESC or M or F1
                    isWorldPreviewing = false
                    SetNuiFocus(true, true)
                end
            end
        end

        Wait(sleep)
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  Commands
-- ═══════════════════════════════════════════════════════════════

RegisterCommand('devroutes', function(src, args)
    local adapter = args[1] or 'trucker'
    local routeId = args[2]
    DevRouteCreator.Open(adapter, routeId)
end, false)

RegisterCommand('devroute', function(src, args)
    local adapter = args[1] or 'trucker'
    local routeId = args[2]
    DevRouteCreator.Open(adapter, routeId)
end, false)

TriggerEvent('chat:addSuggestion', '/devroutes', 'Visual Job Route Creator (Trucker, Garbage, Hunter, Diver)', {
    { name = 'adapter', help = 'trucker | garbage | hunting | diving' },
    { name = 'routeId', help = 'Optional route ID' },
})

AddEventHandler('onResourceStop', function(resName)
    if resName == GetCurrentResourceName() then
        DevRouteCreator.Close()
    end
end)
