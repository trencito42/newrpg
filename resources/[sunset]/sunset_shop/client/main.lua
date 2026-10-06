-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — client/main.lua
--  NUI host for the Racket Shop (standalone ui_page, like sunset_pass).
--  Focus ownership goes through the central sunset_ui manager
--  (ClaimFocus/ReleaseFocus, owner 'shop'); the native focus call targets
--  this resource's own CEF frame. Close paths: ESC (NUI), close button,
--  /shop toggle, sunset:ui:forceCloseAll (death), emergency escape and
--  onResourceStop.
-- ═══════════════════════════════════════════════════════════════

local FOCUS_OWNER = 'shop'
local isOpen = false

local function shopSetNuiFocus(hasFocus)
    if hasFocus then
        if GetResourceState('sunset_ui') == 'started' then
            local ok, claimed = pcall(function() return exports.sunset_ui:ClaimFocus(FOCUS_OWNER) end)
            if not ok or claimed ~= true then return false end
        end
        SetNuiFocus(true, true)
        SetNuiFocusKeepInput(false)
        return true
    end
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:ReleaseFocus(FOCUS_OWNER) end)
    end
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    return true
end

local function send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

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

local function closeShop()
    if not isOpen then return end
    isOpen = false
    shopSetNuiFocus(false)
    send('shopHide', {})
end

local function openShop()
    if isOpen then return end
    -- Never steal focus from another modal (inventory, phone, auth...).
    if IsNuiFocused() then return end
    if GetResourceState('sunset_ui') == 'started' then
        local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
        if ok and owner and owner ~= FOCUS_OWNER then return end
    end

    local data, err = Sunset.AwaitCallback('sunset:shop:getProducts')
    if not data then
        notify(errorText(err, 'shop.message.load_failed'), 'error')
        return
    end
    if not shopSetNuiFocus(true) then return end
    isOpen = true
    send('shopShow', data)
end

RegisterCommand('shop', function()
    if isOpen then closeShop() else openShop() end
end, false)

AddEventHandler('sunset:shop:open', function()
    openShop()
end)

-- ═══ NUI callbacks ═══

RegisterNUICallback('shopOpen', function(_, cb)
    local data, err = Sunset.AwaitCallback('sunset:shop:getProducts')
    if not data then
        cb({ ok = false, error = errorText(err, 'shop.message.load_failed') })
        return
    end
    cb({ ok = true, state = data })
end)

RegisterNUICallback('shopClose', function(_, cb)
    closeShop()
    cb({ ok = true })
end)

RegisterNUICallback('shopPurchase', function(data, cb)
    data = type(data) == 'table' and data or {}
    -- Only identifiers and the declared input travel to the server; the server
    -- resolves price, reward and eligibility from its own registry.
    local params = type(data.params) == 'table' and data.params or {}
    local result, err = Sunset.AwaitCallback('sunset:shop:purchase', {
        productId = data.productId,
        requestId = data.requestId,
        params = { tag = params.tag, color = params.color },
    })
    if not result then
        cb({ ok = false, error = errorText(err, 'shop.purchase.failed') })
        return
    end
    cb({ ok = true, result = result })
end)

RegisterNUICallback('shopOpenTopUp', function(data, cb)
    data = type(data) == 'table' and data or {}
    local url = 'https://racket.cat/shop/coins'
    if type(data.url) == 'string' and data.url:match('^https://racket%.cat/') then
        url = data.url
    end
    cb({ ok = true, url = url })
end)

RegisterNUICallback('shopGetHistory', function(_, cb)
    local rows, err = Sunset.AwaitCallback('sunset:shop:getHistory')
    if not rows then
        cb({ ok = false, error = errorText(err, 'shop.message.load_failed') })
        return
    end
    cb({ ok = true, orders = rows })
end)

RegisterNUICallback('shopUseNameChange', function(data, cb)
    data = type(data) == 'table' and data or {}
    local result, err = Sunset.AwaitCallback('sunset:shop:consumeNameChange', {
        nickname = data.nickname,
    })
    if not result then
        cb({ ok = false, error = errorText(err, 'shop.name_change.failed') })
        return
    end
    cb({ ok = true, result = result })
end)

RegisterNUICallback('shopUseClanNameChange', function(data, cb)
    data = type(data) == 'table' and data or {}
    local result, err = Sunset.AwaitCallback('sunset:shop:consumeClanNameChange', { name = data.name })
    if not result then
        cb({ ok = false, error = errorText(err, 'shop.purchase.failed') })
        return
    end
    cb({ ok = true, result = result })
end)

RegisterNUICallback('emergencyEscape', function(_, cb)
    closeShop()
    TriggerEvent('sunset:ui:emergencyClose', 'shop_nui_hold_esc')
    cb({ ok = true })
end)

RegisterNetEvent('sunset:shop:balance', function(balance)
    if isOpen then send('shopBalance', { balance = tonumber(balance) or 0 }) end
end)

-- ═══ Guaranteed close paths ═══

AddEventHandler('sunset:ui:forceCloseAll', function()
    if isOpen then closeShop() end
end)

AddEventHandler('sunset:ui:emergencyClose', function()
    if isOpen then closeShop() end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if isOpen then
        isOpen = false
        shopSetNuiFocus(false)
    end
end)

exports('OpenShop', openShop)
exports('CloseShop', closeShop)
exports('IsShopOpen', function() return isOpen end)
