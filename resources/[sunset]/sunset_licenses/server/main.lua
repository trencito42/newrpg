local TestSessions = {}
local AuthorizedTests = {}
local ServerLicenseCache = {}
local LastWeaponWarning = {}
local LicenseForceReload = {} -- [source] = last forced DB reload time (throttle)

-- ═══════════════════════════════════════════════════════════════
--  [SESSIONS MIGRATION] Mirror license exams into sunset_sessions:
--  ListSessions visibility + hard deadline backstop + central
--  triggers. The exam logic stays in this resource (validated).
-- ═══════════════════════════════════════════════════════════════
local SessionsService = GetResourceState('sunset_sessions') == 'started'
local function sessionsCall(method, ...)
    if GetResourceState('sunset_sessions') ~= 'started' then SessionsService = false return nil end
    local args = table.pack(...)
    local ok, res = pcall(function()
        return exports.sunset_sessions[method](exports.sunset_sessions, table.unpack(args, 1, args.n))
    end)
    if not ok then return nil end
    return res
end

CreateThread(function()
    -- [PERF] explicit readiness instead of a fixed Wait hoping sunset_sessions loaded
    local waited = 0
    while GetResourceState('sunset_sessions') ~= 'started' and waited < 60000 do Wait(500); waited = waited + 500 end
    if GetResourceState('sunset_sessions') ~= 'started' then
        print('^3[sunset_licenses]^7 sunset_sessions not started; exams run standalone.')
        return
    end
    SessionsService = true
    sessionsCall('RegisterActivity', 'license_exam', {
        reconnect = 'ABANDON',
        onEndEvent = 'sunset:licenses:frameworkSessionEnded',
    })
end)

-- Framework ended the mirrored exam (deadline/downed/jail/drop/stop):
-- abort the local exam exactly like the manual abort path.
AddEventHandler('sunset:licenses:frameworkSessionEnded', function(fwSession, state)
    if type(fwSession) ~= 'table' then return end
    local src = tonumber(fwSession.source)
    if not src then return end
    local session = TestSessions[src]
    if not session or session.frameworkId ~= fwSession.id then return end
    if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'aborted') end
    if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(src) end
    TestSessions[src] = nil
    if GetPlayerName(src) then
        TriggerClientEvent('sunset:licenses:testAbort', src)
        -- NOTE: do not use `notify` here — it is a local declared later in this
        -- file (forward ref would resolve to nil global at this scope).
        TriggerClientEvent('sunset:client:notify', src,
            exports.sunset_core:TFor(src, 'licenses.message.your_license_exam_ended_value', tostring(state or 'session closed')), 'error', 7000)
    end
end)

local function createExamFrameworkSession(source, charId, licenseType)
    if not SessionsService then return nil end
    local theoryTimeSec = tonumber(SunsetLicenses.TheoryTimeSec) or 600
    local practicalTimeSec = 1500
    local s = sessionsCall('CreateSession', {
        source = source,
        charId = charId,
        activity = 'license_exam',
        timeoutSec = theoryTimeSec + practicalTimeSec + 300,
        data = { licenseType = licenseType },
    })
    if type(s) == 'table' and s.id then
        sessionsCall('Transition', s.id, 'ACTIVE', 'exam started')
        return s.id
    end
    return nil
end

-- Single clear path so the framework mirror always ends with the local exam.
local function clearTestSession(source, fwState, fwReason)
    local session = TestSessions[source]
    TestSessions[source] = nil
    if session and session.frameworkId then
        local id = session.frameworkId
        session.frameworkId = nil
        sessionsCall('EndSession', id, fwState or 'COMPLETED', fwReason or 'exam ended')
    end
end

local function notify(source, message, kind)
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', 7000)
end

local function charId(source)
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.id)
end

local function currentPaydays(source)
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.paydays_received) or 0
end

local function playtimeMinutes(source)
    local player = exports.sunset_core:GetPlayer(source)
    return player and tonumber(player.playtime) or 0
end

