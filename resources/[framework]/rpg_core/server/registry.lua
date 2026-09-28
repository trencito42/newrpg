RPG = RPG or {}

local Players = {}
local AccountSources = {}
local Finalizing = {}
local AccountLocks = {}
local LoginGuards = {}

local function sourceNumber(value)
    local src = tonumber(value)
    if not src or src <= 0 then return nil end
    return src
end

local function collectIdentifiers(src)
    local identifiers = {}
    for _, raw in ipairs(GetPlayerIdentifiers(src)) do
        local kind, value = raw:match('^([^:]+):(.+)$')
        if kind and value and ({ license = true, license2 = true, fivem = true, discord = true, steam = true, ip = true })[kind] then
            identifiers[#identifiers + 1] = { kind = kind, value = value }
        end
    end
    return identifiers
end

local function guardKey(src, username)
    local license = 'source:' .. tostring(src)
    for _, item in ipairs(collectIdentifiers(src)) do
        if item.kind == 'license' then license = item.value break end
    end
    return license .. ':' .. RPG.Util.Normalize(username)
end

local function checkLoginGuard(src, username)
    local key = guardKey(src, username)
    local now = os.time()
    local guard = LoginGuards[key]
    if not guard then return true, key end
    if guard.lockedUntil and guard.lockedUntil > now then
        return false, key, math.max(1, guard.lockedUntil - now)
    end
    if now - guard.windowStarted >= RPG.Config.auth.attemptsWindowSeconds then
        LoginGuards[key] = nil
    end
    return true, key
end

local function recordLoginFailure(key)
    local now = os.time()
    local guard = LoginGuards[key]
    if not guard or now - guard.windowStarted >= RPG.Config.auth.attemptsWindowSeconds then
        guard = { count = 0, windowStarted = now }
    end
    guard.count = guard.count + 1
    if guard.count >= RPG.Config.auth.attemptsMax then
        guard.lockedUntil = now + RPG.Config.auth.lockSeconds
        RPG.Log('SECURITY', 'Authentication lockout activated', { guard = key, attempts = guard.count })
    end
    LoginGuards[key] = guard
end

local function acquireAccountLock(accountId)
    local deadline = GetGameTimer() + 10000
    while AccountLocks[accountId] do
        if GetGameTimer() >= deadline then return false end
        Wait(25)
    end
    AccountLocks[accountId] = true
    return true
end

local function releaseAccountLock(accountId)
    AccountLocks[accountId] = nil
end

local function hydrate(row, src, sessionId)
    return {
        source = src,
        accountId = tonumber(row.id),
        username = row.username,
        email = row.email,
        adminLevel = tonumber(row.admin_level) or 0,
        helperLevel = tonumber(row.helper_level) or 0,
        accountStatus = row.status,
        sex = row.sex,
        model = row.model,
        tutorialCompleted = row.tutorial_completed == true or tonumber(row.tutorial_completed) == 1,
        position = {
            x = tonumber(row.last_x), y = tonumber(row.last_y), z = tonumber(row.last_z),
            heading = tonumber(row.last_heading),
        },
        health = tonumber(row.health) or 200,
        armor = tonumber(row.armor) or 0,
        dead = row.is_dead == true or tonumber(row.is_dead) == 1,
        level = tonumber(row.level) or 1,
        xp = tonumber(row.xp) or 0,
        money = tonumber(row.money) or 0,
        respectPoints = tonumber(row.respect_points) or 0,
        factionId = row.faction_id and tonumber(row.faction_id) or nil,
        factionLeader = row.faction_leader == true or tonumber(row.faction_leader) == 1,
        totalPlaytimeSeconds = tonumber(row.total_playtime_seconds) or 0,
        createdAt = tostring(row.created_at),
        lastLoginAt = row.last_login_at and tostring(row.last_login_at) or nil,
        state = 'authenticated',
        sessionId = sessionId,
        sessionStartedAt = os.time(),
        lastActivityAt = os.time(),
        lastPersistedAt = os.time(),
        disconnecting = false,
    }
end

local function publicSnapshot(player)
    if not player then return nil end
    return {
        source = player.source,
        accountId = player.accountId,
        username = player.username,
        adminLevel = player.adminLevel,
        helperLevel = player.helperLevel,
        sex = player.sex,
        model = player.model,
        tutorialCompleted = player.tutorialCompleted,
        position = { x = player.position.x, y = player.position.y, z = player.position.z, heading = player.position.heading },
        health = player.health,
        armor = player.armor,
        dead = player.dead,
        level = player.level,
        xp = player.xp,
        money = player.money,
        respectPoints = player.respectPoints,
        factionId = player.factionId,
        factionLeader = player.factionLeader,
        totalPlaytimeSeconds = player.totalPlaytimeSeconds,
        createdAt = player.createdAt,
        lastLoginAt = player.lastLoginAt,
        state = player.state,
        sessionStartedAt = player.sessionStartedAt,
    }
end

function GetPlayer(src)
    return publicSnapshot(Players[sourceNumber(src)])
end

function GetPlayerByAccountId(accountId)
    local src = AccountSources[tonumber(accountId)]
    return src and GetPlayer(src) or nil
end

function IsPlayerActive(src)
    local player = Players[sourceNumber(src)]
    return player ~= nil and player.state == 'active' and not player.disconnecting
end

function GetAccountId(src)
    local player = Players[sourceNumber(src)]
    return player and player.accountId or nil
end

function GetUsername(src)
    local player = Players[sourceNumber(src)]
    return player and player.username or nil
end

function GetAdminLevel(src)
    local player = Players[sourceNumber(src)]
    return player and player.adminLevel or 0
end

function GetHelperLevel(src)
    local player = Players[sourceNumber(src)]
    return player and player.helperLevel or 0
end

function HasAdminLevel(src, level)
    return GetAdminLevel(src) >= (tonumber(level) or 0)
end

function SetLifecycleState(src, nextState)
    src = sourceNumber(src)
    local player = src and Players[src]
    if not player or type(nextState) ~= 'string' then return false, 'Player is not authenticated.' end
    if player.state == nextState then return true end
    local allowed = RPG.Config.lifecycle[player.state]
    if not allowed or not allowed[nextState] then
        RPG.Log('SECURITY', 'Rejected player lifecycle transition', { source = src, from = player.state, to = nextState })
        return false, ('Invalid lifecycle transition: %s -> %s'):format(player.state, nextState)
    end
    player.state = nextState
    player.lastActivityAt = os.time()
    Player(src).state:set('rpg:active', nextState == 'active', true)
    TriggerEvent('rpg:server:lifecycleChanged', src, nextState)
    return true
end

local function observeIdentifiers(src, accountId)
    for _, item in ipairs(collectIdentifiers(src)) do
        MySQL.query.await([[
            INSERT INTO account_identifiers (account_id, identifier_type, identifier_value)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP(6)
        ]], { accountId, item.kind, item.value })
    end
end

local function accountBan(accountId)
    return MySQL.single.await([[
        SELECT id, reason, expires_at
        FROM sanctions
        WHERE target_account_id = ? AND sanction_type = 'ban' AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(6))
        ORDER BY created_at DESC LIMIT 1
    ]], { accountId })
