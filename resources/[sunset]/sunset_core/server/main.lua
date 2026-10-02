local Players = {}
local ConnectionLocales = {}
local Callbacks = {}
local Sessions = {}
local CallbackRate = {}
local CallbackNameRate = {}
local FlowTraceRate = {}
local EXPENSIVE_CALLBACK_LIMITS = {
    ['sunset:authLogin'] = 2,
    ['sunset:authQuickLogin'] = 2,
    ['sunset:getInventory'] = 4,
    ['sunset:getPhoneData'] = 3,
    ['sunset:getScoreboard'] = 4,
    ['sunset:trade:commit'] = 2,
    ['sunset:craftItem'] = 3,
    ['sunset:dealership:purchase'] = 2,
    -- [SEC-PERMIT] Corrected from phantom 'sunset:propertyBuy/Rent' — actual
    -- registered names are 'sunset:buyProperty' / 'sunset:rentProperty'.
    ['sunset:buyProperty'] = 2,
    ['sunset:rentProperty'] = 2,
}

-- ═══ HIGH-PERFORMANCE ONLINE STATE INDEXES ═══
local SourceByCharacterId = {}
local OnlineCharacters = {}
local SourceByPlayerId = {}
local SourceByAccountId = {}
local PedToPlayerSource = {}

local function indexRegisterPlayer(source, player)
    if not source or not player then return end
    if player.id then SourceByPlayerId[player.id] = source end
    if player.account_id then SourceByAccountId[player.account_id] = source end
    if player.character and player.character.id then
        local cid = tonumber(player.character.id)
        SourceByCharacterId[cid] = source
        OnlineCharacters[cid] = source
    end
    local ped = GetPlayerPed(source)
    if ped and ped ~= 0 then PedToPlayerSource[ped] = source end
end

local function indexUnregisterPlayer(source, player)
    if not source then return end
    if player then
        if player.id and SourceByPlayerId[player.id] == source then SourceByPlayerId[player.id] = nil end
        if player.account_id and SourceByAccountId[player.account_id] == source then SourceByAccountId[player.account_id] = nil end
        if player.character and player.character.id then
            local cid = tonumber(player.character.id)
            SourceByCharacterId[cid] = nil
            OnlineCharacters[cid] = nil
        end
    end
    for ped, src in pairs(PedToPlayerSource) do
        if src == source then PedToPlayerSource[ped] = nil end
    end
end

local function updatePedMapping(source)
    local ped = GetPlayerPed(source)
    if ped and ped ~= 0 then
        -- Clear old ped reference for this source
        for oldPed, src in pairs(PedToPlayerSource) do
            if src == source and oldPed ~= ped then
                PedToPlayerSource[oldPed] = nil
            end
        end
        PedToPlayerSource[ped] = source
    end
end

RegisterNetEvent('sunset:server:updatePlayerPed', function()
    local src = source
    updatePedMapping(src)
end)

function UpdatePlayerPed(source)
    updatePedMapping(source)
end
exports('UpdatePlayerPed', UpdatePlayerPed)

RegisterNetEvent('sunset:server:flowTrace', function(stage, detail)
    local source = source
    -- [SEC-PERMIT] Rate cap: 500 ms minimum between traces per source.
    -- flowTrace was 100 ms => a 32-player server could produce ~320 lines/s.
    -- In production (sunset_dev 0) traces are suppressed entirely.
    if type(stage) ~= 'string' or #stage > 64 or type(detail) ~= 'string' or #detail > 160 then return end
    if not SunsetBoot.IsDebug() then return end -- no-op in production
    local now = GetGameTimer()
    local previous = FlowTraceRate[source] or 0
    if now - previous < 500 then return end
    FlowTraceRate[source] = now
    print(('[SunsetFlow:%d] %s%s'):format(source, stage, detail ~= '' and (' | ' .. detail) or ''))
end)

Sunset.GetPlayer = function(source) return Players[source] end
Sunset.GetCharacter = function(source)
    local p = Players[source]
    return p and p.character or nil
end

function GetSourceByPed(pedEntity)
    if not pedEntity or pedEntity == 0 then return nil end
    local src = PedToPlayerSource[pedEntity]
    if src and DoesEntityExist(pedEntity) and GetPlayerPed(src) == pedEntity then
        return src
    end

    -- Fast OneSync entity owner check: under OneSync, NetworkGetEntityOwner returns the player source owning the ped!
    local owner = NetworkGetEntityOwner(pedEntity)
    if owner and owner > 0 and DoesEntityExist(pedEntity) and GetPlayerPed(owner) == pedEntity then
        PedToPlayerSource[pedEntity] = owner
        return owner
    end

    -- Fallback scan and cache refresh
    for s, p in pairs(Players) do
        local ped = GetPlayerPed(s)
        if ped and ped ~= 0 then
            PedToPlayerSource[ped] = s
            if ped == pedEntity then
                return s
            end
        end
    end
    return nil
end
exports('GetSourceByPed', GetSourceByPed)

function GetSourceByCharacterId(characterId)
    characterId = tonumber(characterId)
    if not characterId then return nil end
    local src = SourceByCharacterId[characterId]
    if src and Players[src] and Players[src].character and tonumber(Players[src].character.id) == characterId then
        return src
    end
    -- Fallback scan
    for s, p in pairs(Players) do
        if p.character and tonumber(p.character.id) == characterId then
            SourceByCharacterId[characterId] = s
            OnlineCharacters[characterId] = s
            return s
        end
    end
    SourceByCharacterId[characterId] = nil
    OnlineCharacters[characterId] = nil
    return nil
end
exports('GetSourceByCharacterId', GetSourceByCharacterId)

function GetSourceByPlayerId(playerId)
    playerId = tonumber(playerId)
    if not playerId then return nil end
    local src = SourceByPlayerId[playerId]
    if src and Players[src] and tonumber(Players[src].id) == playerId then
        return src
    end
    return nil
end
exports('GetSourceByPlayerId', GetSourceByPlayerId)

function GetSourceByAccountId(accountId)
    accountId = tonumber(accountId)
    if not accountId then return nil end
    local src = SourceByAccountId[accountId]
    if src and Players[src] and tonumber(Players[src].account_id) == accountId then
        return src
    end
    return nil
end
exports('GetSourceByAccountId', GetSourceByAccountId)

function GetOnlineCharacters()
    return OnlineCharacters
end
exports('GetOnlineCharacters', GetOnlineCharacters)

local function normalizeLocale(locale)
    locale = type(locale) == 'string' and locale:lower() or ''
    return Sunset.IsValidLocale(locale) and locale or nil
end

