local phoneOpen = false
local phoneOpening = false
local phonePresentation = 'closed'
local phoneOpenedForCall = false
local presentationCloseToken = 0
PhoneCallSnapshot = { state = 'IDLE' }
local phoneProp = nil
local lastToggleAt = 0
local PHONE_MODEL = `prop_amb_phone`
local TOGGLE_COOLDOWN_MS = 450

local function isChatOpen()
    if GetResourceState('sunset_chat') ~= 'started' then return false end
    local ok, open = pcall(function()
        return exports.sunset_chat:IsChatOpen()
    end)
    return ok and open == true
end

local function playPhoneSound(name)
    if name == 'open' then
        PlaySoundFrontend(-1, 'Pin_Good', 'Phone_SoundSet_Michael', true)
    else
        PlaySoundFrontend(-1, 'Put_Away', 'Phone_SoundSet_Michael', true)
    end
end

local function loadAnimDict(dict)
    RequestAnimDict(dict)
    local timeout = GetGameTimer() + 3000
    while not HasAnimDictLoaded(dict) do
        if GetGameTimer() > timeout then return false end
        Wait(10)
    end
    return true
end

local function attachPhoneProp(ped)
    if phoneProp and DoesEntityExist(phoneProp) then return end

    RequestModel(PHONE_MODEL)
    local timeout = GetGameTimer() + 3000
    while not HasModelLoaded(PHONE_MODEL) do
        if GetGameTimer() > timeout then return end
        Wait(10)
    end

    local coords = GetEntityCoords(ped)
    phoneProp = CreateObject(PHONE_MODEL, coords.x, coords.y, coords.z + 0.2, true, true, false)
    SetEntityCollision(phoneProp, false, false)
    local bone = GetPedBoneIndex(ped, 28422)
    AttachEntityToEntity(phoneProp, ped, bone, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, false, 2, true)
    SetModelAsNoLongerNeeded(PHONE_MODEL)
end

local function removePhoneProp()
    if phoneProp and DoesEntityExist(phoneProp) then
        DeleteEntity(phoneProp)
    end
    phoneProp = nil
end

local function playPhoneAnim(open)
    local ped = PlayerPedId()
    local dict = 'cellphone@'

    if open then
        if not loadAnimDict(dict) then return end
        TaskPlayAnim(ped, dict, 'cellphone_text_in', 3.0, -1, -1, 50, 0, false, false, false)
        Wait(400)
        if not phoneOpen then return end
        attachPhoneProp(ped)
        TaskPlayAnim(ped, dict, 'cellphone_text_read_base', 3.0, 3.0, -1, 49, 0, false, false, false)
    else
        if loadAnimDict(dict) then
            TaskPlayAnim(ped, dict, 'cellphone_text_out', 3.0, -1, -1, 50, 0, false, false, false)
            Wait(300)
        end
        removePhoneProp()
        StopAnimTask(ped, dict, 'cellphone_text_read_base', 1.0)
        StopAnimTask(ped, dict, 'cellphone_text_in', 1.0)
        StopAnimTask(ped, dict, 'cellphone_text_out', 1.0)
    end
end

local focusListing = nil

local function openPhone()
    if phoneOpen or phoneOpening then return end
    local okReady, ready = pcall(function() return exports.sunset_core:IsPlayerReady() end)
    if okReady and not ready then return end -- no phone before login/spawn finished
    if IsNuiFocused() or isChatOpen() then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('phone.message.close_the_current_menu_or_chat_before_opening_the'), 'info', 3500)
    end
    phoneOpening = true

    CreateThread(function()
        local data, err = Sunset.AwaitCallback('sunset:getPhoneData')
        if not data then
            phoneOpening = false
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('phone.msg.could_not_load_phone_data'), 'error')
            return
        end

        -- Another UI may have opened while phone data was loading. Never steal
        -- its focus after the asynchronous callback completes.
        if IsNuiFocused() or isChatOpen() then
            phoneOpening = false
            return
        end

        phoneOpen = true
        phoneOpening = false
        phonePresentation = 'full'
        DisablePlayerFiring(PlayerId(), true)
        playPhoneSound('open')
        playPhoneAnim(true)
        if data.prefs then SetPhonePrefs(data.prefs) end
        if data.prefs and data.prefs.layout then
            data.layout = data.prefs.layout
        else
            local layoutRaw = GetResourceKvpString('sunset_phone_layout')
            if layoutRaw and layoutRaw ~= '' then
                local okLayout, decoded = pcall(json.decode, layoutRaw)
                if okLayout and type(decoded) == 'table' then
                    data.layout = decoded
                    Sunset.AwaitCallback('sunset:phoneSaveLayout', decoded.grid)
                end
            end
        end
        if focusListing then
            data.openListingId = focusListing
            focusListing = nil
        end
        exports.sunset_ui:Send('phoneShow', data)
        exports.sunset_ui:Send('phonePresentation', { mode = 'full' })
        exports.sunset_ui:SetFocus(true, true, false, 'phone')
    end)
