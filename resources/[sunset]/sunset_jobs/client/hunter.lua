-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — client/hunter.lua
--  Hunter job client: shift loop, animal spawning, tracking HUD,
--  harvest interaction, contract HUD.
-- ═══════════════════════════════════════════════════════════════

local cfg         = Sunset.JobsConfig and Sunset.JobsConfig.hunter
local ShiftActive = false
local CurrentZone = nil          -- zone table from route store
local ContractData = nil         -- { contractId, species, requiredHarvests, harvested, zone }
local ManagedAnimals = {}        -- [netId] = { ped, species, alive }
local CarcassMarkers = {}        -- [netId] = { coords, label }
local HarvestPromptNetId = nil   -- carcass near player
local TrackingCooldownMs = 0
local TRACK_INTERVAL_MS  = 8000

-- ── Helpers ──────────────────────────────────────────────────
local function refreshCfg()
    cfg = Sunset.JobsConfig and Sunset.JobsConfig.hunter
end

local function isInZone(zone)
    if not zone or not zone.polygon then return false end
    local pos = GetEntityCoords(PlayerPedId())
    local inside = false
    local n = #zone.polygon
    local j = n
    for i = 1, n do
        local xi, yi = zone.polygon[i].x, zone.polygon[i].y
        local xj, yj = zone.polygon[j].x, zone.polygon[j].y
        local intersect = ((yi > pos.y) ~= (yj > pos.y))
            and (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi)
        if intersect then inside = not inside end
        j = i
    end
    return inside
end

local function closeEnough(coords, radius)
    local pos = GetEntityCoords(PlayerPedId())
    return #(vector3(pos.x, pos.y, pos.z) - vector3(coords.x, coords.y, coords.z)) <= radius
end

local function updateShiftHud()
    if not ShiftActive then return end
    if ContractData and ContractData.contractId then
        local harvested = ContractData.harvested or 0
        local required  = ContractData.requiredHarvests or 1
        exports.sunset_ui:Send('jobShiftShow', {
            title    = 'Hunter',
            counter  = ('Harvest %d / %d'):format(harvested, required),
            message  = 'Shoot {key} and harvest carcasses in the zone.',
            key      = 'E',
            progress = math.floor((harvested / required) * 100),
            detail   = ContractData.contractId or '',
        })
    else
        exports.sunset_ui:Send('jobShiftShow', {
            title   = 'Hunter',
            counter = 'No active contract',
            message = 'Visit Mason and select a contract.',
            detail  = '',
            progress = 0,
        })
    end
end

-- ── Zone Navigation Blip ─────────────────────────────────────
-- [SECTION 19] Area blip toward hunting zone — no exact animal GPS.
local ZoneBlip = nil

local function clearZoneBlip()
    if ZoneBlip and DoesBlipExist(ZoneBlip) then RemoveBlip(ZoneBlip) end
    ZoneBlip = nil
    SetWaypointOff()
end

local function setZoneBlip(zone)
    clearZoneBlip()
    if not zone then return end
    -- Use centroid of polygon as navigation target (rough, not exact animal positions)
    local polygon = zone.polygon or {}
    if #polygon == 0 then return end
    local cx, cy = 0, 0
    for _, pt in ipairs(polygon) do cx = cx + pt.x; cy = cy + pt.y end
    cx = cx / #polygon; cy = cy / #polygon
    ZoneBlip = AddBlipForCoord(cx, cy, zone.minZ or 0)
    SetBlipSprite(ZoneBlip, 153)
    SetBlipColour(ZoneBlip, 2)
    SetBlipScale(ZoneBlip, 1.1)
    SetBlipAsShortRange(ZoneBlip, false)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(('Hunting Zone — %s'):format(zone.label or zone.id or '?'))
    EndTextCommandSetBlipName(ZoneBlip)
    -- Also set GPS waypoint so minimap nav activates immediately
    SetNewWaypoint(cx, cy)
    exports.sunset_ui:Notify(('GPS set to Hunting Zone: %s. No animal positions shown — track them.'):format(
        zone.label or zone.id or '?'), 'info', 7000)
end

-- ── State Changes ─────────────────────────────────────────────
AddEventHandler('sunset:jobs:stateChanged', function(state, data)
    if not data then return end
    if data.contractId and data.zoneId then
        ContractData = data
        -- Zone object is embedded in data by server (startContract response)
        CurrentZone = data.zone or CurrentZone
        if CurrentZone and not ZoneBlip then
            setZoneBlip(CurrentZone)
        end
    elseif data.stage == 'idle' or not data.contractId then
        CurrentZone = nil
        ContractData = nil
        clearZoneBlip()
    end
    updateShiftHud()
end)

