-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — client/diver.lua
--  Marine Salvage Diver client: scuba system, O2 HUD, sonar
--  detector, salvage interaction, boat management.
-- ═══════════════════════════════════════════════════════════════

local ShiftActive  = false
local ContractData = nil     -- { siteId, lootPoints, required, recovered, o2Duration, searchZone }
local ScubaActive  = false   -- true while underwater with gear equipped
local O2Remaining  = 0       -- seconds remaining; persists across surface/dive cycles, only reset at gear rental
local O2Max        = 0       -- max O2 from current gear rental; 0 = no gear rented
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

-- [SECTION 26] Forward-declare resetO2 BEFORE the stateChanged handler so the
-- closure captures the correct upvalue. The function body is assigned below.
-- Without this declaration, the stateChanged handler at line ~62 would resolve
-- resetO2 from the global table (nil), causing a "attempt to call nil" error
-- the first time a dive contract was accepted.
local resetO2

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
            -- [SECTION 42] Surfacing does NOT refill O2 — O2 is tied to the tank and only
            -- resets when a new tank is rented from Terry. The old "Surface to refill O2!"
            -- message was factually wrong. Players must return to Terry for a replacement.
            message  = O2Remaining > 0
                and ('O2: %ds  — Press {key} on salvage points'):format(O2Remaining)
                or '~r~O2 depleted — return to Terry for a new tank!',
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

-- Terry handoff proximity state
local TerryHandoffReady = false
local TERRY_COORDS = { x = -812.0, y = -1282.0, z = 5.0 }

-- ── State Changes ─────────────────────────────────────────────
AddEventHandler('sunset:jobs:stateChanged', function(state, data)
    if not data then return end
    if data.siteId then
        ContractData = data
        -- Reset O2 when new contract starts (o2Duration comes from server session)
        if data.o2Duration and data.o2Duration > 0 then
            resetO2(data.o2Duration)
        end
        if data.stage == 'return_to_terry' then
            TerryHandoffReady = true
            SetNewWaypoint(TERRY_COORDS.x, TERRY_COORDS.y)
            exports.sunset_ui:Notify('~b~All salvage recovered! Return to Terry at the waterfront.', 'info', 8000)
        else
            TerryHandoffReady = false
        end
    elseif data.stage == 'idle' or not data.contractId then
        ContractData = nil
        SalvageMarkers = {}
        NearestSalvage = nil
        TerryHandoffReady = false
    end
    updateShiftHud()
end)

-- ── Scuba System ──────────────────────────────────────────────
-- O2 is set once at gear rental/contract start (server-authoritative).
-- activateScuba only enables the dive mode; it does NOT reset O2 (persists across surface/dive cycles).
local function activateScuba()
    if ScubaActive then return end
    ScubaActive = true
    SetPedDiesInWater(PlayerPedId(), false)
    exports.sunset_core:ShowNotification('~b~Scuba gear active. O2: ' .. math.max(0, O2Remaining) .. 's')
end

-- Called when gear is rented or a new contract starts — this is the only place O2 resets to full.
-- [SECTION 26] Body assigned here; the variable was forward-declared above so the stateChanged
-- handler closure can capture the correct upvalue slot.
resetO2 = function(maxDuration)
    O2Max = maxDuration or 120
    O2Remaining = O2Max
end

local function deactivateScuba(reason)
    if not ScubaActive then return end
    ScubaActive = false
    SetPedDiesInWater(PlayerPedId(), true)
    if reason == 'depleted' then
        -- [SECTION 42] Surfacing does NOT refill O2. Player must return to Terry.
        exports.sunset_core:ShowNotification('~r~O2 depleted! Surface and return to Terry for a new tank.')
    elseif reason == 'surfaced' then
        exports.sunset_core:ShowNotification('~b~Scuba gear deactivated — surfaced')
    end
    -- [SECTIONS 27-28] Persist O2 remaining to server on every surface event so
    -- reconnects restore the correct (partially-used) value instead of resetting to max.
    if ShiftActive then
        TriggerServerEvent('sunset:diving:reportO2', O2Remaining)
    end
end