end

local function closePhone()
    TriggerEvent('sunset:phone:cameraStop')
    local shouldAnimate = phoneOpen or (phoneProp and DoesEntityExist(phoneProp))
    phoneOpen = false
    phoneOpening = false
    phonePresentation = 'closed'
    phoneOpenedForCall = false
    if shouldAnimate then
        playPhoneSound('close')
        CreateThread(function()
            playPhoneAnim(false)
        end)
    else
        removePhoneProp()
    end
    exports.sunset_ui:SetFocus(false, false, false, 'phone')
    exports.sunset_ui:Send('phonePresentation', { mode = 'closed' })
    exports.sunset_ui:Send('phoneHide', {})
end

local function callIsLive()
    local state = PhoneCallSnapshot and PhoneCallSnapshot.state
    return state == 'INCOMING_RINGING' or state == 'OUTGOING_RINGING' or state == 'ACTIVE'
end

local function playPeekAnim()
    local ped = PlayerPedId()
    StopAnimTask(ped, 'cellphone@', 'cellphone_text_read_base', 1.0)
    if PhoneCallSnapshot and PhoneCallSnapshot.state == 'ACTIVE' and loadAnimDict('cellphone@') then
        TaskPlayAnim(ped, 'cellphone@', 'cellphone_call_listen_base', 3.0, 3.0, -1, 49, 0, false, false, false)
    end
end

local function setPresentation(mode)
    if mode == 'closed' then
        closePhone()
        return
    end
    if phonePresentation == 'closed' then
        openPhone()
        return
    end
    if mode == 'peek' then
        TriggerEvent('sunset:phone:cameraStop')
        phonePresentation = 'peek'
        phoneOpen = true
        exports.sunset_ui:SetFocus(false, false, false, 'phone')
        exports.sunset_ui:Send('phonePresentation', { mode = 'peek' })
        playPeekAnim()
        return
    end
    phonePresentation = 'full'
    phoneOpen = true
    exports.sunset_ui:SetFocus(true, true, false, 'phone')
    exports.sunset_ui:Send('phonePresentation', { mode = 'full' })
end

function PhoneSetPresentation(mode)
    setPresentation(mode)
end

function PhoneSchedulePresentationClose()
    presentationCloseToken = presentationCloseToken + 1
    local token = presentationCloseToken
    local shouldClose = phonePresentation == 'peek' or phoneOpenedForCall
    if not shouldClose then return end
    CreateThread(function()
        Wait(1700)
        if token ~= presentationCloseToken then return end
        if callIsLive() then return end
        if phonePresentation ~= 'closed' then closePhone() end
    end)
end

function PhoneCancelPresentationClose()
    presentationCloseToken = presentationCloseToken + 1
end

function PhoneOpenForCall()
    if phonePresentation ~= 'closed' then return end
    phoneOpenedForCall = true
    openPhone()
end

local function togglePhone()
    local now = GetGameTimer()
    if now - lastToggleAt < TOGGLE_COOLDOWN_MS then return end
    lastToggleAt = now

    local cameraOn = false
    pcall(function() cameraOn = exports.sunset_phone:IsCameraActive() == true end)
    if cameraOn then
        TriggerEvent('sunset:phone:cameraStop')
        if not callIsLive() then
            closePhone()
            return
        end
    end

    if not callIsLive() then
        if phonePresentation == 'closed' then openPhone() else closePhone() end
        return
    end

    if phonePresentation == 'full' then
        setPresentation('peek')
    elseif phonePresentation == 'peek' or phonePresentation == 'closed' then
        setPresentation('full')
    end
