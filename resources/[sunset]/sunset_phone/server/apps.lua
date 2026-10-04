-- Read-only phone aggregations. Purchases, fleet spawns, and cash deposits stay on their existing gameplay checks.

local function decodeEntry(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) ~= 'string' or raw == '' then return nil end
    local ok, decoded = pcall(json.decode, raw)
    if ok and type(decoded) == 'table' then return decoded end
    return nil
end

exports.sunset_core:RegisterCallback('sunset:phoneMarketplace', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    if not exports.sunset_core:RateLimit(source, 'phoneMarketplace', 700) then
        return nil, { localeKey = 'phone.message.invalid_recipient_or_message' }
    end

    local properties = {}
    local propRows = MySQL.query.await([[
        SELECT id, label, price, entry, interior
        FROM properties
        WHERE enabled = 1 AND for_sale = 1 AND owner_character_id IS NULL
        ORDER BY price ASC, id ASC
        LIMIT 40
    ]]) or {}
    for _, row in ipairs(propRows) do
        local entry = decodeEntry(row.entry)
        properties[#properties + 1] = {
            id = tonumber(row.id),
            title = row.label,
            price = tonumber(row.price) or 0,
            kind = 'property',
            interior = row.interior,
            x = entry and tonumber(entry.x) or nil,
            y = entry and tonumber(entry.y) or nil,
        }
    end

    local businesses = {}
    local bizRows = MySQL.query.await([[
        SELECT id, label, price, business_type, coords_x, coords_y
        FROM player_businesses
        WHERE enabled = 1 AND for_sale = 1 AND owner_character_id IS NULL
        ORDER BY price ASC, id ASC
        LIMIT 40
    ]]) or {}
    for _, row in ipairs(bizRows) do
        businesses[#businesses + 1] = {
            id = tonumber(row.id),
            title = row.label,
            price = tonumber(row.price) or 0,
            kind = 'business',
            bizType = row.business_type,
            x = tonumber(row.coords_x),
            y = tonumber(row.coords_y),
        }
    end

    local ads = {}
    local adRows = MySQL.query.await([[
        SELECT id, character_id, player_name, phone_number, text, published_at, status
        FROM cnn_ads
        WHERE status = 'published'
        ORDER BY id DESC
        LIMIT 30
    ]]) or {}
    for _, row in ipairs(adRows) do
        ads[#ads + 1] = {
            id = tonumber(row.id),
            title = row.text,
            seller = row.player_name,
            phone = row.phone_number,
            characterId = tonumber(row.character_id),
            publishedAt = row.published_at,
            kind = 'ad',
        }
    end

    local mine = MySQL.query.await([[
        SELECT id, text, status, submitted_at, published_at
        FROM cnn_ads
        WHERE character_id = ? AND status IN ('pending', 'approved', 'published')
        ORDER BY id DESC
        LIMIT 15
    ]], { tonumber(char.id) }) or {}

    local listings = {}
    local okList, listRows = pcall(function()
        return MySQL.query.await([[
            SELECT l.id, l.listing_type, l.asset_id, l.quantity, l.asking_price, l.seller_character_id,
                   c.firstname, c.lastname, c.phone_number, v.model, v.plate, p.label AS property_label
            FROM phone_market_listings l
            JOIN characters c ON c.id = l.seller_character_id
            LEFT JOIN vehicles v ON l.listing_type = 'vehicle' AND v.id = CAST(l.asset_id AS UNSIGNED)
            LEFT JOIN properties p ON l.listing_type = 'property' AND p.id = CAST(l.asset_id AS UNSIGNED)
            WHERE l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > CURRENT_TIMESTAMP)
            ORDER BY l.id DESC
            LIMIT 40
        ]])
    end)
    if okList and listRows then
        for _, row in ipairs(listRows) do
            local title = row.property_label or row.asset_id
            if row.listing_type == 'vehicle' then title = (row.model or 'vehicle') .. ' ' .. (row.plate or '') end
            listings[#listings + 1] = {
                id = tonumber(row.id),
                listingId = tonumber(row.id),
                category = row.listing_type == 'vehicle' and 'vehicles' or row.listing_type == 'item' and 'items' or 'player_properties',
                title = title,
                price = tonumber(row.asking_price) or 0,
                quantity = tonumber(row.quantity) or 1,
                seller = exports.sunset_core:FormatPublicName(row.firstname, row.lastname),
                phone = row.phone_number,
                characterId = tonumber(row.seller_character_id),
                kind = 'player',
                model = row.model,
            }
        end
    end

    local options = { vehicles = {}, items = {}, properties = {} }
    pcall(function() options = exports.sunset_phone:MarketOptions(char.id) or options end)

    return {
        properties = properties,
        businesses = businesses,
        ads = ads,
        listings = listings,
        options = options,
        mine = mine,
        myListings = (function()
            local ok, rows = pcall(function()
                return MySQL.query.await([[
                    SELECT id, listing_type, asset_id, asking_price, status
                    FROM phone_market_listings
                    WHERE seller_character_id = ?
                    ORDER BY id DESC LIMIT 20
                ]], { tonumber(char.id) })
            end)
            return ok and rows or {}
        end)(),
    }
end)

exports.sunset_core:RegisterCallback('sunset:phoneMarkRead', function(source, peerCharacterId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    peerCharacterId = tonumber(peerCharacterId)
    if not peerCharacterId or peerCharacterId < 0 then return { ok = true } end
    if not exports.sunset_core:RateLimit(source, 'phoneMarkRead', 250) then return { ok = true } end
    MySQL.update.await([[
        UPDATE phone_messages
        SET read_at = CURRENT_TIMESTAMP
        WHERE receiver_character_id = ? AND sender_character_id = ? AND read_at IS NULL
    ]], { tonumber(char.id), peerCharacterId })
    return { ok = true }
end)

exports.sunset_core:RegisterCallback('sunset:phoneEditContact', function(source, contactId, name)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    contactId = tonumber(contactId)
    name = tostring(name or ''):sub(1, 48):gsub('^%s*(.-)%s*$', '%1')
    if not contactId or name == '' then return nil, { localeKey = 'phone.message.invalid_contact_id' } end
    if not exports.sunset_core:RateLimit(source, 'phoneEditContact', 600) then
        return nil, { localeKey = 'phone.message.database_error_while_saving_contact' }
    end
    local affected = MySQL.update.await([[
        UPDATE phone_contacts SET contact_name = ? WHERE id = ? AND character_id = ?
    ]], { name, contactId, tonumber(char.id) })
    if not affected or affected < 1 then
        return nil, { localeKey = 'phone.message.contact_not_found_or_already_deleted' }
    end
    return { ok = true, name = name }
end)
