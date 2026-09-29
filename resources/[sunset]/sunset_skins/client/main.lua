local shopOpen = false
local shopNPC  = nil

-- Apply a GTA ped model to the local player
local function applyModel(model)
    local hash
    if not model or model == '' or model == 'default' or model == 'reset' then
        local gender = (Sunset and Sunset.Character and Sunset.Character.gender) or 'male'
        hash = joaat(gender == 'female' and 'mp_f_freemode_01' or 'mp_m_freemode_01')
    else
        hash = joaat(model)
    end

    if not IsModelValid(hash) then
        exports.sunset_ui:Notify('Invalid skin model: ' .. tostring(model), 'error', 5000)
        return
    end

    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) and t < 100 do
        Wait(50)
        t = t + 1
    end
    if not HasModelLoaded(hash) then
        exports.sunset_ui:Notify('Could not load skin model', 'error', 4000)
        return
    end

    SetPlayerModel(PlayerId(), hash)
    SetPedDefaultComponentVariation(PlayerPedId())
    SetModelAsNoLongerNeeded(hash)
end

-- Open the skin shop via sunset_ui
local function openShop(defaultCat)
    if shopOpen then return end
    local skins, err = Sunset.AwaitCallback('skins:getAll')
    if not skins then
        exports.sunset_ui:Notify(err or 'Could not load skins', 'error', 5000)
        return
    end
    shopOpen = true
    exports.sunset_ui:Send('skinShopShow', { skins = skins, defaultCat = defaultCat or 'owned' })
    exports.sunset_ui:SetFocus(true, true, false, 'skinshop')
end

local function closeShop()
    if not shopOpen then return end
    shopOpen = false
    exports.sunset_ui:Send('skinShopHide', {})
    exports.sunset_ui:SetFocus(false, false, false, 'skinshop')
end

-- sunset_ui NUI bridge: buy
AddEventHandler('sunset:nui:skinShopBuy', function(data)
    data = type(data) == 'table' and data or {}
    local result, err = Sunset.AwaitCallback('skins:buy', data.model, data.currency)
    if result then
        exports.sunset_ui:Notify('Skin purchased!', 'success', 4000)
        local skins = Sunset.AwaitCallback('skins:getAll')
        exports.sunset_ui:Send('skinShopUpdate', { skins = skins or {} })
    else
        exports.sunset_ui:Notify(err or 'Purchase failed', 'error', 5000)
    end
end)

-- sunset_ui NUI bridge: equip
AddEventHandler('sunset:nui:skinShopEquip', function(data)
    data = type(data) == 'table' and data or {}
    local result, err = Sunset.AwaitCallback('skins:equip', data.model)
    if result then
        if data.model == 'default' or data.model == '' then
            exports.sunset_ui:Notify('Restored original character appearance!', 'success', 3000)
        else
            exports.sunset_ui:Notify('Skin equipped!', 'success', 3000)
        end
    else
        exports.sunset_ui:Notify(err or 'Equip failed', 'error', 5000)
    end
end)

-- sunset_ui NUI bridge: close (SetFocus handled by nui_bridge.lua forward)
AddEventHandler('sunset:nui:skinShopClose', function()
    if not shopOpen then return end
    shopOpen = false
end)

-- Server → client: apply model (used by /setskin and battlepass unlock)
RegisterNetEvent('sunset:skins:applyModel')
AddEventHandler('sunset:skins:applyModel', function(model)
    applyModel(model)
    -- SetPlayerModel resets NUI focus; re-apply it if the shop is still open
    if shopOpen then
        Wait(100)
        exports.sunset_ui:SetFocus(true, true, false, 'skinshop')
    end
end)

-- Server → client: generic notification (giveskin, battlepass)
RegisterNetEvent('sunset:skins:notify')
AddEventHandler('sunset:skins:notify', function(msg)
    exports.sunset_ui:Notify(msg or '', 'success', 5500)
end)

-- Character loaded / relog: restore active skin from character metadata
AddEventHandler('sunset:client:onCharacterLoaded', function(charData)
    local meta = charData and charData.metadata
    if type(meta) == 'string' then
        local ok, decoded = pcall(json.decode, meta)
        meta = ok and decoded or {}
    end
    if meta and meta.skin and meta.skin ~= '' and meta.skin ~= 'default' and meta.skin ~= 'reset' then
        CreateThread(function()
            Wait(1200)
            applyModel(meta.skin)
        end)
    end
end)

-- /skins & /myskins — opens wardrobe showing owned skins
RegisterCommand('skins', function()
    openShop('owned')
end, false)

RegisterCommand('myskins', function()
    openShop('owned')
end, false)

TriggerEvent('chat:addSuggestion', '/skins', 'Open wardrobe to view and equip your owned skins')
TriggerEvent('chat:addSuggestion', '/myskins', 'Open wardrobe to view and equip your owned skins')

-- Spawn NPC at the configured location
CreateThread(function()
    local cfg    = SunsetSkins.ShopNPC
    local model  = joaat(cfg.model)

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(200) end

    local cx, cy, cz, cw = cfg.coords.x, cfg.coords.y, cfg.coords.z, cfg.coords.w
    shopNPC = CreatePed(4, model, cx, cy, cz - 1.0, cw, false, true)
    SetEntityInvincible(shopNPC, true)
    SetBlockingOfNonTemporaryEvents(shopNPC, true)
    FreezeEntityPosition(shopNPC, true)
    SetModelAsNoLongerNeeded(model)

    local blip = AddBlipForCoord(cx, cy, cz)
    SetBlipSprite(blip, cfg.blip.sprite)
    SetBlipColour(blip, cfg.blip.color)
    SetBlipScale(blip, cfg.blip.scale)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(cfg.blip.label)
    EndTextCommandSetBlipName(blip)

    -- Proximity loop: show [E] prompt and handle interaction
    while true do
        Wait(0)
        local pos  = GetEntityCoords(PlayerPedId())
        local dist = #(pos - vector3(cx, cy, cz))

        if dist < 3.0 then
            local onScreen, sx, sy = World3dToScreen2d(cx, cy, cz + 1.0)
            if onScreen then
                SetTextScale(0.35, 0.35)
                SetTextFont(4)
                SetTextProportional(1)
                SetTextColour(255, 255, 255, 220)
                SetTextEntry('STRING')
                SetTextCentre(1)
                AddTextComponentString('[E] Skin Shop')
                DrawText(sx, sy)
            end
            if IsControlJustPressed(0, 38) and not shopOpen then
                openShop()
            end
        end
    end
end)
