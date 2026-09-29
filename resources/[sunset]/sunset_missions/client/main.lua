local contactPeds  = {}
local contactBlips = {}
local nearContact  = nil

local function spawnContact(id, data)
    local hash = GetHashKey(data.model)
    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) do Wait(50) t=t+50 if t>10000 then break end end

    local ped = CreatePed(4, hash, data.coords.x, data.coords.y, data.coords.z, data.coords.w, false, false)
    if ped == 0 then SetModelAsNoLongerNeeded(hash) return end

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

-- spawn all contacts on resource start
AddEventHandler('onClientResourceStart', function(res)
    if res ~= GetCurrentResourceName() then return end
    Wait(2000)
    for id, data in pairs(SunsetMissions.Contacts) do
        spawnContact(id, data)
    end
end)

-- cleanup on resource stop
AddEventHandler('onClientResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for id, ped in pairs(contactPeds) do
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

-- interaction proximity loop
CreateThread(function()
    while true do
        Wait(200)
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        nearContact = nil

        for id, cped in pairs(contactPeds) do
            if DoesEntityExist(cped) then
                local cpos = GetEntityCoords(cped)
                if #(pos - cpos) < SunsetMissions.Config.interactionRadius then
                    nearContact = id
                    local data = SunsetMissions.Contacts[id]
                    exports.sunset_ui:Notify(('[E] Talk to %s'):format(data.name), 'info')
                    break
                end
            end
        end
    end
end)

-- E key handler
CreateThread(function()
    while true do
        Wait(0)
        if nearContact and IsControlJustReleased(0, 38) then
            if MSN_ActiveSession() then
                exports.sunset_ui:Notify('Already on a mission', 'warning')
            else
                local contactId = nearContact
                local contact   = SunsetMissions.Contacts[contactId]
                if not contact then goto continue end

                -- fetch stats + cooldowns
                local stats, _     = Sunset.AwaitCallback('sunset:missions:getStats')
                local cooldowns, _ = Sunset.AwaitCallback('sunset:missions:getCooldowns')

                -- pick first available mission for this contact
                local missionId = contact.missions and contact.missions[1]
                if not missionId then goto continue end

                MSN_NUI_ShowOffer(missionId, contactId, {}, stats, cooldowns)
                ::continue::
            end
        end
    end
end)

-- accept from NUI
AddEventHandler('sunset:missions:client:accept', function(missionId)
    local ok, result = Sunset.AwaitCallback('sunset:missions:accept', missionId)
    if not ok then
        exports.sunset_ui:Notify(result or 'Could not start mission', 'error')
        return
    end
    exports.sunset_ui:Notify('Mission started!', 'success')
    MSN_NUI_HideOffer()
    MSN_StartMissionRuntime(missionId, result)
end)

-- /abandonment command
RegisterCommand('abandonmission', function()
    if MSN_ActiveSession() then
        MSN_AbortMission('Mission abandoned')
    else
        exports.sunset_ui:Notify('No active mission', 'warning')
    end
end, false)
