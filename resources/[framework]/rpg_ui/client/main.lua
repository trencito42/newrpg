local focusOwner = nil
local ready = false
local queued = {}

local function send(payload)
    if not ready then queued[#queued + 1] = payload return end
    SendNUIMessage(payload)
end

function AcquireFocus(owner, cursor, keepInput)
    if type(owner) ~= 'string' or owner == '' then return false, 'Invalid focus owner.' end
    if focusOwner and focusOwner ~= owner then
        return false, ('Focus is owned by %s.'):format(focusOwner)
    end
    focusOwner = owner
    SetNuiFocus(true, cursor ~= false)
    SetNuiFocusKeepInput(keepInput == true)
    return true
end

function ReleaseFocus(owner)
    if focusOwner ~= owner then return false end
    focusOwner = nil
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
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

exports('AcquireFocus', AcquireFocus)
exports('ReleaseFocus', ReleaseFocus)
exports('GetFocusOwner', function() return focusOwner end)
exports('Show', Show)
exports('Hide', Hide)
exports('Notify', Notify)
