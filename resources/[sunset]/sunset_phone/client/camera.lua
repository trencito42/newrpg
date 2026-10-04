local active = false
local mode = 'rear'
local scriptCam = nil
local yaw, pitch, distance = 0.0, 0.0, 0.85
local capturing = false
local returnTo = nil
local hudHidden = false
local suppressedHud = false

local function notifyFail(key)
    exports.sunset_ui:Send('phoneActionResult', {
        op = 'camera',
        ok = false,
        error = exports.sunset_core:Translate(key or 'phone.message.photo_upload_failed'),
    })
end

local function destroyCam()
    if scriptCam and DoesCamExist(scriptCam) then
        RenderScriptCams(false, true, 250, true, true)
        DestroyCam(scriptCam, false)
    end
    scriptCam = nil
    if hudHidden then
        DisplayHud(true)
        DisplayRadar(true)
        SetTextChatEnabled(true)
        hudHidden = false
    end
    if suppressedHud and GetResourceState('sunset_hud') == 'started' then
        exports.sunset_hud:SetHudSuppressed(false)
    end
    suppressedHud = false
end

local function stopAnim()
    local ped = PlayerPedId()
    StopAnimTask(ped, 'cellphone@self', 'selfie', 1.0)
    StopAnimTask(ped, 'amb@world_human_mobile_film_shocking@male@base', 'base', 1.0)
end

local function playModeAnim()
    local ped = PlayerPedId()
    local dict = mode == 'selfie' and 'cellphone@self' or 'amb@world_human_mobile_film_shocking@male@base'
    local name = mode == 'selfie' and 'selfie' or 'base'
    RequestAnimDict(dict)
    local timeout = GetGameTimer() + 2000
    while not HasAnimDictLoaded(dict) do
        if GetGameTimer() > timeout then return end
        Wait(10)
    end
    if not active then return end
    TaskPlayAnim(ped, dict, name, 3.0, 3.0, -1, 49, 0, false, false, false)
end

local function blockedReason()
    local ped = PlayerPedId()
    if IsPedDeadOrDying(ped, true) or IsPedRagdoll(ped) then return 'phone.message.camera_unavailable' end
    if IsPedInAnyVehicle(ped, false) and GetPedInVehicleSeat(GetVehiclePedIsIn(ped, false), -1) == ped then
        return 'phone.message.camera_unavailable'
    end
    return nil
end

local function placeCam()
    if not scriptCam or not DoesCamExist(scriptCam) then return end
    local ped = PlayerPedId()
    local heading = GetEntityHeading(ped)
    local coords = GetEntityCoords(ped)
    local rad = math.rad(heading + yaw)
    if mode == 'selfie' then
        local dist = math.max(0.55, math.min(1.15, distance))
        local x = coords.x + math.sin(-rad) * dist
        local y = coords.y + math.cos(-rad) * dist
        local z = coords.z + 0.62 + (pitch * 0.004)
        SetCamCoord(scriptCam, x, y, z)
        PointCamAtPedBone(scriptCam, ped, 31086, 0.0, 0.0, 0.0, true)
    else
        local dist = math.max(0.35, math.min(0.9, distance))
        local x = coords.x - math.sin(-rad) * dist
        local y = coords.y - math.cos(-rad) * dist
        local z = coords.z + 0.62 + (pitch * 0.003)
        SetCamCoord(scriptCam, x, y, z)
        SetCamRot(scriptCam, pitch * 0.35, 0.0, heading + yaw, 2)
    end
end

local function stopCamera(silent)
    if not active and not scriptCam then return end
    active = false
    capturing = false
    destroyCam()
    stopAnim()
    exports.sunset_ui:Send('phoneCamera', { open = false })
    if not silent and exports.sunset_phone:IsPhoneInteractive() then
        exports.sunset_ui:SetFocus(true, true, false, 'phone')
    end
end

