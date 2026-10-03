local craftingOpen = false

local function hasOx()
    return GetResourceState('ox_lib') == 'started'
end

local function runCraftProgress(ms, label)
    if hasOx() then
        return exports.ox_lib:progressBar({
            duration = ms,
            label = label or exports.sunset_core:Translate('crafting.ui.crafting'),
            useWhileDead = false,
            canCancel = true,
            disable = { move = true, car = true, combat = true },
        })
    end
    Wait(ms)
    return true
end

AddEventHandler('sunset:world:openCrafting', function(stationId, station)
    if IsNuiFocused() then return end
    local data, err = Sunset.AwaitCallback('sunset:getCraftingMenu', stationId)
    if not data then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('crafting.msg.cannot_open_crafting'), 'error')
        return
    end
    craftingOpen = true
    exports.sunset_ui:Send('craftingShow', data)
    exports.sunset_ui:SetFocus(true, true)
end)

AddEventHandler('sunset:nui:craftingCraft', function(data)
    if not data or not data.stationId or not data.recipeId then return end

    local recipe = Sunset.CraftingRecipes[data.recipeId]
    local duration = recipe and recipe.time or 5000
    local label = recipe and recipe.label or 'Crafting'

    exports.sunset_ui:Send('craftingHide', {})
    exports.sunset_ui:SetFocus(false, false)

    local session, beginErr = Sunset.AwaitCallback('sunset:craftBegin', data.stationId, data.recipeId)
    if not session then
        exports.sunset_ui:Notify(beginErr or exports.sunset_core:Translate('crafting.msg.craft_failed'), 'error')
    elseif not runCraftProgress(session.duration or duration, label) then
        Sunset.AwaitCallback('sunset:craftCancel', session.token)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('crafting.message.crafting_cancelled'), 'warning')
    else
        local ok, err = Sunset.AwaitCallback('sunset:craftItem', data.stationId, data.recipeId, session.token)
        if ok then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('crafting.msg.crafted_successfully', { label = tostring(label) }), 'success')
        else
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('crafting.msg.craft_failed'), 'error')
        end
    end

    local refreshed = Sunset.AwaitCallback('sunset:getCraftingMenu', data.stationId)
    if refreshed and craftingOpen then
        exports.sunset_ui:Send('craftingShow', refreshed)
        exports.sunset_ui:SetFocus(true, true)
    else
        craftingOpen = false
    end
end)

AddEventHandler('sunset:nui:craftingClose', function()
    craftingOpen = false
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('craftingHide', {})
end)

CreateThread(function()
    Wait(3500)
    for id, station in pairs(Sunset.CraftingStations or {}) do
        TriggerEvent('sunset:world:registerCraftingStation', id, station)
    end
end)

RegisterCommand('crafting', function()
    local char = exports.sunset_core:GetCharacter()
    if not char then return exports.sunset_ui:Notify(exports.sunset_core:Translate('crafting.message.your_character_is_not_loaded_yet'), 'error') end
    local factionId = select(1, Sunset.GetCharacterFaction(char))
    local pos = GetEntityCoords(PlayerPedId())
    local closestId, closest, closestDistance
    for id, station in pairs(Sunset.CraftingStations or {}) do
        if station.access == 'public' or station.faction == factionId then
            local distance = #(pos - station.coords)
            if not closestDistance or distance < closestDistance then
                closestId, closest, closestDistance = id, station, distance
            end
        end
    end
    if not closest then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('crafting.message.no_crafting_station_is_available_for_your_current_faction'), 'error')
    end
    if closestDistance <= 4.0 then
        TriggerEvent('sunset:world:openCrafting', closestId, closest)
        return
    end
    SetNewWaypoint(closest.coords.x, closest.coords.y)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('crafting.msg.gps_set_to_enter_its_marker', { label = closest.label or exports.sunset_core:Translate('crafting.word.crafting_station') }), 'info', 9000)
end, false)

CreateThread(function()
    Wait(3500)
    TriggerEvent('chat:addSuggestion', '/crafting', 'Mark the nearest crafting station available to you')
end)
