local nextPaydayLabel = '--:--'
local serverTimeLabel = '00:00'
local defaultLayoutCache = nil
local char = nil
local hudActive = false
local pauseHidden = false

local function nui(action, data)
    exports.sunset_ui:Send(action, data or {})
end

local function getStreetName()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local streetHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    local street = GetStreetNameFromHashKey(streetHash)
    local zone = GetLabelText(GetNameOfZone(coords.x, coords.y, coords.z))
    if zone == 'NULL' then zone = 'Los Santos' end
    return street or '—', zone
end

local function getCompassDirection(ped)
    local heading = (GetEntityHeading(ped) + 22.5) % 360.0
    local directions = { 'N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE' }
    local index = math.floor(heading / 45.0) + 1
    return directions[index] or 'N'
end

local function getJobLabel(jobName)
    local job = Sunset.Jobs[jobName]
    return job and job.label or 'Unemployed'
end

local function getGameTime()
    return serverTimeLabel
end

local function getVoiceRangeLabel()
    local ok, data = pcall(function()
        return exports.sunset_hud:GetVoiceHudData()
    end)
    if ok and type(data) == 'table' and data.voiceRangeDisplay then
        return data.voiceRangeDisplay
    end
    return 'Normal · 3.0m'
end

local function formatPayday()
    return nextPaydayLabel
end

local function loadDefaultHudLayout()
    if defaultLayoutCache then return defaultLayoutCache end
    local raw = LoadResourceFile(GetCurrentResourceName(), 'hud_layout_default.json')
    if raw and raw ~= '' then
        local ok, data = pcall(json.decode, raw)
        if ok and type(data) == 'table' then
            defaultLayoutCache = data
            return data
        end
    end
    return nil
end

local function hasPersonalHudLayout()
    local raw = GetResourceKvpString('sunset_hud_layout')
    return raw ~= nil and raw ~= ''
end

local function getHudLayout()
    local raw = GetResourceKvpString('sunset_hud_layout')
    if raw and raw ~= '' then
        local ok, data = pcall(json.decode, raw)
        if ok then return data end
    end
    return loadDefaultHudLayout()
end

local function readSavedHudLayout()
    local raw = GetResourceKvpString('sunset_hud_layout')
    if not raw or raw == '' then return nil end
    local ok, data = pcall(json.decode, raw)
    if ok then return data end
    return nil
end

