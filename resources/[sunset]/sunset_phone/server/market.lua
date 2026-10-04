-- Player marketplace. Vehicles, tradable items, and player-owned properties.
-- Server-owned properties and CNN ads stay on their existing read-only queries.

local function marketFeePercent()
    return math.max(0, math.min(25, math.floor(tonumber(Sunset.Config and Sunset.Config.MarketFeePercent) or 5)))
end
local BLOCKED_ITEMS = { id_card = true, phone = true }

local function charOf(source)
    return exports.sunset_core:GetCharacter(source)
end

local function publicName(first, last)
    if exports.sunset_core.FormatPublicName then
        return exports.sunset_core:FormatPublicName(first, last)
    end
    first = tostring(first or ''):gsub('^%s+', ''):gsub('%s+$', '')
    last = tostring(last or ''):gsub('^%s+', ''):gsub('%s+$', '')
    if last == '' then return first end
    return (first .. ' ' .. last):gsub('%s+', ' ')
end

local function sellerOnline(characterId)
    for _, src in ipairs(GetPlayers()) do
        local c = charOf(tonumber(src))
        if c and tonumber(c.id) == tonumber(characterId) then return tonumber(src) end
    end
    return nil
end

local function giveItem(characterId, item, count)
    count = math.floor(tonumber(count) or 0)
    if count < 1 or not Sunset.Items[item] then return false end
    local src = sellerOnline(characterId)
    if src and GetResourceState('sunset_inventory') == 'started' then
        return exports.sunset_inventory:AddItem(src, item, count) == true
    end
    local row = MySQL.single.await(
        'SELECT id, count FROM character_inventory WHERE character_id = ? AND item = ? AND metadata IS NULL LIMIT 1',
        { characterId, item })
    if row then
        return (MySQL.update.await('UPDATE character_inventory SET count = count + ? WHERE id = ?', { count, row.id }) or 0) >= 1
    end
    local slot = MySQL.scalar.await('SELECT COALESCE(MAX(slot), 0) + 1 FROM character_inventory WHERE character_id = ?', { characterId })
    local id = MySQL.insert.await(
        'INSERT INTO character_inventory (character_id, item, count, slot) VALUES (?, ?, ?, ?)',
        { characterId, item, count, tonumber(slot) or 1 })
    return id ~= nil
end

local function tradable(item)
    local def = Sunset.Items[item]
    if not def or def.weapon or BLOCKED_ITEMS[item] then return false end
    return true
end

local function lockListing(id)
    local changed = MySQL.update.await([[
        UPDATE phone_market_listings
        SET status = 'sold', completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ]], { id })
    return tonumber(changed) == 1
end

local function reopen(id)
    MySQL.update.await("UPDATE phone_market_listings SET status = 'active', completed_at = NULL, buyer_character_id = NULL WHERE id = ? AND status = 'sold'", { id })
end

local function paySeller(sellerId, amount, reason)
    return exports.sunset_core:AddMoneyToCharacter(sellerId, 'bank', amount, reason) == true
end

