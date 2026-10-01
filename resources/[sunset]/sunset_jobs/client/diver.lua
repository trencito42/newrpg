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
local SiteBlip       = nil   -- map blip for the active dive site

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
    local title = exports.sunset_core:Translate('jobs.hud.diver.title')
    if ContractData and ContractData.siteId then
        local rec = ContractData.recovered or 0
        local req = math.max(ContractData.required or 1, 1)
        -- [SECTION 42] Surfacing does NOT refill O2 — O2 is tied to the tank and only
        -- resets when a new tank is rented from Terry.
        local depleted = O2Remaining <= 0
        exports.sunset_ui:JobHud({
            title      = title,
            objective  = exports.sunset_core:Translate(depleted and 'jobs.hud.diver.o2_out' or 'jobs.hud.diver.salvage'),
            tone       = depleted and 'danger' or (O2Remaining <= 30 and 'warn' or 'info'),
            progress   = { current = rec, total = req },
            timer      = { seconds = math.max(O2Remaining, 0) },
            timerLabel = exports.sunset_core:Translate('jobs.hud.diver.o2'),
            keyHints   = (not depleted) and { { key = 'E', label = exports.sunset_core:Translate('jobs.hud.act.salvage') } } or nil,
        })
    else
        exports.sunset_ui:JobHud({
            title     = title,
            objective = exports.sunset_core:Translate('jobs.hud.diver.no_contract'),
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
        -- [JOBS AUDIT] this ran on EVERY stateChanged that carries o2Duration (each salvage + handoff),
        -- refilling the tank for free. Only seed O2 when no tank is tracked yet.
        if data.o2Duration and data.o2Duration > 0 and O2Max <= 0 then
            resetO2(data.o2Duration)
        end
        if data.stage == 'return_to_terry' then
            TerryHandoffReady = true
            SetNewWaypoint(TERRY_COORDS.x, TERRY_COORDS.y)
            exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.all_salvage_recovered_return_to_terry_at_the_waterfront'), 'info', 8000)
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
    exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.b_scuba_gear_active_o2_s', { value = tostring(math.max(0, O2Remaining)) }))
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
        exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.r_o2_depleted_surface_and_return'))
    elseif reason == 'surfaced' then
        exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.b_scuba_gear_deactivated_surfaced'))
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
-- Refreshes the JobHud card every second while diving (O2 countdown in message)
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

-- ── Site Navigation Blip (Section 36) ────────────────────────
-- Shows a blip at the dive entry/search-zone centroid so the player can
-- navigate to the site. No exact salvage positions are shown — the sonar
-- detector is the in-world mechanic for locating individual points.
local function clearSiteBlip()
    if SiteBlip and DoesBlipExist(SiteBlip) then RemoveBlip(SiteBlip) end
    SiteBlip = nil
end

local function setSiteBlip(result)
    clearSiteBlip()
    if not result then return end

    -- Prefer diveEntry (exact water entry point) over search zone centroid
    local bx, by, bz = nil, nil, 0
    if result.diveEntry then
        bx = result.diveEntry.x
        by = result.diveEntry.y
        bz = result.diveEntry.z or 0
    elseif result.searchZone and result.searchZone.polygon and #result.searchZone.polygon >= 1 then
        -- Compute centroid of search zone polygon
        local cx, cy = 0, 0
        local pts = result.searchZone.polygon
        for _, p in ipairs(pts) do cx = cx + p.x; cy = cy + p.y end
        bx = cx / #pts
        by = cy / #pts
        bz = result.searchZone.minZ or 0
    end

    if not bx then return end

    SiteBlip = AddBlipForCoord(bx, by, bz)
    SetBlipSprite(SiteBlip, 442)    -- anchor/dive icon
    SetBlipColour(SiteBlip, 3)      -- blue
    SetBlipScale(SiteBlip, 0.9)
    SetBlipAsShortRange(SiteBlip, false)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('jobs.msg.dive_site', { site_id = tostring(result.siteId or '?') }))
    EndTextCommandSetBlipName(SiteBlip)

    -- Set GPS waypoint to dive entry (not exact salvage — sonar handles that)
    SetNewWaypoint(bx, by)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.dive_site_marked_on_map_use_sonar_to_locate'), 'info', 6000)
end

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
            DisplayHelpTextThisFrame(exports.sunset_core:Translate('hint.native.recover_salvage'))

            if IsControlJustPressed(0, 38) then -- E
                -- [SECTION 33-34] Phase 1: request hold token from server
                local beginResult, beginErr = Sunset.AwaitCallback('sunset:jobs:diver:beginSalvage', nearest.idx)
                if not beginResult then
                    exports.sunset_ui:Notify(beginErr or exports.sunset_core:Translate('jobs.msg.cannot_begin_salvage'), 'error', 4000)
                else
                    -- Phase 2: show 4-second progress bar; cancel if player moves away
                    local token       = beginResult.token
                    local holdSec     = beginResult.minDuration or 4
                    local holdMs      = holdSec * 1000
                    local startTime   = GetGameTimer()
                    local cancelled   = false
                    local startPos    = GetEntityCoords(PlayerPedId())

                    exports.sunset_ui:Send('progressBar', {
                        label    = exports.sunset_core:Translate('jobs.ui.recovering_salvage'),
                        duration = holdMs,
                    })

                    -- Wait for hold duration; cancel if player moves >1.5m
                    while GetGameTimer() - startTime < holdMs do
                        Wait(100)
                        local curPos = GetEntityCoords(PlayerPedId())
                        local moved  = #(curPos - startPos)
                        if moved > 1.5 then
                            cancelled = true
                            break
                        end
                    end

                    exports.sunset_ui:Send('cancelProgressBar', {})

                    if cancelled then
                        exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.salvage_cancelled_you_moved_away'), 'error', 3000)
                    else
                        -- Phase 2: complete salvage
                        local result, err = Sunset.AwaitCallback(
                            'sunset:jobs:diver:completeSalvage', nearest.idx, token)
                        if not result then
                            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('jobs.msg.salvage_failed'), 'error', 4000)
                        else
                            nearest.claimed = true
                            if ContractData then
                                ContractData.recovered = result.recovered
                                updateShiftHud()
                            end
                            exports.sunset_ui:Notify(
                                exports.sunset_core:Translate('jobs.msg.salvaged', { item = tostring(result.item or '?'), condition = tostring(result.condition or '?'), value = math.floor(tonumber(result.value or 0) or 0) }),
                                'success', 4000)
                            -- result.completed → server sends returnToTerry event
                        end
                    end
                end
            end
        end

        ::continue::
    end
