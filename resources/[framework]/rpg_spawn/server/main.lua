local onboarding = {}
local cinematicDuration = 0
for _, scene in ipairs(RPGSpawn.scenes) do cinematicDuration = cinematicDuration + scene.duration end

exports.rpg_core:RegisterCallback('spawn.beginOnboarding', function(src)
    local player = exports.rpg_core:GetPlayer(src)
    if not player or player.tutorialCompleted then return nil, 'Onboarding is not required.' end
    local ok, err = exports.rpg_core:SetLifecycleState(src, 'onboarding')
    if not ok then return nil, err end
    SetPlayerRoutingBucket(src, 0)
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
    return true
end, { windowMs = 10000, maximum = 2 })

exports.rpg_core:RegisterCallback('spawn.prepare', function(src)
    local player = exports.rpg_core:GetPlayer(src)
    if not player or not player.tutorialCompleted then return nil, 'Onboarding must be completed first.' end
    if player.state ~= 'authenticated' and player.state ~= 'onboarding' and player.state ~= 'active' then
        return nil, 'Spawn is not allowed from the current state.'
    end
    local ok, err = exports.rpg_core:SetLifecycleState(src, 'spawning')
    if not ok then return nil, err end
    SetPlayerRoutingBucket(src, 0)
    local spawnCoords = (player.position and player.position.x and math.abs(player.position.x) > 0.1) and player.position or RPGSpawn.airport
    return { spawn = spawnCoords, model = player.model }
end, { windowMs = 5000, maximum = 3 })

exports.rpg_core:RegisterCallback('spawn.activate', function(src)
    local player = exports.rpg_core:GetPlayer(src)
    if not player then return nil, 'Spawn activation is not allowed.' end
    local ok, err = exports.rpg_core:SetLifecycleState(src, 'active')
    if not ok then return nil, err end
    return true
end, { windowMs = 5000, maximum = 3 })

AddEventHandler('playerDropped', function() onboarding[source] = nil end)
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
end)
