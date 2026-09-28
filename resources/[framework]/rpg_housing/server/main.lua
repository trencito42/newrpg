local RPGHousing = {}

function RPGHousing.CreateHouse(creatorAccountId, level, price, position)
    creatorAccountId = tonumber(creatorAccountId)
    level = tonumber(level)
    price = tonumber(price)
    if not level or level % 1 ~= 0 or level < 1 or level > 10 then return nil, 'House level must be 1-10.' end
    if not price or price % 1 ~= 0 or price < 1 or price > 2000000000 then return nil, 'House price must be positive.' end
    if type(position) ~= 'table' or not position.x or not position.y or not position.z then return nil, 'Invalid position.' end

    local id = MySQL.insert.await([[
        INSERT INTO houses (level, price, x, y, z, heading, virtual_world, created_by_account_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        level, price, position.x, position.y, position.z, position.heading or 0.0, position.bucket or 0, creatorAccountId,
    })
    if not id then return nil, 'Failed to insert house into database.' end
    return id
end

function RPGHousing.GetHouse(houseId)
    houseId = tonumber(houseId)
    if not houseId then return nil end
    return MySQL.single.await('SELECT * FROM houses WHERE id = ?', { houseId })
end

exports('CreateHouse', RPGHousing.CreateHouse)
exports('GetHouse', RPGHousing.GetHouse)
