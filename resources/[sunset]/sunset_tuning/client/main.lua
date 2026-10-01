-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release)
-- while executing native SetNuiFocus locally inside sunset_tuning so this resource's
-- CEF iframe receives the mouse and keyboard input.
function TUNING_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if hasFocus then
        local ok = false
        if GetResourceState('sunset_ui') == 'started' then
            local pOk, claimRes = pcall(function()
                return exports.sunset_ui:ClaimFocus('tuning')
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
            pcall(function()
                exports.sunset_ui:ReleaseFocus('tuning')
            end)
        end
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
        return true
    end
end

local STC = SunsetTuningClient
local panelOpen = false
local currentShop = nil
local draftTune = nil
local draftCosmetics = nil
local savedCosmetics = nil
local hasSavedTune = false
local currentPlate = ''
local currentVeh = 0

local function notify(msg, typ)
    exports.sunset_ui:Notify(msg, typ or 'info')
end

local function blocked()
    if IsNuiFocused() or IsPauseMenuActive() then return true end
    local ok, open = pcall(function() return exports.sunset_chat:IsChatOpen() end)
    return ok and open == true
end

local function getDriverVehicle()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return 0 end
    local veh = GetVehiclePedIsIn(ped, false)
    if GetPedInVehicleSeat(veh, -1) ~= ped then return 0 end
    return veh
end

local function nearestShop()
    local coords = GetEntityCoords(PlayerPedId())
    local best, bestDist = nil, SunsetTuning.InteractRadius + 1.0
    for _, shop in ipairs(SunsetTuning.Shops or {}) do
        local dist = #(coords - shop.coords)
        if dist < bestDist then
            bestDist = dist
            best = shop
        end
    end
    if best and bestDist <= SunsetTuning.InteractRadius then return best end
    return nil
end

local function sendUi(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

local function hardwareAvailability(veh)
    local out = {}
    SetVehicleModKit(veh, 0)
    for key, slot in pairs(SunsetTuning.HardwareSlots or {}) do
        out[key] = math.max(0, GetNumVehicleMods(veh, slot.modType))
    end
    out.turbo = true
    return out
end

local function visualAvailability(veh)
    SetVehicleModKit(veh, 0)
    return {
        spoiler = math.max(0, GetNumVehicleMods(veh, 0)),
        frontBumper = math.max(0, GetNumVehicleMods(veh, 1)),
        rearBumper = math.max(0, GetNumVehicleMods(veh, 2)),
        sideSkirt = math.max(0, GetNumVehicleMods(veh, 3)),
        exhaust = math.max(0, GetNumVehicleMods(veh, 4)),
        rollCage = math.max(0, GetNumVehicleMods(veh, 5)),
        grille = math.max(0, GetNumVehicleMods(veh, 6)),
        hood = math.max(0, GetNumVehicleMods(veh, 7)),
        leftFender = math.max(0, GetNumVehicleMods(veh, 8)),
        rightFender = math.max(0, GetNumVehicleMods(veh, 9)),
        roof = math.max(0, GetNumVehicleMods(veh, 10)),
        wheels = math.max(0, GetNumVehicleMods(veh, 23)),
        livery = math.max(GetNumVehicleMods(veh, 48), GetVehicleLiveryCount(veh)),
        windowTint = 6,
        neon = true,
        xenon = true,
    }
end

local tuningCam = nil
local camYaw = 45.0
local camPitch = 12.0
local camDist = 5.0
local camOffset = vector3(0.0, 0.0, 0.25)

local function updateTuningCam()
    if not tuningCam or not DoesCamExist(tuningCam) or currentVeh == 0 or not DoesEntityExist(currentVeh) then return end
    local vehHeading = GetEntityHeading(currentVeh)
    local targetCoords = GetOffsetFromEntityInWorldCoords(currentVeh, camOffset.x, camOffset.y, camOffset.z)

    local radYaw = math.rad((vehHeading + camYaw) % 360.0)
    local radPitch = math.rad(camPitch)

    local camX = targetCoords.x - math.sin(radYaw) * math.cos(radPitch) * camDist
    local camY = targetCoords.y + math.cos(radYaw) * math.cos(radPitch) * camDist
    local camZ = targetCoords.z + math.sin(radPitch) * camDist

    SetCamCoord(tuningCam, camX, camY, camZ)
    PointCamAtCoord(tuningCam, targetCoords.x, targetCoords.y, targetCoords.z)
end

local function focusTuningCam(partOrTab)
    if not partOrTab then return end
    local key = tostring(partOrTab):lower()
    if key:find('front') or key == 'hood' or key == 'grille' then
        camOffset = vector3(0.0, 1.6, 0.1)
        camYaw = 0.0
        camPitch = 8.0
        camDist = 3.6
    elseif key:find('rear') or key == 'exhaust' or key == 'spoiler' then
        camOffset = vector3(0.0, -1.8, 0.2)
        camYaw = 180.0
        camPitch = 12.0
        camDist = 3.8
    elseif key:find('wheel') or key:find('skirt') or key == 'brakes' or key == 'suspension' then
        camOffset = vector3(-1.1, 0.0, -0.1)
        camYaw = -90.0
        camPitch = 6.0
        camDist = 3.2
    elseif key == 'rollcage' or key == 'interior' then
        camOffset = vector3(0.0, 0.0, 0.3)
        camYaw = 45.0
        camPitch = 15.0
        camDist = 2.4
    else
        camOffset = vector3(0.0, 0.0, 0.25)
        camYaw = 45.0
        camPitch = 12.0
        camDist = 5.0
    end
    updateTuningCam()
end

local function createTuningCam(veh)
    if tuningCam and DoesCamExist(tuningCam) then
        DestroyCam(tuningCam, false)
        tuningCam = nil
    end
    tuningCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    focusTuningCam('overview')
    SetCamActive(tuningCam, true)
    RenderScriptCams(true, true, 800, true, true)
end

local function destroyTuningCam()
    if tuningCam and DoesCamExist(tuningCam) then
        RenderScriptCams(false, true, 600, true, true)
        DestroyCam(tuningCam, false)
        tuningCam = nil
    end
end

local function closePanel(restoreStock)
    if not panelOpen then return end
    panelOpen = false
    destroyTuningCam()
    TUNING_SetNuiFocus(false, false)
    exports.sunset_ui:Send('tuningUiClose', {})
    sendUi('close')
    if restoreStock and currentVeh ~= 0 and DoesEntityExist(currentVeh) then
        if savedCosmetics then
            ApplyCosmetics(currentVeh, savedCosmetics)
        end
        local modelName = STC.appliedVehicles[currentVeh] and STC.appliedVehicles[currentVeh].model
        if hasSavedTune and STC.plateTunes[currentPlate] then
            ApplyTune(currentVeh, STC.plateTunes[currentPlate], false, modelName)
        else
            ApplyTune(currentVeh, SunsetTuning.StockTune(), false, modelName)
        end
    end
    currentVeh = 0
    currentShop = nil
    draftTune = nil
    draftCosmetics = nil
    savedCosmetics = nil
end

local function openPanel(shop)
    local veh = getDriverVehicle()
    if veh == 0 then
        notify(exports.sunset_core:Translate('tuning.message.get_in_the_driver_seat_of_your_car_for'), 'error')
        return
    end

    local shopObj = shop or nearestShop()
    if not shopObj then
        notify(exports.sunset_core:Translate('tuning.message.you_are_not_at_a_tuning_shop'), 'error')
        return
    end

    local modelName = GetEntityArchetypeName(veh)
    if not modelName or modelName == '' then
        modelName = GetDisplayNameFromVehicleModel(GetEntityModel(veh))
    end
    if modelName then modelName = modelName:lower() end

    local caps = SunsetTuning.ProfileResolver.Resolve(modelName, GetVehicleClass(veh))
    if not caps.supported then
        notify(exports.sunset_core:Translate('tuning.message.ecu_tuning_is_not_available_for_this_vehicle_type'), 'error')
        return
    end

    local plate = STC.plateOf(veh)
    CaptureModelBaseline(veh)

    local payload, err = Sunset.AwaitCallback('sunset:tuning:getTune', plate, modelName)
    if not payload then
        notify(err or exports.sunset_core:Translate('tuning.msg.could_not_load_the_ecu_for'), 'error')
        return
    end

    local loadedTune, loadedCosmetics, isSaved = nil, nil, false
    if type(payload) == 'table' and payload.tune then
        loadedTune = SunsetTuning.SanitizeTune(payload.tune, caps)
        isSaved = payload.saved == true or not SunsetTuning.IsStockTune(loadedTune)
        loadedCosmetics = SunsetTuning.SanitizeCosmetics(payload.cosmetics or ReadCosmeticsFromVehicle(veh))
    else
        loadedTune = SunsetTuning.SanitizeTune(payload, caps)
        isSaved = not SunsetTuning.IsStockTune(loadedTune)
        loadedCosmetics = ReadCosmeticsFromVehicle(veh)
    end
    if loadedCosmetics.plateText == '' then
        loadedCosmetics.plateText = plate
    end

    -- Focus acquisition MUST be verified BEFORE creating camera and showing modal
    local focusOk = TUNING_SetNuiFocus(true, true)
    if not focusOk then
        notify(exports.sunset_core:Translate('tuning.message.interface_in_use'), 'error')
        return
    end

    currentVeh = veh
    currentPlate = plate
    currentShop = shopObj
    draftTune = loadedTune
    hasSavedTune = isSaved
    draftCosmetics = loadedCosmetics
    savedCosmetics = loadedCosmetics
    panelOpen = true

    createTuningCam(veh)
    exports.sunset_ui:Send('tuningUiOpen', {})

    sendUi('open', {
        tune = draftTune,
        cosmetics = draftCosmetics,
        saved = hasSavedTune,
        plate = currentPlate,
        model = modelName,
        capabilities = caps,
        drivetrainLabel = SunsetTuning.ProfileResolver.DisplayLabel(caps),
        shop = currentShop and currentShop.label or 'ECU Bay',
        costs = {
            save = SunsetTuning.SaveBaseCost,
            flash = SunsetTuning.FlashCost,
            dyno = SunsetTuning.DynoCost,
        },
        stages = SunsetTuning.Stages,
        exhaustModes = SunsetTuning.ExhaustModes,
        hardwareAvailability = hardwareAvailability(veh),
        visualAvailability = visualAvailability(veh),
        hardware = hardwareAvailability(veh),
        visual = visualAvailability(veh),
        hardwareSlots = SunsetTuning.HardwareSlots,
        featureCosts = SunsetTuning.FeatureCosts,
    })

    ApplyTune(currentVeh, draftTune, false, modelName)
    ApplyCosmetics(currentVeh, draftCosmetics, false)
end

function OpenTuningPanel(shop)
    openPanel(shop)
end

exports('OpenTuningPanel', OpenTuningPanel)
exports('IsTuningOpen', function() return panelOpen end)
exports('IsPanelOpen', function() return panelOpen end)

RegisterNUICallback('tuningClose', function(_, cb)
    closePanel(true)
    cb({ ok = true })
end)

RegisterNUICallback('emergencyEscape', function(data, cb)
    closePanel(true)
    TriggerEvent('sunset:ui:emergencyClose', 'tuning_nui_hold_esc')
    cb({ ok = true })
end)

RegisterNUICallback('tuningPreview', function(data, cb)
    if not panelOpen or currentVeh == 0 then cb({ ok = false }) return end
    draftTune = SunsetTuning.SanitizeTune(data.tune or draftTune, STC.appliedVehicles[currentVeh] and STC.appliedVehicles[currentVeh].caps)
    if data.cosmetics then
        draftCosmetics = SunsetTuning.SanitizeCosmetics(data.cosmetics)
    end
    local modelName = STC.appliedVehicles[currentVeh] and STC.appliedVehicles[currentVeh].model
    ApplyTune(currentVeh, draftTune, false, modelName)
    ApplyCosmetics(currentVeh, draftCosmetics, false)
    local wheelsCount = math.max(0, GetNumVehicleMods(currentVeh, 23))
    cb({ ok = true, wheelsCount = wheelsCount })
end)

RegisterNUICallback('tuningTestFlame', function(_, cb)
    if not panelOpen or currentVeh == 0 then cb({ ok = false }) return end
    if STC.BurstExhaust then STC.BurstExhaust(currentVeh, 'flash', 3) end
    cb({ ok = true })
end)

RegisterNUICallback('tuningGetQuote', function(data, cb)
    if not panelOpen or currentPlate == '' then cb({ ok = false, cost = 0 }) return end
    local flash = data and data.flash == true
    local quoteTune = data and data.tune or draftTune
    local quoteCosmetics = data and data.cosmetics or draftCosmetics
    local cost = Sunset.AwaitCallback('sunset:tuning:getInstallQuote', currentPlate, quoteTune, flash, quoteCosmetics)
    cb({ ok = true, cost = tonumber(cost) or 0 })
end)

RegisterNUICallback('tuningCamRotate', function(data, cb)
    if not panelOpen or currentVeh == 0 then cb({ ok = false }) return end
    local dx = tonumber(data and data.deltaX) or 0
    local dy = tonumber(data and data.deltaY) or 0
    camYaw = (camYaw - (dx * 0.45)) % 360.0
    camPitch = math.max(-10.0, math.min(50.0, camPitch + (dy * 0.3)))
    updateTuningCam()
    cb({ ok = true })
end)

RegisterNUICallback('tuningFocusPart', function(data, cb)
    if not panelOpen or currentVeh == 0 then cb({ ok = false }) return end
    focusTuningCam(data and (data.part or data.tab))
    cb({ ok = true })
end)

RegisterNUICallback('tuningSave', function(data, cb)
    if not panelOpen or currentPlate == '' then cb({ ok = false }) return end
    local flash = data.flash == true
    draftCosmetics = SunsetTuning.SanitizeCosmetics(data.cosmetics or draftCosmetics)
    local saved, err = Sunset.AwaitCallback('sunset:tuning:saveTune', currentPlate, data.tune or draftTune, flash, data.cosmetics or draftCosmetics)
    if not saved then
        notify(err or exports.sunset_core:Translate('tuning.msg.salvare_esuata'), 'error')
        cb({ ok = false, error = err })
        return
    end

    local oldPlate = currentPlate
    draftTune = SunsetTuning.SanitizeTune(saved.tune)
    if saved.cosmetics then draftCosmetics = SunsetTuning.SanitizeCosmetics(saved.cosmetics) end
    if saved.plate and saved.plate ~= '' then currentPlate = STC.normalizePlate(saved.plate) end
    hasSavedTune = true
    savedCosmetics = draftCosmetics
    STC.plateTunes[currentPlate] = draftTune
    STC.persistedPlates[currentPlate] = true
    if oldPlate ~= currentPlate then
        STC.plateTunes[oldPlate] = nil
        STC.persistedPlates[oldPlate] = nil
    end
    ApplyTune(currentVeh, draftTune, true, saved.model)
    ApplyCosmetics(currentVeh, draftCosmetics)
    if draftTune.nitrous and draftTune.nitrous.installed and STC.RefillNitrous then
        STC.RefillNitrous(currentVeh, 100.0)
    end
    if data and data.testBurst == true and STC.BurstExhaust then STC.BurstExhaust(currentVeh, 'flash', 3) end
    local costVal = saved.cost or 0
    if costVal > 0 then
        notify(exports.sunset_core:Translate('tuning.msg.ecu_modifications_saved', { cost_val = math.floor(tonumber(costVal) or 0) }), 'success')
    else
        notify(exports.sunset_core:Translate('tuning.message.modifications_saved_successfully_0'), 'success')
    end
    sendUi('saved', { saved = true, tune = draftTune, cosmetics = draftCosmetics, plate = currentPlate })
    cb({ ok = true, tune = draftTune })
end)

RegisterNUICallback('tuningDyno', function(_, cb)
    if not panelOpen or currentPlate == '' then cb({ ok = false }) return end
    if STC.IsDynoActive and STC.IsDynoActive() then cb({ ok = false }) return end

    local dynoSession, beginError = Sunset.AwaitCallback('sunset:tuning:beginDyno', currentPlate)
    if not dynoSession or not dynoSession.token then
        notify(beginError or exports.sunset_core:Translate('tuning.msg.dyno_unavailable_you_need_in_the', { dyno_cost = math.floor(tonumber(SunsetTuning.DynoCost) or 0) }), 'error')
        cb({ ok = false, error = beginError })
        return
    end

    TUNING_SetNuiFocus(false, false)
        sendUi('dynoRunning', {})

    SunsetTuningClient.RunDynoTest(currentShop, function(result)
        TUNING_SetNuiFocus(true, true)
        if not result then
            Sunset.AwaitCallback('sunset:tuning:cancelDyno', dynoSession.token)
            sendUi('dynoDone', { ok = false })
            cb({ ok = false })
            return
        end

        local dynoSaved, err = Sunset.AwaitCallback('sunset:tuning:finishDyno', dynoSession.token, result.hp, result.torque)
        if dynoSaved then
            if draftTune then
                draftTune.dyno = dynoSaved
                STC.plateTunes[currentPlate] = draftTune
                hasSavedTune = true
                STC.persistedPlates[currentPlate] = true
            end
            sendUi('dynoResult', { dyno = dynoSaved, result = result })
        else
            notify(err or exports.sunset_core:Translate('tuning.msg.dyno_failed_check_your_bank_money', { dyno_cost = tostring(SunsetTuning.DynoCost) }), 'error')
            sendUi('dynoDone', { ok = false })
        end
        cb({ ok = true })
    end)
end)

RegisterNUICallback('tuningLeaderboard', function(_, cb)
    local rows = Sunset.AwaitCallback('sunset:tuning:getLeaderboard')
    cb({ ok = true, rows = rows or {} })
end)

-- Harmony: secondary tuning shop (LS Customs uses faction HQ menu)
local tuningShopBlips = {}
local function setupTuningBlips()
    for _, b in ipairs(tuningShopBlips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
    end
    tuningShopBlips = {}

    for _, shop in ipairs(SunsetTuning.Shops or {}) do
        if shop.id ~= 'lsc_main' and shop.blip and shop.coords then
            local blip = Sunset.CreateSafeBlip(shop.coords, {
                sprite = shop.blip.sprite or 72,
                color = shop.blip.color or 47,
                scale = shop.blip.scale or 0.8,
                name = shop.label or exports.sunset_core:Translate('tuning.menu.ecu_tuning'),
                shortRange = true
            })
            if blip then
                tuningShopBlips[#tuningShopBlips + 1] = blip
            end
        end
    end
end

RegisterNetEvent('sunset:client:languageChanged', function()
    setupTuningBlips()
end)

CreateThread(function()
    Sunset.AwaitGameReady()
    setupTuningBlips()
end)

CreateThread(function()
    local shop = nil
    for _, s in ipairs(SunsetTuning.Shops or {}) do
        if s.id == 'lsc_harmony' then shop = s break end
    end
    while true do
        if shop and not panelOpen and not blocked() then
            local dist = #(GetEntityCoords(PlayerPedId()) - shop.coords)
            if dist <= SunsetTuning.InteractRadius and getDriverVehicle() ~= 0 then
                BeginTextCommandDisplayHelp('STRING')
                AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('hint.tuning.harmony'))
                EndTextCommandDisplayHelp(0, false, true, -1)
                if IsControlJustReleased(0, 38) then
                    TriggerEvent('sunset:tuning:openHarmonyMenu')
                end
                Wait(0)
            else
                Wait(dist > 30.0 and 1000 or 400)
            end
        else
            Wait(500)
        end
    end
end)

RegisterNetEvent('sunset:client:spawnOwnedVehicle', function(vehData)
    if not vehData or not vehData.plate then return end
    CreateThread(function()
        Wait(1200)
        local plate = STC.normalizePlate(vehData.plate)
        local props = vehData.props
        if type(props) == 'string' then
            local ok, decoded = pcall(json.decode, props)
            props = ok and decoded or {}
        end
        if props and props.ecu and not SunsetTuning.IsStockTune(props.ecu) then
            local tune = SunsetTuning.SanitizeTune(props.ecu)
            STC.plateTunes[plate] = tune
            STC.persistedPlates[plate] = true
            for _, veh in ipairs(GetGamePool('CVehicle')) do
                if STC.plateOf(veh) == plate then
                    ApplyTune(veh, tune, false, vehData.model)
                    break
                end
            end
        else
            STC.plateTunes[plate] = nil
            STC.persistedPlates[plate] = nil
        end
    end)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    closePanel(true)
    for i, b in ipairs(tuningShopBlips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
        tuningShopBlips[i] = nil
    end
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    if panelOpen then closePanel(true) end
end)

AddEventHandler('sunset:ui:emergencyClose', function()
    if panelOpen then closePanel(true) end
end)
