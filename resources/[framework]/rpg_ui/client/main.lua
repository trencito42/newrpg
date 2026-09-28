local focusOwner = nil
local ready = false
local queued = {}
local currentPanel = nil

-- Gated debug instrumentation (0 by default in production)
local NUI_DEBUG_CAP = 50
local nuiMsgBuffer, nuiCbBuffer, nuiErrBuffer = {}, {}, {}
local progressCallbacks = {}

local function isDebug()
    return GetConvarInt('rpg_nui_debug', 0) == 1
end

local function recordDebug(buffer, item)
    if not isDebug() then return end
    buffer[#buffer + 1] = item
    if #buffer > NUI_DEBUG_CAP then
        table.remove(buffer, 1)
    end
end

local function send(payload)
    recordDebug(nuiMsgBuffer, { time = GetGameTimer(), payload = payload })
    if not ready then
        queued[#queued + 1] = payload
        return
    end
    SendNUIMessage(payload)
end

function AcquireFocus(owner, cursor, keepInput)
    if type(owner) ~= 'string' or owner == '' then return false, 'Invalid focus owner.' end
    if focusOwner ~= nil and focusOwner ~= owner then
        -- Protected Auth Lease: while auth holds focus, no other system can steal it
        if focusOwner == 'auth' and owner ~= 'auth' and owner ~= 'force' then
            return false, 'Focus is locked by authentication.'
        end
        return false, ('Focus is already held by %s.'):format(focusOwner)
    end
    focusOwner = owner
    SetNuiFocus(true, cursor ~= false)
    SetNuiFocusKeepInput(keepInput == true)
    return true
end

function ReleaseFocus(owner)
    if owner and focusOwner ~= owner and owner ~= 'force' then return false end
    focusOwner = nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    return true
end

function ForceResetFocus(reason)
    focusOwner = nil
    currentPanel = nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    send({ action = 'hideAll' })
    return true
end

function Show(panel, data)
    currentPanel = panel
    send({ action = 'show', panel = panel, data = data or {} })
end

function Hide(panel)
    if currentPanel == panel then currentPanel = nil end
    send({ action = 'hide', panel = panel })
end

function Send(action, data)
    send({ action = action, data = data or {} })
end

function Notify(message, kind, duration)
    local payload = type(message) == 'table' and message or { message = message, kind = kind, duration = duration }
    send({ action = 'notify', data = payload })
end

function Progress(duration, label, onComplete, onCancel)
    local id = ('prog_%d_%d'):format(GetGameTimer(), math.random(1000, 9999))
    progressCallbacks[id] = { onComplete = onComplete, onCancel = onCancel }
    send({
        action = 'progress',
        data = {
            id = id,
            duration = duration or 3000,
            label = label or 'In progress...',
            allowCancel = onCancel ~= nil
        }
    })
    return id
end

function CancelProgress(id)
    if id and progressCallbacks[id] then
        send({ action = 'progressCancel', data = { id = id } })
    else
        send({ action = 'progressCancel' })
    end
end

function IsOpen(panel)
    if panel then return currentPanel == panel end
    return currentPanel ~= nil
end

RegisterNUICallback('ready', function(_, cb)
    ready = true
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'ready' })
    for _, payload in ipairs(queued) do SendNUIMessage(payload) end
    queued = {}
    TriggerServerEvent('rpg:core:clientReady')
    cb({ ok = true })
end)

RegisterNUICallback('authRendered', function(_, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'authRendered' })
    ShutdownLoadingScreen()
    ShutdownLoadingScreenNui()
    AcquireFocus('auth', true, false)
    cb({ ok = true })
end)

RegisterNUICallback('authLogin', function(data, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'authLogin' })
    if GetResourceState('rpg_auth') ~= 'started' then cb({ ok = false, error = 'Authentication is unavailable.' }) return end
    local result, err = exports.rpg_auth:Login(data)
    cb(result and { ok = true } or { ok = false, error = err })
end)

RegisterNUICallback('authRegister', function(data, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'authRegister' })
    if GetResourceState('rpg_auth') ~= 'started' then cb({ ok = false, error = 'Authentication is unavailable.' }) return end
    local result, err = exports.rpg_auth:Register(data)
    cb(result and { ok = true } or { ok = false, error = err })
end)

RegisterNUICallback('chatSubmit', function(data, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'chatSubmit' })
    TriggerEvent('rpg:chat:submit', data and data.value or '')
    cb({ ok = true })
end)

RegisterNUICallback('chatClose', function(_, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'chatClose' })
    TriggerEvent('rpg:chat:close')
    cb({ ok = true })
end)

RegisterNUICallback('progressComplete', function(data, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'progressComplete', data = data })
    local id = data and data.id
    if id and progressCallbacks[id] then
        local cbFn = progressCallbacks[id].onComplete
        progressCallbacks[id] = nil
        if cbFn then pcall(cbFn) end
    end
    cb({ ok = true })
end)

