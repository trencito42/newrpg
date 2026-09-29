-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — client/diver.lua
--  Marine Salvage Diver client: scuba system, O2 HUD, sonar
--  detector, salvage interaction, boat management.
-- ═══════════════════════════════════════════════════════════════

local ShiftActive  = false
local ContractData = nil     -- { siteId, lootPoints, required, recovered, o2Duration, searchZone }
local ScubaActive  = false   -- true while underwater with gear equipped
local O2Remaining  = 0       -- seconds remaining
local O2Max        = 120
local BoatNetId    = nil     -- rented boat

local SalvageMarkers = {}    -- { idx, coords, claimed }
local NearestSalvage = nil   -- { idx, dist }

local SALVAGE_INTERACT_RADIUS = 3.0
local DETECTOR_UPDATE_MS  = 500
local lastDetectorTick    = 0

-- ── Helpers ──────────────────────────────────────────────────
local function getCfg()
    return Sunset.JobsConfig and Sunset.JobsConfig.diver
end

local function isUnderwater()
    local ped = PlayerPedId()
    return IsPedSwimmingUnderWater(ped)
end

-- ── State Changes ─────────────────────────────────────────────
AddEventHandler('sunset:jobs:stateChanged', function(state, data)
    if not data then return end
    if data.siteId then
        ContractData = data
    elseif data.stage == 'idle' or not data.contractId then
        ContractData = nil
        SalvageMarkers = {}
        NearestSalvage = nil
    end
end)

-- ── Scuba System ──────────────────────────────────────────────
-- Activates when player enters water with scuba_gear in inventory
local function activateScuba(gearDuration)
    if ScubaActive then return end
    ScubaActive = true
    O2Max = gearDuration or 120
    O2Remaining = O2Max
    SetPedDiesInWater(PlayerPedId(), false)
    exports.sunset_core:ShowNotification('~b~Scuba gear active. O2: ' .. O2Max .. 's')
end

local function deactivateScuba(reason)
    if not ScubaActive then return end
    ScubaActive = false
    SetPedDiesInWater(PlayerPedId(), true)
    if reason == 'depleted' then
        exports.sunset_core:ShowNotification('~r~O2 depleted! Surface immediately!')
    elseif reason == 'surfaced' then
        exports.sunset_core:ShowNotification('~b~Scuba gear deactivated — surfaced')
    end
end

-- ── O2 + Scuba Thread ────────────────────────────────────────
CreateThread(function()
    while true do
        Wait(1000)
        if not ShiftActive then goto continue end

        local ped = PlayerPedId()
        local underwater = IsPedSwimmingUnderWater(ped)
        local inWater    = IsPedInWater(ped)

        -- Check gear
        local hasGear = exports.sunset_inventory:GetItemCount('scuba_gear') > 0
            or exports.sunset_inventory:GetItemCount('advanced_tank') > 0

        if underwater and hasGear and ContractData then
            if not ScubaActive then
                local dur = ContractData.o2Duration or 120
                activateScuba(dur)
            else
                O2Remaining = O2Remaining - 1
                if O2Remaining <= 0 then
                    deactivateScuba('depleted')
                    -- Damage player for remaining underwater without O2
                    ApplyDamageToPed(ped, 10, false)
                end
            end
        elseif not underwater and ScubaActive then
            deactivateScuba('surfaced')
            -- Partial O2 carries over within same dive
        end

        ::continue::
    end
end)

-- ── O2 HUD Thread ─────────────────────────────────────────────
CreateThread(function()
    while true do
        Wait(0)
        if not ShiftActive or not ScubaActive then Wait(200); goto continue end

        -- Draw O2 bar (bottom right)
        local pct   = math.max(0, O2Remaining / O2Max)
        local barW  = 0.12
        local barH  = 0.018
        local barX  = 0.88
        local barY  = 0.90

        local r = math.floor(255 * (1.0 - pct))
        local g = math.floor(255 * pct)

        DrawRect(barX, barY, barW + 0.004, barH + 0.006, 0, 0, 0, 160)
        DrawRect(barX - barW/2 + pct * barW/2, barY, pct * barW, barH, r, g, 180, 220)

        SetTextFont(4); SetTextScale(0.0, 0.28)
        SetTextColour(255, 255, 255, 230); SetTextOutline()
        SetTextRightJustify(true)
        BeginTextCommandDisplayText('STRING')
        AddTextComponentSubstringPlayerName(('O2: %ds'):format(math.max(0, O2Remaining)))
        EndTextCommandDisplayText(barX + barW / 2, barY - 0.009)

        -- Contract progress
        if ContractData then
            local rec  = ContractData.recovered or 0
            local req  = ContractData.required  or 1
            local cpct = math.min(1.0, rec / req)
            DrawRect(0.5, 0.04, 0.22, 0.022, 0, 0, 0, 160)
            DrawRect(0.5 - 0.11 + cpct * 0.11, 0.04, cpct * 0.22, 0.022, 30, 120, 200, 200)
            SetTextFont(4); SetTextScale(0.0, 0.32)
            SetTextColour(255, 255, 255, 230); SetTextCentre(true); SetTextOutline()
            BeginTextCommandDisplayText('STRING')
            AddTextComponentSubstringPlayerName(('Salvage: %d / %d'):format(rec, req))
            EndTextCommandDisplayText(0.5, 0.031)
        end

        ::continue::
    end
end)

