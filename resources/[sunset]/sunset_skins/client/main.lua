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
    if LocalPlayer.state.isSpawning then
        print('^3[sunset_skins] applyModel skipped: LocalPlayer.state.isSpawning is true^7')
        return false, 'spawn_blocked'
    end

    local hash
    local isReset = not model or model == '' or model == 'default' or model == 'reset'
    local char = exports.sunset_core:GetCharacter()
    local gender = (char and tonumber(char.gender)) or (Sunset and Sunset.Character and tonumber(Sunset.Character.gender)) or 0
    if isReset then
        local isFemale = (gender == 1 or gender == '1' or gender == 'female')
        hash = (isFemale and `mp_f_freemode_01` or `mp_m_freemode_01`)
    else
        hash = type(model) == 'number' and model or GetHashKey(model)
    end

    if not IsModelInCdimage(hash) or not IsModelValid(hash) then
        print(('^1[sunset_skins] applyModel invalid model: %s (hash: %s)^7'):format(tostring(model), tostring(hash)))
        return false, 'invalid_model'
    end

    RequestModel(hash)
    local deadline = GetGameTimer() + 5000
    while not HasModelLoaded(hash) and GetGameTimer() < deadline do
        Wait(25)
    end
    if not HasModelLoaded(hash) then
        print(('^1[sunset_skins] applyModel model load timeout (5000ms): %s (hash: %s)^7'):format(tostring(model), tostring(hash)))
        return false, 'load_timeout'
    end

    SetPlayerModel(PlayerId(), hash)

    local pedDeadline = GetGameTimer() + 1000
    while (GetEntityModel(PlayerPedId()) ~= hash or not DoesEntityExist(PlayerPedId())) and GetGameTimer() < pedDeadline do
        Wait(10)
    end

    local newPed = PlayerPedId()
    if GetEntityModel(newPed) ~= hash then
        print(('^1[sunset_skins] applyModel SetPlayerModel verification failed: current=%s expected=%s^7'):format(
            tostring(GetEntityModel(newPed)), tostring(hash)))
        SetModelAsNoLongerNeeded(hash)
        return false, 'apply_failed'
    end

    SetPedDefaultComponentVariation(newPed)
    SetModelAsNoLongerNeeded(hash)
    TriggerServerEvent('sunset:server:updatePlayerPed')

    if isReset or hash == `mp_m_freemode_01` or hash == `mp_f_freemode_01` then
        if char and char.appearance and GetResourceState('sunset_appearance') == 'started' then
            exports.sunset_appearance:ApplyAppearance(newPed, char.appearance, gender)
        end
    end

    -- SetPlayerModel resets NUI focus; re-apply it if the shop is currently open
    if shopOpen then
        Wait(50)
        exports.sunset_ui:SetFocus(true, true, false, 'skinshop')
    end

    return true
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
    local reqModel = data.model

    if LocalPlayer.state.isSpawning then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.spawn_blocked'), 'error', 4000)
        return
    end

    local result, err = Sunset.AwaitCallback('skins:equip', reqModel)
    if result and result.success then
        local isReset = not reqModel or reqModel == '' or reqModel == 'default' or reqModel == 'reset'
        local ok, reason = applyModel(reqModel)
        if ok then
            if isReset then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.restored_original_character_appearance'), 'success', 3000)
            else
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.skin_equipped'), 'success', 3000)
            end
        else
            if reason == 'spawn_blocked' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.spawn_blocked'), 'error', 5000)
            elseif reason == 'invalid_model' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.msg.invalid_skin_model', { model = tostring(reqModel) }), 'error', 5000)
            elseif reason == 'load_timeout' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.could_not_load_skin_model'), 'error', 5000)
            elseif reason == 'apply_failed' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.saved_but_apply_failed'), 'error', 5000)
            else
                exports.sunset_ui:Notify(exports.sunset_core:Translate('skins.message.equip_failed'), 'error', 5000)
            end
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
    local ok, reason = applyModel(model)
    if not ok then
        print(('^1[sunset_skins] applyModel failed via event for model=%s reason=%s^7'):format(tostring(model), tostring(reason)))
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

    local expectedHash = GetHashKey(skin)
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
    if Sunset and Sunset.AwaitGameReady then
        Sunset.AwaitGameReady()
    else
        pcall(function() exports.sunset_core:AwaitGameReady() end)
    end

    local cfg = SunsetSkins.ShopNPC
    local isDebug = SunsetBoot and SunsetBoot.IsDebug and SunsetBoot.IsDebug()
    if isDebug then
        print(('^5[WORLD-INIT] sunset_skins NPC model request START model=%s^7'):format(tostring(cfg.model)))
    end

    local tModel = GetGameTimer()
    local okModel, hash = false, nil
    if Sunset and Sunset.RequestModelSafe then
        okModel, hash = Sunset.RequestModelSafe(cfg.model, 5000)
    else
        local okR, rHash = pcall(function() return exports.sunset_core:RequestModelSafe(cfg.model, 5000) end)
        okModel, hash = (okR and rHash ~= false), rHash
    end

    local cx, cy, cz, cw = cfg.coords.x, cfg.coords.y, cfg.coords.z, cfg.coords.w
    if okModel and hash then
        if isDebug then
            print(('^5[WORLD-INIT] sunset_skins NPC model READY dur=%dms^7'):format(GetGameTimer() - tModel))
        end
        shopNPC = CreatePed(4, hash, cx, cy, cz - 1.0, cw, false, true)
        if shopNPC and shopNPC ~= 0 and DoesEntityExist(shopNPC) then
            SetEntityInvincible(shopNPC, true)
            SetBlockingOfNonTemporaryEvents(shopNPC, true)
            FreezeEntityPosition(shopNPC, true)
            if isDebug then
                print(('^5[WORLD-INIT] sunset_skins NPC created entity=%s^7'):format(tostring(shopNPC)))
            end
        end
        SetModelAsNoLongerNeeded(hash)
    else
        print(('^3[sunset_skins] Optional shop NPC model %s failed to load; skipping NPC^7'):format(tostring(cfg.model)))
    end

    if isDebug then
        print(('^5[WORLD-INIT] sunset_skins blip START coords=(%.2f,%.2f,%.2f)^7'):format(cx, cy, cz))
    end
    if Sunset and Sunset.CreateSafeBlip then
        shopBlip = Sunset.CreateSafeBlip(cfg.coords, {
            sprite = cfg.blip.sprite,
            color = cfg.blip.color,
            scale = cfg.blip.scale,
            shortRange = true,
        })
    else
        pcall(function()
            shopBlip = exports.sunset_core:CreateSafeBlip(cfg.coords, {
                sprite = cfg.blip.sprite,
                color = cfg.blip.color,
                scale = cfg.blip.scale,
                shortRange = true,
            })
        end)
    end
    if isDebug and shopBlip then
        print(('^5[WORLD-INIT] sunset_skins blip DONE handle=%s^7'):format(tostring(shopBlip)))
    end
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
