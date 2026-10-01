local REVIEW_MIN_GRADE = 5

CreateThread(function()
    Wait(1000)
    pcall(function()
        MySQL.update.await([[
            UPDATE lssi_exam_reports SET result = 'aborted', completed_at = CURRENT_TIMESTAMP,
                duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP)
            WHERE result = 'in_progress'
        ]])
    end)
end)

local function reviewNotify(source, message, kind)
    if source == 0 then
        print(('[sunset_licenses] %s'):format(message))
        return
    end
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', 8000)
end

local function reviewChat(source, message, kind)
    if source == 0 then return print(('[LSSI] %s'):format(message)) end
    TriggerClientEvent('sunset:chat:system', source, ('LSSI: %s'):format(message), kind or 'info')
end

local function character(source)
    return exports.sunset_core:GetCharacter(source)
end

local function characterFaction(char)
    if not char then return nil, 0 end
    local factionId, grade = Sunset.GetCharacterFaction(char)
    return factionId, tonumber(grade) or 0
end

local function canReview(source)
    local char = character(source)
    local factionId, grade = characterFaction(char)
    if factionId ~= 'lssi' then return nil, { localeKey = 'licenses.message.only_lssi_management_can_review_instructor_exams' } end
    if grade < REVIEW_MIN_GRADE then return nil, { localeKey = 'licenses.message.lssi_rank_5_or_higher_is_required_to_review' } end
    if not exports.sunset_factions:IsOnDuty(source) then return nil, { localeKey = 'licenses.message.go_on_lssi_duty_before_reviewing_exams' } end
    return char
end

local function cleanNotes(value)
    local notes = tostring(value or ''):gsub('[\r\n\t]', ' '):gsub('%s+', ' ')
    notes = notes:gsub('^%s+', ''):gsub('%s+$', '')
    return notes:sub(1, 500)
end

local function writeFactionAudit(actorId, action, targetId, details)
    pcall(function()
        MySQL.insert.await([[
            INSERT INTO faction_audit_log (faction_id, actor_character_id, action, target_character_id, details)
            VALUES ('lssi', ?, ?, ?, ?)
        ]], { actorId, action, targetId, json.encode(details or {}) })
    end)
end

function CreateLicenseExamReport(source, session)
    if not session or not session.instructor or not session.issuerCharacterId then return nil end
    local candidate = character(source)
    if not candidate then return nil end
    local practical = SunsetLicenses.Practical[session.licenseType]
    local total = practical and #(practical.checkpoints or {}) or 0
    if session.licenseType == 'weapon' then
        total = practical and tonumber(practical.targetsRequired) or total
    end
    local ok, reportId = pcall(MySQL.insert.await, [[
        INSERT INTO lssi_exam_reports
            (license_type, candidate_character_id, instructor_character_id, checkpoints_total)
        VALUES (?, ?, ?, ?)
    ]], { session.licenseType, candidate.id, session.issuerCharacterId, total })
    if not ok or not reportId then
        print(('[sunset_licenses] Could not create LSSI exam report: %s'):format(tostring(reportId)))
        return nil
    end
    session.reportId = tonumber(reportId)
    session.candidateCharacterId = tonumber(candidate.id)
    return session.reportId
end

function RecordLicenseTheoryResult(session, score, total, passed)
    if not session or not session.reportId then return end
    pcall(function()
        if passed then
            MySQL.update.await(
                'UPDATE lssi_exam_reports SET theory_score = ?, theory_total = ? WHERE id = ? AND result = ?',
                { score, total, session.reportId, 'in_progress' })
        else
            MySQL.update.await([[
                UPDATE lssi_exam_reports SET theory_score = ?, theory_total = ?, result = 'failed',
                    completed_at = CURRENT_TIMESTAMP, duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP)
                WHERE id = ? AND result = 'in_progress'
            ]], { score, total, session.reportId })
        end
    end)
end

