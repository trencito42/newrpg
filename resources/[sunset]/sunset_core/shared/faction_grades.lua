Sunset = Sunset or {}

local function mergePerms(...)
    local out = {}
    for i = 1, select('#', ...) do
        local row = select(i, ...)
        if type(row) == 'table' then
            for key, value in pairs(row) do
                out[key] = value
            end
        end
    end
    return out
end

local function legalSalaryBoost(grade)
    grade = tonumber(grade) or 0
    if grade <= 4 then return 1.10 end
    return 1.05
end

function Sunset.BuildLawEnforcementGrades(salaryScale)
    salaryScale = tonumber(salaryScale) or 1.0
    local function pay(base, grade)
        return math.floor(base * salaryScale * legalSalaryBoost(grade))
    end

    local base = { cuff = true, uncuff = true, escort = true, frisk = true, members = true }
    local cite = { ticket = true, fine = true }
    local patrol = { wanted_limited = true, mdc = true, megaphone = true }
    local full = {
        wanted = true, arrest = true, clear_wanted = true, backup = true, radar = true,
        confiscate = true, vehicle_detain = true,
    }
    local command = { invite = true, giverank = true, fmotd = true, fwarn = true, uninvite = true }
    local chief = { promote = true }

    return {
        [0] = { labelKey = "config.core.label.cadet.804cc452", label = 'Cadet', salary = pay(380, 0), perms = mergePerms(base, cite) },
        [1] = { labelKey = "config.core.label.officer_i.42f6ea59", label = 'Officer I', salary = pay(480, 1), perms = mergePerms(base, cite, { mdc = true }) },
        [2] = { labelKey = "config.core.label.officer_ii.5871cd84", label = 'Officer II', salary = pay(560, 2), perms = mergePerms(base, cite, patrol) },
        [3] = { labelKey = "config.core.label.sergeant.2dc0c5cf", label = 'Sergeant', salary = pay(680, 3), perms = mergePerms(base, cite, patrol, full) },
        [4] = { labelKey = "config.core.label.lieutenant.6269b290", label = 'Lieutenant', salary = pay(820, 4), perms = mergePerms(base, cite, patrol, full) },
        [5] = { labelKey = "config.core.label.captain.0ab1c0c7", label = 'Captain', salary = pay(960, 5), perms = mergePerms(base, cite, patrol, full) },
        [6] = { labelKey = "config.core.label.deputy_chief.a5ec3744", label = 'Deputy Chief', salary = pay(1120, 6), perms = mergePerms(base, cite, patrol, full, command) },
        [7] = { labelKey = "config.core.label.chief.0ece8d19", label = 'Chief', salary = pay(1280, 7), perms = mergePerms(base, cite, patrol, full, command, chief) },
    }
end

function Sunset.BuildEmsGrades()
    local heal = { stabilize = true, heal = true, revive = true }
    local lead = { invite = true, giverank = true, fmotd = true, fwarn = true, uninvite = true }
    return {
        [0] = { labelKey = "config.core.label.trainee.70a57b8b", label = 'Trainee', salary = math.floor(320 * legalSalaryBoost(0)), perms = { stabilize = true, members = true } },
        [1] = { labelKey = "config.core.label.emt.d381ab99", label = 'EMT', salary = math.floor(420 * legalSalaryBoost(1)), perms = { stabilize = true, heal = true, members = true } },
        [2] = { labelKey = "config.core.label.paramedic.e7359be0", label = 'Paramedic', salary = math.floor(520 * legalSalaryBoost(2)), perms = mergePerms(heal, { members = true }) },
        [3] = { labelKey = "config.core.label.senior_paramedic.4323c4d2", label = 'Senior Paramedic', salary = math.floor(620 * legalSalaryBoost(3)), perms = mergePerms(heal, { members = true }) },
        [4] = { labelKey = "config.core.label.doctor.a4fe10e0", label = 'Doctor', salary = math.floor(740 * legalSalaryBoost(4)), perms = mergePerms(heal, { members = true }) },
        [5] = { labelKey = "config.core.label.surgeon.5d09e789", label = 'Surgeon', salary = math.floor(860 * legalSalaryBoost(5)), perms = mergePerms(heal, { members = true }) },
        [6] = { labelKey = "config.core.label.deputy_chief.a5ec3744", label = 'Deputy Chief', salary = math.floor(980 * legalSalaryBoost(6)), perms = mergePerms(heal, lead) },
        [7] = { labelKey = "config.core.label.chief_medical.6a6efcdc", label = 'Chief Medical', salary = math.floor(1100 * legalSalaryBoost(7)), perms = mergePerms(heal, lead, { promote = true }) },
    }
end

