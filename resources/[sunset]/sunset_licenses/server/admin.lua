local function notify(source, message, kind)
    if source == 0 then
        print(('[sunset_licenses] %s'):format(message))
        return
    end
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', 7000)
end

local function resolveTarget(source, arg)
    local target = tonumber(arg)
    if target and GetPlayerName(target) then return target end
    return nil
end

local function runGiveLicense(source, args)
    local target, licenseType
    if source == 0 then
        target = resolveTarget(source, args[1])
        licenseType = string.lower(tostring(args[2] or ''))
    else
        target = resolveTarget(source, args[1])
        licenseType = string.lower(tostring(args[2] or ''))
    end
    if not target then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_agivelicense_player_id_driver_pilot'), 'error')
        return
    end
    if not SunsetLicenses.Types[licenseType] then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.license_types_driver_pilot_boat_weapon'), 'error')
        return
    end
    local issuer = source ~= 0 and exports.sunset_core:GetCharacter(source)
    local ok, err = GrantLicense(target, licenseType, issuer and issuer.id)
    if ok then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.granted_to_player', { license_type = tostring(licenseType), target = math.floor(tonumber(target) or 0) }), 'success')
    else
        notify(source, err or exports.sunset_core:TFor(source, 'licenses.msg.could_not_grant_license'), 'error')
    end
end

local function runRevokeLicense(source, args)
    local target = resolveTarget(source, args[1])
    local licenseType = string.lower(tostring(args[2] or ''))
    if not target then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_revokelicense_player_id_driver_pilot'), 'error')
        return
    end
    if not SunsetLicenses.Types[licenseType] then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.license_types_driver_pilot_boat_weapon'), 'error')
        return
    end
    RevokeLicense(target, licenseType)
    notify(source, exports.sunset_core:TFor(source, 'licenses.msg.revoked_from_player', { license_type = tostring(licenseType), target = math.floor(tonumber(target) or 0) }), 'success')
end

RegisterCommand('givelicense', function(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required_for_givelicense'), 'error')
        return
    end
    runGiveLicense(source, args or {})
end, false)

RegisterCommand('agivelicense', function(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required_for_agivelicense'), 'error')
        return
    end
    runGiveLicense(source, args or {})
end, false)

RegisterCommand('revokelicense', function(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required'), 'error')
        return
    end
    runRevokeLicense(source, args or {})
end, false)

-- [SECTION 7] /achecklicenses — show all licenses for a target character.
local function runCheckLicenses(source, args)
    local target = resolveTarget(source, args[1])
    if not target then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.usage_achecklicenses_player_id'), 'error')
        return
    end
    local char = exports.sunset_core:GetCharacter(target)
    if not char then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.player_has_no_character_loaded', { target = math.floor(tonumber(target) or 0) }), 'error')
        return
    end
    local rows = GetLicenseRows(target)
    local paydays = tonumber(char.paydays_received) or 0
    if not rows or #rows == 0 then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.player_char_has_no_licenses', { target = math.floor(tonumber(target) or 0), id = math.floor(tonumber(char.id) or 0) }), 'info')
        return
    end
    local lines = { ('Licenses for #%d (char #%d — %s %s):'):format(
        target, char.id, char.firstname or '', char.lastname or '') }
    for _, row in ipairs(rows) do
        local def = SunsetLicenses.Types[row.license_type]
        local label = def and def.label or row.license_type
        local exp = tonumber(row.expires_at_payday)
        local valid = (not exp) or (paydays < exp)
        local status = valid and '~g~VALID' or '~r~EXPIRED'
        local expiryStr = exp and ('expires pd#%d, now pd#%d'):format(exp, paydays) or 'no expiry'
        lines[#lines + 1] = ('  %s ~s~%s — %s'):format(status, label, expiryStr)
    end
    local msg = table.concat(lines, '\n')
    notify(source, msg, 'info')
    if source == 0 then
        -- Also print to console with plain text
        print('[sunset_licenses] ' .. table.concat(lines, ' | '))
    end
end

RegisterCommand('achecklicenses', function(source, args)
    if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
        notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required'), 'error')
        return
    end
    runCheckLicenses(source, args or {})
end, false)

function ExecutePlayerCommand(source, name, args)
    name = string.lower(tostring(name or ''))
    args = args or {}
    if name == 'issuelicense' then
        return RunInstructorLicenseCommand(source, args)
    end
    if name == 'givelicense' or name == 'agivelicense' then
        if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
            notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required_for_agivelicense'), 'error')
            return true
        end
        runGiveLicense(source, args)
        return true
    end
    if name == 'revokelicense' then
        if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
            notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required'), 'error')
            return true
        end
        runRevokeLicense(source, args)
        return true
    end
    if name == 'achecklicenses' then
        if source ~= 0 and not exports.sunset_admin:IsAdmin(source, 2) then
            notify(source, exports.sunset_core:TFor(source, 'licenses.msg.admin_level_2_required'), 'error')
            return true
        end
        runCheckLicenses(source, args)
        return true
    end
    if name == 'lssireviews' then
        return RunLssiReviewsCommand(source, args)
    end
    if name == 'lssireview' then
        return RunLssiReviewCommand(source, args)
    end
    if name == 'lssireport' then
        return RunLssiReportCommand(source, args)
    end
    if name == 'lssiperformance' then
        return RunLssiPerformanceCommand(source, args)
    end
    if name == 'lssimark' then
        return RunLssiMarkCommand(source, args)
    end
    if name == 'lssiunmark' then
        return RunLssiUnmarkCommand(source, args)
    end
    return false
end
exports('ExecutePlayerCommand', ExecutePlayerCommand)