exports.sunset_core:RegisterCallback('sunset:phoneMarketBrowse', function(source, payload)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    payload = type(payload) == 'table' and payload or {}
    local page = math.max(1, math.floor(tonumber(payload.page) or 1))
    local size = math.min(20, math.max(1, math.floor(tonumber(payload.pageSize) or 12)))
    local kind = tostring(payload.type or 'all')
    if kind ~= 'vehicle' and kind ~= 'item' and kind ~= 'property' and kind ~= 'all' then kind = 'all' end
    local q = tostring(payload.q or ''):sub(1, 32)
    local offset = (page - 1) * size
    local rows = MySQL.query.await([[
        SELECT l.id, l.listing_type, l.asset_id, l.quantity, l.asking_price, l.seller_character_id, l.created_at,
               c.firstname, c.lastname, c.phone_number,
               v.model, v.plate, p.label AS property_label
        FROM phone_market_listings l
        JOIN characters c ON c.id = l.seller_character_id
        LEFT JOIN vehicles v ON l.listing_type = 'vehicle' AND v.id = CAST(l.asset_id AS UNSIGNED)
        LEFT JOIN properties p ON l.listing_type = 'property' AND p.id = CAST(l.asset_id AS UNSIGNED)
        WHERE l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > CURRENT_TIMESTAMP)
          AND (? = 'all' OR l.listing_type = ?)
          AND (? = '' OR l.asset_id LIKE CONCAT('%', ?, '%')
            OR IFNULL(v.model, '') LIKE CONCAT('%', ?, '%')
            OR IFNULL(v.plate, '') LIKE CONCAT('%', ?, '%')
            OR IFNULL(p.label, '') LIKE CONCAT('%', ?, '%'))
        ORDER BY l.id DESC
        LIMIT ? OFFSET ?
    ]], { kind, kind, q, q, q, q, q, size, offset }) or {}
    local out = {}
    for _, row in ipairs(rows) do
        local title = row.listing_type == 'vehicle' and ((row.model or 'vehicle') .. ' ' .. (row.plate or ''))
            or row.listing_type == 'property' and (row.property_label or 'property')
            or (Sunset.Items[row.asset_id] and (Sunset.Items[row.asset_id].label or row.asset_id) or row.asset_id)
        out[#out + 1] = {
            id = tonumber(row.id),
            listingId = tonumber(row.id),
            category = row.listing_type == 'vehicle' and 'vehicles' or row.listing_type == 'item' and 'items' or 'player_properties',
            title = title,
            price = tonumber(row.asking_price) or 0,
            quantity = tonumber(row.quantity) or 1,
            seller = publicName(row.firstname, row.lastname),
            phone = row.phone_number,
            characterId = tonumber(row.seller_character_id),
            kind = 'player',
            model = row.model,
        }
    end
    local mine = MySQL.query.await([[
        SELECT id, listing_type, asset_id, quantity, asking_price, status
        FROM phone_market_listings
        WHERE seller_character_id = ?
        ORDER BY id DESC LIMIT 20
    ]], { char.id }) or {}
    return { rows = out, mine = mine, page = page }
end)

exports.sunset_core:RegisterCallback('sunset:phoneMarketListVehicle', function(source, vehicleId, price)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    vehicleId = tonumber(vehicleId)
    price = math.floor(tonumber(price) or 0)
    if not vehicleId or price < 100 or price > 50000000 then
        return nil, { localeKey = 'phone.message.invalid_contact_id' }
    end
    if not exports.sunset_core:RateLimit(source, 'phoneMarketList', 800) then
        return nil, { localeKey = 'phone.message.database_error_while_saving_contact' }
    end
    local row = MySQL.single.await([[
        SELECT id, model, stored, destroyed, garage FROM vehicles WHERE id = ? AND character_id = ?
    ]], { vehicleId, char.id })
    if not row then return nil, { localeKey = 'vehicles.message.seller_no_longer_owns_this_vehicle' } end
    if tonumber(row.stored) ~= 1 or tonumber(row.destroyed) == 1 or tostring(row.garage or '') == 'impound' then
        return nil, { localeKey = 'vehicles.message.only_garage_stored_vehicles_can_be_traded' }
    end
    local listed = MySQL.scalar.await([[
        SELECT id FROM phone_market_listings
        WHERE listing_type = 'vehicle' AND asset_id = ? AND status = 'active' LIMIT 1
    ]], { tostring(vehicleId) })
    if listed then return nil, { localeKey = 'phone.message.database_error_while_saving_contact' } end
    if GetResourceState('sunset_inventory') == 'started' then
        local busy = false
        pcall(function() busy = exports.sunset_inventory:IsAssetOfferedInTrade('vehicle', vehicleId) end)
        if busy then return nil, { localeKey = 'vehicles.message.vehicle_transfer_failed' } end
    end
    local id = MySQL.insert.await([[
        INSERT INTO phone_market_listings
            (seller_character_id, listing_type, asset_id, quantity, asking_price, expires_at)
        VALUES (?, 'vehicle', ?, 1, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY))
    ]], { char.id, tostring(vehicleId), price })
    return { ok = true, id = id }