function FinalizeLicenseExamReport(session, result)
    if not session or not session.reportId then return end
    result = ({ passed = true, failed = true, aborted = true })[result] and result or 'aborted'
    local completed = tonumber(session.lastCheckpoint) or 0
    if session.licenseType == 'weapon' then
        completed = 0
        for _ in pairs(session.weaponHits or {}) do completed = completed + 1 end
    end
    pcall(function()
        MySQL.update.await([[
            UPDATE lssi_exam_reports SET result = ?, checkpoints_completed = ?, candidate_mistakes = ?, candidate_marks = ?,
                practical_evidence = ?,
                completed_at = CURRENT_TIMESTAMP, duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP)
            WHERE id = ? AND result = 'in_progress'
        ]], { result, completed, tonumber(session.candidateMistakes) or 0,
            json.encode(session.candidateMarks or {}), json.encode(session.practicalEvidence or {}), session.reportId })
    end)
    writeFactionAudit(session.issuerCharacterId, 'license_exam_conducted', session.candidateCharacterId, {
        reportId = session.reportId,
        licenseType = session.licenseType,
        result = result,
    })
    if session.instructor and GetPlayerName(session.instructor) then
        reviewNotify(session.instructor, exports.sunset_core:TFor(session.instructor, 'licenses.msg.exam_report_was_saved_as_and', { report_id = math.floor(tonumber(session.reportId) or 0), result = tostring(result) }), result == 'passed' and 'success' or 'warning')
    end
end

local function performance(characterId)
    local ok, row = pcall(MySQL.single.await, [[
        SELECT COUNT(*) AS total,
            SUM(review_status <> 'pending') AS reviewed,
            SUM(review_status = 'pending') AS pending,
            SUM(review_status = 'approved') AS approved,
            SUM(review_status = 'needs_improvement') AS needs_improvement,
            COALESCE(AVG(CASE WHEN review_status <> 'pending' THEN instructor_mistakes END), 0) AS average_mistakes
        FROM lssi_exam_reports
        WHERE instructor_character_id = ? AND result <> 'in_progress'
    ]], { characterId })
    if not ok then return nil, { localeKey = 'licenses.message.lssi_review_storage_is_unavailable_apply_sql_25_lssi' } end
    row = row or {}
    return {
        total = tonumber(row.total) or 0,
        reviewed = tonumber(row.reviewed) or 0,
        pending = tonumber(row.pending) or 0,
        approved = tonumber(row.approved) or 0,
        needsImprovement = tonumber(row.needs_improvement) or 0,
        averageMistakes = tonumber(row.average_mistakes) or 0,
    }
end

function AssessInstructorPromotion(characterId, newGrade)
    characterId, newGrade = tonumber(characterId), tonumber(newGrade)
    if not characterId or not newGrade then return false, { localeKey = 'licenses.message.invalid_lssi_promotion_assessment' } end
    local requirement = SunsetLicenses.InstructorPromotionRequirements[newGrade]
    if not requirement then return true end
    local stats, err = performance(characterId)
    if not stats then return false, err end
    if stats.reviewed < requirement.reviewed then
        return false, { localeKey = 'licenses.message.lssi_rank_value_requires_value_reviewed_exams_this_instructor_has', formatArgs = {
            newGrade, requirement.reviewed, stats.reviewed, stats.pending } }
    end
    if stats.averageMistakes > requirement.maxAverageMistakes then
        return false, { localeKey = 'licenses.message.lssi_rank_value_requires_at_most_value_average_instructor_mistake', formatArgs = {
            newGrade, requirement.maxAverageMistakes, stats.averageMistakes } }
    end
    return true, stats
end
exports('AssessInstructorPromotion', AssessInstructorPromotion)

function RunLssiReviewsCommand(source, args)
    local actor, err = canReview(source)
    if not actor then reviewNotify(source, err, 'error') return true end
    local mode = string.lower(tostring(args[1] or 'pending'))
    local where, params = "r.review_status = 'pending' AND r.result <> 'in_progress'", {}
    if mode == 'all' then
        where = "r.result <> 'in_progress'"
    elseif mode ~= 'pending' then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_lssireviews_pending_all'), 'error')
        return true
    end
    local ok, rows = pcall(MySQL.query.await, ([=[
        SELECT r.id, r.license_type, r.result, r.theory_score, r.theory_total, r.candidate_mistakes,
            r.checkpoints_completed, r.checkpoints_total, r.review_status,
            CONCAT(ci.firstname, ' ', ci.lastname) AS instructor_name,
            CONCAT(cc.firstname, ' ', cc.lastname) AS candidate_name
        FROM lssi_exam_reports r
        JOIN characters ci ON ci.id = r.instructor_character_id
        JOIN characters cc ON cc.id = r.candidate_character_id
        WHERE %s ORDER BY r.completed_at DESC, r.id DESC LIMIT 20
    ]=]):format(where), params)
    if not ok then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.review_list_unavailable_apply_the_lssi'), 'error') return true end
    rows = rows or {}
    reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.exam_reports_shown', { value = mode == 'all' and exports.sunset_core:TFor(source, 'licenses.word.recent') or exports.sunset_core:TFor(source, 'licenses.word.pending'), count = #rows }), 'info')
    for _, row in ipairs(rows) do
        reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.instructor_candidate_theory_practical_candid', { id = math.floor(tonumber(row.id) or 0), upper = tostring(string.upper(row.license_type)), instructor_name = tostring(row.instructor_name), candidate_name = tostring(row.candidate_name), result = tostring(row.result), theory_score = tostring(row.theory_score or '-'), theory_total = tostring(row.theory_total or '-'), checkpoints_completed = tostring(row.checkpoints_completed or 0), checkpoints_total = tostring(row.checkpoints_total or 0), candidate_mistakes = string.format('%.1f', tonumber(row.candidate_mistakes) or 0), review_status = tostring(row.review_status) }), 'info')
    end
    if #rows == 0 then reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.no_matching_exam_reports'), 'info') end
    return true
