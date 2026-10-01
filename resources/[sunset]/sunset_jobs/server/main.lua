local function buildJobCenterJobs(center, source)
    local jobs = {}
    local seen = {}
    local currentJob = nil
    if source then
        local char = exports.sunset_core:GetCharacter(source)
        if char then
            currentJob = select(1, Sunset.GetCharacterJob(char))
        end
    end

    local function add(job)
        if not job or not job.id or seen[job.id] then return end
        seen[job.id] = true
        job.isCurrent = (currentJob == job.id)
        jobs[#jobs + 1] = job
    end

    -- The classic civilian jobs are the only authoritative job catalogue.
    for jobId, def in pairs(Sunset.CivilianJobs or {}) do
        if jobId ~= 'unemployed' and (def.type == 'civilian' or not def.type) and not seen[jobId] then
            local wp = Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId]
            local coords = (wp and wp.npc and wp.npc.coords and { x = wp.npc.coords.x, y = wp.npc.coords.y, z = wp.npc.coords.z }) or def.npcCoords
            add({
                id = jobId,
                label = (wp and wp.jobLabel) or def.label or jobId,
                description = (wp and wp.description) or def.description or '',
                salary = def.grades and def.grades[0] and def.grades[0].salary,
                locationLabel = wp and wp.locationLabel or 'San Andreas',
                address = wp and wp.address or '',
                supervisorName = wp and wp.npc and wp.npc.name or 'Supervisor',
                hasPhysicalWorkplace = (wp ~= nil),
                npcCoords = coords,
            })
        end
    end

    -- Any extra jobs explicitly listed in the center's jobs array
    for _, j in ipairs(center.jobs or {}) do
        if j.id == 'unemployed' or seen[j.id] then goto continue end
        local def = Sunset.CivilianJobs[j.id]
        if def and def.type == 'civilian' then
            local wp = Sunset.JobWorkplaces and Sunset.JobWorkplaces[j.id]
            local coords = (wp and wp.npc and wp.npc.coords and { x = wp.npc.coords.x, y = wp.npc.coords.y, z = wp.npc.coords.z }) or def.npcCoords
            add({
                id = j.id,
                label = j.label or (wp and wp.jobLabel) or def.label or j.id,
                description = (wp and wp.description) or def.description or '',
                salary = def.grades and def.grades[0] and def.grades[0].salary,
                locationLabel = wp and wp.locationLabel or 'San Andreas',
                address = wp and wp.address or '',
                supervisorName = wp and wp.npc and wp.npc.name or 'Supervisor',
                hasPhysicalWorkplace = (wp ~= nil),
                npcCoords = coords,
            })
        end
        ::continue::
    end

    table.sort(jobs, function(a, b)
        if a.id == 'unemployed' then return true end
        if b.id == 'unemployed' then return false end
        return a.label < b.label
    end)
    return jobs
end

local function quitCivilianJob(source, reason)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'jobs.message.your_character_is_not_loaded_reconnect_and_select_it' } end

    local currentJob = select(1, Sunset.GetCharacterJob(char))
    if not currentJob or currentJob == 'unemployed' then
        return nil, { localeKey = 'jobs.message.you_do_not_have_a_civilian_job_to_quit' }
    end

    if SunsetJobs_ClearSession then
        SunsetJobs_ClearSession(source, 'CANCELLED', reason or 'Civilian job resigned')
    end
    TriggerClientEvent('sunset:jobs:forceClearHud', source)
    if not exports.sunset_core:SetJob(source, 'unemployed', 0) then
        return nil, { localeKey = 'jobs.message.could_not_clear_your_civilian_job_try_again_after' }
    end
    exports.sunset_core:CommandReply(source,
        exports.sunset_core:TFor(source, 'jobs.msg.civilian_job_resigned_your_faction_membershi'), 'success')
    return true
end

exports.sunset_core:RegisterCallback('sunset:jobs:getJobCenterJobs', function(source, centerId)
    local center = Sunset.JobCenters and Sunset.JobCenters[centerId]
    if not center then return nil, { localeKey = 'jobs.message.unknown_employment_office' } end
    return buildJobCenterJobs(center, source)
end)

