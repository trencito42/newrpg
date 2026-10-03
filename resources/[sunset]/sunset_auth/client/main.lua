local authenticated = false
local sessionLicense = nil
local pendingAuth = nil
local authenticatedUsername = nil
local loadedCharacter = nil
local profileSaveRevision = 0
-- [LOGIN PIPELINE] Single-flight guards: a double-clicked login/register or a
-- quick-login racing a manual pick must never run completeAuthentication twice
-- (double transition + double 'authenticationComplete' = double character flow/spawn).
local authRequestBusy = false
local authCompleting = false

local function setBootState(state, reason)
    if GetResourceState('sunset_core') == 'started' then
        pcall(function() exports.sunset_core:SetBootState(state, reason) end)
    end
end

local function authUiSend(action, data)
    if GetResourceState('sunset_auth_ui') == 'started' then
        pcall(function() exports.sunset_auth_ui:Send(action, data or {}) end)
    end
end

local function uiNotify(msg, kind, dur)
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:Notify(msg, kind or 'info', dur or 4000) end)
    end
end

local function tr(key, params)
    if GetResourceState('sunset_core') == 'started' then
        local ok, value = pcall(function() return exports.sunset_core:Translate(key, params or {}) end)
        if ok and type(value) == 'string' then return value end
    end
    return ('[?%s]'):format(tostring(key))
end

local function isEnabled(value)
    if value == true or value == 1 then return true end
    if type(value) == 'string' then
        local normalized = string.lower(value)
        return normalized == 'true' or normalized == '1' or normalized == 'on'
    end
    return false
end

local function activeLicense()
    if type(sessionLicense) == 'string' and sessionLicense ~= '' then
        return sessionLicense
    end
    return nil
end

local function authPayload()
    local store = SunsetAuthAccounts.load(activeLicense())
    return {
        accounts = SunsetAuthAccounts.publicList(store),
        quickLogin = store.quickLogin ~= false,
    }
end

local function pushAuthAccounts()
    authUiSend('authAccounts', authPayload())
end

local function openAuth()
    setBootState('AUTH_FORM', 'login form')
    if GetResourceState('sunset_auth_ui') == 'started' then
        pcall(function()
            exports.sunset_auth_ui:Show('auth', authPayload())
            exports.sunset_auth_ui:SetFocus(true, true)
        end)
    end
end
exports('OpenLogin', openAuth)

local function openQuickAuth(username)
    setBootState('AUTH_BOOT', 'saved login presentation')
    if GetResourceState('sunset_auth_ui') == 'started' then
        local payload = authPayload()
        payload.presentation = 'quick-login'
        payload.loadingText = tr('auth.signing_in')
        payload.username = username
        pcall(function() exports.sunset_auth_ui:Show('auth', payload) end)
    end
end

local function scheduleAuthWatchdog()
    -- Retry only when the dedicated auth UI is not actually visible/open.
    -- Covers both late resource start and dropped NUI messages.
    CreateThread(function()
        for i = 1, 20 do
            Wait(1000)
            if authenticated then return end
            if GetResourceState('sunset_auth_ui') == 'started' then
                local isOpen = false
                pcall(function() isOpen = exports.sunset_auth_ui:IsAuthOpen() end)
                if not isOpen then
                    openAuth()
                else
                    return
                end
            end
        end
    end)
end

local function persistLogin(username, token, rememberQuickLogin)
    local license = activeLicense()
    if not license then return false end
    local _, saved = SunsetAuthAccounts.upsert(license, username, token, isEnabled(rememberQuickLogin))
    return saved == true
end

