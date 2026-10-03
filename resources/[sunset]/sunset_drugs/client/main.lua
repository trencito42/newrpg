-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Drug Pipeline Client (client/main.lua)
--  Proximity Harvest HUD + Lab Processing Modal + NPC Street Sale.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetDrugs.Config

local inHarvestZone = false
local currentHarvestSpot = nil
local harvestSessionActive = false

local inLabZone = false
local currentLabIndex = nil
local labOpen = false

local saleActive = false
local currentSalePed = nil

-- Helper notify
local function Notify(msg, kind)
    exports.sunset_ui:Notify(msg, kind or 'info')
end

-- ═══════════════════════════════════════════════════════════════
-- 1. HARVEST PROXIMITY HUD & 3D MARKERS
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local sleep = 400

        local nearSpot = nil
        local nearIndex = nil

        for i, spot in ipairs(Cfg.manufacture.spots or {}) do
            local dist = #(coords - spot.coords)
            if dist < 60.0 then
                sleep = 0
                -- Draw 3D ground cylinder marking harvest zone
                local r, g, b = 46, 204, 113
                if spot.drug == 'coke' or spot.drug == 'coca' then
                    r, g, b = 240, 240, 240
                elseif spot.drug == 'meth' then
                    r, g, b = 52, 152, 219
                end

                DrawMarker(1, spot.coords.x, spot.coords.y, spot.coords.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    (Cfg.manufacture.spotRadius or 15.0) * 2.0, (Cfg.manufacture.spotRadius or 15.0) * 2.0, 1.0,
                    r, g, b, 45,
                    false, false, 2, false, nil, nil, false)

                -- 3D Text Prompt
                local onScreen, sX, sY = World3dToScreen2d(spot.coords.x, spot.coords.y, spot.coords.z + 1.2)
                if onScreen and dist < 35.0 then
                    SetTextScale(0.34, 0.34)
                    SetTextFont(4)
                    SetTextProportional(1)
                    SetTextColour(242, 239, 232, 230)
                    SetTextEntry("STRING")
                    SetTextCentre(1)
                    AddTextComponentString(exports.sunset_core:Translate('drugs.prompt.harvest_zone', {
                        item = spot.label or exports.sunset_core:Translate('drugs.label.drugs'),
                    }))
                    DrawText(sX, sY)
                end

                if dist < (Cfg.manufacture.spotRadius or 15.0) then
                    nearSpot = spot
                    nearIndex = i
                end
            end
        end

        if nearSpot and not inHarvestZone and not harvestSessionActive then
            inHarvestZone = true
            currentHarvestSpot = nearIndex

            -- Request server session
            local sessionData = Sunset.AwaitCallback('sunset:drugs:requestHarvestSession', nearIndex)
            if sessionData and sessionData.token then
                harvestSessionActive = true
                exports.sunset_ui:Send('showHarvest', {
                    type = sessionData.type,
                    amount = sessionData.amount,
                    maxAmount = sessionData.maxAmount,
                    token = sessionData.token,
                })
            else
                inHarvestZone = false
                currentHarvestSpot = nil
            end
        elseif not nearSpot and inHarvestZone then
            inHarvestZone = false
            currentHarvestSpot = nil
            harvestSessionActive = false
            exports.sunset_ui:Send('hideHarvest', {})
            Sunset.AwaitCallback('sunset:drugs:closeHarvest')
        end

        Wait(sleep)
    end
end)

-- Dedicated E-key input loop for harvest minigame while walking/looking
CreateThread(function()
    while true do
        if inHarvestZone and harvestSessionActive then
            -- INPUT_CONTEXT (E key / control 38)
            if IsControlJustPressed(0, 38) or IsDisabledControlJustPressed(0, 38) then
                exports.sunset_ui:Send('triggerHarvestHit', {})
            end
            Wait(0)
        else
            Wait(200)
        end
    end
end)