local function buildHudData()
    if not char then return nil end

    local ped = PlayerPedId()
    local health = GetEntityHealth(ped) - 100
    local maxHealth = GetEntityMaxHealth(ped) - 100
    local healthPct = maxHealth > 0 and (health / maxHealth) * 100 or 0
    local street, zone = getStreetName()

    -- Waypoint distance (blip 8 = player-placed waypoint)
    local waypointDist = nil
    local wpBlip = GetFirstBlipInfoId(8)
    if wpBlip and wpBlip ~= 0 and DoesBlipExist(wpBlip) then
        local wpCoords = GetBlipCoords(wpBlip)
        local pedCoords = GetEntityCoords(ped)
        local dx = wpCoords.x - pedCoords.x
        local dy = wpCoords.y - pedCoords.y
        waypointDist = math.floor(math.sqrt(dx * dx + dy * dy))
    end

    local pState = LocalPlayer.state
    local displayName = pState.sunsetName or pState.name
    if not displayName or displayName == '' then
        if char and char.name and char.name ~= '' then
            displayName = char.name
        elseif char and char.firstname and char.firstname ~= '' then
            displayName = char.firstname .. ((char.lastname and char.lastname ~= '') and (' ' .. char.lastname) or '')
        else
            local playerData = exports.sunset_core:GetPlayer()
            displayName = playerData and playerData.name or '—'
        end
    end

    local jobId = select(1, Sunset.GetCharacterJob(char))
    local md = char.metadata or {}
    local factionId = md.faction
    if not factionId and char.job and Sunset.Factions and Sunset.Factions[char.job] then
        factionId = char.job
    end
    local jobLabel = 'Unemployed'
    if factionId and Sunset.Factions[factionId] then
        jobLabel = Sunset.Factions[factionId].label
    elseif Sunset.Jobs[jobId] then
        jobLabel = Sunset.Jobs[jobId].label
    end

    local data = {
        playerId = GetPlayerServerId(PlayerId()),
        cash = char.cash,
        bank = char.bank,
        name = displayName,
        job = jobLabel,
        health = healthPct,
        armor = GetPedArmour(ped),
        time = getGameTime(),
        payday = formatPayday(),
        street = street,
        zone = zone,
        heading = getCompassDirection(ped),
        waypointDist = waypointDist,
        voiceTalking = (MumbleIsPlayerTalking and MumbleIsPlayerTalking(PlayerId())) or NetworkIsPlayerTalking(PlayerId()) == 1 or NetworkIsPlayerTalking(PlayerId()) == true,
        voiceRange = getVoiceRangeLabel(),
        inVehicle = false,
        wanted = exports['sunset_hud']:GetWantedLevel(),
        wantedDecayAt = exports['sunset_hud']:GetWantedDecayAt(),
        wantedRemainingSec = exports['sunset_hud']:GetWantedRemainingSec(),
        wantedPersistent = exports['sunset_hud']:GetWantedLevel() > 0 and exports['sunset_hud']:GetWantedDecayAt() == nil,
    }

    local vehState = nil
    pcall(function()
        vehState = exports.sunset_vehicles:GetVehicleState()
    end)

    if vehState then
        data.inVehicle = true
        data.speed = vehState.speed
        data.gear = vehState.gear
        data.rpm = vehState.rpm
        data.fuel = vehState.fuel
        data.engine = vehState.engine
        data.odometer = vehState.odometer
        data.showFuel = vehState.showFuel
        data.showOdometer = vehState.showOdometer
        data.locked = vehState.locked
        data.seatbelt = vehState.seatbelt
        data.lightMode = vehState.lightMode or 0
        data.engineOn = vehState.engineOn
        data.vehicleClass = vehState.vehicleClass
        data.vehicleName = vehState.vehicleName
        data.supportsSeatbelt = vehState.supportsSeatbelt
        data.supportsDoorLock = vehState.supportsDoorLock
        data.isDriver = vehState.isDriver == true
    end

    return data
end

local function refreshHudLayout(layout)
    if not hudActive then return end
    nui('showHud', {
        playerId = GetPlayerServerId(PlayerId()),
        layout = layout or getHudLayout(),
    })
    local data = buildHudData()
    if data then nui('updateHud', data) end
end

local function activateHud(character)
    char = character
    hudActive = true
    pcall(function()
        nextPaydayLabel = exports.sunset_economy:GetNextPayday() or nextPaydayLabel
    end)
    nui('showHud', {
        playerId = GetPlayerServerId(PlayerId()),
        layout = getHudLayout(),
    })
    local data = buildHudData()
    if data then nui('updateHud', data) end
end

local lastHudHash = ''
local function updateHud()
    if not hudActive then return end
    local data = buildHudData()
    if not data then return end
    -- Change-detection key. Previously omitted name/job/payday/heading/waypoint/voice, so
    -- those only refreshed when an unrelated field happened to change.
    local hash = string.format('%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
        tostring(data.health), tostring(data.armor), tostring(data.hunger), tostring(data.thirst),
        tostring(data.cash), tostring(data.bank), tostring(data.level), tostring(data.street),
        tostring(data.zone), tostring(data.wanted), tostring(data.gameTime), tostring(data.fuel),
        tostring(data.inVehicle), tostring(data.name), tostring(data.job), tostring(data.payday),
        tostring(data.heading), tostring(data.waypointDist and math.floor(data.waypointDist / 10)),
        tostring(data.time), tostring(data.voiceRange), tostring(data.vehicleName))
    if hash ~= lastHudHash then
        lastHudHash = hash
        nui('updateHud', data)
    end
end

AddEventHandler('sunset:client:playerSpawned', function(character)
    activateHud(character)
end)

AddEventHandler('sunset:client:onCharacterLoaded', function(character)
    char = character
    if not hudActive then
        activateHud(character)
    end
end)

