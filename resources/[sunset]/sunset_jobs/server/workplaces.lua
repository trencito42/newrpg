-- sunset_jobs · server/workplaces.lua
-- Server-authoritative workplace NPC handler: employment status, applications, licensing, shift state, and resignation.

-- [SECTIONS 2-3] Proper human-readable labels for each license type.
-- SunsetLicenses is defined in sunset_licenses/shared/config.lua which is not
-- loaded in this resource's context, so we maintain a local copy here.
-- Keep in sync with sunset_licenses/shared/config.lua SunsetLicenses.Types.
local LicenseLabels = {
    driver  = 'Driving License',
    pilot   = 'Pilot License',
    boat    = 'Boat License',
    weapon  = 'Firearm License',
    hunting = 'Hunting License',
}

local function getCharacterData(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'jobs.message.character_not_loaded' } end
    return char
end

local function checkRequirements(source, char, reqs)
    if not reqs then return true end

    -- 1. Level check
    if reqs.minLevel and reqs.minLevel > 1 then
        local playerLevel = tonumber(char.level) or 1
        if playerLevel < reqs.minLevel then
            return false, { localeKey = 'jobs.message.requires_character_level_value_you_are_level_value', formatArgs = { reqs.minLevel, playerLevel } }
        end
    end

    -- 2. License check — FAIL CLOSED: if the license resource is unavailable
    -- and this job explicitly declares license requirements, deny access rather
    -- than silently treating the missing check as "licensed". This prevents
    -- bypassing the Hunting / Weapon license gate during resource restarts.
    -- [SECTIONS 2-3] Check ALL required licenses and report EACH missing one by
    -- its proper label (from SunsetLicenses.Types) rather than the raw key.
    -- This gives players actionable information: "Missing: Firearm License, Hunting License"
    -- instead of the generic "[Missing License]".
    if reqs.licenses and #reqs.licenses > 0 then
        if GetResourceState('sunset_licenses') ~= 'started' then
            return false, { localeKey = 'jobs.message.licensing_service_unavailable_try_again_in_a_moment' }
        end
        local missing = {}
        for _, lic in ipairs(reqs.licenses) do
            local ok, res = pcall(function()
                return exports.sunset_licenses:HasLicense(source, lic)
            end)
            local hasLic = (ok and res == true)
            if not hasLic then
                -- Use the proper label from SunsetLicenses.Types if available,
                -- fall back to capitalizing the raw key.
                -- Prefer the local label table; fall back to capitalizing the raw key.
                local licLabel = LicenseLabels[lic] or (lic:sub(1,1):upper() .. lic:sub(2))
                missing[#missing + 1] = licLabel
            end
        end
        if #missing > 0 then
            if #missing == 1 then
                return false, { localeKey = 'jobs.message.requires_a_valid_value_visit_the_dmv_lssi_office', formatArgs = { missing[1] } }
            else
                return false, { localeKey = 'jobs.message.missing_licenses_value_visit_the_dmv_lssi_office', formatArgs = {
                    table.concat(missing, ', ')
                } }
            end
        end
    end

    return true
end

-- [JOBS AUDIT] Shared with hireCivilianJob (main.lua) and the trucker auto-hire: those paths used to
-- grant licence-gated jobs (driver / hunting+weapon) without ever calling checkRequirements.
function SunsetJobs_CheckRequirements(source, jobId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false, { localeKey = 'jobs.message.character_not_loaded' } end
    local wp = Sunset.JobWorkplaces and Sunset.JobWorkplaces[tostring(jobId or ''):lower()]
    if not wp then return true end
    return checkRequirements(source, char, wp.requirements)
end

local function isPlayerNearCoords(source, targetCoords, maxDist)
    if not targetCoords then return true end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local playerCoords = GetEntityCoords(ped)
    local tPos = vector3(targetCoords.x, targetCoords.y, targetCoords.z)
    return #(playerCoords - tPos) <= (maxDist or 12.0)
end

-- ── 1. Fetch State for Workplace NPC ──────────────────────────

exports.sunset_core:RegisterCallback('sunset:jobs:getWorkplaceState', function(source, jobId)
    local char, err = getCharacterData(source)
    if not char then return nil, err end

    jobId = tostring(jobId or ''):lower()
    local workplace = Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId]
    if not workplace then return nil, { localeKey = 'jobs.message.unknown_workplace' } end

    local currentJob = select(1, Sunset.GetCharacterJob(char))
    local isEmployed = (currentJob == jobId)

    local isShiftActive = false
    if SunsetJobs_GetSession then
        local sess = SunsetJobs_GetSession(source)
        if sess and sess.jobId == jobId and sess.state ~= 'IDLE' and sess.state ~= 'COMPLETED' and sess.state ~= 'CANCELLED' then
            isShiftActive = true
        end
    end

    local reqOk, reqReason = checkRequirements(source, char, workplace.requirements)

    return {
        jobId = jobId,
        jobLabel = workplace.jobLabel or jobId,
        currentJob = currentJob or 'unemployed',
        isEmployed = isEmployed,
        onShift = isShiftActive,
        requirementsMet = reqOk,
        requirementError = reqReason,
        salary = (Sunset.CivilianJobs and Sunset.CivilianJobs[jobId] and Sunset.CivilianJobs[jobId].grades and Sunset.CivilianJobs[jobId].grades[0] and Sunset.CivilianJobs[jobId].grades[0].salary) or 0,
        actions = workplace.actions or {},
        guide = workplace.guide,
    }
end)

-- ── 2. Apply for Job at Workplace NPC ─────────────────────────

local function applyAtWorkplace(source, jobId)
    local char, err = getCharacterData(source)
    if not char then return false, err end

    jobId = tostring(jobId or ''):lower()
    local workplace = Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId]
    if not workplace then return false, { localeKey = 'jobs.message.unknown_workplace_job' } end

    -- Verify proximity to workplace NPC (anti-remote exploit)
    if workplace.npc and workplace.npc.coords then
        if not isPlayerNearCoords(source, workplace.npc.coords, 12.0) then
            return false, { localeKey = 'jobs.message.you_must_speak_with_the_workplace_supervisor_in_person' }
        end
    end

    -- Verify requirements
    local reqOk, reqReason = checkRequirements(source, char, workplace.requirements)
    if not reqOk then
        return false, reqReason or exports.sunset_core:TFor(source, 'jobs.err.you_do_not_meet_the_job')
    end

    local currentJob = select(1, Sunset.GetCharacterJob(char))
    if currentJob == jobId then
        return false, { localeKey = 'jobs.message.you_are_already_employed_as_value', formatArgs = { workplace.jobLabel or jobId } }
    end

    -- If switching from another civilian job, clean active shift
    if currentJob and currentJob ~= 'unemployed' then
        if SunsetJobs_ClearSession then
            SunsetJobs_ClearSession(source, 'CANCELLED', 'Switched employment at workplace')
        end
        TriggerClientEvent('sunset:jobs:forceClearHud', source)
        local prevDef = Sunset.CivilianJobs and Sunset.CivilianJobs[currentJob]
        exports.sunset_core:CommandReply(source, exports.sunset_core:TFor(source, 'jobs.msg.resigned_from_previous_job', { prev_def = tostring(prevDef and prevDef.label or currentJob) }), 'info')
    end

    local setOk = exports.sunset_core:SetJob(source, jobId, 0)
    if not setOk then
        return false, { localeKey = 'jobs.message.could_not_update_your_employment_record_please_try_again' }
    end

    local hiredLabel = workplace.jobLabel or (Sunset.CivilianJobs[jobId] and Sunset.CivilianJobs[jobId].label) or jobId
    exports.sunset_core:CommandReply(source, exports.sunset_core:TFor(source, 'jobs.msg.hired_as_speak_to_the_supervisor', { hired_label = tostring(hiredLabel) }), 'success')

    -- Quest progress trigger
    TriggerEvent('sunset:quest:progress', char.id, 'job_hired', 1, { jobId = jobId })

    return true
