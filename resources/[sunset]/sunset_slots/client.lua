-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release).
function SLOTS_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if GetResourceState('sunset_ui') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_ui:SetFocus(hasFocus, hasCursor, keepInput == true, 'slots')
    end)
    return ok and res ~= false
end

-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Slot Machines (client.lua)
-- ═══════════════════════════════════════════════════════════════

local open = false
local closestSlotMachine = nil
local currentSitObj = nil
local sessionToken = nil -- server-issued, rotates after every action (anti-replay)
local busy = false
local isSitting = false

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

local function KeyboardInput(textEntry, inputText, maxLength)
    AddTextEntry('FMMC_KEY_TIP1', textEntry)
    DisplayOnscreenKeyboard(1, 'FMMC_KEY_TIP1', '', inputText, '', '', '', maxLength)

    while UpdateOnscreenKeyboard() == 0 do
        Wait(0)
    end

    if UpdateOnscreenKeyboard() == 1 then
        local result = GetOnscreenKeyboardResult()
        Wait(300)
        return result
    else
        Wait(300)
        return nil
    end
end

local slotCam = nil

local function createSlotCam(prop, pos, heading)
    if slotCam then DestroyCam(slotCam, false) slotCam = nil end
    local camPos = nil
    local lookPos = nil
    if DoesEntityExist(prop) then
        camPos = GetOffsetFromEntityInWorldCoords(prop, 0.0, -0.85, 0.55)
        lookPos = GetOffsetFromEntityInWorldCoords(prop, 0.0, 0.0, 0.35)
    else
        local rad = math.rad(heading)
        camPos = vector3(pos.x + math.sin(rad) * 0.85, pos.y - math.cos(rad) * 0.85, pos.z + 0.55)
        lookPos = vector3(pos.x, pos.y, pos.z + 0.35)
    end
    slotCam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', camPos.x, camPos.y, camPos.z, 0.0, 0.0, 0.0, 50.0, true, 2)
    PointCamAtCoord(slotCam, lookPos.x, lookPos.y, lookPos.z)
    SetCamActive(slotCam, true)
    RenderScriptCams(true, true, 800, true, true)
end

local function destroySlotCam()
    if slotCam then
        RenderScriptCams(false, true, 600, true, true)
        DestroyCam(slotCam, false)
        slotCam = nil
    end
end

local currentScene = nil
local spawnedChairs = {}

local function spawnSlotChairs()
    local chairModel = GetHashKey('vw_prop_casino_chair_02a')
    RequestModel(chairModel)
    local chairDeadline = GetGameTimer() + 5000
    while not HasModelLoaded(chairModel) and GetGameTimer() < chairDeadline do Wait(10) end
    if not HasModelLoaded(chairModel) then return end

    for _, slot in ipairs(Config.Slots or {}) do
        local id = slot.id
        if not spawnedChairs[id] or not DoesEntityExist(spawnedChairs[id]) then
            local existing = GetClosestObjectOfType(slot.coords.x, slot.coords.y, slot.coords.z, 1.4, chairModel, false, false, false)
            if DoesEntityExist(existing) and existing ~= 0 then
                spawnedChairs[id] = existing
            else
                local rad = math.rad(slot.heading)
                local chairX = slot.coords.x + math.sin(rad) * 0.75
                local chairY = slot.coords.y - math.cos(rad) * 0.75
                local chairHeading = (slot.heading + 180.0) % 360.0
                local chairObj = CreateObject(chairModel, chairX, chairY, slot.coords.z, false, false, false)
                SetEntityHeading(chairObj, chairHeading)
                FreezeEntityPosition(chairObj, true)
                SetEntityInvincible(chairObj, true)
                spawnedChairs[id] = chairObj
            end
        end
    end
    SetModelAsNoLongerNeeded(chairModel)
end

local function cleanupSlotChairs()
    for id, chair in pairs(spawnedChairs) do
        if DoesEntityExist(chair) then
            DeleteObject(chair)
        end
    end
    spawnedChairs = {}
end

-- [CLIENT_PERF_ENTITY_AUDIT] `unsit` is defined below; without this forward
-- declaration the stop handler hit a nil global and skipped all cleanup.
local unsitHook

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        if unsitHook then pcall(unsitHook) end
        cleanupSlotChairs()
        destroySlotCam()
        if currentScene then
            NetworkStopSynchronisedScene(currentScene)
            currentScene = nil
        end
    end
end)

local function unsit()
    destroySlotCam()
    if isSitting then
        if currentScene then
            NetworkStopSynchronisedScene(currentScene)
            currentScene = nil
        end
        local playerPed = PlayerPedId()
        ClearPedTasks(playerPed)
        if currentSitObj then
            TriggerServerEvent('sunset_slots:leavePlace', currentSitObj)
            currentSitObj = nil
        end
        isSitting = false
        LocalPlayer.state:set('isCasinoSitting', false, false)
    end
end
unsitHook = unsit