-- ── O2 + Scuba Thread ────────────────────────────────────────
-- Gear presence is determined by O2Max > 0 (set at rental/contract start — server-authoritative).
-- O2 persists across surface/dive cycles; it only resets at gear rental.
local _o2ReportTimer = 0
CreateThread(function()
    while true do
        Wait(1000)
        if not ShiftActive then goto continue end

        local ped = PlayerPedId()
        local underwater = IsPedSwimmingUnderWater(ped)

        -- Gear check: use session-authoritative O2Max rather than inventory sniffing
        local hasGear = O2Max > 0

        if underwater and hasGear and ContractData then
            if not ScubaActive then
                activateScuba()
            else
                O2Remaining = O2Remaining - 1
                if O2Remaining <= 0 then
                    deactivateScuba('depleted')
                    -- Damage player for remaining underwater without O2
                    ApplyDamageToPed(ped, 10, false)
                end
                -- [SECTIONS 27-28] Periodic O2 report while diving so server stays current.
                -- Every 15s while submerged — avoids chat spam on every second.
                _o2ReportTimer = (_o2ReportTimer or 0) + 1
                if _o2ReportTimer >= 15 then
                    _o2ReportTimer = 0
                    TriggerServerEvent('sunset:diving:reportO2', O2Remaining)
                end
            end
        elseif not underwater and ScubaActive then
            deactivateScuba('surfaced')
            -- O2Remaining intentionally NOT reset here — persists across surface/dive cycles
            _o2ReportTimer = 0
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
                local result, err = Sunset.AwaitCallback('sunset:jobs:diver:salvage', nearest.idx)
                if not result then
                    exports.sunset_ui:Notify(('~r~%s'):format(err or 'Salvage failed'), 'error', 4000)
                else
                    nearest.claimed = true
                    if ContractData then
                        ContractData.recovered = result.recovered
                        updateShiftHud()
                    end
                    exports.sunset_ui:Notify(
                        ('~g~Salvaged: ~y~%s~s~ (~b~%s~s~, $%d)'):format(
                            result.item or '?', result.condition or '?', result.value or 0),
                        'success', 4000)
                    -- result.completed means all salvage recovered; server will send returnToTerry event
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

-- Gear rented — reset O2 to full for the new tank (the only place O2 resets to full)
AddEventHandler('sunset:diving:gearRented', function(o2Duration)
    resetO2(o2Duration or 120)
end)

-- Contract started event (from workplaces sub-menu handler)
AddEventHandler('sunset:diving:contractStarted', function(result)
    if not result then return end
    ContractData = result
    buildSalvageMarkers(result.lootPoints)
    -- Reset O2 when a new contract starts (server-authoritative duration)
    if result.o2Duration and result.o2Duration > 0 then
        resetO2(result.o2Duration)
    end
    updateShiftHud()
end)

-- Server signals all salvage is recovered — show GPS back to Terry
RegisterNetEvent('sunset:diving:returnToTerry', function()
    TerryHandoffReady = true
    SetNewWaypoint(TERRY_COORDS.x, TERRY_COORDS.y)
    exports.sunset_ui:Notify('~b~All salvage recovered! Return to Terry at the Vespucci waterfront.', 'info', 8000)
end)

-- Terry handoff proximity thread
CreateThread(function()
    while true do
        Wait(500)
        if not ShiftActive or not TerryHandoffReady then goto continue_handoff end

        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)
        local d = #(vector3(pos.x, pos.y, pos.z) - vector3(TERRY_COORDS.x, TERRY_COORDS.y, TERRY_COORDS.z))

        if d <= 10.0 then
            DisplayHelpTextThisFrame('Press ~INPUT_CONTEXT~ to hand off salvage to Terry')
            if IsControlJustPressed(0, 38) then -- E
                TerryHandoffReady = false
                CreateThread(function()
                    local result, err = Sunset.AwaitCallback('sunset:jobs:diver:handoff')
                    if not result then
                        exports.sunset_ui:Notify(('~r~%s'):format(err or 'Handoff failed'), 'error', 5000)
                        TerryHandoffReady = true  -- re-enable if failed
                    else
                        exports.sunset_ui:Notify(
                            ('~g~Contract complete! Terry paid ~y~$%d~s~ + ~b~%d XP~s~'):format(
                                result.total or 0, result.xp or 0),
                            'success', 7000)
                    end
                end)
            end
        end

        ::continue_handoff::
    end
end)

-- ── Shift Start/End (canonical session events) ───────────────
AddEventHandler('sunset:jobs:sessionStarted', function(jobId, session)
    if jobId ~= 'diver' then return end
    ShiftActive = true
    -- Restore state from session on reconnect/reload
    if session and session.data then
        local sdata = session.data
        if sdata.gearTier and sdata.o2Max then
            -- [SECTIONS 27-28] Restore O2 from server-persisted value.
            -- sdata.o2Remaining is updated by the server whenever the player surfaces
            -- or the periodic report fires. Using sdata.o2Max here would give a free
            -- full tank on every reconnect, bypassing the tank consumption mechanic.
            O2Max       = sdata.o2Max
            O2Remaining = sdata.o2Remaining or 0
            -- If server has no persisted value yet (first login this shift), start at max.
            if O2Remaining <= 0 and not sdata.o2Remaining then
                O2Remaining = O2Max
            end
        end
        if sdata.siteId and sdata.contractId then
            ContractData = sdata
        end
        if sdata.stage == 'return_to_terry' then
            TerryHandoffReady = true
        end
    end
    updateShiftHud()
end)

AddEventHandler('sunset:jobs:sessionEnded', function(jobId, state, reason)
    if jobId ~= 'diver' then return end
    ShiftActive      = false
    ContractData     = nil
    SalvageMarkers   = {}
    NearestSalvage   = nil
    TerryHandoffReady = false
    O2Max            = 0
    O2Remaining      = 0
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
