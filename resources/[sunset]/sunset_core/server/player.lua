-- [SEC2] Strict money amount: finite, positive, bounded (rejects NaN/inf/huge/non-number).
local MAX_MONEY_OP = 2000000000
local function sanitizeMoneyAmount(v)
    v = tonumber(v)
    if not v or v ~= v or v == math.huge or v == -math.huge then return 0 end
    if v > MAX_MONEY_OP then return 0 end
    return math.floor(v)
end
Sunset.SanitizeMoneyAmount = sanitizeMoneyAmount

local function decodeChar(char)
    if not char then return nil end
    if type(char.position) == 'string' then char.position = json.decode(char.position) end
    if type(char.appearance) == 'string' then char.appearance = json.decode(char.appearance) end
    if type(char.metadata) == 'string' then char.metadata = json.decode(char.metadata or '{}') end
    char.hunger = tonumber(char.hunger) or 100
    char.thirst = tonumber(char.thirst) or 100
    char.stress = tonumber(char.stress) or 0
    char.level = tonumber(char.level) or 1
    char.xp = tonumber(char.xp) or 0
    char.respect_points = tonumber(char.respect_points) or 0
    char.paydays_received = tonumber(char.paydays_received) or 0
    char = Sunset.MigrateCharacterProfile(char)
    return char
end

local IsSavingCharacter = {}

function Sunset.SaveCharacter(source)
    local player = Sunset.GetPlayer(source)
    if not player or not player.character then return false end

    local char = player.character
    local cid = tonumber(char.id)
    if not cid then return false end

    if IsSavingCharacter[cid] then return false end
    IsSavingCharacter[cid] = true

    local success = false
    local ok, err = pcall(function()
        local position = nil
        local ped = GetPlayerPed(source)
        if ped and ped ~= 0 then
            local coords = GetEntityCoords(ped)
            local heading = GetEntityHeading(ped)
            -- Instanced interiors reuse remote world coordinates. Persist their exterior
            -- safe position so "Last Location" can never strand a player underground.
            local safe = Player(source) and Player(source).state.sunsetPropertyExit
            if type(safe) == 'table' and tonumber(safe.x) then
                coords = vector3(safe.x, safe.y, safe.z)
                heading = tonumber(safe.w) or heading
            end
            if coords and #(coords - vector3(0, 0, 0)) > 2.0 then
                position = json.encode({ x = coords.x, y = coords.y, z = coords.z, w = heading })
            end
        end
        if not position and char.position then
            if type(char.position) == 'table' then
                position = json.encode(char.position)
            elseif type(char.position) == 'string' then
                position = char.position
            end
        end

        -- [AUDIT P5-05] cash/bank/level/xp/respect_points/paydays_received are NO
        -- LONGER written here. They are owned by atomic server operations (guarded
        -- UPDATEs, payday/buyLevel transactions).
        -- [AUDIT P5-10 / SCAL-FIX] metadata: merge all DB-authoritative keys (skin, rob_points, quickslots, spawn_choice, etc.)
        -- so autosave never overwrites or erases keys written separately by JSON_SET.
        local dbRow = MySQL.single.await('SELECT metadata FROM characters WHERE id = ?', { char.id })
        char.metadata = type(char.metadata) == 'table' and char.metadata or {}
        if dbRow and type(dbRow.metadata) == 'string' and dbRow.metadata ~= '' then
            local ok, dbMeta = pcall(json.decode, dbRow.metadata)
            if ok and type(dbMeta) == 'table' then
                for k, v in pairs(dbMeta) do
                    if char.metadata[k] == nil then
                        char.metadata[k] = v
                    end
                end
            end
        end

        MySQL.update.await([[
            UPDATE characters SET
                job = ?, job_grade = ?,
                position = ?, appearance = ?, metadata = ?,
                hunger = ?, thirst = ?, stress = ?,
                is_dead = ?, home_property_id = ?, last_played = NOW()
            WHERE id = ? AND player_id = ?
        ]], {
            char.job or 'unemployed',
            char.job_grade or 0,
            position,
            json.encode(char.appearance or {}),
            json.encode(char.metadata or {}),
            char.hunger or 100,
            char.thirst or 100,
            char.stress or 0,
            char.is_dead and 1 or 0,
            char.home_property_id,
            char.id,
            player.id,
        })
        success = true
    end)

    IsSavingCharacter[cid] = nil
    if not ok then
        print(('^1[blaze.mp]^7 Error saving character %s: %s'):format(tostring(cid), tostring(err)))
    end
    return success
end

local PersistentStatFields = {
    character = {
        cash = true, bank = true, level = true, xp = true,
        respect_points = true, paydays_received = true,
        hunger = true, thirst = true, stress = true,
    },
    player = { playtime = true },
    account = { premium_points = true },
}