RegisterNetEvent('sunset:client:updateMoney', function(cash, bank)
    if char then
        char.cash = cash or char.cash
        char.bank = bank or char.bank
    end
end)

AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    do -- readiness poll (was blind Wait(1000)), bounded 10 s
        local deadline = GetGameTimer() + 10000
        while GetGameTimer() < deadline do
            local ok, ready = pcall(function() return exports.sunset_core:IsPlayerReady() end)
            if ok and ready then break end
            Wait(250)
        end
    end
    local existing = exports.sunset_core:GetCharacter()
    if existing and existing.id then
        activateHud(existing)
    end
end)

-- [RESTART SAFETY] `restart sunset_ui` reloads the page empty: re-send the HUD.
-- `restart sunset_hud`: hide the page HUD and give the radar back on stop.
AddEventHandler('sunset:ui:ready', function()
    lastHudHash = ''
    if hudActive and char then
        CreateThread(function()
            Wait(300)
            if hudActive then activateHud(char) end
        end)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    pcall(function() exports.sunset_ui:Send('hideHud', {}) end)
    DisplayRadar(true)
end)

function GetPaydaySeconds()
    return 0
end
exports('GetPaydaySeconds', GetPaydaySeconds)

CreateThread(function()
    while true do
        if hudActive and not pauseHidden then
            updateHud()
            Wait(500)
        else
            Wait(1000)
        end
    end
end)

-- High-frequency (30 Hz sampling, change-gated send) gauge loop for responsive RPM & speed
local lastGauge = nil
CreateThread(function()
    while true do
        if hudActive and not pauseHidden then
            local ped = PlayerPedId()
            if IsPedInAnyVehicle(ped, false) then
                local veh = GetVehiclePedIsIn(ped, false)
                if GetPedInVehicleSeat(veh, -1) == ped then
                    local tele = nil
                    pcall(function() tele = exports.sunset_vehicles:GetVehicleTelemetry(veh) end)
                    if tele then
                        local nosData = nil
                        if GetResourceState('sunset_tuning') == 'started' then
                            pcall(function() nosData = exports.sunset_tuning:GetNitrousHudState(veh) end)
                        end
                        local nosLevel = nosData and (nosData.bottle or nosData.level or 0) or 0
                        -- [PERF] Change detection: the 30 Hz sampler only crosses into NUI
                        -- when a visible value moved (speed >= 1 km/h, rpm >= 0.01, gear,
                        -- engine, NOS state). Steady cruise / idle sends nothing; a 1 s
                        -- keepalive refreshes the page in case it missed a message.
                        local gSpeed = math.floor((tonumber(tele.speedKmh) or 0) + 0.5)
                        local gRpm = math.floor((tonumber(tele.displayRpm) or 0) * 100 + 0.5)
                        local gNos = math.floor((tonumber(nosLevel) or 0) + 0.5)
                        local gHasNos = nosData and nosData.installed == true
                        local gNosActive = nosData and nosData.active == true
                        local nowG = GetGameTimer()
                        local g = lastGauge
                        if not g or g.speed ~= gSpeed or g.rpm ~= gRpm or g.gear ~= tele.gear
                            or g.engineOn ~= tele.engineOn or g.nos ~= gNos or g.hasNos ~= gHasNos
                            or g.nosActive ~= gNosActive or (nowG - (g.at or 0)) >= 1000 then
                            lastGauge = { speed = gSpeed, rpm = gRpm, gear = tele.gear, engineOn = tele.engineOn,
                                nos = gNos, hasNos = gHasNos, nosActive = gNosActive, at = nowG }
                            nui('updateVehicleGauges', {
                                speed = tele.speedKmh,
                                rpm = tele.displayRpm,
                                rawRpm = tele.rawRpm,
                                gear = tele.gear,
                                engineOn = tele.engineOn,
                                hasNos = gHasNos,
                                nosPct = nosLevel,
                                nosLevel = nosLevel,
                                nosActive = gNosActive,
                            })
                        end
                    end
                    Wait(33)
                else
                    lastGauge = nil
                    Wait(250)
                end
            else
                lastGauge = nil
                Wait(400)
            end
        else
            Wait(800)
        end
    end
end)