local function isInstructor(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false end
    local factionId = Sunset.GetCharacterFaction(char)
    if factionId ~= 'lssi' then return false end
    if not exports.sunset_factions:IsOnDuty(source) then return false end
    local grade = select(2, Sunset.GetCharacterFaction(char))
    return Sunset.HasFactionPerm('lssi', grade, 'issue_license')
        or Sunset.HasFactionPerm('lssi', grade, 'conduct_test')
end

local function playerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

local function near(source, position, radius)
    local coords = playerCoords(source)
    if not coords or not position then return false end
    return #(coords - vector3(position.x, position.y, position.z)) <= radius
end

local function sessionTimedOut(session)
    if not session then return true end
    local practical = SunsetLicenses.Practical[session.licenseType]
    local maxSeconds = practical and tonumber(practical.maxTimeSec) or 600
    local began = tonumber(session.practicalStartedAt or session.startedAt) or 0
    return began <= 0 or os.time() - began > maxSeconds + 30
end

local function sanitizedTheory(theory)
    local result = {
        title = theory.title,
        intro = theory.intro,
        passScore = theory.passScore,
        questions = {},
    }
    for i, question in ipairs(theory.questions or {}) do
        result.questions[i] = { q = question.q, options = question.options }
    end
    return result
end

local function bindTheoryAnswerKeys()
    for licenseType, key in pairs(SunsetLicenseTheoryAnswers or {}) do
        local theory = SunsetLicenses.Theory[licenseType]
        if not theory then goto continue end
        for i, question in ipairs(theory.questions or {}) do
            question.serverAnswer = tonumber(key[i])
        end
        ::continue::
    end
end

bindTheoryAnswerKeys()

function IsInLicenseTest(source)
    return TestSessions[source] ~= nil
end
exports('IsInLicenseTest', IsInLicenseTest)

local function loadLicenseRows(characterId)
    return MySQL.query.await([[
        SELECT license_type, issued_at, issued_at_payday, expires_at_payday, issued_by_character_id
        FROM character_licenses WHERE character_id = ?
    ]], { characterId }) or {}
end

local function rowValid(row, paydays)
    if not row then return false end
    local exp = tonumber(row.expires_at_payday)
    if not exp then return true end
    return paydays < exp
end

local function loadLicenseCache(source)
    local cid = charId(source)
    if not cid then ServerLicenseCache[source] = nil return nil end
    local paydays = currentPaydays(source)
    local cache = { characterId = cid, paydays = paydays, licenses = {} }
    for _, row in ipairs(loadLicenseRows(cid)) do
        cache.licenses[tostring(row.license_type)] = rowValid(row, paydays)
    end
    ServerLicenseCache[source] = cache
    return cache
end

local function licenseCache(source)
    local cid = charId(source)
    if not cid then return nil end
    local cache = ServerLicenseCache[source]
    if not cache or cache.characterId ~= cid or cache.paydays ~= currentPaydays(source) then
        cache = loadLicenseCache(source)
    end
    return cache
end

AddEventHandler('sunset:server:characterSelected', function(source)
    loadLicenseCache(tonumber(source))
end)

function GetLicenseRows(source)
    local cid = charId(source)
    if not cid then return {} end
    return loadLicenseRows(cid)
end
exports('GetLicenseRows', GetLicenseRows)

function HasLicense(source, licenseType)
    licenseType = tostring(licenseType or '')
    local def = SunsetLicenses.Types[licenseType]
    if not def then return false, { localeKey = 'licenses.message.unknown_license_type' } end
    if IsInLicenseTest(source) then
        local session = TestSessions[source]
        if session and session.licenseType == licenseType
            and (session.phase == 'practical' or session.phase == 'validated') then
            return true, 'test'
        end
    end
    -- [LICENSE FIX] ALWAYS read fresh rows from the DB. The old ServerLicenseCache
    -- went stale whenever paydays_received lagged behind a license grant/revoke
    -- or the character object was momentarily incomplete, and wrongly reported
    -- "no license" for players who demonstrably had a valid row (blocked gunshop
    -- purchases: "action failed" while the DB said licensed). One indexed query
    -- per check is cheap; correctness beats the cache.
    local cid = charId(source)
    if not cid then return false, { localeKey = 'licenses.message.character_not_loaded' } end
    local paydays = currentPaydays(source)
    local owned = false
    for _, row in ipairs(loadLicenseRows(cid)) do
        if tostring(row.license_type) == licenseType and rowValid(row, paydays) then
            owned = true
            break
        end
    end
    -- Keep the mirror cache in sync for any remaining cachedHasLicense callers.
    local cache = ServerLicenseCache[source]
    if cache and cache.characterId == cid then
        cache.licenses[licenseType] = owned
        cache.paydays = paydays
    end
    if not owned then
        return false, { localeKey = 'licenses.message.you_need_a_valid_value_visit_the_value', formatArgs = { def.label, def.label } }
    end
    return true
end
exports('HasLicense', HasLicense)

local function cachedHasLicense(source, licenseType)
    local session = TestSessions[source]
    if session and session.licenseType == licenseType
        and (session.phase == 'practical' or session.phase == 'validated') then return true end
    local cache = licenseCache(source)
    if cache and cache.licenses[licenseType] == true then return true end
    -- [BUGFIX] Cache said NO: force a fresh DB load before deciding. A stale
    -- ServerLicenseCache (e.g. license granted while cache held old paydays,
    -- or character data lag) wrongly blocked firearm damage for players who
    -- DO have a valid license ("Firearm damage blocked" while licensed).
    -- Throttled to one forced reload per 3s per source so a licensed-less
    -- player spamming shots cannot hammer the DB.
    local now = os.time()
    local last = LicenseForceReload[source]
    if not last or (now - last) >= 3 then
        LicenseForceReload[source] = now
        cache = loadLicenseCache(source)
        if cache and cache.licenses[licenseType] == true then return true end
    end
    return false
end

local meleeHashes = {}
SunsetLicenses.MeleeWeaponHashes = meleeHashes
for weaponName in pairs(SunsetLicenses.MeleeWeapons or {}) do
    local hash = SunsetLicenses.normalizeWeaponHash(GetHashKey(weaponName))
    meleeHashes[hash] = true
    if hash < 0 then
        meleeHashes[hash + 4294967296] = true
    end
end

local function isMeleeWeaponHash(weaponHash)
    if SunsetLicenses.isMeleeWeaponHash(weaponHash) then return true end
    return meleeHashes[SunsetLicenses.normalizeWeaponHash(weaponHash)] == true
end

local function isLawEnforcementOnDuty(source)
    if GetResourceState('sunset_factions') ~= 'started' then return false end
    if exports.sunset_factions:IsOnDuty(source) ~= true then return false end
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false end
    local factionId = select(1, Sunset.GetCharacterFaction(char))
    return Sunset.FactionTypeMatches
        and Sunset.FactionTypeMatches(factionId, 'law_enforcement') == true
end

local function canDealWeaponDamage(source)
    if IsInLicenseTest(source) then return true end
    if isLawEnforcementOnDuty(source) then return true end
    if cachedHasLicense(source, 'weapon') then return true end
    return false
end

local function resyncVictimTo(source, data)
    local netId = tonumber(data.hitGlobalId)
    if not netId or netId == 0 then return end
    local victim = NetworkGetEntityFromNetworkId(netId)
    if not victim or victim == 0 then return end
    -- [AUDIT 3-8.2] Only resync player peds: vehicles/objects return odd values
    -- from GetEntityHealth that would be pushed into a client health-set event.
    if GetEntityType(victim) ~= 1 or not IsPedAPlayer(victim) then return end
    local health = GetEntityHealth(victim)
    local armor = GetPedArmour(victim)
    -- [DESYNC FIX] Send the resync to BOTH the shooter and the victim. The
    -- shooter's client predicts the kill locally and shows a dead body while
    -- the damage was actually cancelled server-side; only the VICTIM owns
    -- their ped, so the victim-side SetEntityHealth is what authoritatively
    -- re-replicates the true (alive) state and clears the shooter's ghost.
    TriggerClientEvent('sunset:combat:resyncPed', source, netId, health, armor)
    local victimSrc = NetworkGetEntityOwner(victim)
    if victimSrc and victimSrc > 0 and victimSrc ~= source then
        TriggerClientEvent('sunset:combat:resyncPed', victimSrc, netId, health, armor)
    end
end

-- [LICENSE GATE DISABLED] Owner decision: the firearm-license damage gate was
-- implemented on shaky primitives (stale ServerLicenseCache, unreliable
-- NetworkGetEntityOwner victim resolution) and blocked legit licensed players
-- mid-combat. Damage is NO LONGER cancelled for missing licenses; this handler
-- stays ONLY to attribute the last aggressor for war kill scoring. The
-- license is still enforced where it matters economically: buying weapons
-- (gunshop) and receiving weapons in trade/inventory (AddItem checks).
-- [WAR KILL FIX 2] This handler is now PURE kill attribution. Two bugs made
-- war kills not score:
--  (1) melee hits returned early -> knife kills were never attributed;
--  (2) NetworkGetEntityOwner(victim) frequently returns 0/nil under OneSync
--      -> firearm kills lost their attacker. The victim is now resolved by
--      comparing the entity against every player's ped (cheap, reliable).
AddEventHandler('weaponDamageEvent', function(sender, data)
    if type(data) ~= 'table' then return end
    local victimNet = tonumber(data.hitGlobalId)
    if victimNet and victimNet ~= 0 then
        local victimEnt = NetworkGetEntityFromNetworkId(victimNet)
        if victimEnt and victimEnt ~= 0 and IsPedAPlayer(victimEnt) then
            local victimSrc = exports.sunset_core:GetSourceByPed(victimEnt)
            if victimSrc and victimSrc ~= sender then
                TriggerEvent('sunset:death:recordAttacker', victimSrc, sender)
            end
        end
    end
end)

function GrantLicense(source, licenseType, issuedByCharacterId)
    licenseType = tostring(licenseType or '')
    if not SunsetLicenses.Types[licenseType] then return false, { localeKey = 'licenses.message.invalid_license_type' } end
    local cid = charId(source)
    if not cid then return false, { localeKey = 'licenses.message.character_not_loaded' } end
    local paydays = currentPaydays(source)
    local expires = paydays + (SunsetLicenses.PaydayExpiry or 150)
    local saved, result = pcall(MySQL.insert.await, [[
        INSERT INTO character_licenses (character_id, license_type, issued_at_payday, expires_at_payday, issued_by_character_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            issued_at = CURRENT_TIMESTAMP,
            issued_at_payday = VALUES(issued_at_payday),
            expires_at_payday = VALUES(expires_at_payday),
            issued_by_character_id = VALUES(issued_by_character_id)
    ]], { cid, licenseType, paydays, expires, issuedByCharacterId })
    if not saved or result == nil then
        print(('[sunset_licenses] Failed to persist %s for character %d: %s'):format(
            licenseType, cid, tostring(result)))
        return false, { localeKey = 'licenses.message.the_license_could_not_be_saved_no_license_was' }
    end
    notify(source, exports.sunset_core:TFor(source, 'licenses.msg.issued_valid_until_payday', { label = tostring(SunsetLicenses.Types[licenseType].label), expires = math.floor(tonumber(expires) or 0) }), 'success')
    -- [QUESTS] License acquisition progress
    TriggerEvent('sunset:quest:progress', cid, 'license_obtained', 1, { license = licenseType })
    if licenseType == 'hunting' then
        TriggerEvent('sunset:quest:progress', cid, 'hunting_range_passed', 1)
    end
    return true
end
exports('GrantLicense', GrantLicense)

function RevokeLicense(source, licenseType)
    licenseType = tostring(licenseType or '')
    local cid = charId(source)
    if not cid then
        -- Attempt fallback if source passed is already a character ID
        local num = tonumber(source)
        if num and num > 0 then
            return RevokeLicenseByCharacterId(num, licenseType)
        end
        return false, { localeKey = 'licenses.message.character_not_loaded' }
    end
    MySQL.update.await(
        'DELETE FROM character_licenses WHERE character_id = ? AND license_type = ?',
        { cid, licenseType }
    )
    TriggerClientEvent('sunset:licenses:refresh', source)
    loadLicenseCache(source)
    return true
end
exports('RevokeLicense', RevokeLicense)

function RevokeLicenseByCharacterId(cid, licenseType)
    cid = tonumber(cid)
    if not cid or cid <= 0 then return false, { localeKey = 'licenses.message.invalid_character_id' } end
    licenseType = tostring(licenseType or '')
    MySQL.update.await(
        'DELETE FROM character_licenses WHERE character_id = ? AND license_type = ?',
        { cid, licenseType }
    )
    -- If player is currently online, clear cache & trigger refresh
    for src, cache in pairs(ServerLicenseCache) do
        local c = exports.sunset_core:GetCharacter(src)
        if c and tonumber(c.id) == cid then
            loadLicenseCache(src)
            TriggerClientEvent('sunset:licenses:refresh', src)
            break
        end
    end
    return true
end
exports('RevokeLicenseByCharacterId', RevokeLicenseByCharacterId)

function GetLicenses(source)
    local cid = charId(source)
    if not cid then return {} end
    local paydays = currentPaydays(source)
    local rows = loadLicenseRows(cid)
    local out = {}
    for _, row in ipairs(rows) do
        local def = SunsetLicenses.Types[row.license_type]
        local valid = rowValid(row, paydays)
        out[#out + 1] = {
            license_type = row.license_type,
            label = def and def.label or row.license_type,
            issued_at = row.issued_at,
            issued_at_payday = row.issued_at_payday,
            expires_at_payday = row.expires_at_payday,
            valid = valid,
        }
    end
    return out
end
exports('GetLicenses', GetLicenses)

local function resolveExamFee(licenseType)
    local def = SunsetLicenses.Types[licenseType]
    if def and tonumber(def.examFee) then
        return math.floor(tonumber(def.examFee))
    end
    local starting = tonumber(Sunset.Config and Sunset.Config.StartingCash) or 500
    local pct = tonumber(def and def.examFeePercent)
        or tonumber(SunsetLicenses.ExamFeePercentOfStartingCash)
        or 0.10
    local fee = math.floor(starting * pct)
    local minFee = tonumber(SunsetLicenses.ExamFeeMin) or 40
    local maxFee = tonumber(SunsetLicenses.ExamFeeMax) or 100
    return math.max(minFee, math.min(maxFee, fee))
end

local function chargeExamFee(source, licenseType)
    local fee = resolveExamFee(licenseType)
    if fee <= 0 then return true, 0, nil end
    if exports.sunset_core:RemoveMoney(source, 'cash', fee, 'license_exam') then
        return true, fee, 'cash'
    end
    if exports.sunset_core:RemoveMoney(source, 'bank', fee, 'license_exam') then
        return true, fee, 'bank'
    end
    return false, fee, nil
end

local function checkPrerequisites(source, licenseType)
    local def = SunsetLicenses.Types[licenseType]
    if not def or not def.prerequisites or #def.prerequisites == 0 then return true end
    -- FAIL CLOSED: if the licenses resource is somehow unavailable (it IS this
    -- resource, so this is a self-check guard), deny rather than silently grant.
    for _, prereqType in ipairs(def.prerequisites) do
        local prereqDef = SunsetLicenses.Types[prereqType]
        local ok, _ = HasLicense(source, prereqType)
        if not ok then
            local prereqLabel = prereqDef and prereqDef.label or prereqType
            return false, { localeKey = 'licenses.message.you_must_hold_a_valid_value_before_taking_the', formatArgs = { prereqLabel, def.label } }
        end
    end
    return true
end

local function canStartTest(source, licenseType)
    licenseType = tostring(licenseType or '')
    local def = SunsetLicenses.Types[licenseType]
    if not def then return false, { localeKey = 'licenses.message.invalid_license_type' } end
    if TestSessions[source] then return false, { localeKey = 'licenses.message.you_already_have_a_license_test_in_progress' } end
    local ok, err = HasLicense(source, licenseType)
    if ok and err ~= 'test' then
        return false, { localeKey = 'licenses.message.you_already_hold_a_valid_value', formatArgs = { def.label } }
    end
    -- Check prerequisites before allowing exam start (e.g. hunting requires weapon license)
    local prereqOk, prereqErr = checkPrerequisites(source, licenseType)
    if not prereqOk then return false, prereqErr end
    local facility = SunsetLicenses.Facilities[def.facility]
    if not facility or not near(source, facility.marker, (facility.markerRadius or 3.0) + 2.0) then
        return false, { localeKey = 'licenses.message.stand_at_the_value_marker_to_start_this_exam', formatArgs = {
            facility and facility.label or 'license school' } }
    end
    if def.instructorFaction then
        local authorization = AuthorizedTests[source]
        if not authorization or authorization.licenseType ~= licenseType
            or authorization.expiresAt < os.time() then
            AuthorizedTests[source] = nil
            return false, { localeKey = 'licenses.message.an_on_duty_lssi_instructor_must_authorize_your_value', formatArgs = { def.label } }
        end
        local instructor = authorization.instructor
        if not GetPlayerName(instructor) or not isInstructor(instructor) then
            AuthorizedTests[source] = nil
            return false, { localeKey = 'licenses.message.your_lssi_instructor_is_no_longer_available_or_on' }
        end
        local sourcePos, instructorPos = playerCoords(source), playerCoords(instructor)
        if not sourcePos or not instructorPos
            or #(sourcePos - instructorPos) > (SunsetLicenses.InstructorMaxDistance or 12.0)
            or not near(instructor, facility.marker, (facility.markerRadius or 3.0) + 8.0) then
            return false, { localeKey = 'licenses.message.stay_beside_your_lssi_instructor_at_the_exam_facility' }
        end
    end
    return true
end

exports.sunset_core:RegisterCallback('sunset:license:has', function(source, licenseType)
    local ok = HasLicense(source, tostring(licenseType or ''))
    return ok == true
end)

exports.sunset_core:RegisterCallback('sunset:license:getStatus', function(source)
    local cid = charId(source)
    if not cid then return nil, { localeKey = 'licenses.message.character_not_loaded' } end
    return {
        licenses = GetLicenses(source),
        playtimeMinutes = playtimeMinutes(source),
        paydays = currentPaydays(source),
        instructor = isInstructor(source),
        inTest = IsInLicenseTest(source),
    }
end)

exports.sunset_core:RegisterCallback('sunset:license:getExamOffer', function(source, licenseType)
    licenseType = tostring(licenseType or '')
    local def = SunsetLicenses.Types[licenseType]
    if not def then return nil, { localeKey = 'licenses.message.invalid_license_type' } end
    local fee = resolveExamFee(licenseType)
    return {
        licenseType = licenseType,
        label = def.label,
        fee = fee,
        startingCash = tonumber(Sunset.Config and Sunset.Config.StartingCash) or 500,
        theoryTimeSec = tonumber(SunsetLicenses.TheoryTimeSec) or 600,
    }
end)

local StartTheoryBusy, StartTheoryImpl = {}, nil
exports.sunset_core:RegisterCallback('sunset:license:startTheory', function(source, licenseType)
    licenseType = tostring(licenseType or '')
    -- [SEC3] serialise per source: canStartTest -> chargeExamFee yields before TestSessions is set,
    -- so parallel calls double-charged / overwrote the session.
    if StartTheoryBusy[source] then return nil, { localeKey = 'licenses.message.you_already_have_a_license_test_in_progress' } end
    StartTheoryBusy[source] = true
    local okS, r1, r2 = pcall(function() return StartTheoryImpl(source, licenseType) end)
    StartTheoryBusy[source] = nil
    if not okS then error(r1) end
    return r1, r2
end)

StartTheoryImpl = function(source, licenseType)
    local ok, err = canStartTest(source, licenseType)
    if not ok then return nil, err end
    local theory = SunsetLicenses.Theory[licenseType]
    if not theory then return nil, { localeKey = 'licenses.message.no_theory_exam_configured_for_this_license' } end
    local fee = resolveExamFee(licenseType)
    local paid, charged, chargedAccount = chargeExamFee(source, licenseType)
    if not paid then
        return nil, { localeKey = 'licenses.message.exam_fee_is_value_you_need_enough_cash_or', formatArgs = { fee } }
    end
    local def = SunsetLicenses.Types[licenseType]
    local authorization = AuthorizedTests[source]
    local theoryTimeSec = tonumber(SunsetLicenses.TheoryTimeSec) or 600
    TestSessions[source] = {
        licenseType = licenseType,
        phase = 'theory',
        startedAt = os.time(),
        theoryDeadline = os.time() + theoryTimeSec,
        theoryAnswers = {},
        theoryAnswerKey = SunsetLicenseTheoryAnswers and SunsetLicenseTheoryAnswers[licenseType],
        examFee = charged,
        instructor = authorization and authorization.instructor or nil,
        issuerCharacterId = authorization and authorization.issuerCharacterId or nil,
    }
    -- [SESSIONS] mirror into the framework (deadline backstop + diagnostics).
    local examineeCid = charId(source)
    if examineeCid then
        TestSessions[source].frameworkId = createExamFrameworkSession(source, examineeCid, licenseType)
    end
    if def and def.instructorFaction then
        local reportId = type(CreateLicenseExamReport) == 'function'
            and CreateLicenseExamReport(source, TestSessions[source]) or nil
        if not reportId then
            clearTestSession(source)
            AuthorizedTests[source] = nil
            if charged > 0 and chargedAccount then
                exports.sunset_core:AddMoney(source, chargedAccount, charged, 'license_exam_refund')
            end
            return nil, { localeKey = 'licenses.message.the_supervised_exam_audit_record_could_not_be_created' }
        end
    end
    AuthorizedTests[source] = nil
    local payload = sanitizedTheory(theory)
    payload.examFee = charged
    payload.theoryTimeSec = theoryTimeSec
    payload.deadlineAt = TestSessions[source].theoryDeadline
    return payload
end

exports.sunset_core:RegisterCallback('sunset:license:gradeTheoryAnswer', function(source, licenseType, questionIndex, answer)
    licenseType = tostring(licenseType or '')
    questionIndex = tonumber(questionIndex)
    answer = tonumber(answer)
    local session = TestSessions[source]
    if not session or session.licenseType ~= licenseType or session.phase ~= 'theory' then
        return nil, { localeKey = 'licenses.message.no_active_theory_exam' }
    end
    if session.theoryDeadline and os.time() > session.theoryDeadline then
        return nil, { localeKey = 'licenses.message.theory_time_expired' }
    end
    if not questionIndex or answer == nil then return nil, { localeKey = 'licenses.message.invalid_answer' } end
    local theory = SunsetLicenses.Theory[licenseType]
    if not theory or not theory.questions[questionIndex] then return nil, { localeKey = 'licenses.message.invalid_question' } end
    session.theoryAnswers = session.theoryAnswers or {}
    if session.theoryAnswers[questionIndex] ~= nil then
        return nil, { localeKey = 'licenses.message.you_already_answered_this_question' }
    end
    local answerKey = session.theoryAnswerKey
        or (SunsetLicenseTheoryAnswers and SunsetLicenseTheoryAnswers[licenseType])
    local question = theory.questions[questionIndex]
    local expected = tonumber(question and question.serverAnswer) or tonumber(answerKey and answerKey[questionIndex])
    if expected == nil then return nil, { localeKey = 'licenses.message.the_server_answer_key_is_not_configured_for_this' } end
    local correct = tonumber(answer) == expected
    session.theoryAnswers[questionIndex] = answer
    return { correct = correct, questionIndex = questionIndex }
end)

exports.sunset_core:RegisterCallback('sunset:license:submitTheory', function(source, licenseType, answers)
    licenseType = tostring(licenseType or '')
    local session = TestSessions[source]
    if not session or session.licenseType ~= licenseType or session.phase ~= 'theory' then
        return nil, { localeKey = 'licenses.message.no_active_theory_exam_start_again_at_the_school' }
    end
    if session.theoryDeadline and os.time() > session.theoryDeadline then
        if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'failed') end
        clearTestSession(source)
        return nil, { localeKey = 'licenses.message.theory_time_expired_exam_failed' }
    end
    local theory = SunsetLicenses.Theory[licenseType]
    if not theory then return nil, { localeKey = 'licenses.message.invalid_exam' } end
    -- [SEC3] score ONLY the answers recorded server-side by gradeTheoryAnswer. The client-supplied
    -- table used to replace them, so the per-question correct/incorrect feedback could be used
    -- as an oracle and the final submit re-answered with the right options.
    answers = session.theoryAnswers or {}
    local answerKey = session.theoryAnswerKey
        or (SunsetLicenseTheoryAnswers and SunsetLicenseTheoryAnswers[licenseType])
    if not answerKey then return nil, { localeKey = 'licenses.message.the_server_answer_key_is_not_configured_for_this' } end
    local score = 0
    for i, q in ipairs(theory.questions or {}) do
        local expected = tonumber(q.serverAnswer) or tonumber(answerKey[i])
        if tonumber(answers[i] or answers[tostring(i)]) == expected then
            score = score + 1
        end
    end
    local need = tonumber(theory.passScore) or math.ceil(#(theory.questions or {}) * 0.75)
    if type(RecordLicenseTheoryResult) == 'function' then
        RecordLicenseTheoryResult(session, score, #(theory.questions or {}), score >= need)
    end
    if score < need then
        if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'failed') end
        clearTestSession(source)
        return nil, { localeKey = 'licenses.message.theory_failed_value_value_study_the_rules_and_try', formatArgs = { score, #(theory.questions or {}) } }
    end
    session.phase = 'practical'
    session.theoryPassedAt = os.time()
    session.practicalStartedAt = os.time()
    session.lastCheckpoint = 0
    session.allCheckpoints = false
    session.practicalValidatedAt = nil
    local practical = SunsetLicenses.Practical[licenseType]
    local facilityKey = SunsetLicenses.Types[licenseType].facility
    local facility = facilityKey and SunsetLicenses.Facilities[facilityKey]
    local practicalTimeSec = practical and tonumber(practical.maxTimeSec) or 1200
    if session.instructor then
        notify(session.instructor, exports.sunset_core:TFor(session.instructor, 'licenses.msg.candidate_passed_the_theory_test_supervise', { source = math.floor(tonumber(source) or 0), label = tostring(SunsetLicenses.Types[licenseType].label) }), 'success')
    end
    return {
        practical = practical,
        facility = facility,
        licenseType = licenseType,
        examFee = session.examFee or 0,
        practicalTimeSec = practicalTimeSec,
        practicalDeadlineAt = session.practicalStartedAt + practicalTimeSec,
    }
end)

exports.sunset_core:RegisterCallback('sunset:license:abortTest', function(source)
    local session = TestSessions[source]
    if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'aborted') end
    if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(source) end
    clearTestSession(source)
    TriggerClientEvent('sunset:licenses:testAbort', source)
    return true
end)

-- [SESSIONS] Central lifecycle triggers: a downed or jailed examinee cannot
-- continue an exam. Abort exactly like the manual abort path (finalize report,
-- clean entities, release the session). Previously only instructor-disconnect
-- and playerDropped were handled.
local function abortIfInTest(src, reason)
    src = tonumber(src)
    if not src or not TestSessions[src] then return end
    if type(FinalizeLicenseExamReport) == 'function' then
        FinalizeLicenseExamReport(TestSessions[src], 'aborted')
    end
    if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(src) end
    clearTestSession(src, 'FAILED', reason or 'aborted')
    TriggerClientEvent('sunset:licenses:testAbort', src)
    notify(src, exports.sunset_core:TFor(src, 'licenses.msg.your_license_exam_was_cancelled', { reason = tostring(reason) }), 'error')
end

AddEventHandler('sunset:death:playerDowned', function(src)
    abortIfInTest(src, 'you were downed')
end)

AddEventHandler('sunset:faction:playerJailed', function(src)
    abortIfInTest(src, 'you were jailed')
end)

exports.sunset_core:RegisterCallback('sunset:license:completePractical', function(source, licenseType)
    licenseType = tostring(licenseType or '')
    local session = TestSessions[source]
    if not session or session.licenseType ~= licenseType or session.phase ~= 'validated'
        or not session.practicalValidatedAt then
        return nil, { localeKey = 'licenses.message.the_practical_test_has_not_been_validated_by_the' }
    end
    if sessionTimedOut(session) or os.time() - session.practicalValidatedAt > 20 then
        if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'aborted') end
        if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(source) end
        clearTestSession(source)
        return nil, { localeKey = 'licenses.message.the_practical_result_expired_start_the_exam_again' }
    end
    local def = SunsetLicenses.Types[licenseType]
    if def and def.instructorFaction then
        if not session.instructor or not GetPlayerName(session.instructor) or not isInstructor(session.instructor) then
            if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'aborted') end
            if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(source) end
            clearTestSession(source)
            return nil, { localeKey = 'licenses.message.your_lssi_instructor_must_remain_online_and_on_duty' }
        end
    end
    local candidateMistakes = tonumber(session.candidateMistakes) or 0
    local failAt = tonumber(SunsetLicenses.CandidateFailMistakes) or 3.0
    if def and def.instructorFaction and candidateMistakes >= failAt then
        if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(source) end
        if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'failed') end
        clearTestSession(source)
        notify(session.instructor, exports.sunset_core:TFor(session.instructor, 'licenses.msg.candidate_failed_the_practical_with_recorded', { source = math.floor(tonumber(source) or 0), candidate_mistakes = string.format('%.1f', candidateMistakes), fail_at = string.format('%.1f', failAt) }), 'warning')
        return nil, { localeKey = 'licenses.message.practical_failed_the_instructor_recorded_value_value_mistakes_ask', formatArgs = {
            candidateMistakes, failAt } }
    end
    if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(source) end
    clearTestSession(source)
    local issuer = session.issuerCharacterId
    local ok, err = GrantLicense(source, licenseType, issuer)
    if not ok then
        if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'aborted') end
        return nil, err
    end
    if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'passed') end
    TriggerClientEvent('sunset:licenses:testComplete', source, licenseType)
    return { licenseType = licenseType }