-- ── Sonar Detector Thread ─────────────────────────────────────
CreateThread(function()
    while true do
        Wait(0)
        if not ShiftActive or not ContractData or not ScubaActive then
            Wait(500)
            goto continue
        end

        local now = GetGameTimer()
        if now - lastDetectorTick < DETECTOR_UPDATE_MS then goto continue end
        lastDetectorTick = now

        local pos = GetEntityCoords(PlayerPedId())
        local cfg = getCfg()
        local farR  = (cfg and cfg.detectorFar)   or 30.0
        local midR  = (cfg and cfg.detectorMid)   or 15.0
        local closeR = (cfg and cfg.detectorClose) or 5.0

        NearestSalvage = nil
        local nearestDist = 9999

        for _, marker in ipairs(SalvageMarkers) do
            if not marker.claimed then
                local d = #(vector3(pos.x, pos.y, pos.z) - vector3(marker.coords.x, marker.coords.y, marker.coords.z))
                if d < nearestDist then
                    nearestDist = d
                    NearestSalvage = { idx = marker.idx, dist = d }
                end
            end
        end

        if NearestSalvage then
            local d = NearestSalvage.dist
            -- Play beep tone based on distance range
            if d <= closeR then
                PlaySoundFrontend(-1, 'PICK_UP', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
            elseif d <= midR then
                PlaySoundFrontend(-1, 'RADAR_ON', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
            elseif d <= farR then
                PlaySoundFrontend(-1, 'WAYPOINT_SET', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
            end

            -- Draw a directional arrow (no exact position marker)
            if d <= farR then
                local marker = SalvageMarkers[NearestSalvage.idx]
                if marker then
                    -- Direction indicator text
                    local dx = marker.coords.x - pos.x
                    local dy = marker.coords.y - pos.y
                    local dz = marker.coords.z - pos.z
                    local angleDeg = math.deg(math.atan(dy, dx))
                    local dirs = { 'E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE' }
                    local idx2 = math.floor(((angleDeg + 180 + 22.5) / 45) % 8) + 1
                    local dirLabel = dirs[idx2] or '?'
                    local depthDiff = dz

                    SetTextFont(4); SetTextScale(0.0, 0.32)
                    SetTextColour(30, 200, 255, 230); SetTextCentre(true); SetTextOutline()
                    BeginTextCommandDisplayText('STRING')
                    local depthStr = depthDiff < 0 and ('~r~↓%.0fm'):format(math.abs(depthDiff))
                        or ('~g~↑%.0fm'):format(depthDiff)
                    AddTextComponentSubstringPlayerName(
                        ('~b~◉~s~ %s %s  ~y~%.0fm'):format(dirLabel, depthStr, d))
                    EndTextCommandDisplayText(0.5, 0.92)
                end
            end
        end

        ::continue::
    end
end)

-- ── Salvage Marker Management ─────────────────────────────────
-- Populate markers from contract snapshot (called on contract start)
local function buildSalvageMarkers(lootPoints)
    SalvageMarkers = {}
    for i, pt in ipairs(lootPoints or {}) do
        SalvageMarkers[i] = {
            idx     = i,
            coords  = { x = pt.x, y = pt.y, z = pt.z },
            claimed = pt.claimed or false,
        }
    end
end

-- ── Salvage Interaction Thread ────────────────────────────────
CreateThread(function()
    while true do
        if not ShiftActive then Wait(1000) goto continue end
        Wait(0)

        if not ContractData or not ScubaActive then goto continue end

        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)

        local nearest, nearestD = nil, 9999
        for _, marker in ipairs(SalvageMarkers) do
            if not marker.claimed then
                local d = #(vector3(pos.x, pos.y, pos.z)
                    - vector3(marker.coords.x, marker.coords.y, marker.coords.z))
                if d < nearestD then nearestD = d; nearest = marker end
            end
        end

        if nearest and nearestD <= SALVAGE_INTERACT_RADIUS then
            -- Show salvage marker
            DrawMarker(2, nearest.coords.x, nearest.coords.y, nearest.coords.z + 0.3,
                0, 0, 0, 0, 0, 0, 0.4, 0.4, 0.4,
                30, 180, 255, 200, false, true, 2, false, nil, nil, false)
            DisplayHelpTextThisFrame('Press ~INPUT_CONTEXT~ to recover salvage')

            if IsControlJustPressed(0, 38) then -- E
                local result, err = exports.sunset_jobs:CallCallback(
                    'sunset:jobs:diver:salvage', nearest.idx)
                if not result then
                    exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Salvage failed'))
                else
                    nearest.claimed = true
                    if ContractData then ContractData.recovered = result.recovered end
                    exports.sunset_core:ShowNotification(
                        ('~g~Salvaged: ~y~%s~s~ (~b~%s~s~, $%d)'):format(
                            result.item or '?', result.condition or '?', result.value or 0))
                    if result.completed then
                        -- Handled by contractComplete event
                    end
                end
            end
        end

        ::continue::
    end
end)

-- ── Boat Management ───────────────────────────────────────────
-- Server asks client to spawn the boat, then client reports back netId
RegisterNetEvent('sunset:diving:spawnBoat', function(model, spawnCoords, cost)
    local hash = GetHashKey(model)
    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) and t < 5000 do Wait(100); t = t + 100 end
    if not HasModelLoaded(hash) then
        exports.sunset_core:ShowNotification('~r~Failed to spawn boat. Model not loaded.')
        return
    end
    local boat = CreateVehicle(hash,
        spawnCoords.x, spawnCoords.y, spawnCoords.z,
        spawnCoords.h or 0.0, true, false)
    if not DoesEntityExist(boat) then
        exports.sunset_core:ShowNotification('~r~Failed to spawn boat. Try again.')
        return
    end
    SetEntityAsMissionEntity(boat, true, true)
    SetModelAsNoLongerNeeded(hash)
    BoatNetId = VehicleToNet(boat)
    TriggerServerEvent('sunset:diving:boatSpawned', BoatNetId)
    exports.sunset_core:ShowNotification(('~g~Work boat rented for ~y~$%d~g~. Good luck!'):format(cost))
end)

