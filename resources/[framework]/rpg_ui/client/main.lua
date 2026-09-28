local focusOwner = nil
local ready = false
local queued = {}

local function send(payload)
    if not ready then queued[#queued + 1] = payload return end
    SendNUIMessage(payload)
end

function AcquireFocus(owner, cursor, keepInput)
    if type(owner) ~= 'string' or owner == '' then return false, 'Invalid focus owner.' end
    if focusOwner ~= nil and focusOwner ~= owner then
        return false, ('Focus is already held by %s.'):format(focusOwner)
    end
    focusOwner = owner
    SetNuiFocus(true, cursor ~= false)
    SetNuiFocusKeepInput(keepInput == true)
    return true
end

function ReleaseFocus(owner)
    if owner and focusOwner ~= owner then return false end
    focusOwner = nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    return true
end

function ForceResetFocus(reason)
    focusOwner = nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    send({ action = 'hideAll' })
    return true
end

function Show(panel, data)
    send({ action = 'show', panel = panel, data = data or {} })
end

function Hide(panel)
    send({ action = 'hide', panel = panel })
end

function Notify(message, kind, duration)
    local payload = type(message) == 'table' and message or { message = message, kind = kind, duration = duration }
    send({ action = 'notify', data = payload })
end

RegisterNUICallback('ready', function(_, cb)
    ready = true
    for _, payload in ipairs(queued) do SendNUIMessage(payload) end
    queued = {}
    TriggerServerEvent('rpg:core:clientReady')
    cb({ ok = true })
end)

RegisterNUICallback('authRendered', function(_, cb)
    ShutdownLoadingScreen()
    ShutdownLoadingScreenNui()
    AcquireFocus('auth', true, false)
    cb({ ok = true })
end)

RegisterNUICallback('authLogin', function(data, cb)
    if GetResourceState('rpg_auth') ~= 'started' then cb({ ok = false, error = 'Authentication is unavailable.' }) return end
    local result, err = exports.rpg_auth:Login(data)
    cb(result and { ok = true } or { ok = false, error = err })
end)

RegisterNUICallback('authRegister', function(data, cb)
    if GetResourceState('rpg_auth') ~= 'started' then cb({ ok = false, error = 'Authentication is unavailable.' }) return end
    local result, err = exports.rpg_auth:Register(data)
    cb(result and { ok = true } or { ok = false, error = err })
end)

RegisterNUICallback('chatSubmit', function(data, cb)
    TriggerEvent('rpg:chat:submit', data and data.value or '')
    cb({ ok = true })
end)

RegisterNUICallback('chatClose', function(_, cb)
    TriggerEvent('rpg:chat:close')
    cb({ ok = true })
end)

RegisterNUICallback('cinematicComplete', function(_, cb)
    TriggerEvent('rpg:spawn:cinematicComplete')
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

RegisterNetEvent('rpg:ui:debugui', function()
    ExecuteCommand('debugui')
end)

RegisterCommand('debugui', function()
    local ped = PlayerPedId()
    local coords = ped ~= 0 and GetEntityCoords(ped) or vector3(0,0,0)
    local msg = ('[DEBUG] active=%s focus=%s ped=%d coords=%.1f,%.1f,%.1f'):format(
        tostring(LocalPlayer.state['rpg:active']),
        tostring(focusOwner),
        ped,
        coords.x, coords.y, coords.z
    )
    print(msg)
    Notify(msg, 'info')
end, false)

exports('AcquireFocus', AcquireFocus)
exports('ReleaseFocus', ReleaseFocus)
exports('ForceResetFocus', ForceResetFocus)
exports('GetFocusOwner', function() return focusOwner end)
exports('Show', Show)
exports('Hide', Hide)
exports('Notify', Notify)
