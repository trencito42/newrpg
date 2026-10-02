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
-- 1. HARVEST PROXIMITY HUD
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local sleep = 500

        local nearSpot = nil
        local nearIndex = nil

        for i, spot in ipairs(Cfg.manufacture.spots or {}) do
            local dist = #(coords - spot.coords)
            if dist < (Cfg.manufacture.spotRadius or 15.0) then
                nearSpot = spot
                nearIndex = i
                sleep = 50
                break
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

-- NUI Callbacks for Harvest
RegisterNUICallback('giveHarvestItem', function(data, cb)
    local result = Sunset.AwaitCallback('sunset:drugs:harvestHit', data.token, data.type)
    cb(result or { success = false })
end)

RegisterNUICallback('failHarvestHit', function(data, cb)
    cb({ ok = true })
end)

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
            if dist < (Cfg.process.labRadius or 5.0) then
                nearLab = true
                labIdx = i
                sleep = 0
                -- Subtle glowing cylinder marker
                DrawMarker(1, lab.coords.x, lab.coords.y, lab.coords.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    1.2, 1.2, 0.8,
                    215, 181, 88, 70,
                    false, false, 2, false, nil, nil, false)
                
                if not labOpen then
                    -- Display hint
                    BeginTextCommandDisplayHelp("THREESTRINGS")
                    AddTextComponentSubstringPlayerName("Apasă ~INPUT_CONTEXT~ pentru ")
                    AddTextComponentSubstringPlayerName("~y~Laborator Clandestin~s~")
                    EndTextCommandDisplayHelp(0, false, false, -1)

                    if IsControlJustReleased(0, 38) then
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
        Notify('Nu s-a putut deschide laboratorul clandestin.', 'error')
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

RegisterNUICallback('processSuccess', function(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:processSuccess', data.token, data.type)
    cb(res or { success = false })
end)

RegisterNUICallback('processFail', function(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:processFail', data.token, data.type)
    cb(res or { success = false })
end)

RegisterNUICallback('closeMenu', function(data, cb)
    labOpen = false
    exports.sunset_ui:SetFocus(false, false, false, 'drugs_lab')
    cb({ ok = true })
end)

-- ═══════════════════════════════════════════════════════════════
-- 3. STREET SALE (Vânzare Stradală la NPC)
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
        if entity ~= ped and not IsPedAPlayer(entity) and not IsPedDeadOrDying(entity, true) and not IsPedInAnyVehicle(entity, true) then
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
                    AddTextComponentString("~y~[E]~s~ Oferă Marfă")
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
        local errMsg = (type(offer) == 'table' and offer.err) or 'Persoana nu este interesată și își continuă drumul.'
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

RegisterNUICallback('acceptDrugSale', function(data, cb)
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

    cb(res or { success = false })
end)

RegisterNUICallback('failNegotiation', function(data, cb)
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

    cb(res or { success = true })
end)

RegisterNUICallback('declineDrugSale', function(data, cb)
    local res = Sunset.AwaitCallback('sunset:drugs:declineStreetSale', data)

    if currentSalePed and DoesEntityExist(currentSalePed) then
        ClearPedTasks(currentSalePed)
        TaskWanderStandard(currentSalePed, 10.0, 10)
    end

    cb(res or { success = true })
end)

RegisterNUICallback('closeSaleUI', function(data, cb)
    saleActive = false
    currentSalePed = nil
    exports.sunset_ui:SetFocus(false, false, false, 'drugs_sale')
    cb({ ok = true })
end)
