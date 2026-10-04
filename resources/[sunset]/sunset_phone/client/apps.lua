local callSnapshot = nil
local ringToken = 0

local function notify(message, kind)
    if not message or message == '' then return end
    if exports.sunset_phone:IsOpen() then
        exports.sunset_ui:Send('phoneActionResult', {
            op = 'app',
            ok = kind ~= 'error',
            error = kind == 'error' and message or nil,
            message = kind ~= 'error' and message or nil,
        })
        return
    end
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
    if PhonePrefs and PhonePrefs.ringtone == false then return end
    local token = ringToken
    CreateThread(function()
        while token == ringToken and callSnapshot and callSnapshot.state == 'INCOMING_RINGING' do
            if not PhonePrefs or PhonePrefs.ringtone ~= false then
                PlaySoundFrontend(-1, 'Remote_Ring', 'Phone_SoundSet_Michael', true)
            end
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

local function mapGroup(category)
    if category == 'Services' or category == 'Shops' or category == 'News' then return 'services' end
    if category == 'Jobs' then return 'jobs' end
    if category == 'Garages' or category == 'Garage' then return 'vehicle' end
    if category == 'Factions' then return 'government' end
    if category == 'Popular' then return 'entertainment' end
    return 'other'
end

local function destinationPins()
    local data = Sunset.AwaitCallback('sunset:getPhoneMapLocations')
    local pins = {}
    local seen = {}
    local function add(pin)
        if type(pin) ~= 'table' or not pin.x or not pin.y then return end
        local id = tostring(pin.id or ('pin_' .. (#pins + 1)))
        if seen[id] then return end
        seen[id] = true
        pins[#pins + 1] = {
            id = id,
            label = pin.label,
            category = pin.category or 'Other',
            group = pin.group or mapGroup(pin.category),
            area = pin.area,
            x = pin.x,
            y = pin.y,
        }
    end
    for _, dest in ipairs(data and data.pins or {}) do
        add(dest)
    end
    if Config and Config.CNN and Config.CNN.locations then
        for i, loc in ipairs(Config.CNN.locations) do
            local coords = loc.coords
            if coords then
                add({ id = 'cnn_' .. i, label = 'Weazel / CNN', category = 'News', x = coords.x, y = coords.y })
            end
        end
    end
    if SunsetImpound and SunsetImpound.Config and SunsetImpound.Config.lot then
        local lot = SunsetImpound.Config.lot
        add({ id = 'impound', label = 'Impound', category = 'Garage', x = lot.x, y = lot.y })
    end
    for jobId, place in pairs(Sunset.JobWorkplaces or {}) do
        local coords = place.npc and place.npc.coords
        if coords then
            add({
                id = 'work_' .. jobId,
                label = place.jobLabel or place.locationLabel or jobId,
                category = 'Jobs',
                area = place.locationLabel or place.address,
                x = coords.x,
                y = coords.y,
            })
        end
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
    local depotCoords = depot and depot.coords
    return {
        x = hq and hq.x or (depotCoords and depotCoords.x),
        y = hq and hq.y or (depotCoords and depotCoords.y),
        depotX = depotCoords and depotCoords.x or nil,
        depotY = depotCoords and depotCoords.y or nil,
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
    elseif app == 'market' then
        local data = Sunset.AwaitCallback('sunset:phoneMarketplace') or { properties = {}, businesses = {}, ads = {}, mine = {} }
        data.pins = destinationPins()
        sendApp(app, data, token)
    elseif app == 'news' then
        local data = Sunset.AwaitCallback('sunset:phoneGetUpdates') or { updates = {} }
        sendApp('news', data, token)
    elseif app == 'feed' then
        local char = exports.sunset_core:GetCharacter()
        local feedTab = 'global'  -- default; client passes preferred tab
        local feedData = Sunset.AwaitCallback('social:getFeed', { feed = feedTab, limit = 20 }) or {}
        local contactsData = Sunset.AwaitCallback('social:getFeed', { feed = 'contacts', limit = 20 }) or {}
        sendApp('feed', {
            global   = { posts = feedData.posts or {}, nextCursor = feedData.nextCursor },
            contacts = { posts = contactsData.posts or {}, nextCursor = contactsData.nextCursor },
        }, token)
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
    local wasActive = callSnapshot and callSnapshot.state == 'ACTIVE'
    callSnapshot = payload
    PhoneCallSnapshot = payload
    local live = payload.state == 'INCOMING_RINGING' or payload.state == 'OUTGOING_RINGING' or payload.state == 'ACTIVE'
    if wasActive and payload.state ~= 'ACTIVE' then
        TriggerEvent('sunset:chat:phoneCallEnded')
    end
    if live and PhoneCancelPresentationClose then PhoneCancelPresentationClose() end
    if payload.state == 'INCOMING_RINGING' then
        startRing()
        if not exports.sunset_phone:IsOpen() then
            notify(exports.sunset_core:Translate('phone.call.incoming_from', { name = payload.peerName or payload.peerPhone or '' }), 'info')
            if PhoneOpenForCall then PhoneOpenForCall() else exports.sunset_phone:Open() end
        end
    else
        stopRing()
    end
    if not live and PhoneSchedulePresentationClose then PhoneSchedulePresentationClose() end
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

        if op == 'peek' then
            if PhoneSetPresentation then PhoneSetPresentation('peek') end
            return
        end
        if op == 'cameraStart' then
            TriggerEvent('sunset:phone:cameraStart', data)
            return
        end
        if op == 'cameraClose' or op == 'cameraFlip' or op == 'cameraLook' or op == 'cameraZoom' or op == 'cameraShutter' then
            local map = { cameraClose = 'close', cameraFlip = 'flip', cameraLook = 'look', cameraZoom = 'zoom', cameraShutter = 'shutter' }
            TriggerEvent('sunset:phone:cameraControl', { op = map[op], dx = data.dx, dy = data.dy, delta = data.delta })
            return
        end
        if op == 'gallery' then
            local res, err = Sunset.AwaitCallback('sunset:phoneGallery', tonumber(data.cursor) or 0)
            if type(res) == 'table' then
                sendApp('gallery', { photos = res.photos or {}, nextCursor = res.nextCursor, append = data.cursor and true or false }, token)
            else
                sendApp('gallery', { error = PhoneExplain(err, 'phone.message.photo_upload_failed') }, token)
            end
            return
        end
        if op == 'galleryDelete' then
            local res, err = Sunset.AwaitCallback('sunset:phoneGalleryDelete', tonumber(data.mediaId))
            notify(res and exports.sunset_core:Translate('phone.ui.photo_deleted') or PhoneExplain(err, 'phone.message.photo_upload_failed'), res and 'success' or 'error')
            if res then
                local again = Sunset.AwaitCallback('sunset:phoneGallery', 0)
                sendApp('gallery', { photos = again and again.photos or {}, nextCursor = again and again.nextCursor }, token)
            end
            return
        end
        if op == 'gallerySave' then
            local res, err = Sunset.AwaitCallback('sunset:phoneGallerySave', tonumber(data.mediaId))
            notify(res and exports.sunset_core:Translate('phone.ui.photo_saved') or PhoneExplain(err, 'phone.message.photo_upload_failed'), res and 'success' or 'error')
            return
        end

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
        if op == 'voice' then
            Sunset.AwaitCallback('sunset:phoneCallSetVoice', data.enabled == true)
            return
        end
        if op == 'settings' then
            local res, err = Sunset.AwaitCallback('sunset:phoneSaveSettings', {
                ringtone = data.ringtone ~= false,
                notifySound = data.notifySound ~= false,
                voiceCalls = data.voiceCalls ~= false,
            })
            if type(res) == 'table' and res.ok then
                SetPhonePrefs(res)
                exports.sunset_ui:Send('phoneActionResult', { op = 'settings', ok = true, prefs = res })
            else
                PhoneFeedback(PhoneExplain(err, 'phone.message.settings_failed'), 'error', 'settings', false)
            end
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
            local ok, err = Sunset.AwaitCallback('sunset:buyLevel')
            if ok then
                local refreshed = Sunset.AwaitCallback('sunset:getPhoneData') or {}
                if refreshed.prefs then SetPhonePrefs(refreshed.prefs) end
                exports.sunset_ui:Send('phoneUpdate', refreshed)
                PhoneFeedback(exports.sunset_core:Translate('phone.ui.level_bought', { level = tostring(refreshed.level or '') }), 'success', 'level', true)
            else
                PhoneFeedback(PhoneExplain(err, 'phone.ui.action_failed'), 'error', 'level', false)
            end
            return
        end
        if op == 'markCallsSeen' then
            local res = Sunset.AwaitCallback('sunset:phoneMarkCallsSeen', tonumber(data.callId))
            if type(res) == 'table' and res.ok then
                exports.sunset_ui:Send('phoneActionResult', { op = 'callsSeen', ok = true })
            end
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

        if op == 'reactUpdate' then
            local res = Sunset.AwaitCallback('sunset:phoneReactUpdate', tonumber(data.updateId), tostring(data.reaction or ''))
            if type(res) == 'table' and res.ok ~= false then
                exports.sunset_ui:Send('phoneActionResult', {
                    op           = 'reactUpdate',
                    ok           = true,
                    updateId     = data.updateId,
                    likesCount   = res.likes_count,
                    dislikesCount = res.dislikes_count,
                    myReaction   = res.my_reaction,
                })
            else
                exports.sunset_ui:Send('phoneActionResult', {
                    op       = 'reactUpdate',
                    ok       = false,
                    updateId = data.updateId,
                })
            end
            return
        end

        -- ========== SOCIAL FEED OPS ==========
        if op == 'feedLike' then
            local res = Sunset.AwaitCallback('social:likePost', tonumber(data.postId))
            exports.sunset_ui:Send('phoneActionResult', {
                op = 'feedLike', ok = type(res) == 'table' and res.ok ~= false,
                postId = data.postId,
                likesCount = type(res) == 'table' and res.likesCount or nil,
                likedByViewer = true,
            })
            return
        end

        if op == 'feedUnlike' then
            local res = Sunset.AwaitCallback('social:unlikePost', tonumber(data.postId))
            exports.sunset_ui:Send('phoneActionResult', {
                op = 'feedLike', ok = type(res) == 'table' and res.ok ~= false,
                postId = data.postId,
                likesCount = type(res) == 'table' and res.likesCount or nil,
                likedByViewer = false,
            })
            return
        end

        if op == 'feedGetPost' then
            local res = Sunset.AwaitCallback('social:getPost', tonumber(data.postId)) or {}
            sendApp('feed-post', res, token)
            return
        end

        if op == 'feedComment' then
            local res = Sunset.AwaitCallback('social:addComment', tonumber(data.postId), tostring(data.body or ''), tonumber(data.parentCommentId))
            if type(res) == 'table' and res.ok then
                exports.sunset_ui:Send('phoneActionResult', {
                    op = 'feedComment', ok = true,
                    postId = data.postId,
                    comment = res.comment,
                    commentsCount = res.commentsCount,
                })
            else
                exports.sunset_ui:Send('phoneActionResult', { op = 'feedComment', ok = false, postId = data.postId })
            end
            return
        end

        if op == 'feedCreatePost' then
            local res = Sunset.AwaitCallback('social:createPost', tostring(data.body or ''), tonumber(data.mediaId))
            if type(res) == 'table' and res.ok then
                notify(exports.sunset_core:Translate('phone.ui.feed_post_published'), 'success')
                -- Reload feed
                local feedData    = Sunset.AwaitCallback('social:getFeed', { feed = 'global',   limit = 20 }) or {}
                local contactData = Sunset.AwaitCallback('social:getFeed', { feed = 'contacts', limit = 20 }) or {}
                sendApp('feed', {
                    global   = { posts = feedData.posts or {},    nextCursor = feedData.nextCursor },
                    contacts = { posts = contactData.posts or {}, nextCursor = contactData.nextCursor },
                }, token)
            else
                notify(exports.sunset_core:Translate('phone.ui.action_failed'), 'error')
            end
            return
        end

        if op == 'feedDeletePost' then
            local res = Sunset.AwaitCallback('social:deletePost', tonumber(data.postId))
            exports.sunset_ui:Send('phoneActionResult', { op = 'feedDeletePost', ok = type(res) == 'table' and res.ok ~= false })
            return
        end

        if op == 'feedLoadMore' then
            local tab = tostring(data.tab or 'global')
            if tab ~= 'contacts' and tab ~= 'global' then tab = 'global' end
            local res = Sunset.AwaitCallback('social:getFeed', { feed = tab, beforeId = tonumber(data.beforeId), limit = 20 }) or {}
            sendApp('feed', { tab = tab, posts = res.posts or {}, nextCursor = res.nextCursor, append = true }, token)
            return
        end

        if op == 'feedGetProfile' then
            local res = Sunset.AwaitCallback('social:getProfile', tonumber(data.characterId)) or {}
            sendApp('feed-profile', res, token)
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

        if op == 'factionWarn' then
            local res, err = Sunset.AwaitCallback('sunset:factionMemberWarn', tonumber(data.characterId), tostring(data.reason or 'Warning'):sub(1, 120))
            notify(res and exports.sunset_core:Translate('phone.ui.warn') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'factionResign' then
            local res, err = Sunset.AwaitCallback('sunset:factionResignHandle', tonumber(data.resignationId), tostring(data.action or 'decline'))
            notify(res and exports.sunset_core:Translate('phone.ui.rank_updated') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'factionPardon' then
            local res, err = Sunset.AwaitCallback('sunset:factionPardonFP', tonumber(data.characterId))
            notify(res and exports.sunset_core:Translate('phone.ui.pardon') or (err or exports.sunset_core:Translate('phone.ui.action_failed')), res and 'success' or 'error')
            if res then loadApp('faction', token) end
            return
        end

        if op == 'factionRenameRank' then
            local grade = tonumber(data.grade)
            if not grade then
                notify(exports.sunset_core:Translate('phone.ui.action_failed'), 'error')
                return
            end
            local res, err = Sunset.AwaitCallback('sunset:factionSetGradeLabels', { [grade] = tostring(data.label or ''):sub(1, 64) })
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
    PhoneCallSnapshot = { state = 'IDLE' }
end)