CreateThread(function()
    while true do
        local paused = IsPauseMenuActive()
        if paused ~= pauseHidden then
            pauseHidden = paused
            nui('pauseState', { paused = paused })
            DisplayRadar(not paused)
        end
        Wait(paused and 50 or 100)
    end
end)

CreateThread(function()
    while true do
        if hudActive then
            HideHudComponentThisFrame(1)
            HideHudComponentThisFrame(2)
            HideHudComponentThisFrame(3)
            -- [FIX] Component 4 hidden = HP/armor bars gone. Removed so native
            -- GTA health/armor bars show under the minimap.
            HideHudComponentThisFrame(6)
            HideHudComponentThisFrame(7)
            HideHudComponentThisFrame(8)
            HideHudComponentThisFrame(9)
            HideHudComponentThisFrame(13)
            HideHudComponentThisFrame(17)
            HideHudComponentThisFrame(20)
            HideHudComponentThisFrame(21) -- wanted stars
            DisplayAmmoThisFrame(false)
            SetMpGamerTagsVisibleDistance(0.0)
            Wait(0)
        else
            Wait(250)
        end
    end
end)

CreateThread(function()
    while true do
        for i = 0, 255 do
            if IsMpGamerTagActive(i) then
                SetMpGamerTagVisibility(i, 0, false)
                RemoveMpGamerTag(i)
            end
        end
        Wait(2500)
    end
end)

RegisterCommand('hudedit', function()
    if not hudActive then return end
    exports.sunset_ui:Send('hudEditToggle', {})
end, false)

RegisterCommand('hudexport', function(_, args)
    local layout = readSavedHudLayout()
    if not layout then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('hud.message.save_your_hud_first_hudedit_then_enter'), 'error')
        return
    end
    local applyAll = args[1] == 'all'
    TriggerServerEvent('sunset:server:hudExport', layout, applyAll)
end, false)

RegisterCommand('hudreset', function()
    DeleteResourceKvp('sunset_hud_layout')
    refreshHudLayout(getHudLayout())
    exports.sunset_ui:Notify(exports.sunset_core:Translate('hud.message.hud_reset_to_server_default'), 'success')
end, false)

RegisterNetEvent('sunset:client:hudDefaultUpdated', function(layout, applyAll)
    if type(layout) ~= 'table' then return end
    defaultLayoutCache = layout
    if applyAll then
        SetResourceKvp('sunset_hud_layout', json.encode(layout))
        refreshHudLayout(layout)
        return
    end
    if not hasPersonalHudLayout() then
        refreshHudLayout(layout)
    end
end)

RegisterNetEvent('sunset:client:serverTime', function(data)
    if not data then return end
    if data.time then serverTimeLabel = data.time end
    if data.nextPayday then nextPaydayLabel = data.nextPayday end
    local worldHour = data.worldHour or data.hour
    local worldMinute = data.worldMinute or data.minute
    if worldHour ~= nil and worldMinute ~= nil then
        NetworkOverrideClockTime(worldHour, worldMinute, 0)
    end
end)

RegisterNetEvent('sunset:client:paydayTimer', function()
    -- legacy noop
end)

RegisterNetEvent('sunset:client:updateCharacter', function(updated)
    if not updated then return end
    if char then
        for k, v in pairs(updated) do char[k] = v end
    else
        char = updated
    end
    updateHud()
end)

AddEventHandler('sunset:client:onCharacterUpdated', function(updated)
    if not updated then return end
    if char then
        for k, v in pairs(updated) do char[k] = v end
    else
        char = updated
    end
    updateHud()
end)

AddStateBagChangeHandler('sunsetName', nil, function(bagName, key, value)
    local ply = GetPlayerFromStateBagName(bagName)
    if ply == PlayerId() then
        updateHud()
    end
end)

AddStateBagChangeHandler('name', nil, function(bagName, key, value)
    local ply = GetPlayerFromStateBagName(bagName)
    if ply == PlayerId() then
        updateHud()
    end
end)

