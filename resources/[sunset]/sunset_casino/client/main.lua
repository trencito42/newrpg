-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — The Diamond Casino (client/main.lua)
--  IPL loading, entry/exit, game tables, Lucky Wheel, Cashier, Bar.
--  All coordinates verified via /casinoprobe (interior id=275201).
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetCasino.Config
local insideCasino = false
local casinoOpen = false
local casinoBlip = nil

-- ── Coordinate-based inside detection ──
-- The boolean flag alone is NOT reliable: reconnecting inside, admin TP, or a
-- resource restart loses it and the exit marker would never show. Detect
-- "inside the casino interior" from coordinates too (casino interiors live at
-- Z ≈ -45..-53, X ≈ 1080..1160, Y ≈ 190..290), and re-sync the flag.
local function isInCasinoInterior(coords)
    if not coords then return false end
    return coords.z < -40.0 and coords.z > -60.0
        and coords.x > 1070.0 and coords.x < 1170.0
        and coords.y > 180.0 and coords.y < 300.0
end

-- Exit zones (multiple: interior exit door + main floor near the entry).
-- Verified interiorExit: 1089.63, 205.89, -49.00 (probe: ready=1, group empty).
local EXIT_ZONES = {
    vector3(1089.63, 205.89, -49.00), -- interior exit door
    vector3(1093.31, 214.61, -49.53), -- interior entry area (probe: ready=1)
}

-- ── Game UI open/close (defined before leaveCasino which references it) ──
local function openGame(gameType)
    if casinoOpen then return end
    casinoOpen = true
    local status = Sunset.AwaitCallback('sunset:casino:status')
    exports.sunset_ui:Send('casinoShow', {
        game = gameType,
        status = status,
    })
    exports.sunset_ui:SetFocus(true, true, false, 'casino')
end

local function closeCasinoUI()
    if not casinoOpen then return end
    casinoOpen = false
    exports.sunset_ui:Send('casinoHide', {})
    exports.sunset_ui:SetFocus(false, false, false, 'casino')
end

local function leaveCasino()
    closeCasinoUI()
    insideCasino = false
    Sunset.World.SafeTeleport(
        vector4(Cfg.entrance.x, Cfg.entrance.y, Cfg.entrance.z, 270.0),
        { fadeOutMs = 400, fadeInMs = 400 }
    )
end

-- Escape hatch: /leavecasino ALWAYS works while inside the interior, even if
-- the marker/flag state got out of sync (reconnect inside, resource restart).
RegisterCommand('leavecasino', function()
    local coords = GetEntityCoords(PlayerPedId())
    if insideCasino or isInCasinoInterior(coords) then
        CreateThread(function() leaveCasino() end)
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('casino.message.you_are_not_inside_the_casino'), 'error')
    end
end, false)

-- ── IPL loading ──
-- bob74_ipl auto-loads vw_casino_main on build >= 2060.
-- 'casino_main' does NOT exist; we do NOT call RequestIpl on it.

-- ── Map blip ──
local function setupCasinoBlip()
    if casinoBlip and DoesBlipExist(casinoBlip) then RemoveBlip(casinoBlip) end
    casinoBlip = Sunset.CreateSafeBlip(Cfg.entrance, {
        sprite = 679,
        color = 0,
        scale = 0.9,
        name = exports.sunset_core:Translate('blip.casino'),
        shortRange = true
    })
end

RegisterNetEvent('sunset:client:languageChanged', function()
    setupCasinoBlip()
end)

CreateThread(function()
    Sunset.AwaitGameReady()
    setupCasinoBlip()
end)

local function DrawText3D(coords, text)
    local onScreen, _x, _y = World3dToScreen2d(coords.x, coords.y, coords.z)
    if onScreen then
        SetTextScale(0.35, 0.35)
        SetTextFont(4)
        SetTextProportional(1)
        SetTextColour(255, 255, 255, 215)
        SetTextEntry('STRING')
        SetTextCentre(1)
        AddTextComponentSubstringPlayerName(text)
        DrawText(_x, _y)
        local factor = string.len(text) / 370
        DrawRect(_x, _y + 0.0125, 0.015 + factor, 0.03, 0, 0, 0, 140)
    end