end

PhonePrefs = PhonePrefs or { ringtone = true, notifySound = true }

function SetPhonePrefs(prefs)
    if type(prefs) ~= 'table' then return end
    PhonePrefs.ringtone = prefs.ringtone ~= false
    PhonePrefs.notifySound = prefs.notifySound ~= false
end

-- Known callback failures stay specific. Tables, timeouts and empty results
-- never reach Notify as "table: 0x..." or a generic rejection.
function PhoneExplain(err, fallbackKey)
    fallbackKey = fallbackKey or 'error.server_action_failed'
    if type(err) == 'table' then
        if type(err.localeKey) == 'string' and err.localeKey ~= '' then
            local translated = exports.sunset_core:Translate(err.localeKey, err.params)
            if type(translated) == 'string' and translated ~= '' and translated ~= err.localeKey then
                return translated
            end
        end
        return exports.sunset_core:Translate(fallbackKey)
    end
    if type(err) == 'string' and err ~= '' then
        if err:find('timed out', 1, true) then
            return exports.sunset_core:Translate('phone.message.request_timed_out')
        end
        return err
    end
    return exports.sunset_core:Translate(fallbackKey)
end

-- Actions started on the open phone stay on the in-phone toast.
-- External events (phone closed) still use the HUD notification.
function PhoneFeedback(message, kind, op, ok, extra)
    extra = type(extra) == 'table' and extra or {}
    extra.op = op
    extra.ok = ok == true
    if ok then extra.message = message else extra.error = message end
    if phoneOpen then
        exports.sunset_ui:Send('phoneActionResult', extra)
        return
    end
    if message and message ~= '' then
        exports.sunset_ui:Notify(message, kind or (ok and 'success' or 'error'))
    end
end

RegisterCommand('phone', function()
    if IsPauseMenuActive() then
        SetPauseMenuActive(false)
    end
    togglePhone()
end, false)
RegisterKeyMapping('phone', 'Open phone', 'keyboard', 'P')
exports('IsPhoneOpen', function()
    return phoneOpen == true
end)
exports('IsPhoneInteractive', function()
    return phonePresentation == 'full'
end)
exports('IsPhonePeeked', function()
    return phonePresentation == 'peek'
end)

CreateThread(function()
    while true do
        if phonePresentation == 'full' and IsPauseMenuActive() then
            SetPauseMenuActive(false)
        elseif phonePresentation == 'full' and not IsNuiFocused()
            and exports.sunset_ui:GetFocusOwner() == 'phone' then
            -- A late close acknowledgement from another NUI modal must not
            -- leave the visible phone without its cursor or keyboard focus.
            exports.sunset_ui:SetFocus(true, true, false, 'phone')
        end
        Wait(phoneOpen and 50 or 250)
    end
end)

-- Game clock only. The NUI must not use the CEF/system clock.
CreateThread(function()
    local last = ''
    while true do
        if phoneOpen then
            local key = ('%02d:%02d'):format(GetClockHours(), GetClockMinutes())
            if key ~= last then
                last = key
                exports.sunset_ui:Send('phoneClock', {
                    hours = GetClockHours(),
                    minutes = GetClockMinutes(),
                })
            end
            Wait(1000)
        else
            last = ''
            Wait(500)
        end
    end
end)

AddEventHandler('sunset:nui:phoneClose', function()
    if callIsLive() then
        setPresentation('peek')
        return
    end
    closePhone()
end)

AddEventHandler('sunset:phone:forceClose', function()
    if phoneOpen or phoneOpening then closePhone() end
end)

