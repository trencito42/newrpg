local shopOpen = false
local shopNPC  = nil

-- Apply a GTA ped model to the local player
local function applyModel(model)
    local hash
    if not model or model == '' then
        -- reset to default civilian (matches spawn default)
        hash = joaat('a_m_y_business_01')
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

-- Open the skin shop NUI
local function openShop()
    if shopOpen then return end
    local skins, err = Sunset.AwaitCallback('skins:getAll')
    if not skins then
        exports.sunset_ui:Notify(err or 'Could not load skins', 'error', 5000)
        return
    end
    shopOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open', skins = skins })
end

local function closeShop()
    if not shopOpen then return end
    shopOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

-- NUI: buy a skin (currency = 'cash' | 'pp')
RegisterNUICallback('buy', function(data, cb)
    local result, err = Sunset.AwaitCallback('skins:buy', data.model, data.currency)
    if result then
        exports.sunset_ui:Notify('Skin purchased!', 'success', 4000)
        local skins = Sunset.AwaitCallback('skins:getAll')
        cb({ success = true, skins = skins })
    else
        exports.sunset_ui:Notify(err or 'Purchase failed', 'error', 5000)
        cb({ success = false, err = err })
    end
end)

-- NUI: equip an owned skin
RegisterNUICallback('equip', function(data, cb)
    local result, err = Sunset.AwaitCallback('skins:equip', data.model)
    if result then
        exports.sunset_ui:Notify('Skin equipped!', 'success', 3000)
        cb({ success = true })
    else
        exports.sunset_ui:Notify(err or 'Equip failed', 'error', 5000)
        cb({ success = false, err = err })
    end
end)

-- NUI: close button
RegisterNUICallback('close', function(_, cb)
    closeShop()
    cb({})
end)

-- Server → client: apply model (used by /setskin and battlepass unlock)
RegisterNetEvent('sunset:skins:applyModel')
AddEventHandler('sunset:skins:applyModel', function(model)
    applyModel(model)
end)

-- Server → client: generic notification (giveskin, battlepass)
RegisterNetEvent('sunset:skins:notify')
AddEventHandler('sunset:skins:notify', function(msg)
    exports.sunset_ui:Notify(msg or '', 'success', 5500)
end)

-- /skins — opens skin shop from an owned/rented property (wardrobe access)
RegisterCommand('skins', function()
    local inHouse = exports.sunset_properties:CanAccessWardrobe()
    if not inHouse then
        exports.sunset_ui:Notify('You can only change your skin from your home.', 'error', 4000)
        return
    end
    openShop()
end, false)

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
