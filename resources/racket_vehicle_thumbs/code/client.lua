local cfg = RacketThumbs
local current = nil

local function drawQuad(a, b, c, d, color)
    DrawPoly(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, color[1], color[2], color[3], 255)
    DrawPoly(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z, color[1], color[2], color[3], 255)
    -- Both windings: different game builds may cull the interior side.
    DrawPoly(c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, color[1], color[2], color[3], 255)
    DrawPoly(d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, color[1], color[2], color[3], 255)
end

local function drawStudio()
    local center = cfg.Studio
    local half = cfg.StudioHalfSize
    local low, high = center.z - 0.04, center.z + cfg.StudioHeight
    -- Dual-pass: black background by default, white after server triggers captureWhite.
    local bg = current and current.bg
    local color = bg == 'white' and { 255, 255, 255 } or { 0, 0, 0 }
    local function point(x, y, z) return vector3(center.x + x, center.y + y, z) end
    local nw, ne = point(-half, half, low), point(half, half, low)
    local sw, se = point(-half, -half, low), point(half, -half, low)
    local nwTop, neTop = point(-half, half, high), point(half, half, high)
    local swTop, seTop = point(-half, -half, high), point(half, -half, high)
    drawQuad(sw, se, ne, nw, color)          -- floor
    drawQuad(nw, ne, neTop, nwTop, color)    -- north
    drawQuad(sw, se, seTop, swTop, color)    -- south
    drawQuad(sw, nw, nwTop, swTop, color)    -- west
    drawQuad(se, ne, neTop, seTop, color)    -- east
    drawQuad(swTop, seTop, neTop, nwTop, color) -- ceiling
end

local function cleanup()
    local state = current
    if not state then return end
    current = nil
    RenderScriptCams(false, false, 0, true, true)
    if state.camera and DoesCamExist(state.camera) then DestroyCam(state.camera, false) end
    if state.vehicle and DoesEntityExist(state.vehicle) then
        SetEntityAsMissionEntity(state.vehicle, true, true)
        DeleteEntity(state.vehicle)
    end
    ClearFocus()
    ClearOverrideWeather()
    NetworkClearClockTimeOverride()
    if state.ped and DoesEntityExist(state.ped) then
        SetEntityVisible(state.ped, state.wasVisible, false)
        FreezeEntityPosition(state.ped, state.wasFrozen)
    end
    DisplayHud(true)
    DisplayRadar(state.wasRadar)
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:ShowHudChrome() end)
    end
end

local function fail(token, reason)
    cleanup()
    TriggerServerEvent('racket_thumbs:clientFailed', token, tostring(reason))
end

local function prepareVehicle(token, model)
    local hash = GetHashKey(model)
    if not IsModelInCdimage(hash) or not IsModelAVehicle(hash) then
        error('Model is not a registered vehicle: ' .. model)
    end
    RequestModel(hash)
    local deadline = GetGameTimer() + cfg.ModelLoadTimeoutMs
    while not HasModelLoaded(hash) and GetGameTimer() < deadline do Wait(25) end
    if not HasModelLoaded(hash) then error('Vehicle model did not load: ' .. model) end
    if not current or current.token ~= token then return end

    local minimum, maximum = GetModelDimensions(hash)
    local width = math.max(0.5, maximum.x - minimum.x)
    local length = math.max(0.5, maximum.y - minimum.y)
    local height = math.max(0.5, maximum.z - minimum.z)
    local center = cfg.Studio
    local vehicleZ = center.z - minimum.z
    local vehicle = CreateVehicle(hash, center.x, center.y, vehicleZ, 0.0, false, false)
    SetModelAsNoLongerNeeded(hash)
    if vehicle == 0 or not DoesEntityExist(vehicle) then error('CreateVehicle failed for ' .. model) end
    current.vehicle = vehicle
    SetEntityAsMissionEntity(vehicle, true, true)
    FreezeEntityPosition(vehicle, true)
    SetEntityCollision(vehicle, false, false)
    SetVehicleDirtLevel(vehicle, 0.0)
    SetVehicleEngineOn(vehicle, false, true, true)
    SetVehicleLights(vehicle, 0)

    local aspect = GetAspectRatio(false)
    if not aspect or aspect < 1.0 then aspect = 16.0 / 9.0 end
    local fovRadians = math.rad(cfg.CameraFov)
    local projectedWidth = (width + length) * 0.71
    local distanceForWidth = projectedWidth / (2.0 * math.tan(fovRadians / 2.0) * aspect * cfg.CameraFill)
    local distanceForHeight = height / (2.0 * math.tan(fovRadians / 2.0) * cfg.CameraFill)
    local distance = math.max(4.0, distanceForWidth, distanceForHeight) + 1.4
    local azimuth = math.rad(cfg.CameraAzimuth)
    local targetZ = center.z + height * 0.45
    local camera = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    if not camera or camera == 0 then error('Camera creation failed') end
    current.camera = camera
    SetCamCoord(camera,
        center.x - math.sin(azimuth) * distance,
        center.y + math.cos(azimuth) * distance,
        targetZ + math.max(1.0, distance * cfg.CameraElevation))
    PointCamAtCoord(camera, center.x, center.y, targetZ)
    SetCamFov(camera, cfg.CameraFov)
    SetCamActive(camera, true)
    RenderScriptCams(true, true, 250, true, true)

    local ped = PlayerPedId()
    current.ped = ped
    current.wasVisible = IsEntityVisible(ped)
    current.wasFrozen = IsEntityPositionFrozen(ped)
    current.wasRadar = IsRadarEnabled()
    SetEntityVisible(ped, false, false)
    FreezeEntityPosition(ped, true)
    SetFocusPosAndVel(center.x, center.y, center.z, 0.0, 0.0, 0.0)
    RequestCollisionAtCoord(center.x, center.y, center.z)
    NetworkOverrideClockTime(12, 0, 0)
    SetOverrideWeather('CLEAR')
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:HideHudChrome() end)
    end
    Wait(cfg.SettleMs)
    -- Black background already set at initialization; signal server to capture black pass.
    if current and current.token == token then
        TriggerServerEvent('racket_thumbs:blackReady', token)
    end
end

RegisterNetEvent('racket_thumbs:begin', function(token, model)
    if type(token) ~= 'string' or type(model) ~= 'string' then return end
    cleanup()
    current = { token = token, vehicle = nil, camera = nil, ped = nil,
        wasVisible = true, wasFrozen = false, wasRadar = true, bg = 'black' }
    CreateThread(function()
        local ok, reason = pcall(prepareVehicle, token, model)
        if not ok and current and current.token == token then fail(token, reason) end
    end)
end)

RegisterNetEvent('racket_thumbs:captureWhite', function(token)
    if not current or current.token ~= token then return end
    current.bg = 'white'
    CreateThread(function()
        Wait(cfg.BgSettleMs)
        if current and current.token == token then
            TriggerServerEvent('racket_thumbs:whiteReady', token)
        end
    end)
end)

RegisterNetEvent('racket_thumbs:cleanup', function(token)
    if current and (not token or current.token == token) then cleanup() end
end)

RegisterNetEvent('racket_thumbs:catalogRequest', function(token)
    if type(token) ~= 'string' then return end
    local models = GetAllVehicleModels()
    TriggerServerEvent('racket_thumbs:catalogResponse', token, models)
end)

CreateThread(function()
    while true do
        if current then
            DisableAllControlActions(0)
            HideHudAndRadarThisFrame()
            DisplayHud(false)
            DisplayRadar(false)
            drawStudio()
            Wait(0)
        else
            Wait(250)
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then cleanup() end
end)