end)

AddEventHandler('sunset:payday:processed', function(source)
    local cid = charId(source)
    if not cid then return end
    local paydays = currentPaydays(source)
    local rows = loadLicenseRows(cid)
    for _, row in ipairs(rows) do
        local exp = tonumber(row.expires_at_payday)
        if exp and paydays >= exp then
            MySQL.update.await(
                'DELETE FROM character_licenses WHERE character_id = ? AND license_type = ?',
                { cid, row.license_type }
            )
            local def = SunsetLicenses.Types[row.license_type]
            notify(source, exports.sunset_core:TFor(source, 'licenses.msg.your_expired_after_paydays', { def = tostring(def and def.label or row.license_type), payday_expiry = math.floor(tonumber(SunsetLicenses.PaydayExpiry or 150) or 0) }), 'warning')
            TriggerClientEvent('sunset:licenses:refresh', source)
            loadLicenseCache(source)
        end
    end
end)

AddEventHandler('playerDropped', function()
    local droppedSource = source
    local session = TestSessions[source]
    if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(session, 'aborted') end
    if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(source) end
    clearTestSession(source)
    AuthorizedTests[source] = nil
    ServerLicenseCache[source] = nil
    LastWeaponWarning[source] = nil
    LicenseForceReload[source] = nil
    for target, authorization in pairs(AuthorizedTests) do
        if authorization.instructor == droppedSource then AuthorizedTests[target] = nil end
    end
    for target, activeSession in pairs(TestSessions) do
        if activeSession.instructor == droppedSource then
            if type(FinalizeLicenseExamReport) == 'function' then FinalizeLicenseExamReport(activeSession, 'aborted') end
            if type(CleanupLicenseTestEntities) == 'function' then CleanupLicenseTestEntities(target) end
            clearTestSession(target, 'FAILED', 'instructor disconnected')
            notify(target, exports.sunset_core:TFor(target, 'licenses.msg.your_lssi_exam_ended_because_the'), 'error')
            TriggerClientEvent('sunset:licenses:testAbort', target)
        end
    end
end)