local function hireCivilianJob(source, jobId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then
        print(('[sunset:hireJob] FAIL src=%s jobId=%s reason=character_not_loaded'):format(source, tostring(jobId)))
        return nil, { localeKey = 'jobs.message.your_character_is_not_loaded_reconnect_and_select_it' }
    end

    jobId = tostring(jobId or ''):lower()
    local currentJob = select(1, Sunset.GetCharacterJob(char))
    print(('[sunset:hireJob] src=%s job=%s current=%s charId=%s'):format(
        source, tostring(jobId), tostring(currentJob), tostring(char.id)))

    if not (Sunset.CivilianJobs and Sunset.CivilianJobs[jobId]) then
        return nil, { localeKey = 'jobs.message.that_is_not_a_valid_civilian_job_factions_require' }
    end

    if jobId == 'unemployed' then
        return quitCivilianJob(source, 'Resigned at Employment Office')
    end

    -- If this job has a physical workplace, direct hiring via employment office is disabled.
    local wp = Sunset.JobWorkplaces and Sunset.JobWorkplaces[jobId]
    if wp then
        local ped = GetPlayerPed(source)
        local playerCoords = ped and ped ~= 0 and GetEntityCoords(ped)
        local npcCoords = wp.npc and wp.npc.coords and vector3(wp.npc.coords.x, wp.npc.coords.y, wp.npc.coords.z)
        local dist = (playerCoords and npcCoords) and #(playerCoords - npcCoords) or 999.0

        if dist > 12.0 then
            return nil, exports.sunset_core:TFor(source, 'jobs.err.requires_in_person_application_at_use', { job_label = tostring(wp.jobLabel or jobId), location_label = wp.locationLabel or exports.sunset_core:TFor(source, 'jobs.word.its_workplace'), npc = wp.npc and wp.npc.name or exports.sunset_core:TFor(source, 'jobs.word.supervisor') })
        end
    end

    if currentJob == jobId then
        local label = Sunset.CivilianJobs[jobId] and Sunset.CivilianJobs[jobId].label or jobId
        return nil, { localeKey = 'jobs.message.you_already_work_as_value', formatArgs = { label } }
    end

    -- [JOBS AUDIT] licence/level requirements were only enforced by the workplace NPC apply path.
    if SunsetJobs_CheckRequirements then
        local reqOk, reqErr = SunsetJobs_CheckRequirements(source, jobId)
        if not reqOk then return nil, reqErr or exports.sunset_core:TFor(source, 'jobs.err.you_do_not_meet_the_job') end
    end

    if currentJob ~= 'unemployed' then
        if SunsetJobs_ClearSession then
            SunsetJobs_ClearSession(source, 'CANCELLED', 'Changed civilian job')
        end
        TriggerClientEvent('sunset:jobs:forceClearHud', source)
        local current = Sunset.CivilianJobs[currentJob]
        exports.sunset_core:CommandReply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.left', { current = tostring(current and current.label or currentJob) }), 'info')
    end

    local setOk = exports.sunset_core:SetJob(source, jobId, 0)
    if not setOk then
        print(('[sunset:hireJob] FAIL src=%s jobId=%s reason=set_job_failed'):format(source, tostring(jobId)))
        return nil, { localeKey = 'jobs.message.could_not_assign_the_job_try_reconnecting_or_contact' }
    end
    print(('[sunset:hireJob] OK src=%s jobId=%s'):format(source, tostring(jobId)))

    local hiredLabel = Sunset.CivilianJobs[jobId] and Sunset.CivilianJobs[jobId].label or jobId
    exports.sunset_core:CommandReply(source,
        exports.sunset_core:TFor(source, 'jobs.msg.hired_as_speak_to_your_supervisor', { hired_label = tostring(hiredLabel) }), 'success')
    TriggerClientEvent('sunset:jobs:waypointToWork', source, jobId)
    TriggerEvent('sunset:quest:progress', char.id, 'job_hired', 1, { jobId = jobId })
    return true
end

-- Cross-resource exports only return the first Lua value; pack ok/err for callers.
exports('HireCivilianJob', function(source, jobId)
    local ok, err = hireCivilianJob(source, jobId)
    return { ok = ok == true, err = err }
end)

exports.sunset_core:RegisterCallback('sunset:hireJob', function(source, jobId)
    return hireCivilianJob(source, jobId)
end)

exports.sunset_core:RegisterCallback('sunset:quitCivilianJob', function(source)
    return quitCivilianJob(source, 'Civilian job resigned')
end)

local function reply(source, message, kind)
    if source == 0 then
        print(message)
        return
    end
    exports.sunset_core:CommandReply(source, message, kind or 'info')
end

local function requireAdmin(source, cmd)
    if source == 0 then return true end
    if exports.sunset_admin:IsAdmin(source, 3) then return true end
    exports.sunset_core:CommandDenyAdmin(source, cmd)
    return false
end

local function resolvePlayer(source, arg)
    local target = tonumber(arg)
    if target and GetPlayerName(target) then return target end

    local account = MySQL.single.await('SELECT id, username FROM accounts WHERE LOWER(username) = LOWER(?)', { arg })
    if not account then return nil end

    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local player = exports.sunset_core:GetPlayer(src)
        if player and player.account_id == account.id then return src end
    end
    return nil
end

local function listCivilianJobs()
    return exports.sunset_core:CommandListKeys(Sunset.CivilianJobs, 12)
end

local function listFactions()
    return exports.sunset_core:CommandListKeys(Sunset.Factions, 12)
end

local function runSetJob(source, args)
    if not requireAdmin(source, 'setjob') then return end

    local targetArg = args[1]
    local jobId = args[2] and string.lower(args[2]) or nil
    local grade = tonumber(args[3]) or 0
    if not targetArg or not jobId then
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.usage_setjob_server_id_username_job', { list_civilian_jobs = tostring(listCivilianJobs()) }),
            'error')
        return
    end

    local target = resolvePlayer(source, targetArg)
    if not target then
        exports.sunset_core:CommandPlayerNotFound(source, targetArg)
        return
    end

    if not exports.sunset_core:GetCharacter(target) then
        exports.sunset_core:CommandNoCharacter(source, target)
        return
    end

    if Sunset.Factions[jobId] then
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.is_a_faction_not_a_civilian', { job_id = tostring(jobId), target_arg = tostring(targetArg), job_id_2 = tostring(jobId) }),
            'error')
        return
    end

    if not Sunset.CivilianJobs[jobId] then
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.unknown_civilian_job_valid_jobs', { job_id = tostring(jobId), list_civilian_jobs = tostring(listCivilianJobs()) }),
            'error')
        return
    end

    if not exports.sunset_core:SetJob(target, jobId, grade) then
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.grade_is_invalid_for_most_civilian', { grade = math.floor(tonumber(grade) or 0), job_id = tostring(jobId) }),
            'error')
        return
    end

    local label = Sunset.CivilianJobs[jobId] and Sunset.CivilianJobs[jobId].label or jobId
    reply(target, exports.sunset_core:TFor(target, 'jobs.msg.your_civilian_job_was_set_to', { label = tostring(label) }), 'success')
    if source ~= 0 then
        reply(source, exports.sunset_core:TFor(source, 'jobs.msg.set_civilian_job_to_grade', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'jobs.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0), label = tostring(label), grade = math.floor(tonumber(grade) or 0) }), 'success')
    end
end

local function runSetFaction(source, args)
    if not requireAdmin(source, 'setfaction') then return end

    local targetArg = args[1]
    local factionId = args[2] and string.lower(args[2]) or nil
    local grade = tonumber(args[3]) or 0
    if not targetArg or not factionId then
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.usage_setfaction_server_id_username_faction', { list_factions = tostring(listFactions()) }),
            'error')
        return
    end

    local target = resolvePlayer(source, targetArg)
    if not target then
        exports.sunset_core:CommandPlayerNotFound(source, targetArg)
        return
    end

    if not exports.sunset_core:GetCharacter(target) then
        exports.sunset_core:CommandNoCharacter(source, target)
        return
    end

    if factionId == 'none' or factionId == 'clear' then
        exports.sunset_core:SetFaction(target, nil, 0)
        reply(target, exports.sunset_core:TFor(target, 'jobs.msg.your_faction_membership_was_cleared'), 'success')
        if source ~= 0 then
            reply(source, exports.sunset_core:TFor(source, 'jobs.msg.cleared_faction_for', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'jobs.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0) }), 'success')
        end
        return
    end

    if not Sunset.Factions[factionId] then
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.unknown_faction_valid_factions', { faction_id = tostring(factionId), list_factions = tostring(listFactions()) }),
            'error')
        return
    end

    if not exports.sunset_core:SetFaction(target, factionId, grade) then
        local faction = Sunset.Factions[factionId]
        reply(source,
            exports.sunset_core:TFor(source, 'jobs.msg.grade_does_not_exist_for_check', { grade = math.floor(tonumber(grade) or 0), faction = tostring(faction and faction.label or factionId) }),
            'error')
        return
    end

    local label = Sunset.Factions[factionId].label
    reply(target, exports.sunset_core:TFor(target, 'jobs.msg.your_faction_was_set_to', { label = tostring(label) }), 'success')
    if source ~= 0 then
        reply(source, exports.sunset_core:TFor(source, 'jobs.msg.set_faction_to_grade', { player_display_name = exports.sunset_core:GetPlayerDisplayName(target) or exports.sunset_core:TFor(source, 'jobs.msg.player', { target = math.floor(tonumber(target) or 0) }), target = math.floor(tonumber(target) or 0), label = tostring(label), grade = math.floor(tonumber(grade) or 0) }), 'success')
    end
end

RegisterCommand('setjob', function(source, args) runSetJob(source, args) end, false)
RegisterCommand('setfaction', function(source, args) runSetFaction(source, args) end, false)

function ExecutePlayerCommand(source, name, args)
    name = string.lower(tostring(name or ''))
    if name == 'setjob' then runSetJob(source, args or {}) return true end
    if name == 'setfaction' then runSetFaction(source, args or {}) return true end
    return false
end

exports('ExecutePlayerCommand', ExecutePlayerCommand)
