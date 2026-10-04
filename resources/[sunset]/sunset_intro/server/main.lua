-- The presentation is remembered on the account, not the FiveM license.
-- A license can be shared by several accounts, and a new character on an
-- account that already finished the slides must not see them again.

MySQL.query.await([[
    CREATE TABLE IF NOT EXISTS `account_intro_seen` (
        `account_id` INT UNSIGNED NOT NULL,
        `seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`account_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
]])

local function accountId(source)
    local player = exports.sunset_core:GetPlayer(source)
    return player and tonumber(player.account_id) or nil
end

exports.sunset_core:RegisterCallback('sunset:intro:hasSeen', function(source)
    local id = accountId(source)
    if not id then return true end
    local seen = MySQL.scalar.await(
        'SELECT 1 FROM account_intro_seen WHERE account_id = ? LIMIT 1',
        { id }
    )
    return seen ~= nil
end)

exports.sunset_core:RegisterCallback('sunset:intro:markSeen', function(source)
    local id = accountId(source)
    if not id then return false end
    if not exports.sunset_core:RateLimit(source, 'intro:markSeen', 1500) then
        return true
    end
    local changed = MySQL.update.await(
        'INSERT IGNORE INTO account_intro_seen (account_id) VALUES (?)',
        { id }
    )
    return changed ~= nil
end)
