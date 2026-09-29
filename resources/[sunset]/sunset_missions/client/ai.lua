local pursuitActive   = false
local pursuitVehicles = {}
local pursuitDefeated = false   -- true when all pursuers despawned/destroyed
local guardPeds       = {}
local alertLevel      = 0
local onAlertChange   = nil

local function loadModel(model)
    local hash = type(model) == 'number' and model or GetHashKey(model)
    if not IsModelValid(hash) then return nil end
    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) do Wait(50) t=t+50 if t>8000 then return nil end end
    return hash
end

local function giveWeapon(ped, weaponName, ammo)
    GiveWeaponToPed(ped, GetHashKey(weaponName), ammo or 120, false, true)
    SetCurrentPedWeapon(ped, GetHashKey(weaponName), true)
end

-- ── Pursuit (Hot Wheels) ──────────────────────────────────────────────────────
function MSN_StartPursuit(def, variant)
    if pursuitActive then return end
    pursuitActive   = true
    pursuitDefeated = false
    pursuitVehicles = {}
    local Cfg    = SunsetMissions.Config
    local player = PlayerPedId()

    for i = 1, (def.pursuitCount or 1) do
        -- Spawn on nearest road node to avoid spawning inside buildings/terrain
        local pPos  = GetEntityCoords(player)
        local angle = math.random() * 2 * math.pi
        local r     = Cfg.pursuitSpawnMinDist + math.random(0, 80)
        local sx, sy = pPos.x + r * math.cos(angle), pPos.y + r * math.sin(angle)
        local found, nx, ny, nz, nh = GetClosestVehicleNodeWithHeading(sx, sy, pPos.z, 0, 3.0, 0)
        if not found then nx, ny, nz, nh = sx, sy, pPos.z, math.random(0, 359) end

        local veh = MSN_SpawnVehicle(def.pursuitVehicle, { x = nx, y = ny, z = nz, w = nh })
        if veh then
            local pedDefs   = def.pursuitPeds or {}
            local seats     = { -1, 0, 1 }
            local weaponSet = { 'WEAPON_PISTOL', 'WEAPON_SMG', 'WEAPON_MICROSMG' }

            for si, seat in ipairs(seats) do
                local pModel = (pedDefs[si] or pedDefs[1] or { model = 'g_m_y_mexgoon_01' }).model
                local pHash  = loadModel(pModel)
                if pHash then
                    local ped = CreatePedInsideVehicle(veh, 4, pHash, seat, false, false)
                    if ped ~= 0 then
                        SetEntityAsMissionEntity(ped, true, true)
                        local wpn = weaponSet[si] or 'WEAPON_PISTOL'
                        giveWeapon(ped, wpn, 200)
                        if seat == -1 then
                            -- driver chases
                            TaskVehicleChase(ped, player)
                            SetTaskVehicleChaseBehaviorFlag(ped, 0, true)
                            SetTaskVehicleChaseBehaviorFlag(ped, 1, true)
                        else
                            -- passengers shoot
                            TaskVehicleShootAtPed(ped, player, 5.0)
                        end
                    end
                    SetModelAsNoLongerNeeded(pHash)
                end
            end
            pursuitVehicles[#pursuitVehicles+1] = veh
        end
    end

    -- Monitor pursuit — track if player escapes
    CreateThread(function()
        local Cfg2 = SunsetMissions.Config
        while pursuitActive do
            Wait(1000)
            local pos    = GetEntityCoords(PlayerPedId())
            local active = false
            for _, pv in ipairs(pursuitVehicles) do
                if DoesEntityExist(pv) and not IsEntityDead(pv) then
                    local dist = #(pos - GetEntityCoords(pv))
                    if dist < Cfg2.pursuitDespawnDist then
                        active = true
                    else
                        MSN_DeleteEntity(pv)
                    end
                end
            end
            if not active then
                pursuitActive   = false
                pursuitDefeated = true
                TriggerEvent('sunset:missions:client:pursuitLost')
            end
        end
    end)
end

-- Returns true when pursuit happened AND player outran/destroyed pursuers
function MSN_PursuitEscaped()
    return pursuitDefeated
end

function MSN_StopPursuit()
    pursuitActive = false
    for _, pv in ipairs(pursuitVehicles) do
        MSN_DeleteEntity(pv)
    end
    pursuitVehicles = {}
    -- not setting pursuitDefeated — caller checks it before calling StopPursuit
end

-- ── Guard system (Container 47) ───────────────────────────────────────────────
function MSN_SpawnGuards(guardDefs, onAlert)
    guardPeds     = {}
    alertLevel    = 0
    onAlertChange = onAlert

    for _, gd in ipairs(guardDefs) do
        local hash = loadModel(gd.model)
        if hash then
            local ped = CreatePed(4, hash, gd.coords.x, gd.coords.y, gd.coords.z, gd.coords.w or 0.0, false, false)
            if ped ~= 0 then
                SetEntityAsMissionEntity(ped, true, true)
                SetEntityInvincible(ped, false)
                SetPedFleeAttributes(ped, 0, false)
                SetPedCombatAttributes(ped, 46, true)
                if gd.scenario then
                    TaskStartScenarioInPlace(ped, gd.scenario, 0, true)
                end
                -- Guards carry pistols but don't draw until alert >= 2
                GiveWeaponToPed(ped, GetHashKey('WEAPON_PISTOL'), 120, false, false)
                guardPeds[#guardPeds+1] = { ped = ped, state = 'PATROL', baseCoords = gd.coords }
            end
            SetModelAsNoLongerNeeded(hash)
        end
    end

    CreateThread(function()
        while #guardPeds > 0 do
            Wait(600)
            local player = PlayerPedId()
            for _, g in ipairs(guardPeds) do
                if DoesEntityExist(g.ped) then
                    if HasEntitySpottedEntity(g.ped, player, false) and alertLevel < 3 then
                        MSN_RaiseAlert(1, true)
                    end
                end
            end
        end
    end)
end

function MSN_RaiseAlert(amount)
    if not onAlertChange then return end
    local prev = alertLevel
    alertLevel = math.min(4, alertLevel + (amount or 1))
    if alertLevel == prev then return end

    onAlertChange(alertLevel)

    local player = PlayerPedId()
    for _, g in ipairs(guardPeds) do
        if DoesEntityExist(g.ped) then
            if alertLevel >= 3 then
                SetCurrentPedWeapon(g.ped, GetHashKey('WEAPON_PISTOL'), true)
                TaskCombatPed(g.ped, player, 0, 16)
                g.state = 'COMBAT'
            elseif alertLevel >= 1 and g.state == 'PATROL' then
                local pos = GetEntityCoords(player)
                TaskGoToCoordAnyMeans(g.ped, pos.x, pos.y, pos.z, 1.0, 0, false, 786603, 0.0)
                g.state = 'INVESTIGATE'
            end
        end
    end
    TriggerEvent('sunset:missions:client:alertChanged', alertLevel)
end

function MSN_GetAlertLevel()
    return alertLevel
end

function MSN_CleanupGuards()
    for _, g in ipairs(guardPeds) do
        MSN_DeleteEntity(g.ped)
    end
    guardPeds     = {}
    alertLevel    = 0
    onAlertChange = nil
end