function Sunset.GetPlayerLocale(source)
    local player = Players[tonumber(source)]
    return normalizeLocale(player and player.language)
        or normalizeLocale(ConnectionLocales[tonumber(source)])
        or (Sunset.Config and Sunset.Config.DefaultLanguage)
        or 'en'
end

function Sunset.SetConnectionLocale(source, locale)
    source = tonumber(source)
    locale = normalizeLocale(locale)
    if not source or not locale then return false end
    ConnectionLocales[source] = locale
    return true
end

function Sunset.TFor(source, key, params, ...)
    return Sunset.Translate(Sunset.GetPlayerLocale(source), key, params, ...)
end

function Sunset.NotifyFor(source, key, params, notificationType, duration)
    TriggerClientEvent('sunset:client:notify', source, Sunset.TFor(source, key, params), notificationType or 'info', duration)
end

function Sunset.BroadcastLocalized(key, params, notificationType, duration)
    for source in pairs(Players) do
        Sunset.NotifyFor(source, key, params, notificationType, duration)
    end
end

function Sunset.LocalizedError(key, params)
    return { localeKey = tostring(key), params = type(params) == 'table' and params or {} }
end

local function resolveLocalizedError(source, err)
    if type(err) == 'table' and type(err.localeKey) == 'string' then
        if type(err.formatArgs) == 'table' then
            return Sunset.Translate(
                Sunset.GetPlayerLocale(source),
                err.localeKey,
                table.unpack(err.formatArgs)
            )
        end
        return Sunset.TFor(source, err.localeKey, err.params)
    end
    return err
end

function Sunset.SetPlayerLocale(source, locale)
    source = tonumber(source)
    locale = normalizeLocale(locale)
    local player = source and Players[source]
    if not source or not player or not locale then return false end

    local changed = MySQL.update.await(
        'UPDATE accounts SET language = ? WHERE id = ?',
        { locale, player.account_id }
    )
    if changed == nil then return false end

    player.language = locale
    Player(source).state:set('sunsetLocale', locale, true)
    TriggerClientEvent('sunset:client:localeChanged', source, locale)
    TriggerEvent('sunset:server:localeChanged', source, locale)
    return true
end

-- ═══ CALLBACKS ═══

function RegisterCallback(name, cb)
    Callbacks[name] = cb
end
exports('RegisterCallback', RegisterCallback)

RegisterCallback('sunset:setLocale', function(source, locale)
    locale = normalizeLocale(locale)
    if not locale then
        return nil, Sunset.LocalizedError('locale.invalid')
    end
    if not Sunset.SetPlayerLocale(source, locale) then
        return nil, Sunset.LocalizedError('locale.save_failed')
    end
    return { locale = locale }
end)

RegisterCallback('sunset:setConnectionLocale', function(source, locale)
    if not Sunset.SetConnectionLocale(source, locale) then
        return nil, Sunset.LocalizedError('locale.invalid')
    end
    return { locale = Sunset.GetPlayerLocale(source) }
end)

RegisterNetEvent('sunset:server:triggerCallback', function(name, requestId, ...)
    local source = source
if type(name) ~= 'string' or #name > 80 or type(requestId) ~= 'number' then return end
    local now = GetGameTimer()
    local rate = CallbackRate[source]
    if not rate or now - rate.window >= 1000 then
        rate = { window = now, count = 0 }
        CallbackRate[source] = rate
    end
    rate.count = rate.count + 1
    if rate.count > 30 then
        print(('^3[racket.gg]^7 Callback flood blocked from %s'):format(source))
        TriggerClientEvent('sunset:client:callbackResponse', source, requestId, { __cb = true, result = nil, err = Sunset.TFor(source, 'error.too_many_requests') })
        return
    end
    CallbackNameRate[source] = CallbackNameRate[source] or {}
    local named = CallbackNameRate[source][name]
    if not named or now - named.window >= 1000 then
        named = { window = now, count = 0 }
        CallbackNameRate[source][name] = named
    end
    named.count = named.count + 1
    local namedLimit = EXPENSIVE_CALLBACK_LIMITS[name] or 12
    if named.count > namedLimit then
        TriggerClientEvent('sunset:client:callbackResponse', source, requestId, {
            __cb = true, result = nil,
            err = Sunset.TFor(source, 'error.action_too_fast')
        })
        return
    end
    if not Callbacks[name] then
        TriggerClientEvent('sunset:client:callbackResponse', source, requestId, { __cb = true, result = nil, err = Sunset.TFor(source, 'error.action_unavailable') })
        return
    end

    local isBootDebug = SunsetBoot.IsDebug()
    local isSpecialTrace = (name == 'sunset:enterGame')
    local tStart = (isBootDebug or isSpecialTrace) and GetGameTimer() or 0
    if isSpecialTrace then
        print(('^3[CB-PERF] enterGame SERVER_EVENT_RECEIVED id=%s src=%s^7'):format(tostring(requestId), tostring(source)))
        print(('^3[CB-PERF] enterGame HANDLER_BEGIN^7'))
    elseif isBootDebug then
        print(('^5[BOOTV src=%d] callback %s START^7'):format(source, name))
    end

    local ok, packed = pcall(function(...)
        local result, err = Callbacks[name](source, ...)
        return { result = result, err = err }
    end, ...)

    local dur = ((isBootDebug or isSpecialTrace) and (GetGameTimer() - tStart)) or 0
    if isSpecialTrace then
        print(('^3[CB-PERF] enterGame HANDLER_END dur=%d^7'):format(dur))
    elseif isBootDebug then
        local flag = ''
        if dur >= 1000 then flag = ' ^1[STALL]^5'
        elseif dur >= 500 then flag = ' ^1[VERY SLOW]^5'
        elseif dur >= 100 then flag = ' ^3[SLOW]^5' end
        print(('^5[BOOTV src=%d] callback %s END %dms%s (ok=%s)^7'):format(source, name, dur, flag, tostring(ok and not packed.err)))
    end

    if not ok then
        print(('^1[racket.gg]^7 Callback error (%s): %s'):format(name, tostring(packed)))
        if isSpecialTrace then
            print(('^1[CB-PERF] enterGame RESPONSE_SENT id=%s (error)^7'):format(tostring(requestId)))
        end
        TriggerClientEvent('sunset:client:callbackResponse', source, requestId, {
            __cb = true,
            result = nil,
            err = Sunset.TFor(source, 'error.server_action_failed')
        })
        return
    end

    if isSpecialTrace then
        print(('^2[CB-PERF] enterGame RESPONSE_SENT id=%s^7'):format(tostring(requestId)))
    end
    TriggerClientEvent('sunset:client:callbackResponse', source, requestId, {
        __cb = true,
        result = packed.result,
        err = resolveLocalizedError(source, packed.err)
    })
end)