local function completeAuthentication(username, quickToken, rememberQuickLogin)
    if authCompleting then
        print('^3[AUTH]^7 completeAuthentication ignored: already completing/complete (duplicate login result)')
        return
    end
    authCompleting = true
    local saved = true
    if quickToken and username then
        saved = persistLogin(username, quickToken, rememberQuickLogin)
    end
    pendingAuth = nil
    authenticated = true
    authenticatedUsername = username
    setBootState('CHARACTER_LOADING', 'authentication complete')
    LocalPlayer.state:set('sunsetAuthenticated', true, true)
    local tAuth01 = GetGameTimer()
    print(('^2[LOGIN-PERF] AUTH_SUCCESS | user=%s quickToken=%s^7'):format(
        tostring(username), tostring(quickToken ~= nil)))

    -- Asynchronous UI transitions (non-blocking)
    authUiSend('authSuccess', { text = tr('auth.loading_character') })
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:ShowTransition(tr('auth.loading_character')) end)
        pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'force') end)
    end
    if GetResourceState('sunset_auth_ui') == 'started' then
        pcall(function() exports.sunset_auth_ui:Hide() end)
        pcall(function() exports.sunset_auth_ui:SetFocus(false, false) end)
    end

    if isEnabled(rememberQuickLogin) and not saved then
        uiNotify(tr('auth.quick_save_failed'), 'warning', 7000)
    end

    print(('^2[LOGIN-PERF] AUTH_EVENT_EMITTED +%dms^7'):format(GetGameTimer() - tAuth01))
    TriggerEvent('sunset:client:authenticationComplete')
end

exports('IsAuthenticated', function() return authenticated end)

local function promptEmailSync(username, password, rememberQuickLogin)
    setBootState('AUTH_FORM', 'email confirmation required')
    pendingAuth = {
        username = username,
        password = password,
        rememberQuickLogin = isEnabled(rememberQuickLogin),
    }
    authUiSend('authNeedsEmail', { username = username })
end

local function handleAuthResult(result, username, password, rememberQuickLogin)
    if result and result.needsEmail then
        promptEmailSync(result.username or username, password, rememberQuickLogin)
        return false
    end
    completeAuthentication(username, result and result.quickToken, rememberQuickLogin)
    return true
end

local function performLogin(username, password, rememberQuickLogin)
    local result, err = Sunset.AwaitCallback('sunset:authLogin', username, password)
    if not result then
        setBootState('AUTH_FORM', 'password login failed')
        authUiSend('authError', { message = err })
        uiNotify(err or tr('auth.login_failed'), 'error')
        pushAuthAccounts()
        return false
    end
    if result.needsEmail then
        authUiSend('authError', {})
        promptEmailSync(result.username or username, password, rememberQuickLogin)
        return false
    end
    completeAuthentication(username, result.quickToken, rememberQuickLogin)
    return true
end

RegisterNetEvent('sunset:client:sessionReady', function(data)
    if SunsetBoot and SunsetBoot.Log then
        SunsetBoot.Log('auth', 'session_ready', ('license_present=%s'):format(tostring(data and data.license ~= nil)))
    else
        pcall(function() exports.sunset_core:BootLog('auth', 'session_ready', ('license_present=%s'):format(tostring(data and data.license ~= nil))) end)
    end
    sessionLicense = data and data.license
    if authenticated then return end

    -- Quick login disabled: always show the auth form.
    if SunsetBoot and SunsetBoot.Log then
        SunsetBoot.Log('auth', 'form:open', 'quick login disabled, opening auth form')
    else
        pcall(function() exports.sunset_core:BootLog('auth', 'form:open', 'quick login disabled') end)
    end
    openAuth()
    scheduleAuthWatchdog()
end)

RegisterNetEvent('sunset:auth:openLogin', openAuth)

-- [SAVED ACCOUNTS FIX] The auth screen announces itself once it is rendered;
-- (re)push the saved-account list then, because SendNUIMessage issued before
-- the NUI page is live can be dropped (accounts only appeared after toggling
-- the quick-login checkbox, which triggered a fresh push).
AddEventHandler('sunset:nui:authReady', function(data)
    local locale = data and data.locale
    if locale then
        CreateThread(function()
            Sunset.AwaitCallback('sunset:setConnectionLocale', locale)
        end)
    end
    if not authenticated then
        pushAuthAccounts()
    end
end)

RegisterCommand('fixlogin', function()
    if authenticated then
        uiNotify(tr('auth.already_logged_in'), 'info')
        return
    end
    openAuth()
end, false)
TriggerEvent('chat:addSuggestion', '/fixlogin', tr('auth.fixlogin_help'))