end

local function activate(src, row)
    local accountId = tonumber(row.id)
    if not acquireAccountLock(accountId) then return nil, 'Authentication is busy. Please try again.' end

    local ok, result, failure = xpcall(function()
        local oldSource = AccountSources[accountId]
        if oldSource and oldSource ~= src then
            local saved, saveError = RPG.FinalizePlayer(oldSource, 'duplicate_login')
            if not saved then
                return nil, 'The previous session could not be saved. Please try again shortly: ' .. tostring(saveError)
            end
            DropPlayer(oldSource, 'Your account was logged in from another client.')
        end

        if Players[src] then
            local finalized, finalizeError = RPG.FinalizePlayer(src, 'source_reauthenticated')
            if not finalized then return nil, finalizeError end
        end

        local sessionId = RPG.Util.Uuid()
        local transaction = MySQL.transaction.await({
            {
                query = [[UPDATE sessions SET ended_at = UTC_TIMESTAMP(6), end_reason = 'recovered_stale_session'
                          WHERE account_id = ? AND ended_at IS NULL]],
                values = { accountId },
            },
            {
                query = [[INSERT INTO sessions (id, account_id, server_source) VALUES (?, ?, ?)]],
                values = { sessionId, accountId, src },
            },
            {
                query = [[UPDATE accounts SET last_login_at = UTC_TIMESTAMP(6), last_seen_at = UTC_TIMESTAMP(6),
                          login_count = login_count + 1 WHERE id = ?]],
                values = { accountId },
            },
        })
        if not transaction then return nil, 'The database rejected the session.' end

        local player = hydrate(row, src, sessionId)
        Players[src] = player
        AccountSources[accountId] = src
        observeIdentifiers(src, accountId)
        Player(src).state:set('rpg:active', false, true)
        TriggerEvent('rpg:server:authenticated', src, publicSnapshot(player))
        return publicSnapshot(player)
    end, debug.traceback)

    releaseAccountLock(accountId)
    if not ok then
        RPG.Log('ERROR', 'Account activation failed', { source = src, accountId = accountId, error = result })
        return nil, 'Authentication service is temporarily unavailable.'
    end
    return result, failure
