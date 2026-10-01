-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release)
-- while executing native SetNuiFocus locally inside sunset_pass so this resource's
-- CEF iframe receives the mouse and keyboard input.
function PASS_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if hasFocus then
        local ok = false
        if GetResourceState('sunset_ui') == 'started' then
            local pOk, claimRes = pcall(function()
                return exports.sunset_ui:ClaimFocus('pass')
            end)
            ok = pOk and claimRes == true
        else
            ok = true
        end
        if not ok then return false end
        SetNuiFocus(true, hasCursor == true)
        SetNuiFocusKeepInput(keepInput == true)
        return true
    else
        if GetResourceState('sunset_ui') == 'started' then
            pcall(function() exports.sunset_ui:ReleaseFocus('pass') end)
        end
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
        return true
    end
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

RegisterNUICallback('emergencyEscape', function(_, cb)
    closePass()
    TriggerEvent('sunset:ui:emergencyClose', 'pass_nui_hold_esc')
    cb({ ok = true })
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
exports('IsPassOpen', function() return isOpen end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    if isOpen then closePass() end
end)

AddEventHandler('sunset:ui:emergencyClose', function()
    if isOpen then closePass() end
end)