RegisterNUICallback('progressCancel', function(data, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'progressCancel', data = data })
    local id = data and data.id
    if id and progressCallbacks[id] then
        local cbFn = progressCallbacks[id].onCancel
        progressCallbacks[id] = nil
        if cbFn then pcall(cbFn) end
    end
    cb({ ok = true })
end)

RegisterNUICallback('cinematicComplete', function(_, cb)
    recordDebug(nuiCbBuffer, { time = GetGameTimer(), callback = 'cinematicComplete' })
    TriggerEvent('rpg:spawn:cinematicComplete')
    cb({ ok = true })
end)

RegisterNUICallback('nuiError', function(data, cb)
    recordDebug(nuiErrBuffer, { time = GetGameTimer(), error = data })
    if isDebug() then
        print(('[RPG_UI][JS_ERROR] %s: %s (%s:%s)'):format(
            tostring(data.type),
            tostring(data.message),
            tostring(data.filename or 'inline'),
            tostring(data.lineno or 0)
        ))
    end
    cb({ ok = true })
end)

RegisterNetEvent('rpg:ui:notify', function(payload)
    Notify(payload)
end)

RegisterNetEvent('rpg:ui:chatMessage', function(message, kind)
    send({ action = 'chatMessage', data = { message = tostring(message or ''), kind = kind or 'normal' } })
end)

RegisterNetEvent('rpg:ui:chatClear', function()
    send({ action = 'chatClear' })
end)

RegisterNetEvent('rpg:ui:show', function(panel, data) Show(panel, data) end)
RegisterNetEvent('rpg:ui:hide', function(panel) Hide(panel) end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    focusOwner = nil
    currentPanel = nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
end)

local function resetVisualState()
    Hide('auth')
    Hide('cinematic')
    send({ action = 'hideAll' })
    ForceResetFocus('fixscreen')
    TriggerScreenblurFadeOut(0)
    ClearTimecycleModifier()
    ClearExtraTimecycleModifier()
    RenderScriptCams(false, false, 0, true, false)
    DestroyAllCams(true)
    ClearFocus()
    DoScreenFadeIn(500)
end

RegisterCommand('fixscreen', function()
    print('[RPG_UI] Running visual and screen recovery...')
    resetVisualState()
    
    local ped = PlayerPedId()
    local isActive = LocalPlayer.state['rpg:active'] == true
    if isActive then
        if ped and ped ~= 0 then
            SetFocusEntity(ped)
            FreezeEntityPosition(ped, false)
            SetEntityVisible(ped, true, false)
            SetEntityInvincible(ped, false)
        end
        DisplayRadar(true)
        DisplayHud(true)
        TriggerEvent('rpg:core:releaseProtection')
        Notify('Screen, cameras, and UI reset complete.', 'success')
    else
        -- Keep gameplay protection intact if player is not server-side active!
        if ped and ped ~= 0 then
            FreezeEntityPosition(ped, true)
            SetEntityVisible(ped, false, false)
            SetEntityInvincible(ped, true)
        end
        DisplayRadar(false)
        Notify('UI state reset. Please authenticate or wait for spawn.', 'info')
    end
end, false)

RegisterNetEvent('rpg:ui:fixscreen', function()
    ExecuteCommand('fixscreen')
end)

RegisterCommand('fixui', function()
    ExecuteCommand('fixscreen')
end, false)

RegisterCommand('rpg_ui_debug', function()
    local ped = PlayerPedId()
    local coords = ped ~= 0 and GetEntityCoords(ped) or vector3(0,0,0)
    print('========================================')
    print('          RPG_UI DIAGNOSTICS            ')
    print('========================================')
    print(('NUI Ready:       %s'):format(tostring(ready)))
    print(('Focus Owner:     %s'):format(tostring(focusOwner)))
    print(('Current Panel:   %s'):format(tostring(currentPanel)))
    print(('Player Active:   %s'):format(tostring(LocalPlayer.state['rpg:active'])))
    print(('Player Coords:   %.1f, %.1f, %.1f'):format(coords.x, coords.y, coords.z))
    print(('Queued Msgs:     %d'):format(#queued))
    print(('Debug Buffer:    %d msgs, %d cbs, %d errs'):format(#nuiMsgBuffer, #nuiCbBuffer, #nuiErrBuffer))
    print('========================================')
    Notify(('UI Debug: ready=%s focus=%s panel=%s active=%s'):format(
        tostring(ready), tostring(focusOwner), tostring(currentPanel), tostring(LocalPlayer.state['rpg:active'])
    ), 'info')
end, false)

exports('AcquireFocus', AcquireFocus)
exports('ReleaseFocus', ReleaseFocus)
exports('ForceResetFocus', ForceResetFocus)
exports('GetFocusOwner', function() return focusOwner end)
exports('IsOpen', IsOpen)
exports('Show', Show)
exports('Hide', Hide)
exports('Send', Send)
exports('Notify', Notify)
exports('Progress', Progress)
exports('CancelProgress', CancelProgress)
