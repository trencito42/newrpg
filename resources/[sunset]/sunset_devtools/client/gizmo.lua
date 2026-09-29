-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/gizmo.lua
--  Generic transform gizmo: moves peds, vehicles, and virtual
--  points. Supports undo, ground snap, and coordinate capture.
--
--  Based on sunset_admin/client/veh_gizmo.lua but generalized.
-- ═══════════════════════════════════════════════════════════════

DevGizmo = {}

local isActive   = false
local gizmoMode  = nil   -- 'ped' | 'vehicle' | 'point'
local gizmoEnt   = 0     -- entity handle (0 for point mode)
local coords     = vector3(0, 0, 0)
local heading    = 0.0
local rotation   = vector3(0, 0, 0)
local onCapture  = nil   -- fn(v4, diag)
local onCancel   = nil   -- fn()
local extraMeta  = {}    -- adapter-supplied extra info

-- Undo history: stack of {coords, heading}
local history = {}
local histIdx = 0

-- Validation cache: refresh every N frames
local diagCache = nil
local diagFrame = 0
local DIAG_INTERVAL = SunsetDevTools.Config.validationIntervalFrames

local function pushHistory()
    while #history > histIdx do table.remove(history) end
    history[#history + 1] = { coords = coords, heading = heading }
    histIdx = #history
    if #history > SunsetDevTools.Config.maxUndoHistory then
        table.remove(history, 1)
        histIdx = #history
    end
end

function DevGizmo.undo()
    if histIdx <= 1 then return end
    histIdx = histIdx - 1
    local h = history[histIdx]
    coords  = h.coords
    heading = h.heading
    if gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
        SetEntityCoordsNoOffset(gizmoEnt, coords.x, coords.y, coords.z, false, false, false)
        SetEntityHeading(gizmoEnt, heading)
    end
end

function DevGizmo.redo()
    if histIdx >= #history then return end
    histIdx = histIdx + 1
    local h = history[histIdx]
    coords  = h.coords
    heading = h.heading
    if gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
        SetEntityCoordsNoOffset(gizmoEnt, coords.x, coords.y, coords.z, false, false, false)
        SetEntityHeading(gizmoEnt, heading)
    end
end

function DevGizmo.isActive() return isActive end
function DevGizmo.getCoords() return coords end
function DevGizmo.getHeading() return heading end

-- Start the gizmo.
-- opts = {
--   mode    : 'ped'|'vehicle'|'point',
--   entity  : optional entity handle (0 for point mode),
--   coords  : vector3 start position,
--   heading : float,
--   meta    : table (passed through to capture callback),
--   onCapture : fn(v4, meta, diag),
--   onCancel  : fn(),
-- }
function DevGizmo.start(opts)
    if isActive then DevGizmo.stop(false) end

    gizmoMode = opts.mode or 'point'
    gizmoEnt  = opts.entity or 0
    coords    = vector3(opts.coords.x, opts.coords.y, opts.coords.z)
    heading   = opts.heading or 0.0
    rotation  = vector3(0, 0, 0)
    extraMeta = opts.meta or {}
    onCapture = opts.onCapture
    onCancel  = opts.onCancel
    history   = {}
    histIdx   = 0
    diagCache = nil
    diagFrame = 0
    isActive  = true

    pushHistory()

    if gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
        SetEntityAsMissionEntity(gizmoEnt, true, true)
        FreezeEntityPosition(gizmoEnt, true)
        if gizmoMode ~= 'ped' then
            SetEntityCollision(gizmoEnt, false, false)
        end
    end

    DevGizmo._loop()
end

function DevGizmo.stop(doCapture)
    isActive = false
    if gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
        SetEntityCollision(gizmoEnt, true, true)
        -- Leave freeze state to caller: placement.lua deletes preview; veh gizmo unfreezes
    end
    if doCapture and onCapture then
        local v4 = vector4(
            math.floor(coords.x * 100 + 0.5) / 100,
            math.floor(coords.y * 100 + 0.5) / 100,
            math.floor(coords.z * 100 + 0.5) / 100,
            math.floor(heading  * 100 + 0.5) / 100
        )
        onCapture(v4, extraMeta, diagCache)
    elseif not doCapture and onCancel then
        onCancel()
    end
end

local function getSpeedLabel(slow, fast)
    if fast then return 'FAST (x5)' end
    if slow then return 'FINE (0.1x)' end
    return 'NORMAL'
end

local function drawHUD()
    local r2 = function(n) return math.floor(n * 100 + 0.5) / 100 end
    local slow = IsDisabledControlPressed(0, 19) or IsControlPressed(0, 19)  -- Alt
    local fast = IsDisabledControlPressed(0, 21) or IsControlPressed(0, 21)  -- Shift
    local sLabel = getSpeedLabel(slow, fast)

    -- Background panel (left side to not conflict with other HUDs)
    DevViz.panel(0.155, 0.40, 0.28, 0.55, 10, 18, 36, 225)
    -- Title bar
    DevViz.accent(0.155, 0.15, 0.28, 255, 140, 0)
    DevViz.text2d(0.155, 0.135, 'SUNSET PLACEMENT STUDIO', 0.35, 0, 0, 0, 255, 4, true)

    local X = 0.025
    local Y = 0.170
    local G = 0.022

    local typeLabel = ({ped = 'PED', vehicle = 'VEHICLE', point = 'POINT'})[gizmoMode] or gizmoMode:upper()
    local label = extraMeta.label or typeLabel
    DevViz.text2d(X, Y,       ('~y~%s~s~  [%s]  Speed: ~g~%s~s~'):format(label, typeLabel, sLabel), 0.28)

    DevViz.text2d(X, Y+G*1.5, 'POSITION', 0.28, 180, 200, 255, 255)
    DevViz.text2d(X, Y+G*2.2, ('~b~X~s~ %8.3f   ~b~Y~s~ %8.3f'):format(coords.x, coords.y), 0.28)
    DevViz.text2d(X, Y+G*2.9, ('~b~Z~s~ %8.3f   ~b~H~s~ %6.2f°'):format(coords.z, heading), 0.28)

    -- Model (if any)
    if extraMeta.model then
        DevViz.text2d(X, Y+G*3.8, ('Model: ~y~%s~s~'):format(extraMeta.model), 0.27)
    end

    -- Diagnostics (cached)
    if diagCache then
        local g = diagCache.ground
        DevViz.text2d(X, Y+G*5.0, 'GROUND', 0.27, 180, 200, 255, 255)
        if g.found then
            local dColor = math.abs(g.delta) < 0.1 and '~g~' or (math.abs(g.delta) < 0.5 and '~y~' or '~r~')
            DevViz.text2d(X, Y+G*5.6, ('Found: ~g~YES~s~  Z: %.2f  Δ: %s%+.2fm~s~'):format(g.groundZ, dColor, g.delta), 0.27)
            if g.surfaceModel then
                DevViz.text2d(X, Y+G*6.2, ('Surface: OBJ ~y~%s~s~'):format(g.surfaceModel), 0.27)
            else
                DevViz.text2d(X, Y+G*6.2, 'Surface: ~g~World geo~s~', 0.27)
            end
        else
            DevViz.text2d(X, Y+G*5.6, 'Found: ~r~UNKNOWN~s~', 0.27)
        end
        local h = diagCache.head
        DevViz.text2d(X, Y+G*7.0, 'CLEARANCE', 0.27, 180, 200, 255, 255)
        if h.blocked then
            local col = h.status == 'BLOCKED' and '~r~' or '~y~'
            DevViz.text2d(X, Y+G*7.6, ('Head: %s%.2fm [%s]~s~'):format(col, h.clearance, h.status), 0.27)
        else
            DevViz.text2d(X, Y+G*7.6, 'Head: ~g~OK~s~', 0.27)
        end
    end

    -- Controls footer
    DevViz.text2d(X, Y+G*9.2, '~y~WASD~s~ Move  ~y~PgUp/Dn~s~ Z  ~y~Q/E~s~ Rotate', 0.26)
    DevViz.text2d(X, Y+G*9.8, '~y~G~s~ GroundSnap  ~y~R~s~ ResetRot  ~y~Z~s~ Undo  ~y~Y~s~ Redo', 0.26)
    DevViz.text2d(X, Y+G*10.4, '~g~ENTER~s~ Capture  ~r~BACKSPACE~s~ Cancel', 0.27)
end

function DevGizmo._loop()
    CreateThread(function()
        local frame = 0
        while isActive do
            Wait(0)
            frame = frame + 1

            if gizmoEnt ~= 0 and not DoesEntityExist(gizmoEnt) then
                isActive = false
                break
            end

            -- Disable conflicting controls
            DisableControlAction(0, 30, true)   -- D
            DisableControlAction(0, 31, true)   -- S
            DisableControlAction(0, 32, true)   -- W
            DisableControlAction(0, 34, true)   -- A
            DisableControlAction(0, 44, true)   -- Q
            DisableControlAction(0, 38, true)   -- E
            DisableControlAction(0, 22, true)   -- Space
            DisableControlAction(0, 36, true)   -- Ctrl
            DisableControlAction(0, 21, true)   -- Shift
            DisableControlAction(0, 23, true)   -- F (enter veh)
            DisableControlAction(0, 75, true)   -- exit veh

            local slow = IsDisabledControlPressed(0, 19) or IsControlPressed(0, 19)
            local fast = IsDisabledControlPressed(0, 21) or IsControlPressed(0, 21)
            local speed    = fast and 0.50 or (slow and 0.01 or 0.10)
            local rotSpeed = fast and 5.0  or (slow and 0.1  or 1.0)

            local rad  = math.rad(heading)
            local fwdX = -math.sin(rad)
            local fwdY =  math.cos(rad)
            local rgtX =  math.cos(rad)
            local rgtY =  math.sin(rad)

            local dx, dy, dz = 0.0, 0.0, 0.0

            -- Forward / Backward (W/S, arrow up/down)
            if IsDisabledControlPressed(0, 32) or IsControlPressed(0, 172) then
                dx = dx + fwdX * speed; dy = dy + fwdY * speed
            end
            if IsDisabledControlPressed(0, 31) or IsControlPressed(0, 173) then
                dx = dx - fwdX * speed; dy = dy - fwdY * speed
            end
            -- Strafe (A/D, arrow left/right)
            if IsDisabledControlPressed(0, 34) or IsControlPressed(0, 174) then
                dx = dx - rgtX * speed; dy = dy - rgtY * speed
            end
            if IsDisabledControlPressed(0, 30) or IsControlPressed(0, 175) then
                dx = dx + rgtX * speed; dy = dy + rgtY * speed
            end
            -- Up / Down (Space / Ctrl, PageUp/PageDown)
            if IsDisabledControlPressed(0, 22) or IsControlPressed(0, 10) then dz = dz + speed end
            if IsDisabledControlPressed(0, 36) or IsControlPressed(0, 11) then dz = dz - speed end

            -- Yaw (Q/E)
            if IsDisabledControlPressed(0, 44) then
                heading = (heading + rotSpeed) % 360.0
            end
            if IsDisabledControlPressed(0, 38) then
                heading = (heading - rotSpeed + 360.0) % 360.0
            end

            -- Pitch / Roll for vehicles (Num 8/2 / Num 4/6)
            if gizmoMode == 'vehicle' or gizmoMode == 'trailer' then
                if IsControlPressed(0, 111) then rotation = vector3(rotation.x + rotSpeed * 0.5, rotation.y, rotation.z) end
                if IsControlPressed(0, 112) then rotation = vector3(rotation.x - rotSpeed * 0.5, rotation.y, rotation.z) end
                if IsControlPressed(0, 114) then rotation = vector3(rotation.x, rotation.y - rotSpeed * 0.5, rotation.z) end
                if IsControlPressed(0, 115) then rotation = vector3(rotation.x, rotation.y + rotSpeed * 0.5, rotation.z) end
            end

            -- Apply translation
            if dx ~= 0 or dy ~= 0 or dz ~= 0 then
                coords = vector3(coords.x + dx, coords.y + dy, coords.z + dz)
                pushHistory()
            end

            -- Ground snap (G)
            if IsControlJustPressed(0, 47) or IsDisabledControlJustPressed(0, 47) then
                if gizmoMode == 'vehicle' and gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
                    SetEntityCoordsNoOffset(gizmoEnt, coords.x, coords.y, coords.z, false, false, false)
                    SetVehicleOnGroundProperly(gizmoEnt)
                    coords  = GetEntityCoords(gizmoEnt)
                    rotation = GetEntityRotation(gizmoEnt, 2)
                    heading  = GetEntityHeading(gizmoEnt)
                else
                    local found, gz = GetGroundZFor_3dCoord(coords.x, coords.y, coords.z + 5.0, false)
                    if found and gz and gz > 0 then
                        coords = vector3(coords.x, coords.y, gz)
                    end
                end
                PlaySoundFrontend(-1, 'NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false)
                diagCache = nil
                pushHistory()
            end

            -- Reset rotation (R)
            if IsControlJustPressed(0, 45) then
                rotation = vector3(0, 0, 0)
                if gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
                    SetEntityRotation(gizmoEnt, 0, 0, heading, 2, true)
                end
            end

            -- Undo (Z)
            if IsControlJustPressed(0, 20) and not IsDisabledControlPressed(0, 21) then
                DevGizmo.undo()
            end

            -- Redo (Y)
            if IsControlJustPressed(0, 73) and (IsDisabledControlPressed(0, 21) or IsControlPressed(0, 21)) then
                -- Shift+Y
                DevGizmo.redo()
            end

            -- Update entity position
            if gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
                SetEntityCoordsNoOffset(gizmoEnt, coords.x, coords.y, coords.z, false, false, false)
                if gizmoMode == 'vehicle' or gizmoMode == 'trailer' then
                    SetEntityRotation(gizmoEnt, rotation.x, rotation.y, heading, 2, true)
                else
                    SetEntityHeading(gizmoEnt, heading)
                end
            end

            -- Refresh diagnostics at rate-limited interval
            if frame % DIAG_INTERVAL == 0 then
                diagCache = DevValidate.fullCheck(coords.x, coords.y, coords.z, heading)
            end

            -- Visualize
            if gizmoMode == 'point' then
                DevViz.dot(coords.x, coords.y, coords.z, 0.4, 255, 200, 0, 220)
                DevViz.groundCross(coords.x, coords.y, coords.z, 2.0, 0, 255, 100)
            elseif gizmoEnt ~= 0 and DoesEntityExist(gizmoEnt) then
                DevViz.entityBox(gizmoEnt)
                DevViz.forwardArrow(gizmoEnt)
            end

            -- Ground delta line (when we know ground Z)
            if diagCache and diagCache.ground and diagCache.ground.found then
                local gz = diagCache.ground.groundZ
                DrawLine(coords.x, coords.y, gz, coords.x, coords.y, coords.z,
                    255, 255, 0, 180)
            end

            drawHUD()

            -- CAPTURE (Enter)
            if IsControlJustPressed(0, 18) or IsControlJustPressed(0, 191) or IsControlJustPressed(0, 201) then
                PlaySoundFrontend(-1, 'CHECKPOINT_PERFECT', 'HUD_MINI_GAME_SOUNDSET', false)
                DevGizmo.stop(true)
                return
            end

            -- CANCEL (Backspace / X)
            if IsControlJustPressed(0, 177) then
                DevGizmo.stop(false)
                return
            end
        end
    end)
end