end

-- ── Entry/Exit markers ──
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local sleep = 500

        -- Re-sync the inside flag from actual coordinates (authoritative)
        local inInterior = isInCasinoInterior(coords)
        if inInterior ~= insideCasino then
            insideCasino = inInterior
            if not inInterior then closeCasinoUI() end
        end

        -- Entry marker (outside casino)
        if not insideCasino and #(coords - Cfg.entrance) < 8.0 then
            sleep = 0
            DrawMarker(1, Cfg.entrance.x, Cfg.entrance.y, Cfg.entrance.z - 1.0,
                0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                1.5, 1.5, 1.0,
                0, 255, 204, 100,
                false, false, 2, false, nil, nil, false)
            DrawMarker(2, Cfg.entrance.x, Cfg.entrance.y, Cfg.entrance.z + 0.3,
                0.0, 0.0, 0.0, 0.0, 180.0, 0.0,
                0.3, 0.3, 0.3,
                0, 255, 204, 180,
                true, true, 2, false, nil, nil, false)

            if #(coords - Cfg.entrance) < 2.5 then
                DrawText3D(vector3(Cfg.entrance.x, Cfg.entrance.y, Cfg.entrance.z + 0.5), exports.sunset_core:Translate('hint.casino.enter'))
                if IsControlJustReleased(0, 38) then -- E
                    insideCasino = true
                    DoScreenFadeOut(500)
                    Wait(600)
                    SetEntityCoords(ped, EXIT_ZONES[1].x, EXIT_ZONES[1].y, EXIT_ZONES[1].z, false, false, false, false)
                    SetEntityHeading(ped, 90.0)
                    -- Wait for interior to load
                    local interior = GetInteriorAtCoords(EXIT_ZONES[1].x, EXIT_ZONES[1].y, EXIT_ZONES[1].z)
                    if interior ~= 0 then
                        local deadline = GetGameTimer() + 5000
                        while not IsInteriorReady(interior) and GetGameTimer() < deadline do
                            Wait(50)
                        end
                    end
                    Wait(300)
                    DoScreenFadeIn(500)
                end
            end
        end

        -- Exit markers (inside casino) — both interior doors
        if insideCasino then
            for _, zone in ipairs(EXIT_ZONES) do
                if #(coords - zone) < 8.0 then
                    sleep = 0
                    DrawMarker(1, zone.x, zone.y, zone.z - 1.0,
                        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                        1.5, 1.5, 1.0,
                        255, 100, 100, 100,
                        false, false, 2, false, nil, nil, false)
                    DrawMarker(2, zone.x, zone.y, zone.z + 0.3,
                        0.0, 0.0, 0.0, 0.0, 180.0, 0.0,
                        0.3, 0.3, 0.3,
                        255, 100, 100, 180,
                        true, true, 2, false, nil, nil, false)

                    if #(coords - zone) < 2.5 then
                        DrawText3D(vector3(zone.x, zone.y, zone.z + 0.5), exports.sunset_core:Translate('hint.casino.exit'))
                        if IsControlJustReleased(0, 38) then -- E
                            CreateThread(function() leaveCasino() end)
                        end
                    end
                end
            end
        end

        Wait(sleep)
    end
end)