-- ═══ SESSION ═══

local function getLicense(source)
    return Sunset.GetIdentifier(source, 'license')
end

-- ═══ SPAWN PERMIT LIFECYCLE ═══
-- [SEC-PERMIT] Explicit single-use spawn permits replace the old
-- `if isAuth or oldBucket ~= 0` bypass, which let ANY player in bucket 9999
-- escape auth isolation by sending prepareSpawn without being authenticated.
--
-- Lifecycle:
--   IssueSpawnPermit(src)  → called by LoadCharacter after character is durable
--   prepareSpawn           → validates permit; single-use; releases bucket
--   clearSpawnPermit(src)  → called on disconnect / duplicate login / restart
--
-- Invariants:
--   • A permit may only be issued for an authenticated session with a loaded character.
--   • requestId is server-generated — client cannot guess or replay it.
--   • Permits expire after SPAWN_PERMIT_TTL_MS (15 s).
--   • Consuming a permit removes it immediately (single-use).
--   • Re-spawns (death/respawn) issue a fresh permit.
local SpawnPermits = {}
local SPAWN_PERMIT_TTL_MS = 15000

local function clearSpawnPermit(src)
    SpawnPermits[src] = nil
end

local function issueSpawnPermit(src)
    local session = Sessions[src]
    local player  = Players[src]
    if not session or not session.authenticated then
        Sunset.Warn(('[SEC-PERMIT] IssueSpawnPermit refused: src=%d not authenticated'):format(src))
        return nil
    end
    if not player or not player.character or not player.character.id then
        Sunset.Warn(('[SEC-PERMIT] IssueSpawnPermit refused: src=%d no loaded character'):format(src))
        return nil
    end
    -- Server-generated nonce — client cannot predict or forge this.
    local reqId = math.random(1000000, 9999999) .. '_' .. math.random(1000000, 9999999)
    SpawnPermits[src] = {
        requestId   = reqId,
        accountId   = player.account_id,
        characterId = tonumber(player.character.id),
        issuedAt    = GetGameTimer(),
        used        = false,
    }
    return reqId
end
exports('IssueSpawnPermit', issueSpawnPermit)

RegisterNetEvent('sunset:server:playerLoaded', function()
    local source = source
    -- [AUDIT P2-03] Ignore replays: an authenticated client must never be able to
    -- reset its own session flag mid-game (account hopping / unsaved character swap).
    local existing = Sessions[source]
    if existing and existing.authenticated then return end

    local license = getLicense(source)
    if not license then
        DropPlayer(source, Sunset.TFor(source, 'auth.license_failed'))
        return
    end

    Sessions[source] = { license = license, authenticated = false }
    -- Isolate the player from the open world while on the auth screen.
    -- FiveM will not stream world geometry for bucket 9999, eliminating
    -- the freeze that happens when ShutdownLoadingScreen() is called.
    SetPlayerRoutingBucket(source, 9999)
    clearSpawnPermit(source) -- ensure no stale permit from a previous session
    TriggerClientEvent('sunset:client:sessionReady', source, { license = license })
    Sunset.Debug('Session ready:', source)
end)

-- Moves the player back to the main routing bucket right before spawn
-- streaming begins (called by sunset_spawn before streamSpawnArea).
-- [SEC-PERMIT] SECURITY: The old implementation released ANY player in bucket
-- 9999 via `if isAuth or oldBucket ~= 0`.  Since every auth-screen player is
-- in bucket 9999, an unauthenticated player could send this event and escape
-- isolation.  The new implementation requires a valid single-use spawn permit
-- issued by the server only after the character is loaded and the session is
-- authenticated.  The client must present the requestId it received from
-- IssueSpawnPermit; a fabricated or replayed requestId is rejected.
RegisterNetEvent('sunset:server:prepareSpawn', function(requestId)
    local source  = source
    local session = Sessions[source]
    local player  = Players[source]
    local permit  = SpawnPermits[source]
    local oldBucket = GetPlayerRoutingBucket(source)

    if SunsetBoot.IsDebug() then
        print(('^5[BOOTV src=%d] prepareSpawn:received oldBucket=%s requestId=%s^7'):format(
            source, tostring(oldBucket), tostring(requestId)))
    end

    -- ── Auth check (required for ALL paths) ───────────────────────────────
    if not session or not session.authenticated then
        Sunset.Warn(('[SEC-PERMIT] prepareSpawn REJECTED src=%d: session not authenticated'):format(source))
        return
    end

    -- ── Respawn fast-path (player already in bucket 0) ────────────────────
    -- [SEC-PERMIT] The exploit was unauthenticated bucket-9999 → bucket-0 escape.
    -- If the player is ALREADY in bucket 0 and has a loaded character they are
    -- genuinely in gameplay (death-respawn / /spawnmenu path). No permit is needed
    -- because no routing-bucket change is required — just ack the handshake.
    if oldBucket == 0 and player and player.character and player.character.id then
        local newBucket = GetPlayerRoutingBucket(source)
        if SunsetBoot.IsDebug() then
            print(('^5[SEC-PERMIT] prepareSpawn: respawn fast-path src=%d charId=%s^7'):format(
                source, tostring(player.character.id)))
        end
        TriggerClientEvent('sunset:client:prepareSpawnAck', source, requestId, newBucket, oldBucket)
        return
    end

    -- ── Permit validation (initial login from bucket 9999) ─────────────────
    if not permit then
        Sunset.Warn(('[SEC-PERMIT] prepareSpawn REJECTED src=%d: no spawn permit issued (oldBucket=%s)'):format(
            source, tostring(oldBucket)))
        return
    end
    if permit.used then
        Sunset.Warn(('[SEC-PERMIT] prepareSpawn REJECTED src=%d: permit already consumed (replay)'):format(source))
        return
    end
    if type(requestId) ~= 'string' or requestId ~= permit.requestId then
        Sunset.Warn(('[SEC-PERMIT] prepareSpawn REJECTED src=%d: requestId mismatch (got=%s expected=%s)'):format(
            source, tostring(requestId), tostring(permit.requestId)))
        return
    end
    if (GetGameTimer() - permit.issuedAt) > SPAWN_PERMIT_TTL_MS then
        SpawnPermits[source] = nil
        Sunset.Warn(('[SEC-PERMIT] prepareSpawn REJECTED src=%d: permit expired'):format(source))
        return
    end
    -- Verify the character that was loaded when the permit was issued is still
    -- the active character (prevents account-switching mid-permit).
    local charId = player and player.character and tonumber(player.character.id)
    if not charId or charId ~= permit.characterId then
        SpawnPermits[source] = nil
        Sunset.Warn(('[SEC-PERMIT] prepareSpawn REJECTED src=%d: characterId mismatch (permit=%s current=%s)'):format(
            source, tostring(permit.characterId), tostring(charId)))
        return
    end
    -- ── Consume permit (single-use) ────────────────────────────────────────
    permit.used = true
    SpawnPermits[source] = nil

    -- ── Release from auth bucket ───────────────────────────────────────────
    SetPlayerRoutingBucket(source, 0)
    local newBucket = GetPlayerRoutingBucket(source)
    print(('^2[LOGIN-FLOW] 20-SRV PREPARESPAWN: src=%s oldBucket=%s newBucket=%s requestId=%s^7'):format(
        tostring(source), tostring(oldBucket), tostring(newBucket), tostring(requestId)))

    TriggerClientEvent('sunset:client:prepareSpawnAck', source, requestId, newBucket, oldBucket)
end)

