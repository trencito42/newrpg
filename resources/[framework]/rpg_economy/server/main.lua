local RPGEconomy = {}

local function toValidInt(value, min, max)
    local n = tonumber(value)
    if not n or n % 1 ~= 0 or n < (min or 0) or n > (max or 100000000) then return nil end
    return math.floor(n)
end

function RPGEconomy.AddMoney(accountId, amount)
    accountId = tonumber(accountId)
    amount = toValidInt(amount, 1, 100000000)
    if not accountId or not amount then return false, 'Invalid account or amount.' end
    local affected = MySQL.update.await('UPDATE players SET money = money + ? WHERE account_id = ?', { amount, accountId })
    if affected == 1 then
        exports.rpg_core:RefreshProfileFields(accountId)
        return true
    end
    return false, 'Database failed to update money.'
end

function RPGEconomy.SetMoney(accountId, amount)
    accountId = tonumber(accountId)
    amount = toValidInt(amount, 0, 1000000000)
    if not accountId or not amount then return false, 'Invalid account or amount.' end
    local affected = MySQL.update.await('UPDATE players SET money = ? WHERE account_id = ?', { amount, accountId })
    if affected == 1 then
        exports.rpg_core:RefreshProfileFields(accountId)
        return true
    end
    return false, 'Database failed to set money.'
end

function RPGEconomy.AddRespectPoints(accountId, amount)
    accountId = tonumber(accountId)
    amount = toValidInt(amount, 1, 1000000)
    if not accountId or not amount then return false, 'Invalid account or amount.' end
    local affected = MySQL.update.await('UPDATE players SET respect_points = respect_points + ? WHERE account_id = ?', { amount, accountId })
    if affected == 1 then
        exports.rpg_core:RefreshProfileFields(accountId)
        return true
    end
    return false, 'Database failed to update respect points.'
end

function RPGEconomy.SetRespectPoints(accountId, amount)
    accountId = tonumber(accountId)
    amount = toValidInt(amount, 0, 10000000)
    if not accountId or not amount then return false, 'Invalid account or amount.' end
    local affected = MySQL.update.await('UPDATE players SET respect_points = ? WHERE account_id = ?', { amount, accountId })
    if affected == 1 then
        exports.rpg_core:RefreshProfileFields(accountId)
        return true
    end
    return false, 'Database failed to set respect points.'
end

function RPGEconomy.GetStats(accountId)
    accountId = tonumber(accountId)
    if not accountId then return nil end
    local row = MySQL.single.await('SELECT money, respect_points, level, xp FROM players WHERE account_id = ?', { accountId })
    if not row then return nil end
    return {
        money = tonumber(row.money) or 0,
        respectPoints = tonumber(row.respect_points) or 0,
        level = tonumber(row.level) or 1,
        xp = tonumber(row.xp) or 0,
    }
end

exports('AddMoney', RPGEconomy.AddMoney)
exports('SetMoney', RPGEconomy.SetMoney)
exports('AddRespectPoints', RPGEconomy.AddRespectPoints)
exports('SetRespectPoints', RPGEconomy.SetRespectPoints)
exports('GetStats', RPGEconomy.GetStats)