end)

exports.sunset_core:RegisterCallback('sunset:phoneMarketListItem', function(source, item, quantity, price)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    item = tostring(item or '')
    quantity = math.floor(tonumber(quantity) or 0)
    price = math.floor(tonumber(price) or 0)
    if not tradable(item) or quantity < 1 or quantity > 100 or price < 1 or price > 5000000 then
        return nil, { localeKey = 'phone.message.invalid_contact_id' }
    end
    if GetResourceState('sunset_inventory') ~= 'started' then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    if not exports.sunset_inventory:RemoveItem(source, item, quantity) then
        return nil, { localeKey = 'inventory.message.inventory_changed_before_the_item_could_be_dropped' }
    end
    local id = MySQL.insert.await([[
        INSERT INTO phone_market_listings
            (seller_character_id, listing_type, asset_id, quantity, asking_price, expires_at)
        VALUES (?, 'item', ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 DAY))
    ]], { char.id, item, quantity, price })
    if not id then
        exports.sunset_inventory:AddItem(source, item, quantity)
        return nil, { localeKey = 'phone.message.database_error_while_saving_contact' }
    end
    return { ok = true, id = id }
end)

exports.sunset_core:RegisterCallback('sunset:phoneMarketListProperty', function(source, propertyId, price)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    propertyId = tonumber(propertyId)
    price = math.floor(tonumber(price) or 0)
    if not propertyId or price < 1000 or price > 50000000 then
        return nil, { localeKey = 'phone.message.invalid_contact_id' }
    end
    local row = MySQL.single.await('SELECT id FROM properties WHERE id = ? AND owner_character_id = ? AND enabled = 1', { propertyId, char.id })
    local renters = MySQL.scalar.await('SELECT COUNT(*) FROM property_rentals WHERE property_id = ? AND active = 1', { propertyId })
    if tonumber(renters) and tonumber(renters) > 0 then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    if not row then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    local listed = MySQL.scalar.await([[
        SELECT id FROM phone_market_listings
        WHERE listing_type = 'property' AND asset_id = ? AND status = 'active' LIMIT 1
    ]], { tostring(propertyId) })
    if listed then return nil, { localeKey = 'phone.message.database_error_while_saving_contact' } end
    local id = MySQL.insert.await([[
        INSERT INTO phone_market_listings
            (seller_character_id, listing_type, asset_id, quantity, asking_price, expires_at)
        VALUES (?, 'property', ?, 1, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY))
    ]], { char.id, tostring(propertyId), price })
    return { ok = true, id = id }
end)

local function mustOne(query, sql, params)
    local changed = query.await(sql, params)
    return tonumber(changed) == 1
end