function Sunset.SetPersistentStat(source, scope, field, value)
    local player = Sunset.GetPlayer(source)
    local char = player and player.character
    local allowed = PersistentStatFields[scope]
    if not player or not char then return false, { localeKey = 'core.message.character_data_is_unavailable' } end
    if not allowed or not allowed[field] then return false, { localeKey = 'core.message.that_persistent_field_is_not_allowed' } end
    value = math.floor(tonumber(value) or -1)
    if value < 0 then return false, { localeKey = 'core.message.the_value_must_be_zero_or_greater' } end

    local tableName, rowId, cache
    if scope == 'character' then
        tableName, rowId, cache = 'characters', char.id, char
    elseif scope == 'player' then
        tableName, rowId, cache = 'players', player.id, player
    else
        tableName, rowId, cache = 'accounts', player.account_id, player
    end

    local changed = MySQL.update.await(('UPDATE %s SET %s = ? WHERE id = ?'):format(tableName, field), { value, rowId })
    if changed == nil then return false, { localeKey = 'core.message.the_database_rejected_the_update' } end
    cache[field] = value
    if scope == 'player' and field == 'playtime' then player.sessionStart = os.time() end

    if scope == 'character' then
        TriggerClientEvent('sunset:client:updateCharacter', source, char)
        if field == 'cash' or field == 'bank' then
            TriggerClientEvent('sunset:client:updateMoney', source, char.cash or 0, char.bank or 0)
        end
    end
    return true
end

function Sunset.RefreshBlazePoints(source)
    local player = Sunset.GetPlayer(source)
    if not player or not player.account_id then return 0 end
    local row = MySQL.single.await(
        'SELECT premium_points FROM accounts WHERE id = ? LIMIT 1',
        { player.account_id }
    )
    if not row then return tonumber(player.premium_points) or 0 end
    local value = tonumber(row.premium_points) or 0
    player.premium_points = value
    return value
end

function Sunset.SpendBlazePoints(source, amount)
    amount = sanitizeMoneyAmount(amount)
    if amount <= 0 then return true end
    local player = Sunset.GetPlayer(source)
    if not player or not player.account_id then return false, { localeKey = 'core.message.account_data_is_unavailable' } end
    if not player.character then return false, { localeKey = 'core.message.character_data_is_unavailable' } end

    local changed = MySQL.update.await(
        'UPDATE accounts SET premium_points = premium_points - ? WHERE id = ? AND premium_points >= ?',
        { amount, player.account_id, amount }
    )
    if not changed or changed < 1 then
        local balance = Sunset.RefreshBlazePoints(source)
        return false, { localeKey = 'core.message.you_need_value_blaze_points_you_have_value', formatArgs = { amount, balance } }
    end
    player.premium_points = math.max(0, (tonumber(player.premium_points) or 0) - amount)
    return true
end

function Sunset.AddBlazePoints(source, amount)
    amount = sanitizeMoneyAmount(amount)
    if amount <= 0 then return true end
    local player = Sunset.GetPlayer(source)
    if not player or not player.account_id then return false, { localeKey = 'core.message.account_data_is_unavailable' } end
    if not player.character then return false, { localeKey = 'core.message.character_data_is_unavailable' } end

    local changed = MySQL.update.await(
        'UPDATE accounts SET premium_points = premium_points + ? WHERE id = ?',
        { amount, player.account_id }
    )
    if not changed or changed < 1 then return false, { localeKey = 'core.message.could_not_add_blaze_points' } end
    player.premium_points = (tonumber(player.premium_points) or 0) + amount
    return true
end

-- [SHOP] Owner-side writer for characters.firstname/lastname, used by the
-- Racket Shop rename entitlement (sunset_shop never writes characters itself).
-- Re-validates the name (2-32 chars, letters with single inner spaces/hyphens)
-- and returns true, nil, oldName on success.
local function validRenamePart(value)
    if type(value) ~= 'string' or #value < 2 or #value > 32 then return nil end
    if value:match('^%s') or value:match('%s$') then return nil end
    if not value:match('^[%a][%a %-]*[%a]$') then return nil end
    if value:find('  ', 1, true) or value:find('--', 1, true) then return nil end
    return value
end