AddEventHandler('sunset:nui:phoneSend', function(data)
    CreateThread(function()
        data = data or {}
        local location = nil
        if tonumber(data.targetCharacterId) == -112 or tostring(data.phone) == '112' then
            local coords = GetEntityCoords(PlayerPedId())
            local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
            local street = GetStreetNameFromHashKey(streetHash)
            if crossingHash and crossingHash ~= 0 then
                local crossing = GetStreetNameFromHashKey(crossingHash)
                if crossing and crossing ~= '' then street = street .. ' / ' .. crossing end
            end
            local zone = GetNameOfZone(coords.x, coords.y, coords.z)
            local area = GetLabelText(zone)
            if not area or area == '' or area == 'NULL' then area = zone end
            location = { street = street, area = area }
        end

        -- AwaitCallback yields. Wrapping it in pcall drops the error return,
        -- so every real rejection collapsed into the generic "server rejected" line.
        local attachment = type(data.attachment) == 'table' and data.attachment or nil
        if attachment and attachment.type == 'location' then
            if attachment.mode == 'waypoint' then
                local blip = GetFirstBlipInfoId(8)
                if blip == 0 or not DoesBlipExist(blip) then
                    PhoneFeedback(exports.sunset_core:Translate('taxi.message.no_waypoint'), 'error', 'send', false, { localId = data.localId })
                    return
                end
                local coords = GetBlipInfoIdCoord(blip)
                attachment.x, attachment.y = coords.x, coords.y
            end
            local coords = attachment.mode == 'waypoint' and vector3(attachment.x, attachment.y, 0.0) or GetEntityCoords(PlayerPedId())
            local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
            local street = GetStreetNameFromHashKey(streetHash)
            if crossingHash and crossingHash ~= 0 then
                local crossing = GetStreetNameFromHashKey(crossingHash)
                if crossing and crossing ~= '' then street = street .. ' / ' .. crossing end
            end
            local zone = GetNameOfZone(coords.x, coords.y, coords.z)
            local area = GetLabelText(zone)
            if not area or area == '' or area == 'NULL' then area = zone end
            attachment.street = street
            attachment.zone = area
            attachment.url = nil
        elseif attachment and attachment.type == 'photo' then
            attachment = { type = 'photo', mediaId = tonumber(attachment.mediaId) }
        end
        local sent, sendErr = Sunset.AwaitCallback('sunset:phoneSend', tonumber(data.targetCharacterId), data.message, data.phone, location, attachment)
        if type(sent) ~= 'table' or sent.ok ~= true then
            PhoneFeedback(PhoneExplain(sendErr, 'phone.message.invalid_recipient_or_message'), 'error', 'send', false, {
                localId = data.localId,
            })
            return
        end
        exports.sunset_ui:Send('phoneActionResult', { op = 'send', ok = true, localId = data.localId, message = sent.message })
    end)
end)

AddEventHandler('sunset:nui:phoneAddContact', function(data)
    CreateThread(function()
        data = data or {}
        local res, err = Sunset.AwaitCallback('sunset:phoneAddContact', data.name, data.phone)
        if res and res.ok then
            local refreshed = Sunset.AwaitCallback('sunset:getPhoneData') or {}
            exports.sunset_ui:Send('phoneUpdate', refreshed)
            PhoneFeedback(exports.sunset_core:Translate('phone.msg.contact_added', { contact = res.contact and res.contact.name or exports.sunset_core:Translate('phone.word.friend') }), 'success', 'contact', true)
        else
            PhoneFeedback(PhoneExplain(err, 'phone.msg.could_not_save_contact'), 'error', 'contact', false)
        end
    end)
end)

AddEventHandler('sunset:nui:phoneDeleteContact', function(data)
    CreateThread(function()
        data = data or {}
        local res, err = Sunset.AwaitCallback('sunset:phoneDeleteContact', data.contactId)
        if res and res.ok then
            local refreshed = Sunset.AwaitCallback('sunset:getPhoneData') or {}
            exports.sunset_ui:Send('phoneUpdate', refreshed)
            PhoneFeedback(exports.sunset_core:Translate('phone.message.contact_deleted'), 'success', 'contact', true)
        else
            PhoneFeedback(PhoneExplain(err, 'phone.msg.could_not_delete_contact'), 'error', 'contact', false)
        end
    end)
end)

