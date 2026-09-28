local onboarding = {}
local spawnEntitlements = {} -- src -> { token = string, reason = string, issuedAt = number, prepared = boolean }
local cinematicDuration = 0
for _, scene in ipairs(RPGSpawn.scenes) do cinematicDuration = cinematicDuration + scene.duration end

local function generateToken(src, reason)
    local token = ('%d:%d:%d:%s'):format(src, os.time(), math.random(100000, 999999), reason)
    spawnEntitlements[src] = {
        token = token,
        reason = reason,
        issuedAt = os.time(),
        prepared = false,
    }
    return token
end

function IssueSpawnEntitlement(src, reason)
    return generateToken(src, reason or 'custom_spawn')
end

exports('IssueSpawnEntitlement', IssueSpawnEntitlement)

exports.rpg_core:RegisterCallback('spawn.beginOnboarding', function(src)
    local player = exports.rpg_core:GetPlayer(src)
    if not player or player.tutorialCompleted then return nil, 'Onboarding is not required.' end
    local ok, err = exports.rpg_core:SetLifecycleState(src, 'onboarding')
    if not ok then return nil, err end
    local token = ('%d:%d:%d'):format(src, os.time(), math.random(100000, 999999))
    onboarding[src] = { token = token, startedAt = GetGameTimer() }
    return { token = token }
end, { windowMs = 5000, maximum = 2 })

exports.rpg_core:RegisterCallback('spawn.completeOnboarding', function(src, token)
    local session = onboarding[src]
    if not session or type(token) ~= 'string' or token ~= session.token then return nil, 'Onboarding session is invalid.' end
    if GetGameTimer() - session.startedAt < cinematicDuration - 500 then return nil, 'Onboarding is not finished.' end
    local ok, err = exports.rpg_core:CompleteTutorial(src)
    if not ok then return nil, err end
    onboarding[src] = nil
    -- Issue spawn entitlement for initial spawn
    local spawnToken = generateToken(src, 'initial_spawn')
    return { ok = true, spawnToken = spawnToken }
end, { windowMs = 10000, maximum = 2 })

exports.rpg_core:RegisterCallback('spawn.requestEntitlement', function(src)
    local player = exports.rpg_core:GetPlayer(src)
    if not player then return nil, 'Authentication required.' end
    if not player.tutorialCompleted then return nil, 'Onboarding must be completed first.' end
    if player.state == 'active' then return nil, 'Player is already active.' end
    local token = generateToken(src, 'login_spawn')
    return { spawnToken = token }
end, { windowMs = 5000, maximum = 3 })

exports.rpg_core:RegisterCallback('spawn.prepare', function(src, token)
    local player = exports.rpg_core:GetPlayer(src)
    if not player or not player.tutorialCompleted then return nil, 'Onboarding must be completed first.' end
    
    local entitlement = spawnEntitlements[src]
    if not entitlement or entitlement.token ~= token then
        return nil, 'No valid spawn entitlement found. Unauthorized spawn request.'
    end
    if os.time() - entitlement.issuedAt > 120 then
        spawnEntitlements[src] = nil
        return nil, 'Spawn entitlement expired. Please retry.'
    end

    local ok, err = exports.rpg_core:SetLifecycleState(src, 'spawning')
    if not ok then return nil, err end

    entitlement.prepared = true

    local spawnCoords = (player.position and player.position.x and math.abs(player.position.x) > 0.1) and player.position or RPGSpawn.airport
    if entitlement.reason == 'hospital_respawn' or entitlement.reason == 'death_respawn' then
        spawnCoords = RPGSpawn.hospital or RPGSpawn.airport
    end

    return { spawn = spawnCoords, model = player.model }
end, { windowMs = 5000, maximum = 3 })

exports.rpg_core:RegisterCallback('spawn.activate', function(src, token)
    local player = exports.rpg_core:GetPlayer(src)
    if not player then return nil, 'Spawn activation is not allowed.' end
    
    local entitlement = spawnEntitlements[src]
    if not entitlement or entitlement.token ~= token or not entitlement.prepared then
        return nil, 'Invalid or unprepared spawn session.'
    end

    -- Move player from private onboarding bucket to public world bucket 0
    SetPlayerRoutingBucket(src, 0)
    
    local ok, err = exports.rpg_core:SetLifecycleState(src, 'active')
    if not ok then return nil, err end

    spawnEntitlements[src] = nil
    return true
end, { windowMs = 5000, maximum = 3 })

RegisterNetEvent('rpg:core:playerDied', function()
    local src = source
    local player = exports.rpg_core:GetPlayer(src)
    if not player or player.state ~= 'active' then return end
    
    -- Issue death respawn entitlement after respawn delay
    SetTimeout(RPGSpawn.respawnDelayMs or 5000, function()
        if GetPlayerName(src) then
            local token = generateToken(src, 'death_respawn')
            TriggerClientEvent('rpg:spawn:readyToRespawn', src, token)
        end
    end)
end)

AddEventHandler('playerDropped', function()
    onboarding[source] = nil
    spawnEntitlements[source] = nil
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, raw in ipairs(GetPlayers()) do
        local src = tonumber(raw)
        local player = src and exports.rpg_core:GetPlayer(src)
        if player and (player.state == 'onboarding' or player.state == 'spawning') then
            DropPlayer(src, 'Spawn service restarted. Reconnect to resume safely.')
        end
    end
    onboarding = {}
    spawnEntitlements = {}
end)
