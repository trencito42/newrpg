-- ============================================================
--  sunset_carjack  ·  client/main.lua
-- ============================================================

local LOCKPICK_DIST     = 2.5
local NPC_INTERACT_DIST = 3.5

local CHOP_NPCS = {
    { coords = vector4(-1631.47, -968.58, 7.78, 358.84),  labelKey = "config.carjack.label.shady_car_dealer_del_perro.5961da67", label = 'Samsar Dubios (Del Perro)' },
    { coords = vector4(42.66, -1400.39, 29.35, 219.85),   labelKey = "config.carjack.label.shady_car_dealer_strawberry.0e7bda0a", label = 'Samsar Dubios (Strawberry)' },
    { coords = vector4(167.63, -1284.35, 29.50, 62.26),   labelKey = "config.carjack.label.shady_car_dealer_davis.9457a5dd", label = 'Samsar Dubios (Davis)' },
    { coords = vector4(1522.59, -2114.32, 76.68, 313.50), labelKey = "config.carjack.label.shady_car_dealer_el_burro.31082685", label = 'Samsar Dubios (El Burro)' },
    { coords = vector4(835.6, -3001.4, 5.9, 270.0),       labelKey = "config.carjack.label.shady_car_dealer_docks.b9ff7251", label = 'Samsar Dubios (Docks)' },
    { coords = vector4(2341.0, 3125.0, 48.2, 180.0),      labelKey = "config.carjack.label.shady_car_dealer_sandy_shores.e82d0d3c", label = 'Samsar Dubios (Sandy Shores)' },
    { coords = vector4(-219.0, 6382.0, 31.5, 45.0),       labelKey = "config.carjack.label.shady_car_dealer_paleto_bay.7013ddf5", label = 'Samsar Dubios (Paleto Bay)' },
}

local spawnedNpcs  = {}
local npcBlips     = {}
local nearVehicle  = nil
local nearNpcIdx   = nil
local menuOpen     = nil   -- 'vehicle' | 'npc' | nil
local inCooldown   = false
local hasStolenCar = false

-- ── UI helpers ───────────────────────────────────────────────
local function notify(msg, t) exports.sunset_ui:Notify(msg, t or 'info') end

local function openVehicleMenu(veh)
    local modelName = exports.sunset_vehicles:GetVehicleDisplayName(veh)
    exports.sunset_ui:Send('playerInteractionShow', {
        target  = { name = modelName, id = '' },
        actions = {
            { id = 'lockpick_vehicle', label = exports.sunset_core:Translate('carjack.ui.force_the_door_lockpick'), group = 'CIVILIAN' },
        },
    })
    exports.sunset_ui:SetFocus(true, true)
    menuOpen = 'vehicle'
end

local function openNpcMenu(idx)
    exports.sunset_ui:Send('playerInteractionShow', {
        target  = { name = CHOP_NPCS[idx].label, id = '' },
        actions = {
            { id = 'sell_stolen_car', label = exports.sunset_core:Translate('carjack.ui.sell_car'), group = 'CIVILIAN' },
        },
    })
    exports.sunset_ui:SetFocus(true, true)
    menuOpen = 'npc'
end

local function closeMenu()
    exports.sunset_ui:Send('playerInteractionHide', {})
    exports.sunset_ui:SetFocus(false, false)
    menuOpen = nil
end

-- ── Blipuri NPC (apar doar dupa lockpick reusit) ─────────────
local function showNpcBlips()
    for i, npc in ipairs(CHOP_NPCS) do
        if not npcBlips[i] then
            local b = Sunset.CreateSafeBlip(npc.coords, {
                sprite = 120,
                color = 2,
                scale = 0.85,
                name = npc.label,
                shortRange = false
            })
            if b then
                npcBlips[i] = b
            end
        end
    end
end

