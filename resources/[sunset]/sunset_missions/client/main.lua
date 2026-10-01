local contactPeds   = {}
local contactBlips  = {}
local tooltipShown  = {}
local nearContact   = nil

local PROMPT_DIST = 8.0

local function showHelp(text)
    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayHelp(0, false, true, -1)
end

local function showContactTooltip(id, ped, data)
    if GetResourceState('sunset_world') ~= 'started' then return end
    pcall(function()
        exports.sunset_world:NpcShowTooltip('msn_contact_' .. id, ped, {
            badge      = 'MISSION',
            badgeClass = 'mission',
            bodyClass  = 'mission',
            icon       = 'ph-briefcase',
            title      = data.name,
            desc       = data.subtitle or 'Mission Contact',
            offsetZ    = 0.45,
            key        = 'E',
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

    Wait(100)
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
end

AddEventHandler('onClientResourceStart', function(res)
    if res ~= GetCurrentResourceName() then return end
    Wait(1500)
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
    tooltipShown = {}
    MSN_NUI_HideAll()
end)

-- Proximity loop — renders overhead 3D tooltips and interaction hint
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        nearContact = nil
        local nearestDist = 999.0

        for id, cped in pairs(contactPeds) do
            if DoesEntityExist(cped) then
                local data = SunsetMissions.Contacts[id]
                local cpos = GetEntityCoords(cped)
                local dist = #(pos - cpos)
                if dist < nearestDist then nearestDist = dist end

                -- World tooltip above head while within PROMPT_DIST
                if data then
                    if dist <= PROMPT_DIST then
                        showContactTooltip(id, cped, data)
                        tooltipShown[id] = true
                    elseif tooltipShown[id] then
                        hideContactTooltip(id)
                        tooltipShown[id] = nil
                    end
                end

                if dist < SunsetMissions.Config.interactionRadius then
                    nearContact = id
                    if data then
                        showHelp(exports.sunset_core:Translate('hint.native.talk_to', { name = data.name }))
                    end
                end
            end
        end

        if nearestDist <= PROMPT_DIST then
            Wait(0)
        elseif nearestDist <= 35.0 then
            Wait(200)
        else
            Wait(600)
        end
    end
end)

-- E key handler
CreateThread(function()
    while true do
        Wait(0)
        if nearContact and IsControlJustReleased(0, 38) then
            if MSN_ActiveSession() then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('missions.message.you_are_already_on_a_mission'), 'warning')
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
    exports.sunset_ui:Notify(exports.sunset_core:Translate('missions.message.mission_accepted'), 'success')
    MSN_NUI_HideOffer()
    MSN_StartMissionRuntime(missionId, data)
end)

RegisterCommand('abandonmission', function()
    if MSN_ActiveSession() then
        MSN_AbortMission('Mission abandoned')
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('missions.message.no_active_mission'), 'warning')
    end
end, false)

RegisterCommand('cancelmission', function()
    if MSN_ActiveSession() then
        MSN_AbortMission('Mission cancelled')
    else
        exports.sunset_ui:Notify(exports.sunset_core:Translate('missions.message.no_active_mission'), 'warning')
    end
end, false)
