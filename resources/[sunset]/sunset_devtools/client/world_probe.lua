-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/world_probe.lua
--  /worldprobe: crosshair raycast tool showing hit position,
--  entity info, ground Z, suggested vector4.
-- ═══════════════════════════════════════════════════════════════

DevProbe = {}

local isProbeActive = false
local CFG = SunsetDevTools.Config

local function camDir()
    local rot = GetGameplayCamRot(2)
    local rx  = math.rad(rot.x)
    local rz  = math.rad(rot.z)
    return vector3(
        -math.sin(rz) * math.cos(rx),
         math.cos(rz) * math.cos(rx),
         math.sin(rx)
    )
end

local function modelName(hash)
    if not hash or hash == 0 then return nil end
    -- Try common known models
    for _, name in ipairs({'phantom', 'tanker', 'truck', 's_m_m_dockwork_01', 'mp_m_freemode_01', 'mp_f_freemode_01'}) do
        if joaat(name) == hash then return name end
    end
    return string.format('0x%X', hash)
end

local function drawProbeHUD(hit, hitCoords, entityHit, groundZ, devHeading)
    -- Background
    DevViz.panel(0.155, 0.32, 0.28, 0.38, 10, 18, 36, 225)
    DevViz.accent(0.155, 0.14, 0.28, 100, 220, 255)
    DevViz.text2d(0.155, 0.125, 'WORLD PROBE  [/worldprobe to exit]', 0.33, 0, 0, 0, 255, 4, true)

    local X = 0.025
    local Y = 0.160
    local G = 0.022

    if not hit then
        DevViz.text2d(X, Y, '~r~No hit~s~ — aim at geometry', 0.30)
        return
    end

    DevViz.text2d(X, Y,       'HIT POSITION', 0.28, 100, 200, 255, 255)
    DevViz.text2d(X, Y+G,     ('X: ~b~%.3f~s~   Y: ~b~%.3f~s~'):format(hitCoords.x, hitCoords.y), 0.28)
    DevViz.text2d(X, Y+G*1.8, ('Z: ~b~%.3f~s~   H: ~b~%.2f°~s~'):format(hitCoords.z, devHeading), 0.28)

    if groundZ then
        DevViz.text2d(X, Y+G*3.0, ('Ground Z: ~g~%.3f~s~'):format(groundZ), 0.28)
    else
        DevViz.text2d(X, Y+G*3.0, 'Ground Z: ~y~UNKNOWN~s~', 0.28)
    end

    local entityLabel = 'WORLD'
    if entityHit and entityHit ~= 0 and DoesEntityExist(entityHit) then
        local tp = GetEntityType(entityHit)
        if tp == 1 or tp == 2 or tp == 3 then
            local tLabel = ({[1]='PED', [2]='VEHICLE', [3]='OBJECT'})[tp] or 'ENTITY'
            local ok, mHash = pcall(GetEntityModel, entityHit)
            if ok and mHash then
                local mName = modelName(mHash) or ('0x%X'):format(mHash)
                entityLabel = ('%s  model=%s'):format(tLabel, mName)
            end
        end
    end
    DevViz.text2d(X, Y+G*4.0, ('Entity: ~y~%s~s~'):format(entityLabel), 0.28)

    -- Suggested vector4
    local v4 = ('vector4(%.3f, %.3f, %.3f, %.2f)'):format(hitCoords.x, hitCoords.y, hitCoords.z, devHeading)
    DevViz.text2d(X, Y+G*5.2, 'SUGGESTED:', 0.28, 100, 200, 255, 255)
    DevViz.text2d(X, Y+G*5.9, v4, 0.27, 255, 220, 100, 255)
    DevViz.text2d(X, Y+G*6.6, '~y~[C]~s~ Copy to clipboard', 0.27)
end

function DevProbe.start()
    if isProbeActive then return end
    isProbeActive = true
    exports.sunset_ui:Notify('World Probe active — aim and look. /worldprobe to exit.', 'info', 5000)

    CreateThread(function()
        local lastHitCoords = nil
        local lastGroundZ   = nil
        local lastEntityHit = nil

        while isProbeActive do
            Wait(0)

            local camPos = GetGameplayCamCoords()
            local dir    = camDir()
            local endPos = camPos + dir * CFG.probeCastLength

            local handle = StartShapeTestRay(
                camPos.x, camPos.y, camPos.z,
                endPos.x, endPos.y, endPos.z,
                1 | 2 | 4 | 8 | 16, PlayerPedId(), 0
            )
            local result, hit, hitCoords, _normal, entityHit = GetShapeTestResult(handle)

            local groundZ   = nil
            local devH      = GetEntityHeading(PlayerPedId())

            if result == 2 and hit then
                lastHitCoords = hitCoords
                lastEntityHit = (entityHit ~= 0) and entityHit or nil

                -- Ground probe at hit XY
                local gfound, gz = GetGroundZFor_3dCoord(hitCoords.x, hitCoords.y, hitCoords.z + 5.0, false)
                lastGroundZ = (gfound and gz and gz > 0) and gz or nil

                -- Visual dot at hit
                DevViz.dot(hitCoords.x, hitCoords.y, hitCoords.z, 0.3, 100, 220, 255, 220)
                if lastGroundZ then
                    DrawLine(hitCoords.x, hitCoords.y, lastGroundZ, hitCoords.x, hitCoords.y, hitCoords.z, 100, 220, 255, 120)
                end
            end

            drawProbeHUD(lastHitCoords ~= nil, lastHitCoords, lastEntityHit, lastGroundZ, devH)

            -- Copy to clipboard (C)
            if IsControlJustPressed(0, 26) and lastHitCoords then
                local v4 = ('vector4(%.3f, %.3f, %.3f, %.2f)'):format(
                    lastHitCoords.x, lastHitCoords.y, lastHitCoords.z, devH)
                SetClipboardText(v4)
                print(('^2[devtools] Copied: %s^7'):format(v4))
                exports.sunset_ui:Notify('Copied: ' .. v4, 'success', 4000)
            end

            -- Toggle off with /worldprobe again (handled via command) or ESC
            if IsControlJustPressed(0, 200) then  -- ESC
                isProbeActive = false
            end
        end

        exports.sunset_ui:Notify('World Probe closed.', 'info', 2000)
    end)
end

function DevProbe.stop()
    isProbeActive = false
end

function DevProbe.isActive()
    return isProbeActive
end