AddEventHandler('sunset:nui:hudEditSave', function(data)
    if type(data) ~= 'table' then return end
    SetResourceKvp('sunset_hud_layout', json.encode(data))
    exports.sunset_ui:Notify(exports.sunset_core:Translate('hud.message.hud_layout_saved'), 'success')
end)

AddEventHandler('sunset:nui:hudEditClose', function()
    exports.sunset_ui:SetFocus(false, false)
end)

local function localRpName()
    local display = LocalPlayer.state.sunsetDisplayName
    if type(display) == 'string' and display ~= '' then
        return display:gsub('%s*%(%d+%)%s*$', '')
    end
    local name = LocalPlayer.state.sunsetName
    if type(name) == 'string' and name ~= '' then
        return name:gsub('%s*%(%d+%)%s*$', '')
    end
    local char = exports.sunset_core:GetCharacter()
    if char and char.firstname then
        local full = (char.firstname or '') .. ((char.lastname and char.lastname ~= '') and (' ' .. char.lastname) or '')
        if full ~= '' then return full end
    end
    local player = exports.sunset_core:GetPlayer()
    if player and player.name and player.name ~= '' then return player.name end
    return ('Player_%d'):format(GetPlayerServerId(PlayerId()))
end

local function applyPauseHeader()
    AddTextEntry('FE_THDR_GTAO', ('%s (%s)'):format(localRpName(), GetPlayerServerId(PlayerId())))
end

CreateThread(function()
    while true do
        applyPauseHeader()
        Wait(2000)
    end
end)

local LAW_ENFORCEMENT_FACTIONS = {
    police = true,
    sheriff = true,
    fib = true,
}

local function isLawEnforcementOnDuty()
    if not LocalPlayer.state.sunsetOnDuty then return false end
    local factionId = LocalPlayer.state.sunsetFaction
    if not factionId then
        local char = exports.sunset_core:GetCharacter()
        local md = char and char.metadata
        factionId = md and md.faction or (char and char.job)
    end
    return factionId and LAW_ENFORCEMENT_FACTIONS[factionId] == true
end

local function wantedLevelForPlayer(serverId)
    local bag = Player(serverId) and Player(serverId).state and Player(serverId).state.sunsetWanted
    if type(bag) ~= 'table' then return 0 end
    return math.max(0, math.min(5, tonumber(bag.level) or 0))
end

local FACTION_COLORS = {
    police          = { r = 59,  g = 130, b = 246 }, -- #3B82F6 (LSPD Blue)
    sheriff         = { r = 217, g = 119, b = 6   }, -- #D97706 (Sheriff Amber/Tan)
    fib             = { r = 96,  g = 165, b = 250 }, -- #60A5FA (FIB Light Blue)
    medic           = { r = 239, g = 68,  b = 68  }, -- #EF4444 (EMS Crimson Red)
    taxi            = { r = 234, g = 179, b = 8   }, -- #EAB308 (Taxi Yellow)
    mechanic        = { r = 249, g = 115, b = 22  }, -- #F97316 (LSC Orange)
    lsfd            = { r = 244, g = 63,  b = 94  }, -- #F43F5E (LSFD Fire Red)
    lssi            = { r = 34,  g = 197, b = 94  }, -- #22C55E (LSSI Green)
    sunset_cartel   = { r = 220, g = 38,  b = 38  }, -- #DC2626 (Cartel Deep Red)
    night_syndicate = { r = 168, g = 85,  b = 247 }, -- #A855F7 (Syndicate Purple)
    civilian        = { r = 245, g = 245, b = 245 }, -- #F5F5F5 (Civilian Crisp White)
}

