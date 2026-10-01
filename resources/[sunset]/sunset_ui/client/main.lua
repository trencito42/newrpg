local isOpen = false
local currentScreen = nil
local focusOwner = nil
local transitionVisible = false

local function nuiDebugEnabled()
    return GetConvar('sv_sunset_nuidebug', '0') == '1'
end

function Show(screen, data)
    isOpen = true
    currentScreen = screen
    if screen ~= 'loading' and screen ~= 'handoff' then
        focusOwner = 'entry'
        SetNuiFocus(true, true)
    else
        focusOwner = nil
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
    end
    SendNUIMessage({
        action = 'show',
        screen = screen,
        data = data or {},
    })
end
exports('Show', Show)

function Hide()
    isOpen = false
    currentScreen = nil
    focusOwner = nil
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({ action = 'hide' })
end
exports('Hide', Hide)

function SetFocus(hasFocus, hasCursor, keepInput, owner)
    owner = type(owner) == 'string' and owner ~= '' and owner or 'legacy'
    -- [LOGIN FOCUS GUARD] While the auth (login) screen is up, ONLY the auth
    -- flow ('auth' owner) or 'force' may release focus. Some resource was
    -- calling SetFocus(false,...,'legacy') ~13s into the login screen, killing
    -- the cursor ("cannot click for several seconds after login").
    if not hasFocus and isOpen and currentScreen == 'auth'
        and owner ~= 'auth' and owner ~= 'force' and focusOwner == 'auth' then
        local tb = debug.traceback('', 2):gsub('\n', ' | '):sub(1, 300)
        print(('^1[FOCUS]^7 BLOCKED release during auth screen: caller-owner=%s | %s'):format(owner, tb))
        return false
    end
    if not hasFocus and focusOwner and focusOwner ~= owner and owner ~= 'force' then
        -- [BOOT TRACE v2] blocked release attempt — this is the focus-owner trap
        print(('^3[FOCUS]^7 blocked release: owner=%s current=%s'):format(owner, tostring(focusOwner)))
        return false
    end
    focusOwner = hasFocus and owner or nil
    SetNuiFocus(hasFocus, hasCursor == true)
    SetNuiFocusKeepInput(keepInput == true)
    if nuiDebugEnabled() or (SunsetBoot and SunsetBoot.IsVerbose and SunsetBoot.IsVerbose()) then
        local tb = debug.traceback('', 2):gsub('\n', ' | '):sub(1, 220)
        local bootId = (SunsetBoot and SunsetBoot.GetBootId) and SunsetBoot.GetBootId() or 'boot'
        print(('^5[BOOTV boot=%s %d] [focus] SetFocus(has=%s cursor=%s keepInput=%s owner=%s screen=%s) | %s^7'):format(
            bootId, GetGameTimer(), tostring(hasFocus), tostring(hasCursor == true), tostring(keepInput == true), tostring(owner), tostring(currentScreen), tb))
    end
    return true
end
exports('SetFocus', SetFocus)

function GetFocusOwner()
    return focusOwner
end
exports('GetFocusOwner', GetFocusOwner)

local function modalStillOpen()
    if GetResourceState('sunset_menu') == 'started' then
        local ok, open = pcall(function() return exports.sunset_menu:IsMenuOpen() end)
        if ok and open then return true end
    end
    if GetResourceState('sunset_properties') == 'started' then
        local ok, open = pcall(function() return exports.sunset_properties:IsPanelOpen() end)
        if ok and open then return true end
    end
    if GetResourceState('sunset_factions') == 'started' then
        local ok, open = pcall(function() return exports.sunset_factions:IsFactionPanelOpen() end)
        if ok and open then return true end
    end
    return false
end

function ReleaseFocusUnlessModal(owner)
    if modalStillOpen() then return end
    SetFocus(false, false, false, owner or 'legacy')
end
exports('ReleaseFocusUnlessModal', ReleaseFocusUnlessModal)

-- ═══════════════════════════════════════════════════════════════
--  [TEST AGENT NUI INSTRUMENTATION] Gated by convar sv_sunset_nuidebug=1.
--  When off (production default): zero overhead, zero behavior change.
--  When on: ring buffers of outbound messages, focus transitions and
--  inbound NUI callbacks for sunset_test_agent inspection.
-- ═══════════════════════════════════════════════════════════════
local NUI_DEBUG_CAP = 60
local nuiMsgBuffer, nuiMsgHead, nuiMsgTotal = {}, 0, 0
local nuiCbBuffer, nuiCbHead, nuiCbTotal = {}, 0, 0
local nuiErrBuffer, nuiErrHead, nuiErrTotal = {}, 0, 0

