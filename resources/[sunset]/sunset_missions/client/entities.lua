local spawnedEntities = {}

local function loadModel(model)
    local hash = type(model) == 'number' and model or GetHashKey(model)
    if not IsModelValid(hash) then return nil end
    RequestModel(hash)
    local t = 0
    while not HasModelLoaded(hash) do
        Wait(50)
        t = t + 50
        if t > 10000 then return nil end
    end
    return hash
end

function MSN_SpawnVehicle(model, coords, color)
    local hash = loadModel(model)
    if not hash then return nil end
    local veh = CreateVehicle(hash, coords.x, coords.y, coords.z, coords.w or 0.0, false, false)
    if veh == 0 then SetModelAsNoLongerNeeded(hash) return nil end
    SetEntityAsMissionEntity(veh, true, true)
    SetVehicleOnGroundProperly(veh)
    if color then
        SetVehicleCustomPrimaryColour(veh, color.r, color.g, color.b)
        SetVehicleCustomSecondaryColour(veh, color.r, color.g, color.b)
    end
    SetModelAsNoLongerNeeded(hash)
    spawnedEntities[#spawnedEntities+1] = veh
    return veh
end

function MSN_SpawnPed(model, coords, scenario, hostile)
    local hash = loadModel(model)
    if not hash then return nil end
    local ped = CreatePed(4, hash, coords.x, coords.y, coords.z, coords.w or 0.0, false, false)
    if ped == 0 then SetModelAsNoLongerNeeded(hash) return nil end
    SetEntityAsMissionEntity(ped, true, true)
    SetEntityInvincible(ped, false)
    SetPedFleeAttributes(ped, 0, false)
    SetPedCombatAttributes(ped, 46, true)
    if hostile then
        local playerGroup = GetPedRelationshipGroupHash(PlayerPedId())
        local enemyGroup  = GetHashKey('MISSION_ENEMY')
        SetRelationshipBetweenGroups(5, enemyGroup, playerGroup)
        SetRelationshipBetweenGroups(5, playerGroup, enemyGroup)
        SetPedRelationshipGroupHash(ped, enemyGroup)
        GiveWeaponToPed(ped, GetHashKey('WEAPON_PISTOL'), 120, false, true)
    elseif scenario then
        TaskStartScenarioInPlace(ped, scenario, 0, true)
    end
    SetModelAsNoLongerNeeded(hash)
    spawnedEntities[#spawnedEntities+1] = ped
    return ped
end

function MSN_SpawnProp(model, coords, rotation)
    local hash = loadModel(model)
    if not hash then return nil end
    local obj = CreateObject(hash, coords.x, coords.y, coords.z, false, false, false)
    if obj == 0 then SetModelAsNoLongerNeeded(hash) return nil end
    SetEntityAsMissionEntity(obj, true, true)
    if rotation then SetEntityRotation(obj, rotation.x, rotation.y, rotation.z, 2, true) end
    SetModelAsNoLongerNeeded(hash)
    spawnedEntities[#spawnedEntities+1] = obj
    return obj
end

function MSN_DeleteEntity(entity)
    if entity and DoesEntityExist(entity) then
        SetEntityAsMissionEntity(entity, false, true)
        DeleteEntity(entity)
    end
    for i, e in ipairs(spawnedEntities) do
        if e == entity then table.remove(spawnedEntities, i) break end
    end
end

function MSN_CleanupAllEntities()
    for _, e in ipairs(spawnedEntities) do
        if DoesEntityExist(e) then
            SetEntityAsMissionEntity(e, false, true)
            DeleteEntity(e)
        end
    end
    spawnedEntities = {}
end

-- [JOBS AUDIT] mission props/vehicles/guards were never deleted when the resource stopped mid-mission.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if MSN_CleanupGuards then pcall(MSN_CleanupGuards) end
    MSN_CleanupAllEntities()
end)

function MSN_AttachCargo(prop, ped)
    AttachEntityToEntity(prop, ped, GetPedBoneIndex(ped, 57005), 0.12, 0.0, 0.0, 0.0, 0.0, 0.0, false, false, false, false, 2, true)
end
