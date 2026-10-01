-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Auth UI (client/main.lua)
--  Minimal NUI host for the login screen. Holds NO auth logic:
--  every NUI callback is forwarded to sunset_auth as an event, and
--  sunset_auth pushes state back through the Send/Show exports.
--  This keeps one source of truth for authentication.
-- ═══════════════════════════════════════════════════════════════

local authOpen = false
local authDomReady = false
local authVisibleRendered = false
local authBootEpoch = 0
local authPresentationId = 0

-- [NUI FOCUS] Register the auth screen as focus owner 'auth' in the central
-- manager so no other resource can silently steal/release the login cursor,
-- and so the auth release cannot clobber a newer owner (spawn/character UI).
local function authFocus(hasFocus, hasCursor)
    -- sunset_ui is a declared dependency. Never bypass its owner guard by
    -- calling the native directly if it is unavailable during a restart.
    if GetResourceState('sunset_ui') ~= 'started' then
        print('^1[AUTH UI]^7 sunset_ui focus manager unavailable')
        return false
    end
    local ok, res = pcall(function()
        return exports.sunset_ui:SetFocus(hasFocus, hasCursor, false, 'auth')
    end)
    if not ok then
        print(('^1[AUTH UI]^7 focus manager failed: %s'):format(tostring(res)))
        return false
    end
    return res ~= false
end

local function send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

exports('Send', send)

exports('Show', function(screen, data)
    authOpen = true
    authVisibleRendered = false
    authPresentationId = authPresentationId + 1
    authFocus(true, true)
    local payload = type(data) == 'table' and data or {}
    payload.presentationId = authPresentationId
    send('authShow', payload)
end)

exports('Hide', function()
    authOpen = false
    authVisibleRendered = false
    authFocus(false, false)
    send('authHide', {})
end)

exports('SetFocus', function(hasFocus, hasCursor)
    authFocus(hasFocus == true, hasCursor == true)
    if not hasFocus then
        authOpen = false
        authVisibleRendered = false
    end
end)

exports('IsAuthOpen', function() return authOpen and authVisibleRendered end)
exports('IsDomReady', function() return authDomReady end)
exports('IsVisibleRendered', function() return authVisibleRendered end)
-- Compatibility export: "rendered" now means an actually painted auth surface.
exports('IsRendered', function() return authVisibleRendered end)
exports('GetBootEpoch', function() return authBootEpoch end)

-- ── Forward NUI callbacks to sunset_auth ──
local FORWARDED = {
    'authReady',
    'authLogin',
    'authRegister',
    'authPickAccount',
    'authRemoveAccount',
    'authSetEmail',
    'authSetQuickLogin',
    'authSavePortrait',
}

for _, name in ipairs(FORWARDED) do
    RegisterNUICallback(name, function(data, cb)
        TriggerEvent('sunset:nui:' .. name, type(data) == 'table' and data or {})
        cb('ok')
    end)
end

RegisterNUICallback('authDomReady', function(data, cb)
    authDomReady = true
    authBootEpoch = GetGameTimer()
    TriggerEvent('sunset:auth:domReady', data)
    cb('ok')
end)

RegisterNUICallback('authVisibleRendered', function(data, cb)
    if authOpen and type(data) == 'table' and tonumber(data.presentationId) == authPresentationId then
        authVisibleRendered = true
        TriggerEvent('sunset:auth:visibleRendered', data)
    end
    cb('ok')
end)

-- [CLIENT_PERF_ENTITY_AUDIT] Release NUI focus on resource stop/restart.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if authOpen then
        authFocus(false, false)
        authOpen = false
        authVisibleRendered = false
    end
end)