local function sit(slotData)
    local ped = PlayerPedId()
    local pedCoords = GetEntityCoords(ped)
    local prop = nil
    
    if slotData.prop then
        prop = GetClosestObjectOfType(pedCoords.x, pedCoords.y, pedCoords.z, 2.0, GetHashKey(slotData.prop), false, false, false)
    end
    if not DoesEntityExist(prop) and Config.SlotProps then
        for _, propHash in ipairs(Config.SlotProps) do
            prop = GetClosestObjectOfType(pedCoords.x, pedCoords.y, pedCoords.z, 2.0, propHash, false, false, false)
            if DoesEntityExist(prop) then break end
        end
    end

    local pos = DoesEntityExist(prop) and GetEntityCoords(prop) or slotData.coords
    local heading = DoesEntityExist(prop) and GetEntityHeading(prop) or (slotData.heading or 0.0)
    local slotId = slotData.id or ('%.2f_%.2f_%.2f'):format(pos.x, pos.y, pos.z)

    local res, err = Sunset.AwaitCallback('sunset:slots:tryPlay', slotId)
    if type(res) ~= 'table' or not res.token then
        if err then exports.sunset_ui:Notify(err, 'error') end
        return
    end

    local sessionChips = tonumber(res.balance) or 0
    sessionToken = res.token

    -- Find casino chair for this slot machine
    local chair = spawnedChairs[slotData.id]
    if not DoesEntityExist(chair) then
        chair = GetClosestObjectOfType(pos.x, pos.y, pos.z, 1.4, GetHashKey('vw_prop_casino_chair_02a'), false, false, false)
        if not DoesEntityExist(chair) then
            chair = GetClosestObjectOfType(pos.x, pos.y, pos.z, 1.4, GetHashKey('vw_prop_casino_chair_01a'), false, false, false)
        end
    end

    local chairPos = nil
    local chairHeading = nil

    if DoesEntityExist(chair) then
        chairPos = GetEntityCoords(chair)
        chairHeading = GetEntityHeading(chair)
    else
        chairPos = DoesEntityExist(prop) and GetOffsetFromEntityInWorldCoords(prop, 0.0, -0.75, 0.0) or vector3(pos.x, pos.y, pos.z)
        chairHeading = (heading + 180.0) % 360.0
    end

    currentSitObj = slotId
    isSitting = true
    LocalPlayer.state:set('isCasinoSitting', true, false)

    -- Play casino synchronized sitting scene (1:1 identical posture to blackjack)
    local animDict = 'anim_casino_b@amb@casino@games@shared@player@'
    RequestAnimDict(animDict)
    local animDeadline = GetGameTimer() + 3000
    while not HasAnimDictLoaded(animDict) do
        if GetGameTimer() > animDeadline then break end
        Wait(10)
    end

    local scene = NetworkCreateSynchronisedScene(chairPos.x, chairPos.y, chairPos.z, 0.0, 0.0, chairHeading, 2, true, true, 1065353216, 0, 1065353216)
    NetworkAddPedToSynchronisedScene(ped, scene, animDict, 'idle_cardgames', 2.0, -2.0, 13, 16, 1148846080, 0)
    NetworkStartSynchronisedScene(scene)
    currentScene = scene
    
    -- Smoothly transition camera to slot machine screen
    createSlotCam(prop, pos, heading)
    Wait(500)

    -- Open NUI directly with loaded chips (SAMP style, no annoying input prompts!)
    SLOTS_SetNuiFocus(true, true)
    open = true
    SendNUIMessage({
        showPacanele = 'open',
        coinAmount = sessionChips
    })
end

RegisterNetEvent('sunset_slots:unsit', function()
    unsit()
end)

-- The NUI only requests actions; every result below comes from the server.
local function translateErr(res)
    if type(res) == 'table' and res.errKey then
        res.err = exports.sunset_core:Translate(res.errKey)
    end
    return res
end

local function serverAction(cbName, cb, ...)
    if busy or not sessionToken then cb({ ok = false }) return end
    busy = true
    local res, err = Sunset.AwaitCallback(cbName, sessionToken, ...)
    busy = false
    if type(res) ~= 'table' then
        cb({ ok = false, err = err })
        return
    end
    if res.token then sessionToken = res.token end
    cb(translateErr(res))
end

RegisterNUICallback('spin', function(data, cb)
    serverAction('sunset:slots:spin', cb, tonumber(data and data.bet))
end)

RegisterNUICallback('collect', function(_, cb)
    serverAction('sunset:slots:collect', cb)
end)

RegisterNUICallback('gamble', function(data, cb)
    serverAction('sunset:slots:gamble', cb, tonumber(data and data.color))
end)

RegisterNUICallback('exitWith', function(_, cb)
    cb('ok')
    SLOTS_SetNuiFocus(false, false)
    open = false
    sessionToken = nil
    busy = false
    Sunset.AwaitCallback('sunset:slots:exit')
    if Config.SittingEnabled then
        unsit()
    end
end)

-- ── Proximity loop ──
CreateThread(function()
    while true do
        local sleep = 500
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local inRange = false

        for _, slot in ipairs(Config.Slots or {}) do
            local dist = #(coords - slot.coords)
            if dist < 45.0 then
                inRange = true
            end
            if dist < 6.0 then
                sleep = 0
                DrawMarker(1, slot.coords.x, slot.coords.y, slot.coords.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    0.8, 0.8, 0.6,
                    255, 200, 0, 80,
                    false, false, 2, false, nil, nil, false)
                DrawMarker(2, slot.coords.x, slot.coords.y, slot.coords.z + 0.2,
                    0.0, 0.0, 0.0, 0.0, 180.0, 0.0,
                    0.2, 0.2, 0.2,
                    255, 200, 0, 180,
                    true, true, 2, false, nil, nil, false)
                if dist < 1.8 and not open and not isSitting then
                    DrawText3D(vector3(slot.coords.x, slot.coords.y, slot.coords.z + 0.3), exports.sunset_core:Translate('hint.slots.play'))
                    if IsControlJustReleased(0, 38) then -- E
                        sit(slot)
                    end
                end
            end
        end

        if inRange and not next(spawnedChairs) then
            spawnSlotChairs()
        elseif not inRange and next(spawnedChairs) then
            cleanupSlotChairs()
        end

        Wait(sleep)
    end
end)



-- [NUI FOCUS] Guaranteed close path: release on resource stop / forced UI close.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
    if ok and owner == 'slots' then
        pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'force') end)
    end
end)