end

exports.sunset_core:RegisterCallback('sunset:jobs:workplaceApply', function(source, jobId)
    return applyAtWorkplace(source, jobId)
end)

-- ── 3. Resign / Quit Job at Workplace NPC ─────────────────────

local function quitAtWorkplace(source, jobId)
    local char, err = getCharacterData(source)
    if not char then return false, err end

    jobId = tostring(jobId or ''):lower()
    local currentJob = select(1, Sunset.GetCharacterJob(char))
    if currentJob ~= jobId then
        return false, { localeKey = 'jobs.message.you_are_not_employed_at_this_workplace' }
    end

    if SunsetJobs_ClearSession then
        SunsetJobs_ClearSession(source, 'CANCELLED', 'Resigned at workplace NPC')
    end
    TriggerClientEvent('sunset:jobs:forceClearHud', source)

    local setOk = exports.sunset_core:SetJob(source, 'unemployed', 0)
    if not setOk then
        return false, { localeKey = 'jobs.message.could_not_resign_please_try_again' }
    end

    local label = (Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId] and Sunset.JobWorkplaces[jobId].jobLabel) or jobId
    exports.sunset_core:CommandReply(source, exports.sunset_core:TFor(source, 'jobs.msg.you_have_resigned_as', { label = tostring(label) }), 'info')
    return true
end

exports.sunset_core:RegisterCallback('sunset:jobs:workplaceQuit', function(source, jobId)
    return quitAtWorkplace(source, jobId)
end)

-- ── 4. Cancel / Stop Active Shift ─────────────────────────────

exports.sunset_core:RegisterCallback('sunset:jobs:workplaceStopShift', function(source, jobId)
    local char, err = getCharacterData(source)
    if not char then return false, err end

    if SunsetJobs_ClearSession then
        SunsetJobs_ClearSession(source, 'CANCELLED', 'Shift ended at workplace NPC')
    end
    TriggerClientEvent('sunset:jobs:forceClearHud', source)
    return true
end)