local function completeAuthenticationInner(source, accountId, username)
    local session = Sessions[source]
    if not session or session.authenticated then return false end

    accountId = tonumber(accountId)
    if not accountId or type(username) ~= 'string' or username == '' then return false end

    local t0 = SunsetBoot.IsDebug() and GetGameTimer() or 0
    local account = MySQL.single.await(
        'SELECT id, username, premium_points, admin_level, helper_level, language FROM accounts WHERE id = ?',
        { accountId }
    )
    if SunsetBoot.IsDebug() then
        print(('^5[BOOTV src=%d] DB auth.account %dms^7'):format(source, GetGameTimer() - t0))
    end
    if not account then return false end
    username = account.username

    -- Drop any existing session on another client for this account
    for otherSrc, otherPlayer in pairs(Players) do
        if otherSrc ~= source and otherPlayer.account_id == accountId then
            Sunset.Warn(('Account %s (#%d) re-logged from source %s; dropping old source %s'):format(username, accountId, source, otherSrc))
            if otherPlayer.character then
                Sunset.SaveCharacter(otherSrc)
            end
            if otherPlayer.sessionStart then
                local mins = math.max(0, math.floor((os.time() - otherPlayer.sessionStart) / 60))
                if mins > 0 then
                    MySQL.update.await('UPDATE players SET playtime = playtime + ? WHERE id = ?', { mins, otherPlayer.id })
                end
                otherPlayer.sessionStart = nil
            end
            DropPlayer(otherSrc, Sunset.TFor(otherSrc, 'auth.logged_in_elsewhere'))
            -- [SEC-PERMIT] Clear spawn permit for the displaced session so
            -- it cannot be replayed after the source drops.
            clearSpawnPermit(otherSrc)
            Players[otherSrc] = nil
            Sessions[otherSrc] = nil
        end
    end

    -- [AUDIT P2-03] Defensive: if a stale live session exists on this source,
    -- persist it before it is replaced so progress/items are never silently lost.
    local stale = Players[source]
    if stale then
        if stale.character then Sunset.SaveCharacter(source) end
        if stale.sessionStart then
            local mins = math.max(0, math.floor((os.time() - stale.sessionStart) / 60))
            if mins > 0 and stale.id then
                MySQL.update.await('UPDATE players SET playtime = playtime + ? WHERE id = ?', { mins, stale.id })
            end
        end
        Players[source] = nil
    end

    local license = session.license
    local t1 = SunsetBoot.IsDebug() and GetGameTimer() or 0
    local player = MySQL.single.await('SELECT * FROM players WHERE account_id = ?', { accountId })

    if not player then
        player = MySQL.single.await('SELECT * FROM players WHERE license = ?', { license })
        if player then
            MySQL.update.await('UPDATE players SET account_id = ? WHERE id = ?', { accountId, player.id })
            player.account_id = accountId
        end
    end
    if SunsetBoot.IsDebug() then
        print(('^5[BOOTV src=%d] DB auth.player %dms^7'):format(source, GetGameTimer() - t1))
    end

    if not player then
        local insertId = MySQL.insert.await(
            'INSERT INTO players (account_id, license, steam, discord, name) VALUES (?, ?, ?, ?, ?)',
            {
                accountId,
                license,
                Sunset.GetIdentifier(source, 'steam'),
                Sunset.GetIdentifier(source, 'discord'),
                username,
            }
        )
        player = MySQL.single.await('SELECT * FROM players WHERE id = ?', { insertId })
    else
        MySQL.update.await('UPDATE players SET license = ?, name = ?, last_seen = NOW() WHERE id = ?', {
            license, username, player.id
        })
    end

    Players[source] = {
        source = source,
        id = player.id,
        account_id = accountId,
        license = license,
        name = username,
        premium_points = account and tonumber(account.premium_points) or 0,
        admin_level = account and tonumber(account.admin_level) or 0,
        helper_level = account and tonumber(account.helper_level) or 0,
        language = normalizeLocale(account and account.language) or 'en',
        playtime = tonumber(player.playtime) or 0,
        sessionStart = os.time(),
        character = nil,
    }
    indexRegisterPlayer(source, Players[source])

    Player(source).state:set('sunsetName', username, true)
    Player(source).state:set('sunsetDisplayName', username, true)
    Player(source).state:set('sunsetLocale', Players[source].language, true)

    session.authenticated = true
    TriggerClientEvent('sunset:client:playerReady', source, {
        id = player.id,
        account_id = accountId,
        name = username,
        premium = account and tonumber(account.premium_points) or 0,
        playtime = tonumber(player.playtime) or 0,
        language = Players[source].language,
    })
    TriggerEvent('sunset:server:authenticated', source, accountId)
    TriggerEvent('sunset:server:playerReady', source, Players[source])
    Sunset.Debug('Player authenticated:', source, username)
    return true
end

-- [LOGIN PIPELINE] The body awaits several SQL queries before it sets
-- session.authenticated, so a double-submitted login (double click / retry) could
-- run two interleaved authentications for one source. Serialize per source.
local AuthInFlight = {}
local function completeAuthentication(source, accountId, username)
    if AuthInFlight[source] then
        Sunset.Warn(('CompleteAuthentication ignored for src %s: another authentication is already in flight'):format(tostring(source)))
        return false
    end
    AuthInFlight[source] = true
    local ok, result = pcall(completeAuthenticationInner, source, accountId, username)
    AuthInFlight[source] = nil
    if not ok then
        Sunset.Warn(('CompleteAuthentication error for src %s: %s'):format(tostring(source), tostring(result)))
        return false
    end
    return result
end
AddEventHandler('playerDropped', function() AuthInFlight[source] = nil end)