function NuiDebugRecordMessage(action)
    if not nuiDebugEnabled() then return end
    nuiMsgHead = (nuiMsgHead % NUI_DEBUG_CAP) + 1
    nuiMsgTotal = nuiMsgTotal + 1
    -- NOTE: `os` does NOT exist in client-side Lua (server-only). Use
    -- GetGameTimer() (ms since resource start) — always available client-side.
    nuiMsgBuffer[nuiMsgHead] = { seq = nuiMsgTotal, action = tostring(action), at = GetGameTimer() }
end

function NuiDebugRecordCallback(name)
    if not nuiDebugEnabled() then return end
    nuiCbHead = (nuiCbHead % NUI_DEBUG_CAP) + 1
    nuiCbTotal = nuiCbTotal + 1
    nuiCbBuffer[nuiCbHead] = { seq = nuiCbTotal, name = tostring(name), at = GetGameTimer() }
end

function NuiDebugRecordError(message, file, line)
    if not nuiDebugEnabled() then return end
    nuiErrHead = (nuiErrHead % NUI_DEBUG_CAP) + 1
    nuiErrTotal = nuiErrTotal + 1
    nuiErrBuffer[nuiErrHead] = {
        seq = nuiErrTotal, message = tostring(message), file = tostring(file),
        line = tonumber(line), at = GetGameTimer(),
    }
end

