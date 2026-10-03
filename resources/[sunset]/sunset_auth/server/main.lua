local PendingEmail = {}

local function localeError(key, params)
    return { localeKey = key, params = params or {} }
end

-- [AUDIT P2-04] Brute-force protection: per-source failed-login counter with
-- exponential lockout. Generic callback rate limit (12/s) alone allowed fast
-- online password guessing and cheap scrypt CPU-DoS.
local LoginFails = {}
local LOCKOUT_STEP_MS = 5000 -- 5s, 10s, 20s, ... capped at 5 minutes

-- [SEC3] Key by license, not by server id: dropping/reconnecting (new source id) reset the
-- counter, so the lockout was bypassable. Falls back to the source id when no license.
local function failKey(source)
    return GetPlayerIdentifierByType(source, 'license') or ('src:' .. tostring(source))
end

local function loginLocked(source)
    local rec = LoginFails[failKey(source)]
    if not rec or rec.count < 5 then return false end
    local backoff = math.min(300000, LOCKOUT_STEP_MS * (2 ^ (rec.count - 5)))
    return (GetGameTimer() - rec.lastAt) < backoff, backoff
end

local function recordLoginFail(source)
    local key = failKey(source)
    local rec = LoginFails[key]
    if not rec then rec = { count = 0, lastAt = 0 } LoginFails[key] = rec end
    rec.count = rec.count + 1
    rec.lastAt = GetGameTimer()
end

local function clearLoginFails(source)
    LoginFails[failKey(source)] = nil
end

-- [AUTH UI SPLIT] Lazy sunset_ui start: only players who completed login may
-- request the full game UI to start. Starting a resource is privileged, so
-- this gate prevents unauthenticated clients from forcing it.
local AuthenticatedPlayers = {}
exports('IsPlayerAuthenticated', function(src)
    return AuthenticatedPlayers[tonumber(src or -1)] == true
end)

RegisterNetEvent('sunset:auth:requestUiStart', function()
    -- [REVERT] sunset_ui is ensured at boot again (original Forza auth design).
    -- This handler is now a no-op; kept only so stray client events don't error.
end)

AddEventHandler('playerDropped', function()
    -- [SEC3] LoginFails intentionally NOT cleared on drop (keyed by license, survives reconnect)
    AuthenticatedPlayers[source] = nil
end)

local function deviceHash(source)
    local license = GetPlayerIdentifierByType(source, 'license') or ''
    return exports.sunset_auth:HashToken(license)
end

local function issueQuickToken(source, accountId)
    local token = exports.sunset_auth:GenerateQuickToken()
    if type(token) ~= 'string' or token == '' then return nil end
    local hash = exports.sunset_auth:HashToken(token)
    MySQL.update.await('DELETE FROM auth_quick_tokens WHERE account_id = ? AND (device_hash = ? OR expires_at <= NOW())', {
        accountId, deviceHash(source),
    })
    local id = MySQL.insert.await([[
        INSERT INTO auth_quick_tokens (account_id, token_hash, device_hash, expires_at)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))
    ]], { accountId, hash, deviceHash(source) })
    return id and token or nil
end

local function clearPending(source)
    PendingEmail[source] = nil
end

AddEventHandler('playerDropped', function()
    clearPending(source)
end)

local function normalizeEmail(email)
    if type(email) ~= 'string' then return nil end
    email = email:match('^%s*(.-)%s*$')
    if not email or email == '' then return nil end
    return email:lower()
end

local function validateEmail(email)
    local normalized = normalizeEmail(email)
    if not normalized then
        return false, localeError('auth.email_invalid')
    end
    if #normalized > 254 then
        return false, localeError('auth.email_too_long')
    end
    if not normalized:match('^[%w%.%+%-]+@[%w%-]+%.[%a%.]+$') then
        return false, localeError('auth.email_invalid')
    end
    return true, normalized
end

local function emailMissing(value)
    return type(value) ~= 'string' or value:match('^%s*$')
end

local function validateUsername(username)
    if type(username) ~= 'string' then return false, localeError('auth.username_length') end -- [SEC3]
    if not username or #username < 3 or #username > 20 then
        return false, localeError('auth.username_length')
    end
    if not username:match('^[%w_]+$') then
        return false, localeError('auth.username_characters')
    end
    return true