RegisterNetEvent('sunset:client:playerReady', function()
    authenticated = true
    if GetResourceState('sunset_ui') == 'started' then
        -- The auth flow normally releases its own focus before playerReady.
        -- A late ready event must never release another surface's focus.
        local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
        if ok and owner == 'auth' then
            pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'auth') end)
        end
    end
end)

AddEventHandler('sunset:nui:authLogin', function(data)
    if authCompleting then
        -- already signed in and loading: tell the form instead of silently ignoring the click
        authUiSend('authError', { message = tr('auth.already_logged_in') })
        return
    end
    if authRequestBusy then return end
    authRequestBusy = true
    local remember = isEnabled(data and data.rememberQuickLogin)
    CreateThread(function()
        setBootState('AUTHENTICATING', 'password login request')
        local ok, err = pcall(performLogin, data.username, data.password, remember)
        authRequestBusy = false
        if not ok then print(('^1[AUTH]^7 login handler error: %s'):format(tostring(err))) end
    end)
end)

AddEventHandler('sunset:nui:authRegister', function(data)
    if authRequestBusy or authCompleting then return end
    authRequestBusy = true
    local remember = isEnabled(data and data.rememberQuickLogin)
    setBootState('AUTHENTICATING', 'registration request')
    local result, err = Sunset.AwaitCallback(
        'sunset:authRegister',
        data.username,
        data.password,
        data.passwordConfirm,
        data.email
    )
    if not result then
        setBootState('AUTH_FORM', 'registration failed')
        authRequestBusy = false
        authUiSend('authError', { message = err })
        uiNotify(err or tr('auth.registration_failed'), 'error')
        return
    end
    authRequestBusy = false
    uiNotify(tr('auth.account_created'), 'success')
    handleAuthResult(result, data.username, data.password, remember)
end)

AddEventHandler('sunset:nui:authForgotPassword', function(data)
    local identifier = tostring(data and data.identifier or '')
    if identifier == '' then
        authUiSend('authError', { message = 'Te rugăm să introduci username-ul sau emailul contului.' })
        return
    end

    authUiSend('authLoading', { loading = true, text = 'Se trimite emailul de resetare...' })
    local res = Sunset.AwaitCallback('sunset:auth:requestPasswordReset', identifier)
    authUiSend('authLoading', { loading = false })

    if res and res.success then
        authUiSend('authError', { message = res.message or 'Un email de resetare a fost trimis pe adresa asociată contului.' })
        uiNotify(res.message or 'Emailul de resetare a fost trimis!', 'success', 8000)
    else
        authUiSend('authError', { message = res and res.message or 'Eroare la trimiterea emailului de resetare.' })
        uiNotify(res and res.message or 'Eroare la trimiterea emailului.', 'error', 6000)
    end
end)


AddEventHandler('sunset:nui:authSetEmail', function(data)
    local result, err = Sunset.AwaitCallback('sunset:authSetEmail', data and data.email)
    if not result then
        authUiSend('authEmailResult', { ok = false, message = err })
        uiNotify(err or tr('auth.email_save_failed'), 'error')
        return
    end

    local pending = pendingAuth or {}
    uiNotify(tr('auth.email_saved'), 'success')
    authUiSend('authEmailResult', { ok = true })
    completeAuthentication(
        pending.username or result.username,
        result.quickToken,
        pending.rememberQuickLogin
    )
end)

AddEventHandler('sunset:nui:authPickAccount', function(data)
    local username = tostring(data and data.username or '')
    if username == '' then return end

    local license = activeLicense()
    if not license then
        uiNotify(tr('auth.session_not_ready'), 'error')
        return
    end

    local store = SunsetAuthAccounts.load(license)
    local row = SunsetAuthAccounts.find(store, username)
    if not row then
        pushAuthAccounts()
        return
    end

    if type(row.token) == 'string' and row.token ~= '' then
        if authRequestBusy or authCompleting then return end
        authRequestBusy = true
        CreateThread(function()
            setBootState('AUTHENTICATING', 'saved account login request')
            authUiSend('authLoading', { loading = true, text = tr('auth.signing_in') })
            local result, err = Sunset.AwaitCallback('sunset:authQuickLogin', row.username, row.token)
            authRequestBusy = false
            if result and result.needsEmail then
                promptEmailSync(row.username, nil, true)
            elseif result then
                completeAuthentication(row.username, result.quickToken, store.quickLogin ~= false)
            else
                SunsetAuthAccounts.remove(license, row.username)
                setBootState('AUTH_FORM', 'saved token rejected')
                authUiSend('authError', { message = err or tr('auth.saved_expired') })
                pushAuthAccounts()
            end
        end)
        return
    end

    authUiSend('authAccountFill', { username = row.username, password = '' })
end)