function RunInstructorLicenseCommand(source, args)
    if source == 0 then
        print('[sunset_licenses] /issuelicense must be used in game by an LSSI instructor. Admins can use /agivelicense.')
        return true
    end
    if not isInstructor(source) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.lssi_instructors_on_duty_only'), 'error')
        return true
    end
    local target = tonumber(args[1])
    local licenseType = string.lower(tostring(args[2] or ''))
    if not target or not GetPlayerName(target) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_issuelicense_player_id_pilot_boat'), 'error')
        return true
    end
    local def = SunsetLicenses.Types[licenseType]
    if not def or not def.instructorFaction then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.lssi_may_conduct_tests_for_pilot'), 'error')
        return true
    end
    if target == source then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.you_cannot_conduct_your_own_license'), 'error')
        return true
    end
    local facility = SunsetLicenses.Facilities[def.facility]
    local instructorPos, targetPos = playerCoords(source), playerCoords(target)
    if not instructorPos or not targetPos
        or #(instructorPos - targetPos) > (SunsetLicenses.InstructorMaxDistance or 12.0) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.the_candidate_must_be_beside_you'), 'error')
        return true
    end
    if not facility or not near(source, facility.marker, (facility.markerRadius or 3.0) + 8.0)
        or not near(target, facility.marker, (facility.markerRadius or 3.0) + 8.0) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.you_and_the_candidate_must_be', { facility = facility and facility.label or exports.sunset_core:TFor(source, 'licenses.word.the_exam_facility') }), 'error')
        return true
    end
    local has, hasErr = HasLicense(target, licenseType)
    if has and hasErr ~= 'test' then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.player_already_has_a_valid', { target = math.floor(tonumber(target) or 0), label = tostring(def.label) }), 'error')
        return true
    end
    AuthorizedTests[target] = {
        licenseType = licenseType,
        instructor = source,
        issuerCharacterId = charId(source),
        expiresAt = os.time() + (SunsetLicenses.InstructorAuthorizationSeconds or 300),
    }
    notify(source, exports.sunset_core:TFor(source, 'licenses.msg.authorized_exam_for_player_they_must', { label = tostring(def.label), target = math.floor(tonumber(target) or 0) }), 'success')
    notify(target, exports.sunset_core:TFor(target, 'licenses.msg.lssi_instructor_authorized_your_exam_press', { source = math.floor(tonumber(source) or 0), label = tostring(def.label) }), 'success')
    return true
end

RegisterCommand('issuelicense', function(source, args)
    RunInstructorLicenseCommand(source, args or {})
end, false)

-- [SEC3] tests.lua called clearTestSession (a main.lua local => nil global => error on hunting auto-fail,
-- leaving the exam session alive). Expose it as a global used by the sibling file.
function ClearLicenseTestSession(source, fwState, fwReason) clearTestSession(source, fwState, fwReason) end

-- Used by tests.lua server validation
function GetTestSession(source)
    return TestSessions[source]
end
