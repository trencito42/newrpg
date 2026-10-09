local active = false
local mode = 'rear'
local scriptCam = nil
local yaw, pitch = 0.0, 0.0
local capturing = false
local captureToken = 0
local returnTo = nil
local hudHidden = false
local suppressedHud = false
local pedHiddenLocally = false

local REAR_LENS_FOV = {
    ['0.5'] = 90.0,
    ['1'] = 55.0,
    ['2'] = 32.0,
}
local REAR_LENS_ORDER = { '0.5', '1', '2' }
local rearLens = '1'
local camFov = 55.0
local targetFov = 55.0
local SELFIE_FOV = 42.0

local REAR_YAW_MAX = 58.0
local REAR_PITCH_MIN = -32.0
local REAR_PITCH_MAX = 28.0
local SELFIE_YAW_MAX = 26.0
local SELFIE_PITCH_MIN = -18.0
local SELFIE_PITCH_MAX = 14.0

local LOOK_SENS_X = 0.085
local LOOK_SENS_Y = 0.065

local function notifyFail(key)
    exports.sunset_ui:Send('phoneActionResult', {
        op = 'camera',
        ok = false,
        error = exports.sunset_core:Translate(key or 'phone.message.photo_upload_failed'),
    })
end

local function sendCamera(patch)
    patch = patch or {}
    patch.open = patch.open ~= false
    patch.mode = mode
    patch.lens = rearLens
    patch.chrome = patch.chrome ~= false
    exports.sunset_ui:Send('phoneCamera', patch)
end

local function setLocalPedVisible(visible)
    local ped = PlayerPedId()
    if not ped or ped == 0 then return end
    if visible then
        if pedHiddenLocally then
            SetEntityLocallyVisible(ped)
            pedHiddenLocally = false
        end
    else
        if not pedHiddenLocally then
            SetEntityLocallyInvisible(ped)
            pedHiddenLocally = true
        end
    end
end

local function destroyCam()
    setLocalPedVisible(true)
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
    StopAnimTask(ped, 'amb@world_human_mobile_film_shocking@female@base', 'base', 1.0)
end

local function playModeAnim()
    local ped = PlayerPedId()
    if mode == 'selfie' then
        local dict = 'cellphone@self'
        RequestAnimDict(dict)
        local timeout = GetGameTimer() + 2000
        while not HasAnimDictLoaded(dict) do
            if GetGameTimer() > timeout then return end
            Wait(10)
        end
        if not active then return end
        TaskPlayAnim(ped, dict, 'selfie', 3.0, 3.0, -1, 49, 0, false, false, false)
        return
    end
    local dict = IsPedMale(ped)
        and 'amb@world_human_mobile_film_shocking@male@base'
        or 'amb@world_human_mobile_film_shocking@female@base'
    RequestAnimDict(dict)
    local timeout = GetGameTimer() + 2000
    while not HasAnimDictLoaded(dict) do
        if GetGameTimer() > timeout then return end
        Wait(10)
    end
    if not active then return end
    TaskPlayAnim(ped, dict, 'base', 3.0, 3.0, -1, 49, 0, false, false, false)
end

local function blockedReason()
    local ped = PlayerPedId()
    if IsPedDeadOrDying(ped, true) or IsPedRagdoll(ped) then return 'phone.message.camera_unavailable' end
    if IsPedInAnyVehicle(ped, false) and GetPedInVehicleSeat(GetVehiclePedIsIn(ped, false), -1) == ped then
        return 'phone.message.camera_unavailable'
    end
    return nil
end

local function applyTargetFov()
    if mode == 'selfie' then
        targetFov = SELFIE_FOV
    else
        targetFov = REAR_LENS_FOV[rearLens] or REAR_LENS_FOV['1']
    end
end

local function setRearLens(id)
    if mode ~= 'rear' then return end
    id = tostring(id or '')
    if not REAR_LENS_FOV[id] then return end
    rearLens = id
    applyTargetFov()
    sendCamera({ captureState = 'ready' })
end

