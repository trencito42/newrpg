local RPGVehicles = {}
local spawnedVehicles = {} -- id -> entity

local function isVehicleOccupied(entity)
    if not entity or not DoesEntityExist(entity) then return false end
    for _, raw in ipairs(GetPlayers()) do
        local src = tonumber(raw)
        if src then
            local ped = GetPlayerPed(src)
            if ped and ped ~= 0 and DoesEntityExist(ped) and GetVehiclePedIsIn(ped, false) == entity then
                return true
            end
        end
    end
    return false
end

local function spawnVehicleEntity(row)
    local modelHash = GetHashKey(row.model)
    local entity = CreateVehicleServerSetter(modelHash, 'automobile', tonumber(row.x), tonumber(row.y), tonumber(row.z), tonumber(row.heading))
    if not entity or entity == 0 then return nil end
    SetEntityOrphanMode(entity, 2) -- Delete entity when unowned/orphaned
    SetEntityRoutingBucket(entity, tonumber(row.virtual_world) or 0)
    spawnedVehicles[tonumber(row.id)] = entity
    return entity
end

function RPGVehicles.CreateServerVehicle(creatorAccountId, model, position)
    creatorAccountId = tonumber(creatorAccountId)
    model = tostring(model or ''):lower():match('^[%w_]+$')
    if not model or #model > 64 then return nil, 'Invalid vehicle model.' end
    if type(position) ~= 'table' or not position.x or not position.y or not position.z then return nil, 'Invalid position.' end

    local id = MySQL.insert.await([[
        INSERT INTO server_vehicles (model, x, y, z, heading, virtual_world, created_by_account_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        model, position.x, position.y, position.z, position.heading or 0.0, position.bucket or 0, creatorAccountId,
    })
    if not id then return nil, 'Database insert failed.' end

    local entity = spawnVehicleEntity({
        id = id,
        model = model,
        x = position.x,
        y = position.y,
        z = position.z,
        heading = position.heading or 0.0,
        virtual_world = position.bucket or 0,
    })
    if not entity then
        MySQL.query.await('DELETE FROM server_vehicles WHERE id = ?', { id })
        return nil, 'Failed to spawn vehicle entity.'
    end
    return id, entity
end

function RPGVehicles.GetVehicleEntity(vehicleId)
    local id = tonumber(vehicleId)
    local entity = id and spawnedVehicles[id]
    if entity and DoesEntityExist(entity) then return entity end
    return nil
end

function RPGVehicles.RespawnAll()
    local rows = MySQL.query.await('SELECT * FROM server_vehicles')
    local respawned = 0
    local skipped = 0

    for _, row in ipairs(rows) do
        local id = tonumber(row.id)
        local existing = spawnedVehicles[id]
        if existing and DoesEntityExist(existing) then
            if isVehicleOccupied(existing) then
                skipped = skipped + 1
                goto continue
            end
            DeleteEntity(existing)
            spawnedVehicles[id] = nil
        end
        if spawnVehicleEntity(row) then
            respawned = respawned + 1
        end
        ::continue::
    end
    return respawned, skipped
end

CreateThread(function()
    while GetResourceState('oxmysql') ~= 'started' do Wait(100) end
    Wait(500)
    local rows = MySQL.query.await('SELECT * FROM server_vehicles')
    for _, row in ipairs(rows) do spawnVehicleEntity(row) end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, entity in pairs(spawnedVehicles) do
        if DoesEntityExist(entity) then DeleteEntity(entity) end
    end
    spawnedVehicles = {}
end)

exports('CreateServerVehicle', RPGVehicles.CreateServerVehicle)
exports('GetVehicleEntity', RPGVehicles.GetVehicleEntity)
exports('RespawnAll', RPGVehicles.RespawnAll)
exports('IsVehicleOccupied', isVehicleOccupied)
