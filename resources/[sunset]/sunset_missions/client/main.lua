local contactPeds  = {}
local contactBlips = {}
local nearContact  = nil

local function showHelp(text)
    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayHelp(0, false, true, -1)
end

local function showContactTooltip(id, ped, data)
    if GetResourceState('sunset_world') ~= 'started' then return end
    pcall(function()
        exports.sunset_world:NpcShowTooltip('msn_contact_' .. id, ped, {
            badge     = 'MISSION',
            icon      = 'ph-briefcase',
            title     = data.name,
            desc      = data.subtitle,
            key       = 'E',
        })
    end)
end

local function hideContactTooltip(id)
    if GetResourceState('sunset_world') ~= 'started' then return end
    pcall(function() exports.sunset_world:NpcHideTooltip('msn_contact_' .. id) end)
end

local function spawnContact(id, data)
    local hash = GetHashKey(data.model)
    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) do Wait(50) t=t+50 if t>15000 then break end end

    if not HasModelLoaded(hash) then
        print(('[missions] model %s failed to load for contact %s'):format(data.model, id))
        SetModelAsNoLongerNeeded(hash)
        return
    end

    -- Retry CreatePed up to 3 times with a brief wait between attempts.
    -- CreatePed can return 0 if the world hasn't finished streaming at that position.
    local ped = 0
    for attempt = 1, 3 do
        ped = CreatePed(4, hash, data.coords.x, data.coords.y, data.coords.z, data.coords.w, false, false)
        if ped ~= 0 then break end
        print(('[missions] CreatePed attempt %d failed for %s — retrying in 2s'):format(attempt, id))
        Wait(2000)
    end
    if ped == 0 then
        print(('[missions] CreatePed gave up for contact %s at %s,%s,%s'):format(id, data.coords.x, data.coords.y, data.coords.z))
        SetModelAsNoLongerNeeded(hash)
        return
    end

    SetEntityAsMissionEntity(ped, true, true)
    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedFleeAttributes(ped, 0, false)
    if data.scenario then
        TaskStartScenarioInPlace(ped, data.scenario, 0, true)
    end
    SetModelAsNoLongerNeeded(hash)

    local blip = AddBlipForEntity(ped)
    SetBlipSprite(blip, SunsetMissions.Config.contactBlipSprite)
    SetBlipColour(blip, SunsetMissions.Config.contactBlipColor)
    SetBlipScale(blip, SunsetMissions.Config.contactBlipScale)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentString(data.name)
    EndTextCommandSetBlipName(blip)

    contactPeds[id]  = ped
    contactBlips[id] = blip

    showContactTooltip(id, ped, data)
end

AddEventHandler('onClientResourceStart', function(res)
    if res ~= GetCurrentResourceName() then return end
    Wait(2000)
    for id, data in pairs(SunsetMissions.Contacts) do
        spawnContact(id, data)
    end
end)

AddEventHandler('onClientResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for id, ped in pairs(contactPeds) do
        hideContactTooltip(id)
        if DoesEntityExist(ped) then
            SetEntityAsMissionEntity(ped, false, true)
            DeleteEntity(ped)
        end
        if contactBlips[id] then RemoveBlip(contactBlips[id]) end
    end
    contactPeds  = {}
    contactBlips = {}
    MSN_NUI_HideAll()
end)

-- Proximity loop — runs every frame only when near a contact to show native hint.
-- Uses BeginTextCommandDisplayHelp (per-frame, no stack) instead of Notify.
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        nearContact = nil

        for id, cped in pairs(contactPeds) do
            if DoesEntityExist(cped) then
                local cpos = GetEntityCoords(cped)
                if #(pos - cpos) < SunsetMissions.Config.interactionRadius then
                    nearContact = id
                    local data = SunsetMissions.Contacts[id]
                    showHelp(('Press ~INPUT_CONTEXT~ to talk to %s'):format(data.name))
                    break
                end
            end
        end

        -- far from all contacts → slow poll; near one → per-frame for smooth hint
        if nearContact then Wait(0) else Wait(400) end
    end
end)

-- E key handler
CreateThread(function()
    while true do
        Wait(0)
        if nearContact and IsControlJustReleased(0, 38) then
            if MSN_ActiveSession() then
                exports.sunset_ui:Notify('You are already on a mission', 'warning')
            else
                local contactId = nearContact
                local contact   = SunsetMissions.Contacts[contactId]
                if not contact then goto continue end

                local missionId = contact.missions and contact.missions[1]
                if not missionId then goto continue end

                local stats, _     = Sunset.AwaitCallback('sunset:missions:getStats')
                local cooldowns, _ = Sunset.AwaitCallback('sunset:missions:getCooldowns')

                MSN_NUI_ShowOffer(missionId, contactId, {}, stats, cooldowns)
                ::continue::
            end
        end
    end
end)

AddEventHandler('sunset:missions:client:accept', function(missionId)
    local data, err = Sunset.AwaitCallback('sunset:missions:accept', missionId)
    if not data then
        exports.sunset_ui:Notify(err or 'Could not start mission', 'error')
        return
    end
    exports.sunset_ui:Notify('Mission accepted', 'success')
    MSN_NUI_HideOffer()
    MSN_StartMissionRuntime(missionId, data)
end)

RegisterCommand('abandonmission', function()
    if MSN_ActiveSession() then
        MSN_AbortMission('Mission abandoned')
    else
        exports.sunset_ui:Notify('No active mission', 'warning')
    end
end, false)

RegisterCommand('cancelmission', function()
    if MSN_ActiveSession() then
        MSN_AbortMission('Mission cancelled')
    else
        exports.sunset_ui:Notify('No active mission', 'warning')
    end
end, false)