local function cycleRearLens(delta)
    if mode ~= 'rear' then return end
    local idx = 2
    for i, lens in ipairs(REAR_LENS_ORDER) do
        if lens == rearLens then idx = i break end
    end
    if (tonumber(delta) or 0) > 0 then
        idx = math.min(#REAR_LENS_ORDER, idx + 1)
    else
        idx = math.max(1, idx - 1)
    end
    setRearLens(REAR_LENS_ORDER[idx])
end

local function clampLook()
    if mode == 'selfie' then
        yaw = math.max(-SELFIE_YAW_MAX, math.min(SELFIE_YAW_MAX, yaw))
        pitch = math.max(SELFIE_PITCH_MIN, math.min(SELFIE_PITCH_MAX, pitch))
    else
        yaw = math.max(-REAR_YAW_MAX, math.min(REAR_YAW_MAX, yaw))
        pitch = math.max(REAR_PITCH_MIN, math.min(REAR_PITCH_MAX, pitch))
    end
end

local function placeCam()
    if not scriptCam or not DoesCamExist(scriptCam) then return end
    local ped = PlayerPedId()
    local heading = GetEntityHeading(ped)

    if mode == 'rear' then
        setLocalPedVisible(false)
        -- Phone at chest height, lens faces world forward (entity +Y), not behind the ped.
        local camPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 0.36, 0.66)
        SetCamCoord(scriptCam, camPos.x, camPos.y, camPos.z)
        SetCamRot(scriptCam, pitch, 0.0, heading + yaw, 2)
    else
        setLocalPedVisible(true)
        local head = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
        local dist = 0.68
        local rad = math.rad(heading + yaw)
        local camX = head.x + math.sin(-rad) * dist
        local camY = head.y + math.cos(-rad) * dist
        local camZ = head.z + 0.04 + (pitch * 0.004)
        SetCamCoord(scriptCam, camX, camY, camZ)
        PointCamAtPedBone(scriptCam, ped, 31086, 0.0, 0.02, 0.0, true)
    end

    camFov = camFov + (targetFov - camFov) * 0.14
    if math.abs(camFov - targetFov) < 0.05 then camFov = targetFov end
    SetCamFov(scriptCam, camFov)
end