end

local function activeInstructorSession(source, target)
    local actor = character(source)
    local factionId, grade = characterFaction(actor)
    if factionId ~= 'lssi' or grade < 1 or not exports.sunset_factions:IsOnDuty(source) then
        return nil, nil, 'You must be an on-duty LSSI instructor.'
    end
    target = tonumber(target)
    if not target or not GetPlayerName(target) then return nil, nil, 'Candidate is not online.' end
    local session = GetTestSession(target)
    if not session or session.instructor ~= source or (session.phase ~= 'practical' and session.phase ~= 'validated') then
        return nil, nil, 'That player is not in a practical exam supervised by you.'
    end
    local actorPed, targetPed = GetPlayerPed(source), GetPlayerPed(target)
    if actorPed == 0 or targetPed == 0 or #(GetEntityCoords(actorPed) - GetEntityCoords(targetPed)) > 100.0 then
        return nil, nil, 'Stay close enough to observe the candidate before grading them.'
    end
    return session, target
end

function RunLssiMarkCommand(source, args)
    local session, target, err = activeInstructorSession(source, args[1])
    if not session then reviewNotify(source, err, 'error') return true end
    local points = tonumber(args[2])
    local reason = cleanNotes(table.concat(args, ' ', 3))
    if (points ~= 0.5 and points ~= 1.0) or reason == '' then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_lssimark_candidate_id_0_5'), 'error')
        return true
    end
    session.candidateMarks = session.candidateMarks or {}
    session.candidateMistakes = tonumber(session.candidateMistakes) or 0
    if session.candidateMistakes + points > 10 then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.the_candidate_already_reached_the_maximum'), 'error')
        return true
    end
    session.candidateMarks[#session.candidateMarks + 1] = {
        points = points, reason = reason, at = os.time(),
    }
    session.candidateMistakes = session.candidateMistakes + points
    if session.reportId then
        pcall(function()
            MySQL.update.await('UPDATE lssi_exam_reports SET candidate_mistakes = ?, candidate_marks = ? WHERE id = ?',
                { session.candidateMistakes, json.encode(session.candidateMarks), session.reportId })
        end)
    end
    reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.recorded_mistake_for_candidate_total', { points = string.format('%.1f', points), target = math.floor(tonumber(target) or 0), reason = tostring(reason), candidate_mistakes = string.format('%.1f', session.candidateMistakes), candidate_fail_mistakes = string.format('%.1f', SunsetLicenses.CandidateFailMistakes or 3) }), 'warning')
    reviewNotify(target, exports.sunset_core:TFor(target, 'licenses.msg.your_instructor_recorded_mistake_total', { points = string.format('%.1f', points), reason = tostring(reason), candidate_mistakes = string.format('%.1f', session.candidateMistakes), candidate_fail_mistakes = string.format('%.1f', SunsetLicenses.CandidateFailMistakes or 3) }), 'warning')
    return true
end

function RunLssiUnmarkCommand(source, args)
    local session, target, err = activeInstructorSession(source, args[1])
    if not session then reviewNotify(source, err, 'error') return true end
    local marks = session.candidateMarks or {}
    local removed = table.remove(marks)
    if not removed then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.no_candidate_mistake_is_available_to'), 'error') return true end
    session.candidateMistakes = math.max(0, (tonumber(session.candidateMistakes) or 0) - (tonumber(removed.points) or 0))
    if session.reportId then
        pcall(function()
            MySQL.update.await('UPDATE lssi_exam_reports SET candidate_mistakes = ?, candidate_marks = ? WHERE id = ?',
                { session.candidateMistakes, json.encode(marks), session.reportId })
        end)
    end
    reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.removed_the_last_mark_from_candidate', { points = string.format('%.1f', tonumber(removed.points) or 0), target = math.floor(tonumber(target) or 0), candidate_mistakes = string.format('%.1f', session.candidateMistakes) }), 'success')
    reviewNotify(target, exports.sunset_core:TFor(target, 'licenses.msg.your_instructor_corrected_the_last_mark', { candidate_mistakes = string.format('%.1f', session.candidateMistakes) }), 'info')
    return true