local function bufferTail(buffer, head, total, limit)
    limit = math.max(1, math.min(tonumber(limit) or 40, NUI_DEBUG_CAP))
    local out = {}
    local count = math.min(limit, total)
    local start = head - count + 1
    for k = 0, count - 1 do
        local idx = ((start + k - 1) % NUI_DEBUG_CAP) + 1
        if buffer[idx] then out[#out + 1] = buffer[idx] end
    end
    return out
end

exports('GetNuiDebugState', function()
    return {
        instrumented = true,
        debugEnabled = nuiDebugEnabled(),
        focus = { keyboard = IsNuiFocused(), keepInput = IsNuiFocusKeepingInput() },
        uiOpen = isOpen,
        currentScreen = currentScreen,
        focusOwner = focusOwner,
        openPanels = (function()
            -- 'openPanels' = visible modal overlays known to sunset_ui state.
            local out = {}
            if isOpen and currentScreen then out[#out + 1] = currentScreen end
            if focusOwner then out[#out + 1] = 'focus:' .. tostring(focusOwner) end
            return out
        end)(),
        lastMessage = nuiMsgBuffer[nuiMsgHead],
        lastCallback = nuiCbBuffer[nuiCbHead],
    }
end)

exports('GetNuiDebugHistory', function(limit)
    return {
        messages = bufferTail(nuiMsgBuffer, nuiMsgHead, nuiMsgTotal, limit),
        callbacks = bufferTail(nuiCbBuffer, nuiCbHead, nuiCbTotal, limit),
    }
end)

exports('GetNuiDebugErrors', function(limit)
    return bufferTail(nuiErrBuffer, nuiErrHead, nuiErrTotal, limit)
end)

-- ═══════════════════════════════════════════════════════════════
--  [NUI PERF] Payload size instrumentation. Gated by sv_sunset_nuidebug=1
--  (the convar is cached for 5s so production Send() pays one GetGameTimer).
--  warn >100KB, severe >500KB, critical >1MB. /nuistats (admin ACE) prints
--  the 20 largest actions by max payload size.
-- ═══════════════════════════════════════════════════════════════
local NUI_PAYLOAD_WARN, NUI_PAYLOAD_SEVERE, NUI_PAYLOAD_CRIT = 100 * 1024, 500 * 1024, 1024 * 1024
local nuiPayloadStats = {}
local nuiDebugCache, nuiDebugCacheAt = false, -10000

local function nuiPayloadDebugOn()
    local now = GetGameTimer()
    if now - nuiDebugCacheAt > 5000 then
        nuiDebugCacheAt = now
        nuiDebugCache = nuiDebugEnabled()
    end
    return nuiDebugCache
end

local function nuiRecordPayload(action, data)
    if not nuiPayloadDebugOn() then return end
    local ok, enc = pcall(json.encode, data or {})
    if not ok or not enc then return end
    local size = #enc
    local key = tostring(action)
    local st = nuiPayloadStats[key]
    if not st then
        st = { count = 0, total = 0, max = 0 }
        nuiPayloadStats[key] = st
    end
    st.count = st.count + 1
    st.total = st.total + size
    st.last = size
    if size > st.max then st.max = size end
    if size > NUI_PAYLOAD_WARN then
        local level, color = 'WARN', '^3'
        if size > NUI_PAYLOAD_CRIT then level, color = 'CRITICAL', '^1'
        elseif size > NUI_PAYLOAD_SEVERE then level, color = 'SEVERE', '^1' end
        print(('%s[NUI-PAYLOAD %s]^7 action=%s size=%.1fKB'):format(color, level, key, size / 1024))
    end
end

RegisterNetEvent('sunset_ui:client:nuiStats', function()
    if not nuiDebugEnabled() then
        print('^3[NUI-STATS]^7 disabled: set `setr sv_sunset_nuidebug 1` to collect payload stats.')
        return
    end
    local rows = {}
    for action, st in pairs(nuiPayloadStats) do
        rows[#rows + 1] = { action = action, max = st.max, avg = st.total / math.max(st.count, 1), count = st.count, total = st.total }
    end
    table.sort(rows, function(a, b) return a.max > b.max end)
    print('^5[NUI-STATS]^7 top 20 actions by max payload (KB): max | avg | count | total')
    for i = 1, math.min(20, #rows) do
        local r = rows[i]
        print(('  %2d. %-32s %8.1f | %8.1f | %6d | %9.1f'):format(i, r.action, r.max / 1024, r.avg / 1024, r.count, r.total / 1024))
    end
    if #rows == 0 then print('  (no payloads recorded yet)') end
end)

-- Optional health check: ping the page every 30s while debug is on and only log
-- when the pong is late (>2s) or missing. Never changes behavior.
local nuiPingId, nuiPingSentAt, nuiPongAt = 0, 0, 0
RegisterNUICallback('nuiPong', function(data, cb)
    nuiPongAt = GetGameTimer()
    cb('ok')
end)
CreateThread(function()
    while true do
        Wait(30000)
        if nuiPayloadDebugOn() then
            if nuiPingSentAt > 0 and nuiPongAt < nuiPingSentAt then
                print(('^1[NUI-PING]^7 no pong for ping #%d after %dms (NUI page frozen or not loaded)'):format(nuiPingId, GetGameTimer() - nuiPingSentAt))
            elseif nuiPingSentAt > 0 and (nuiPongAt - nuiPingSentAt) > 2000 then
                print(('^3[NUI-PING]^7 slow pong %dms'):format(nuiPongAt - nuiPingSentAt))
            end
            nuiPingId = nuiPingId + 1
            nuiPingSentAt = GetGameTimer()
            SendNUIMessage({ action = 'nuiPing', data = { id = nuiPingId } })
        end
    end
end)

function Send(action, data)
    NuiDebugRecordMessage(action)
    nuiRecordPayload(action, data)
    SendNUIMessage({
        action = action,
        data = data or {},
    })
end
exports('Send', Send)

-- ── Shared job HUD (web/js/job-hud.js) ────────────────────────────────
-- JobHud(data): title, objective, tone, key, progress{current,total}|pct, distance(m),
-- earnings, timer{seconds,dir}, timerLabel, vehicle, keyHints[{key,label}], patch.
-- Identical consecutive payloads are dropped so loops may call it freely.
local jobHudKey = nil
local jobHudShown = false
local jobHudResultUntil = 0

function JobHud(data)
    if type(data) ~= 'table' then return end
    local ok, key = pcall(json.encode, data)
    if ok and key == jobHudKey then return end
    jobHudKey = ok and key or nil
    jobHudShown = true
    jobHudResultUntil = 0
    Send('jobHud', data)
end
exports('JobHud', JobHud)

-- kind: 'success' | 'fail' | 'cancel'; also clears the live card.
function JobHudResult(data)
    data = type(data) == 'table' and data or {}
    jobHudKey = nil
    jobHudShown = true
    jobHudResultUntil = GetGameTimer() + math.min(math.max(tonumber(data.ttl) or 5000, 1500), 15000)
    Send('jobHudResult', data)
end
exports('JobHudResult', JobHudResult)

-- A result card is not wiped by routine cleanup clears; pass force=true to override.
function JobHudClear(force)
    if not force and GetGameTimer() < jobHudResultUntil then return end
    jobHudResultUntil = 0
    jobHudKey = nil
    if not jobHudShown then return end
    jobHudShown = false
    Send('jobHudClear', {})
end
exports('JobHudClear', JobHudClear)

function ShowTransition(text)
    transitionVisible = false
    Send('transitionShow', { text = text or 'Loading character...' })
end
exports('ShowTransition', ShowTransition)

function HideTransition()
    transitionVisible = false
    Send('transitionHide', {})
end
exports('HideTransition', HideTransition)

function IsTransitionVisible()
    return transitionVisible
end
exports('IsTransitionVisible', IsTransitionVisible)

RegisterNUICallback('transitionRendered', function(_, cb)
    transitionVisible = true
    NuiDebugRecordCallback('transitionRendered')
    cb('ok')
end)

RegisterNUICallback('uiStageReady', function(data, cb)
    NuiDebugRecordCallback('uiStageReady:' .. tostring(data and data.stage or 'unknown'))
    cb('ok')
end)

RegisterNUICallback('gameplayVisible', function(_, cb)
    transitionVisible = false
    NuiDebugRecordCallback('gameplayVisible')
    TriggerEvent('sunset:client:gameplayVisible')
    cb('ok')
end)

-- ═══════════════════════════════════════════════════════════════
--  [BOOT TRACE v2] Epoch calibration bridge.
--  The NUI (app.js) posts 'bootEpoch' with Date.now() when it parses;
--  we pair it with GetGameTimer() at receipt so any Lua resource can
--  convert to absolute epoch-ms and correlate with JS-side traces.
-- ═══════════════════════════════════════════════════════════════
local nuiEpochOffset = nil -- Date.now() - GetGameTimer()

RegisterNUICallback('bootEpoch', function(data, cb)
    local dateNow = tonumber(type(data) == 'table' and data.now)
    if dateNow and dateNow > 0 then
        nuiEpochOffset = dateNow - GetGameTimer()
        print(('^5[BOOT %d]^7 nui: bootEpoch calibrated (offset=%d)'):format(dateNow, nuiEpochOffset))
    end
    cb('ok')
end)

function GetBootEpoch()
    if not nuiEpochOffset then return nil end
    return GetGameTimer() + nuiEpochOffset
end
exports('GetBootEpoch', GetBootEpoch)

function HideHudChrome()
    Send('hudChromeHide', { show = false })
end
exports('HideHudChrome', HideHudChrome)

function ShowHudChrome()
    Send('hudChromeHide', { show = true })
end
exports('ShowHudChrome', ShowHudChrome)

function IsOpen()
    return isOpen
end
exports('IsOpen', IsOpen)

function MarkGameplayEntered()
    isOpen = false
    currentScreen = nil
    focusOwner = nil
end
exports('MarkGameplayEntered', MarkGameplayEntered)

local FRIENDLY_ERRORS = {
    ['nil'] = 'That action could not be completed. Please try again; if it repeats, report what you clicked.',
    ['error'] = 'That action stopped unexpectedly. Try again once; if it repeats, report the command or button you used.',
    ['failed'] = 'That action did not complete. Check the requirement shown in /help, your target ID and your distance, then try again.',
    ['cannot use item'] = 'This item cannot be used in your current situation. Check the requirement shown in your inventory.',
    ['no permission'] = 'Your current job, faction rank, duty state, or admin level does not unlock this action. Open /help to see commands available to you.',
    ['not on duty or no permission'] = 'This action requires the correct faction, rank, and an active duty shift. Go to your faction HQ, start duty, then check /help.',
    ['player not found'] = 'That server ID is not online. Hold Z and use the ID currently shown there.',
    ['no character'] = 'Your character is not loaded. Reconnect and select your character again.',
    ['no character loaded'] = 'Your character is not loaded. Reconnect and select your character again.',
    ['character error'] = 'A required character is no longer available. Refresh and try again.',
    ['not found'] = 'That entry no longer exists. Refresh the menu and try again.',
    ['unavailable'] = 'That system is currently unavailable. Try once more; if it repeats, report the command or button to staff.',
    ['invalid action'] = 'That button/action is no longer valid for the current screen. Close the menu, reopen it, and try again.',
    ['invalid amount'] = 'Enter a positive numeric amount within the limit shown by this system.',
    ['invalid target'] = 'Choose another online player and use the current server ID shown when holding Z.',
    ['invalid player'] = 'That server ID is not online. Hold Z and use the ID currently shown there.',
    ['call not found'] = 'That service call was closed, cancelled, or taken already. Refresh the call list.',
    ['could not accept call'] = 'That service call could not be assigned, usually because another responder took it. Refresh the call list.',
    ['rank too low'] = 'Your current faction rank does not unlock this action. Open /help to see commands available to your rank.',
    ['not on duty'] = 'This action requires an active duty shift. Go to your faction HQ and press E or use /duty.',
    ['must be on duty'] = 'This action requires an active duty shift. Go to your faction HQ and press E or use /duty.',
    ['wrong faction'] = 'This action belongs to a different faction. Open /faction to check your membership.',
}

local function friendlyMessage(message)
    if message == nil or message == false then return FRIENDLY_ERRORS['nil'] end
    local text = tostring(message)
    if text == '' then return FRIENDLY_ERRORS['nil'] end
    return FRIENDLY_ERRORS[string.lower(text)] or text
end

function Notify(message, type, duration)
    SendNUIMessage({
        action = 'notify',
        message = friendlyMessage(message),
        type = type or 'info',
        duration = duration or 4000,
    })
end
exports('Notify', Notify)

-- One canonical listener prevents every server notification from being rendered
-- once per unrelated client resource.
RegisterNetEvent('sunset:client:notify', function(message, notificationType, duration)
    Notify(message, notificationType, duration)
end)

function ProgressBar(label, duration, cb)
    SendNUIMessage({
        action = 'progress',
        label = label,
        duration = duration,
    })
    if cb then
        SetTimeout(duration, cb)
    end
end
exports('ProgressBar', ProgressBar)

RegisterNUICallback('close', function(_, cb)
    Hide()
    cb('ok')
end)

RegisterNUICallback('playSound', function(data, cb)
    PlaySoundFrontend(-1, data.sound or 'SELECT', data.set or 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
    cb('ok')
end)

RegisterNUICallback('loadingTimeout', function(_, cb)
    if currentScreen == 'loading' then
        Hide()
        DoScreenFadeIn(500)
        Notify(exports.sunset_core:Translate('ui.message.character_loading_took_too_long_your_controls_were_restored'), 'error', 8000)
        TriggerEvent('sunset:client:loadingTimedOut')
    end
    cb('ok')
end)

-- [NUI FOCUS] Central safety net: any 'force close' (death, admin, jail) releases
-- focus regardless of owner, except while the login screen legitimately owns it.
AddEventHandler('sunset:ui:forceCloseAll', function()
    if isOpen and currentScreen == 'auth' then return end
    SetFocus(false, false, false, 'force')
end)

RegisterCommand('fixnui', function()
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    isOpen = false
    currentScreen = nil
    focusOwner = nil
    SendNUIMessage({ action = 'hide' })
    if GetResourceState('sunset_auth') == 'started' then
        TriggerEvent('sunset:auth:openLogin')
    end
    Notify(exports.sunset_core:Translate('ui.message.ui_reset_login_reopened_if_you_were_still_on'), 'success')
end, false)

RegisterCommand('cursor', function()
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    focusOwner = nil
    Notify(exports.sunset_core:Translate('ui.message.cursorul_a_fost_resetat'), 'info')
end, false)

-- [AUDIT NUI-ERR] Forward JS errors to server logs so staff can diagnose
-- NUI crashes without requiring the player to share F8 output.
RegisterNUICallback('nuiError', function(data, cb)
    data = type(data) == 'table' and data or {}
    local msg = tostring(data.message or 'unknown JS error'):sub(1, 300)
    local src = tostring(data.source or ''):sub(1, 120)
    local stack = tostring(data.stack or ''):sub(1, 400)
    local errType = tostring(data.type or 'onerror')
    NuiDebugRecordError(msg, src, data.lineno)
    print(('^1[NUI-ERROR type=%s]^7 %s | source=%s:%s | stack: %s'):format(
        errType, msg, src, tostring(data.lineno or '?'), stack))
    TriggerServerEvent('sunset:server:nuiError', errType, msg, src, data.lineno)
    cb('ok')
end)

CreateThread(function()
    local lastPauseState = nil
    while true do
        local paused = IsPauseMenuActive() or IsScreenFadedOut()
        if paused ~= lastPauseState then
            lastPauseState = paused
            Send('pauseState', { paused = paused })
        end
        Wait(paused and 50 or 150)
    end
end)

-- [CLIENT_PERF_ENTITY_AUDIT] Never leave the cursor/keyboard captured if the UI
-- resource restarts.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    focusOwner = nil
end)