local function stopCamera(silent)
    if not active and not scriptCam then return end
    active = false
    capturing = false
    captureToken = captureToken + 1
    destroyCam()
    stopAnim()
    sendCamera({ open = false })
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
    captureToken = captureToken + 1
    mode = 'rear'
    yaw, pitch = 0.0, 0.0
    rearLens = '1'
    camFov = REAR_LENS_FOV['1']
    applyTargetFov()
    returnTo = data and data.returnTo or nil
    scriptCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamFov(scriptCam, camFov)
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
    sendCamera({ captureState = 'ready', returnTo = returnTo })
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
        sendCamera({ captureState = 'error', chrome = true })
        return
    end
    capturing = true
    local token = captureToken + 1
    captureToken = token
    sendCamera({ chrome = false, captureState = 'capturing' })
    CreateThread(function()
        local issued, err = Sunset.AwaitCallback('sunset:phoneMediaToken')
        if not active or token ~= captureToken then
            capturing = false
            return
        end
        if type(issued) ~= 'table' or not issued.token then
            capturing = false
            local stage = type(err) == 'table' and err.stage or nil
            if not stage then
                stage = type(err) == 'table' and err.localeKey == 'phone.message.gallery_full' and 'QUOTA_FULL' or 'TOKEN_FAILED'
            end
            mediaLog(stage, type(err) == 'table' and err.localeKey or 'token')
            notifyFail(type(err) == 'table' and err.localeKey or 'phone.message.photo_upload_failed')
            sendCamera({ chrome = true, captureState = 'error' })
            return
        end
        sendCamera({ chrome = false, captureState = 'saving' })
        Wait(120)
        if not active or token ~= captureToken then
            capturing = false
            return
        end
        local captureEncoding = 'webp'
        local captureQuality = 0.78
        local done = false
        exports['screenshot-basic']:requestScreenshotUpload(issued.uploadUrl or 'https://racket.cat/api/media/upload', 'files[]', {
            headers = {
                ['X-Media-Token'] = issued.token,
                ['X-Media-Type'] = 'phone_photo',
            },
            encoding = captureEncoding,
            quality = captureQuality,
        }, function(body)
            done = true
            CreateThread(function()
                local respLen = type(body) == 'string' and #body or 0
                local url = parseUpload(body)
                local saved, saveErr = nil, nil
                if url then
                    saved, saveErr = Sunset.AwaitCallback('sunset:phoneMediaCommit', issued.token)
                else
                    local snippet = type(body) == 'string' and body:gsub('[%c]', ' '):sub(1, 160) or ''
                    if snippet == '' then
                        mediaLog('UPLOAD_RESPONSE_INVALID', ('media=phone_photo encoding=%s quality=%.2f resp_len=0'):format(captureEncoding, captureQuality))
                    else
                        local decodedOk, decoded = pcall(json.decode, body)
                        local logStage, logDetail
                        if decodedOk and type(decoded) == 'table' then
                            local appCode = tostring(decoded.code or decoded.error or '')
                            if appCode == 'oversized' then
                                logStage = 'APPLICATION_REJECTED_OVERSIZED'
                            else
                                logStage = 'UPLOAD_HTTP_FAILED'
                            end
                            logDetail = ('media=phone_photo encoding=%s quality=%.2f app_code=%s resp_len=%d'):format(
                                captureEncoding, captureQuality, appCode:gsub('[%c]', ' '):sub(1, 80), respLen)
                        else
                            if snippet:find('413', 1, true) then
                                logStage = 'PROXY_OR_UPSTREAM_413'
                            else
                                logStage = 'UPLOAD_RESPONSE_INVALID'
                            end
                            logDetail = ('media=phone_photo encoding=%s quality=%.2f resp_len=%d'):format(
                                captureEncoding, captureQuality, respLen)
                        end
                        mediaLog(logStage, logDetail)
                    end
                end
                capturing = false
                if not active or token ~= captureToken then return end
                if type(saved) == 'table' and saved.ok and saved.media then
                    if PhonePrefs and PhonePrefs.notifySound ~= false then
                        PlaySoundFrontend(-1, 'Camera_Shoot', 'Phone_SoundSet_Michael', true)
                    end
                    sendCamera({ chrome = true, captureState = 'saved' })
                    exports.sunset_ui:Send('phoneCameraResult', { media = saved.media, returnTo = returnTo })
                    if returnTo then stopCamera(false) end
                else
                    mediaLog(type(saveErr) == 'table' and saveErr.stage or 'COMMIT_FAILED', type(saveErr) == 'table' and saveErr.localeKey or 'commit')
                    notifyFail(type(saveErr) == 'table' and saveErr.localeKey or 'phone.message.photo_upload_failed')
                    sendCamera({ chrome = true, captureState = 'error' })
                end
            end)
        end)
        local timeout = GetGameTimer() + 15000
        while not done and active and token == captureToken and GetGameTimer() < timeout do Wait(50) end
        if not done and token == captureToken then
            capturing = false
            if active then
                mediaLog('TIMEOUT', 'screenshot upload')
                notifyFail('phone.message.photo_upload_failed')
                sendCamera({ chrome = true, captureState = 'error' })
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
    if capturing then return end
    if op == 'flip' then
        mode = mode == 'rear' and 'selfie' or 'rear'
        yaw, pitch = 0.0, 0.0
        applyTargetFov()
        camFov = targetFov
        if scriptCam then SetCamFov(scriptCam, camFov) end
        playModeAnim()
        sendCamera({ captureState = 'ready' })
    elseif op == 'look' then
        if data.aim ~= true then return end
        yaw = yaw + (tonumber(data.dx) or 0) * LOOK_SENS_X
        pitch = pitch + (tonumber(data.dy) or 0) * LOOK_SENS_Y
        clampLook()
    elseif op == 'lens' then
        setRearLens(data.lens)
    elseif op == 'zoom' then
        cycleRearLens(tonumber(data.delta) or 0)
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
