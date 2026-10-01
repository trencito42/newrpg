local shopOpen = false
local shopNPC  = nil
local shopBlip = nil

local function updateShopBlipName()
    if not shopBlip or not DoesBlipExist(shopBlip) then return end
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(exports.sunset_core:Translate(SunsetSkins.ShopNPC.blip.labelKey))
    EndTextCommandSetBlipName(shopBlip)
end

AddEventHandler('sunset:client:onLocaleChanged', updateShopBlipName)

-- Apply a GTA ped model to the local player (RUNTIME changes only — NOT during spawn)
local function applyModel(model)
    local hash
    local isReset = not model or model == '' or model == 'default' or model == 'reset'
    local char = exports.sunset_core:GetCharacter()
    local gender = (char and tonumber(char.gender)) or (Sunset and Sunset.Character and tonumber(Sunset.Character.gender)) or 0
    if isReset then
        local isFemale = gender == 1 or gender == '1' or gender == 'female'
        hash = joaat(isFemale and 'mp_f_freemode_01' or 'mp_m_freemode_01')
    else
        hash = joaat(model)
    end

    if not IsModelValid(hash) then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.invalid_skin_model') .. tostring(model), 'error', 5000)
        return
    end

    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) and t < 100 do
        Wait(50)
        t = t + 1
    end
    if not HasModelLoaded(hash) then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.could_not_load_skin_model'), 'error', 4000)
        return
    end

    SetPlayerModel(PlayerId(), hash)
    SetPedDefaultComponentVariation(PlayerPedId())
    SetModelAsNoLongerNeeded(hash)
    TriggerServerEvent('sunset:server:updatePlayerPed')

    if isReset or hash == `mp_m_freemode_01` or hash == `mp_f_freemode_01` then
        if char and char.appearance and GetResourceState('sunset_appearance') == 'started' then
            exports.sunset_appearance:ApplyAppearance(PlayerPedId(), char.appearance, gender)
        end
    end
end

-- Open the skin shop via sunset_ui
local function openShop(defaultCat)
    if shopOpen then return end
    local skins, err = Sunset.AwaitCallback('skins:getAll')
    if not skins then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('skins.message.load_failed'), 'error', 5000)
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
        exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.skin_purchased'), 'success', 4000)
        local skins = Sunset.AwaitCallback('skins:getAll')
        exports.sunset_ui:Send('skinShopUpdate', { skins = skins or {} })
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('skins.message.purchase_failed'), 'error', 5000)
    end
end)

-- sunset_ui NUI bridge: equip
AddEventHandler('sunset:nui:skinShopEquip', function(data)
    data = type(data) == 'table' and data or {}
    local result, err = Sunset.AwaitCallback('skins:equip', data.model)
    if result then
        if data.model == 'default' or data.model == '' then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.restored_original_character_appearance'), 'success', 3000)
        else
            exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.skin_equipped'), 'success', 3000)
        end
    else
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('skins.message.equip_failed'), 'error', 5000)
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

-- Post-spawn sanity check: verify the model matches what metadata says.
-- sunset_spawn is the sole owner of SetPlayerModel during login; it already
-- reads meta.skin via resolveModel().  We only log a warning here — we never
-- call SetPlayerModel during spawn flow.
AddEventHandler('sunset:client:playerSpawned', function(charData)
    local meta = charData and charData.metadata
    if type(meta) == 'string' then
        local ok, decoded = pcall(json.decode, meta)
        meta = ok and decoded or {}
    end
    if not meta then return end
    local skin = meta.skin
    if not skin or skin == '' or skin == 'default' or skin == 'reset' then return end

    local expectedHash = joaat(skin)
    local currentPed   = PlayerPedId()
    local currentModel = GetEntityModel(currentPed)
    if currentModel ~= expectedHash then
        print(('^3[sunset_skins] post-spawn sanity mismatch: expected skin=%s hash=%d actual=%d^7'):format(
            tostring(skin), expectedHash, currentModel))
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
    local modelDeadline = GetGameTimer() + 10000
    while not HasModelLoaded(model) do
        if GetGameTimer() > modelDeadline then
            print('[sunset_skins] shop NPC model load timed out')
            return
        end
        Wait(200)
    end

    local cx, cy, cz, cw = cfg.coords.x, cfg.coords.y, cfg.coords.z, cfg.coords.w
    shopNPC = CreatePed(4, model, cx, cy, cz - 1.0, cw, false, true)
    SetEntityInvincible(shopNPC, true)
    SetBlockingOfNonTemporaryEvents(shopNPC, true)
    FreezeEntityPosition(shopNPC, true)
    SetModelAsNoLongerNeeded(model)

    shopBlip = AddBlipForCoord(cx, cy, cz)
    SetBlipSprite(shopBlip, cfg.blip.sprite)
    SetBlipColour(shopBlip, cfg.blip.color)
    SetBlipScale(shopBlip, cfg.blip.scale)
    SetBlipAsShortRange(shopBlip, true)
    updateShopBlipName()

    -- Proximity loop: show [E] prompt and handle interaction
    while true do
        local pos  = GetEntityCoords(PlayerPedId())
        local dist = #(pos - vector3(cx, cy, cz))
        Wait(dist < 5.0 and 0 or 1000)

        if dist < 3.0 then
            local onScreen, sx, sy = World3dToScreen2d(cx, cy, cz + 1.0)
            if onScreen then
                SetTextScale(0.35, 0.35)
                SetTextFont(4)
                SetTextProportional(1)
                SetTextColour(255, 255, 255, 220)
                SetTextEntry('STRING')
                SetTextCentre(1)
                AddTextComponentString(exports.sunset_core:Translate('skins.prompt.open_shop'))
                DrawText(sx, sy)
            end
            if IsControlJustPressed(0, 38) and not shopOpen then
                openShop()
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if shopBlip and DoesBlipExist(shopBlip) then RemoveBlip(shopBlip) end
    if shopNPC and DoesEntityExist(shopNPC) then DeleteEntity(shopNPC) end
end)