end

function Authenticate(src, username, password)
    src = sourceNumber(src)
    if not src then return nil, 'Invalid source.' end
    if Players[src] then return nil, 'This connection is already authenticated.' end
    username = RPG.Util.Normalize(username)
    if username == '' or type(password) ~= 'string' then return nil, 'Invalid username or password.' end
    local allowed, key, remaining = checkLoginGuard(src, username)
    if not allowed then return nil, ('Too many attempts. Try again in %d seconds.'):format(remaining) end

    local ok, row = pcall(MySQL.single.await, [[
        SELECT a.*, p.sex, p.model, p.tutorial_completed, p.last_x, p.last_y, p.last_z, p.last_heading,
               p.health, p.armor, p.is_dead, p.level, p.xp, p.money, p.respect_points,
               p.faction_id, p.faction_leader, p.total_playtime_seconds
        FROM accounts a JOIN players p ON p.account_id = a.id
        WHERE a.username_normalized = ? LIMIT 1
    ]], { username })
    if not ok then
        RPG.Log('ERROR', 'Login database query failed', { source = src, operation = 'login' })
        return nil, 'Authentication service is temporarily unavailable.'
    end
    if not row or row.status ~= 'active' or not exports.rpg_core:VerifyPassword(password, row.password_hash) then
        recordLoginFailure(key)
        return nil, 'Invalid username or password.'
    end
    local ban = accountBan(row.id)
    if ban then return nil, 'This account is banned. Reason: ' .. tostring(ban.reason) end
    LoginGuards[key] = nil
    return activate(src, row)
end

local function validateRegistration(data)
    if type(data) ~= 'table' then return nil, 'Invalid registration data.' end
    local username = RPG.Util.Trim(data.username)
    local normalizedUsername = RPG.Util.Normalize(username)
    local email = RPG.Util.Trim(data.email)
    local normalizedEmail = RPG.Util.Normalize(email)
    local password = data.password
    local sex = data.sex
    if #username < RPG.Config.auth.usernameMin or #username > RPG.Config.auth.usernameMax or not username:match('^[A-Za-z0-9_]+$') then
        return nil, 'Username must be 3-24 characters using letters, numbers, or underscore.'
    end
    if type(password) ~= 'string' or #password < RPG.Config.auth.passwordMin or #password > RPG.Config.auth.passwordMax then
        return nil, 'Password must be 10-128 characters.'
    end
    if #email > RPG.Config.auth.emailMax or not normalizedEmail:match('^[^%s@]+@[^%s@]+%.[^%s@]+$') then
        return nil, 'Enter a valid email address.'
    end
    if sex ~= 'male' and sex ~= 'female' then return nil, 'Sex must be Male or Female.' end
    return {
        username = username,
        normalizedUsername = normalizedUsername,
        email = email,
        normalizedEmail = normalizedEmail,
        password = password,
        sex = sex,
        model = RPG.Config.models[sex],
    }
end