-- ── Animal Spawn Request (from server) ───────────────────────
RegisterNetEvent('sunset:hunting:spawnAnimals', function(zoneId, zone, needed, speciesCfg)
    refreshCfg()
    if not zone or not zone.spawnPoints or #zone.spawnPoints == 0 then return end
    if not speciesCfg then return end

    -- Build weighted species list from zone species table
    local spawnList = {}
    for sp, count in pairs(zone.species or {}) do
        if speciesCfg[sp] then
            for _ = 1, count do spawnList[#spawnList + 1] = sp end
        end
    end
    if #spawnList == 0 then return end

    local spawned = 0
    for _, pt in ipairs(zone.spawnPoints) do
        if spawned >= needed then break end
        local species = spawnList[math.random(#spawnList)]
        local spCfg = speciesCfg[species]
        if spCfg then
            local model = GetHashKey(spCfg.model)
            RequestModel(model)
            local t = 0
            while not HasModelLoaded(model) and t < 3000 do
                Wait(100); t = t + 100
            end
            if HasModelLoaded(model) then
                -- Adjust Z to ground
                local groundZ = pt.z
                local ok, gz = GetGroundZFor_3dCoord(pt.x, pt.y, pt.z + 2.0, false)
                if ok then groundZ = gz end

                local ped = CreatePed(28, model, pt.x, pt.y, groundZ - 1.0, pt.h or 0.0, true, true)
                if DoesEntityExist(ped) then
                    SetEntityAsMissionEntity(ped, true, true)
                    SetPedFleeAttributes(ped, 0, false)
                    SetBlockingOfNonTemporaryEvents(ped, false)
                    TaskWanderInArea(ped, pt.x, pt.y, groundZ, 30.0, 10.0, 10.0)

                    local netId = PedToNet(ped)
                    local weight = spCfg.weightMin + math.random() * (spCfg.weightMax - spCfg.weightMin)
                    ManagedAnimals[netId] = { ped = ped, species = species, alive = true }

                    -- Register with server
                    TriggerServerEvent('sunset:hunting:registerAnimal', netId, species, zoneId, weight)
                    spawned = spawned + 1

                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- ── Notify animal was hit ─────────────────────────────────────
RegisterNetEvent('sunset:hunting:animalHit', function(netId, shooterSrc)
    local animal = ManagedAnimals[netId]
    if not animal or not animal.ped or not DoesEntityExist(animal.ped) then return end
    -- Make the animal flee in panic
    local ped   = animal.ped
    local src   = GetPlayerPed(GetPlayerFromServerId(shooterSrc))
    local pos   = src and DoesEntityExist(src) and GetEntityCoords(src) or GetEntityCoords(ped)
    TaskSmartFleeCoord(ped, pos.x, pos.y, pos.z, 60.0, -1, true, false)
    SetPedFleeAttributes(ped, 0, false)
end)

-- ── Notify animal is down ─────────────────────────────────────
RegisterNetEvent('sunset:hunting:animalDown', function(netId, coords, isOwner)
    local animal = ManagedAnimals[netId]
    if animal then
        animal.alive = false
        if animal.ped and DoesEntityExist(animal.ped) then
            -- Make it lie still
            SetEntityInvincible(animal.ped, true)
            ClearPedTasks(animal.ped)
        end
    end
    -- reportKillWeapon removed: weapon tracked server-side via weaponDamageEvent
    -- Mark as harvestable
    CarcassMarkers[netId] = { coords = coords, isOwner = isOwner }
end)

-- ── Contract Complete ─────────────────────────────────────────
RegisterNetEvent('sunset:hunting:contractComplete', function(result)
    local msg = ('Contract Complete! Earned $%d + %d XP'):format(
        result.bonus or 0, result.xp or 0)
    exports.sunset_ui:Notify(msg, 'success', 6000)
    ContractData = nil
    -- [SECTION 19] Clear zone blip when contract is complete
    clearZoneBlip()
end)

-- ── HUD Thread ────────────────────────────────────────────────
CreateThread(function()
    while true do
        if not ShiftActive then Wait(1000) goto continue end
        Wait(0)

        -- Harvest prompts for nearby carcasses
        HarvestPromptNetId = nil
        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        for netId, marker in pairs(CarcassMarkers) do
            local d = #(vector3(pos.x, pos.y, pos.z) - vector3(marker.coords.x, marker.coords.y, marker.coords.z))
            if d < (cfg and cfg.harvestRadius or 4.0) then
                HarvestPromptNetId = netId
                -- Draw prompt
                DrawMarker(2, marker.coords.x, marker.coords.y, marker.coords.z + 0.5,
                    0, 0, 0, 0, 0, 0, 0.4, 0.4, 0.4,
                    255, 180, 0, 180, false, true, 2, false, nil, nil, false)
                DisplayHelpTextThisFrame('Press ~INPUT_CONTEXT~ to inspect carcass')
            end
        end

        ::continue::
    end
end)

-- ── Input Thread ──────────────────────────────────────────────
CreateThread(function()
    while true do
        if not ShiftActive then Wait(1000) goto continue end
        Wait(0)

        -- Harvest prompt interaction
        if HarvestPromptNetId and IsControlJustPressed(0, 38) then -- E key
            local netId = HarvestPromptNetId
            HarvestPromptNetId = nil  -- prevent double-trigger
            CreateThread(function()
                local info, err = Sunset.AwaitCallback('sunset:jobs:hunter:inspectCarcass', netId)
                if not info then
                    exports.sunset_ui:Notify(err or 'Cannot inspect', 'error', 4000)
                else
                    -- Show carcass info via playerInteraction (no NUI panel needed)
                    exports.sunset_ui:Send('playerInteractionShow', {
                        menuTitle = 'Carcass Inspection',
                        target = { name = info.label or (info.species or 'Animal'), id = '' },
                        actions = {
                            {
                                id     = 'hunter_harvest_' .. tostring(netId),
                                label  = ('Harvest — %s  (%.1f kg)'):format(info.grade or '?', info.weight or 0),
                                detail = ('Quality: %d%%  ·  Shots: %d  ·  Method: %s'):format(
                                    info.quality or 0, info.shots or 1, info.method or '?'),
                                group  = 'HARVEST',
                            },
                            { id = 'hunter_cancel_inspect', label = '← Close', group = 'NAV' },
                        },
                    })
                    exports.sunset_ui:SetFocus(true, true)
                end
            end)
        end

        -- Tracking clue (B key)
        if ContractData and IsControlJustPressed(0, 30) then
            local now = GetGameTimer()
            if now > TrackingCooldownMs then
                TrackingCooldownMs = now + TRACK_INTERVAL_MS
                CreateThread(function()
                    local clue, clueErr = Sunset.AwaitCallback('sunset:jobs:hunter:track')
                    if clue and clue.type ~= 'no_tracks' then
                        exports.sunset_ui:Notify(clue.message or 'Tracks spotted nearby.', 'info', 5000)
                    elseif clue then
                        exports.sunset_ui:Notify('No fresh tracks in range. Move deeper.', 'info', 4000)
                    end
                end)
            else
                local remaining = math.ceil((TrackingCooldownMs - GetGameTimer()) / 1000)
                exports.sunset_ui:Notify(('Tracking cooldown: %ds'):format(remaining), 'info', 2000)
            end
        end

        ::continue::
    end
end)

-- ── playerInteraction Handler (carcass harvest) ───────────────
AddEventHandler('sunset:nui:playerInteractionAction', function(data)
    if not data or not data.action then return end
    local action = data.action

    if action:find('^hunter_harvest_') then
        local netId = tonumber((action:gsub('^hunter_harvest_', '')))
        if not netId then return end
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
        CreateThread(function()
            local result, err = Sunset.AwaitCallback('sunset:jobs:hunter:harvest', netId)
            if not result then
                exports.sunset_ui:Notify(err or 'Harvest failed', 'error', 5000)
            else
                -- [SECTION 20] Remove from client registries AFTER successful harvest
                CarcassMarkers[netId] = nil
                local animal = ManagedAnimals[netId]
                if animal then
                    -- Delete the physical ped; entity is no longer needed
                    if animal.ped and DoesEntityExist(animal.ped) then
                        SetEntityAsMissionEntity(animal.ped, false, true)
                        DeleteEntity(animal.ped)
                    end
                    ManagedAnimals[netId] = nil
                end
                if ContractData then
                    ContractData.harvested = result.contractProgress or ContractData.harvested
                    updateShiftHud()
                end
                exports.sunset_ui:Notify(
                    ('Harvested! Grade: %s · Quality: %d%%'):format(
                        result.grade or '?', result.quality or 0),
                    'success', 5000)
            end
        end)

    elseif action == 'hunter_cancel_inspect' then
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
    end
end)

-- Special actions handled in workplaces.lua

-- Contract start now goes through workplaces.lua sub-menu handler
AddEventHandler('sunset:hunting:contractStarted', function(result)
    if not result then return end
    ContractData = result
    CurrentZone  = result.zone
    -- [SECTION 19] Set zone blip on new contract
    if CurrentZone then setZoneBlip(CurrentZone) end
    updateShiftHud()
end)

-- ── Shift Start/End (canonical session events) ───────────────
AddEventHandler('sunset:jobs:sessionStarted', function(jobId, session)
    if jobId ~= 'hunter' then return end
    ShiftActive = true
    refreshCfg()
    -- Restore contract state from session on reconnect/reload
    if session and session.data and session.data.contractId then
        ContractData = session.data
        CurrentZone  = session.data.zone or nil
    end
    updateShiftHud()
end)

AddEventHandler('sunset:jobs:sessionEnded', function(jobId, state, reason)
    if jobId ~= 'hunter' then return end
    ShiftActive = false
    ContractData = nil
    CurrentZone  = nil
    -- [SECTION 19] Clear zone blip on shift end/cancel
    clearZoneBlip()
    exports.sunset_ui:Send('jobShiftHide', {})
    exports.sunset_ui:Send('hunterCompassHide', {})
    -- Clean up all spawned animals
    for netId, animal in pairs(ManagedAnimals) do
        if animal.ped and DoesEntityExist(animal.ped) then
            DeleteEntity(animal.ped)
        end
    end
    ManagedAnimals = {}
    CarcassMarkers = {}
    HarvestPromptNetId = nil
end)

-- ── Position Sync Thread ──────────────────────────────────────
-- Keeps server updated with animal positions (for tracking clue accuracy).
-- Also reports deaths to server for validation.
CreateThread(function()
    while true do
        Wait(3000)
        if not ShiftActive then goto continue end
        for netId, animal in pairs(ManagedAnimals) do
            if animal.ped and DoesEntityExist(animal.ped) then
                if animal.alive then
                    -- Check if the entity is actually dead
                    if GetEntityHealth(animal.ped) <= 0 then
                        -- Report to server — server validates and processes exactly once
                        TriggerServerEvent('sunset:hunting:reportAnimalDead', netId)
                    else
                        local pos = GetEntityCoords(animal.ped)
                        TriggerServerEvent('sunset:hunting:updateAnimalPos', netId, pos.x, pos.y, pos.z)
                    end
                end
            end
        end
        ::continue::
    end
end)

-- ── Hunter Compass HUD ───────────────────────────────────────
-- Points toward nearest alive contract animal, or zone centroid if none yet visible.
CreateThread(function()
    while true do
        Wait(500)
        if not ShiftActive then
            exports.sunset_ui:Send('hunterCompassHide', {})
            goto compassContinue
        end

        local playerPos = GetEntityCoords(PlayerPedId())
        local target, targetLabel, targetDist = nil, nil, math.huge

        -- Prefer nearest alive managed animal
        for _, animal in pairs(ManagedAnimals) do
            if animal.ped and DoesEntityExist(animal.ped) and animal.alive then
                local pos = GetEntityCoords(animal.ped)
                local d = #(vector3(playerPos.x, playerPos.y, playerPos.z) - vector3(pos.x, pos.y, pos.z))
                if d < targetDist then
                    targetDist  = d
                    target      = pos
                    targetLabel = animal.species or 'Animal'
                end
            end
        end

        -- Fall back to zone centroid
        if not target and CurrentZone and CurrentZone.polygon and #CurrentZone.polygon > 0 then
            local cx, cy = 0, 0
            for _, pt in ipairs(CurrentZone.polygon) do cx = cx + pt.x; cy = cy + pt.y end
            local n = #CurrentZone.polygon
            target      = vector3(cx / n, cy / n, CurrentZone.minZ or playerPos.z)
            targetDist  = #(vector3(playerPos.x, playerPos.y, playerPos.z) - target)
            targetLabel = CurrentZone.label or 'Hunting Zone'
        end

        if not target then
            exports.sunset_ui:Send('hunterCompassHide', {})
            goto compassContinue
        end

        -- Angle from North, clockwise (0=N, 90=E, 180=S, 270=W)
        local dx = target.x - playerPos.x
        local dy = target.y - playerPos.y
        local angle = math.deg(math.atan(dx, dy))
        if angle < 0 then angle = angle + 360 end

        exports.sunset_ui:Send('hunterCompassUpdate', {
            angle = angle,
            dist  = targetDist,
            label = targetLabel,
        })

        ::compassContinue::
    end
end)

-- ── Cleanup on resource stop ──────────────────────────────────
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, animal in pairs(ManagedAnimals) do
        if animal.ped and DoesEntityExist(animal.ped) then
            DeleteEntity(animal.ped)
        end
    end
end)
