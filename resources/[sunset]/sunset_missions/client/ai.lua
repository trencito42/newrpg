-- AI controller — pursuit + guard states
local pursuitActive  = false
local pursuitVehicles = {}
local guardPeds      = {}
local alertLevel     = 0
local onAlertChange  = nil

-- ── Pursuit (Hot Wheels) ──────────────────────────────────────────────────────
function MSN_StartPursuit(def, variant)
    if pursuitActive then return end
    pursuitActive = true
    pursuitVehicles = {}
    local Cfg = SunsetMissions.Config
    local player = PlayerPedId()

    for i = 1, (def.pursuitCount or 1) do
        local angle = math.random() * 2 * math.pi
        local r     = Cfg.pursuitSpawnMinDist + math.random(0, 60)
        local ox    = r * math.cos(angle)
        local oy    = r * math.sin(angle)
        local pPos  = GetEntityCoords(player)
        local sx, sy, sz = pPos.x + ox, pPos.y + oy, pPos.z
        local _, gz = GetGroundZFor_3dCoord(sx, sy, sz + 50.0, false)
        if gz == 0.0 then gz = sz end

        local veh = MSN_SpawnVehicle(def.pursuitVehicle, { x = sx, y = sy, z = gz, w = math.random(0, 359) })
        if veh then
            -- spawn 3 peds inside
            local pedDefs = def.pursuitPeds or {}
            for seat = -1, math.min(1, #pedDefs - 1) do
                local pidx   = seat + 2
                local pModel = (pedDefs[pidx] or pedDefs[1]).model
                local pHash  = GetHashKey(pModel)
                RequestModel(pHash)
                local t = 0
                while not HasModelLoaded(pHash) do Wait(50) t=t+50 if t>5000 then break end end
                local ped = CreatePedInsideVehicle(veh, 4, pHash, seat, false, false)
                if ped ~= 0 then
                    SetEntityAsMissionEntity(ped, true, true)
                    TaskVehicleChase(ped, player)
                    SetTaskVehicleChaseBehaviorFlag(ped, 0, true)
                    SetTaskVehicleChaseBehaviorFlag(ped, 1, true)
                    if seat ~= -1 then
                        SetPedInVehicleContext(ped, veh)
                        TaskVehicleShootAtPed(ped, player, 5.0)
                    end
                end
                SetModelAsNoLongerNeeded(pHash)
            end
            pursuitVehicles[#pursuitVehicles+1] = veh
        end
    end

    -- monitor loop
    CreateThread(function()
        local Cfg2 = SunsetMissions.Config
        while pursuitActive do
            Wait(1000)
            local pos    = GetEntityCoords(PlayerPedId())
            local active = false
            for _, pv in ipairs(pursuitVehicles) do
                if DoesEntityExist(pv) then
                    local pvPos = GetEntityCoords(pv)
                    local dist  = #(pos - pvPos)
                    if dist > Cfg2.pursuitDespawnDist then
                        MSN_DeleteEntity(pv)
                    else
                        active = true
                    end
                end
            end
            if not active then
                pursuitActive = false
                TriggerEvent('sunset:missions:client:pursuitLost')
            end
        end
    end)
end

function MSN_StopPursuit()
    pursuitActive = false
    for _, pv in ipairs(pursuitVehicles) do
        MSN_DeleteEntity(pv)
    end
    pursuitVehicles = {}
end

-- ── Guard system (Container 47) ───────────────────────────────────────────────
function MSN_SpawnGuards(guardDefs, onAlert)
    guardPeds   = {}
    alertLevel  = 0
    onAlertChange = onAlert

    for _, gd in ipairs(guardDefs) do
        local ped = MSN_SpawnPed(gd.model, gd.coords, gd.scenario, false)
        if ped then
            guardPeds[#guardPeds+1] = { ped = ped, state = 'PATROL', baseCoords = gd.coords }
        end
    end

    -- sight check loop
    CreateThread(function()
        while #guardPeds > 0 do
            Wait(500)
            local player = PlayerPedId()
            for _, g in ipairs(guardPeds) do
                if DoesEntityExist(g.ped) then
                    if HasEntitySpottedEntity(g.ped, player, false) then
                        MSN_RaiseAlert(1, true)
                    end
                end
            end
        end
    end)
end

function MSN_RaiseAlert(amount, immediate)
    if not onAlertChange then return end
    local prev = alertLevel
    alertLevel = math.min(4, alertLevel + (amount or 1))
    if alertLevel ~= prev then
        onAlertChange(alertLevel)
        if alertLevel >= 3 then
            for _, g in ipairs(guardPeds) do
                if DoesEntityExist(g.ped) then
                    TaskCombatPed(g.ped, PlayerPedId(), 0, 16)
                    g.state = 'COMBAT'
                end
            end
        elseif alertLevel >= 1 then
            for _, g in ipairs(guardPeds) do
                if DoesEntityExist(g.ped) and g.state == 'PATROL' then
                    local player = PlayerPedId()
                    local pos    = GetEntityCoords(player)
                    TaskGoToCoordAnyMeans(g.ped, pos.x, pos.y, pos.z, 1.0, 0, false, 786603, 0.0)
                    g.state = 'INVESTIGATE'
                end
            end
        end
        TriggerEvent('sunset:missions:client:alertChanged', alertLevel)
    end
end

function MSN_GetAlertLevel()
    return alertLevel
end

function MSN_CleanupGuards()
    for _, g in ipairs(guardPeds) do
        MSN_DeleteEntity(g.ped)
    end
    guardPeds    = {}
    alertLevel   = 0
    onAlertChange = nil
end