function Sunset.RenameCharacter(source, firstname, lastname)
    local player = Sunset.GetPlayer(source)
    local char = player and player.character
    if not char then return false, { localeKey = 'core.message.character_data_is_unavailable' } end
    firstname, lastname = validRenamePart(firstname), validRenamePart(lastname)
    if not firstname or not lastname then return false, { localeKey = 'shop.name_change.invalid' } end

    local oldName = ((char.firstname or '') .. ' ' .. (char.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
    local changed = MySQL.update.await(
        'UPDATE characters SET firstname = ?, lastname = ? WHERE id = ? AND player_id = ?',
        { firstname, lastname, char.id, player.id }
    )
    if not changed or changed < 1 then return false, { localeKey = 'shop.name_change.failed' } end

    char.firstname, char.lastname = firstname, lastname
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    Player(source).state:set('sunsetDisplayName', GetPlayerDisplayName(source), true)
    TriggerEvent('sunset:server:characterRenamed', source, char.id, oldName, firstname .. ' ' .. lastname)
    return true, nil, oldName
end

function Sunset.SetHomeProperty(source, propertyId)
    local char = Sunset.GetCharacter(source)
    if not char then return false end
    propertyId = propertyId and tonumber(propertyId) or nil
    local changed = MySQL.update.await('UPDATE characters SET home_property_id = ? WHERE id = ?', { propertyId, char.id })
    if changed == nil then return false end
    char.home_property_id = propertyId
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function Sunset.AddMoney(source, account, amount, reason)
    local char = Sunset.GetCharacter(source)
    amount = sanitizeMoneyAmount(amount)
    if not char or amount <= 0 then return false end

    local field
    if account == 'cash' then
        field = 'cash'
    elseif account == 'bank' then
        field = 'bank'
    else
        return false
    end

    local changed = MySQL.update.await(('UPDATE characters SET %s = %s + ? WHERE id = ?'):format(field, field), { amount, char.id })
    if not changed or changed < 1 then return false end
    local row = MySQL.single.await(('SELECT cash, bank, %s AS balance FROM characters WHERE id = ? LIMIT 1'):format(field), { char.id })
    if not row then return false end
    char.cash = tonumber(row.cash) or 0
    char.bank = tonumber(row.bank) or 0

    Sunset.LogMoneyTransaction(char.id, field, 'in', amount, reason, tonumber(row.balance) or char[field])
    TriggerClientEvent('sunset:client:updateMoney', source, char.cash, char.bank)
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function Sunset.RefreshMoney(source)
    local char = Sunset.GetCharacter(source)
    if not char then return false end
    local row = MySQL.single.await('SELECT cash, bank FROM characters WHERE id = ? LIMIT 1', { char.id })
    if not row then return false end
    char.cash = tonumber(row.cash) or 0
    char.bank = tonumber(row.bank) or 0
    TriggerClientEvent('sunset:client:updateMoney', source, char.cash, char.bank)
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function Sunset.RemoveMoney(source, account, amount, reason)
    local char = Sunset.GetCharacter(source)
    amount = sanitizeMoneyAmount(amount)
    if not char or amount <= 0 then return false end

    local field
    -- [STALE CACHE] no in-memory balance pre-check: the guarded UPDATE below
    -- (`AND field >= ?`) is the single source of truth, so a stale cache can
    -- neither wrongly reject nor wrongly allow a debit.
    if account == 'cash' then
        field = 'cash'
    elseif account == 'bank' then
        field = 'bank'
    else
        return false
    end

    local changed = MySQL.update.await(
        ('UPDATE characters SET %s = %s - ? WHERE id = ? AND %s >= ?'):format(field, field, field),
        { amount, char.id, amount }
    )
    if not changed or changed < 1 then return false end
    local row = MySQL.single.await(('SELECT cash, bank, %s AS balance FROM characters WHERE id = ? LIMIT 1'):format(field), { char.id })
    if not row then return false end
    char.cash = tonumber(row.cash) or 0
    char.bank = tonumber(row.bank) or 0

    Sunset.LogMoneyTransaction(char.id, field, 'out', amount, reason, tonumber(row.balance) or char[field])
    TriggerClientEvent('sunset:client:updateMoney', source, char.cash, char.bank)
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

-- Domain-owned debit on a caller's existing oxmysql transaction connection.
-- The caller must commit its persisted purchase in that same transaction.
-- Optional 5th arg `reason`: also writes the money_transactions ledger row on the
-- SAME transaction connection (atomic with the debit and the caller's purchase),
-- so callers never need to INSERT into the core-owned ledger themselves.
exports('DebitMoneyInTransaction', function(characterId, account, amount, query, reason)
    if account ~= 'cash' and account ~= 'bank' then return false end
    characterId, amount = tonumber(characterId), tonumber(amount)
    if not characterId or not amount or amount ~= amount or amount < 0 or amount ~= math.floor(amount)
        or amount > MAX_MONEY_OP then return false end
    if amount == 0 then return true end
    local changed = query(('UPDATE characters SET %s=%s-? WHERE id=? AND %s>=?')
        :format(account, account, account), { amount, characterId, amount })
    if tonumber(changed) ~= 1 then return false end
    if reason ~= nil then
        query(([[INSERT INTO money_transactions (character_id, account, direction, amount, reason, balance_after)
            SELECT id, '%s', 'out', ?, ?, %s FROM characters WHERE id = ?]]):format(account, account),
            { amount, tostring(reason):sub(1, 64), characterId })
    end
    return true
end)

-- Credit twin of DebitMoneyInTransaction: single atomic `col = col + ?` on the
-- caller's transaction connection (+ optional in-txn ledger row). Never a
-- read-modify-write, never trusts the in-memory cache.
exports('CreditMoneyInTransaction', function(characterId, account, amount, query, reason)
    if account ~= 'cash' and account ~= 'bank' then return false end
    characterId, amount = tonumber(characterId), tonumber(amount)
    if not characterId or not amount or amount ~= amount or amount < 0 or amount ~= math.floor(amount)
        or amount > MAX_MONEY_OP then return false end
    if amount == 0 then return true end
    local changed = query(('UPDATE characters SET %s=%s+? WHERE id=?'):format(account, account), { amount, characterId })
    if tonumber(changed) ~= 1 then return false end
    if reason ~= nil then
        query(([[INSERT INTO money_transactions (character_id, account, direction, amount, reason, balance_after)
            SELECT id, '%s', 'in', ?, ?, %s FROM characters WHERE id = ?]]):format(account, account),
            { amount, tostring(reason):sub(1, 64), characterId })
    end
    return true
end)

-- Credit a character that may be OFFLINE (rent income, offline payouts). Online
-- characters go through AddMoney (cache + client refresh); offline ones get the
-- same atomic UPDATE plus a ledger row. Returns true/false.
function Sunset.AddMoneyToCharacter(characterId, account, amount, reason)
    characterId = tonumber(characterId)
    amount = sanitizeMoneyAmount(amount)
    if not characterId or amount <= 0 or (account ~= 'cash' and account ~= 'bank') then return false end
    local src = GetSourceByCharacterId and GetSourceByCharacterId(characterId)
    if src and Sunset.GetCharacter(src) then return Sunset.AddMoney(src, account, amount, reason) end
    local changed = MySQL.update.await(('UPDATE characters SET %s = %s + ? WHERE id = ?'):format(account, account),
        { amount, characterId })
    if tonumber(changed) ~= 1 then return false end
    local balance = MySQL.scalar.await(('SELECT %s FROM characters WHERE id = ? LIMIT 1'):format(account), { characterId })
    Sunset.LogMoneyTransaction(characterId, account, 'in', amount, reason, tonumber(balance) or 0)
    return true
end
exports('AddMoneyToCharacter', Sunset.AddMoneyToCharacter)

function Sunset.GetMoney(source, account)
    local char = Sunset.GetCharacter(source)
    if not char then return 0 end
    return account == 'bank' and (char.bank or 0) or (char.cash or 0)
end

function Sunset.MoveMoney(source, fromAccount, toAccount, amount, reason)
    local char = Sunset.GetCharacter(source)
    amount = sanitizeMoneyAmount(amount)
    if not char or amount <= 0 or fromAccount == toAccount then return false end
    if (fromAccount ~= 'cash' and fromAccount ~= 'bank') or (toAccount ~= 'cash' and toAccount ~= 'bank') then
        return false
    end
    local changed = MySQL.update.await(([[
        UPDATE characters
        SET %s = %s - ?, %s = %s + ?
        WHERE id = ? AND %s >= ?
    ]]):format(fromAccount, fromAccount, toAccount, toAccount, fromAccount), {
        amount, amount, char.id, amount,
    })
    if not changed or changed < 1 then
        Sunset.RefreshMoney(source)
        return false
    end
    Sunset.RefreshMoney(source)
    Sunset.LogMoneyTransaction(char.id, fromAccount, 'out', amount, reason, char[fromAccount])
    Sunset.LogMoneyTransaction(char.id, toAccount, 'in', amount, reason, char[toAccount])
    return true
end

function Sunset.TransferMoney(source, targetSource, account, amount, reason)
    local fromChar, toChar = Sunset.GetCharacter(source), Sunset.GetCharacter(targetSource)
    amount = sanitizeMoneyAmount(amount)
    if not fromChar or not toChar or source == targetSource or amount <= 0 then return false end
    if account ~= 'cash' and account ~= 'bank' then return false end

    -- The guard subquery makes this a single all-or-nothing SQL statement: if
    -- the sender lacks funds, neither row is updated.
    local changed = MySQL.update.await(([[
        UPDATE characters AS c
        JOIN (SELECT id FROM characters WHERE id = ? AND %s >= ?) AS allowed ON 1 = 1
        SET c.%s = CASE WHEN c.id = ? THEN c.%s - ? ELSE c.%s + ? END
        WHERE c.id IN (?, ?)
    ]]):format(account, account, account, account), {
        fromChar.id, amount,
        fromChar.id, amount, amount,
        fromChar.id, toChar.id,
    })
    if not changed or changed < 2 then
        Sunset.RefreshMoney(source)
        Sunset.RefreshMoney(targetSource)
        return false
    end
    Sunset.RefreshMoney(source)
    Sunset.RefreshMoney(targetSource)
    local fromName = Sunset.GetPlayerDisplayName(source)
    local toName = Sunset.GetPlayerDisplayName(targetSource)
    local outReason = ('Transfer -> %s'):format(tostring(toName)):sub(1, 64)
    local inReason = ('Transfer <- %s'):format(tostring(fromName)):sub(1, 64)
    Sunset.LogMoneyTransaction(fromChar.id, account, 'out', amount, outReason, fromChar[account])
    Sunset.LogMoneyTransaction(toChar.id, account, 'in', amount, inReason, toChar[account])
    return true
end

function Sunset.SetJob(source, job, grade)
    local char = Sunset.GetCharacter(source)
    if not char then return false end
    if Sunset.Factions and Sunset.Factions[job] then return false end

    grade = tonumber(grade) or 0

    if not (Sunset.CivilianJobs and Sunset.CivilianJobs[job]) then
        return false
    end

    if not Sunset.CivilianJobs[job].grades or not Sunset.CivilianJobs[job].grades[grade] then
        return false
    end

    char.job = job
    char.job_grade = grade
    MySQL.update.await(
        'UPDATE characters SET job = ?, job_grade = ? WHERE id = ?',
        { char.job, char.job_grade, char.id }
    )
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    TriggerEvent('sunset:server:jobChanged', source, job, grade or 0)
    return true
end


function Sunset.SetFaction(source, factionId, grade)
    local char = Sunset.GetCharacter(source)
    if not char then return false end

    char.metadata = char.metadata or {}
    local previousFaction = char.metadata.faction
    if not factionId or factionId == 'none' then
        char.metadata.faction = nil
        char.metadata.faction_grade = nil
        if char.job and Sunset.Factions and Sunset.Factions[char.job] then
            char.job = 'unemployed'
            char.job_grade = 0
        end
    else
        if not Sunset.Factions[factionId] then return false end
        grade = tonumber(grade) or 0
        if not Sunset.Factions[factionId].grades[grade] then return false end
        char.metadata.faction = factionId
        char.metadata.faction_grade = grade
        if Sunset.Factions[char.job] then
            char.job = 'unemployed'
            char.job_grade = 0
        end
    end

    MySQL.update.await(
        'UPDATE characters SET job = ?, job_grade = ?, metadata = ? WHERE id = ?',
        { char.job or 'unemployed', char.job_grade or 0, json.encode(char.metadata), char.id }
    )
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    Player(source).state:set('sunsetDisplayName', GetPlayerDisplayName(source), true)
    TriggerEvent('sunset:server:factionChanged', source, char.metadata.faction, grade or 0, previousFaction)
    return true
end

function Sunset.SetFactionByCharacterId(characterId, factionId, grade)
    characterId = tonumber(characterId)
    if not characterId then return false end
    local row = MySQL.single.await('SELECT id, job, job_grade, metadata FROM characters WHERE id = ? LIMIT 1', { characterId })
    if not row then return false end

    local metadata = row.metadata
    if type(metadata) == 'string' then
        local ok, decoded = pcall(json.decode, metadata)
        metadata = ok and decoded or {}
    end
    metadata = type(metadata) == 'table' and metadata or {}

    local previousFaction = metadata.faction
    local job = row.job or 'unemployed'
    local jobGrade = tonumber(row.job_grade) or 0

    if not factionId or factionId == 'none' then
        metadata.faction = nil
        metadata.faction_grade = nil
    else
        if not Sunset.Factions[factionId] then return false end
        grade = tonumber(grade) or 0
        if not Sunset.Factions[factionId].grades[grade] then return false end
        metadata.faction = factionId
        metadata.faction_grade = grade
        if Sunset.Factions[job] then
            job = 'unemployed'
            jobGrade = 0
        end
    end

    MySQL.update.await(
        'UPDATE characters SET job = ?, job_grade = ?, metadata = ? WHERE id = ?',
        { job, jobGrade, json.encode(metadata), characterId }
    )

    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local char = src and Sunset.GetCharacter(src)
        if char and tonumber(char.id) == characterId then
            char.metadata = metadata
            char.job = job
            char.job_grade = jobGrade
            TriggerClientEvent('sunset:client:updateCharacter', src, char)
            TriggerEvent('sunset:server:factionChanged', src, metadata.faction, grade or 0, previousFaction)
            break
        end
    end
    return true
end

function Sunset.AddXP(source, amount)
    local char = Sunset.GetCharacter(source)
    if not char or not amount or amount <= 0 then return false end

    amount = sanitizeMoneyAmount(amount)
    if amount <= 0 then return false end
    local changed = MySQL.update.await('UPDATE characters SET xp = xp + ? WHERE id = ?', { amount, char.id })
    if not changed or changed < 1 then return false end
    char.xp = tonumber(MySQL.scalar.await('SELECT xp FROM characters WHERE id = ?', { char.id })) or char.xp or 0
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function Sunset.AddRespectPoints(source, amount)
    local char = Sunset.GetCharacter(source)
    amount = sanitizeMoneyAmount(amount)
    if not char or amount <= 0 then return false end
    local changed = MySQL.update.await(
        'UPDATE characters SET respect_points = respect_points + ?, paydays_received = paydays_received + 1 WHERE id = ?',
        { amount, char.id }
    )
    if not changed or changed < 1 then return false end
    local row = MySQL.single.await('SELECT respect_points, paydays_received FROM characters WHERE id = ?', { char.id })
    if not row then return false end
    char.respect_points = tonumber(row.respect_points) or 0
    char.paydays_received = tonumber(row.paydays_received) or 0
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

local BuyLevelLocks = {}

local buyLevel
buyLevel = function(source)
    local char = Sunset.GetCharacter(source)
    if not char then return false, { localeKey = 'core.message.character_not_loaded' } end
    if BuyLevelLocks[source] then
        return false, { localeKey = 'core.message.your_level_purchase_is_already_being_processed' }
    end

    BuyLevelLocks[source] = true
    local rpCost = Sunset.GetLevelRespectCost(char.level)
    local moneyCost = Sunset.GetLevelMoneyCost(char.level)
    if (char.respect_points or 0) < rpCost then
        BuyLevelLocks[source] = nil
        return false, { localeKey = 'core.message.level_value_requires_value_rp_you_have_value_you', formatArgs = { (char.level or 1) + 1, rpCost, char.respect_points or 0 } }
    end
    local account
    if Sunset.GetMoney(source, 'bank') >= moneyCost then account = 'bank'
    elseif Sunset.GetMoney(source, 'cash') >= moneyCost then account = 'cash' end
    if not account then
        BuyLevelLocks[source] = nil
        return false, { localeKey = 'core.message.level_value_costs_value_keep_the_full_amount_in', formatArgs = { (char.level or 1) + 1, moneyCost } }
    end
    local changed = MySQL.update.await(([[
        UPDATE characters
        SET level = level + 1, respect_points = respect_points - ?, %s = %s - ?
        WHERE id = ? AND level = ? AND respect_points >= ? AND %s >= ?
    ]]):format(account, account, account), {
        rpCost, moneyCost, char.id, char.level, rpCost, moneyCost,
    })
    if not changed or changed < 1 then
        Sunset.RefreshMoney(source)
        BuyLevelLocks[source] = nil
        return false, { localeKey = 'core.message.your_money_or_rp_changed_while_processing_nothing_was' }
    end
    local row = MySQL.single.await('SELECT cash, bank, level, respect_points FROM characters WHERE id = ?', { char.id })
    if not row then
        BuyLevelLocks[source] = nil
        return false, { localeKey = 'core.message.level_was_saved_but_the_updated_profile_could_not' }
    end
    char.cash, char.bank = tonumber(row.cash) or 0, tonumber(row.bank) or 0
    char.level, char.respect_points = tonumber(row.level) or char.level, tonumber(row.respect_points) or 0
    Sunset.LogMoneyTransaction(char.id, account, 'out', moneyCost, 'buy_level', char[account])
    TriggerClientEvent('sunset:client:updateMoney', source, char.cash, char.bank)
    TriggerClientEvent('sunset:client:updateCharacter', source, char)

    -- [QUESTS] Emit canonical quest progress for level reached
    TriggerEvent('sunset:quest:progress', char.id, 'level_reached', char.level, { level = char.level })

    BuyLevelLocks[source] = nil
    return true, ('Level purchased! You are now level %d. Paid %d RP and $%d; %d RP remain.'):format(char.level, rpCost, moneyCost, char.respect_points)
end

-- [SEC3] a SQL error inside buyLevel left BuyLevelLocks[source] set forever; always release.
local buyLevelLocked = buyLevel
buyLevel = function(source)
    local ok, a, b = pcall(buyLevelLocked, source)
    if not ok then
        BuyLevelLocks[source] = nil
        print(('^1[blaze.mp]^7 buyLevel error: %s'):format(tostring(a)))
        return false, { localeKey = 'error.server_action_failed' }
    end
    return a, b
end

RegisterCallback('sunset:buyLevel', function(source)
    return buyLevel(source)
end)

RegisterCommand('buylevel', function(source)
    if source == 0 then return end
    local ok, message = buyLevel(source)
    TriggerClientEvent('sunset:client:notify', source, message or exports.sunset_core:TFor(source, ok and 'core.message.level_purchased' or 'core.message.level_purchase_failed'), ok and 'success' or 'error', ok and 9000 or 7000)
end, false)

function ExecutePlayerCommand(source, name, args)
    if source == 0 then return false end
    name = string.lower(tostring(name or ''))
    if name == 'buylevel' then
        local ok, message = buyLevel(source)
        TriggerClientEvent('sunset:client:notify', source, message or exports.sunset_core:TFor(source, ok and 'core.message.level_purchased' or 'core.message.level_purchase_failed'), ok and 'success' or 'error', ok and 9000 or 7000)
        return true
    end
    return false
end
exports('ExecutePlayerCommand', ExecutePlayerCommand)

AddEventHandler('playerDropped', function()
    BuyLevelLocks[source] = nil
end)

function Sunset.SetSpawnPreference(source, choice, propertyId)
    local char = Sunset.GetCharacter(source)
    if not char then return false end
    decodeChar(char)
    char.metadata = type(char.metadata) == 'table' and char.metadata or {}
    choice = tostring(choice or '')
    if choice ~= 'default' and choice ~= 'last' and choice ~= 'house' and choice ~= 'hq' then
        return false
    end
    char.metadata.spawn_choice = choice
    if choice == 'house' and propertyId then
        char.metadata.spawn_property_id = tonumber(propertyId)
    else
        char.metadata.spawn_property_id = nil
    end
    -- [AUDIT P5-10] Targeted JSON_SET so other metadata keys survive (see SetRobPoints).
    if char.metadata.spawn_property_id then
        MySQL.update.await(
            "UPDATE characters SET metadata = JSON_SET(COALESCE(NULLIF(metadata,''),'{}'), '$.spawn_choice', ?, '$.spawn_property_id', ?) WHERE id = ?",
            { choice, char.metadata.spawn_property_id, char.id })
    else
        MySQL.update.await(
            "UPDATE characters SET metadata = JSON_REMOVE(JSON_SET(COALESCE(NULLIF(metadata,''),'{}'), '$.spawn_choice', ?), '$.spawn_property_id') WHERE id = ?",
            { choice, char.id })
    end
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function Sunset.GetSpawnPosition(char, source)
    if not char then return nil end
    decodeChar(char)
    local metadata = type(char.metadata) == 'table' and char.metadata or {}
    local choice = metadata.spawn_choice
    if choice and GetResourceState('sunset_properties') == 'started' then
        local ok, resolved = pcall(function()
            return exports.sunset_properties:ResolveSpawnChoice(source or 0, char, choice, metadata.spawn_property_id)
        end)
        if ok and type(resolved) == 'table' and resolved.x then
            return resolved
        end
    end

    if char.home_property_id then
        local prop = MySQL.single.await(
            'SELECT id, entry, owner_character_id, enabled FROM properties WHERE id = ? LIMIT 1',
            { char.home_property_id }
        )
        if prop and prop.entry then
            local enabled = prop.enabled == true or prop.enabled == 1 or prop.enabled == '1'
            local isOwner = tonumber(prop.owner_character_id) == tonumber(char.id)
            local isRenter = false
            if not isOwner then
                isRenter = MySQL.scalar.await(
                    'SELECT 1 FROM property_rentals WHERE property_id = ? AND character_id = ? AND active = 1 LIMIT 1',
                    { char.home_property_id, char.id }
                ) ~= nil
            end
            if enabled and (isOwner or isRenter) then
                local entry = type(prop.entry) == 'string' and json.decode(prop.entry) or prop.entry
                if entry and entry.x then return entry end
            end
        end
    end
    local pos = char.position or {}
    if type(pos) == 'string' then
        local ok, decoded = pcall(json.decode, pos)
        pos = ok and decoded or {}
    end
    if pos.x then return pos end
    local spawn = Sunset.Config.DefaultSpawn
    return { x = spawn.x, y = spawn.y, z = spawn.z, w = spawn.w }
end

Sunset.DecodeCharacter = decodeChar

exports('SaveCharacter', Sunset.SaveCharacter)
exports('AddMoney', Sunset.AddMoney)
exports('RemoveMoney', Sunset.RemoveMoney)
exports('GetMoney', Sunset.GetMoney)
-- [BUGFIX] MoveMoney/TransferMoney were declared in fxmanifest and used by
-- sunset_economy (ATM deposit/withdraw + bank transfer) but never actually
-- exported, so every ATM/transfer call hit a missing export and failed
-- silently. Caught by the testdriver smoke check.
exports('MoveMoney', Sunset.MoveMoney)
exports('TransferMoney', Sunset.TransferMoney)
exports('SetPersistentStat', Sunset.SetPersistentStat)

-- [SEC2] Owner-side writer for characters.metadata.skin (used by sunset_skins so it no
-- longer writes the characters table directly). Atomic JSON_SET/JSON_REMOVE, no read-modify-write race.
exports('SetCharacterSkin', function(characterId, skin)
    characterId = tonumber(characterId)
    if not characterId then return false end
    local cleanSkin = (type(skin) == 'string' and skin ~= '' and #skin <= 64 and skin ~= 'default' and skin ~= 'reset') and skin or nil
    local changed
    if cleanSkin then
        changed = MySQL.update.await("UPDATE characters SET metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.skin', ?) WHERE id = ?", { cleanSkin, characterId })
    else
        changed = MySQL.update.await("UPDATE characters SET metadata = JSON_REMOVE(COALESCE(metadata, JSON_OBJECT()), '$.skin') WHERE id = ?", { characterId })
    end

    -- Update in-memory player character cache
    -- (Players is local to main.lua; iterate via FiveM native + Sunset.GetPlayer)
    for _, srcStr in ipairs(GetPlayers()) do
        local src = tonumber(srcStr)
        local p = src and Sunset.GetPlayer(src)
        if p and p.character and tonumber(p.character.id) == characterId then
            p.character.metadata = type(p.character.metadata) == 'table' and p.character.metadata or {}
            p.character.metadata.skin = cleanSkin
            TriggerClientEvent('sunset:client:updateCharacter', src, p.character)
        end
    end

    return changed ~= nil
end)
exports('RefreshBlazePoints', Sunset.RefreshBlazePoints)
exports('SpendBlazePoints', Sunset.SpendBlazePoints)
exports('AddBlazePoints', Sunset.AddBlazePoints)
exports('RenameCharacter', Sunset.RenameCharacter)
exports('SetHomeProperty', Sunset.SetHomeProperty)
exports('RefreshMoney', Sunset.RefreshMoney)
exports('SetJob', Sunset.SetJob)
exports('SetFaction', Sunset.SetFaction)
-- [BUGFIX] SetFactionByCharacterId was declared in fxmanifest + called by
-- sunset_factions (offline kick/rank/core sync) but never actually exported,
-- so every call hit "No such export" and offline kicks silently failed.
exports('SetFactionByCharacterId', Sunset.SetFactionByCharacterId)
exports('AddXP', Sunset.AddXP)
-- [AUDIT P6-05] Shared incapacitation gate: downed or jailed players must not
-- keep economic agency (trade, give cash, buy, gamble) or spawn vehicles.
function Sunset.IsIncapacitated(source)
    if GetResourceState('sunset_death') == 'started' then
        local ok, downed = pcall(function() return exports.sunset_death:IsPlayerDowned(source) end)
        if ok and downed then return true, 'downed' end
    end
    if GetResourceState('sunset_factions') == 'started' then
        local ok, state = pcall(function() return exports.sunset_factions:GetDetentionState(source) end)
        if ok and tostring(state or ''):upper() == 'JAILED' then return true, 'jailed' end
    end
    return false
end

function Sunset.GetRobPoints(source)
    local char = Sunset.GetCharacter(source)
    if not char then return 0 end
    char.metadata = type(char.metadata) == 'table' and char.metadata or {}
    return math.max(0, math.floor(tonumber(char.metadata.rob_points) or 0))
end

function Sunset.SetRobPoints(source, value)
    local char = Sunset.GetCharacter(source)
    if not char then return false end
    value = math.max(0, math.floor(tonumber(value) or 0))
    char.metadata = type(char.metadata) == 'table' and char.metadata or {}
    char.metadata.rob_points = value
    -- [AUDIT P5-10] Targeted JSON_SET instead of rewriting the whole blob:
    -- concurrent writers (quickslots, payday) keep their own keys.
    MySQL.update.await(
        "UPDATE characters SET metadata = JSON_SET(COALESCE(NULLIF(metadata,''),'{}'), '$.rob_points', ?) WHERE id = ?",
        { value, char.id })
    TriggerClientEvent('sunset:client:updateCharacter', source, char)
    return true
end

function Sunset.AddRobPoints(source, amount)
    amount = sanitizeMoneyAmount(amount)
    if amount == 0 then return true end
    local nextValue = Sunset.GetRobPoints(source) + amount
    if nextValue < 0 then return false end
    return Sunset.SetRobPoints(source, nextValue)
end

exports('AddRespectPoints', Sunset.AddRespectPoints)
exports('GetRobPoints', Sunset.GetRobPoints)
exports('IsIncapacitated', Sunset.IsIncapacitated)
exports('SetRobPoints', Sunset.SetRobPoints)
exports('AddRobPoints', Sunset.AddRobPoints)
exports('SetSpawnPreference', Sunset.SetSpawnPreference)
exports('GetSpawnPosition', Sunset.GetSpawnPosition)

function Sunset.CanAccess(source, gateId)
    gateId = tostring(gateId or '')
    local gate = Sunset.ProgressionGates and Sunset.ProgressionGates[gateId]
    if not gate then return { allowed = true } end

    local char = Sunset.GetCharacter(source)
    if not char then
        return { allowed = false, reason = 'No active character loaded.' }
    end

    -- 1. Licenses
    local licensesMap = {}
    if GetResourceState('sunset_licenses') == 'started' then
        pcall(function()
            local lics = exports.sunset_licenses:GetLicenses(source)
            if type(lics) == 'table' then
                for _, l in ipairs(lics) do
                    if l.valid then licensesMap[l.license_type] = true end
                end
            end
        end)
    end

    -- 2. Completed Quests
    local completedQuestsMap = {}
    if GetResourceState('sunset_quests') == 'started' then
        pcall(function()
            local prog = exports.sunset_quests:GetProgress(source)
            if type(prog) == 'table' then
                for _, q in ipairs(prog) do
                    if q.status == 'complete' or q.status == 'claimed' then
                        completedQuestsMap[q.questKey] = true
                    end
                end
            end
        end)
    end

    -- 3. Clan Data
    local clanData = nil
    if GetResourceState('sunset_clans') == 'started' then
        pcall(function()
            local mem = exports.sunset_clans:GetPlayerClan(source)
            if mem then clanData = mem end
        end)
    end

    return Sunset.EvaluateGate(gateId, char, licensesMap, completedQuestsMap, clanData)
end
exports('CanAccess', Sunset.CanAccess)

