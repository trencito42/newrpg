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

local function updateShiftHud()
    if not ShiftActive then return end
    if ContractData and ContractData.siteId then
        local rec = ContractData.recovered or 0
        local req = ContractData.required  or 1
        exports.sunset_ui:Send('jobShiftShow', {
            title    = 'Marine Salvage',
            counter  = ('Salvage %d / %d'):format(rec, req),
            message  = O2Remaining > 0
                and ('O2: %ds  — Press {key} on salvage points'):format(O2Remaining)
                or 'Surface to refill O2!',
            key      = 'E',
            progress = math.floor((rec / req) * 100),
            detail   = ContractData.siteId or '',
        })
    else
        exports.sunset_ui:Send('jobShiftShow', {
            title    = 'Marine Salvage',
            counter  = 'No active contract',
            message  = 'Visit Terry and select a salvage contract.',
            detail   = '',
            progress = 0,
        })
    end
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
    updateShiftHud()
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
-- Updates jobShiftShow every second while diving (O2 countdown in message)
CreateThread(function()
    while true do
        Wait(1000)
        if not ShiftActive then goto continue end
        if ScubaActive or ContractData then
            updateShiftHud()
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
                    if ContractData then
                        ContractData.recovered = result.recovered
                        updateShiftHud()
                    end
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

-- Special actions handled in workplaces.lua

-- Contract + gear selection handled via workplaces.lua sub-menu (no NUI panels needed)

-- Contract started event (from workplaces sub-menu handler)
AddEventHandler('sunset:diving:contractStarted', function(result)
    if not result then return end
    ContractData = result
    buildSalvageMarkers(result.lootPoints)
    updateShiftHud()
end)

-- ── Shift Start/End ───────────────────────────────────────────
AddEventHandler('sunset:jobs:shiftStarted', function(jobId)
    if jobId ~= 'diver' then return end
    ShiftActive = true
    updateShiftHud()
end)

AddEventHandler('sunset:jobs:shiftEnded', function(jobId)
    if jobId ~= 'diver' then return end
    ShiftActive    = false
    ContractData   = nil
    SalvageMarkers = {}
    NearestSalvage = nil
    deactivateScuba('surfaced')
    exports.sunset_ui:Send('jobShiftHide', {})
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