end

local function validatePassword(password)
    -- [SEC3] type + upper bound: a multi-KB password forces a 32MB scrypt over a huge input (CPU DoS)
    if type(password) ~= 'string' or #password < 6 or #password > 128 then
        return false, localeError('auth.password_length')
    end
    return true
end

local function emailTaken(email, ignoreAccountId)
    local query = 'SELECT id FROM accounts WHERE LOWER(email) = LOWER(?)'
    local params = { email }
    if ignoreAccountId then
        query = query .. ' AND id <> ?'
        params[#params + 1] = ignoreAccountId
    end
    return MySQL.scalar.await(query, params)
end

local RegisterAt = {}
AddEventHandler('playerDropped', function() RegisterAt[source] = nil end)
exports.sunset_core:RegisterCallback('sunset:authRegister', function(source, username, password, passwordConfirm, email)
    -- [SEC3] already-authenticated sources must not mint more accounts; throttle account creation
    if AuthenticatedPlayers[source] then return nil, localeError('auth.session_failed') end
    local nowR = GetGameTimer()
    if RegisterAt[source] and (nowR - RegisterAt[source]) < 15000 then
        return nil, localeError('auth.too_many_attempts', { seconds = 15 })
    end
    RegisterAt[source] = nowR
    local ok, err = validateUsername(username)
    if not ok then return nil, err end
    ok, err = validatePassword(password)
    if not ok then return nil, err end
    if password ~= passwordConfirm then return nil, localeError('auth.password_mismatch') end

    ok, err = validateEmail(email)
    if not ok then return nil, err end
    local normalizedEmail = err

    local exists = MySQL.scalar.await('SELECT id FROM accounts WHERE LOWER(username) = LOWER(?)', { username })
    if exists then return nil, localeError('auth.username_taken') end
    if emailTaken(normalizedEmail) then return nil, localeError('auth.email_taken') end

    local hash = exports.sunset_auth:HashPassword(password)
    if not hash then return nil, localeError('auth.password_setup_failed') end
    local accountId = MySQL.insert.await(
        'INSERT INTO accounts (username, email, password_hash, password_salt) VALUES (?, ?, ?, ?)',
        { username:lower(), normalizedEmail, hash, '' }
    )

    clearPending(source)
    local normalized = username:lower()
    if not exports.sunset_core:CompleteAuthentication(source, accountId, normalized) then
        return nil, localeError('auth.session_failed')
    end
    AuthenticatedPlayers[source] = true
    return { username = normalized, needsEmail = false, quickToken = issueQuickToken(source, accountId) }
end)
exports.sunset_core:RegisterCallback('sunset:authLogin', function(source, username, password)
    local ok, err = validateUsername(username)
    if not ok then return nil, err end
    if type(password) ~= 'string' or password == '' then return nil, localeError('auth.password_required') end
    if #password > 128 then return nil, localeError('auth.invalid_credentials') end -- [SEC3]
    if AuthenticatedPlayers[source] then return nil, localeError('auth.session_failed') end -- [SEC3]

    local locked, backoff = loginLocked(source)
    if locked then
        return nil, localeError('auth.too_many_attempts', { seconds = math.ceil(backoff / 1000) })
    end

    local account = MySQL.single.await(
        'SELECT id, username, email, password_hash, password_salt FROM accounts WHERE LOWER(username) = LOWER(?)',
        { username }
    )
    if not account then recordLoginFail(source) return nil, localeError('auth.invalid_credentials') end
    local modern = type(account.password_hash) == 'string' and account.password_hash:sub(1, 8) == '$scrypt$'
    local valid = modern and exports.sunset_auth:VerifyPassword(password, account.password_hash)
        or Sunset.Password.Verify(password, account.password_salt, account.password_hash)
    if not valid then
        recordLoginFail(source)
        return nil, localeError('auth.invalid_credentials')
    end
    clearLoginFails(source)

    if not modern then
        local upgraded = exports.sunset_auth:HashPassword(password)
        if upgraded then
            MySQL.update.await('UPDATE accounts SET password_hash = ?, password_salt = ? WHERE id = ?', {
                upgraded, '', account.id,
            })
        end
    end

    if emailMissing(account.email) then
        PendingEmail[source] = account.id
        return {
            username = account.username,
            needsEmail = true,
        }
    end

    clearPending(source)
    if not exports.sunset_core:CompleteAuthentication(source, account.id, account.username) then
        return nil, localeError('auth.session_failed')
    end
    AuthenticatedPlayers[source] = true
    return { username = account.username, needsEmail = false, quickToken = issueQuickToken(source, account.id) }
end)

exports.sunset_core:RegisterCallback('sunset:authQuickLogin', function(source, username, token)
    if type(username) ~= 'string' or type(token) ~= 'string' or #token < 32 or #token > 128 then
        return nil, localeError('auth.saved_expired')
    end
    if AuthenticatedPlayers[source] then return nil, localeError('auth.session_failed') end -- [SEC3]
    local lockedQ, backoffQ = loginLocked(source) -- [SEC3] quick-login failures count toward the same lockout
    if lockedQ then return nil, localeError('auth.too_many_attempts', { seconds = math.ceil(backoffQ / 1000) }) end
    local tokenHash = exports.sunset_auth:HashToken(token)
    local row = MySQL.single.await([[
        SELECT a.id, a.username, a.email
        FROM auth_quick_tokens q
        JOIN accounts a ON a.id = q.account_id
        WHERE LOWER(a.username) = LOWER(?) AND q.token_hash = ? AND q.device_hash = ?
          AND q.revoked_at IS NULL AND q.expires_at > NOW()
        LIMIT 1
    ]], { username, tokenHash, deviceHash(source) })
    if not row then recordLoginFail(source) return nil, localeError('auth.saved_expired') end
    MySQL.update.await('UPDATE auth_quick_tokens SET last_used_at = NOW() WHERE token_hash = ?', { tokenHash })
    if emailMissing(row.email) then
        PendingEmail[source] = row.id
        return { username = row.username, needsEmail = true }
    end
    if not exports.sunset_core:CompleteAuthentication(source, row.id, row.username) then
        return nil, localeError('auth.session_failed')
    end
    AuthenticatedPlayers[source] = true
    return { username = row.username, needsEmail = emailMissing(row.email), quickToken = issueQuickToken(source, row.id) }
end)

exports.sunset_core:RegisterCallback('sunset:authSetEmail', function(source, email)
    local accountId = PendingEmail[source]
    if not accountId then
        return nil, localeError('auth.session_expired')
    end

    local ok, err = validateEmail(email)
    if not ok then return nil, err end
    local normalizedEmail = err

    if emailTaken(normalizedEmail, accountId) then
        return nil, localeError('auth.email_taken')
    end

    local account = MySQL.single.await('SELECT id, username FROM accounts WHERE id = ?', { accountId })
    if not account then
        clearPending(source)
        return nil, localeError('auth.account_not_found')
    end

    MySQL.update.await('UPDATE accounts SET email = ? WHERE id = ?', { normalizedEmail, accountId })
    clearPending(source)

    if not exports.sunset_core:CompleteAuthentication(source, account.id, account.username) then
        return nil, localeError('auth.session_failed')
    end
    AuthenticatedPlayers[source] = true
    return { username = account.username, needsEmail = false, quickToken = issueQuickToken(source, account.id) }
end)

-- ═══════════════════════════════════════════════════════════════
-- /changepass <oldPassword> <newPassword> <confirmPassword>
-- ═══════════════════════════════════════════════════════════════
local function processPasswordChange(source, oldPassword, newPassword, confirmPassword)
    local player = exports.sunset_core:GetPlayer(source)
    if not player or not player.account_id then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.you_are_not_logged_in_to_a_valid_account') }
    end

    if type(oldPassword) ~= 'string' or oldPassword == '' then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.enter_your_current_account_password') }
    end

    if type(newPassword) ~= 'string' or newPassword == '' then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.enter_your_new_password') }
    end

    if newPassword ~= confirmPassword then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.the_new_password_and_confirmation_do_not_match') }
    end

    if #newPassword < 6 or #newPassword > 128 then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.the_new_password_must_contain_between_6_and_128_characters') }
    end

    local account = MySQL.single.await(
        'SELECT id, password_hash, password_salt FROM accounts WHERE id = ?',
        { player.account_id }
    )

    if not account then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.your_account_was_not_found') }
    end

    local modern = type(account.password_hash) == 'string' and account.password_hash:sub(1, 8) == '$scrypt$'
    local valid = modern and exports.sunset_auth:VerifyPassword(oldPassword, account.password_hash)
        or Sunset.Password.Verify(oldPassword, account.password_salt, account.password_hash)

    if not valid then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.your_current_password_is_incorrect') }
    end

    local newHash = exports.sunset_auth:HashPassword(newPassword)
    if not newHash then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.could_not_securely_encrypt_the_new_password') }
    end

    MySQL.update.await('UPDATE accounts SET password_hash = ?, password_salt = ? WHERE id = ?', {
        newHash, '', account.id
    })

    -- Invalidate existing quick tokens
    MySQL.update.await('DELETE FROM auth_quick_tokens WHERE account_id = ?', { account.id })

    return { success = true, message = exports.sunset_core:TFor(source, 'auth.presentation.your_account_password_has_been_changed') }
end

exports.sunset_core:RegisterCallback('sunset:auth:changePassword', function(source, oldPassword, newPassword, confirmPassword)
    return processPasswordChange(source, oldPassword, newPassword, confirmPassword)
end)

exports.sunset_core:RegisterCallback('sunset:auth:requestPasswordReset', function(source, identifier)
    identifier = tostring(identifier or ''):match('^%s*(.-)%s*$')
    if identifier == '' then
        return { success = false, message = exports.sunset_core:TFor(source, 'auth.presentation.enter_your_account_username_or_email_address') }
    end

    local account = MySQL.single.await(
        'SELECT id, username, email FROM accounts WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
        { identifier, identifier }
    )

    if account and account.email and string.find(account.email, '@') then
        local postData = json.encode({
            identifier = account.username,
        })

        PerformHttpRequest('http://127.0.0.1:3000/api/auth/forgot-password', function(statusCode, responseText)
            -- Handled by panel mailer
        end, 'POST', postData, { ['Content-Type'] = 'application/json' })
    end

    return {
        success = true,
        message = exports.sunset_core:TFor(source, 'auth.presentation.if_the_details_match_an_active_account_a_reset_link_has_been_sent_to_its_email_address'),
    }
end)

RegisterCommand('changepass', function(source, args)
    if source == 0 then
        print('[sunset_auth] /changepass cannot be run from server console.')
        return
    end

    if #args >= 3 then
        local res = processPasswordChange(source, args[1], args[2], args[3])
        TriggerClientEvent('sunset:client:notify', source, res.message, res.success and 'success' or 'error', 6000)
    else
        TriggerClientEvent('sunset:auth:openChangePassUI', source)
    end
end, false)

RegisterCommand('lostpass', function(source, args)
    if source == 0 then return end
    local user = args[1]
    if not user or user == '' then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'auth.presentation.usage_lostpass_username_or_email'), 'info', 6000)
        return
    end

    local account = MySQL.single.await(
        'SELECT id, username, email FROM accounts WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
        { user, user }
    )

    if account and account.email and string.find(account.email, '@') then
        local postData = json.encode({ identifier = account.username })
        PerformHttpRequest('http://127.0.0.1:3000/api/auth/forgot-password', function() end, 'POST', postData, { ['Content-Type'] = 'application/json' })
    end

    TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'auth.presentation.if_the_account_exists_a_reset_link_has_been_sent_by_email'), 'success', 7000)
end, false)

RegisterCommand('forgotpass', function(source, args)
    if source == 0 then return end
    local user = args[1]
    if not user or user == '' then
        TriggerClientEvent('sunset:client:notify', source, exports.sunset_core:TFor(source, 'auth.presentation.usage_forgotpass_username_or_email'), 'info', 6000)
        return
    end
    ExecuteCommand(('lostpass %s'):format(user))
end, false)



