-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release).
function PASS_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if GetResourceState('sunset_ui') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_ui:SetFocus(hasFocus, hasCursor, keepInput == true, 'pass')
    end)
    return ok and res ~= false
end

local openTab = 'rewards'
local isOpen = false

local function notify(message, kind)
    TriggerEvent('sunset:client:notify', message, kind or 'info', 5000)
end

local function errorText(err, fallbackKey)
    if type(err) == 'table' and type(err.localeKey) == 'string' then
        return exports.sunset_core:Translate(err.localeKey, err.params or err.formatArgs)
    end
    if type(err) == 'string' and err ~= '' then return err end
    return exports.sunset_core:Translate(fallbackKey)
end

local function send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

local function setFocus(state)
    PASS_SetNuiFocus(state, state)
    end

local function closePass()
    if not isOpen then return end
    isOpen = false
    setFocus(false)
    send('passHide', {})
end

local function openPass(tab)
    if isOpen then
        openTab = tab or openTab
        send('passSetTab', { tab = openTab })
        return
    end
    if IsNuiFocused() and not isOpen then return end

    local data, err = Sunset.AwaitCallback('sunset:pass:getData')
    if not data then
        notify(errorText(err, 'pass.message.load_failed'), 'error')
        return
    end

    openTab = tab or 'battlepass'
    isOpen = true
    setFocus(true)
    send('passShow', { tab = openTab, state = data })
end

RegisterCommand('pass', function()
    openPass('battlepass')
end, false)

RegisterCommand('battlepass', function()
    openPass('battlepass')
end, false)

RegisterCommand('missions', function()
    openPass('daily')
end, false)


RegisterNUICallback('passClose', function(_, cb)
    closePass()
    cb('ok')
end)

RegisterNUICallback('passSetTab', function(data, cb)
    openTab = (data and data.tab) or openTab
    cb('ok')
end)

RegisterNUICallback('passClaim', function(data, cb)
    local result, err = Sunset.AwaitCallback('sunset:pass:claim', data)
    if not result then
        notify(errorText(err, 'pass.message.claim_failed'), 'error')
        cb({ ok = false })
        return
    end
    send('passUpdate', { state = result })
    cb({ ok = true, state = result })
end)

RegisterNUICallback('passBuyPremium', function(_, cb)
    local result, err = Sunset.AwaitCallback('sunset:pass:buyPremium')
    if not result then
        local message = errorText(err, 'pass.message.unlock_failed')
        notify(message, 'error')
        cb({ ok = false, error = message })
        return
    end
    send('passUpdate', { state = result })
    cb({ ok = true, state = result })
end)

RegisterNetEvent('sunset:pass:refresh', function()
    if not isOpen then return end
    local data = Sunset.AwaitCallback('sunset:pass:getData')
    if data then send('passUpdate', { state = data }) end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    closePass()
end)

exports('OpenPass', function(tab)
    openPass(tab or 'rewards')
end)

exports('ClosePass', closePass)

-- [NUI FOCUS] Guaranteed close path: release on resource stop / forced UI close.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
    if ok and owner == 'pass' then
        pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'force') end)
    end
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    if isOpen then closePass() end
end)
