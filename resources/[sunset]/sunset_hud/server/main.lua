local LAYOUT_FILE = 'hud_layout_default.json'

local PANELS = {
    tl = true,
    logo = true,
    tr = true,
    bl = true,
    bc = true,
    speedo = true,
}

local function validateLayout(layout)
    if type(layout) ~= 'table' then return false, nil end

    local sanitized = {}
    local count = 0

    for id, pos in pairs(layout) do
        if PANELS[id] then
            if type(pos) ~= 'table' then return false, nil end
            local x = tonumber(pos.x)
            local y = tonumber(pos.y)
            if x == nil or y == nil or x ~= x or y ~= y or math.abs(x) > 10000 or math.abs(y) > 10000 then return false, nil end -- [SEC3] finite + bounded
            sanitized[id] = { x = x, y = y }
            count = count + 1
        end
    end

    if count == 0 then return false, nil end
    return true, sanitized
end

local function notify(source, msg, ntype)
    TriggerClientEvent('sunset:client:notify', source, msg, ntype or 'info')
end

RegisterNetEvent('sunset:server:hudExport', function(layout, applyAll)
    local src = source
    if not exports.sunset_admin:IsAdmin(src, 3) then
        notify(src, exports.sunset_core:TFor(src, 'hud.msg.no_permission_to_export_hud_layout'), 'error')
        return
    end
    local ok, sanitized = validateLayout(layout)
    if not ok then
        notify(src, exports.sunset_core:TFor(src, 'hud.msg.invalid_hud_layout_data'), 'error')
        return
    end

    local encoded = json.encode(sanitized)
    SaveResourceFile(GetCurrentResourceName(), LAYOUT_FILE, encoded, -1)

    if applyAll then
        TriggerClientEvent('sunset:client:hudDefaultUpdated', -1, sanitized, true)
        notify(src, exports.sunset_core:TFor(src, 'hud.msg.hud_layout_exported_and_applied_to'), 'success')
    else
        TriggerClientEvent('sunset:client:hudDefaultUpdated', -1, sanitized, false)
        notify(src, exports.sunset_core:TFor(src, 'hud.msg.hud_layout_exported_as_server_default'), 'success')
    end
end)
