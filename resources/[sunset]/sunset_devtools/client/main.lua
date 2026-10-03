-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — client/main.lua
--  Kill switch, permission check, command registration,
--  and compatibility aliases for existing admin tools.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetDevTools.Config
local isEnabled = false
local isPermitted = false

local function killSwitchOn()
    return (GetConvarInt('sunset_dev', 0) == 1 and GetConvar(Cfg.enabledConvar, 'false') == 'true')
end

local function notify(msg, typ)
    if isEnabled and exports.sunset_ui and pcall(function() end) then
        pcall(function() exports.sunset_ui:Notify(msg, typ or 'info', 6000) end)
    else
        TriggerEvent('chat:addMessage', { color = {255,165,0}, args = {'[DEVTOOLS]', msg} })
    end
end

-- Request permission from server and receive the result
RegisterNetEvent('sunset:devtools:permResult')
AddEventHandler('sunset:devtools:permResult', function(granted)
    isPermitted = granted
    if not granted then
        print('^1[devtools] Permission denied — insufficient admin level or kill switch off.^7')
    else
        print('^2[devtools] Placement Studio ready. /devplace /devroute /worldprobe /devvalidate^7')
    end
end)

-- Check permission on spawn
AddEventHandler('playerSpawned', function()
    if killSwitchOn() then
        TriggerServerEvent('sunset:devtools:checkPerm')
    end
end)

-- Also check immediately on resource start (player may already be in-game)
CreateThread(function()
    Wait(2000)
    if killSwitchOn() then
        TriggerServerEvent('sunset:devtools:checkPerm')
    end
end)

local function guardPerm()
    if not killSwitchOn() then
        print('^1[devtools] Kill switch is off. setr sunset_devtools_enabled true to activate.^7')
        return false
    end
    if not isPermitted then
        TriggerServerEvent('sunset:devtools:checkPerm')
        notify(exports.sunset_core:Translate('devtools.message.checking_permission', { level = Cfg.minAdminLevel }), 'error')
        return false
    end
    return true
end

-- ── /devplace [adapter] [key] ─────────────────────────────────

RegisterCommand('devplace', function(src, args)
    if not guardPerm() then return end
    if DevRoute.isActive() then
        notify(exports.sunset_core:Translate('devtools.message.close_the_route_editor_first_devroute_to_toggle'), 'warning')
        return
    end
    local adapterKey = args[1]
    local fieldKey   = args[2]
    DevPlace.open(adapterKey, fieldKey)
end, false)

TriggerEvent('chat:addSuggestion', '/devplace', 'Placement Studio — move NPCs, vehicles, points', {
    { name = 'adapter', helpKey = "config.devtools.help.missions_trucker.bc95ee03", help = 'missions | trucker' },
    { name = 'key',     helpKey = "config.devtools.help.hank_route1_pickup.88ecfed9", help = 'hank | route1_pickup | ...' },
})

-- ── /devpos — capture player position ────────────────────────

RegisterCommand('devpos', function(src, args)
    if not guardPerm() then return end
    local adapter = args[1]
    local key     = args[2]
    DevPlace.capturePlayerPos(adapter, key)
end, false)

TriggerEvent('chat:addSuggestion', '/devpos', 'Capture player position as dev coord (clipboard + F8)')

-- ── /devroute [adapter] [routeIndex] ─────────────────────────

RegisterCommand('devroute', function(src, args)
    if not guardPerm() then return end
    if DevGizmo.isActive() then
        notify(exports.sunset_core:Translate('devtools.message.close_the_gizmo_first_backspace'), 'warning')
        return
    end
    local adapterKey = args[1] or 'trucker'
    local routeHint  = args[2]
    DevRoute.open(adapterKey, routeHint)
end, false)

TriggerEvent('chat:addSuggestion', '/devroute', 'Route editor — view/edit all stages of a job route', {
    { name = 'adapter', helpKey = "config.devtools.help.trucker.61ea6572", help = 'trucker' },
    { name = 'route',   help = '1 | 2 | ...' },
})

-- ── /worldprobe ───────────────────────────────────────────────

RegisterCommand('worldprobe', function()
    if not guardPerm() then return end
    if DevProbe.isActive() then
        DevProbe.stop()
    else
        if DevGizmo.isActive() then
            notify(exports.sunset_core:Translate('devtools.message.close_the_gizmo_first_backspace'), 'warning')
            return
        end
        DevProbe.start()
    end
end, false)

TriggerEvent('chat:addSuggestion', '/worldprobe', 'World probe — crosshair raycast for position/ground info')

-- ── /devvalidate [adapter] ────────────────────────────────────

RegisterCommand('devvalidate', function(src, args)
    if not guardPerm() then return end
    local ak = args[1] or 'trucker'
    local adapter = SunsetDevTools.Adapters[ak]
    if not adapter then
        notify(exports.sunset_core:Translate('devtools.message.unknown_adapter') .. ak, 'error')
        return
    end

    notify(exports.sunset_core:Translate('devtools.message.running_validation_see_f8_for_results'), 'info')

    CreateThread(function()
        local fields = adapter.describe and adapter.describe() or {}
        print('^3[DEVTOOLS VALIDATE]  ' .. ak:upper() .. '  (' .. #fields .. ' stages)^7')
        for _, f in ipairs(fields) do
            local cv = f.coords
            if not cv then goto continue end
            local diag = DevValidate.fullCheck(cv.x, cv.y, cv.z, f.heading or 0.0)
            local g = diag.ground
            local h = diag.head

            local gPass = g.found and math.abs(g.delta) < 0.5
            local hPass = not h.blocked or h.clearance >= 1.0
            local overall = (gPass and hPass) and '^2PASS^7' or '^1FAIL^7'

            local gStr = g.found
                and ('^2PASS^7  Z=%.2f  Δ%+.2f'):format(g.groundZ, g.delta)
                or  '^3UNKNOWN^7'
            local hStr = h.blocked
                and ('^1%s^7 %.2fm'):format(h.status, h.clearance)
                or  '^2OK^7'

            print(('%s  %-42s  Ground: %s  Head: %s'):format(overall, (f.label or f.key):sub(1,42), gStr, hStr))
            Wait(0)  -- yield to avoid blocking the main thread
            ::continue::
        end
        print('^3[DEVTOOLS VALIDATE]  done.^7')
    end)
end, false)

TriggerEvent('chat:addSuggestion', '/devvalidate', 'Validate all placement coords for an adapter', {
    { name = 'adapter', helpKey = "config.devtools.help.trucker_missions.51fa4e88", help = 'trucker | missions' },
})

-- ── Admin teleport event is already registered by sunset_admin.
-- We use the same event for our internal gotoPoint teleports by triggering
-- it locally: TriggerEvent('sunset:admin:teleport', x, y, z)
-- Do NOT re-register it here to avoid double-fire.

print('^3[sunset_devtools] client loaded — kill switch: ^7' .. GetConvar(Cfg.enabledConvar, 'false'))