-- NUI Callbacks and Forwards for Harvest
local function onGiveHarvestItem(data, cb)
    local result = Sunset.AwaitCallback('sunset:drugs:harvestHit', data.token, data.type)
    if cb then cb(result or { success = false }) end
end

local function onFailHarvestHit(data, cb)
    if cb then cb({ ok = true }) end
end

RegisterNUICallback('giveHarvestItem', onGiveHarvestItem)
RegisterNUICallback('failHarvestHit', onFailHarvestHit)
AddEventHandler('sunset:nui:giveHarvestItem', function(data) onGiveHarvestItem(data, function() end) end)
AddEventHandler('sunset:nui:failHarvestHit', function(data) onFailHarvestHit(data, function() end) end)

-- ═══════════════════════════════════════════════════════════════
-- 2. CLANDESTINE LAB PROCESSING
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local sleep = 500

        local nearLab = false
        local labIdx = nil

        for i, lab in ipairs(Cfg.process.labs or {}) do
            local dist = #(coords - lab.coords)
            if dist < 30.0 then
                sleep = 0
                -- Glowing cylinder marker
                DrawMarker(1, lab.coords.x, lab.coords.y, lab.coords.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    1.6, 1.6, 0.9,
                    215, 181, 88, 80,
                    false, false, 2, false, nil, nil, false)

                local onScreen, sX, sY = World3dToScreen2d(lab.coords.x, lab.coords.y, lab.coords.z + 0.8)
                if onScreen and dist < 15.0 then
                    SetTextScale(0.32, 0.32)
                    SetTextFont(4)
                    SetTextProportional(1)
                    SetTextColour(242, 239, 232, 230)
                    SetTextEntry("STRING")
                    SetTextCentre(1)
                    AddTextComponentString(exports.sunset_core:Translate('drugs.prompt.clandestine_lab', {
                        lab = lab.label or exports.sunset_core:Translate('drugs.label.laboratory'),
                    }))
                    DrawText(sX, sY)
                end

                if dist < (Cfg.process.labRadius or 5.0) then
                    nearLab = true
                    labIdx = i

                    if not labOpen and IsControlJustReleased(0, 38) then
                        OpenClandestineLab(i)
                    end
                end
                break
            end
        end

        inLabZone = nearLab
        currentLabIndex = labIdx
        Wait(sleep)
    end
end)

function OpenClandestineLab(labIndex)
    if labOpen then return end
    labOpen = true

    local labData = Sunset.AwaitCallback('sunset:drugs:openLab', labIndex)
    if not labData or not labData.token then
        Notify(exports.sunset_core:Translate('drugs.message.lab_open_failed'), 'error')
        labOpen = false
        return
    end

    exports.sunset_ui:Send('openLab', {
        token = labData.token,
        inventory = labData.inventory,
        recipes = labData.recipes,
    })
    exports.sunset_ui:SetFocus(true, true, false, 'drugs_lab')
end