end)

-- ── Boat Management ───────────────────────────────────────────
-- [SECTION 32] Server asks client to spawn the boat; client echoes back token+netId
-- so the server can validate the spawn before registering it.
RegisterNetEvent('sunset:diving:spawnBoat', function(model, spawnCoords, cost, serverToken)
    local ok, hash = Sunset.RequestModelSafe(model, 5000)
    if not ok or not hash then
        exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.r_failed_to_spawn_boat_model'))
        return
    end
    local boat = CreateVehicle(hash,
        spawnCoords.x, spawnCoords.y, spawnCoords.z,
        spawnCoords.h or 0.0, true, false)
    if not DoesEntityExist(boat) then
        exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.r_failed_to_spawn_boat_try'))
        return
    end
    SetEntityAsMissionEntity(boat, true, true)
    SetModelAsNoLongerNeeded(hash)
    BoatNetId = VehicleToNet(boat)
    -- Echo the server-issued token back so the server can validate this spawn
    TriggerServerEvent('sunset:diving:boatSpawned', BoatNetId, serverToken)
    exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.g_work_boat_rented_for_y', { cost = math.floor(tonumber(cost) or 0) }))
end)

RegisterNetEvent('sunset:diving:boatReturned', function()
    BoatNetId = nil
    exports.sunset_core:ShowNotification(exports.sunset_core:Translate('jobs.msg.b_work_boat_returned'))
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
    -- [SECTION 36] Clear dive site blip on contract complete
    clearSiteBlip()
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
    -- [JOBS AUDIT] a new contract no longer refills the tank (O2 only resets at gear rental, see
    -- SECTION 42); only seed it when nothing is tracked.
    if result.o2Duration and result.o2Duration > 0 and O2Max <= 0 then
        resetO2(result.o2Duration)
    end
    -- [SECTION 36] Show dive site blip + GPS waypoint
    setSiteBlip(result)
    updateShiftHud()
end)

-- Server signals all salvage is recovered — show GPS back to Terry
RegisterNetEvent('sunset:diving:returnToTerry', function()
    TerryHandoffReady = true
    SetNewWaypoint(TERRY_COORDS.x, TERRY_COORDS.y)
    exports.sunset_ui:Notify(exports.sunset_core:Translate('jobs.message.all_salvage_recovered_return_to_terry_at_the_vespucci'), 'info', 8000)
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
            DisplayHelpTextThisFrame(exports.sunset_core:Translate('hint.native.hand_off_salvage'))
            if IsControlJustPressed(0, 38) then -- E
                TerryHandoffReady = false
                CreateThread(function()
                    local result, err = Sunset.AwaitCallback('sunset:jobs:diver:handoff')
                    if not result then
                        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('jobs.msg.handoff_failed'), 'error', 5000)
                        TerryHandoffReady = true  -- re-enable if failed
                    else
                        exports.sunset_ui:Notify(
                            exports.sunset_core:Translate('jobs.msg.contract_complete_terry_paid_xp', { total = math.floor(tonumber(result.total or 0) or 0), xp = math.floor(tonumber(result.xp or 0) or 0) }),
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
            -- [SECTION 36] Re-establish site blip on reconnect (no lootPoints in session
            -- data so we pass a minimal stub; sonar will handle underwater navigation)
            if sdata.stage ~= 'return_to_terry' then
                setSiteBlip({ siteId = sdata.siteId, searchZone = sdata.searchZone, diveEntry = sdata.diveEntry })
            end
        end
        if sdata.stage == 'return_to_terry' then
            TerryHandoffReady = true
            SetNewWaypoint(TERRY_COORDS.x, TERRY_COORDS.y)
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
    clearSiteBlip()
    deactivateScuba('surfaced')
    exports.sunset_ui:JobHudClear()
    -- Return boat if still rented
    if BoatNetId then
        TriggerServerEvent('sunset:diving:returnBoat')
        -- [JOBS AUDIT] also delete our own spawn locally: if the server never registered it (pending
        -- rental cancelled by death/timeout) nothing else would ever remove the boat.
        if NetworkDoesNetworkIdExist(BoatNetId) then
            local boat = NetToVeh(BoatNetId)
            if boat and boat ~= 0 and DoesEntityExist(boat) then
                SetEntityAsMissionEntity(boat, true, true)
                DeleteEntity(boat)
            end
        end
        BoatNetId = nil
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    SetPedDiesInWater(PlayerPedId(), true)
    clearSiteBlip()
    exports.sunset_ui:JobHudClear(true)
    if BoatNetId and NetworkDoesNetworkIdExist(BoatNetId) then
        local boat = NetToVeh(BoatNetId)
        if boat and boat ~= 0 and DoesEntityExist(boat) then
            SetEntityAsMissionEntity(boat, true, true)
            DeleteEntity(boat)
        end
    end
end)
