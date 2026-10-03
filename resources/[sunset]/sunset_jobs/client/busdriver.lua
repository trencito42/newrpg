-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Bus Driver Client Controller (client/busdriver.lua)
--  Green Route Scheduled Transit with Passenger Boarding & Fares.
-- ═══════════════════════════════════════════════════════════════

Sunset = Sunset or {}
Sunset.Jobs = Sunset.Jobs or {}

local JC = Sunset.JobClient

local currentBusCheckpoint = nil
local waitingPassengers = {}
local busPassengers = {}
local isBoardingActive = false

local PASSENGER_MODELS = {
    'a_m_y_business_01', 'a_f_y_business_01', 'a_m_m_bevhills_01', 'a_f_m_downtown_01',
    'a_m_y_genstreet_01', 'a_f_y_genhot_01', 'a_m_y_hipster_01', 'a_f_y_tourist_01',
    'a_m_y_skater_01', 'a_f_y_smartcaspat_01', 'a_m_m_socenlat_01', 'a_f_y_tennis_01',
}

local function clearBusCheckpoint()
    if currentBusCheckpoint then
        DeleteCheckpoint(currentBusCheckpoint)
        currentBusCheckpoint = nil
    end
end

local function setBusCheckpoint(coords, r, g, b)
    clearBusCheckpoint()
    if not coords then return end
    local pos = vector3(coords.x, coords.y, coords.z)
    r, g, b = r or 46, g or 204, b or 113
    currentBusCheckpoint = CreateCheckpoint(47, pos.x, pos.y, pos.z, pos.x, pos.y, pos.z, 7.5, r, g, b, 180, 0)
    SetCheckpointCylinderHeight(currentBusCheckpoint, 4.0, 4.0, 6.0)
end

local function cleanupWaitingPassengers()
    for _, ped in ipairs(waitingPassengers) do
        if DoesEntityExist(ped) then
            SetEntityAsMissionEntity(ped, false, true)
            DeleteEntity(ped)
        end
    end
    waitingPassengers = {}
end

local function cleanupBusPassengers()
    for _, ped in ipairs(busPassengers) do
        if DoesEntityExist(ped) then
            SetEntityAsMissionEntity(ped, false, true)
            DeleteEntity(ped)
        end
    end
    busPassengers = {}
end

