-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release).
function MSN_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if GetResourceState('sunset_ui') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_ui:SetFocus(hasFocus, hasCursor, keepInput == true, 'missions')
    end)
    return ok and res ~= false
end

local nuiOpen  = false
local nuiFocus = false

local function send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

function MSN_NUI_ShowOffer(missionId, contactId, variant, stats, cooldowns)
    local def  = SunsetMissions.GetMission(missionId)
    local cont = SunsetMissions.Contacts[contactId]
    if not def or not cont then return end

    local cooldownSec = 0
    if cooldowns and cooldowns[missionId] then
        local remaining = def.cooldown - (os.time() - cooldowns[missionId])
        if remaining > 0 then cooldownSec = remaining end
    end

    send('missionOffer', {
        missionId   = missionId,
        label       = def.label,
        logo        = def.logo,
        area        = def.area,
        contact     = cont.name,
        subtitle    = cont.subtitle,
        rewards     = def.rewards,
        variant     = variant,
        cooldown    = cooldownSec,
        stats       = stats and stats[contactId] or nil,
    })
    MSN_SetNuiFocus(true, true)
    nuiOpen  = true
    nuiFocus = true
end

function MSN_NUI_HideOffer()
    send('missionOfferHide')
    MSN_SetNuiFocus(false, false)
    nuiOpen  = false
    nuiFocus = false
end

function MSN_NUI_ShowHUD(objective, sub, extra)
    send('hudShow', { objective = objective, sub = sub or '', extra = extra or {} })
end

function MSN_NUI_UpdateHUD(objective, sub, extra)
    -- nil objective means "don't change it"; pass through whatever was given
    send('hudUpdate', { objective = objective, sub = sub, extra = extra or {} })
end

function MSN_NUI_HideHUD()
    send('hudHide')
end

function MSN_NUI_ShowLockpick(cb)
    send('lockpickShow')
    MSN_SetNuiFocus(true, true)
    nuiOpen  = true
    nuiFocus = true
    _lockpickCb = cb
end

function MSN_NUI_ShowSeal(cb)
    send('sealShow')
    MSN_SetNuiFocus(true, true)
    nuiOpen  = true
    nuiFocus = true
    _sealCb = cb
end

function MSN_NUI_ShowComplete(data)
    send('missionComplete', data)
    MSN_SetNuiFocus(true, true)
    nuiOpen  = true
    nuiFocus = true
end

function MSN_NUI_HideAll()
    send('hideAll')
    MSN_SetNuiFocus(false, false)
    nuiOpen  = false
    nuiFocus = false
end

-- NUI callbacks
RegisterNUICallback('missionAccept', function(data, cb)
    cb('ok')
    MSN_NUI_HideOffer()
    TriggerEvent('sunset:missions:client:accept', data.missionId)
end)

RegisterNUICallback('missionDecline', function(_, cb)
    cb('ok')
    MSN_NUI_HideOffer()
end)

RegisterNUICallback('missionCompleteClose', function(_, cb)
    cb('ok')
    MSN_NUI_HideAll()
    TriggerEvent('sunset:missions:client:completeClose')
end)

RegisterNUICallback('lockpickResult', function(data, cb)
    cb('ok')
    MSN_SetNuiFocus(false, false)
    nuiOpen  = false
    nuiFocus = false
    if _lockpickCb then
        local fn = _lockpickCb
        _lockpickCb = nil
        fn(data.success)
    end
end)

RegisterNUICallback('sealResult', function(data, cb)
    cb('ok')
    MSN_SetNuiFocus(false, false)
    nuiOpen  = false
    nuiFocus = false
    if _sealCb then
        local fn = _sealCb
        _sealCb = nil
        fn(data.success)
    end
end)

-- [NUI FOCUS] Guaranteed close path: release on resource stop / forced UI close.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
    if ok and owner == 'missions' then
        pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'force') end)
    end
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    if nuiOpen then MSN_NUI_HideAll() end
end)
