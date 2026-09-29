-- sunset_jobs · server/workplaces.lua
-- Server-authoritative workplace NPC handler: employment status, applications, licensing, shift state, and resignation.

local function getCharacterData(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, 'Character not loaded' end
    return char
end

local function checkRequirements(source, char, reqs)
    if not reqs then return true end

    -- 1. Level check
    if reqs.minLevel and reqs.minLevel > 1 then
        local playerLevel = tonumber(char.level) or 1
        if playerLevel < reqs.minLevel then
            return false, ('Requires Character Level %d (You are Level %d)'):format(reqs.minLevel, playerLevel)
        end
    end

    -- 2. License check — FAIL CLOSED: if the license resource is unavailable
    -- and this job explicitly declares license requirements, deny access rather
    -- than silently treating the missing check as "licensed". This prevents
    -- bypassing the Hunting / Weapon license gate during resource restarts.
    if reqs.licenses and #reqs.licenses > 0 then
        for _, lic in ipairs(reqs.licenses) do
            local hasLic = false
            if GetResourceState('sunset_licenses') == 'started' then
                local ok, res = pcall(function()
                    return exports.sunset_licenses:HasLicense(source, lic)
                end)
                hasLic = (ok and res == true)
            else
                -- Licensing service is down — deny rather than permit unlicensed access.
                return false, 'Licensing service unavailable. Try again in a moment.'
            end

            if not hasLic then
                local licLabel = lic:gsub('^%l', string.upper)
                return false, ('Requires a valid %s License. Visit the DMV / LSSI Office.'):format(licLabel)
            end
        end
    end

    return true
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
    if not workplace then return nil, 'Unknown workplace' end

    local currentJob = select(1, Sunset.GetCharacterJob(char))
    local isEmployed = (currentJob == jobId)

    local isShiftActive = false
    if SunsetJobs_GetSession then
        local sess = SunsetJobs_GetSession(source)
        if sess and sess.job == jobId and sess.state ~= 'IDLE' and sess.state ~= 'COMPLETED' and sess.state ~= 'CANCELLED' then
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
    if not workplace then return false, 'Unknown workplace job' end

    -- Verify proximity to workplace NPC (anti-remote exploit)
    if workplace.npc and workplace.npc.coords then
        if not isPlayerNearCoords(source, workplace.npc.coords, 12.0) then
            return false, 'You must speak with the workplace supervisor in person.'
        end
    end

    -- Verify requirements
    local reqOk, reqReason = checkRequirements(source, char, workplace.requirements)
    if not reqOk then
        return false, reqReason or 'You do not meet the job requirements.'
    end

    local currentJob = select(1, Sunset.GetCharacterJob(char))
    if currentJob == jobId then
        return false, ('You are already employed as %s.'):format(workplace.jobLabel or jobId)
    end

    -- If switching from another civilian job, clean active shift
    if currentJob and currentJob ~= 'unemployed' then
        if SunsetJobs_ClearSession then
            SunsetJobs_ClearSession(source, 'CANCELLED', 'Switched employment at workplace')
        end
        TriggerClientEvent('sunset:jobs:forceClearHud', source)
        local prevDef = Sunset.CivilianJobs and Sunset.CivilianJobs[currentJob]
        exports.sunset_core:CommandReply(source, ('Resigned from previous job: %s.'):format(prevDef and prevDef.label or currentJob), 'info')
    end

    local setOk = exports.sunset_core:SetJob(source, jobId, 0)
    if not setOk then
        return false, 'Could not update your employment record. Please try again.'
    end

    local hiredLabel = workplace.jobLabel or (Sunset.CivilianJobs[jobId] and Sunset.CivilianJobs[jobId].label) or jobId
    exports.sunset_core:CommandReply(source, ('Hired as %s! Speak to the supervisor or check your guide to begin.'):format(hiredLabel), 'success')

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
        return false, 'You are not employed at this workplace.'
    end

    if SunsetJobs_ClearSession then
        SunsetJobs_ClearSession(source, 'CANCELLED', 'Resigned at workplace NPC')
    end
    TriggerClientEvent('sunset:jobs:forceClearHud', source)

    local setOk = exports.sunset_core:SetJob(source, 'unemployed', 0)
    if not setOk then
        return false, 'Could not resign — please try again.'
    end

    local label = (Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId] and Sunset.JobWorkplaces[jobId].jobLabel) or jobId
    exports.sunset_core:CommandReply(source, ('You have resigned as %s.'):format(label), 'info')
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