function RegisterAccount(src, data)
    src = sourceNumber(src)
    if not src then return nil, 'Invalid source.' end
    if Players[src] then return nil, 'This connection is already authenticated.' end
    local clean, validationError = validateRegistration(data)
    if not clean then return nil, validationError end
    local hash = exports.rpg_core:HashPassword(clean.password)
    clean.password = nil
    if not hash then return nil, 'Password could not be secured.' end

    local ok, transaction = pcall(MySQL.transaction.await, {
        {
            query = [[INSERT INTO accounts (username, username_normalized, email, email_normalized, password_hash)
                      VALUES (?, ?, ?, ?, ?)]],
            values = { clean.username, clean.normalizedUsername, clean.email, clean.normalizedEmail, hash },
        },
        {
            query = [[INSERT INTO players (account_id, sex, model) VALUES (LAST_INSERT_ID(), ?, ?)]],
            values = { clean.sex, clean.model },
        },
    })
    hash = nil
    if not ok or not transaction then
        local duplicateUser = MySQL.scalar.await('SELECT id FROM accounts WHERE username_normalized = ? LIMIT 1', { clean.normalizedUsername })
        if duplicateUser then return nil, 'That username is already registered.' end
        local duplicateEmail = MySQL.scalar.await('SELECT id FROM accounts WHERE email_normalized = ? LIMIT 1', { clean.normalizedEmail })
        if duplicateEmail then return nil, 'That email is already registered.' end
        RPG.Log('ERROR', 'Registration transaction failed', { source = src, operation = 'register' })
        return nil, 'Registration could not be completed.'
    end

    local row = MySQL.single.await([[
        SELECT a.*, p.sex, p.model, p.tutorial_completed, p.last_x, p.last_y, p.last_z, p.last_heading,
               p.health, p.armor, p.is_dead, p.level, p.xp, p.money, p.respect_points,
               p.faction_id, p.faction_leader, p.total_playtime_seconds
        FROM accounts a JOIN players p ON p.account_id = a.id
        WHERE a.username_normalized = ? LIMIT 1
    ]], { clean.normalizedUsername })
    if not row then return nil, 'Registration succeeded but the profile could not be loaded. Reconnect to continue.' end
    return activate(src, row)
end

function SavePlayer(src, reason)
    src = sourceNumber(src)
    local player = src and Players[src]
    if not player then return false, 'Player is not authenticated.' end
    local now = os.time()
    local delta = math.max(0, now - player.lastPersistedAt)
    local ped = GetPlayerPed(src)
    if ped and ped ~= 0 and DoesEntityExist(ped) then
        local coords = GetEntityCoords(ped)
        local health = GetEntityHealth(ped)
        player.health = RPG.Util.Clamp(health, 0, 200)
        player.armor = RPG.Util.Clamp(GetPedArmour(ped), 0, 100)
        player.dead = health <= 0
    end
    local affected = MySQL.update.await([[
        UPDATE players SET last_x = ?, last_y = ?, last_z = ?, last_heading = ?, health = ?, armor = ?,
            is_dead = ?, total_playtime_seconds = total_playtime_seconds + ? WHERE account_id = ?
    ]], {
        player.position.x, player.position.y, player.position.z, player.position.heading,
        player.health, player.armor, player.dead and 1 or 0, delta, player.accountId,
    })
    if affected ~= 1 then
        RPG.Log('ERROR', 'Player persistence failed', { source = src, accountId = player.accountId, reason = reason })
        return false, 'Player data was not saved.'
    end
    player.totalPlaytimeSeconds = player.totalPlaytimeSeconds + delta
    player.lastPersistedAt = now
    player.lastActivityAt = now
    MySQL.update.await('UPDATE sessions SET last_activity_at = UTC_TIMESTAMP(6), playtime_seconds = ? WHERE id = ? AND ended_at IS NULL', {
        math.max(0, now - player.sessionStartedAt), player.sessionId,
    })
    MySQL.update.await('UPDATE accounts SET last_seen_at = UTC_TIMESTAMP(6) WHERE id = ?', { player.accountId })
    return true
end