end

function RunLssiReviewCommand(source, args)
    local actor, err = canReview(source)
    if not actor then reviewNotify(source, err, 'error') return true end
    local reportId = tonumber(args[1])
    local mistakes = tonumber(args[2])
    local verdict = string.lower(tostring(args[3] or ''))
    local notes = cleanNotes(table.concat(args, ' ', 4))
    if not reportId or mistakes == nil or (verdict ~= 'approved' and verdict ~= 'improve') or notes == '' then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_lssireview_report_id_mistakes_0'), 'error')
        return true
    end
    if mistakes < 0 or mistakes > 20 or math.abs(mistakes * 2 - math.floor(mistakes * 2 + 0.5)) > 0.001 then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.mistakes_must_be_between_0_and'), 'error')
        return true
    end
    local ok, report = pcall(MySQL.single.await, [[
        SELECT r.*, ci.metadata AS instructor_metadata
        FROM lssi_exam_reports r
        JOIN characters ci ON ci.id = r.instructor_character_id
        WHERE r.id = ? AND r.result <> 'in_progress' LIMIT 1
    ]], { reportId })
    if not ok then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.review_storage_is_unavailable'), 'error') return true end
    if not report then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.that_completed_exam_report_does_not'), 'error') return true end
    if report.review_status ~= 'pending' then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.report_was_already_reviewed_and_cannot', { report_id = math.floor(tonumber(reportId) or 0) }), 'error')
        return true
    end
    if tonumber(report.instructor_character_id) == tonumber(actor.id) then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.you_cannot_review_your_own_instructor'), 'error')
        return true
    end
    local instructorMetadata = report.instructor_metadata
    if type(instructorMetadata) == 'string' then
        local valid, decoded = pcall(json.decode, instructorMetadata)
        instructorMetadata = valid and decoded or {}
    end
    local instructorGrade = tonumber(type(instructorMetadata) == 'table' and instructorMetadata.faction_grade) or 0
    local _, reviewerGrade = characterFaction(actor)
    local isLeader = exports.sunset_factions:IsFactionLeader(source) == true
    if instructorGrade >= reviewerGrade and not isLeader then
        reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.you_cannot_qa_an_instructor_at', { instructor_grade = math.floor(tonumber(instructorGrade) or 0), reviewer_grade = math.floor(tonumber(reviewerGrade) or 0) }), 'error')
        return true
    end
    local status = verdict == 'approved' and 'approved' or 'needs_improvement'
    local changed = MySQL.update.await([[
        UPDATE lssi_exam_reports SET review_status = ?, reviewer_character_id = ?,
            instructor_mistakes = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND review_status = 'pending'
    ]], { status, actor.id, mistakes, notes, reportId })
    if tonumber(changed) ~= 1 then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.the_report_changed_before_your_review'), 'error') return true end
    writeFactionAudit(actor.id, 'license_exam_reviewed', report.instructor_character_id, {
        reportId = reportId, mistakes = mistakes, verdict = status, notes = notes,
    })
    reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.exam_reviewed_instructor_mistakes', { report_id = math.floor(tonumber(reportId) or 0), status = tostring(status), mistakes = string.format('%.1f', mistakes) }), 'success')
    return true
end

