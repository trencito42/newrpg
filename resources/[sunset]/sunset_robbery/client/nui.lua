-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release)
-- while executing native SetNuiFocus locally inside sunset_robbery so this resource's
-- CEF iframe receives the mouse and keyboard input.
function ROB_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if hasFocus then
        local ok = false
        if GetResourceState('sunset_ui') == 'started' then
            local pOk, claimRes = pcall(function()
                return exports.sunset_ui:ClaimFocus('robbery')
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
            pcall(function() exports.sunset_ui:ReleaseFocus('robbery') end)
        end
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
        return true
    end
end

RobberyNui = {}

function RobberyNui.send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

function RobberyNui.focus(hasFocus, hasCursor)
    ROB_SetNuiFocus(hasFocus == true, hasCursor == true)
end

function RobberyNui.forceClose()
    ROB_SetNuiFocus(false, false)
    RobberyNui.send('lootHide', {})
    RobberyNui.send('fenceHide', {})
    RobberyNui.send('hackHide', {})
    if RobberyAnims and RobberyAnims.stop then
        pcall(RobberyAnims.stop)
    end
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
    RobberyNui.forceClose()
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    RobberyNui.focus(false, false)
end)

AddEventHandler('sunset:ui:emergencyClose', function()
    RobberyNui.forceClose()
end)