local function finishBuy(source, listingId)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    listingId = tonumber(listingId)
    if not listingId then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    if not exports.sunset_core:RateLimit(source, 'phoneMarketBuy', 900) then
        return nil, { localeKey = 'phone.message.database_error_while_saving_contact' }
    end
    local row = MySQL.single.await('SELECT * FROM phone_market_listings WHERE id = ? AND status = ?', { listingId, 'active' })
    if not row then return nil, { localeKey = 'phone.message.contact_not_found_or_already_deleted' } end
    if tonumber(row.seller_character_id) == tonumber(char.id) then
        return nil, { localeKey = 'phone.message.invalid_contact_id' }
    end
    if row.listing_type == 'item' then
        local def = Sunset.Items[row.asset_id]
        local weapon = def and def.weapon and string.upper(def.weapon)
        local melee = weapon and ({
            WEAPON_KNIFE = true, WEAPON_BAT = true, WEAPON_CROWBAR = true, WEAPON_HAMMER = true,
            WEAPON_GOLFCLUB = true, WEAPON_BOTTLE = true, WEAPON_DAGGER = true, WEAPON_HATCHET = true,
            WEAPON_KNUCKLE = true, WEAPON_MACHETE = true, WEAPON_WRENCH = true, WEAPON_POOLCUE = true,
            WEAPON_BATTLEAXE = true, WEAPON_STONE_HATCHET = true, WEAPON_SWITCHBLADE = true,
            WEAPON_FLASHLIGHT = true, WEAPON_NIGHTSTICK = true, WEAPON_FIREEXTINGUISHER = true,
            WEAPON_PETROLCAN = true, WEAPON_UNARMED = true,
        })[weapon]
        if weapon and not melee and GetResourceState('sunset_licenses') == 'started' then
            local allowed = exports.sunset_licenses:HasLicense(source, 'weapon')
            if not allowed then return nil, { localeKey = 'inventory.message.value_cannot_receive_value_without_a_valid_firearm_license' } end
        end
    elseif row.listing_type == 'property' then
        local access = exports.sunset_core:CanAccess(source, 'property.buy')
        if access and access.allowed == false then
            return nil, { localeKey = 'phone.message.invalid_contact_id' }
        end
    end
    local price = math.floor(tonumber(row.asking_price) or 0)
    local fee = math.floor(price * marketFeePercent() / 100)
    local sellerId = tonumber(row.seller_character_id)
    local committed = MySQL.startTransaction(function(query)
        if not mustOne(query, [[
            UPDATE phone_market_listings
            SET status = 'sold', buyer_character_id = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'active' AND seller_character_id <> ?
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ]], { char.id, listingId, char.id }) then return false end
        if not exports.sunset_core:DebitMoneyInTransaction(char.id, 'bank', price, query.await, 'market_buy') then
            return false
        end
        local moved = false
        if row.listing_type == 'vehicle' then
            moved = mustOne(query, [[
                UPDATE vehicles SET character_id = ?, stored = 1,
                    parked_x = NULL, parked_y = NULL, parked_z = NULL, parked_h = NULL
                WHERE id = ? AND character_id = ? AND stored = 1
                  AND (destroyed IS NULL OR destroyed = 0)
                  AND (garage IS NULL OR garage <> 'impound')
            ]], { char.id, tonumber(row.asset_id), sellerId })
        elseif row.listing_type == 'item' then
            local inserted = query.await([[
                INSERT INTO character_inventory (character_id, item, count, slot)
                SELECT ?, ?, ?, COALESCE(m.s, 0) + 1
                FROM (SELECT MAX(slot) AS s FROM character_inventory WHERE character_id = ?) m
            ]], { char.id, row.asset_id, tonumber(row.quantity) or 1, char.id })
            moved = tonumber(inserted) and tonumber(inserted) > 0
        elseif row.listing_type == 'property' then
            local renters = query.await(
                'SELECT COUNT(*) AS total FROM property_rentals WHERE property_id = ? AND active = 1',
                { tonumber(row.asset_id) })
            local rented = renters and renters[1] and tonumber(renters[1].total) or 0
            if rented > 0 then return false end
            moved = mustOne(query, [[
                UPDATE properties SET owner_character_id = ?, for_sale = 0
                WHERE id = ? AND owner_character_id = ? AND enabled = 1
            ]], { char.id, tonumber(row.asset_id), sellerId })
            if moved then
                query.await('UPDATE characters SET home_property_id = NULL WHERE id = ? AND home_property_id = ?',
                    { sellerId, tonumber(row.asset_id) })
            end
        end
        if not moved then return false end
        if not exports.sunset_core:CreditMoneyInTransaction(sellerId, 'bank', price, query.await, 'market_sale') then
            return false
        end
        if fee > 0 and not exports.sunset_core:DebitMoneyInTransaction(sellerId, 'bank', fee, query.await, 'market_fee') then
            return false
        end
        return true
    end)
    if not committed then
        return nil, { localeKey = 'vehicles.message.vehicle_transfer_failed' }
    end
    if row.listing_type == 'vehicle' and GetResourceState('sunset_vehicles') == 'started' then
        pcall(function()
            local plate = MySQL.scalar.await('SELECT plate FROM vehicles WHERE id = ?', { tonumber(row.asset_id) })
            if plate then exports.sunset_vehicles:ClearKeysForPlate(plate) end
            exports.sunset_vehicles:DeleteVehicleEntity(tonumber(row.asset_id))
        end)
    elseif row.listing_type == 'property' then
        TriggerClientEvent('sunset:client:propertiesChanged', -1)
        local homeSrc = sellerOnline(sellerId)
        if homeSrc then
            local sellerChar = exports.sunset_core:GetCharacter(homeSrc)
            if sellerChar and tonumber(sellerChar.home_property_id) == tonumber(row.asset_id) then
                pcall(function() exports.sunset_core:SetHomeProperty(homeSrc, nil) end)
            end
        end
    end
    exports.sunset_core:RefreshMoney(source)
    local sellerSrc = sellerOnline(sellerId)
    if sellerSrc then exports.sunset_core:RefreshMoney(sellerSrc) end
    return { ok = true, fee = fee, price = price, net = price - fee }
