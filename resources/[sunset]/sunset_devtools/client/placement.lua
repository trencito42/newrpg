-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/placement.lua
--  /devplace orchestrator: loads an adapter, spawns a preview
--  entity, hands it to the generic gizmo, then exports result.
-- ═══════════════════════════════════════════════════════════════

DevPlace = {}

local activePreviewEntities = {}  -- tracked for cleanup

local function dbg(...)
    if GetConvar(SunsetDevTools.Config.debugConvar, 'false') == 'true' then
        print(('[devtools/place] ' .. tostring(select(1, ...))):format(select(2, ...)))
    end
end

local function notify(msg, typ)
    exports.sunset_ui:Notify(msg, typ or 'info', 6000)
end

local function requestAndLoadModel(hash)
    RequestModel(hash)
    local deadline = GetGameTimer() + 10000
    while not HasModelLoaded(hash) do
        if GetGameTimer() > deadline then return false end
        Wait(50)
    end
    return true
end

local function trackEntity(ent)
    activePreviewEntities[#activePreviewEntities + 1] = ent
end

local function deletePreview(ent)
    if ent ~= 0 and DoesEntityExist(ent) then
        SetEntityAsMissionEntity(ent, false, true)
        DeleteEntity(ent)
    end
    for i = #activePreviewEntities, 1, -1 do
        if activePreviewEntities[i] == ent then
            table.remove(activePreviewEntities, i)
            break
        end
    end
end

local function cleanupAll()
    for _, ent in ipairs(activePreviewEntities) do
        if DoesEntityExist(ent) then
            SetEntityAsMissionEntity(ent, false, true)
            DeleteEntity(ent)
        end
    end
    activePreviewEntities = {}
end

local function exportAndPrint(adapterKey, fieldKey, v4, meta, diag)
    local adapter = SunsetDevTools.Adapters[adapterKey]
    local snippet = adapter and adapter.export and adapter.export(fieldKey, v4, meta) or
        ('vector4(%.2f, %.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z, v4.w)

    local v4str = ('vector4(%.2f, %.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z, v4.w)
    local v3str = ('vector3(%.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z)

    print('^2═══════════════════════════════════════════════════════════════^7')
    print('^3[DEVTOOLS PLACEMENT CAPTURE]^7')
    print(('^2vector4:^7 %s'):format(v4str))
    print(('^2vector3:^7 %s'):format(v3str))
    print(('^2snippet:^7\n%s'):format(snippet))
    if diag then
        local g = diag.ground
        if g and g.found then
            print(('^3ground Z: %.2f  delta from placed Z: %+.2fm^7'):format(g.groundZ, g.delta))
        end
    end
    print('^2═══════════════════════════════════════════════════════════════^7')

    -- Copy to clipboard
    SetClipboardText(v4str)
    notify(('Captured! %s — see F8. Copied to clipboard.'):format(v4str), 'success')

    -- Save draft to server
    TriggerServerEvent('sunset:devtools:saveDraft', {
        adapter = adapterKey,
        key     = fieldKey,
        v4      = { x = v4.x, y = v4.y, z = v4.z, w = v4.w },
        snippet = snippet,
        label   = meta and meta.label or fieldKey,
        ts      = os.time and os.time() or 0,
    })
end

-- Open placement editor for a PED type
local function openPedPlacement(adapterKey, fieldKey, data)
    local hash = joaat(data.model)
    if not IsModelInCdimage(hash) then
        notify('Model not found in cdimage: ' .. data.model, 'error')
        return
    end

    if not requestAndLoadModel(hash) then
        notify('Failed to load model: ' .. data.model, 'error')
        return
    end

    -- Teleport developer near the configured location (if far away)
    local devPos = GetEntityCoords(PlayerPedId())
    local dist   = #(devPos - data.coords)
    if dist > 200.0 then
        TriggerEvent('sunset:admin:teleport', data.coords.x, data.coords.y, data.coords.z + 2.0)
        Wait(500)  -- let the teleport settle
    end

    -- Spawn preview ped at configured coords
    local ped = CreatePed(4, hash, data.coords.x, data.coords.y, data.coords.z, data.heading or 0.0, false, false)
    if ped == 0 or not DoesEntityExist(ped) then
        notify('Failed to spawn preview ped', 'error')
        SetModelAsNoLongerNeeded(hash)
        return
    end

    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedFleeAttributes(ped, 0, false)
    if data.scenario then
        TaskStartScenarioInPlace(ped, data.scenario, 0, true)
    end
    trackEntity(ped)
    SetModelAsNoLongerNeeded(hash)

    notify(('Ped "%s" spawned. Move with WASD, ENTER to capture, BACKSPACE to cancel.'):format(data.label or fieldKey), 'info')

    DevGizmo.start({
        mode    = 'ped',
        entity  = ped,
        coords  = data.coords,
        heading = data.heading or 0.0,
        meta    = {
            label    = data.label or fieldKey,
            model    = data.model,
            scenario = data.scenario,
        },
        onCapture = function(v4, meta, diag)
            deletePreview(ped)
            exportAndPrint(adapterKey, fieldKey, v4, meta, diag)
        end,
        onCancel = function()
            deletePreview(ped)
            notify('Placement cancelled — ped removed.', 'info')
        end,
    })
end

-- Open placement editor for a VEHICLE/TRAILER type
local function openVehiclePlacement(adapterKey, fieldKey, data, vehMode)
    local model = data.model or 'phantom'
    if vehMode == 'trailer' then
        model = (Sunset and Sunset.JobsConfig and Sunset.JobsConfig.trucker and Sunset.JobsConfig.trucker.trailerModel) or 'tanker'
    end
    local hash = joaat(model)
    if not IsModelInCdimage(hash) then
        -- Delegate to existing admin gizmo for vehicle placement
        notify(('Model %s not in cdimage — trying existing gizmo'):format(model), 'warning')
        TriggerServerEvent('sunset:admin:requestMoveveh')
        return
    end

    if not requestAndLoadModel(hash) then
        notify('Failed to load vehicle model: ' .. model, 'error')
        return
    end

    local devPos = GetEntityCoords(PlayerPedId())
    local dist   = #(devPos - data.coords)
    if dist > 200.0 then
        TriggerEvent('sunset:admin:teleport', data.coords.x, data.coords.y, data.coords.z + 2.0)
        Wait(500)
    end

    local veh = CreateVehicle(hash, data.coords.x, data.coords.y, data.coords.z, data.heading or 0.0, false, false)
    if veh == 0 or not DoesEntityExist(veh) then
        notify('Failed to spawn preview vehicle', 'error')
        SetModelAsNoLongerNeeded(hash)
        return
    end

    trackEntity(veh)
    SetModelAsNoLongerNeeded(hash)

    notify(('Vehicle "%s" spawned. Move with WASD, ENTER to capture.'):format(model), 'info')

    DevGizmo.start({
        mode    = vehMode or 'vehicle',
        entity  = veh,
        coords  = data.coords,
        heading = data.heading or 0.0,
        meta    = { label = data.label or fieldKey, model = model },
        onCapture = function(v4, meta, diag)
            deletePreview(veh)
            exportAndPrint(adapterKey, fieldKey, v4, meta, diag)
        end,
        onCancel = function()
            deletePreview(veh)
            notify('Placement cancelled — vehicle removed.', 'info')
        end,
    })
end

-- Open placement for a POINT (no entity — just a virtual marker)
local function openPointPlacement(adapterKey, fieldKey, data)
    local devPos = GetEntityCoords(PlayerPedId())
    local dist   = #(devPos - data.coords)
    if dist > 200.0 then
        TriggerEvent('sunset:admin:teleport', data.coords.x, data.coords.y, data.coords.z + 2.0)
        Wait(500)
    end

    notify(('Point "%s" editor opened. WASD to move, ENTER to capture.'):format(data.label or fieldKey), 'info')

    DevGizmo.start({
        mode    = 'point',
        entity  = 0,
        coords  = data.coords,
        heading = data.heading or 0.0,
        meta    = { label = data.label or fieldKey },
        onCapture = function(v4, meta, diag)
            exportAndPrint(adapterKey, fieldKey, v4, meta, diag)
        end,
        onCancel = function()
            notify('Placement cancelled.', 'info')
        end,
    })
end

-- Entry point: /devplace [adapterKey] [fieldKey]
function DevPlace.open(adapterKey, fieldKey)
    if DevGizmo.isActive() or DevProbe.isActive() then
        notify('Another devtools mode is already active. Close it first.', 'error')
        return
    end

    if not adapterKey then
        -- List available adapters
        local lines = { 'Available adapters:' }
        for id, a in pairs(SunsetDevTools.Adapters) do
            lines[#lines + 1] = ('  %s  — %s'):format(id, a.label or id)
        end
        notify(table.concat(lines, '\n'), 'info')
        return
    end

    local adapter = SunsetDevTools.Adapters[adapterKey]
    if not adapter then
        notify('Unknown adapter: ' .. adapterKey .. '. Use /devplace with no args to list.', 'error')
        return
    end

    if not fieldKey then
        -- List fields for this adapter
        local fields = adapter.describe and adapter.describe() or {}
        if #fields == 0 then
            notify('Adapter "' .. adapterKey .. '" has no configurable fields.', 'info')
            return
        end
        local lines = { ('Adapter "%s" fields:'):format(adapterKey) }
        for _, f in ipairs(fields) do
            lines[#lines + 1] = ('  %s  [%s]'):format(f.key, f.type or '?')
            if #lines > 20 then lines[#lines + 1] = '  ... (more in F8)' break end
        end
        notify(table.concat(lines, '\n'), 'info')
        -- Also print full list to F8
        print('[devtools] Fields for adapter: ' .. adapterKey)
        for _, f in ipairs(fields) do
            print(('  %-30s [%s]  %s'):format(f.key, f.type or '?', f.label or ''))
        end
        return
    end

    local data, err = adapter.load(fieldKey)
    if not data then
        notify('Could not load "' .. fieldKey .. '": ' .. (err or 'unknown error'), 'error')
        return
    end

    local entityType = data.type or 'point'
    dbg('opening placement: adapter=%s field=%s type=%s model=%s', adapterKey, fieldKey, entityType, tostring(data.model))

    CreateThread(function()
        if entityType == 'ped' then
            openPedPlacement(adapterKey, fieldKey, data)
        elseif entityType == 'vehicle' then
            openVehiclePlacement(adapterKey, fieldKey, data, 'vehicle')
        elseif entityType == 'trailer' then
            openVehiclePlacement(adapterKey, fieldKey, data, 'trailer')
        else
            openPointPlacement(adapterKey, fieldKey, data)
        end
    end)
end

-- Capture player's current position (USE MY POSITION)
function DevPlace.capturePlayerPos(adapterKey, fieldKey)
    local ped  = PlayerPedId()
    local pos  = GetEntityCoords(ped)
    local hdg  = GetEntityHeading(ped)
    local v4   = vector4(
        math.floor(pos.x * 100 + 0.5) / 100,
        math.floor(pos.y * 100 + 0.5) / 100,
        math.floor(pos.z * 100 + 0.5) / 100,
        math.floor(hdg   * 100 + 0.5) / 100
    )

    local v4str = ('vector4(%.2f, %.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z, v4.w)
    local v3str = ('vector3(%.2f, %.2f, %.2f)'):format(v4.x, v4.y, v4.z)

    print('^3[DEVTOOLS PLAYER CAPTURE]^7')
    print(('vector4: %s'):format(v4str))
    print(('vector3: %s'):format(v3str))

    SetClipboardText(v4str)
    notify('Player position captured: ' .. v4str, 'success')

    if adapterKey and fieldKey then
        local adapter = SunsetDevTools.Adapters[adapterKey]
        if adapter and adapter.export then
            local snippet = adapter.export(fieldKey, v4, {})
            print(('snippet: %s'):format(snippet))
        end
        TriggerServerEvent('sunset:devtools:saveDraft', {
            adapter = adapterKey, key = fieldKey,
            v4 = {x=v4.x, y=v4.y, z=v4.z, w=v4.w},
            label = fieldKey, ts = 0,
        })
    end
end

-- Resource stop: clean up all preview entities
AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        cleanupAll()
        DevGizmo.stop(false)
        DevProbe.stop()
    end
end)