function RPG.FinalizePlayer(src, reason, forceCleanup)
    src = sourceNumber(src)
    if not src then return true end
    if Finalizing[src] then
        local deadline = GetGameTimer() + 10000
        while Finalizing[src] and GetGameTimer() < deadline do Wait(25) end
        return Players[src] == nil, Players[src] and 'Finalization timed out.' or nil
    end
    local player = Players[src]
    if not player then return true end
    Finalizing[src] = true
    local previousState = player.state
    player.disconnecting = true
    if player.state ~= 'disconnecting' then SetLifecycleState(src, 'disconnecting') end

    local saveCallOk, saved, saveError = pcall(SavePlayer, src, reason)
    if not saveCallOk then saved, saveError = false, saved end
    if not saved and not forceCleanup then
        player.disconnecting = false
        player.state = previousState
        Player(src).state:set('rpg:active', previousState == 'active', true)
        Finalizing[src] = nil
        RPG.Log('ERROR', 'Finalization retained player after persistence failure', { source = src, accountId = player.accountId, error = saveError })
        return false, 'The player session could not be saved safely.'
    end
    local now = os.time()
    local closeOk, ended = pcall(MySQL.update.await, [[
            UPDATE sessions SET ended_at = UTC_TIMESTAMP(6), end_reason = ?, last_activity_at = UTC_TIMESTAMP(6),
                playtime_seconds = ? WHERE id = ? AND ended_at IS NULL
        ]], { RPG.Util.SafeString(reason or 'disconnect', 191) or 'disconnect', math.max(0, now - player.sessionStartedAt), player.sessionId })
    if not closeOk or ended ~= 1 then RPG.Log('WARN', 'Session close was unavailable or already complete', { source = src, sessionId = player.sessionId }) end

    AccountSources[player.accountId] = nil
    Players[src] = nil
    Finalizing[src] = nil
    Player(src).state:set('rpg:active', false, true)
    TriggerEvent('rpg:server:playerFinalized', src, player.accountId, reason)
    return saved and closeOk, saveError or (not closeOk and 'Session close failed.' or nil)
end

function CompleteTutorial(src)
    src = sourceNumber(src)
    local player = src and Players[src]
    if not player or player.state ~= 'onboarding' then return false, 'Tutorial completion is not currently allowed.' end
    local affected = MySQL.update.await('UPDATE players SET tutorial_completed = TRUE WHERE account_id = ? AND tutorial_completed = FALSE', { player.accountId })
    if affected == nil then return false, 'Tutorial progress could not be saved.' end
    player.tutorialCompleted = true
    return true
end

function GetPlayerStats(src)
    local player = Players[sourceNumber(src)]
    if not player then return nil end
    local total = player.totalPlaytimeSeconds + math.max(0, os.time() - player.lastPersistedAt)
    return {
        id = player.accountId,
        username = player.username,
        sex = player.sex,
        level = player.level,
        xp = player.xp,
        money = player.money,
        respectPoints = player.respectPoints,
        factionId = player.factionId,
        factionLeader = player.factionLeader,
        totalPlaytimeSeconds = total,
        sessionPlaytimeSeconds = math.max(0, os.time() - player.sessionStartedAt),
        createdAt = player.createdAt,
        lastLoginAt = player.lastLoginAt,
        tutorialCompleted = player.tutorialCompleted,
    }
end

local allowedStats = { xp = true, level = true, money = true, respectPoints = true }
function IncrementStat(src, stat, amount)
    local player = Players[sourceNumber(src)]
    amount = tonumber(amount)
    if not player or not allowedStats[stat] or not amount or amount < 0 or amount > 100000000 then return false end
    local columns = { xp = 'xp', level = 'level', money = 'money', respectPoints = 'respect_points' }
    local column = columns[stat]
    local affected = MySQL.update.await(('UPDATE players SET %s = %s + ? WHERE account_id = ?'):format(column, column), { math.floor(amount), player.accountId })
    if affected == 1 then player[stat] = player[stat] + math.floor(amount) return true end
    return false
end