AddEventHandler('sunset:nui:authRemoveAccount', function(data)
    local username = tostring(data and data.username or '')
    if username == '' then return end
    local license = activeLicense()
    if not license then return end
    SunsetAuthAccounts.remove(license, username)
    pushAuthAccounts()
end)

AddEventHandler('sunset:nui:authSetQuickLogin', function(data)
    local license = activeLicense()
    if not license then return end
    local enabled = isEnabled(data and data.enabled)
    SunsetAuthAccounts.setQuickLogin(license, enabled)
    pushAuthAccounts()
end)

AddEventHandler('sunset:client:onCharacterLoaded', function(char)
    loadedCharacter = char
end)

local function saveCharacterSnapshot()
    if not authenticatedUsername then return end
    local char = exports.sunset_core:GetCharacter() or loadedCharacter
    if not char then return end
    loadedCharacter = char
    SunsetAuthAccounts.updateProfile(activeLicense(), authenticatedUsername, {
        characterName = (tostring(char.firstname or '') .. ' ' .. tostring(char.lastname or '')):gsub('%s+$', ''),
        characterId = char.id,
        level = char.level,
        cash = char.cash,
        bank = char.bank,
    })
end

AddEventHandler('sunset:client:onCharacterUpdated', function()
    profileSaveRevision = profileSaveRevision + 1
    local revision = profileSaveRevision
    CreateThread(function()
        Wait(1500)
        if revision == profileSaveRevision then saveCharacterSnapshot() end
    end)
end)

AddEventHandler('sunset:client:characterFlowComplete', function()
    if not authenticatedUsername or not loadedCharacter then return end
    CreateThread(function()
        Wait(800)
        saveCharacterSnapshot()
        local currentCharacter = exports.sunset_core:GetCharacter() or loadedCharacter
        local ped = PlayerPedId()
        local handle = RegisterPedheadshot(ped)
        local timeout = GetGameTimer() + 4000
        while (not IsPedheadshotReady(handle) or not IsPedheadshotValid(handle)) and GetGameTimer() < timeout do
            Wait(25)
        end
        if IsPedheadshotValid(handle) then
            local txd = GetPedheadshotTxdString(handle)
            -- Account portraits belong to the dedicated auth document. Sending
            -- this to sunset_ui after the modular split silently discarded it.
            exports.sunset_auth_ui:Send('authCapturePortrait', {
                username = authenticatedUsername,
                characterName = (tostring(currentCharacter.firstname or '') .. ' ' .. tostring(currentCharacter.lastname or '')):gsub('%s+$', ''),
                characterId = currentCharacter.id,
                level = currentCharacter.level,
                cash = currentCharacter.cash,
                bank = currentCharacter.bank,
                source = ('https://nui-img/%s/%s'):format(txd, txd),
            })
            Wait(2500)
        end
        UnregisterPedheadshot(handle)
    end)
end)

AddEventHandler('sunset:nui:authSavePortrait', function(data)
    local username = tostring(data and data.username or '')
    if username == '' or string.lower(username) ~= string.lower(tostring(authenticatedUsername or '')) then return end
    SunsetAuthAccounts.updateProfile(activeLicense(), username, {
        avatar = data and data.avatar,
        characterName = data and data.characterName,
        characterId = data and data.characterId,
        level = data and data.level,
        cash = data and data.cash,
        bank = data and data.bank,
    })
end)

local function openChangePasswordUI()
    if GetResourceState('sunset_ui') == 'started' then
        exports.sunset_ui:Send('openChangePassword', { username = authenticatedUsername })
        exports.sunset_ui:SetFocus(true, true)
    end
end

RegisterNetEvent('sunset:auth:openChangePassUI', openChangePasswordUI)
exports('OpenChangePassword', openChangePasswordUI)

