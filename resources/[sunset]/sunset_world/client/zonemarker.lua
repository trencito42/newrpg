-- /zonemark — click-to-place delivery zone corners
-- E (or left-click) = place corner point
-- /zonemark done  = finish and print config line
-- /zonemark clear = start over
-- /zonemark cancel = exit without output

local marking    = false
local points     = {}
local markerThread = nil

local COLORS = {
    { r=255, g=100, b=50  },  -- orange
    { r=50,  g=200, b=255 },  -- cyan
    { r=50,  g=255, b=100 },  -- green
    { r=255, g=255, b=50  },  -- yellow
    { r=255, g=50,  b=150 },  -- pink
    { r=150, g=50,  b=255 },  -- purple
}

local function notify(msg, kind)
    exports.sunset_ui:Notify(msg, kind or 'info', 5000)
end

local function groundRaycast()
    local cam   = GetGameplayCamCoord()
    local rot   = GetGameplayCamRot(2)
    local rx    = math.rad(rot.x)
    local rz    = math.rad(rot.z)
    local dirX  = -math.sin(rz) * math.abs(math.cos(rx))
    local dirY  =  math.cos(rz) * math.abs(math.cos(rx))
    local dirZ  = -math.sin(rx)
    local far   = vector3(cam.x + dirX * 200, cam.y + dirY * 200, cam.z + dirZ * 200)
    local ray   = StartShapeTestLosProbe(cam.x, cam.y, cam.z, far.x, far.y, far.z, 1 | 16, PlayerPedId(), 4)
    local _, hit, hitPos = GetShapeTestResult(ray)
    return hit == 1, hitPos
end

local function drawLoop()
    markerThread = CreateThread(function()
        while marking do
            -- Preview crosshair marker
            local ok, pos = groundRaycast()
            if ok then
                DrawMarker(1, pos.x, pos.y, pos.z, 0, 0, 0, 0, 0, 0,
                    0.3, 0.3, 0.3, 255, 200, 50, 180, false, true, 2, false, nil, nil, false)
            end
            -- Draw placed points
            for i, p in ipairs(points) do
                local c = COLORS[((i - 1) % #COLORS) + 1]
                DrawMarker(1, p.x, p.y, p.z, 0, 0, 0, 0, 0, 0,
                    0.4, 0.4, 0.8, c.r, c.g, c.b, 200, false, true, 2, false, nil, nil, false)
                -- line from previous point
                if i > 1 then
                    local prev = points[i - 1]
                    DrawLine(prev.x, prev.y, prev.z + 0.05, p.x, p.y, p.z + 0.05, c.r, c.g, c.b, 200)
                end
            end
            -- Close the polygon preview
            if #points >= 3 then
                local last = points[#points]
                local first = points[1]
                DrawLine(last.x, last.y, last.z + 0.05, first.x, first.y, first.z + 0.05, 180, 180, 180, 150)
            end

            -- HUD hint
            BeginTextCommandDisplayHelp('STRING')
            AddTextComponentSubstringPlayerName(
                ('[ZONEMARK] Points: %d  |  ~INPUT_CONTEXT~ = place  |  /zonemark done / clear / cancel')
                :format(#points)
            )
            EndTextCommandDisplayHelp(0, false, true, -1)

            -- E key = place point
            if IsControlJustPressed(0, 38) then   -- E
                local hit, p = groundRaycast()
                if hit then
                    points[#points + 1] = { x = p.x, y = p.y, z = p.z }
                    notify(exports.sunset_core:Translate('world.msg.point_placed', { count = #points, value = string.format('%.2f', p.x), y = string.format('%.2f', p.y), z = string.format('%.2f', p.z) }), 'info')
                else
                    notify(exports.sunset_core:Translate('world.message.could_not_detect_ground_aim_at_a_surface'), 'error')
                end
            end

            Wait(0)
        end
    end)
end

local function finish()
    if #points < 2 then
        notify(exports.sunset_core:Translate('world.message.need_at_least_2_points_to_define_a_zone'), 'error')
        return
    end

    -- Compute axis-aligned bounding rect from point cloud
    local minX, maxX, minY, maxY, sumZ = math.huge, -math.huge, math.huge, -math.huge, 0
    for _, p in ipairs(points) do
        if p.x < minX then minX = p.x end
        if p.x > maxX then maxX = p.x end
        if p.y < minY then minY = p.y end
        if p.y > maxY then maxY = p.y end
        sumZ = sumZ + p.z
    end
    local cx     = (minX + maxX) / 2
    local cy     = (minY + maxY) / 2
    local cz     = sumZ / #points
    local width  = maxX - minX
    local length = maxY - minY
    local radius = math.max(width, length) / 2

    local line = ('delivery = vector3(%.2f, %.2f, %.2f),  -- radius ~%.1f  (%.1f x %.1f)')
        :format(cx, cy, cz, radius, width, length)

    print('[ZONEMARK] ' .. line)
    notify(exports.sunset_core:Translate('world.message.zone_saved_check_f8_console_for_config_line'), 'success')

    -- Also print all raw points
    print('[ZONEMARK] Raw points:')
    for i, p in ipairs(points) do
        print(('  [%d] vector3(%.2f, %.2f, %.2f)'):format(i, p.x, p.y, p.z))
    end

    marking = false
    points  = {}
end

RegisterCommand('zonemark', function(_, args)
    local sub = (args[1] or ''):lower()

    if sub == 'done' then
        if not marking then notify(exports.sunset_core:Translate('world.message.not_in_zone_marking_mode'), 'error') return end
        finish()
        marking = false
        notify(exports.sunset_core:Translate('world.message.zone_marking_ended'), 'info')
        return
    end

    if sub == 'clear' then
        points = {}
        notify(exports.sunset_core:Translate('world.message.points_cleared_keep_marking'), 'info')
        return
    end

    if sub == 'cancel' then
        marking = false
        points  = {}
        notify(exports.sunset_core:Translate('world.message.zone_marking_cancelled'), 'info')
        return
    end

    -- Start marking
    if marking then
        notify(exports.sunset_core:Translate('world.message.already_marking_use_zonemark_done_or_cancel'), 'info')
        return
    end
    marking = true
    points  = {}
    notify(exports.sunset_core:Translate('world.message.zone_marking_started_aim_at_ground_and_press_e'), 'success')
    drawLoop()
end, false)

TriggerEvent('chat:addSuggestion', '/zonemark', 'Mark a delivery zone by placing corner points', {
    { name = 'done/clear/cancel', help = 'Finish, clear points, or cancel' },
})
