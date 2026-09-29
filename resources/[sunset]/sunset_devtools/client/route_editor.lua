-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/route_editor.lua
--  /devroute trucker [n]: load a trucker route, show all stages,
--  navigate between them, edit with gizmo, export snippet.
-- ═══════════════════════════════════════════════════════════════

DevRoute = {}

local isRouteEditorActive = false
local routeFields   = {}   -- from adapter.describe()
local selectedIdx   = 1
local adapterKey    = nil
local pendingDrafts = {}   -- { key = {v4, snippet} }

local STAGE_COLORS = {
    spawn        = {255, 150, 50},
    pickup       = {50, 200, 255},
    delivery     = {50, 255, 100},
    parkingBay   = {255, 255, 50},
    returnCoords = {200, 100, 255},
}

local function stageColor(key)
    local stage = key:match('_([^_]+)$') or key
    return unpack(STAGE_COLORS[stage] or {255, 255, 255})
end

local function notify(msg, typ)
    exports.sunset_ui:Notify(msg, typ or 'info', 6000)
end

local function drawRouteHUD(fields, selIdx)
    -- Main panel
    DevViz.panel(0.155, 0.42, 0.28, 0.58, 10, 18, 36, 225)
    DevViz.accent(0.155, 0.145, 0.28, 255, 100, 50)
    DevViz.text2d(0.155, 0.130, 'ROUTE EDITOR  [' .. adapterKey:upper() .. ']', 0.34, 0, 0, 0, 255, 4, true)

    local X = 0.025
    local Y = 0.165
    local G = 0.026
    local maxVisible = 12

    -- Compute scroll window so selected item is visible
    local startIdx = math.max(1, math.min(selIdx - 3, #fields - maxVisible + 1))
    local endIdx   = math.min(#fields, startIdx + maxVisible - 1)

    for dispIdx = startIdx, endIdx do
        local f     = fields[dispIdx]
        local isSelected = (dispIdx == selIdx)
        local row   = dispIdx - startIdx
        local lineY = Y + G * row
        local r, g, b = stageColor(f.key)

        if isSelected then
            DrawRect(0.155, lineY + 0.010, 0.27, 0.021, 255, 140, 0, 60)
            DevViz.text2d(X, lineY, ('~y~▶ %s~s~'):format(f.label or f.key), 0.27)
        else
            DevViz.text2d(X, lineY, ('  %s'):format(f.label or f.key), 0.26, r, g, b, 200)
        end
    end

    -- Selected field detail
    local sel = fields[selIdx]
    if sel then
        local detailY = Y + G * (maxVisible + 0.5)
        DevViz.text2d(X, detailY,       '─── SELECTED ───────────────────', 0.26, 120, 120, 120, 180)
        local draft = pendingDrafts[sel.key]
        local cv    = draft and vector3(draft.v4.x, draft.v4.y, draft.v4.z) or sel.coords
        local ch    = draft and draft.v4.w or (sel.heading or 0.0)
        local tag   = draft and ' ~y~[DRAFT]~s~' or ''
        DevViz.text2d(X, detailY+G,     ('X: ~b~%.2f~s~  Y: ~b~%.2f~s~%s'):format(cv.x, cv.y, tag), 0.26)
        DevViz.text2d(X, detailY+G*1.7, ('Z: ~b~%.2f~s~  H: ~b~%.1f°~s~'):format(cv.z, ch), 0.26)
        DevViz.text2d(X, detailY+G*2.5, ('Type: ~y~%s~s~'):format(sel.type or '?'), 0.26)
    end

    -- Controls
    local ctrlY = Y + G * (maxVisible + 4.8)
    DevViz.text2d(X, ctrlY,       '~y~F1/F2~s~ Navigate  ~y~G~s~ Goto  ~y~E~s~ Edit', 0.26)
    DevViz.text2d(X, ctrlY+G,     '~y~C~s~ CapturePos  ~y~V~s~ Validate  ~y~X~s~ Export', 0.26)
    DevViz.text2d(X, ctrlY+G*1.7, '~r~ESC~s~ Close route editor', 0.26)
end

local function drawRouteWorldMarkers(fields, selIdx)
    for i, f in ipairs(fields) do
        local cv    = f.coords
        if not cv then goto continue end

        -- Check if there is a draft overriding this coord
        local draft = pendingDrafts[f.key]
        if draft then cv = vector3(draft.v4.x, draft.v4.y, draft.v4.z) end

        local r, g, b = stageColor(f.key)
        local isSelected = (i == selIdx)
        local markerSize = isSelected and 0.6 or 0.3
        local alpha = isSelected and 255 or 160

        DrawMarker(isSelected and 21 or 28,
            cv.x, cv.y, cv.z + 0.2, 0, 0, 0, 0, 0, 0,
            markerSize, markerSize, markerSize,
            r, g, b, alpha, false, false, 2, false, nil, nil, false)

        -- World label
        local lbl = (f.label or f.key):match('[^—]+$') or f.label or f.key
        DevViz.worldLabel(cv.x, cv.y, cv.z + 2.5, lbl:gsub('^%s*', ''), r, g, b)

        -- Connect stages with lines (show sequence within a route group)
        if i > 1 then
            local prev = fields[i - 1]
            local pc   = prev.coords
            if pc and prev.routeIndex == f.routeIndex and f.routeIndex then
                DrawLine(pc.x, pc.y, pc.z, cv.x, cv.y, cv.z, r, g, b, 80)
            end
        end

        ::continue::
    end
end

local function exportAll()
    print('^2═══════════════════════════════════════════════════════════════^7')
    print('^3[DEVTOOLS ROUTE EXPORT]  drafts: ' .. tostring(table.concat(
        (function()
            local keys = {}
            for k in pairs(pendingDrafts) do keys[#keys+1] = k end
            return keys
        end)(), ', ')) .. '^7')

    local adapter = SunsetDevTools.Adapters[adapterKey]
    for key, draft in pairs(pendingDrafts) do
        local v4  = vector4(draft.v4.x, draft.v4.y, draft.v4.z, draft.v4.w)
        local snip = adapter and adapter.export and adapter.export(key, v4, {}) or tostring(v4)
        print(('-- %s'):format(key))
        print(snip)
        print()
    end
    print('^2═══════════════════════════════════════════════════════════════^7')

    if next(pendingDrafts) then
        notify('Export printed to F8. See console for full snippets.', 'success')
    else
        notify('No drafts to export yet. Edit a stage first.', 'warning')
    end
end

local function validateAll()
    local adapter = SunsetDevTools.Adapters[adapterKey]
    if not adapter then return end
    local fields = adapter.describe and adapter.describe() or {}

    print('^3[DEVTOOLS VALIDATION]  ' .. adapterKey:upper() .. '^7')
    for _, f in ipairs(fields) do
        local cv = f.coords
        if not cv then goto continue end
        local draft = pendingDrafts[f.key]
        if draft then cv = vector3(draft.v4.x, draft.v4.y, draft.v4.z) end
        local ch = (f.heading or 0.0)
        if draft then ch = draft.v4.w or ch end

        local diag = DevValidate.fullCheck(cv.x, cv.y, cv.z, ch)
        local gStr, hStr
        if diag.ground.found then
            local dColor = math.abs(diag.ground.delta) < 0.1 and 'PASS' or (math.abs(diag.ground.delta) < 0.5 and 'WARN' or 'FAIL')
            gStr = ('Ground: %s  Z=%.2f  Δ%+.2f'):format(dColor, diag.ground.groundZ, diag.ground.delta)
        else
            gStr = 'Ground: UNKNOWN'
        end
        hStr = diag.head.blocked and ('Head: %s @%.2fm'):format(diag.head.status, diag.head.clearance) or 'Head: OK'

        print(('%-40s  %s  |  %s'):format((f.label or f.key):sub(1,40), gStr, hStr))
        ::continue::
    end
end

-- Start the route editor
function DevRoute.open(ak, routeHint)
    if DevGizmo.isActive() then
        notify('Close the current gizmo before opening route editor.', 'error')
        return
    end
    if isRouteEditorActive then
        isRouteEditorActive = false
        notify('Route editor closed.', 'info')
        return
    end

    local adapter = SunsetDevTools.Adapters[ak]
    if not adapter then
        notify('Unknown adapter: ' .. tostring(ak), 'error')
        return
    end

    adapterKey = ak
    routeFields = adapter.describe and adapter.describe() or {}
    if #routeFields == 0 then
        notify('No fields for adapter: ' .. ak, 'warning')
        return
    end

    -- Jump to a specific route if hint provided
    selectedIdx = 1
    if routeHint then
        local n = tonumber(routeHint)
        if n then
            for i, f in ipairs(routeFields) do
                if f.routeIndex == n then selectedIdx = i break end
            end
        end
    end

    pendingDrafts = {}
    isRouteEditorActive = true

    notify(('Route editor opened: %s (%d stages). F1/F2 navigate, E edit, ESC close.'):format(
        adapter.label or ak, #routeFields), 'info')

    CreateThread(function()
        while isRouteEditorActive do
            Wait(0)

            -- Navigation
            if IsControlJustPressed(0, 86) then  -- F1
                selectedIdx = math.max(1, selectedIdx - 1)
                Wait(150)
            end
            if IsControlJustPressed(0, 87) then  -- F2
                selectedIdx = math.min(#routeFields, selectedIdx + 1)
                Wait(150)
            end

            -- Goto selected stage (G)
            if IsControlJustPressed(0, 47) and not DevGizmo.isActive() then
                local f = routeFields[selectedIdx]
                if f and f.coords then
                    local ped = PlayerPedId()
                    SetEntityCoords(ped, f.coords.x, f.coords.y, f.coords.z + 2.0, false, false, false, true)
                    notify(('Teleported to: %.2f, %.2f, %.2f'):format(f.coords.x, f.coords.y, f.coords.z), 'info')
                end
                Wait(100)
            end

            -- Edit selected stage (E)
            if IsControlJustPressed(0, 38) and not DevGizmo.isActive() then
                local f = routeFields[selectedIdx]
                if f then
                    local draft = pendingDrafts[f.key]
                    local startCoords = draft and vector3(draft.v4.x, draft.v4.y, draft.v4.z) or f.coords
                    local startH      = draft and draft.v4.w or (f.heading or 0.0)

                    isRouteEditorActive = false  -- pause route editor loop; gizmo takes over
                    DevPlace.open(adapterKey, f.key)
                    -- Override the gizmo's capture callback to store as draft
                    -- (DevPlace.open already handles export; we additionally save a draft)
                    -- We resume the editor after gizmo closes
                    CreateThread(function()
                        while DevGizmo.isActive() do Wait(100) end
                        isRouteEditorActive = true
                    end)
                end
                Wait(200)
            end

            -- Capture player position as draft for selected field (C)
            if IsControlJustPressed(0, 26) and not DevGizmo.isActive() then
                local f   = routeFields[selectedIdx]
                local ped = PlayerPedId()
                local pos = GetEntityCoords(ped)
                local hdg = GetEntityHeading(ped)
                pendingDrafts[f.key] = {
                    v4 = { x = math.floor(pos.x*100+.5)/100, y = math.floor(pos.y*100+.5)/100,
                            z = math.floor(pos.z*100+.5)/100, w = math.floor(hdg*100+.5)/100 },
                }
                notify(('Draft saved for %s: %.2f, %.2f, %.2f, %.2f'):format(
                    f.label or f.key, pos.x, pos.y, pos.z, hdg), 'success')
                Wait(200)
            end

            -- Validate all (V)
            if IsControlJustPressed(0, 47+1) or IsControlJustPressed(0, 0x56) then
                -- 0x56 is V key
                validateAll()
                Wait(300)
            end

            -- Export drafts (X key)
            if IsControlJustPressed(0, 73) and not (IsDisabledControlPressed(0, 21) or IsControlPressed(0, 21)) then
                exportAll()
                Wait(300)
            end

            -- Close (ESC)
            if IsControlJustPressed(0, 200) then
                isRouteEditorActive = false
                notify('Route editor closed.', 'info')
                break
            end

            -- Draw HUD and world markers
            if not DevGizmo.isActive() then
                drawRouteHUD(routeFields, selectedIdx)
                drawRouteWorldMarkers(routeFields, selectedIdx)
            end
        end
        isRouteEditorActive = false
    end)
end

function DevRoute.isActive()
    return isRouteEditorActive
end

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        isRouteEditorActive = false
    end
end)
