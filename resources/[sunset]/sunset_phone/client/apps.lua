local callSnapshot = nil
local ringToken = 0

local function notify(message, kind)
    if not message or message == '' then return end
    exports.sunset_ui:Notify(message, kind or 'info')
end

local function sendApp(app, data, token)
    exports.sunset_ui:Send('phoneAppData', { app = app, token = token, data = data or {} })
end

local function stopRing()
    ringToken = ringToken + 1
end

local function startRing()
    stopRing()
    local token = ringToken
    CreateThread(function()
        while token == ringToken and callSnapshot and callSnapshot.state == 'INCOMING_RINGING' do
            PlaySoundFrontend(-1, 'Remote_Ring', 'Phone_SoundSet_Michael', true)
            Wait(2800)
        end
    end)
end

local function plateMatches(entityPlate, wanted)
    local a = (tostring(entityPlate or ''):gsub('%s+', '')):upper()
    local b = (tostring(wanted or ''):gsub('%s+', '')):upper()
    return a ~= '' and a == b
end

local function waypoint(x, y, message)
    x, y = tonumber(x), tonumber(y)
    if not x or not y then
        notify(exports.sunset_core:Translate('phone.ui.location_unavailable'), 'error')
        return false
    end
    SetNewWaypoint(x + 0.0, y + 0.0)
    notify(message or exports.sunset_core:Translate('phone.ui.waypoint_set'), 'success')
    return true
end