local function startCamera(data)
    local reason = blockedReason()
    if reason then
        notifyFail(reason)
        return
    end
    if active then return end
    active = true
    capturing = false
    mode = 'rear'
    yaw, pitch, distance = 0.0, 0.0, 0.85
    returnTo = data and data.returnTo or nil
    scriptCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamFov(scriptCam, mode == 'selfie' and 45.0 or 55.0)
    placeCam()
    RenderScriptCams(true, true, 250, true, true)
    DisplayHud(false)
    DisplayRadar(false)
    SetTextChatEnabled(false)
    hudHidden = true
    if GetResourceState('sunset_hud') == 'started' and not exports.sunset_hud:IsHudSuppressed() then
        exports.sunset_hud:SetHudSuppressed(true)
        suppressedHud = true
    end
    playModeAnim()
    exports.sunset_ui:SetFocus(true, true, true, 'phone')
    exports.sunset_ui:Send('phoneCamera', { open = true, mode = mode, returnTo = returnTo })
    CreateThread(function()
        while active do
            local ped = PlayerPedId()
            if IsPedDeadOrDying(ped, true) or IsPedRagdoll(ped) then
                stopCamera(true)
                break
            end
            HideHudAndRadarThisFrame()
            DisablePlayerFiring(PlayerId(), true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 37, true)
            DisableControlAction(0, 44, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            placeCam()
            Wait(0)
        end
    end)
end

local function parseUpload(body)
    if type(body) ~= 'string' or body == '' then return nil end
    local ok, decoded = pcall(json.decode, body)
    if not ok or type(decoded) ~= 'table' then return nil end
    local url = decoded.url or (decoded.data and decoded.data.url)
    if not url and type(decoded.attachments) == 'table' and decoded.attachments[1] then
        url = decoded.attachments[1].url or decoded.attachments[1].proxy_url
    end
    if not url and type(decoded.files) == 'table' and decoded.files[1] then
        url = decoded.files[1].url
    end
    return url, decoded.mime or decoded.contentType, tonumber(decoded.size)
end

local function mediaLog(stage, detail)
    local text = tostring(detail or ''):gsub('[%c]', ' '):sub(1, 180)
    print(('[PHONE_MEDIA] %s %s'):format(stage, text))
end

local function capture()
    if not active or capturing then return end
    if GetResourceState('screenshot-basic') ~= 'started' then
        mediaLog('UPLOAD_HTTP_FAILED', 'screenshot-basic stopped')
        notifyFail('phone.message.photo_upload_failed')
        return
    end
    capturing = true
    exports.sunset_ui:Send('phoneCamera', { open = true, chrome = false, mode = mode })
    CreateThread(function()
        local issued, err = Sunset.AwaitCallback('sunset:phoneMediaToken')
        if not active then
            capturing = false
            return
        end
        if type(issued) ~= 'table' or not issued.token then
            capturing = false
            exports.sunset_ui:Send('phoneCamera', { open = true, chrome = true, mode = mode })
            local stage = type(err) == 'table' and err.stage or nil
            if not stage then
                stage = type(err) == 'table' and err.localeKey == 'phone.message.gallery_full' and 'QUOTA_FULL' or 'TOKEN_FAILED'
            end
            mediaLog(stage, type(err) == 'table' and err.localeKey or 'token')
            notifyFail(type(err) == 'table' and err.localeKey or 'phone.message.photo_upload_failed')
            return
        end
        Wait(120)
        if not active then
            capturing = false
            return
        end
        local done = false
        exports['screenshot-basic']:requestScreenshotUpload(issued.uploadUrl or 'https://racket.cat/api/media/upload', 'files[]', {
            headers = {
                ['X-Media-Token'] = issued.token,
                ['X-Media-Type'] = 'phone_photo',
            },
        }, function(body)
            done = true
            CreateThread(function()
                local url = parseUpload(body)
                local saved, saveErr = nil, nil
                if url then
                    saved, saveErr = Sunset.AwaitCallback('sunset:phoneMediaCommit', issued.token)
                else
                    local snippet = type(body) == 'string' and body:gsub('[%c]', ' '):sub(1, 160) or ''
                    if snippet == '' then
                        mediaLog('UPLOAD_RESPONSE_INVALID', 'media=phone_photo type=empty')
                    else
                        local decodedOk, decoded = pcall(json.decode, body)
                        local code = decodedOk and type(decoded) == 'table' and tostring(decoded.code or decoded.error or '') or ''
                        local stage = decodedOk and type(decoded) == 'table' and 'UPLOAD_HTTP_FAILED' or 'UPLOAD_RESPONSE_INVALID'
                        mediaLog(stage, ('media=phone_photo type=%s bytes=%s code=%s'):format(type(body), #snippet, code:gsub('[%c]', ' '):sub(1, 80)))
                    end
                end
                capturing = false
                if not active then return end
                exports.sunset_ui:Send('phoneCamera', { open = true, chrome = true, mode = mode })
                if type(saved) == 'table' and saved.ok and saved.media then
                    if PhonePrefs and PhonePrefs.notifySound ~= false then
                        PlaySoundFrontend(-1, 'Camera_Shoot', 'Phone_SoundSet_Michael', true)
                    end
                    exports.sunset_ui:Send('phoneCameraResult', { media = saved.media, returnTo = returnTo })
                    if returnTo then stopCamera(false) end
                else
                    mediaLog(type(saveErr) == 'table' and saveErr.stage or 'COMMIT_FAILED', type(saveErr) == 'table' and saveErr.localeKey or 'commit')
                    notifyFail(type(saveErr) == 'table' and saveErr.localeKey or 'phone.message.photo_upload_failed')
                end
            end)
        end)
        local timeout = GetGameTimer() + 15000
        while not done and active and GetGameTimer() < timeout do Wait(50) end
        if not done then
            capturing = false
            if active then
                exports.sunset_ui:Send('phoneCamera', { open = true, chrome = true, mode = mode })
                mediaLog('TIMEOUT', 'screenshot upload')
                notifyFail('phone.message.photo_upload_failed')
            end
        end
    end)
end

AddEventHandler('sunset:phone:cameraStart', function(data)
    startCamera(data)
end)

AddEventHandler('sunset:phone:cameraStop', function()
    stopCamera(true)
end)

AddEventHandler('sunset:phone:cameraControl', function(data)
    data = data or {}
    local op = tostring(data.op or '')
    if op == 'close' then
        stopCamera(false)
        return
    end
    if not active then return end
    if op == 'flip' then
        mode = mode == 'rear' and 'selfie' or 'rear'
        yaw, pitch = 0.0, 0.0
        distance = mode == 'selfie' and 0.8 or 0.85
        if scriptCam then SetCamFov(scriptCam, mode == 'selfie' and 45.0 or 55.0) end
        playModeAnim()
        exports.sunset_ui:Send('phoneCamera', { open = true, mode = mode, chrome = true })
    elseif op == 'look' then
        yaw = math.max(-35.0, math.min(35.0, yaw + (tonumber(data.dx) or 0) * 0.15))
        pitch = math.max(-20.0, math.min(18.0, pitch + (tonumber(data.dy) or 0) * 0.12))
    elseif op == 'zoom' then
        distance = math.max(0.45, math.min(1.15, distance + (tonumber(data.delta) or 0)))
    elseif op == 'shutter' then
        capture()
    end
end)

AddEventHandler('sunset:police:jail', function()
    stopCamera(true)
end)

AddEventHandler('sunset:client:playerSpawned', function()
    stopCamera(true)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() and res ~= 'sunset_ui' and res ~= 'sunset_profile_media' then return end
    stopCamera(true)
end)

exports('IsCameraActive', function()
    return active == true
end)