local function hideNpcBlips()
    for i, b in pairs(npcBlips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
        npcBlips[i] = nil
    end
end

-- ── Spawn NPC-uri ────────────────────────────────────────────
CreateThread(function()
    Sunset.AwaitGameReady()
    local ok, model = Sunset.RequestModelSafe('g_m_y_famca_01', 5000)
    if not ok then
        print('[sunset_carjack] chop NPC model load failed — skipping static NPC spawn')
        return
    end

    for i, npc in ipairs(CHOP_NPCS) do
        local ped = CreatePed(4, model,
            npc.coords.x, npc.coords.y, npc.coords.z - 1.0, npc.coords.w,
            false, true)
        if ped and ped ~= 0 and DoesEntityExist(ped) then
            SetEntityAsMissionEntity(ped, true, true)
            FreezeEntityPosition(ped, true)
            SetEntityInvincible(ped, true)
            SetBlockingOfNonTemporaryEvents(ped, true)
            TaskStartScenarioInPlace(ped, 'WORLD_HUMAN_SMOKING', 0, true)
            spawnedNpcs[i] = ped
        end
    end
    SetModelAsNoLongerNeeded(model)
end)

-- ── Proximitate ──────────────────────────────────────────────
CreateThread(function()
    while true do
        local sleep = 600
        local ped   = PlayerPedId()
        local pos   = GetEntityCoords(ped)

        local prevNpc = nearNpcIdx
        local prevVeh = nearVehicle

        nearNpcIdx = nil
        for i, npc in ipairs(CHOP_NPCS) do
            if spawnedNpcs[i] and DoesEntityExist(spawnedNpcs[i]) then
                if #(pos - vector3(npc.coords.x, npc.coords.y, npc.coords.z)) < NPC_INTERACT_DIST then
                    nearNpcIdx = i
                    sleep = 100
                    break
                end
            end
        end

        nearVehicle = nil
        if not nearNpcIdx then
            local bestDist = LOCKPICK_DIST
            for _, v in ipairs(GetGamePool('CVehicle')) do
                if DoesEntityExist(v) and not IsEntityDead(v) then
                    if GetPedInVehicleSeat(v, -1) == 0 then
                        local d = #(pos - GetEntityCoords(v))
                        if d < bestDist then bestDist = d; nearVehicle = v end
                    end
                end
            end
            -- The G-key thread polls the control per frame; this scan only needs
            -- to refresh the candidate (GetGamePool is expensive), not run per frame.
            if nearVehicle then sleep = 250 end
        end

        -- Inchide meniu daca ne-am mutat
        if menuOpen then
            if menuOpen == 'vehicle' and nearVehicle ~= prevVeh then closeMenu()
            elseif menuOpen == 'npc' and nearNpcIdx ~= prevNpc then closeMenu() end
        end

        Wait(sleep)
    end
end)

-- ── G key → deschide meniu ───────────────────────────────────
-- Cand suntem langa vehicul sau NPC, blocam G-ul de la sunset_interactions
-- si il gestionam noi cu IsDisabledControlJustPressed
CreateThread(function()
    while true do
        local active = nearVehicle ~= nil or nearNpcIdx ~= nil

        if active then
            -- Blocam G ca sa nu ajunga la sunset_interactions (care ar da "no player nearby")
            DisableControlAction(0, 51, true)

            if IsDisabledControlJustPressed(0, 51) and not inCooldown then
                if nearNpcIdx and menuOpen ~= 'npc' then
                    openNpcMenu(nearNpcIdx)
                elseif nearVehicle and DoesEntityExist(nearVehicle) and menuOpen ~= 'vehicle' then
                    local plate = (GetVehicleNumberPlateText(nearVehicle) or ''):gsub('%s+', ''):upper()
                    if plate ~= '' and Sunset.AwaitCallback('sunset:hasVehicleKeys', plate) then
                        -- Owned / keyed vehicles use the normal vehicle menu, not lockpick.
                    else
                        openVehicleMenu(nearVehicle)
                    end
                end
            end
            Wait(0)
        else
            -- Nimic in apropiere — G merge normal la sunset_interactions
            Wait(200)
        end
    end
end)

-- ── Actiuni NUI ──────────────────────────────────────────────
AddEventHandler('sunset:nui:playerInteractionClose', function()
    -- [AUDIT UI-HANG] Acest handler doar stergea flag-ul: JS-ul asteapta ca Lua
    -- sa trimita playerInteractionHide + SetFocus(false), deci meniul "Vinde
    -- masina" ramanea pe ecran cu focus blocat (nu mergea nici ESC, nici
    -- mersul pe jos - SetNuiFocus dezactiveaza comenzile). Acum inchide real.
    closeMenu()
end)