local function formatSampName(serverId, fallbackName)
    local sid = tonumber(serverId) or 0
    local label = nil
    local st = sid > 0 and Player(sid) and Player(sid).state
    if st and type(st.sunsetDisplayName) == 'string' and st.sunsetDisplayName ~= '' then
        label = st.sunsetDisplayName
    elseif st and type(st.sunsetName) == 'string' and st.sunsetName ~= '' then
        label = st.sunsetName
    end
    if not label or label == '' then
        if fallbackName and fallbackName ~= '' and not fallbackName:find('^Player') then
            label = fallbackName
        else
            label = ('Player_%d'):format(sid)
        end
    end
    -- Clean up existing (ID) suffixes and trim
    label = label:gsub('%s*%(%d+%)%s*$', ''):gsub('%s+$', '')

    label = label:gsub('%s+', '_')

    if sid > 0 then
        label = ('%s (%d)'):format(label, sid)
    end
    return label
end

local function getPlayerFactionColor(serverId)
    local sid = tonumber(serverId) or 0
    local st = sid > 0 and Player(sid) and Player(sid).state
    local factionId = st and st.sunsetFaction
    if factionId and FACTION_COLORS[factionId] then
        return FACTION_COLORS[factionId]
    end
    return FACTION_COLORS.civilian
end

local function drawText2D(text, x, y, scale, r, g, b, a, font, center, outline)
    SetTextFont(font or 0)
    SetTextProportional(true)
    SetTextScale(scale, scale)
    SetTextColour(r, g, b, a)
    if outline ~= false then
        SetTextOutline()
        SetTextDropShadow()
    end
    if center ~= false then
        SetTextCentre(true)
    end
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayText(x, y)
end

-- Preload star textures dictionary
CreateThread(function()
    RequestStreamedTextureDict('mpleaderboard', true)
end)

-- SA:MP Style 3D Overhead Nametags & Health/Armour Bars
local NAMETAG_DISTANCE = 24.0
local cachedPlayers = {}

-- Background metadata refresh thread (runs every 200ms for zero hitching)
CreateThread(function()
    while true do
        local myPlayer = PlayerId()
        local myPed = PlayerPedId()
        local myCoords = GetEntityCoords(myPed)
        local activeList = {}

        for _, player in ipairs(GetActivePlayers()) do
            if player ~= myPlayer and NetworkIsPlayerActive(player) then
                local ped = GetPlayerPed(player)
                if ped ~= 0 and DoesEntityExist(ped) then
                    local serverId = GetPlayerServerId(player)
                    local pedCoords = GetEntityCoords(ped)
                    local dist = #(myCoords - pedCoords)
                    if dist <= (NAMETAG_DISTANCE + 5.0) then
                        activeList[player] = {
                            player = player,
                            serverId = serverId,
                            ped = ped,
                            name = formatSampName(serverId),
                            color = getPlayerFactionColor(serverId),
                            wanted = wantedLevelForPlayer(serverId) or 0,
                        }
                    end
                end
            end
        end

        cachedPlayers = activeList
        Wait(200)
    end
end)

