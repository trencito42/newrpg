local RPGFactions = {}
local factionCache = {} -- accountId -> { factionId = ..., factionLeader = ..., factionName = ... }

local function normalize(name)
    return tostring(name or ''):gsub('^%s+', ''):gsub('%s+$', ''):lower()
end

function RPGFactions.GetPlayerFaction(accountId)
    accountId = tonumber(accountId)
    if not accountId then return nil end
    if factionCache[accountId] then return factionCache[accountId] end
    local row = MySQL.single.await([[
        SELECT p.faction_id, p.faction_leader, f.name
        FROM players p LEFT JOIN factions f ON f.id = p.faction_id
        WHERE p.account_id = ?
    ]], { accountId })
    if not row then return nil end
    factionCache[accountId] = {
        factionId = row.faction_id and tonumber(row.faction_id) or nil,
        factionLeader = row.faction_leader == true or tonumber(row.faction_leader) == 1,
        factionName = row.name,
    }
    return factionCache[accountId]
end

function RPGFactions.IsPlayerLeader(accountId)
    accountId = tonumber(accountId)
    if not accountId then return false end
    local info = RPGFactions.GetPlayerFaction(accountId)
    return info ~= nil and info.factionLeader == true
end

function RPGFactions.SetLeader(targetAccountId, factionName)
    targetAccountId = tonumber(targetAccountId)
    if not targetAccountId or type(factionName) ~= 'string' then return false, 'Invalid target account or faction name.' end
    local cleanName = factionName:match('^%s*(.-)%s*$') or ''
    if cleanName == '' or #cleanName > 64 then return false, 'Faction name must be 1-64 characters.' end
    local normalized = normalize(cleanName)

    MySQL.insert.await('INSERT IGNORE INTO factions (name, name_normalized) VALUES (?, ?)', { cleanName, normalized })
    local factionId = MySQL.scalar.await('SELECT id FROM factions WHERE name_normalized = ?', { normalized })
    factionId = tonumber(factionId)
    if not factionId then return false, 'Failed to resolve faction ID.' end

    -- Find previous leader of this faction if any to update cache
    local oldLeaderAccountId = MySQL.scalar.await('SELECT account_id FROM players WHERE faction_id = ? AND faction_leader = TRUE LIMIT 1', { factionId })
    oldLeaderAccountId = oldLeaderAccountId and tonumber(oldLeaderAccountId) or nil

    local committed = MySQL.transaction.await({
        {
            query = 'UPDATE players SET faction_leader = FALSE WHERE faction_id = ?',
            values = { factionId },
        },
        {
            query = 'UPDATE players SET faction_id = ?, faction_leader = TRUE WHERE account_id = ?',
            values = { factionId, targetAccountId },
        },
    })
    if not committed then return false, 'Database transaction failed.' end

    if oldLeaderAccountId then
        factionCache[oldLeaderAccountId] = nil
        exports.rpg_core:RefreshProfileFields(oldLeaderAccountId)
    end

    factionCache[targetAccountId] = {
        factionId = factionId,
        factionLeader = true,
        factionName = cleanName,
    }
    exports.rpg_core:RefreshProfileFields(targetAccountId)
    return true, cleanName, factionId
end

AddEventHandler('rpg:server:authenticated', function(_, profile)
    if profile and profile.accountId then
        RPGFactions.GetPlayerFaction(profile.accountId)
    end
end)

AddEventHandler('rpg:server:playerFinalized', function(_, accountId)
    if accountId then factionCache[tonumber(accountId)] = nil end
end)

exports('GetPlayerFaction', RPGFactions.GetPlayerFaction)
exports('IsPlayerLeader', RPGFactions.IsPlayerLeader)
exports('SetLeader', RPGFactions.SetLeader)
