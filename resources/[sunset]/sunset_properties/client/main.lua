local cachedProperties = {}
local cachedMeta = nil
local insideProperty
local refreshPending = false
local panelSelectedId = nil
local propertiesPanelOpen = false
local managePropertyId = nil

-- Transition state machine — prevents concurrent enter/exit calls from
-- E-spam or rapid server events causing double-teleports or mutex races.
local TRANS_NONE     = 'NONE'
local TRANS_ENTERING = 'ENTERING'
local TRANS_INSIDE   = 'INSIDE'
local TRANS_EXITING  = 'EXITING'
local transState = TRANS_NONE

local function loadMeta()
    if cachedMeta then return cachedMeta end
    cachedMeta = Sunset.AwaitCallback('sunset:getPropertyMeta') or {}
    return cachedMeta
end

local function refreshProperties()
    cachedProperties = Sunset.AwaitCallback('sunset:getProperties') or {}
    TriggerEvent('sunset:client:registerPropertyZones', cachedProperties)
    TriggerEvent('sunset:properties:updated', cachedProperties, loadMeta())
    return cachedProperties
end

local function refreshSoon()
    if refreshPending then return end
    refreshPending = true
    CreateThread(function()
        if propertiesPanelOpen then
            Wait(250)
        else
            Wait(2000 + math.random(500, 3000))
        end
        refreshProperties()
        refreshPending = false
    end)
end

AddEventHandler('sunset:client:playerSpawned', function()
    insideProperty = nil
    transState = TRANS_NONE
    Wait(1500)
    refreshProperties()
end)
RegisterNetEvent('sunset:client:respawn', function()
    insideProperty = nil
    transState = TRANS_NONE
end)
RegisterNetEvent('sunset:death:forceHospital', function()
    insideProperty = nil
    transState = TRANS_NONE
end)
RegisterNetEvent('sunset:client:propertiesChanged', refreshSoon)
RegisterNetEvent('sunset:client:propertyMessage', function(text, kind) exports.sunset_ui:Notify(text or exports.sunset_core:Translate('property.update'), kind or 'info', 6500) end)

local function openProperties(properties, selectedId, opts)
    opts = opts or {}
    propertiesPanelOpen = true
    panelSelectedId = selectedId
    if opts.managePropertyId then
        managePropertyId = opts.managePropertyId
    elseif not opts.keepManage then
        managePropertyId = nil
    end
    exports.sunset_ui:Send('propertiesShow', {
        properties = properties or cachedProperties,
        selectedId = selectedId,
        meta = loadMeta(),
        managePropertyId = managePropertyId,
    })
    exports.sunset_ui:SetFocus(true, true)
end

exports('IsPanelOpen', function()
    return propertiesPanelOpen
end)

-- [AUDIT MENU-LAZY] Expose cached data so sunset_menu can read it without a
-- server round-trip on every M press.  The menu must NOT call sunset:getProperties
-- directly — it should use these exports instead.
exports('GetCachedProperties', function()
    return cachedProperties
end)
exports('GetCachedMeta', function()
    return cachedMeta
end)

exports('IsInsideProperty', function()
    return insideProperty ~= nil
end)

exports('GetInsideProperty', function()
    return insideProperty
end)

exports('CanAccessWardrobe', function()
    return insideProperty ~= nil and insideProperty.isOwnerOrRenter == true
end)

AddEventHandler('sunset:world:propertyInteract', function(prop)
    if insideProperty then return end
    local rows = refreshProperties()
    if prop and prop.id then
        local one = {}
        for _, row in ipairs(rows) do
            if tonumber(row.id) == tonumber(prop.id) then
                one[1] = row
                break
            end
        end
        openProperties(#one > 0 and one or { prop }, prop.id)
        return
    end
    openProperties(rows, prop and prop.id)
end)

local CLOSE_ACTIONS = {
    enter = true,
    buy = true,
    rent = true,
    sell = true,
}

local function runAction(action, propertyId, payload)
    action = tostring(action or '')
    if action == 'renters_load' then return end

    local callback = action == 'buy' and 'sunset:buyProperty'
        or action == 'rent' and 'sunset:rentProperty'
        or 'sunset:propertyAction'
    local ok, message
    if callback == 'sunset:propertyAction' then
        ok, message = Sunset.AwaitCallback(callback, action, propertyId, payload or {})
    else
        ok, message = Sunset.AwaitCallback(callback, propertyId)
    end
    exports.sunset_ui:Notify(message or exports.sunset_core:Translate(ok and 'property.update.success' or 'property.update.failed'), ok and 'success' or 'error', 6500)
    if ok then
        if CLOSE_ACTIONS[action] then
            propertiesPanelOpen = false
            managePropertyId = nil
            exports.sunset_ui:ReleaseFocusUnlessModal()
            exports.sunset_ui:Send('propertiesHide', {})
            panelSelectedId = nil
            if action == 'enter' or action == 'buy' or action == 'rent' then
                TriggerEvent('sunset:properties:closeMenu')
            end
            refreshSoon()
        elseif propertiesPanelOpen then
            local rows = refreshProperties()
            local refreshId = managePropertyId or panelSelectedId or propertyId
            exports.sunset_ui:Send('propertiesShow', {
                properties = rows,
                selectedId = refreshId,
                meta = loadMeta(),
                managePropertyId = managePropertyId,
            })
            if managePropertyId then
                exports.sunset_ui:Send('propertyManageRefresh', {
                    propertyId = managePropertyId,
                    properties = rows,
                })
            end
        else
            refreshSoon()
        end
    end
end

AddEventHandler('sunset:nui:propertyAction', function(data)
    CreateThread(function()
        runAction(
            tostring(data and data.action or ''),
            tonumber(data and data.propertyId),
            data and data.payload
        )
    end)
end)

AddEventHandler('sunset:nui:propertyRenters', function(data)
    CreateThread(function()
        local propertyId = tonumber(data and data.propertyId)
        if not propertyId then return end
        local renters, err = Sunset.AwaitCallback('sunset:getPropertyRenters', propertyId)
        if not renters then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('property.renters.load_failed'), 'error')
            return
        end
        exports.sunset_ui:Send('propertyRenters', { propertyId = propertyId, renters = renters })
    end)
end)

