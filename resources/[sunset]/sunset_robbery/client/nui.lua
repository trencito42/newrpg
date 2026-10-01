-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release).
-- Falls back to the raw natives only if sunset_ui is not running.
function ROB_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if GetResourceState('sunset_ui') == 'started' then
        local ok, res = pcall(function()
            return exports.sunset_ui:SetFocus(hasFocus, hasCursor, keepInput == true, 'robbery')
        end)
        if ok then return res end
    end
    SetNuiFocus(hasFocus, hasCursor)
    SetNuiFocusKeepInput(keepInput == true)
    return true
end

RobberyNui = {}

function RobberyNui.send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

function RobberyNui.focus(hasFocus, hasCursor)
    ROB_SetNuiFocus(hasFocus == true, hasCursor == true)
end

RegisterNUICallback('hackClick', function(data, cb)
    TriggerServerEvent('sunset:robbery:hackClick', data and data.nodeId)
    cb('ok')
end)

RegisterNUICallback('hackClose', function(_, cb)
    RobberyNui.focus(false, false)
    RobberyAnims.stop()
    cb('ok')
end)

RegisterNUICallback('lootTake', function(data, cb)
    TriggerServerEvent('sunset:robbery:takeItem', data and data.displayId, data and data.uid)
    cb('ok')
end)

RegisterNUICallback('lootClose', function(_, cb)
    RobberyNui.focus(false, false)
    RobberyNui.send('lootHide', {})
    cb('ok')
end)

RegisterNUICallback('fenceSell', function(data, cb)
    TriggerEvent('sunset:robbery:nuiFenceSell', data)
    cb('ok')
end)

RegisterNUICallback('fenceClose', function(_, cb)
    RobberyNui.focus(false, false)
    RobberyNui.send('fenceHide', {})
    cb('ok')
end)

RegisterNUICallback('playSound', function(data, cb)
    local key = data and data.key
    local snd = key and SunsetRobbery.Sounds[key]
    if snd then
        PlaySoundFrontend(-1, snd.name, snd.set, true)
    end
    cb('ok')
end)

-- [NUI FOCUS] Guaranteed close path: release on resource stop / forced UI close.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
    if ok and owner == 'robbery' then
        pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'force') end)
    end
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    ROB_SetNuiFocus(false, false)
end)