function Sunset.BuildFireGrades()
    local rescue = { stabilize = true, heal = true, revive = true }
    local lead = { invite = true, giverank = true, fmotd = true, fwarn = true, uninvite = true }
    return {
        [0] = { labelKey = "config.core.label.probationary.74740af4", label = 'Probationary', salary = math.floor(300 * legalSalaryBoost(0)), perms = { stabilize = true, members = true } },
        [1] = { labelKey = "config.core.label.firefighter.2569a79d", label = 'Firefighter', salary = math.floor(400 * legalSalaryBoost(1)), perms = { stabilize = true, heal = true, members = true } },
        [2] = { labelKey = "config.core.label.engineer.8533ea98", label = 'Engineer', salary = math.floor(500 * legalSalaryBoost(2)), perms = mergePerms(rescue, { members = true }) },
        [3] = { labelKey = "config.core.label.senior_firefighter.89e55021", label = 'Senior Firefighter', salary = math.floor(600 * legalSalaryBoost(3)), perms = mergePerms(rescue, { members = true }) },
        [4] = { labelKey = "config.core.label.captain.0ab1c0c7", label = 'Captain', salary = math.floor(720 * legalSalaryBoost(4)), perms = mergePerms(rescue, { members = true }) },
        [5] = { labelKey = "config.core.label.battalion_chief.53210279", label = 'Battalion Chief', salary = math.floor(840 * legalSalaryBoost(5)), perms = mergePerms(rescue, { members = true }) },
        [6] = { labelKey = "config.core.label.deputy_chief.a5ec3744", label = 'Deputy Chief', salary = math.floor(960 * legalSalaryBoost(6)), perms = mergePerms(rescue, lead) },
        [7] = { labelKey = "config.core.label.fire_chief.30b639ba", label = 'Fire Chief', salary = math.floor(1080 * legalSalaryBoost(7)), perms = mergePerms(rescue, lead, { promote = true }) },
    }
end

function Sunset.BuildServiceGrades(permKey, labels, salaries)
    local lead = { invite = true, giverank = true, fmotd = true, fwarn = true, uninvite = true }
    local grades = {}
    for i = 0, 7 do
        local perms = {}
        if permKey then perms[permKey] = true end
        if i >= 2 then perms.invite = true end
        if i >= 6 then
            for key, value in pairs(lead) do perms[key] = value end
        end
        if i >= 7 then perms.promote = true end
        if i == 0 then perms.members = true end
        grades[i] = {
            label = labels[i + 1] or Sunset.T('factions.label.rank_number', { rank = i }),
            salary = math.floor((salaries[i + 1] or (200 + i * 80)) * legalSalaryBoost(i)),
            perms = perms,
        }
    end
    return grades
end

function Sunset.BuildEducationGrades()
    local instruct = { issue_license = true, conduct_test = true, members = true }
    local lead = {
        invite = true, giverank = true, fmotd = true, fwarn = true, uninvite = true,
        review_license_tests = true,
    }
    return {
        [0] = { labelKey = "config.core.label.trainee_instructor.21e8d689", label = 'Trainee Instructor', salary = math.floor(280 * legalSalaryBoost(0)), perms = { members = true } },
        [1] = { labelKey = "config.core.label.instructor.9b3403ae", label = 'Instructor', salary = math.floor(360 * legalSalaryBoost(1)), perms = mergePerms(instruct) },
        [2] = { labelKey = "config.core.label.senior_instructor.2c94459f", label = 'Senior Instructor', salary = math.floor(440 * legalSalaryBoost(2)), perms = mergePerms(instruct) },
        [3] = { labelKey = "config.core.label.lead_instructor.4f779156", label = 'Lead Instructor', salary = math.floor(520 * legalSalaryBoost(3)), perms = mergePerms(instruct) },
        [4] = { labelKey = "config.core.label.supervisor.b6c98f84", label = 'Supervisor', salary = math.floor(600 * legalSalaryBoost(4)), perms = mergePerms(instruct) },
        [5] = { labelKey = "config.core.label.chief_instructor.cfe408b4", label = 'Chief Instructor', salary = math.floor(680 * legalSalaryBoost(5)), perms = mergePerms(instruct, lead) },
        [6] = { labelKey = "config.core.label.deputy_director.da32a947", label = 'Deputy Director', salary = math.floor(760 * legalSalaryBoost(6)), perms = mergePerms(instruct, lead) },
        [7] = { labelKey = "config.core.label.director.ef2a0a39", label = 'Director', salary = math.floor(840 * legalSalaryBoost(7)), perms = mergePerms(instruct, lead, { promote = true }) },
    }
end

function Sunset.BuildCriminalGrades(permsByRank)
    local lead = { invite = true, giverank = true, fmotd = true, fwarn = true, uninvite = true }
    local grades = {}
    for i = 0, 7 do
        local perms = {}
        for key, minRank in pairs(permsByRank or {}) do
            if i >= minRank then perms[key] = true end
        end
        if i >= 6 then
            for key, value in pairs(lead) do perms[key] = value end
        end
        if i >= 7 then perms.promote = true end
        if i == 0 then perms.members = true end
        grades[i] = {
            label = ({ 'Associate', 'Soldier', 'Enforcer', 'Lieutenant', 'Captain', 'Underboss', 'Consigliere', 'Boss' })[i + 1],
            salary = 0,
            perms = perms,
        }
    end
    return grades
end
