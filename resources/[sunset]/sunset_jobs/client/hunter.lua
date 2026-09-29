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

-- ── State Changes ─────────────────────────────────────────────
AddEventHandler('sunset:jobs:stateChanged', function(state, data)
    if not data then return end
    if data.contractId and data.zoneId then
        local zones = SunsetJobRoutes.GetRoutes and SunsetJobRoutes.GetRoutes('hunting') or {}
        for _, z in ipairs(zones) do
            if z.id == data.zoneId then CurrentZone = z break end
        end
        ContractData = data
    else
        CurrentZone = nil
        ContractData = nil
    end
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
    -- Report weapon used to server for quality scoring
    local weaponHash, _ = GetCurrentPedWeapon(PlayerPedId(), true)
    if weaponHash and weaponHash ~= 0 then
        TriggerServerEvent('sunset:hunting:reportKillWeapon', netId, weaponHash)
    end
    -- Mark as harvestable
    CarcassMarkers[netId] = { coords = coords, isOwner = isOwner }
end)

-- ── Contract Complete ─────────────────────────────────────────
RegisterNetEvent('sunset:hunting:contractComplete', function(result)
    local msg = ('~g~Contract Complete!~s~ Earned ~y~$%d~s~ + ~b~%d XP~s~'):format(
        result.bonus or 0, result.xp or 0)
    DisplayHelpTextThisFrame(msg)
    BeginTextCommandThisFrame('STRING')
    AddTextComponentSubstringPlayerName(msg)
    EndTextCommandThisFrame(3, 0, 6000, -1, -1)
    ContractData = nil
end)

-- ── HUD Thread ────────────────────────────────────────────────
CreateThread(function()
    while true do
        if not ShiftActive then Wait(1000) goto continue end
        Wait(0)

        -- Contract progress bar
        if ContractData and ContractData.contractId then
            local harvested = ContractData.harvested or 0
            local required  = ContractData.requiredHarvests or 1
            local pct = math.min(1.0, harvested / required)
            -- Draw a simple progress bar at top of screen
            DrawRect(0.5, 0.04, 0.22, 0.022, 0, 0, 0, 160)
            DrawRect(0.5 - 0.11 + pct * 0.11, 0.04, pct * 0.22, 0.022, 34, 139, 34, 200)
            SetTextFont(4); SetTextScale(0.0, 0.32)
            SetTextColour(255, 255, 255, 230)
            SetTextCentre(true); SetTextOutline()
            BeginTextCommandDisplayText('STRING')
            AddTextComponentSubstringPlayerName(('Contract: %d / %d'):format(harvested, required))
            EndTextCommandDisplayText(0.5, 0.031)
        end

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
            -- Inspect first
            local info, err = exports.sunset_jobs:CallCallback('sunset:jobs:hunter:inspectCarcass', netId)
            if not info then
                exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Cannot inspect'))
            else
                -- Show carcass inspection panel
                SendNuiMessage(json.encode({
                    type    = 'SHOW_CARCASS_PANEL',
                    payload = info,
                }))
                SetNuiFocus(true, true)
            end
        end

        -- Tracking clue (hold B or custom keybind)
        if ContractData and IsControlJustPressed(0, 30) then -- B key (INPUT_DUCK maps differently)
            local now = GetGameTimer()
            if now > TrackingCooldownMs then
                TrackingCooldownMs = now + TRACK_INTERVAL_MS
                local clue, clueErr = exports.sunset_jobs:CallCallback('sunset:jobs:hunter:track')
                if clue and clue.type ~= 'no_tracks' then
                    ShowFloatingHelpNotification(clue.message or 'Tracks spotted nearby.')
                elseif clue then
                    ShowFloatingHelpNotification('~y~No fresh tracks in range. Move deeper.')
                end
            else
                local remaining = math.ceil((TrackingCooldownMs - GetGameTimer()) / 1000)
                exports.sunset_core:ShowNotification(('~y~Tracking cooldown: %ds'):format(remaining))
            end
        end

        ::continue::
    end
end)

-- ── NUI Callbacks ─────────────────────────────────────────────
RegisterNUICallback('hunter:harvest', function(data, cb)
    local netId = tonumber(data and data.netId)
    if not netId then cb({ ok = false, error = 'Invalid' }) return end
    local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:hunter:harvest', netId)
    if not result then
        cb({ ok = false, error = err or 'Harvest failed' })
    else
        CarcassMarkers[netId] = nil
        if ContractData then
            ContractData.harvested = result.contractProgress or ContractData.harvested
        end
        cb({ ok = true, items = result.items, quality = result.quality, grade = result.grade })
    end
end)

RegisterNUICallback('hunter:closePanel', function(_, cb)
    SetNuiFocus(false, false)
    cb({})
end)

-- ── Workplace Special Actions ─────────────────────────────────
AddEventHandler('sunset:workplace:specialAction', function(jobId, actionId)
    if jobId ~= 'hunter' then return end
    refreshCfg()

    if actionId == 'contracts' then
        local contracts, err = exports.sunset_jobs:CallCallback('sunset:jobs:hunter:getContracts')
        if not contracts then
            exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Failed to load contracts'))
            return
        end
        SendNuiMessage(json.encode({ type = 'SHOW_CONTRACTS', payload = contracts }))
        SetNuiFocus(true, true)

    elseif actionId == 'sell_harvest' then
        local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:hunter:sellHarvest')
        if not result then
            exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Nothing to sell'))
        else
            exports.sunset_core:ShowNotification(
                ('~g~Sold %d items for ~y~$%d~g~!'):format(result.count, result.total))
        end

    elseif actionId == 'equipment' then
        SendNuiMessage(json.encode({ type = 'SHOW_SHOP', category = 'hunting_equipment' }))
        SetNuiFocus(true, true)
    end
end)

RegisterNUICallback('hunter:startContract', function(data, cb)
    local cId = data and data.contractId
    if not cId then cb({ ok = false }) return end
    local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:hunter:startContract', cId)
    if not result then
        cb({ ok = false, error = err })
    else
        ContractData = result
        CurrentZone  = result.zone
        SetNuiFocus(false, false)
        exports.sunset_core:ShowNotification(
            ('~g~Contract accepted.~s~ Travel to ~b~%s'):format(result.zone and result.zone.label or '?'))
        cb({ ok = true })
    end
end)

-- ── Shift Start/End ───────────────────────────────────────────
AddEventHandler('sunset:jobs:shiftStarted', function(jobId)
    if jobId ~= 'hunter' then return end
    ShiftActive = true
    refreshCfg()
end)

AddEventHandler('sunset:jobs:shiftEnded', function(jobId)
    if jobId ~= 'hunter' then return end
    ShiftActive = false
    ContractData = nil
    CurrentZone  = nil
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
-- Keeps server updated with animal positions (for tracking clue accuracy)
CreateThread(function()
    while true do
        Wait(3000)
        if not ShiftActive then goto continue end
        for netId, animal in pairs(ManagedAnimals) do
            if animal.ped and DoesEntityExist(animal.ped) and animal.alive then
                local pos = GetEntityCoords(animal.ped)
                TriggerServerEvent('sunset:hunting:updateAnimalPos', netId, pos.x, pos.y, pos.z)
            end
        end
        ::continue::
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