-- Main 3D Render Thread (runs each frame)
CreateThread(function()
    while true do
        local hideAll = IsPauseMenuActive() or IsScreenFadedOut()
        if hideAll or not next(cachedPlayers) then
            Wait(150)
        else
            local myPed = PlayerPedId()
            local myCoords = GetEntityCoords(myPed)

            for _, info in pairs(cachedPlayers) do
                local ped = info.ped
                if DoesEntityExist(ped) and IsEntityVisible(ped) then
                    local pedCoords = GetEntityCoords(ped)
                    local dist = #(myCoords - pedCoords)

                    -- LOS raycast cached per metadata refresh (info is rebuilt every 200ms).
                    if dist <= NAMETAG_DISTANCE and info.los == nil then
                        info.los = HasEntityClearLosToEntity(myPed, ped, 17)
                    end
                    if dist <= NAMETAG_DISTANCE and info.los then
                        local inVeh = IsPedInAnyVehicle(ped, false)
                        local headBone = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
                        local tagZ = (headBone and headBone.z > 0.0) and headBone.z or pedCoords.z
                        local tagPos = vector3(pedCoords.x, pedCoords.y, tagZ + (inVeh and 0.52 or 0.38))

                        local onScreen, screenX, screenY = GetScreenCoordFromWorldCoord(tagPos.x, tagPos.y, tagPos.z)
                        if onScreen then
                            local scale = math.max(0.24, math.min(0.36, 0.33 * (1.0 - (dist / NAMETAG_DISTANCE) * 0.28)))
                            local scaleFactor = scale / 0.32
                            local fade = math.max(0.0, math.min(1.0, (NAMETAG_DISTANCE - dist) / 4.0))
                            local alpha = math.floor(255 * fade)

                            if alpha > 15 then
                                local health = GetEntityHealth(ped)
                                local maxHealth = GetEntityMaxHealth(ped)
                                if maxHealth <= 100 then maxHealth = 200 end
                                local healthPct = math.max(0.0, math.min(1.0, (health - 100) / (maxHealth - 100)))

                                local armour = GetPedArmour(ped)
                                local hasArmour = armour > 0
                                local armourPct = math.max(0.0, math.min(1.0, armour / 100.0))

                                local barWidth = 0.040 * scaleFactor
                                local barHeight = 0.0050 * scaleFactor
                                local border = 0.0009
                                local hasWanted = (info.wanted and info.wanted > 0)

                                -- 1. Wanted indicator (5 HUD-matching star sprites, visible to Police on duty)
                                if hasWanted then
                                    if not HasStreamedTextureDictLoaded('mpleaderboard') then
                                        RequestStreamedTextureDict('mpleaderboard', true)
                                    else
                                        local screenAspect = GetAspectRatio(false)
                                        local starH = 0.024 * scaleFactor
                                        local starW = starH / (screenAspect > 0.0 and screenAspect or 1.777)
                                        local starSpacing = 0.0135 * scaleFactor
                                        local totalW = 4 * starSpacing
                                        local startX = screenX - (totalW / 2.0)
                                        local starsY = screenY - 0.033 * scaleFactor

                                        for i = 1, 5 do
                                            local sX = startX + (i - 1) * starSpacing
                                            if i <= info.wanted then
                                                -- Active wanted star (vibrant crimson #ff3366 like HUD)
                                                DrawSprite('mpleaderboard', 'leaderboard_star_icon', sX, starsY, starW, starH, 0.0, 255, 51, 102, alpha)
                                            else
                                                -- Inactive placeholder star
                                                DrawSprite('mpleaderboard', 'leaderboard_star_icon', sX, starsY, starW, starH, 0.0, 35, 35, 35, math.floor(alpha * 0.45))
                                            end
                                        end
                                    end
                                end

                                -- 2. Player Name & Server ID (with faction color, clean vertical spacing)
                                local nameY = screenY - (hasWanted and 0.016 or 0.018) * scaleFactor
                                local col = info.color or FACTION_COLORS.civilian
                                drawText2D(info.name, screenX, nameY, scale, col.r, col.g, col.b, alpha, 0, true, true)

                                -- 3. Armour Bar (if player has armour)
                                if hasArmour then
                                    local armourY = screenY + 0.005 * scaleFactor
                                    -- Background
                                    DrawRect(screenX, armourY, barWidth + border * 2, barHeight + border * 2, 0, 0, 0, math.min(210, alpha))
                                    -- Fill (Silver/White SA:MP style)
                                    local aFillW = barWidth * armourPct
                                    local aFillX = screenX - (barWidth / 2) + (aFillW / 2)
                                    DrawRect(aFillX, armourY, aFillW, barHeight, 220, 225, 235, alpha)
                                end

                                -- 4. Health Bar (Red SA:MP style, aerated whether armour exists or not)
                                local hpY = screenY + (hasArmour and 0.015 or 0.007) * scaleFactor
                                -- Background
                                DrawRect(screenX, hpY, barWidth + border * 2, barHeight + border * 2, 0, 0, 0, math.min(210, alpha))
                                -- Fill (Classic Red HP)
                                local hFillW = barWidth * healthPct
                                local hFillX = screenX - (barWidth / 2) + (hFillW / 2)
                                DrawRect(hFillX, hpY, hFillW, barHeight, 235, 55, 55, alpha)
                            end
                        end
                    end
                end
            end
            Wait(0)
        end
    end
end)