-- ── Interior markers (blackjack, slots, roulette, wheel, cashier, bar) ──
CreateThread(function()
    while true do
        if not insideCasino then Wait(1000) goto continue end

        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local sleep = 250

        -- Blackjack & Slot machines are handled in-world by sunset_blackjack & sunset_slots (seats, 5-reels & chips)

        -- Roulette tables are handled in-world by sunset_roulette (3D tables, dealers & bets)

        -- Lucky Wheel is handled in-world by sunset_luckywheel (3D prop, animations & synced spins)

        -- Cashier
        if Cfg.cashier then
            local dist = #(coords - Cfg.cashier)
            if dist < 8.0 then
                sleep = 0
                DrawMarker(1, Cfg.cashier.x, Cfg.cashier.y, Cfg.cashier.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    1.2, 1.2, 0.8,
                    0, 255, 0, 80,
                    false, false, 2, false, nil, nil, false)
                DrawMarker(29, Cfg.cashier.x, Cfg.cashier.y, Cfg.cashier.z + 0.2,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    0.3, 0.3, 0.3,
                    0, 255, 0, 180,
                    false, true, 2, false, nil, nil, false)
                if dist < 2.5 then
                    DrawText3D(vector3(Cfg.cashier.x, Cfg.cashier.y, Cfg.cashier.z + 0.4), exports.sunset_core:Translate('hint.casino.cashier'))
                    if IsControlJustReleased(0, 38) and not casinoOpen then
                        openGame('cashier')
                    end
                end
            end
        end

        -- Bar
        if Cfg.bar then
            local dist = #(coords - Cfg.bar)
            if dist < 8.0 then
                sleep = 0
                DrawMarker(1, Cfg.bar.x, Cfg.bar.y, Cfg.bar.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    1.2, 1.2, 0.8,
                    255, 150, 0, 80,
                    false, false, 2, false, nil, nil, false)
                DrawMarker(2, Cfg.bar.x, Cfg.bar.y, Cfg.bar.z + 0.2,
                    0.0, 0.0, 0.0, 0.0, 180.0, 0.0,
                    0.25, 0.25, 0.25,
                    255, 150, 0, 180,
                    true, true, 2, false, nil, nil, false)
                if dist < 2.5 then
                    DrawText3D(vector3(Cfg.bar.x, Cfg.bar.y, Cfg.bar.z + 0.4), exports.sunset_core:Translate('hint.casino.bar'))
                    if IsControlJustReleased(0, 38) and not casinoOpen then
                        openGame('bar')
                    end
                end
            end
        end

        Wait(sleep)
        ::continue::
    end
end)

-- ── NUI callbacks ──
AddEventHandler('sunset:nui:casinoClose', function()
    closeCasinoUI()
end)

-- ── Cashier ──
AddEventHandler('sunset:nui:casinoBuyChips', function(data)
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:casino:buyChips', tonumber(data.amount))
        if not res then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('casino.msg.could_not_buy_chips'), 'error')
            return
        end
        exports.sunset_ui:Send('casinoCashierUpdate', res)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('casino.msg.bought_chips_for', { chips = tostring(res.chips), cost = tostring(res.cost) }), 'success')
    end)
end)

AddEventHandler('sunset:nui:casinoSellChips', function(data)
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:casino:sellChips', tonumber(data.amount))
        if not res then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('casino.msg.could_not_sell_chips'), 'error')
            return
        end
        exports.sunset_ui:Send('casinoCashierUpdate', res)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('casino.msg.sold_chips_for', { chips = tostring(res.chips), earned = tostring(res.earned) }), 'success')
    end)
end)

-- ── Bar ──
AddEventHandler('sunset:nui:casinoBuyDrink', function(data)
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:casino:buyDrink', tostring(data.drinkId))
        if not res then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('casino.msg.could_not_buy_the_drink'), 'error')
            return
        end
        exports.sunset_ui:Send('casinoBarUpdate', res)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('casino.msg.bought_for', { label = tostring(res.label), price = tostring(res.price) }), 'success')
    end)
end)

-- ESC closes casino
CreateThread(function()
    while true do
        if casinoOpen and IsPauseMenuActive() then
            closeCasinoUI()
        end
        Wait(casinoOpen and 50 or 250)
    end
end)

exports('IsCasinoOpen', function() return casinoOpen end)

-- [CLIENT_PERF_ENTITY_AUDIT] Casino had no stop handler: release blip + UI focus.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if casinoBlip and DoesBlipExist(casinoBlip) then RemoveBlip(casinoBlip) end
    casinoBlip = nil
    pcall(closeCasinoUI)
end)