end

exports.sunset_core:RegisterCallback('sunset:phoneMarketBuy', function(source, listingId)
    return finishBuy(source, listingId)
end)

exports.sunset_core:RegisterCallback('sunset:phoneMarketCancel', function(source, listingId)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    listingId = tonumber(listingId)
    local row = MySQL.single.await(
        'SELECT * FROM phone_market_listings WHERE id = ? AND seller_character_id = ? AND status = ?',
        { listingId, char.id, 'active' })
    if not row then return nil, { localeKey = 'phone.message.contact_not_found_or_already_deleted' } end
    local committed = MySQL.startTransaction(function(query)
        if not mustOne(query, [[
            UPDATE phone_market_listings
            SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'active' AND seller_character_id = ?
        ]], { listingId, char.id }) then return false end
        if row.listing_type == 'item' then
            local inserted = returnEscrow(query, char.id, row.asset_id, tonumber(row.quantity) or 1)
            if not tonumber(inserted) or tonumber(inserted) < 1 then return false end
        end
        return true
    end)
    if not committed then return nil, { localeKey = 'vehicles.message.vehicle_transfer_failed' } end
    return { ok = true }
end)

local LAYOUT_APPS = {
    phone = true, messages = true, bank = true, garage = true, market = true,
    jobs = true, map = true, faction = true, apps = true,
}

exports.sunset_core:RegisterCallback('sunset:phoneSaveLayout', function(source, grid)
    local char = charOf(source)
    if not char or type(grid) ~= 'table' then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    local clean = {}
    local seen = {}
    for _, id in ipairs(grid) do
        id = tostring(id or '')
        if LAYOUT_APPS[id] and not seen[id] then
            seen[id] = true
            clean[#clean + 1] = id
        end
    end
    local encoded = json.encode({ grid = clean })
    if not encoded or #encoded > 512 then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    MySQL.update.await([[
        INSERT INTO phone_character_prefs (character_id, layout) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE layout = VALUES(layout)
    ]], { char.id, encoded })
    return { ok = true, grid = clean }
end)

exports.sunset_core:RegisterCallback('sunset:phoneSaveSettings', function(source, prefs)
    local char = charOf(source)
    if not char or type(prefs) ~= 'table' then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    local ring = prefs.ringtone == false and 0 or 1
    local sound = prefs.notifySound == false and 0 or 1
    local compact = prefs.compactNotes == true and 1 or 0
    MySQL.update.await([[
        INSERT INTO phone_character_prefs (character_id, ringtone, notify_sound, compact_notes)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE ringtone = VALUES(ringtone), notify_sound = VALUES(notify_sound), compact_notes = VALUES(compact_notes)
    ]], { char.id, ring, sound, compact })
    return { ok = true, ringtone = ring == 1, notifySound = sound == 1, compactNotes = compact == 1 }
end)

