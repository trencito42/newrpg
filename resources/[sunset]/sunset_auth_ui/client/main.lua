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
local lastShowPayload = nil
local hudHideThread = nil
local nativeFocusRefreshId = 0

-- Suppress native GTA HUD (minimap, ammo, etc.) every frame while auth is open.
local function startHudSuppression()
    if hudHideThread then return end
    hudHideThread = CreateThread(function()
        while authOpen do
            DisplayRadar(false)
            HideHudAndRadarThisFrame()
            Wait(0)
        end
        -- Restore when auth closes
        DisplayRadar(true)
        hudHideThread = nil
    end)
end

local function stopHudSuppression()
    -- Setting authOpen = false lets the thread exit on its own next tick
    DisplayRadar(true)
end

-- [NUI FOCUS] Register the auth screen as focus owner 'auth' in the central
-- manager so no other resource can silently steal/release the login cursor.
-- During pre-login auth is authoritative: if a stale owner survived the
-- loadscreen handoff, clear that stale owner once and reclaim focus as 'auth'.
local function authFocus(hasFocus, hasCursor)
    if GetResourceState('sunset_ui') ~= 'started' then
        print('^1[AUTH UI]^7 sunset_ui focus manager unavailable')
        return false
    end

    local ok, res = pcall(function()
        return exports.sunset_ui:SetFocus(hasFocus, hasCursor, false, 'auth')
    end)
    if ok and res ~= false then
        return true
    end

    -- A stale pre-login focus owner (commonly entry/handoff) must never leave
    -- a visible login form without a mouse cursor. Only preempt on focus gain;
    -- never force-release on focus loss, where a newer UI may legitimately own it.
    if hasFocus then
        pcall(function()
            exports.sunset_ui:SetFocus(false, false, false, 'force')
        end)
        local okRetry, retryRes = pcall(function()
            return exports.sunset_ui:SetFocus(true, hasCursor == true, false, 'auth')
        end)
        if okRetry and retryRes ~= false then
            print('^3[AUTH UI]^7 reclaimed NUI focus from stale owner')
            return true
        end
    end

    print(('^1[AUTH UI]^7 focus manager failed: %s'):format(tostring(res)))
    return false
end

local function applyAuthNativeFocus(hasFocus, hasCursor)
    SetNuiFocus(hasFocus == true, hasCursor == true)
    SetNuiFocusKeepInput(false)
end

local function reassertAuthFocus()
    if not authOpen then return false end
    local tracked = authFocus(true, true)
    applyAuthNativeFocus(true, true)
    return tracked
end
exports('ReassertFocus', reassertAuthFocus)

-- FiveM only calls GiveFocus when its per-resource focus/cursor votes change.
-- ShutdownLoadingScreenNui can leave the visible cursor out of sync with those
-- votes, so repeating SetNuiFocus(true, true) is a no-op. Force an actual
-- off -> on transition after the loadscreen has closed.
local function refreshAuthNativeCursor()
    if not authOpen then return false end
    nativeFocusRefreshId = nativeFocusRefreshId + 1
    local refreshId = nativeFocusRefreshId
    applyAuthNativeFocus(false, false)
    CreateThread(function()
        Wait(0)
        if not authOpen or refreshId ~= nativeFocusRefreshId then return end
        reassertAuthFocus()
    end)
    return true
end

local function send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

exports('Send', send)

exports('Show', function(screen, data)
    authOpen = true
    authVisibleRendered = false
    authPresentationId = authPresentationId + 1
    reassertAuthFocus()
    startHudSuppression()

    local payload = type(data) == 'table' and data or {}
    payload.presentationId = authPresentationId
    lastShowPayload = payload

    -- Messages sent before the NUI document installs its message listener are
    -- dropped by CEF. Queue the latest presentation and replay it from
    -- authDomReady instead of repeatedly reopening the form (which caused flicker).
    if authDomReady then
        send('authShow', payload)
    end
end)