RegisterNetEvent('sunset:client:propertyInterior', function(data)
    if not data or not data.interior then return end
    -- Mutex: block duplicate transitions (E-spam / double server event)
    if transState ~= TRANS_NONE then return end
    transState = TRANS_ENTERING
    insideProperty = data

    -- Server already set routing bucket; restoreOnFail=false — can't safely
    -- undo the bucket change from the client side.
    local ok = Sunset.World.SafeTeleport(data.interior, {
        timeout       = 8000,
        restoreOnFail = false,
    })

    transState = TRANS_INSIDE
    DisplayRadar(false)

    local helpText = ('Inside %s — press E near the door to exit.'):format(data.label or 'house')
    if data.isOwnerOrRenter then
        helpText = helpText .. ' Use /wardrobe to change clothes.'
    end
    exports.sunset_ui:Notify(helpText, 'info', 6500)

    if not ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('property.world_slow'), 'warning', 5000)
    end
end)

RegisterNetEvent('sunset:client:propertyExited', function(data)
    -- Only allow exit from INSIDE; also allow NONE so a reconnect/respawn can clear state
    if transState ~= TRANS_INSIDE and transState ~= TRANS_NONE then return end
    transState = TRANS_EXITING
    insideProperty = nil

    if not data or not data.entry then
        transState = TRANS_NONE
        DisplayRadar(true)
        return
    end

    -- Restore is safe here — server has already moved routing bucket back to 0
    local ok = Sunset.World.SafeTeleport(data.entry, {
        timeout       = 8000,
        restoreOnFail = false,
    })

    transState = TRANS_NONE
    DisplayRadar(true)

    if not ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('property.world_slow'), 'warning', 5000)
    end
end)

CreateThread(function()
    while true do
        if insideProperty and insideProperty.interior then
            local ped = PlayerPedId()
            local pPos = GetEntityCoords(ped)
            local iPos = vector3(insideProperty.interior.x, insideProperty.interior.y, insideProperty.interior.z)
            local dist = #(pPos - iPos)
            if dist <= 3.5 then
                DisplayRadar(false)
                if IsControlJustReleased(0, 38) and not IsNuiFocused() then
                    TriggerServerEvent('sunset:server:exitProperty')
                end
                Wait(0)
            else
                Wait(300)
            end
        else
            Wait(500)
        end
    end
end)

RegisterCommand('sethome', function(_, args)
    local id = tonumber(args[1])
    if not id then return exports.sunset_ui:Notify(exports.sunset_core:Translate('property.sethome.usage'), 'error') end
    CreateThread(function()
        local ok, message = Sunset.AwaitCallback('sunset:setHome', id)
        exports.sunset_ui:Notify(message or exports.sunset_core:Translate('property.home.save_failed'), ok and 'success' or 'error')
    end)
end, false)

RegisterCommand('properties', function() openProperties(refreshProperties()) end, false)
RegisterCommand('house', function() openProperties(refreshProperties()) end, false)
RegisterCommand('houses', function() openProperties(refreshProperties()) end, false)
RegisterCommand('myhouse', function() openProperties(refreshProperties()) end, false)

AddEventHandler('sunset:nui:propertiesClose', function()
    propertiesPanelOpen = false
    panelSelectedId = nil
    managePropertyId = nil
    exports.sunset_ui:ReleaseFocusUnlessModal()
    exports.sunset_ui:Send('propertiesHide', {})
end)

-- [AUDIT P8-12] Force-hidden by another modal: clear flags only (the new modal
-- owns focus now, so do NOT release focus here).
AddEventHandler('sunset:nui:modalSuperseded', function(panel)
    if panel == 'properties' then
        propertiesPanelOpen = false
        panelSelectedId = nil
        managePropertyId = nil
    end
end)

-- [STALE FLAG FIX] Death/respawn force-close: clear panel flags so
-- ReleaseFocusUnlessModal is never blocked by a phantom properties panel.
AddEventHandler('sunset:ui:forceCloseAll', function()
    propertiesPanelOpen = false
    panelSelectedId = nil
    managePropertyId = nil
    -- If caught mid-transition, clear so future enter/exit events are accepted
    if transState == TRANS_ENTERING or transState == TRANS_EXITING then
        transState = TRANS_NONE
    end
end)

AddEventHandler('sunset:nui:propertyOpenManage', function(data)
    CreateThread(function()
        local id = tonumber(data and data.propertyId)
        if not id then return end
        if GetResourceState('sunset_menu') == 'started' and exports.sunset_menu:IsMenuOpen() then
            exports.sunset_menu:CloseMenu()
            Wait(100)
        end
        local rows = refreshProperties()
        managePropertyId = id
        openProperties(rows, id, { managePropertyId = id })
    end)
end)