local function onProcessSuccess(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:processSuccess', data.token, data.type)
    if cb then cb(res or { success = false }) end
end

local function onProcessFail(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:processFail', data.token, data.type)
    if cb then cb(res or { success = false }) end
end

local function onCloseLabMenu(data, cb)
    labOpen = false
    exports.sunset_ui:SetFocus(false, false, false, 'drugs_lab')
    if cb then cb({ ok = true }) end
end

RegisterNUICallback('processSuccess', onProcessSuccess)
RegisterNUICallback('processFail', onProcessFail)
RegisterNUICallback('closeMenu', onCloseLabMenu)
RegisterNUICallback('drugsCloseMenu', onCloseLabMenu)
AddEventHandler('sunset:nui:processSuccess', function(data) onProcessSuccess(data, function() end) end)
AddEventHandler('sunset:nui:processFail', function(data) onProcessFail(data, function() end) end)
AddEventHandler('sunset:nui:drugsCloseMenu', function(data) onCloseLabMenu(data, function() end) end)
AddEventHandler('sunset:nui:drugsClose', function(data) onCloseLabMenu(data, function() end) end)

-- ═══════════════════════════════════════════════════════════════
-- 3. STREET SALE (Vanzare Stradala la NPC)
-- ═══════════════════════════════════════════════════════════════

local function GetTargetPedInFront()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    local targetPos = coords + (forward * (Cfg.streetSale.interactionDistance or 2.5))

    local handle, entity = FindFirstPed()
    local success
    local closestPed = nil
    local closestDist = Cfg.streetSale.interactionDistance or 2.5

    repeat
        if entity ~= ped and not IsPedAPlayer(entity) and not IsPedDeadOrDying(entity, true) 
           and not IsPedInAnyVehicle(entity, true) 
           and not IsEntityAMissionEntity(entity) 
           and not IsEntityPositionFrozen(entity) then
            local pCoords = GetEntityCoords(entity)
            local dist = #(coords - pCoords)
            if dist <= closestDist then
                local pedType = GetPedType(entity)
                -- Only civilian peds (not cops, animals, medics)
                if pedType ~= 6 and pedType ~= 27 and pedType ~= 28 and pedType ~= 29 then
                    closestDist = dist
                    closestPed = entity
                end
            end
        end
        success, entity = FindNextPed(handle)
    until not success
    EndFindPed(handle)

    return closestPed
end

CreateThread(function()
    while true do
        local sleep = 350
        local ped = PlayerPedId()

        if not saleActive and not labOpen and not IsPedInAnyVehicle(ped, true) then
            local targetPed = GetTargetPedInFront()
            if targetPed and DoesEntityExist(targetPed) then
                sleep = 0
                local tCoords = GetEntityCoords(targetPed)

                -- 3D Text Prompt above ped
                local onScreen, screenX, screenY = World3dToScreen2d(tCoords.x, tCoords.y, tCoords.z + 0.9)
                if onScreen then
                    SetTextScale(0.32, 0.32)
                    SetTextFont(4)
                    SetTextProportional(1)
                    SetTextColour(242, 239, 232, 230)
                    SetTextEntry("STRING")
                    SetTextCentre(1)
                    AddTextComponentString(exports.sunset_core:Translate('drugs.prompt.offer_goods'))
                    DrawText(screenX, screenY)
                end

                if IsControlJustReleased(0, 38) then
                    InitiateStreetSale(targetPed)
                end
            end
        end

        Wait(sleep)
    end
end)

function InitiateStreetSale(npcPed)
    if saleActive then return end
    saleActive = true
    currentSalePed = npcPed

    local playerPed = PlayerPedId()
    local netId = NetworkGetNetworkIdFromEntity(npcPed)

    -- Make NPC face player and stop walking
    ClearPedTasks(npcPed)
    TaskTurnPedToFaceEntity(npcPed, playerPed, 1500)
    TaskStandStill(npcPed, 30000)

    -- Play player interaction animation
    RequestAnimDict("mp_common")
    while not HasAnimDictLoaded("mp_common") do Wait(10) end
    TaskPlayAnim(playerPed, "mp_common", "givetake2_a", 2.0, 2.0, 1500, 49, 0, false, false, false)

    -- Request offer from server
    local offer = Sunset.AwaitCallback('sunset:drugs:requestStreetOffer', netId)
    if not offer or not offer.token then
        local errMsg = (type(offer) == 'table' and offer.err) or 'Persoana nu este interesata si isi continua drumul.'
        Notify(errMsg, 'error')
        
        -- NPC declines gesture
        RequestAnimDict("gestures@m@standing@casual")
        while not HasAnimDictLoaded("gestures@m@standing@casual") do Wait(10) end
        TaskPlayAnim(npcPed, "gestures@m@standing@casual", "gesture_no_way", 2.0, 2.0, 1500, 49, 0, false, false, false)

        Wait(1500)
        ClearPedTasks(npcPed)
        TaskWanderStandard(npcPed, 10.0, 10)
        saleActive = false
        currentSalePed = nil
        return
    end

    -- Open Street Sale UI
    exports.sunset_ui:Send('openStreetSale', {
        type = offer.type,
        qty = offer.qty,
        price = offer.price,
        risk = offer.risk,
        token = offer.token,
    })
    exports.sunset_ui:SetFocus(true, true, false, 'drugs_sale')
end

local function onAcceptDrugSale(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:acceptStreetSale', data)
    
    if currentSalePed and DoesEntityExist(currentSalePed) then
        RequestAnimDict("mp_common")
        while not HasAnimDictLoaded("mp_common") do Wait(10) end
        TaskPlayAnim(currentSalePed, "mp_common", "givetake2_a", 2.0, 2.0, 1500, 49, 0, false, false, false)
        
        SetTimeout(2000, function()
            if DoesEntityExist(currentSalePed) then
                ClearPedTasks(currentSalePed)
                TaskWanderStandard(currentSalePed, 10.0, 10)
            end
        end)
    end

    if cb then cb(res or { success = false }) end
end

local function onFailNegotiation(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:failNegotiation', data)

    if currentSalePed and DoesEntityExist(currentSalePed) then
        -- Ped gets scared and runs away
        RequestAnimDict("gestures@m@standing@casual")
        while not HasAnimDictLoaded("gestures@m@standing@casual") do Wait(10) end
        TaskPlayAnim(currentSalePed, "gestures@m@standing@casual", "gesture_damn", 2.0, 2.0, 1000, 49, 0, false, false, false)

        SetTimeout(1200, function()
            if DoesEntityExist(currentSalePed) then
                ClearPedTasks(currentSalePed)
                TaskSmartFleePed(currentSalePed, PlayerPedId(), 60.0, -1, false, false)
            end
        end)
    end

    if cb then cb(res or { success = true }) end
end

local function onDeclineDrugSale(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:declineStreetSale', data)

    if currentSalePed and DoesEntityExist(currentSalePed) then
        ClearPedTasks(currentSalePed)
        TaskWanderStandard(currentSalePed, 10.0, 10)
    end

    if cb then cb(res or { success = true }) end
end

local function onCloseSaleUI(data, cb)
    saleActive = false
    currentSalePed = nil
    exports.sunset_ui:SetFocus(false, false, false, 'drugs_sale')
    if cb then cb({ ok = true }) end
end

RegisterNUICallback('acceptDrugSale', onAcceptDrugSale)
RegisterNUICallback('failNegotiation', onFailNegotiation)
RegisterNUICallback('declineDrugSale', onDeclineDrugSale)
RegisterNUICallback('closeSaleUI', onCloseSaleUI)
AddEventHandler('sunset:nui:acceptDrugSale', function(data) onAcceptDrugSale(data, function() end) end)
AddEventHandler('sunset:nui:failNegotiation', function(data) onFailNegotiation(data, function() end) end)
AddEventHandler('sunset:nui:declineDrugSale', function(data) onDeclineDrugSale(data, function() end) end)
AddEventHandler('sunset:nui:closeSaleUI', function(data) onCloseSaleUI(data, function() end) end)

-- ═══════════════════════════════════════════════════════════════
-- 4. WHOLESALE DELIVERY SYSTEM (Locatii Livrare Droguri pe Rank)
-- ═══════════════════════════════════════════════════════════════

local spawnedDeliveryPeds = {}
local deliveryBlips = {}
local activeTooltipDealer = nil

local function makeSafeBlip(coords, conf)
    if Sunset and Sunset.CreateSafeBlip then
        return Sunset.CreateSafeBlip(coords, conf)
    elseif exports.sunset_core and exports.sunset_core.CreateSafeBlip then
        return exports.sunset_core:CreateSafeBlip(coords, conf)
    end
    local b = AddBlipForCoord(coords.x, coords.y, coords.z)
    if conf.sprite then SetBlipSprite(b, conf.sprite) end
    if conf.color then SetBlipColour(b, conf.color) end
    if conf.scale then SetBlipScale(b, conf.scale) end
    if conf.name then
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(conf.name)
        EndTextCommandSetBlipName(b)
    end
    return b
end

-- ── Spawn Delivery Dealer NPCs & Create Blips ────────────────
CreateThread(function()
    -- Initialize Harvest Spots Blips
    for _, spot in ipairs((Cfg.manufacture and Cfg.manufacture.spots) or {}) do
        local sprite = 140
        local color = 25
        if spot.drug == 'coke' or spot.drug == 'coca' then
            sprite = 501
            color = 4
        elseif spot.drug == 'meth' then
            sprite = 499
            color = 26
        end

        local blip = makeSafeBlip(spot.coords, {
            sprite = sprite,
            color = color,
            scale = 0.75,
            name = ('[Recoltare] %s'):format(spot.label or 'Camp Droguri'),
            shortRange = true,
        })
        if blip then table.insert(deliveryBlips, blip) end
    end

    -- Initialize Processing Labs Blips
    for _, lab in ipairs((Cfg.process and Cfg.process.labs) or {}) do
        local blip = makeSafeBlip(lab.coords, {
            sprite = 499,
            color = 28,
            scale = 0.75,
            name = ('[Laborator] %s'):format(lab.label or 'Laborator Clandestin'),
            shortRange = true,
        })
        if blip then table.insert(deliveryBlips, blip) end
    end

    -- Initialize Delivery Dropoffs Blips
    for _, dropoff in ipairs((Cfg.delivery and Cfg.delivery.dropoffs) or {}) do
        local blip = makeSafeBlip(vector3(dropoff.coords.x, dropoff.coords.y, dropoff.coords.z), {
            sprite = 514,
            color = 27,
            scale = 0.80,
            name = ('[%s] %s'):format(dropoff.rankBadge or 'Livrare', dropoff.name or 'Livrare Droguri'),
            shortRange = true,
        })
        if blip then table.insert(deliveryBlips, blip) end
    end

    -- Persistent NPC Streamer Loop
    while true do
        local playerPed = PlayerPedId()
        local pCoords = GetEntityCoords(playerPed)

        for _, dropoff in ipairs((Cfg.delivery and Cfg.delivery.dropoffs) or {}) do
            local dPos = vector3(dropoff.coords.x, dropoff.coords.y, dropoff.coords.z)
            local dist = #(pCoords - dPos)

            if dist < 85.0 then
                if not spawnedDeliveryPeds[dropoff.id] or not DoesEntityExist(spawnedDeliveryPeds[dropoff.id]) then
                    local modelHash = joaat(dropoff.pedModel or 'a_m_m_tramp_01')
                    RequestModel(modelHash)
                    local timeout = GetGameTimer() + 3000
                    while not HasModelLoaded(modelHash) and GetGameTimer() < timeout do
                        Wait(50)
                    end

                    if HasModelLoaded(modelHash) then
                        local ped = CreatePed(4, modelHash,
                            dropoff.coords.x, dropoff.coords.y, dropoff.coords.z - 0.98, dropoff.coords.w,
                            false, true)
                        if ped and ped ~= 0 and DoesEntityExist(ped) then
                            SetPedDefaultComponentVariation(ped)
                            SetEntityHeading(ped, dropoff.coords.w or 0.0)
                            SetEntityAsMissionEntity(ped, true, true)
                            FreezeEntityPosition(ped, true)
                            SetEntityInvincible(ped, true)
                            SetBlockingOfNonTemporaryEvents(ped, true)
                            if dropoff.scenario then
                                TaskStartScenarioInPlace(ped, dropoff.scenario, 0, true)
                            end
                            spawnedDeliveryPeds[dropoff.id] = ped
                        end
                        SetModelAsNoLongerNeeded(modelHash)
                    end
                end
            elseif dist > 120.0 then
                if spawnedDeliveryPeds[dropoff.id] and DoesEntityExist(spawnedDeliveryPeds[dropoff.id]) then
                    DeleteEntity(spawnedDeliveryPeds[dropoff.id])
                    spawnedDeliveryPeds[dropoff.id] = nil
                end
            end
        end

        Wait(1500)
    end
end)

-- ── Proximity Interaction Loop (24/7 Tooltip Design) ─────────
CreateThread(function()
    while true do
        local sleep = 400
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)

        if not saleActive and not labOpen and not IsPedInAnyVehicle(ped, true) then
            local nearbyDropoff = nil
            local nearbyPed = nil
            local minDistance = 999.0

            for _, dropoff in ipairs((Cfg.delivery and Cfg.delivery.dropoffs) or {}) do
                local dCoords = vector3(dropoff.coords.x, dropoff.coords.y, dropoff.coords.z)
                local dist = #(coords - dCoords)
                if dist < minDistance then
                    minDistance = dist
                    nearbyDropoff = dropoff
                    nearbyPed = spawnedDeliveryPeds[dropoff.id]
                end
            end

            if nearbyDropoff and minDistance < 5.0 and nearbyPed and DoesEntityExist(nearbyPed) then
                sleep = 0
                activeTooltipDealer = nearbyDropoff.id

                -- 24/7 Style Floating Tooltip Badge
                pcall(function()
                    exports.sunset_world:NpcShowTooltip('drug_dealer_' .. nearbyDropoff.id, nearbyPed, {
                        badge = nearbyDropoff.rankBadge or 'LIVRARE',
                        badgeClass = 'npc',
                        bodyClass = 'npc',
                        icon = 'ph-package',
                        title = nearbyDropoff.dealerLabel or exports.sunset_core:Translate('drugs.label.dealer'),
                        desc = nearbyDropoff.desc or exports.sunset_core:Translate('drugs.label.package_pickup'),
                        key = 'E',
                    })
                end)

                if minDistance <= ((Cfg.delivery and Cfg.delivery.interactionRadius) or 3.0) then
                    if IsControlJustReleased(0, 38) then
                        DoWholesaleDelivery(nearbyDropoff)
                    end
                end
            else
                if activeTooltipDealer then
                    pcall(function()
                        exports.sunset_world:NpcHideTooltip('drug_dealer_' .. activeTooltipDealer)
                    end)
                    activeTooltipDealer = nil
                end
            end
        else
            if activeTooltipDealer then
                pcall(function()
                    exports.sunset_world:NpcHideTooltip('drug_dealer_' .. activeTooltipDealer)
                end)
                activeTooltipDealer = nil
            end
        end

        Wait(sleep)
    end
end)

function DoWholesaleDelivery(dropoff)
    if saleActive then return end

    local offer, err = Sunset.AwaitCallback('sunset:drugs:requestDeliveryOffer', dropoff.id)
    if not offer or not offer.token then
        local msg = (type(err) == 'table' and (err.err or err.localeKey or err.message))
                 or (type(err) == 'string' and err)
                 or 'Nu ai niciun pachet de droguri procesate in inventar! (Pachete Weed, Pudra Cocaina, Cristale Meth)'
        Notify(msg, 'error', 6000)
        return
    end

    saleActive = true
    currentSalePed = spawnedDeliveryPeds[dropoff.id]

    -- Open the Street Sale UI Modal (racket_street_sale.html)
    exports.sunset_ui:Send('openStreetSale', {
        type = offer.type,
        qty = offer.qty,
        price = offer.price,
        risk = offer.risk,
        token = offer.token,
    })
    exports.sunset_ui:SetFocus(true, true, false, 'drugs_sale')
end