exports('CompleteAuthentication', completeAuthentication)

-- ═══ EXPORTS ═══

function GetPlayer(source) return Players[source] end
exports('GetPlayer', GetPlayer)
exports('NotifyFor', Sunset.NotifyFor)
exports('BroadcastLocalized', Sunset.BroadcastLocalized)
exports('TFor', function(source, key, params, ...)
    return Sunset.TFor(source, key, params, ...)
end)
exports('Translate', function(locale, key, params, ...)
    return Sunset.Translate(locale, key, params, ...)
end)
exports('GetPlayerLocale', function(source)
    return Sunset.GetPlayerLocale(source)
end)
exports('SetPlayerLocale', function(source, locale)
    return Sunset.SetPlayerLocale(source, locale)
end)
exports('SetConnectionLocale', function(source, locale)
    return Sunset.SetConnectionLocale(source, locale)
end)

function GetCharacter(source)
    return Players[source] and Players[source].character or nil
end
exports('GetCharacter', GetCharacter)

function GetPlayerBaseName(source)
    local char = GetCharacter(source)
    local base
    if char then
        local full = ((char.firstname or '') .. (char.lastname and char.lastname ~= '' and (' ' .. char.lastname) or ''))
            :gsub('^%s+', ''):gsub('%s+$', '')
        if full ~= '' then base = full end
    end
    if not base then
        local player = Players[source]
        if player and player.name and player.name ~= '' then
            base = player.name
        else
            base = ('Player_%d'):format(source or 0)
        end
    end
    return base
end
exports('GetPlayerBaseName', GetPlayerBaseName)

function GetPlayerDisplayName(source)
    local base = GetPlayerBaseName(source)
    if GetResourceState('sunset_clans') == 'started' then
        local ok, formatted = pcall(function()
            return exports.sunset_clans:FormatDisplayName(source, base)
        end)
        if ok and type(formatted) == 'string' and formatted ~= '' then
            base = formatted
        end
    end
    return base
end
exports('GetPlayerDisplayName', GetPlayerDisplayName)

local function grantStarterItems(characterId)
    local starter = { { 'water', 2, 1 }, { 'bread', 2, 2 }, { 'id_card', 1, 3 }, { 'phone', 1, 4 } }
    for _, row in ipairs(starter) do
        MySQL.insert.await('INSERT INTO character_inventory (character_id, item, count, slot) VALUES (?, ?, ?, ?)', {
            characterId, row[1], row[2], row[3]
        })
    end
end

local function getDefaultAppearance(gender)
    local isFemale = gender == 1
    return {
        version = 2,
        headBlend = {
            shapeFirst = isFemale and 21 or 0, shapeSecond = isFemale and 21 or 0, shapeThird = 0,
            skinFirst = isFemale and 21 or 0, skinSecond = isFemale and 21 or 0, skinThird = 0,
            shapeMix = 0.5, skinMix = 0.5, thirdMix = 0.0,
        },
        hair = { drawable = 4, texture = 0, color = 0, highlight = 0 },
        overlays = {
            ['1'] = { index = 0, opacity = 0.0, color = 0 },
            ['2'] = { index = 0, opacity = 0.0, color = 0 },
        },
        components = {
            ['1'] = { drawable = 0, texture = 0 },
            ['3'] = { drawable = 15, texture = 0 },
            ['4'] = { drawable = 10, texture = 0 },
            ['5'] = { drawable = 0, texture = 0 },
            ['6'] = { drawable = 1, texture = 0 },
            ['7'] = { drawable = 0, texture = 0 },
            ['8'] = { drawable = isFemale and 14 or 15, texture = 0 },
            ['11'] = { drawable = 14, texture = 0 },
        },
        props = {
            ['0'] = { drawable = -1, texture = 0 },
            ['1'] = { drawable = -1, texture = 0 },
            ['2'] = { drawable = -1, texture = 0 },
            ['6'] = { drawable = -1, texture = 0 },
            ['7'] = { drawable = -1, texture = 0 },
        },
    }
end

