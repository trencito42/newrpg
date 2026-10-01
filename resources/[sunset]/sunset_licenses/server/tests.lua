local function testExpired(session)
    if not session then return true end
    local practical = SunsetLicenses.Practical[session.licenseType]
    local maxSeconds = practical and tonumber(practical.maxTimeSec) or 600
    local began = tonumber(session.practicalStartedAt) or 0
    return began <= 0 or os.time() - began > maxSeconds + 30
end

function CleanupLicenseTestEntities(source)
    local session = GetTestSession(source)
    if not session then return end
    local netIds = {}
    if session.testVehicleNet then netIds[#netIds + 1] = session.testVehicleNet end
    for netId in pairs(session.weaponTargets or {}) do netIds[#netIds + 1] = netId end
    for _, netId in ipairs(netIds) do
        local entity = NetworkGetEntityFromNetworkId(tonumber(netId) or 0)
        if entity and entity ~= 0 and DoesEntityExist(entity) then DeleteEntity(entity) end
    end
    -- [SECTION 9-13] Clean up hunting exam animal peds
    for _, netId in ipairs(session.huntingLegalNetIds or {}) do
        local entity = NetworkGetEntityFromNetworkId(tonumber(netId) or 0)
        if entity and entity ~= 0 and DoesEntityExist(entity) then DeleteEntity(entity) end
    end
    for _, netId in ipairs(session.huntingProtectedNetIds or {}) do
        local entity = NetworkGetEntityFromNetworkId(tonumber(netId) or 0)
        if entity and entity ~= 0 and DoesEntityExist(entity) then DeleteEntity(entity) end
    end
    -- Remove temp hunting weapon from player if still connected
    if session.huntingExamStarted and GetPlayerName(source) then
        local practical = SunsetLicenses.Practical.hunting
        TriggerClientEvent('sunset:licenses:removeHuntingWeapon', source,
            practical and practical.weapon or 'WEAPON_SNIPERRIFLE')
    end
end

local function practicalVehicleModel(licenseType)
    local practical = SunsetLicenses.Practical[licenseType]
    local def = SunsetLicenses.Types[licenseType]
    local facility = def and SunsetLicenses.Facilities[def.facility]
    return facility and facility.testVehicle or practical and practical.vehicle
end

local function validSupervisor(session)
    local instructor = session and tonumber(session.instructor)
    if not instructor or not GetPlayerName(instructor) then return nil end
    local char = exports.sunset_core:GetCharacter(instructor)
    if not char or Sunset.GetCharacterFaction(char) ~= 'lssi'
        or not exports.sunset_factions:IsOnDuty(instructor) then return nil end
    return GetPlayerPed(instructor)
end

local function validateTestVehicle(source, session)
    local netId = tonumber(session.testVehicleNet)
    if not netId or netId <= 0 then
        return nil, { localeKey = 'licenses.message.the_training_vehicle_was_not_registered_restart_the_practical' }
    end
    local vehicle = NetworkGetEntityFromNetworkId(netId)
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) or GetEntityType(vehicle) ~= 2 then
        return nil, { localeKey = 'licenses.message.the_training_vehicle_no_longer_exists_restart_the_practical' }
    end
    local expectedModel = practicalVehicleModel(session.licenseType)
    if expectedModel and GetEntityModel(vehicle) ~= GetHashKey(expectedModel) then
        return nil, { localeKey = 'licenses.message.you_must_use_the_vehicle_assigned_for_this_practical' }
    end
    if NetworkGetEntityOwner(vehicle) ~= source then
        return nil, { localeKey = 'licenses.message.the_assigned_training_vehicle_is_not_under_your_control' }
    end
    local ped = GetPlayerPed(source)
    if ped == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then
        return nil, { localeKey = 'licenses.message.you_must_be_in_the_driver_seat_of_your' }
    end
    local def = SunsetLicenses.Types[session.licenseType]
    if def and def.instructorFaction and session.licenseType ~= 'weapon' then
        local instructorPed = validSupervisor(session) or 0
        if instructorPed == 0 or GetVehiclePedIsIn(instructorPed, false) ~= vehicle then
            return nil, { localeKey = 'licenses.message.your_lssi_instructor_must_supervise_the_practical_from_the' }
        end
    end
    return vehicle
end

exports.sunset_core:RegisterCallback('sunset:license:registerTestVehicle', function(source, netId)
    local session = GetTestSession(source)
    if not session or session.phase ~= 'practical' or session.licenseType == 'weapon' or testExpired(session) then
        return nil, { localeKey = 'licenses.message.no_active_vehicle_practical_test' }
    end
    netId = tonumber(netId)
    if not netId or netId <= 0 then return nil, { localeKey = 'licenses.message.invalid_training_vehicle' } end
    local vehicle = NetworkGetEntityFromNetworkId(netId)
    if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) or GetEntityType(vehicle) ~= 2 then
        return nil, { localeKey = 'licenses.message.training_vehicle_is_not_network_ready_yet' }
    end
    local expectedModel = practicalVehicleModel(session.licenseType)
    if not expectedModel or GetEntityModel(vehicle) ~= GetHashKey(expectedModel) then
        return nil, { localeKey = 'licenses.message.wrong_vehicle_model_for_this_practical_test' }
    end
    if NetworkGetEntityOwner(vehicle) ~= source then
        return nil, { localeKey = 'licenses.message.training_vehicle_ownership_could_not_be_verified' }
    end
    local ped = GetPlayerPed(source)
    if ped == 0 or GetPedInVehicleSeat(vehicle, -1) ~= ped then
        return nil, { localeKey = 'licenses.message.enter_the_driver_seat_before_the_vehicle_is_registered' }
    end
    session.testVehicleNet = netId
    session.vehicleRegisteredAt = os.time()
    return true
end)