local function returnEscrow(query, characterId, item, quantity)
    return query.await([[
        INSERT INTO character_inventory (character_id, item, count, slot)
        SELECT ?, ?, ?, COALESCE(m.s, 0) + 1
        FROM (SELECT MAX(slot) AS s FROM character_inventory WHERE character_id = ?) m
    ]], { characterId, item, quantity, characterId })
end

CreateThread(function()
    while true do
        Wait(60000)
        local rows = MySQL.query.await([[
            SELECT id, seller_character_id, asset_id, quantity, listing_type
            FROM phone_market_listings
            WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
            ORDER BY id ASC
            LIMIT 25
        ]]) or {}
        for _, row in ipairs(rows) do
            MySQL.startTransaction(function(query)
                if not mustOne(query, [[
                    UPDATE phone_market_listings
                    SET status = 'expired', completed_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND status = 'active'
                ]], { row.id }) then return false end
                if row.listing_type == 'item' then
                    local inserted = returnEscrow(query, tonumber(row.seller_character_id), row.asset_id, tonumber(row.quantity) or 1)
                    if not tonumber(inserted) or tonumber(inserted) < 1 then return false end
                end
                return true
            end)
        end
    end
end)

function MarketOptions(characterId)
    characterId = tonumber(characterId)
    local vehicles = MySQL.query.await([[
        SELECT v.id, v.model, v.plate, v.garage
        FROM vehicles v
        WHERE v.character_id = ? AND v.stored = 1
          AND (v.destroyed IS NULL OR v.destroyed = 0)
          AND (v.garage IS NULL OR v.garage <> 'impound')
          AND NOT EXISTS (
            SELECT 1 FROM phone_market_listings l
            WHERE l.listing_type = 'vehicle' AND l.asset_id = CAST(v.id AS CHAR) AND l.status = 'active'
          )
        ORDER BY v.id DESC LIMIT 20
    ]], { characterId }) or {}
    local items = MySQL.query.await([[
        SELECT item, SUM(count) AS count FROM character_inventory
        WHERE character_id = ? GROUP BY item ORDER BY item LIMIT 40
    ]], { characterId }) or {}
    local tradable = {}
    for _, row in ipairs(items) do
        local def = Sunset.Items[row.item]
        if def and not def.weapon and row.item ~= 'id_card' and row.item ~= 'phone' then
            tradable[#tradable + 1] = { item = row.item, label = def.label or row.item, count = tonumber(row.count) or 0 }
        end
    end
    local properties = MySQL.query.await([[
        SELECT p.id, p.label FROM properties p
        WHERE p.owner_character_id = ? AND p.enabled = 1
          AND NOT EXISTS (SELECT 1 FROM property_rentals r WHERE r.property_id = p.id AND r.active = 1)
          AND NOT EXISTS (
            SELECT 1 FROM phone_market_listings l
            WHERE l.listing_type = 'property' AND l.asset_id = CAST(p.id AS CHAR) AND l.status = 'active'
          )
        ORDER BY p.id LIMIT 20
    ]], { characterId }) or {}
    return { vehicles = vehicles, items = tradable, properties = properties }
end
exports('MarketOptions', MarketOptions)

function MarketVehicleListed(vehicleId)
    local id = MySQL.scalar.await([[
        SELECT id FROM phone_market_listings
        WHERE listing_type = 'vehicle' AND asset_id = ? AND status = 'active' LIMIT 1
    ]], { tostring(vehicleId) })
    return id ~= nil
end
exports('MarketVehicleListed', MarketVehicleListed)

function MarketPropertyListed(propertyId)
    local id = MySQL.scalar.await([[
        SELECT id FROM phone_market_listings
        WHERE listing_type = 'property' AND asset_id = ? AND status = 'active' LIMIT 1
    ]], { tostring(propertyId) })
    return id ~= nil
end
exports('MarketPropertyListed', MarketPropertyListed)