local function createDefaultAccountCharacter(player)
    local count = MySQL.scalar.await('SELECT COUNT(*) FROM characters WHERE player_id = ?', { player.id })
    if count >= Sunset.Config.MaxCharacters then
        return nil, Sunset.LocalizedError('character.limit', { limit = Sunset.Config.MaxCharacters })
    end

    local spawn = Sunset.Config.DefaultSpawn
    local accountName = player.name or 'Player'
    local defaultApp = getDefaultAppearance(0)
    local charId = MySQL.insert.await([[
        INSERT INTO characters (player_id, slot, firstname, lastname, dateofbirth, gender, nationality, cash, bank, position, appearance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        player.id, 1, accountName, '', '1990-01-01', 0, 'American',
        Sunset.Config.StartingCash, Sunset.Config.StartingBank,
        json.encode({ x = spawn.x, y = spawn.y, z = spawn.z, w = spawn.w }),
        json.encode(defaultApp),
    })

    grantStarterItems(charId)
    local charRow = MySQL.single.await('SELECT metadata FROM characters WHERE id = ?', { charId })
    local meta = charRow and charRow.metadata and json.decode(charRow.metadata) or {}
    if type(meta) ~= 'table' then meta = {} end
    meta.starter_items_granted = true
    MySQL.update.await('UPDATE characters SET metadata = ? WHERE id = ?', { json.encode(meta), charId })
    local char = MySQL.single.await('SELECT * FROM characters WHERE id = ?', { charId })
    return Sunset.DecodeCharacter(char)
end

local CharLoadInFlight = {}
local loadCharacterForPlayerInner
local function loadCharacterForPlayer(source, player, charId)
    if not player or not Players[source] then return nil end
    if Players[source].character and Players[source].character.id then
        Sunset.Warn(('Player %s tried to load character %s while already playing character %s'):format(source, charId, Players[source].character.id))
        return Players[source].character
    end

    charId = tonumber(charId)
    if not charId or charId ~= math.floor(charId) then return nil end
    if CharLoadInFlight[source] then
        Sunset.Warn(('loadCharacterForPlayer: load already in flight for src %s'):format(tostring(source)))
        return nil
    end
    CharLoadInFlight[source] = true
    local t0 = GetGameTimer()
    local okL, resL = pcall(loadCharacterForPlayerInner, source, player, charId)
    CharLoadInFlight[source] = nil
    if not okL then
        Sunset.Warn(('loadCharacterForPlayer error src=%s charId=%s: %s'):format(tostring(source), tostring(charId), tostring(resL)))
        return nil
    end
    print(('^2[LOGIN-FLOW] 08-SRV LOADCHAR: loaded charId=%s for src=%s accId=%s in %dms^7'):format(
        tostring(charId), tostring(source), tostring(player.account_id), GetGameTimer() - t0))
    return resL
end

loadCharacterForPlayerInner = function(source, player, charId)
    for otherSrc, otherData in pairs(Players) do
        if otherSrc ~= source and otherData.character and tonumber(otherData.character.id) == charId then
            Sunset.Warn(('Duplicate character load blocked: charId %s already active on source %s'):format(charId, otherSrc))
            return nil
        end
    end

    local tChar = SunsetBoot.IsDebug() and GetGameTimer() or 0
    local char = MySQL.single.await('SELECT * FROM characters WHERE id = ? AND player_id = ?', { charId, player.id })
    if SunsetBoot.IsDebug() then
        print(('^5[BOOTV src=%d] DB enterGame.character %dms charId=%s^7'):format(source, GetGameTimer() - tChar, tostring(charId)))
    end
    if not char then return nil end

    char = Sunset.DecodeCharacter(char)
    if char._profileMigrated then
        MySQL.update.await(
            'UPDATE characters SET job = ?, job_grade = ?, metadata = ? WHERE id = ?',
            { char.job or 'unemployed', char.job_grade or 0, json.encode(char.metadata or {}), charId }
        )
        char._profileMigrated = nil
    end
    char.last_played_before = char.last_played
    MySQL.update.await('UPDATE characters SET last_played = NOW() WHERE id = ?', { charId })
    Players[source].character = char
    indexRegisterPlayer(source, Players[source])
    Player(source).state:set('sunsetName', GetPlayerBaseName(source), true)
    Player(source).state:set('sunsetDisplayName', GetPlayerDisplayName(source), true)

    -- [P1 #8] Fast-path core readiness: authoritative core data is loaded,
    -- allowing enterGame response and client spawn pipeline to proceed immediately (<150ms).
    Player(source).state:set('characterCoreReady', true, true)
    TriggerEvent('sunset:server:characterCoreReady', source, charId)

    -- [P1 #8-12] Asynchronous Secondary Services Hydration
    -- Secondary character services (inventory starter items, quests, license cache,
    -- faction sync, clan badges, fishing tournament claims) run in the background
    -- without stalling the player's enterGame callback.
    CreateThread(function()
        TriggerEvent('sunset:server:characterSelected', source, charId)
        Player(source).state:set('characterServicesReady', true, true)
        TriggerEvent('sunset:server:characterServicesReady', source, charId)
    end)

    -- [SEC-PERMIT] Issue a spawn permit now that the character is durably set.
    -- The requestId is returned to the client as part of the enterGame response
    -- and must be forwarded verbatim in the prepareSpawn event.
    local permitId = issueSpawnPermit(source)
    if not permitId then
        Sunset.Warn(('[SEC-PERMIT] loadCharacterForPlayerInner: IssueSpawnPermit returned nil for src=%d'):format(source))
    end
    char._spawnPermit = permitId

    return char
end

-- Character selection is performed by server callbacks. Never accept a complete
-- character object from a client: it contains money, job, faction and progression.
RegisterNetEvent('sunset:server:characterSpawned', function(characterId)
    local source = source
    local char = Players[source] and Players[source].character
    if not char or tonumber(characterId) ~= tonumber(char.id) then return end
    updatePedMapping(source)
    TriggerClientEvent('sunset:client:characterLoaded', source, char)
end)

AddEventHandler('sunset:server:setActiveCharacter', function(source, charData)
    if not Players[source] or not charData then return end
    Players[source].character = Sunset.DecodeCharacter(charData)
end)

CreateThread(function()
    while true do
        Wait(300000) -- flush playtime every 5 minutes
        for src, player in pairs(Players) do
            if player.sessionStart then
                local mins = math.max(0, math.floor((os.time() - player.sessionStart) / 60))
                if mins > 0 then
                    MySQL.update('UPDATE players SET playtime = playtime + ? WHERE id = ?', { mins, player.id })
                    player.playtime = (tonumber(player.playtime) or 0) + mins
                    player.sessionStart = os.time()
                    if player.character then
                        if player.character._profileMigrated then
                            Sunset.SaveCharacter(src)
                            player.character._profileMigrated = nil
                        end
                    end
                end
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local source = source
    local player = Players[source]
    if player and player.sessionStart then
        local mins = math.max(0, math.floor((os.time() - player.sessionStart) / 60))
        if mins > 0 then
            MySQL.update.await('UPDATE players SET playtime = playtime + ? WHERE id = ?', { mins, player.id })
        end
    end
    if Players[source] and Players[source].character then
        Sunset.SaveCharacter(source)
    end
    indexUnregisterPlayer(source, player)
    Players[source] = nil
    ConnectionLocales[source] = nil
    Sessions[source] = nil
    -- [SEC-PERMIT] Clear spawn permit on disconnect so stale permits cannot
    -- be replayed if the source ID is reused for a new connection.
    clearSpawnPermit(source)
    CallbackRate[source] = nil
    CallbackNameRate[source] = nil
    FlowTraceRate[source] = nil
end)

-- ═══ CHARACTER CALLBACKS ═══

RegisterCallback('sunset:getCharacters', function(source)
    local player = GetPlayer(source)
    if not player then return {} end

    local chars = MySQL.query.await(
        'SELECT * FROM characters WHERE player_id = ? ORDER BY slot',
        { player.id }
    )

    for i, char in ipairs(chars or {}) do
        chars[i] = Sunset.DecodeCharacter(char)
    end
    return chars or {}
end)

local CharCreateInFlight = {} -- [SEC3] serialize per source: concurrent creates bypassed MaxCharacters / slot uniqueness
RegisterCallback('sunset:createCharacter', function(source, data)
    local player = GetPlayer(source)
    if not player then return nil, Sunset.LocalizedError('auth.not_logged_in') end
    if CharCreateInFlight[source] then return nil, Sunset.LocalizedError('error.action_too_fast') end
    CharCreateInFlight[source] = true
    local ok, res, err = pcall(function() return Sunset._createCharacterInner(source, player, data) end)
    CharCreateInFlight[source] = nil
    if not ok then error(res) end
    if not res then return nil, err end
    -- [SEC-PERMIT] Load the freshly-created character into the server session so
    -- the permit lifecycle runs.  Without this step the player would enter the world
    -- with no registered character in Players[source].character and no spawn permit.
    local char = loadCharacterForPlayer(source, player, res.id)
    if not char then return nil, Sunset.LocalizedError('auth.session_not_ready') end
    local permitId = char._spawnPermit
    char._spawnPermit = nil
    return { character = char, spawnPermit = permitId }
end)

function Sunset._createCharacterInner(source, player, data)

    local count = MySQL.scalar.await('SELECT COUNT(*) FROM characters WHERE player_id = ?', { player.id })
    if count >= Sunset.Config.MaxCharacters then
        return nil, Sunset.LocalizedError('character.limit', { limit = Sunset.Config.MaxCharacters })
    end

    if type(data) ~= 'table' then data = {} end -- [SEC3]
    local function validNamePart(value)
        value = type(value) == 'string' and value:match('^%s*(.-)%s*$') or ''
        if #value < 2 or #value > 24 or not value:match("^[%a][%a'%-]+$") then return nil end
        return value:sub(1, 1):upper() .. value:sub(2):lower()
    end
    data.firstname = validNamePart(data.firstname) or validNamePart(player.name) or 'Player'
    data.lastname = validNamePart(data.lastname) or ''
    data.dateofbirth = type(data.dateofbirth) == 'string' and data.dateofbirth or '1990-01-01'
    local year, month, day = data.dateofbirth:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
    year, month, day = tonumber(year), tonumber(month), tonumber(day)
    local daysInMonth = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 }
    if year and (year % 400 == 0 or (year % 4 == 0 and year % 100 ~= 0)) then daysInMonth[2] = 29 end
    if not year or year < 1900 or year > tonumber(os.date('%Y')) - 16
        or month < 1 or month > 12 or day < 1 or day > daysInMonth[month] then
        return nil, Sunset.LocalizedError('character.invalid_birthdate')
    end
    data.gender = (tonumber(data.gender) == 1) and 1 or 0 -- [SEC3] strict 0/1 integer
    data.nationality = type(data.nationality) == 'string' and data.nationality:sub(1, 32) or 'American'
    if not data.nationality:match("^[%a%s'%-]+$") then
        return nil, Sunset.LocalizedError('character.invalid_nationality')
    end

    -- [SEC2] Creation appearance is client-supplied and was stored verbatim: validate through
    -- sunset_appearance when available, otherwise bound size/type so oversized or hostile
    -- JSON can never be persisted. Falls back to the default appearance.
    if type(data.appearance) == 'table' and next(data.appearance) then
        local validated = nil
        if GetResourceState('sunset_appearance') == 'started' then
            local okV, res = pcall(function() return exports.sunset_appearance:ValidateAppearance(data.appearance, nil) end)
            if okV and type(res) == 'table' then validated = res end
        end
        local encodedApp = validated and json.encode(validated) or json.encode(data.appearance)
        if not encodedApp or #encodedApp > 8192 then validated = nil; data.appearance = nil
        elseif validated then data.appearance = validated end
        if not validated and GetResourceState('sunset_appearance') == 'started' then data.appearance = nil end
    else
        data.appearance = nil
    end

    local slot = count + 1
    local spawn = Sunset.Config.DefaultSpawn

    local charId = MySQL.insert.await([[
        INSERT INTO characters (player_id, slot, firstname, lastname, dateofbirth, gender, nationality, cash, bank, position, appearance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        player.id, slot, data.firstname, data.lastname, data.dateofbirth,
        data.gender, data.nationality,
        Sunset.Config.StartingCash, Sunset.Config.StartingBank,
        json.encode({ x = spawn.x, y = spawn.y, z = spawn.z, w = spawn.w }),
        json.encode((data.appearance and next(data.appearance)) and data.appearance or getDefaultAppearance(data.gender)),
    })

    grantStarterItems(charId)
    local charRow = MySQL.single.await('SELECT metadata FROM characters WHERE id = ?', { charId })
    local meta = charRow and charRow.metadata and json.decode(charRow.metadata) or {}
    if type(meta) ~= 'table' then meta = {} end
    meta.starter_items_granted = true
    MySQL.update.await('UPDATE characters SET metadata = ? WHERE id = ?', { json.encode(meta), charId })
    local char = MySQL.single.await('SELECT * FROM characters WHERE id = ?', { charId })
    return Sunset.DecodeCharacter(char)
end

RegisterCallback('sunset:selectCharacter', function(source, charId)
    local player = GetPlayer(source)
    if not player then return nil, Sunset.LocalizedError('auth.not_logged_in') end
    local char = loadCharacterForPlayer(source, player, charId)
    if not char then return nil, Sunset.LocalizedError('auth.session_not_ready') end
    -- [SEC-PERMIT] Extract the server-issued spawn permit and return it to the
    -- client alongside the character so sunset_characters can register it with
    -- sunset_spawn before calling prepareSpawnBucket.
    local permitId = char._spawnPermit
    char._spawnPermit = nil
    return { character = char, spawnPermit = permitId }
end)

RegisterCallback('sunset:enterGame', function(source)
    local tEnterGame = GetGameTimer()
    local tSub = tEnterGame
    local player = GetPlayer(source)
    local accId = player and player.account_id or 'none'
    local pId = player and player.id or 'none'
    local durPlayer = GetGameTimer() - tSub
    print(('^2[LOGIN-FLOW] ENTERGAME_PLAYER dur=%dms | src=%s accId=%s pId=%s hasChar=%s^7'):format(
        durPlayer, tostring(source), tostring(accId), tostring(pId), tostring(player and player.character ~= nil)))

    if not player then
        return nil, Sunset.LocalizedError('auth.not_logged_in')
    end

    -- [LOGIN PIPELINE] Idempotent: return already-loaded character immediately.
    -- [SEC-PERMIT] Re-issue a fresh spawn permit so the client always has a valid
    -- one even when the character was cached (e.g. rapid reconnect).
    if player.character and player.character.id then
        local permitId = issueSpawnPermit(source)
        local totalDur = GetGameTimer() - tEnterGame
        print(('^2[LOGIN-FLOW] ENTERGAME_RETURN (cached) dur=%dms | charId=%s src=%s permit=%s^7'):format(
            totalDur, tostring(player.character.id), tostring(source), tostring(permitId ~= nil)))
        return { character = player.character, spawnPermit = permitId }
    end

    tSub = GetGameTimer()
    local row = MySQL.single.await(
        'SELECT id FROM characters WHERE player_id = ? ORDER BY slot LIMIT 1',
        { player.id }
    )
    local durQuery = GetGameTimer() - tSub
    print(('^2[LOGIN-FLOW] ENTERGAME_CHARACTER_QUERY dur=%dms | found=%s^7'):format(
        durQuery, tostring(row and row.id or 'none')))

    if row then
        tSub = GetGameTimer()
        local char = loadCharacterForPlayer(source, player, row.id)
        local durLoad = GetGameTimer() - tSub
        print(('^2[LOGIN-FLOW] ENTERGAME_LOAD_CHARACTER dur=%dms | charId=%s^7'):format(
            durLoad, tostring(char and char.id or 'nil')))
        if char then
            local totalDur = GetGameTimer() - tEnterGame
            -- [SEC-PERMIT] _spawnPermit was set by loadCharacterForPlayerInner.
            local permitId = char._spawnPermit
            char._spawnPermit = nil -- do not persist this field
            print(('^2[LOGIN-FLOW] ENTERGAME_RETURN dur=%dms | charId=%s src=%s permit=%s^7'):format(
                totalDur, tostring(char.id), tostring(source), tostring(permitId ~= nil)))
            return { character = char, spawnPermit = permitId }
        end
        Sunset.Warn(('enterGame: character %s could not be loaded for src %s (already loaded / duplicate / missing)'):format(tostring(row.id), tostring(source)))
        return nil, Sunset.LocalizedError('auth.session_not_ready')
    end

    tSub = GetGameTimer()
    local char, err = createDefaultAccountCharacter(player)
    if not char then return nil, err or Sunset.LocalizedError('character.create_failed') end

    char = loadCharacterForPlayer(source, player, char.id)
    local durCreateLoad = GetGameTimer() - tSub
    print(('^2[LOGIN-FLOW] ENTERGAME_LOAD_CHARACTER (created) dur=%dms | charId=%s^7'):format(
        durCreateLoad, tostring(char and char.id or 'nil')))

    local totalDur = GetGameTimer() - tEnterGame
    local permitId = char and char._spawnPermit
    if char then char._spawnPermit = nil end
    print(('^2[LOGIN-FLOW] ENTERGAME_RETURN dur=%dms | charId=%s src=%s permit=%s^7'):format(
        totalDur, tostring(char and char.id), tostring(source), tostring(permitId ~= nil)))
    return { character = char, spawnPermit = permitId }
end)

RegisterCallback('sunset:deleteCharacter', function(source, charId)
    local player = GetPlayer(source)
    if not player then return false, Sunset.LocalizedError('auth.not_logged_in') end
    charId = tonumber(charId)
    if not charId then return false, Sunset.LocalizedError('character.invalid') end

    -- [AUDIT P5-09] Never delete the currently loaded character: the live cache
    -- would point at a dead row and all subsequent writes would silently no-op.
    if player.character and tonumber(player.character.id) == charId then
        return false, Sunset.LocalizedError('character.delete_active')
    end

    -- Prove ownership before any related asset is touched, then repeat that
    -- check under a row lock so a forged/stale charId can never affect another
    -- account and a partial cleanup can never escape the transaction.
    local owned = MySQL.scalar.await(
        'SELECT 1 FROM characters WHERE id = ? AND player_id = ? LIMIT 1',
        { charId, player.id }
    )
    if not owned then return false, Sunset.LocalizedError('character.not_owned') end

    local deleted = MySQL.startTransaction(function(query)
        local locked = query.single.await(
            'SELECT id FROM characters WHERE id = ? AND player_id = ? FOR UPDATE',
            { charId, player.id }
        )
        if not locked then return false end

        query.update.await('UPDATE properties SET owner_character_id = NULL, enabled = 0 WHERE owner_character_id = ?', { charId })
        query.update.await('UPDATE player_businesses SET owner_character_id = NULL, for_sale = 0, balance = 0 WHERE owner_character_id = ?', { charId })
        query.update.await('UPDATE characters SET home_property_id = NULL WHERE home_property_id IN (SELECT id FROM properties WHERE owner_character_id IS NULL AND enabled = 0)')
        query.update.await('UPDATE turfs SET owner_clan_id = NULL WHERE owner_clan_id IN (SELECT id FROM clans WHERE owner_character_id = ?)', { charId })
        query.update.await('DELETE FROM clans WHERE owner_character_id = ?', { charId })
        query.update.await('DELETE FROM lottery_tickets WHERE character_id = ?', { charId })

        return query.update.await(
            'DELETE FROM characters WHERE id = ? AND player_id = ?',
            { charId, player.id }
        ) == 1
    end)

    if deleted then
        -- [AUDIT P6-07] Drop any in-memory vehicle key grants for the deleted character.
        if GetResourceState('sunset_vehicles') == 'started' then
            pcall(function() exports.sunset_vehicles:ClearKeysForCharacter(charId) end)
        end
    end
    return deleted == true
end)

-- [AUDIT P5-08] Persist every loaded character on resource stop so a core
-- restart (or controlled server shutdown) never drops up to 60s of player state.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for src, player in pairs(Players) do
        if player and player.character then
            pcall(function() Sunset.SaveCharacter(src) end)
        end
        if player and player.sessionStart and player.id then
            local mins = math.max(0, math.floor((os.time() - player.sessionStart) / 60))
            if mins > 0 then
                pcall(function()
                    MySQL.update.await('UPDATE players SET playtime = playtime + ? WHERE id = ?', { mins, player.id })
                end)
            end
        end
    end
end)

-- Authoritative runtime version, sourced from racket_version convar (set in
-- server.cfg — change ONE value there to update hostname, /version, and logs).
Sunset.Version = GetConvar('racket_version', '0.0.0-dev')

exports('GetRacketVersion', function() return Sunset.Version end)

CreateThread(function()
    MySQL.ready(function()
        -- Update sv_hostname to reflect the current version.
        SetConvar('sv_hostname', 'Racket RPG v' .. Sunset.Version)

        print(('^2[Racket]^7 Racket RPG v%s initialized'):format(Sunset.Version))
        local critical = { 'sunset_core', 'sunset_characters', 'sunset_properties', 'sunset_spawn', 'sunset_auth', 'sunset_ui' }
        local fingerprints = {}
        for _, resName in ipairs(critical) do
            local state = GetResourceState(resName)
            local ver = GetResourceMetadata(resName, 'version', 0) or '1.0.0'
            fingerprints[#fingerprints + 1] = ('%s=%s(%s)'):format(resName, ver, state)
        end
        print(('^2[RESOURCE-VERSIONS]^7 %s'):format(table.concat(fingerprints, ', ')))

        -- [P0 #7] Build fingerprint for production diagnostics
        local commitHash = GetConvar('sunset_build_commit', 'git-main-b4780fb')
        local builtAt = GetConvar('sunset_build_time', os.date('!%Y-%m-%dT%H:%M:%SZ'))
        local env = GetConvar('sunset_environment', 'production')
        print(('^2[BUILD]^7 commit=%s builtAt=%s environment=%s'):format(commitHash, builtAt, env))
        GlobalState.sunsetBuild = {
            commit = commitHash,
            builtAt = builtAt,
            environment = env
        }
    end)
end)