exports.sunset_core:RegisterCallback('sunset:license:validateCheckpoint', function(source, licenseType, index)
    licenseType = tostring(licenseType or '')
    index = tonumber(index)
    if not index then return false, { localeKey = 'licenses.message.invalid_checkpoint' } end
    local session = GetTestSession(source)
    if not session or session.licenseType ~= licenseType or session.phase ~= 'practical' then
        return false, { localeKey = 'licenses.message.no_active_practical_test' }
    end
    if testExpired(session) then return false, { localeKey = 'licenses.message.the_practical_test_time_expired' } end
    local practical = SunsetLicenses.Practical[licenseType]
    if not practical or not practical.checkpoints or not practical.checkpoints[index] then
        return false, { localeKey = 'licenses.message.invalid_checkpoint_index' }
    end
    session.lastCheckpoint = tonumber(session.lastCheckpoint) or 0
    if index ~= session.lastCheckpoint + 1 then
        return false, { localeKey = 'licenses.message.wrong_checkpoint_order_go_to_checkpoint_value_next', formatArgs = { session.lastCheckpoint + 1 } }
    end
    local vehicle, vehicleError = validateTestVehicle(source, session)
    if not vehicle then return false, vehicleError end
    local pos = GetEntityCoords(vehicle)
    local cp = practical.checkpoints[index]
    local radius = practical.checkpointRadius or 8.0
    if #(pos - cp) > radius + 2.0 then return false, { localeKey = 'licenses.message.you_are_too_far_from_the_checkpoint' } end
    if licenseType == 'pilot' and pos.z < cp.z - math.max(8.0, radius * 0.35) then
        return false, { localeKey = 'licenses.message.gain_altitude_and_fly_through_the_checkpoint_it_cannot' }
    end
    session.lastCheckpoint = index
    session.practicalEvidence = session.practicalEvidence or {}
    session.practicalEvidence[#session.practicalEvidence + 1] = {
        event = 'checkpoint', index = index, at = os.time(),
        x = pos.x, y = pos.y, z = pos.z,
    }
    if index >= #practical.checkpoints then session.allCheckpoints = true end
    return true, { index = index, total = #practical.checkpoints }
end)

exports.sunset_core:RegisterCallback('sunset:license:registerWeaponTargets', function(source, targetNetIds)
    local session = GetTestSession(source)
    if not session or session.licenseType ~= 'weapon' or session.phase ~= 'practical' or testExpired(session) then
        return nil, { localeKey = 'licenses.message.no_active_weapon_practical_test' }
    end
    if type(targetNetIds) ~= 'table' then return nil, { localeKey = 'licenses.message.invalid_range_targets' } end
    local practical = SunsetLicenses.Practical.weapon
    local registered = {}
    for index, netId in ipairs(targetNetIds) do
        netId = tonumber(netId)
        local entity = netId and NetworkGetEntityFromNetworkId(netId) or 0
        local expected = practical.targets[index]
        if not expected or entity == 0 or not DoesEntityExist(entity) or GetEntityType(entity) ~= 3
            or GetEntityModel(entity) ~= GetHashKey('prop_range_target_01')
            or NetworkGetEntityOwner(entity) ~= source then
            return nil, { localeKey = 'licenses.message.range_target_value_could_not_be_verified', formatArgs = { index } }
        end
        local pos = GetEntityCoords(entity)
        if #(pos - vector3(expected.x, expected.y, expected.z - 1.0)) > 3.0 then
            return nil, { localeKey = 'licenses.message.range_target_value_is_in_the_wrong_position', formatArgs = { index } }
        end
        registered[netId] = index
    end
    if #targetNetIds ~= #(practical.targets or {}) then return nil, { localeKey = 'licenses.message.not_all_range_targets_were_registered' } end
    session.weaponTargets = registered
    session.weaponHits = {}
    session.weaponTargetsRegisteredAt = GetGameTimer()
    return true
end)

local function recordWeaponTargetHit(source, session, netId)
    local index = netId and session.weaponTargets and session.weaponTargets[netId]
    if not index or session.weaponHits[index] then return false end
    local entity = NetworkGetEntityFromNetworkId(netId)
    local expected = SunsetLicenses.Practical.weapon.targets[index]
    if entity == 0 or not DoesEntityExist(entity) or GetEntityType(entity) ~= 3
        or GetEntityModel(entity) ~= GetHashKey('prop_range_target_01') or not expected then return false end
    if #(GetEntityCoords(entity) - vector3(expected.x, expected.y, expected.z - 1.0)) > 3.0 then return false end
    session.weaponHits[index] = true
    session.practicalEvidence = session.practicalEvidence or {}
    session.practicalEvidence[#session.practicalEvidence + 1] = {
        event = 'target_hit', index = index, at = os.time(),
    }
    local count = 0
    for _ in pairs(session.weaponHits) do count = count + 1 end
    TriggerClientEvent('sunset:licenses:weaponProgress', source, count,
        SunsetLicenses.Practical.weapon.targetsRequired or 5)
    return true
end

-- Fallback for locally-owned network targets: the server validates the registered entity,
-- range position and cadence instead of trusting a client-provided hit count or index.
exports.sunset_core:RegisterCallback('sunset:license:claimWeaponTargetHit', function(source, targetNetId)
    local session = GetTestSession(source)
    if not session or session.licenseType ~= 'weapon' or session.phase ~= 'practical'
        or testExpired(session) or not session.weaponTargets then return false end
    local now = GetGameTimer()
    if now - (session.weaponTargetsRegisteredAt or now) < 1000
        or now - (session.weaponLastClaimAt or 0) < 250 then return false end
    local ped = GetPlayerPed(source)
    local practical = SunsetLicenses.Practical.weapon
    if ped == 0 or #(GetEntityCoords(ped) - practical.zoneCenter) > (practical.zoneRadius or 22.0) then return false end
    session.weaponLastClaimAt = now
    return recordWeaponTargetHit(source, session, tonumber(targetNetId))
end)

AddEventHandler('weaponDamageEvent', function(sender, data)
    local session = GetTestSession(sender)
    if not session or session.licenseType ~= 'weapon' or session.phase ~= 'practical'
        or testExpired(session) or type(data) ~= 'table' then return end
    local netId = tonumber(data.hitGlobalId)
    local index = netId and session.weaponTargets and session.weaponTargets[netId]
    if not index or session.weaponHits[index] then return end
    local ped = GetPlayerPed(sender)
    if ped == 0 then return end
    local practical = SunsetLicenses.Practical.weapon
    if #(GetEntityCoords(ped) - practical.zoneCenter) > (practical.zoneRadius or 22.0) then return end
    if tonumber(data.weaponType) ~= GetHashKey(practical.weapon or 'WEAPON_PISTOL') then return end
    recordWeaponTargetHit(sender, session, netId)
end)

exports.sunset_core:RegisterCallback('sunset:license:validateFinish', function(source, licenseType, data)
    licenseType = tostring(licenseType or '')
    local session = GetTestSession(source)
    if not session or session.licenseType ~= licenseType or session.phase ~= 'practical' then
        return false, { localeKey = 'licenses.message.no_active_practical_test' }
    end
    if testExpired(session) then return false, { localeKey = 'licenses.message.the_practical_test_time_expired' } end
    local practical = SunsetLicenses.Practical[licenseType]
    if not practical then return false, { localeKey = 'licenses.message.invalid_practical_test' } end
    local ped = GetPlayerPed(source)
    if ped == 0 then return false, { localeKey = 'licenses.message.your_position_could_not_be_verified' } end
    local pos = GetEntityCoords(ped)

    -- [SECTION 9-13] Hunting practical: server-authoritative target tracking
    if licenseType == 'hunting' then
        if not session.huntingExamStarted then
            return false, { localeKey = 'licenses.message.the_hunting_exam_targets_were_not_set_up_restart' }
        end
        local hits    = tonumber(session.huntingHits)    or 0
        local mistakes = tonumber(session.huntingMistakes) or 0
        local need       = practical.targetsRequired or 4
        local maxMistakes = practical.maxMistakes    or 2
        if mistakes > maxMistakes then
            return false, { localeKey = 'licenses.message.exam_failed_you_shot_value_protected_animals_max_value', formatArgs = { mistakes, maxMistakes } }
        end
        if hits < need then
            return false, { localeKey = 'licenses.message.hit_value_value_verified_deer_targets_first', formatArgs = { hits, need } }
        end
        local facility = SunsetLicenses.Facilities.hunting_range
        if facility and #(pos - facility.marker) > (facility.markerRadius or 3.0) + 5.0 then
            return false, { localeKey = 'licenses.message.return_to_the_hunting_range_booth_to_finish_the' }
        end
        local instructorPed = validSupervisor(session) or 0
        if instructorPed == 0 then
            return false, { localeKey = 'licenses.message.your_lssi_instructor_must_remain_at_the_range_until' }
        end
        session.phase = 'validated'
        session.practicalValidatedAt = os.time()
        session.practicalEvidence = session.practicalEvidence or {}
        session.practicalEvidence[#session.practicalEvidence + 1] = {
            event = 'finish_validated', at = session.practicalValidatedAt,
        }
        return true
    elseif licenseType == 'weapon' then
        local hits = 0
        for _ in pairs(session.weaponHits or {}) do hits = hits + 1 end
        local need = practical.targetsRequired or 5
        if hits < need then return false, { localeKey = 'licenses.message.hit_value_value_verified_targets_first', formatArgs = { hits, need } } end
        local facility = SunsetLicenses.Facilities.range
        if #(pos - facility.marker) > (facility.markerRadius or 2.5) + 3.0 then
            return false, { localeKey = 'licenses.message.return_to_the_range_booth_to_finish_the_test' }
        end
        local instructorPed = validSupervisor(session) or 0
        if instructorPed == 0 or #(GetEntityCoords(instructorPed) - practical.zoneCenter) > (practical.zoneRadius or 22.0) + 5.0 then
            return false, { localeKey = 'licenses.message.your_lssi_instructor_must_remain_at_the_range_until' }
        end
    else
        if not session.allCheckpoints then return false, { localeKey = 'licenses.message.complete_all_checkpoints_before_finishing' } end
        local vehicle, vehicleError = validateTestVehicle(source, session)
        if not vehicle then return false, vehicleError end
        local finish = practical.finish
        if finish and #(GetEntityCoords(vehicle) - vector3(finish.x, finish.y, finish.z))
            > (practical.finishRadius or 10.0) + 2.0 then
            return false, { localeKey = 'licenses.message.return_with_your_assigned_vehicle_to_the_finish_point' }
        end
        -- Engine-running state is not exposed as a server native. The server still verifies
        -- the exact test vehicle, driver seat and finish position before accepting this flag.
        if practical.requireEngineOff and (type(data) ~= 'table' or data.engineOn ~= false) then
            return false, { localeKey = 'licenses.message.shut_off_the_engine_before_finishing' }
        end
        local maxPenalties = practical.maxPenalties or practical.maxSpeedStrikes or 4
        local penaltyCount = tonumber(data and data.penalties)
        if penaltyCount == nil then
            local collisions = tonumber(data and data.collisions) or 0
            local speedStrikes = tonumber(data and data.speedStrikes) or 0
            penaltyCount = collisions + speedStrikes
        end
        if penaltyCount >= maxPenalties then
            return false, { localeKey = 'licenses.message.too_many_penalties_during_the_test_value_value', formatArgs = { penaltyCount, maxPenalties } }
        end
    end

    session.phase = 'validated'
    session.practicalValidatedAt = os.time()
    session.practicalEvidence = session.practicalEvidence or {}
    session.practicalEvidence[#session.practicalEvidence + 1] = {
        event = 'finish_validated', at = session.practicalValidatedAt,
    }
    return true
end)

-- ══════════════════════════════════════════════════════════════════════
--  SECTIONS 9-13: HUNTING PRACTICAL EXAM (SERVER-AUTHORITATIVE)
--  Server spawns animal peds, tracks hits via weaponDamageEvent.
--  STATIC VERIFIED: session guards, weapon hash validation, proximity.
--  REQUIRES IN-GAME TEST: CreatePed on server, weaponDamageEvent firing
--  for animal peds, complete flow from theory pass to license grant.
-- ══════════════════════════════════════════════════════════════════════

local HUNTING_DEER_MODEL_HASH   = GetHashKey('a_c_deer')
local HUNTING_RABBIT_MODEL_HASH = GetHashKey('a_c_rabbit_01')

-- [SECTION 9] Start the hunting practical: server creates animal peds
-- at the configured target positions and gives the player a temp weapon.
exports.sunset_core:RegisterCallback('sunset:license:startHuntingExam', function(source)
    local session = GetTestSession(source)
    if not session or session.licenseType ~= 'hunting' or session.phase ~= 'practical'
        or testExpired(session) then
        return nil, { localeKey = 'licenses.message.no_active_hunting_practical_test' }
    end
    -- Idempotent: return existing state if already started
    if session.huntingExamStarted then
        return {
            legalNetIds     = session.huntingLegalNetIds  or {},
            protectedNetIds = session.huntingProtectedNetIds or {},
            weapon          = (SunsetLicenses.Practical.hunting or {}).weapon or 'WEAPON_SNIPERRIFLE',
            ammo            = (SunsetLicenses.Practical.hunting or {}).ammo   or 15,
            targetsRequired = (SunsetLicenses.Practical.hunting or {}).targetsRequired or 4,
            maxMistakes     = (SunsetLicenses.Practical.hunting or {}).maxMistakes     or 2,
        }
    end
    -- [SECTION 10] FAIL CLOSED: weapon license is a prerequisite (also enforced at canStartTest)
    if GetResourceState('sunset_licenses') == 'started' then
        if exports.sunset_licenses:HasLicense(source, 'weapon') ~= true then
            return nil, { localeKey = 'licenses.message.you_must_hold_a_valid_firearm_license_to_take' }
        end
    end
    local practical = SunsetLicenses.Practical.hunting
    if not practical then return nil, { localeKey = 'licenses.message.hunting_practical_is_not_configured' } end

    -- [SECTION 11] Spawn legal targets (deer) at configured target positions
    local legalNetIds = {}
    for _, pos in ipairs(practical.targets or {}) do
        -- PED_TYPE_ANIMAL = 28
        local ped = CreatePed(28, HUNTING_DEER_MODEL_HASH,
            pos.x, pos.y, pos.z, pos.w or 0.0, true, true)
        if ped and ped ~= 0 then
            FreezeEntityPosition(ped, true)
            SetEntityInvincible(ped, false)
            SetBlockingOfNonTemporaryEvents(ped, true)
            legalNetIds[#legalNetIds + 1] = NetworkGetNetworkIdFromEntity(ped)
        end
    end

    -- [SECTION 11] Spawn protected targets (rabbit) at avoid positions
    local protectedNetIds = {}
    for _, pos in ipairs(practical.avoidPositions or {}) do
        local ped = CreatePed(28, HUNTING_RABBIT_MODEL_HASH,
            pos.x, pos.y, pos.z, pos.w or 0.0, true, true)
        if ped and ped ~= 0 then
            FreezeEntityPosition(ped, true)
            SetEntityInvincible(ped, false)
            SetBlockingOfNonTemporaryEvents(ped, true)
            protectedNetIds[#protectedNetIds + 1] = NetworkGetNetworkIdFromEntity(ped)
        end
    end

    if #legalNetIds == 0 then
        -- Cleanup any protected peds spawned before failure
        for _, netId in ipairs(protectedNetIds) do
            local e = NetworkGetEntityFromNetworkId(netId)
            if e and e ~= 0 and DoesEntityExist(e) then DeleteEntity(e) end
        end
        return nil, { localeKey = 'licenses.message.could_not_spawn_exam_targets_retry_the_practical_test' }
    end

    -- [SECTION 11] Store authoritative exam state in session
    session.huntingExamStarted    = true
    session.huntingLegalNetIds    = legalNetIds
    session.huntingProtectedNetIds = protectedNetIds
    session.huntingLegalSet       = {}
    session.huntingProtectedSet   = {}
    session.huntingHitSet         = {}
    session.huntingMistakeSet     = {}
    session.huntingHits           = 0
    session.huntingMistakes       = 0
    for _, netId in ipairs(legalNetIds)     do session.huntingLegalSet[netId]     = true end
    for _, netId in ipairs(protectedNetIds) do session.huntingProtectedSet[netId] = true end

    -- [SECTION 11] Give temp weapon — server authorizes, client executes
    TriggerClientEvent('sunset:licenses:giveHuntingWeapon', source,
        practical.weapon or 'WEAPON_SNIPERRIFLE', practical.ammo or 15)

    session.practicalEvidence = session.practicalEvidence or {}
    session.practicalEvidence[#session.practicalEvidence + 1] = {
        event = 'hunting_exam_started', at = os.time(),
        legalSpawned = #legalNetIds, protectedSpawned = #protectedNetIds,
    }

    return {
        legalNetIds     = legalNetIds,
        protectedNetIds = protectedNetIds,
        weapon          = practical.weapon or 'WEAPON_SNIPERRIFLE',
        ammo            = practical.ammo   or 15,
        targetsRequired = practical.targetsRequired or 4,
        maxMistakes     = practical.maxMistakes     or 2,
    }
end)

-- [SECTION 12] weaponDamageEvent — hunting practical hit tracking.
-- Fires for EVERY weapon damage event; filter early on session check.
AddEventHandler('weaponDamageEvent', function(sender, data)
    if type(data) ~= 'table' then return end
    local session = GetTestSession(sender)
    if not session or session.licenseType ~= 'hunting' or session.phase ~= 'practical'
        or not session.huntingExamStarted or testExpired(session) then return end

    local netId = tonumber(data.hitGlobalId)
    if not netId or netId == 0 then return end

    -- [SECTION 12] Validate weapon: only the exam rifle counts
    local practical = SunsetLicenses.Practical.hunting
    local examWeaponHash = GetHashKey(practical.weapon or 'WEAPON_SNIPERRIFLE')
    local sentHash = tonumber(data.weaponType) or 0
    -- Normalize to signed 32-bit (weaponDamageEvent may send unsigned)
    if sentHash > 2147483647 then sentHash = sentHash - 4294967296 end
    if examWeaponHash > 2147483647 then examWeaponHash = examWeaponHash - 4294967296 end
    if sentHash ~= examWeaponHash then return end

    -- [SECTION 12] Validate shooter is within the exam zone
    local ped = GetPlayerPed(sender)
    if ped == 0 then return end
    local zoneCenter = practical.zoneCenter
    if zoneCenter and #(GetEntityCoords(ped) - zoneCenter) > (practical.zoneRadius or 60.0) then return end

    if session.huntingLegalSet and session.huntingLegalSet[netId] then
        -- Legal target hit (deer)
        if not session.huntingHitSet then session.huntingHitSet = {} end
        if not session.huntingHitSet[netId] then
            session.huntingHitSet[netId]  = true
            session.huntingHits = (session.huntingHits or 0) + 1
            session.practicalEvidence = session.practicalEvidence or {}
            session.practicalEvidence[#session.practicalEvidence + 1] = {
                event = 'hunting_legal_hit', netId = netId,
                hits = session.huntingHits, at = os.time(),
            }
            TriggerClientEvent('sunset:licenses:huntingProgress', sender,
                session.huntingHits, practical.targetsRequired or 4)
            if session.huntingHits >= (practical.targetsRequired or 4) then
                TriggerClientEvent('sunset:licenses:huntingAllDown', sender)
            end
        end
    elseif session.huntingProtectedSet and session.huntingProtectedSet[netId] then
        -- Protected target hit (rabbit) — mistake
        if not session.huntingMistakeSet then session.huntingMistakeSet = {} end
        if not session.huntingMistakeSet[netId] then
            session.huntingMistakeSet[netId] = true
            session.huntingMistakes = (session.huntingMistakes or 0) + 1
            local maxMistakes = practical.maxMistakes or 2
            session.practicalEvidence = session.practicalEvidence or {}
            session.practicalEvidence[#session.practicalEvidence + 1] = {
                event = 'hunting_protected_hit', netId = netId,
                mistakes = session.huntingMistakes, at = os.time(),
            }
            TriggerClientEvent('sunset:licenses:huntingMistake', sender,
                session.huntingMistakes, maxMistakes)
            -- [SECTION 12] Auto-fail on exceeding mistake limit
            if session.huntingMistakes > maxMistakes then
                CleanupLicenseTestEntities(sender)
                if type(FinalizeLicenseExamReport) == 'function' then
                    FinalizeLicenseExamReport(session, 'failed')
                end
                ClearLicenseTestSession(sender, 'FAILED', 'too many protected animal kills')
                TriggerClientEvent('sunset:licenses:testAbort', sender)
                TriggerClientEvent('sunset:client:notify', sender,
                    ('Exam failed: you shot %d protected animals (limit %d).'):format(
                        session.huntingMistakes, maxMistakes),
                    'error', 7000)
            end
        end
    end
end)
