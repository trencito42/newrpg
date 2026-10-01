-- Server-authoritative glue state.
-- Stores who is glued to what, broadcasts to all clients on changes,
-- and sends full state to late-joining players.

local glueStates = {} -- [src] = { vehicleNetId, ox, oy, oz }

local function broadcastApply(src, vehicleNetId, ox, oy, oz)
    TriggerClientEvent('sunset:client:glueApply', -1, src, vehicleNetId, ox, oy, oz)
end

local function broadcastRemove(src)
    TriggerClientEvent('sunset:client:glueRemove', -1, src)
end

RegisterNetEvent('sunset:server:glue', function(vehicleNetId, ox, oy, oz)
    local src = source
    if not GetPlayerName(src) then return end

    -- Basic sanity: numeric types, reasonable offset range (±50 m).
    if type(vehicleNetId) ~= 'number' or vehicleNetId <= 0 then return end
    if type(ox) ~= 'number' or type(oy) ~= 'number' or type(oz) ~= 'number' then return end
    if math.abs(ox) > 50 or math.abs(oy) > 50 or math.abs(oz) > 50 then return end
    -- [SEC2] NaN, rate limit, and the vehicle must exist and be near the player
    if ox ~= ox or oy ~= oy or oz ~= oz or vehicleNetId ~= math.floor(vehicleNetId) then return end
    if not exports.sunset_core:RateLimit(src, 'glue', 500) then return end
    local veh = NetworkGetEntityFromNetworkId(vehicleNetId)
    local ped = GetPlayerPed(src)
    if not veh or veh == 0 or not DoesEntityExist(veh) or not ped or ped == 0 then return end
    if #(GetEntityCoords(ped) - GetEntityCoords(veh)) > 40.0 then return end

    -- If already glued, detach first.
    if glueStates[src] then
        glueStates[src] = nil
        broadcastRemove(src)
    end

    glueStates[src] = { vehicleNetId = vehicleNetId, ox = ox, oy = oy, oz = oz }
    broadcastApply(src, vehicleNetId, ox, oy, oz)
end)

RegisterNetEvent('sunset:server:unglue', function()
    local src = source
    if not glueStates[src] then return end
    glueStates[src] = nil
    broadcastRemove(src)
end)

-- Send full state to newly spawned players so they see existing attachments.
AddEventHandler('playerSpawned', function()
    local src = source
    local states = {}
    for gluedSrc, s in pairs(glueStates) do
        if GetPlayerName(gluedSrc) then
            states[#states + 1] = {
                src         = gluedSrc,
                vehicleNetId = s.vehicleNetId,
                ox = s.ox, oy = s.oy, oz = s.oz,
            }
        end
    end
    if #states > 0 then
        TriggerClientEvent('sunset:client:glueSyncAll', src, states)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    if glueStates[src] then
        glueStates[src] = nil
        broadcastRemove(src)
    end
end)

-- [AUDIT GLUE-DEATH] Clear glue state on player death so the attachment is not
-- re-applied on respawn via glueSyncAll.  GTA detaches entities when the ped
-- enters a ragdoll/wasted state; without this the server still holds a stale
-- entry and would re-attach the ped after the respawn screen.
AddEventHandler('sunset:server:playerDied', function()
    local src = source
    if glueStates[src] then
        glueStates[src] = nil
        broadcastRemove(src)
    end
end)

-- Fallback: also clean up when the player respawns (belt-and-suspenders).
RegisterNetEvent('sunset:server:characterSpawned', function()
    local src = source
    if glueStates[src] then
        glueStates[src] = nil
        broadcastRemove(src)
    end
end)