function SetStat(src, stat, value)
    local player = Players[sourceNumber(src)]
    value = tonumber(value)
    if not player or not allowedStats[stat] or not value or value < (stat == 'level' and 1 or 0) then return false end
    local columns = { xp = 'xp', level = 'level', money = 'money', respectPoints = 'respect_points' }
    local affected = MySQL.update.await(('UPDATE players SET %s = ? WHERE account_id = ?'):format(columns[stat]), { math.floor(value), player.accountId })
    if affected == 1 then player[stat] = math.floor(value) return true end
    return false
end

function SetAdminLevel(accountId, level)
    accountId, level = tonumber(accountId), tonumber(level)
    if not accountId or not level or level < 0 or level > 6 then return false end
    local affected = MySQL.update.await('UPDATE accounts SET admin_level = ? WHERE id = ?', { level, accountId })
    local src = AccountSources[accountId]
    if affected == 1 and src and Players[src] then Players[src].adminLevel = level end
    return affected == 1
end


function RPG.RefreshHelperLevel(accountId)
    accountId = tonumber(accountId)
    if not accountId then return nil end
    local level = tonumber(MySQL.scalar.await('SELECT helper_level FROM accounts WHERE id = ?', { accountId }))
    local src = AccountSources[accountId]
    if level and src and Players[src] then Players[src].helperLevel = level end
    return level
end

function RPG.RefreshProfileFields(accountId)
    accountId = tonumber(accountId)
    if not accountId then return nil end
    local row = MySQL.single.await('SELECT level,xp,money,respect_points,faction_id,faction_leader FROM players WHERE account_id=?', { accountId })
    local src = AccountSources[accountId]
    local current = src and Players[src] or nil
    if not row or not current then return row ~= nil end
    current.level = tonumber(row.level) or current.level
    current.xp = tonumber(row.xp) or current.xp
    current.money = tonumber(row.money) or current.money
    current.respectPoints = tonumber(row.respect_points) or current.respectPoints
    current.factionId = row.faction_id and tonumber(row.faction_id) or nil
    current.factionLeader = row.faction_leader == true or tonumber(row.faction_leader) == 1
    return true
end

function RPG.RefreshAdminLevel(accountId)
    accountId = tonumber(accountId)
    if not accountId then return nil end
    local level = MySQL.scalar.await('SELECT admin_level FROM accounts WHERE id = ?', { accountId })
    level = tonumber(level)
    local src = AccountSources[accountId]
    if level and src and Players[src] then Players[src].adminLevel = level end
    return level
end

function GetHealthSnapshot()
    local online, authenticated, active = #GetPlayers(), 0, 0
    for _, player in pairs(Players) do
        authenticated = authenticated + 1
        if player.state == 'active' then active = active + 1 end
    end
    return { online = online, authenticated = authenticated, active = active }
end

AddEventHandler('playerDropped', function(reason)
    local src = source
    if Players[src] then
        local ok, err = xpcall(function() RPG.FinalizePlayer(src, reason or 'player_dropped', true) end, debug.traceback)
        if not ok then RPG.Log('ERROR', 'Disconnect finalization crashed', { source = src, error = err }) end
    end
end)

exports('GetPlayer', GetPlayer)
exports('GetPlayerByAccountId', GetPlayerByAccountId)
exports('IsPlayerActive', IsPlayerActive)
exports('GetAccountId', GetAccountId)
exports('GetUsername', GetUsername)
exports('GetAdminLevel', GetAdminLevel)
exports('HasAdminLevel', HasAdminLevel)
exports('GetHelperLevel', GetHelperLevel)
exports('Authenticate', Authenticate)
exports('RegisterAccount', RegisterAccount)
exports('SetLifecycleState', SetLifecycleState)
exports('CompleteTutorial', CompleteTutorial)
exports('SavePlayer', SavePlayer)
exports('GetPlayerStats', GetPlayerStats)
exports('IncrementStat', IncrementStat)
exports('SetStat', SetStat)
exports('SetAdminLevel', SetAdminLevel)
exports('RefreshAdminLevel', RPG.RefreshAdminLevel)
exports('RefreshHelperLevel', RPG.RefreshHelperLevel)
exports('RefreshProfileFields', RPG.RefreshProfileFields)
exports('GetHealthSnapshot', GetHealthSnapshot)