AddEventHandler('sunset:nui:playerInteractionAction', function(data)
    if not data or not data.action then return end

    if data.action == 'lockpick_vehicle' then
        closeMenu()
        if not nearVehicle or not DoesEntityExist(nearVehicle) then return end
        inCooldown = true

        local hasLockpick = Sunset.AwaitCallback('sunset:carjack:hasLockpick')
        if not hasLockpick then
            notify(exports.sunset_core:Translate('carjack.message.you_need_a_lockpick'), 'error')
            inCooldown = false
            return
        end

        exports.sunset_ui:StartLockpick({
            title = exports.sunset_core:Translate('carjack.presentation.vehicle_break_in'),
            subtitleKey = "config.carjack.subtitle.ignition_security_system.834cf32a", subtitle = 'Sistem Securitate Contact',
            difficulty = 'medium'
        }, function(success)
            if success then
                local ok, err = Sunset.AwaitCallback('sunset:carjack:onLockpickSuccess')
                if ok then
                    notify(exports.sunset_core:Translate('carjack.message.usa_fortata_urca_repede'), 'success')
                    if nearVehicle and DoesEntityExist(nearVehicle) then
                        SetPedIntoVehicle(PlayerPedId(), nearVehicle, -1)
                    end
                    hasStolenCar = true
                    showNpcBlips()
                else
                    notify(err or exports.sunset_core:Translate('carjack.msg.the_lockpick_broke'), 'error')
                end
            else
                Sunset.AwaitCallback('sunset:carjack:onLockpickFail')
                notify(exports.sunset_core:Translate('carjack.msg.the_lockpick_broke'), 'error')
            end
            SetTimeout(1500, function() inCooldown = false end)
        end)

    elseif data.action == 'sell_stolen_car' then
        closeMenu()
        local veh = GetVehiclePedIsIn(PlayerPedId(), false)
        if veh == 0 then notify(exports.sunset_core:Translate('carjack.message.you_need_to_be_in_the_car_to_sell'), 'error') return end
        inCooldown = true
        local modelHash = GetEntityModel(veh)
        local modelName = tostring(modelHash)
        for _, name in ipairs(GetAllVehicleModels and GetAllVehicleModels() or {}) do
            if GetHashKey(name) == modelHash then modelName = name break end
        end
        local netId = NetworkGetNetworkIdFromEntity(veh)
        local ok, result = Sunset.AwaitCallback('sunset:carjack:sell', { model = modelName, netId = netId })
        if ok then
            notify(exports.sunset_core:Translate('carjack.msg.sold_you_received_cash', { result = math.floor(tonumber(result) or 0) }), 'success')
            SetEntityAsMissionEntity(veh, false, true)
            DeleteVehicle(veh)
            hasStolenCar = false
            hideNpcBlips()
        else
            notify(result or exports.sunset_core:Translate('carjack.msg.could_not_sell_the_vehicle'), 'error')
        end
        SetTimeout(1500, function() inCooldown = false end)
    end
end)


-- [AUDIT P7-09/P8-32] Mission-flagged NPCs survive resource restarts; delete
-- them and their blips on stop to avoid duplicate chop-shop peds.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for i, ped in pairs(spawnedNpcs) do
        if DoesEntityExist(ped) then
            SetEntityAsMissionEntity(ped, true, true)
            DeleteEntity(ped)
        end
        spawnedNpcs[i] = nil
    end
    hideNpcBlips()
end)