AddEventHandler('sunset:nui:phoneBankTransfer', function(data)
    CreateThread(function()
        data = data or {}
        local res, err = Sunset.AwaitCallback('sunset:phoneBankTransfer', tonumber(data.targetId), tonumber(data.amount))
        if res then
            exports.sunset_ui:Send('phoneUpdate', res)
            PhoneFeedback(exports.sunset_core:Translate('phone.msg.transfer_of_sent_successfully', { amount = tostring(tonumber(data.amount) or 0) }), 'success', 'transfer', true)
        else
            PhoneFeedback(PhoneExplain(err, 'phone.msg.transfer_failed'), 'error', 'transfer', false)
        end
    end)
end)

-- [PERF] Debounced full refresh: an SMS burst (or send+incoming overlapping)
-- used to fire one 3-query getPhoneData per event while the phone was open.
local refreshPending = false
local function refreshPhoneSoon()
    if refreshPending then return end
    refreshPending = true
    CreateThread(function()
        Wait(500)
        refreshPending = false
        if phoneOpen then
            local refreshed = Sunset.AwaitCallback('sunset:getPhoneData') or {}
            exports.sunset_ui:Send('phoneUpdate', refreshed)
        end
    end)
end

RegisterNetEvent('sunset:client:phoneNewMessage', function(msg)
    if not msg then return end
    local char = exports.sunset_core:GetCharacter()
    local mine = char and tonumber(msg.sender_character_id) == tonumber(char.id)
    if not mine and PhonePrefs.notifySound ~= false then
        PlaySoundFrontend(-1, 'Text_Arrive_Tone', 'Phone_SoundSet_Default', true)
    end
    if not phoneOpen then return end
    exports.sunset_ui:Send('phoneNewMessage', msg)
end)

AddEventHandler('sunset:client:playerSpawned', function()
    if phoneOpen or phoneOpening then closePhone() end
    exports.sunset_ui:Send('phoneReset', {})
end)

RegisterNetEvent('sunset:client:phoneMessage', function()
    if not phoneOpen then return end
    refreshPhoneSoon()
end)

RegisterNetEvent('sunset:client:characterRenamed', function()
    refreshPhoneSoon()
end)

CreateThread(function()
    while true do
        if phonePresentation == 'full' then
            DisableControlAction(0, 24, true)  -- attack
            DisableControlAction(0, 25, true)  -- aim
            DisableControlAction(0, 47, true)  -- weapon
            DisableControlAction(0, 58, true)
            DisableControlAction(0, 140, true) -- melee
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            DisableControlAction(0, 143, true)
            DisableControlAction(0, 257, true)
            DisableControlAction(0, 263, true)
            DisableControlAction(0, 264, true)
            DisableControlAction(0, 199, true) -- pause, only while the phone is open
            DisablePlayerFiring(PlayerId(), true)

            local ped = PlayerPedId()
            if not phoneProp or not DoesEntityExist(phoneProp) then
                attachPhoneProp(ped)
            end
            local cameraOn = false
            pcall(function() cameraOn = exports.sunset_phone:IsCameraActive() == true end)
            local anim = (PhoneCallSnapshot and PhoneCallSnapshot.state == 'ACTIVE') and 'cellphone_call_listen_base' or 'cellphone_text_read_base'
            if not cameraOn and not IsEntityPlayingAnim(ped, 'cellphone@', anim, 3) then
                if loadAnimDict('cellphone@') then
                    TaskPlayAnim(ped, 'cellphone@', anim, 3.0, 3.0, -1, 49, 0, false, false, false)
                end
            end
            Wait(0)
        else
            Wait(400)
        end
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    removePhoneProp()
    -- [RESTART SAFETY] never leave the phone cursor/anim behind
    if phoneOpen or phoneOpening then
        phoneOpen = false
        phoneOpening = false
        phonePresentation = 'closed'
        pcall(function()
            ClearPedTasks(PlayerPedId())
            exports.sunset_ui:Send('phoneHide', {})
            exports.sunset_ui:SetFocus(false, false, false, 'phone')
        end)
    end
end)

exports('Open', openPhone)

function OpenListing(listingId)
    listingId = tonumber(listingId)
    if not listingId then return end
    focusListing = listingId
    if phoneOpen then
        exports.sunset_ui:Send('phoneFocusListing', { listingId = listingId })
        focusListing = nil
        return
    end
    openPhone()
end
exports('OpenListing', OpenListing)
exports('Close', closePhone)
exports('IsOpen', function() return phoneOpen end)