exports('Hide', function()
    authOpen = false
    nativeFocusRefreshId = nativeFocusRefreshId + 1
    authVisibleRendered = false
    lastShowPayload = nil
    authFocus(false, false)
    applyAuthNativeFocus(false, false)
    stopHudSuppression()
    send('authHide', {})
end)

exports('SetFocus', function(hasFocus, hasCursor)
    authFocus(hasFocus == true, hasCursor == true)
    applyAuthNativeFocus(hasFocus == true, hasCursor == true)
    if not hasFocus then
        authOpen = false
        authVisibleRendered = false
        lastShowPayload = nil
    end
end)

-- "Open" means the auth flow owns a presentation, not that the browser has
-- already painted it. IsVisibleRendered remains the separate paint ACK used by
-- the loadscreen handoff. Keeping these states separate prevents the auth
-- watchdog from replaying authShow every second on a slow first frame.
exports('IsAuthOpen', function() return authOpen end)
exports('IsDomReady', function() return authDomReady end)
exports('IsVisibleRendered', function() return authVisibleRendered end)
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

    if authOpen and lastShowPayload then
        send('authShow', lastShowPayload)
    end

    TriggerEvent('sunset:auth:domReady', data)
    cb('ok')
end)

RegisterNUICallback('authVisibleRendered', function(data, cb)
    if authOpen and type(data) == 'table' and tonumber(data.presentationId) == authPresentationId then
        authVisibleRendered = true
        -- This callback runs inside the resource that owns the auth ui_page.
        -- Focus after the form has painted, not only from cross-resource exports.
        reassertAuthFocus()
        TriggerEvent('sunset:auth:visibleRendered', data)
    end
    cb('ok')
end)

RegisterNUICallback('authMouseProbeResult', function(data, cb)
    data = type(data) == 'table' and data or {}
    print(('[AUTH MOUSE] moves=%s downs=%s clicks=%s target=%s visible=%s active=%s cssCursor=%s visibility=%s'):format(
        tostring(data.moves), tostring(data.downs), tostring(data.clicks), tostring(data.lastTarget),
        tostring(data.visible), tostring(data.activeElement), tostring(data.cursor), tostring(data.visibility)))
    cb('ok')
end)

RegisterCommand('authmouse', function()
    print(('[AUTH MOUSE] open=%s rendered=%s focused=%s keepInput=%s (move mouse before running this)'):format(
        tostring(authOpen), tostring(authVisibleRendered), tostring(IsNuiFocused()), tostring(IsNuiFocusKeepingInput())))
    send('authMouseProbe')
end, false)

AddEventHandler('sunset:auth_ui:reassertFocus', function()
    refreshAuthNativeCursor()
end)

RegisterCommand('authfocus', function()
    local owner = 'unavailable'
    if GetResourceState('sunset_ui') == 'started' then
        local ok, value = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
        if ok then owner = tostring(value) end
    end
    print(('[AUTH FOCUS] resource=%s open=%s rendered=%s owner=%s nuiFocused=%s keepInput=%s'):format(
        GetCurrentResourceName(), tostring(authOpen), tostring(authVisibleRendered), owner,
        tostring(IsNuiFocused()), tostring(IsNuiFocusKeepingInput())))
    if authOpen then
        refreshAuthNativeCursor()
        print(('[AUTH FOCUS] native cursor refresh queued in %s'):format(GetCurrentResourceName()))
    end
end, false)

-- sunset_ui NUI page re-initialises after ShutdownLoadingScreen (bootEpoch fires
-- → sunset:ui:ready). FiveM resets NUI cursor state on page reinit, so re-assert.
AddEventHandler('sunset:ui:ready', function()
    if authOpen then
        reassertAuthFocus()
    end
end)

-- [CLIENT_PERF_ENTITY_AUDIT] Release NUI focus on resource stop/restart.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if authOpen then
        authFocus(false, false)
        applyAuthNativeFocus(false, false)
        authOpen = false
        authVisibleRendered = false
        lastShowPayload = nil
    end
end)