function RunLssiReportCommand(source, args)
    local actor, err = canReview(source)
    if not actor then reviewNotify(source, err, 'error') return true end
    local reportId = tonumber(args[1])
    if not reportId then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_lssireport_report_id'), 'error') return true end
    local ok, row = pcall(MySQL.single.await, [[
        SELECT r.*, CONCAT(ci.firstname, ' ', ci.lastname) AS instructor_name,
            CONCAT(cc.firstname, ' ', cc.lastname) AS candidate_name,
            CONCAT(cr.firstname, ' ', cr.lastname) AS reviewer_name
        FROM lssi_exam_reports r
        JOIN characters ci ON ci.id = r.instructor_character_id
        JOIN characters cc ON cc.id = r.candidate_character_id
        LEFT JOIN characters cr ON cr.id = r.reviewer_character_id
        WHERE r.id = ? LIMIT 1
    ]], { reportId })
    if not ok then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.report_storage_is_unavailable'), 'error') return true end
    if not row then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.that_exam_report_does_not_exist'), 'error') return true end
    reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.report_instructor_candidate_duration_s', { id = math.floor(tonumber(row.id) or 0), upper = tostring(string.upper(row.license_type)), result = tostring(row.result), instructor_name = tostring(row.instructor_name), candidate_name = tostring(row.candidate_name), duration_seconds = tostring(row.duration_seconds or '-') }), 'info')
    reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.theory_practical_candidate_mistakes', { theory_score = tostring(row.theory_score or '-'), theory_total = tostring(row.theory_total or '-'), checkpoints_completed = tostring(row.checkpoints_completed or 0), checkpoints_total = tostring(row.checkpoints_total or 0), candidate_mistakes = string.format('%.1f', tonumber(row.candidate_mistakes) or 0) }), 'info')
    local marks = row.candidate_marks
    if type(marks) == 'string' then
        local decoded, valid = nil, false
        valid, decoded = pcall(json.decode, marks)
        marks = valid and decoded or {}
    end
    for index, mark in ipairs(type(marks) == 'table' and marks or {}) do
        reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.candidate_mark', { index = math.floor(tonumber(index) or 0), points = string.format('%.1f', tonumber(mark.points) or 0), reason = tostring(mark.reason or 'No reason') }), 'warning')
    end
    local evidence = row.practical_evidence
    if type(evidence) == 'string' then
        local valid, decoded = pcall(json.decode, evidence)
        evidence = valid and decoded or {}
    end
    evidence = type(evidence) == 'table' and evidence or {}
    reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.server_validated_practical_evidence_ordered_', { count = #evidence }), 'info')
    if row.review_status == 'pending' then
        reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.qa_review_pending_use_lssireview_after'), 'warning')
    else
        reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.qa_by_instructor_mistakes', { review_status = tostring(row.review_status), reviewer_name = row.reviewer_name or exports.sunset_core:TFor(source, 'licenses.word.unknown'), instructor_mistakes = string.format('%.1f', tonumber(row.instructor_mistakes) or 0), review_notes = row.review_notes or exports.sunset_core:TFor(source, 'licenses.word.no_notes') }), 'info')
    end
    return true
end

function RunLssiPerformanceCommand(source, args)
    local actor = character(source)
    local factionId, grade = characterFaction(actor)
    if factionId ~= 'lssi' then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.this_command_is_for_lssi_members'), 'error') return true end
    local targetId = tonumber(args[1])
    local targetChar = actor
    if targetId then
        if grade < REVIEW_MIN_GRADE then reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.rank_5_is_required_to_view'), 'error') return true end
        targetChar = character(targetId)
        if not targetChar or select(1, characterFaction(targetChar)) ~= 'lssi' then
            reviewNotify(source, exports.sunset_core:TFor(source, 'licenses.msg.that_online_player_is_not_an'), 'error') return true
        end
    end
    local stats, err = performance(targetChar.id)
    if not stats then reviewNotify(source, err, 'error') return true end
    reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.instructor_performance_exams_reviewed_pendin', { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(targetId or source)), total = math.floor(tonumber(stats.total) or 0), reviewed = math.floor(tonumber(stats.reviewed) or 0), pending = math.floor(tonumber(stats.pending) or 0), approved = math.floor(tonumber(stats.approved) or 0), needs_improvement = math.floor(tonumber(stats.needsImprovement) or 0), average_mistakes = string.format('%.2f', stats.averageMistakes) }), 'info')
    local _, targetGrade = characterFaction(targetChar)
    local nextRequirement = SunsetLicenses.InstructorPromotionRequirements[targetGrade + 1]
    if nextRequirement then
        reviewChat(source, exports.sunset_core:TFor(source, 'licenses.msg.next_rank_qa_target_reviewed_exams', { reviewed = math.floor(tonumber(stats.reviewed) or 0), reviewed_2 = math.floor(tonumber(nextRequirement.reviewed) or 0), average_mistakes = string.format('%.2f', stats.averageMistakes), max_average_mistakes = string.format('%.2f', nextRequirement.maxAverageMistakes) }), 'info')
    end
    return true
end

RegisterCommand('lssimark', function(source, args)
    RunLssiMarkCommand(source, args or {})
end, false)

RegisterCommand('lssiunmark', function(source, args)
    RunLssiUnmarkCommand(source, args or {})
end, false)

RegisterCommand('lssireviews', function(source, args)
    RunLssiReviewsCommand(source, args or {})
end, false)

RegisterCommand('lssireport', function(source, args)
    RunLssiReportCommand(source, args or {})
end, false)

RegisterCommand('lssireview', function(source, args)
    RunLssiReviewCommand(source, args or {})
end, false)

RegisterCommand('lssiperformance', function(source, args)
    RunLssiPerformanceCommand(source, args or {})
end, false)