local function destinationPins()
    local data = Sunset.AwaitCallback('sunset:getTaxiAppData')
    local pins = {}
    for _, dest in ipairs(data and data.destinations or {}) do
        if dest.x and dest.y then
            pins[#pins + 1] = {
                id = dest.id,
                label = dest.label,
                category = dest.category or 'Other',
                x = dest.x,
                y = dest.y,
            }
        end
    end
    if Config and Config.CNN and Config.CNN.locations then
        for i, loc in ipairs(Config.CNN.locations) do
            local coords = loc.coords
            if coords then
                pins[#pins + 1] = {
                    id = 'cnn_' .. i,
                    label = 'Weazel / CNN',
                    category = 'News',
                    x = coords.x,
                    y = coords.y,
                }
            end
        end
    end
    if SunsetImpound and SunsetImpound.Config and SunsetImpound.Config.lot then
        local lot = SunsetImpound.Config.lot
        pins[#pins + 1] = { id = 'impound', label = 'Impound', category = 'Garage', x = lot.x, y = lot.y }
    end
    return pins
end

local function pinById(pins, id)
    for _, pin in ipairs(pins or {}) do
        if pin.id == id then return pin end
    end
    return nil
end

local function ensureFactions()
    if Sunset and Sunset.Factions then return true end
    local chunk = LoadResourceFile('sunset_core', 'shared/factions.lua')
    if not chunk then return false end
    local fn = load(chunk, '@sunset_core/shared/factions.lua')
    if not fn then return false end
    local ok = pcall(fn)
    return ok and Sunset and Sunset.Factions ~= nil
end

local function factionFleet(factionId, grade)
    if not ensureFactions() then return nil end
    local faction = Sunset.Factions[factionId]
    if not faction then return nil end
    local hq = faction.hq
    local vehicles = {}
    local depot = faction.depot
    if depot and depot.vehicles then
        for _, vehicle in ipairs(depot.vehicles) do
            vehicles[#vehicles + 1] = {
                model = vehicle.model,
                label = vehicle.label or vehicle.model,
                minGrade = vehicle.minGrade or 0,
                available = (tonumber(grade) or 0) >= (tonumber(vehicle.minGrade) or 0),
            }
        end
    end
    return {
        x = hq and hq.x or (depot and depot.coords and depot.coords.x),
        y = hq and hq.y or (depot and depot.coords and depot.coords.y),
        depotLabel = depot and depot.label or nil,
        vehicles = vehicles,
    }
end

local function loadApp(app, token)
    if app == 'garage' then
        local vehicles = Sunset.AwaitCallback('sunset:getVehicles') or {}
        local impound = Sunset.AwaitCallback('sunset:impound:list') or {}
        local pins = destinationPins()
        sendApp('garage', { vehicles = vehicles, impound = impound, pins = pins }, token)
    elseif app == 'market' or app == 'news' then
        local data = Sunset.AwaitCallback('sunset:phoneMarketplace') or { properties = {}, businesses = {}, ads = {}, mine = {} }
        data.pins = destinationPins()
        sendApp(app, data, token)
    elseif app == 'jobs' then
        local panel = Sunset.AwaitCallback('sunset:jobs:getPanelData') or {}
        local workplaces = {}
        for jobId, place in pairs(Sunset.JobWorkplaces or {}) do
            local coords = place.npc and place.npc.coords
            workplaces[#workplaces + 1] = {
                id = jobId,
                label = place.jobLabel or place.locationLabel or jobId,
                x = coords and coords.x or nil,
                y = coords and coords.y or nil,
            }
        end
        panel.workplaces = workplaces
        sendApp('jobs', panel, token)
    elseif app == 'map' then
        sendApp('map', { pins = destinationPins() }, token)
    elseif app == 'faction' then
        local panel = Sunset.AwaitCallback('sunset:getFactionPanel')
        local dash = nil
        local fleet = nil
        if panel and panel.isFaction then
            dash = Sunset.AwaitCallback('sunset:factionDashboard')
            fleet = factionFleet(panel.job, panel.grade)
        end
        sendApp('faction', { panel = panel, dashboard = dash, fleet = fleet }, token)
    elseif app == 'properties' then
        local owned = Sunset.AwaitCallback('sunset:getPropertiesPage', { page = 1, pageSize = 30, filter = 'owned', sort = 'name' })
        local rented = Sunset.AwaitCallback('sunset:getPropertiesPage', { page = 1, pageSize = 20, filter = 'rented', sort = 'name' })
        sendApp('properties', { owned = owned, rented = rented }, token)
    elseif app == 'clan' then
        local dash, err = Sunset.AwaitCallback('sunset:clanDashboard')
        sendApp('clan', { dashboard = dash, error = err }, token)
    elseif app == 'taxi' then
        local data = Sunset.AwaitCallback('sunset:getTaxiAppData')
        sendApp('taxi', data or {}, token)
    end
end

AddEventHandler('sunset:nui:marketPromote', function(data)
    CreateThread(function()
        local res, err = Sunset.AwaitCallback('sunset:cnn:promoteListing', tonumber(data and data.listingId))
        if res then
            notify(exports.sunset_core:Translate('asset.promote'), 'success')
        else
            local key = type(err) == 'table' and err.localeKey or nil
            notify(key and exports.sunset_core:Translate(key) or exports.sunset_core:Translate('cnn.message.could_not_submit_ad'), 'error')
        end
    end)
end)

RegisterNetEvent('sunset:client:phoneCall', function(payload)
    payload = payload or {}
    callSnapshot = payload
    if payload.state == 'INCOMING_RINGING' then
        startRing()
        if not exports.sunset_phone:IsOpen() then
            notify(exports.sunset_core:Translate('phone.call.incoming_from', { name = payload.peerName or payload.peerPhone or '' }), 'info')
            exports.sunset_phone:Open()
        end
    else
        stopRing()
    end
    exports.sunset_ui:Send('phoneCallState', payload)
    if payload.state == 'UNAVAILABLE' or payload.state == 'BUSY' or payload.state == 'FAILED' or payload.state == 'DECLINED' then
        local key = 'phone.call.' .. string.lower(payload.reason or payload.state)
        notify(exports.sunset_core:Translate(key), payload.state == 'DECLINED' and 'info' or 'error')
    end
end)

RegisterNetEvent('sunset:police:jail', function()
    TriggerServerEvent('sunset:phone:forceEnd')
end)

AddEventHandler('sunset:nui:phoneAction', function(data)
    CreateThread(function()
        data = data or {}
        local op = tostring(data.op or '')
        local token = data.token

        if op == 'load' then
            local ok, err = pcall(function()
                loadApp(tostring(data.app or ''), token)
            end)
            if not ok then
                sendApp(tostring(data.app or ''), { error = tostring(err) }, token)
            end
            return
        end

        if op == 'layout' then
            local encoded = json.encode({ grid = data.grid })
            if encoded and #encoded < 4000 then
                SetResourceKvp('sunset_phone_layout', encoded)
            end
            Sunset.AwaitCallback('sunset:phoneSaveLayout', data.grid)
            return
        end
        if op == 'settings' then
            Sunset.AwaitCallback('sunset:phoneSaveSettings', {
                ringtone = data.ringtone ~= false,
                notifySound = data.notifySound ~= false,
                compactNotes = data.compactNotes == true,
            })
            return
        end
        if op == 'marketBuy' then
            local res, err = Sunset.AwaitCallback('sunset:phoneMarketBuy', tonumber(data.listingId))
            notify(res and exports.sunset_core:Translate('phone.ui.buy') or (err or 'error'), res and 'success' or 'error')
            if res then loadApp('market', token) end
            return
        end
        if op == 'marketCancel' then
            Sunset.AwaitCallback('sunset:phoneMarketCancel', tonumber(data.listingId))
            loadApp('market', token)
            return
        end
        if op == 'marketListVehicle' then
            local res = Sunset.AwaitCallback('sunset:phoneMarketListVehicle', tonumber(data.vehicleId), tonumber(data.price))
            loadApp('market', token)
            if type(res) == 'table' and res.id and res.cnnPrice then
                exports.sunset_ui:Send('marketPromotePrompt', { listingId = res.id, price = res.cnnPrice })
            end
            return
        end
        if op == 'marketListItem' then
            local res = Sunset.AwaitCallback('sunset:phoneMarketListItem', tostring(data.item or ''), tonumber(data.quantity), tonumber(data.price))
            loadApp('market', token)
            if type(res) == 'table' and res.id and res.cnnPrice then
                exports.sunset_ui:Send('marketPromotePrompt', { listingId = res.id, price = res.cnnPrice })
            end
            return
        end
        if op == 'marketBrowse' then
            local res = Sunset.AwaitCallback('sunset:phoneMarketBrowse', {
                page = tonumber(data.page) or 1,
                q = tostring(data.q or ''),
                type = tostring(data.kind or 'all'),
            }) or {}
            sendApp('market', { browse = true, listings = res.rows or {}, myListings = res.mine or {} }, token)
            return
        end
        if op == 'marketListProperty' then
            local res = Sunset.AwaitCallback('sunset:phoneMarketListProperty', tonumber(data.propertyId), tonumber(data.price))
            loadApp('market', token)
            if type(res) == 'table' and res.id and res.cnnPrice then
                exports.sunset_ui:Send('marketPromotePrompt', { listingId = res.id, price = res.cnnPrice })
            end
            return
        end
        if op == 'buyLevel' then
            Sunset.AwaitCallback('sunset:buyLevel')
            return
        end
        if op == 'propertiesMore' then
            local page = math.max(1, tonumber(data.page) or 1)
            local filter = data.filter == 'rented' and 'rented' or 'owned'
            local size = filter == 'owned' and 30 or 20
            local more = Sunset.AwaitCallback('sunset:getPropertiesPage', { page = page, pageSize = size, filter = filter, sort = 'name' })
            sendApp('properties', { more = more, filter = filter, page = page }, token)
            return
        end

        if op == 'gps' then
            waypoint(data.x, data.y)
            return
        end

        if op == 'garageGps' then
            local status = tostring(data.status or '')
            if status == 'impounded' then
                local lot = SunsetImpound and SunsetImpound.Config and SunsetImpound.Config.lot
                if lot then waypoint(lot.x, lot.y) else notify(exports.sunset_core:Translate('phone.ui.location_unavailable'), 'error') end
                return
            end
            if status == 'stored' then
                local pins = destinationPins()
                local pin = pinById(pins, 'garage_' .. tostring(data.garage or 'legion'))
                if pin then waypoint(pin.x, pin.y) else notify(exports.sunset_core:Translate('phone.ui.location_unavailable'), 'error') end
                return
            end
            local wanted = tostring(data.plate or '')
            local found = nil
            for _, veh in ipairs(GetGamePool('CVehicle')) do
                if plateMatches(GetVehicleNumberPlateText(veh), wanted) then
                    found = veh
                    break
                end
            end
            if found then
                local coords = GetEntityCoords(found)
                waypoint(coords.x, coords.y)
                notify(exports.sunset_core:Translate('phone.ui.location_exact'), 'success')
                return
            end
            if data.parkedX and data.parkedY then
                waypoint(data.parkedX, data.parkedY)
                notify(exports.sunset_core:Translate('phone.ui.location_last_known'), 'info')
                return
            end
            notify(exports.sunset_core:Translate('phone.ui.location_unavailable'), 'error')
            return
        end

        if op == 'call' then
            local phone = tostring(data.phone or '')
            if phone == '112' then
                TriggerEvent('sunset:nui:phoneTrigger112')
                return
            end
            local res, err = Sunset.AwaitCallback('sunset:phoneCallStart', phone)
            if res and res.special == '112' then
                TriggerEvent('sunset:nui:phoneTrigger112')
                return
            end
            if not res or res.ok == false then
                if not res then
                    exports.sunset_ui:Send('phoneCallState', {
                        state = 'FAILED',
                        reason = 'invalid',
                        message = err or exports.sunset_core:Translate('phone.call.invalid_number'),
                    })
                    notify(err or exports.sunset_core:Translate('phone.call.invalid_number'), 'error')
                end
            end
            return
        end

        if op == 'answer' then
            local res, err = Sunset.AwaitCallback('sunset:phoneCallAnswer')
            if not res then notify(err or exports.sunset_core:Translate('phone.call.ended'), 'error') end
            return
        end

        if op == 'decline' then
            Sunset.AwaitCallback('sunset:phoneCallDecline')
            return
        end

        if op == 'hangup' then
            Sunset.AwaitCallback('sunset:phoneCallHangup')
            return
        end

        if op == 'read' then
            Sunset.AwaitCallback('sunset:phoneMarkRead', tonumber(data.characterId))
            return
        end

        if op == 'editContact' then
            local res, err = Sunset.AwaitCallback('sunset:phoneEditContact', tonumber(data.contactId), data.name)
            if res and res.ok then
                local refreshed = Sunset.AwaitCallback('sunset:getPhoneData') or {}
                exports.sunset_ui:Send('phoneUpdate', refreshed)
            else
                notify(err or exports.sunset_core:Translate('phone.msg.could_not_save_contact'), 'error')
            end
            return
        end

        if op == 'duty' then
            local state, err = Sunset.AwaitCallback('sunset:toggleDuty')
            if err or state == nil then
                notify(err or exports.sunset_core:Translate('phone.ui.action_failed'), 'error')
            else
                notify(exports.sunset_core:Translate(state and 'phone.ui.on_duty' or 'phone.ui.off_duty'), 'success')
            end
            loadApp('faction', token)
            return
        end

        if op == 'factionInvite' then
            local res, err = Sunset.AwaitCallback('sunset:factionInvite', tonumber(data.serverId))
            notify(res and exports.sunset_core:Translate('phone.ui.invite_sent') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'factionRank' then
            local res, err = Sunset.AwaitCallback('sunset:factionMemberRankDelta', tonumber(data.characterId), tonumber(data.delta) or 0)
            notify(res and exports.sunset_core:Translate('phone.ui.rank_updated') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'factionKick' then
            local res, err = Sunset.AwaitCallback('sunset:factionMemberKick', tonumber(data.characterId), 'remove')
            notify(res and exports.sunset_core:Translate('phone.ui.member_removed') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'factionMotd' then
            local res, err = Sunset.AwaitCallback('sunset:factionSetMotd', tostring(data.message or ''):sub(1, 240))
            notify(res and exports.sunset_core:Translate('phone.ui.announcement_saved') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'clanInvite' then
            local res, err = Sunset.AwaitCallback('sunset:clanManage', { action = 'invite', targetId = tonumber(data.serverId) })
            notify(res and exports.sunset_core:Translate('phone.ui.invite_sent') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('clan', token) end
            return
        end

        if op == 'openQuests' then
            ExecuteCommand('quests')
            return
        end

        if op == 'openClanShop' then
            TriggerEvent('sunset:shop:open')
            return
        end

        if op == 'clanRank' then
            local action = (tonumber(data.delta) or 0) > 0 and 'rankUp' or 'rankDown'
            local res, err = Sunset.AwaitCallback('sunset:clanManage', { action = action, targetCharacterId = tonumber(data.characterId) })
            notify(res and exports.sunset_core:Translate('phone.ui.rank_updated') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('clan', token) end
            return
        end

        if op == 'clanKick' then
            local res, err = Sunset.AwaitCallback('sunset:clanManage', { action = 'kick', targetCharacterId = tonumber(data.characterId) })
            notify(res and exports.sunset_core:Translate('phone.ui.member_removed') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('clan', token) end
            return
        end

        if op == 'jobCancel' then
            local res, err = Sunset.AwaitCallback('sunset:jobs:cancelWork')
            notify(res and exports.sunset_core:Translate('phone.ui.shift_ended') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('jobs', token) end
            return
        end

        if op == 'nearestAtm' then
            local pins = destinationPins()
            local best, bestDist
            local ped = GetEntityCoords(PlayerPedId())
            for _, pin in ipairs(pins) do
                if pin.category == 'Services' and tostring(pin.id):find('atm_', 1, true) == 1 then
                    local dist = #(ped - vector3(pin.x, pin.y, ped.z))
                    if not bestDist or dist < bestDist then
                        best, bestDist = pin, dist
                    end
                end
            end
            if best then waypoint(best.x, best.y, exports.sunset_core:Translate('phone.ui.atm_waypoint'))
            else notify(exports.sunset_core:Translate('phone.ui.location_unavailable'), 'error') end
        end
    end)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    stopRing()
    callSnapshot = nil
end)