RegisterNetEvent('sunset:diving:boatReturned', function()
    BoatNetId = nil
    exports.sunset_core:ShowNotification('~b~Work boat returned.')
end)

-- ── Contract Complete ─────────────────────────────────────────
RegisterNetEvent('sunset:diving:contractComplete', function(result)
    local msg = ('~g~Contract Complete!~s~ Earned ~y~$%d~s~ + ~b~%d XP~s~'):format(
        result.bonus or 0, result.xp or 0)
    BeginTextCommandThisFrame('STRING')
    AddTextComponentSubstringPlayerName(msg)
    EndTextCommandThisFrame(3, 0, 6000, -1, -1)
    ContractData   = nil
    SalvageMarkers = {}
    NearestSalvage = nil
    -- Deactivate scuba on contract complete
    deactivateScuba('surfaced')
end)

-- ── Workplace Special Actions ─────────────────────────────────
AddEventHandler('sunset:workplace:specialAction', function(jobId, actionId)
    if jobId ~= 'diver' then return end

    if actionId == 'contracts' then
        local contracts, err = exports.sunset_jobs:CallCallback('sunset:jobs:diver:getContracts')
        if not contracts then
            exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Failed to load contracts'))
            return
        end
        SendNuiMessage(json.encode({ type = 'SHOW_DIVE_CONTRACTS', payload = contracts }))
        SetNuiFocus(true, true)

    elseif actionId == 'rent_gear' then
        SendNuiMessage(json.encode({ type = 'SHOW_GEAR_SHOP' }))
        SetNuiFocus(true, true)

    elseif actionId == 'rent_boat' then
        local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:diver:rentBoat')
        if not result then
            exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Cannot rent boat'))
        end

    elseif actionId == 'sell' then
        local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:diver:sell')
        if not result then
            exports.sunset_core:ShowNotification(('~r~%s'):format(err or 'Nothing to sell'))
        else
            exports.sunset_core:ShowNotification(
                ('~g~Sold %d items for ~y~$%d~g~!'):format(result.count, result.total))
        end
    end
end)

RegisterNUICallback('diver:startContract', function(data, cb)
    local siteId = data and data.siteId
    if not siteId then cb({ ok = false }) return end
    local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:diver:startContract', siteId)
    if not result then
        cb({ ok = false, error = err })
    else
        ContractData = result
        buildSalvageMarkers(result.lootPoints)
        SetNuiFocus(false, false)
        exports.sunset_core:ShowNotification(
            ('~g~Contract accepted.~s~ Travel to ~b~%s'):format(result.siteId or '?'))
        cb({ ok = true })
    end
end)

RegisterNUICallback('diver:rentGear', function(data, cb)
    local tier = data and data.tier or 'basic'
    local result, err = exports.sunset_jobs:CallCallback('sunset:jobs:diver:rentGear', tier)
    if not result then
        cb({ ok = false, error = err })
    else
        cb({ ok = true, tier = result.tier, o2Duration = result.o2Duration })
    end
end)

RegisterNUICallback('diver:closePanel', function(_, cb)
    SetNuiFocus(false, false)
    cb({})
end)

-- ── Shift Start/End ───────────────────────────────────────────
AddEventHandler('sunset:jobs:shiftStarted', function(jobId)
    if jobId ~= 'diver' then return end
    ShiftActive = true
end)

AddEventHandler('sunset:jobs:shiftEnded', function(jobId)
    if jobId ~= 'diver' then return end
    ShiftActive    = false
    ContractData   = nil
    SalvageMarkers = {}
    NearestSalvage = nil
    deactivateScuba('surfaced')
    -- Return boat if still rented
    if BoatNetId then
        TriggerServerEvent('sunset:diving:returnBoat')
        BoatNetId = nil
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    SetPedDiesInWater(PlayerPedId(), true)
end)