local function spawnWaitingPassengers(stop)
    cleanupWaitingPassengers()
    if not stop then return end

    local passengerCoordsList = stop.passengerCoords
    local stopCoords = stop.coords or stop

    if passengerCoordsList and #passengerCoordsList > 0 then
        for _, pCoord in ipairs(passengerCoordsList) do
            local modelName = PASSENGER_MODELS[math.random(#PASSENGER_MODELS)]
            local ok, model = Sunset.RequestModelSafe(modelName, 3000)
            if ok then
                local pZ = pCoord.z
                local heading = pCoord.w or (pCoord.heading or 0.0)
                local ped = CreatePed(4, model, pCoord.x, pCoord.y, pZ - 1.0, heading, false, true)
                if ped and ped ~= 0 and DoesEntityExist(ped) then
                    SetEntityAsMissionEntity(ped, true, true)
                    FreezeEntityPosition(ped, true)
                    SetEntityInvincible(ped, true)
                    SetBlockingOfNonTemporaryEvents(ped, true)
                    
                    local scenarios = { 'WORLD_HUMAN_STAND_MOBILE', 'WORLD_HUMAN_WAITING_IMPATIENT', 'WORLD_HUMAN_SMOKING', 'WORLD_HUMAN_HANG_OUT_STREET' }
                    TaskStartScenarioInPlace(ped, scenarios[math.random(#scenarios)], 0, true)
                    table.insert(waitingPassengers, ped)
                end
                SetModelAsNoLongerNeeded(model)
            end
        end
    else
        local count = math.random(1, 3)
        local baseHeading = stopCoords.w or 0.0

        for i = 1, count do
            local modelName = PASSENGER_MODELS[math.random(#PASSENGER_MODELS)]
            local ok, model = Sunset.RequestModelSafe(modelName, 3000)
            if ok then
                -- Offset onto the right sidewalk
                local angle = math.rad(baseHeading + 90.0)
                local offsetX = math.cos(angle) * (2.8 + (i * 0.8))
                local offsetY = math.sin(angle) * (2.8 + (i * 0.8))

                local pX = stopCoords.x + offsetX
                local pY = stopCoords.y + offsetY
                local pZ = stopCoords.z

                local ped = CreatePed(4, model, pX, pY, pZ - 1.0, (baseHeading + 180.0) % 360.0, false, true)
                if ped and ped ~= 0 and DoesEntityExist(ped) then
                    SetEntityAsMissionEntity(ped, true, true)
                    FreezeEntityPosition(ped, true)
                    SetEntityInvincible(ped, true)
                    SetBlockingOfNonTemporaryEvents(ped, true)
                    
                    local scenarios = { 'WORLD_HUMAN_STAND_MOBILE', 'WORLD_HUMAN_WAITING_IMPATIENT', 'WORLD_HUMAN_SMOKING' }
                    TaskStartScenarioInPlace(ped, scenarios[math.random(#scenarios)], 0, true)
                    table.insert(waitingPassengers, ped)
                end
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end

local function getFreeSpawnBay(spawns)
    if not spawns or #spawns == 0 then return nil end
    for _, bay in ipairs(spawns) do
        local bayPos = vector3(bay.x, bay.y, bay.z)
        if not IsPositionOccupied(bayPos.x, bayPos.y, bayPos.z, 3.5, false, true, true, false, false, 0, false) then
            return bay
        end
    end
    -- Fallback to first bay
    return spawns[1]
end

local function updateBusHud(session, totalStops, currentStop, isReturn)
    if not session then return end
    local stopIdx = math.min(currentStop or 1, totalStops or 6)

    if isReturn then
        JC.hud({
            title = 'LS Transit — ' .. (session.label or 'Linia Verde'),
            objective = 'Traseu completat! Returnează autobuzul la depou.',
            progress = { current = totalStops, total = totalStops },
            earnings = session.totalEarned or 0,
            keyHints = {
                { key = 'E', label = 'Parcare & Finalizare Tură' },
            },
        })
    else
        JC.hud({
            title = 'LS Transit — ' .. (session.label or 'Linia Verde'),
            objective = ('Condu către stația %d/%d'):format(stopIdx, totalStops),
            progress = { current = stopIdx - 1, total = totalStops },
            earnings = session.totalEarned or 0,
            keyHints = {
                { key = 'E', label = 'Îmbarcare Pasageri' },
            },
        })
    end
end

function Sunset.Jobs.StartBusDriver()
    local cfg = Sunset.GetJobConfig('busdriver')
    if not cfg then
        JC.notify('Configurația jobului de șofer de autobuz lipsește.', 'error')
        return
    end

    local data, err = Sunset.AwaitCallback('sunset:jobs:busdriver:start')
    if not data then
        JC.notify(err or 'Nu s-a putut începe tura de șofer de autobuz.', 'error')
        return
    end

    JC.deleteVehicles()
    JC.clearBlips()
    cleanupWaitingPassengers()
    cleanupBusPassengers()

    -- 1. Spawn Bus at open bay
    local spawnBay = getFreeSpawnBay(cfg.depot.spawns) or cfg.depot.spawns[1]
    local busModel = cfg.busModel or 'bus'
    local bus = JC.spawnVehicle(busModel, spawnBay, true)
    if not bus then
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        JC.notify('Nu s-a putut spawna autobuzul de serviciu.', 'error')
        return
    end

    local ok, regErr = JC.registerVehiclesWithServer()
    if not ok then
        JC.deleteVehicles()
        Sunset.AwaitCallback('sunset:jobs:cancelWork')
        JC.notify(regErr or 'Eroare la înregistrarea autobuzului de serviciu.', 'error')
        return
    end

    JC.monitorVehicles()

    -- Add Depot Blip
    JC.addBlip(cfg.depot.coords, cfg.depot.blip, 'Autobaza LS Transit')

    local stops = data.stops or {}
    local totalStops = #stops
    local currentStopIdx = 1

    -- Setup first stop
    local firstStop = stops[1]
    local stopV3 = vector3(firstStop.coords.x, firstStop.coords.y, firstStop.coords.z)
    JC.addBlip(stopV3, { sprite = 513, color = 46, scale = 0.85 }, firstStop.label or 'Oprirea 1')
    JC.setWaypoint(stopV3)
    setBusCheckpoint(stopV3, 46, 204, 113)
    spawnWaitingPassengers(firstStop)

    JC.sessionData = {
        label = data.label or 'Linia Verde',
        totalEarned = 0,
        passengers = 0,
    }
    updateBusHud(JC.sessionData, totalStops, currentStopIdx, false)

    JC.notify('Tura a început! Urmează traseul Liniei Verzi și oprește în fiecare stație.', 'info', 6000)

    -- ── Active Shift Loop ─────────────────────────────────────────
    CreateThread(function()
        local isReturnStage = false

        while JC.jobId == 'busdriver' and JC.state ~= 'IDLE' do
            local sleep = 250
            local ped = PlayerPedId()
            local inBus = IsPedInVehicle(ped, bus, false) and GetPedInVehicleSeat(bus, -1) == ped

            if inBus and not isBoardingActive then
                local busCoords = GetEntityCoords(bus)

                if not isReturnStage then
                    local curStop = stops[currentStopIdx]
                    if curStop then
                        local targetV3 = vector3(curStop.coords.x, curStop.coords.y, curStop.coords.z)
                        local dist = #(busCoords - targetV3)
                        local speed = GetEntitySpeed(bus)

                        if dist < 45.0 then
                            sleep = 0
                            JC.hudDistance(targetV3)
                        end

                        if dist <= (cfg.stopRadius or 7.5) then
                            -- Draw stop marker
                            DrawMarker(1, targetV3.x, targetV3.y, targetV3.z - 1.0,
                                0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                                8.0, 8.0, 1.2,
                                46, 204, 113, 80,
                                false, false, 2, false, nil, nil, false)

                            if speed < 2.0 then
                                -- Prompt to board passengers
                                BeginTextCommandDisplayHelp("THREESTRINGS")
                                AddTextComponentSubstringPlayerName("Apasă ~INPUT_CONTEXT~ pentru ")
                                AddTextComponentSubstringPlayerName("~g~Îmbarcare Pasageri & Bilete~s~")
                                EndTextCommandDisplayHelp(0, false, false, -1)

                                if IsControlJustPressed(0, 38) then
                                    isBoardingActive = true
                                    
                                    -- Protect driver against being dragged out
                                    SetPedCanBeDraggedOut(ped, false)
                                    SetPedStayInVehicleWhenJacked(ped, true)
                                    
                                    -- Open bus doors
                                    SetVehicleDoorOpen(bus, 0, false, false)
                                    SetVehicleDoorOpen(bus, 1, false, false)
                                    PlaySoundFrontend(-1, "Bus_Bell", "GTAO_Script_Sounds_Soundset", false)

                                    local isFinalStop = (currentStopIdx >= totalStops)
                                    local alightingCount = 0
                                    local boardingCount = #waitingPassengers

                                    -- 1. Pasageri care coboară din autobuz (Alighting)
                                    if #busPassengers > 0 then
                                        local toAlight = isFinalStop and #busPassengers or math.min(#busPassengers, math.random(1, 2))
                                        for _ = 1, toAlight do
                                            local p = table.remove(busPassengers, 1)
                                            if p and DoesEntityExist(p) then
                                                alightingCount = alightingCount + 1
                                                TaskLeaveVehicle(p, bus, 0)
                                                CreateThread(function()
                                                    Wait(1400)
                                                    if DoesEntityExist(p) then
                                                        TaskWanderStandard(p, 10.0, 10)
                                                        SetPedAsNoLongerNeeded(p)
                                                        Wait(9000)
                                                        if DoesEntityExist(p) and not IsPedInVehicle(p, bus, false) then
                                                            DeleteEntity(p)
                                                        end
                                                    end
                                                end)
                                            end
                                        end
                                    end

                                    -- 2. Pasageri noi care urcă în autobuz (Boarding - doar dacă nu e capăt de linie)
                                    if not isFinalStop then
                                        local maxSeats = math.max(1, GetVehicleMaxNumberOfPassengers(bus))
                                        local seatAssignment = 0

                                        for _, p in ipairs(waitingPassengers) do
                                            if DoesEntityExist(p) then
                                                ClearPedTasksImmediately(p)
                                                FreezeEntityPosition(p, false)
                                                SetEntityInvincible(p, true)
                                                SetBlockingOfNonTemporaryEvents(p, false)

                                                while seatAssignment < maxSeats and not IsVehicleSeatFree(bus, seatAssignment) do
                                                    seatAssignment = seatAssignment + 1
                                                end
                                                local targetSeat = (seatAssignment < maxSeats) and seatAssignment or 0
                                                seatAssignment = seatAssignment + 1

                                                TaskEnterVehicle(p, bus, 8000, targetSeat, 1.8, 1, 0)
                                            end
                                        end
                                    else
                                        cleanupWaitingPassengers()
                                        boardingCount = 0
                                    end

                                    local notifyMsg
                                    if isFinalStop then
                                        notifyMsg = ('Capăt de linie! Au coborât toți cei %d pasageri.'):format(alightingCount)
                                    elseif alightingCount > 0 and boardingCount > 0 then
                                        notifyMsg = ('Flux călători: %d au coborât, %d urcă în autobuz...'):format(alightingCount, boardingCount)
                                    elseif alightingCount > 0 then
                                        notifyMsg = ('Au coborât %d pasageri în stație...'):format(alightingCount)
                                    else
                                        notifyMsg = ('Îmbarcare: urcă %d pasageri noi...'):format(boardingCount)
                                    end
                                    exports.sunset_ui:Notify(notifyMsg, 'info', 3000)

                                    local waitDuration = cfg.boardingDurationMs or 3500
                                    Wait(waitDuration)

                                    -- 3. Așezare în scaune a celor care au urcat
                                    if not isFinalStop then
                                        local maxSeats = GetVehicleMaxNumberOfPassengers(bus)
                                        for _, p in ipairs(waitingPassengers) do
                                            if DoesEntityExist(p) then
                                                if not IsPedInVehicle(p, bus, false) then
                                                    for seat = 0, maxSeats - 1 do
                                                        if IsVehicleSeatFree(bus, seat) then
                                                            TaskWarpPedIntoVehicle(p, bus, seat)
                                                            break
                                                        end
                                                    end
                                                end
                                                table.insert(busPassengers, p)
                                            end
                                        end
                                    else
                                        cleanupBusPassengers()
                                    end
                                    waitingPassengers = {}

                                    -- Close doors
                                    SetVehicleDoorShut(bus, 0, false)
                                    SetVehicleDoorShut(bus, 1, false)
                                    PlaySoundFrontend(-1, "Bus_Bell", "GTAO_Script_Sounds_Soundset", false)

                                    -- Server callback
                                    local netId = VehToNet(bus)
                                    local res = Sunset.AwaitCallback('sunset:jobs:busdriver:boardPassengers', netId, currentStopIdx)

                                    if res and res.success then
                                        JC.sessionData.totalEarned = res.totalEarned
                                        JC.sessionData.passengers = res.passengersTotal

                                        exports.sunset_ui:Notify(('Ai îmbarcat %d pasageri! +$%d încasări bilete.'):format(res.passengers, res.earned), 'success', 5000)

                                        if res.isLastStop then
                                            isReturnStage = true
                                            cleanupWaitingPassengers()
                                            clearBusCheckpoint()
                                            JC.clearBlips()

                                            local returnV3 = vector3(cfg.depot.returnCoords.x, cfg.depot.returnCoords.y, cfg.depot.returnCoords.z)
                                            JC.addBlip(returnV3, { sprite = 513, color = 46, scale = 0.9 }, 'Depou — Returnare Autobuz')
                                            JC.setWaypoint(returnV3)
                                            setBusCheckpoint(returnV3, 215, 181, 88)

                                            updateBusHud(JC.sessionData, totalStops, totalStops, true)
                                            JC.notify('Traseul a fost finalizat cu succes! Condu autobuzul înapoi la depou pentru bonus.', 'success', 7000)
                                        else
                                            currentStopIdx = res.nextStopIndex
                                            local nextStop = stops[currentStopIdx]
                                            local nextV3 = vector3(nextStop.coords.x, nextStop.coords.y, nextStop.coords.z)
                                            
                                            JC.clearBlips()
                                            JC.addBlip(cfg.depot.coords, cfg.depot.blip, 'Autobaza LS Transit')
                                            JC.addBlip(nextV3, { sprite = 513, color = 46, scale = 0.85 }, nextStop.label or ('Oprirea ' .. currentStopIdx))
                                            JC.setWaypoint(nextV3)
                                            setBusCheckpoint(nextV3, 46, 204, 113)
                                            spawnWaitingPassengers(nextStop)

                                            updateBusHud(JC.sessionData, totalStops, currentStopIdx, false)
                                        end
                                    else
                                        JC.notify(res and res.err or 'Eroare la înregistrarea stației.', 'error')
                                    end

                                    isBoardingActive = false
                                end
                            else
                                -- Remind player to stop bus completely
                                BeginTextCommandDisplayHelp("STRING")
                                AddTextComponentSubstringPlayerName("~y~Oprește complet autobuzul în stație!~s~")
                                EndTextCommandDisplayHelp(0, false, false, -1)
                            end
                        end
                    end
                else
                    -- Return to Depot Stage
                    local returnV3 = vector3(cfg.depot.returnCoords.x, cfg.depot.returnCoords.y, cfg.depot.returnCoords.z)
                    local dist = #(busCoords - returnV3)
                    local speed = GetEntitySpeed(bus)

                    if dist < 45.0 then
                        sleep = 0
                        JC.hudDistance(returnV3)
                    end

                    if dist <= 12.0 then
                        DrawMarker(1, returnV3.x, returnV3.y, returnV3.z - 1.0,
                            0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                            9.0, 9.0, 1.2,
                            215, 181, 88, 90,
                            false, false, 2, false, nil, nil, false)

                        if speed < 2.0 then
                            BeginTextCommandDisplayHelp("THREESTRINGS")
                            AddTextComponentSubstringPlayerName("Apasă ~INPUT_CONTEXT~ pentru ")
                            AddTextComponentSubstringPlayerName("~y~Parcare & Finalizare Traseu~s~")
                            EndTextCommandDisplayHelp(0, false, false, -1)

                            if IsControlJustPressed(0, 38) then
                                local netId = VehToNet(bus)
                                local finRes = Sunset.AwaitCallback('sunset:jobs:busdriver:finishRoute', netId)
                                
                                clearBusCheckpoint()
                                cleanupWaitingPassengers()
                                cleanupBusPassengers()
                                JC.deleteVehicles()
                                JC.cleanup()
                                JC.hudClear(true)

                                if finRes and finRes.success then
                                    exports.sunset_ui:Notify(('Felicitări! Ai finalizat tura pe Linia Verde.\nBonus traseu: +$%d\nTotal câștigat: $%d (%d pasageri transportați)'):format(
                                        finRes.bonus, finRes.grandTotal, finRes.passengersTotal
                                    ), 'success', 9000)
                                else
                                    JC.notify(finRes and finRes.err or 'Eroare la finalizarea cursei.', 'error')
                                end
                                break
                            end
                        end
                    end
                end
            end

            Wait(sleep)
        end

        clearBusCheckpoint()
        cleanupWaitingPassengers()
        cleanupBusPassengers()
    end)
end
