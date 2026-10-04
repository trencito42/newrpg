-- Canonical owned-asset catalog shared by trade, chat links, CNN, and the marketplace.
-- Callers send a mode. This file owns the ownership queries so those resources do not copy them.
-- A client may send only a type and an id. Labels, plates, prices, and metadata are read here.

local MODES = { TRADE = true, CHAT_LINK = true, MARKET_LISTING = true, CNN_AD = true }
local ASSET_TYPES = { item = true, vehicle = true, property = true, business = true }
local BLOCKED_ITEMS = { id_card = true, phone = true }
local SAFE_META = { durability = true, ammo = true, liters = true, fishKg = true }

local function character(source)
    return exports.sunset_core:GetCharacter(source)
end

local function clip(value, maxLen)
    local text = tostring(value or ''):gsub('[%c]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if #text > maxLen then text = text:sub(1, maxLen) end
    return text
end

local function imageKey(model)
    local key = clip(model, 40):lower()
    if not key:match('^[a-z0-9_]+$') then return nil end
    return key
end

local function publicName(source)
    local ok, name = pcall(function()
        return exports.sunset_core:GetPlayerBaseName(source)
    end)
    if ok and type(name) == 'string' and name ~= '' then return clip(name, 32) end
    return nil
end

local function itemDef(item)
    return Sunset.Items and Sunset.Items[item] or nil
end

local function itemAllowed(item, mode)
    if type(item) ~= 'string' or item == '' then return false end
    local def = itemDef(item)
    if not def then return false end
    if def.admin or def.hidden or def.staff then return false end
    if BLOCKED_ITEMS[item] then return false end
    if item:sub(1, 6) == 'admin_' then return false end
    if mode == 'TRADE' or mode == 'MARKET_LISTING' then
        if def.weapon then return false end
    end
    return true
end

local function safeMeta(raw)
    local meta = raw
    if type(raw) == 'string' and raw ~= '' then
        local ok, decoded = pcall(json.decode, raw)
        meta = ok and decoded or nil
    end
    if type(meta) ~= 'table' then return nil end
    local out = {}
    for key in pairs(SAFE_META) do
        local number = tonumber(meta[key])
        if number and number > -1000000 and number < 1000000 then
            out[key] = math.floor(number * 10) / 10
        end
    end
    if next(out) == nil then return nil end
    return out
end

local function vehicleCondition(props)
    local body = tonumber(props.bodyHealth or props.body)
    if not body then return nil end
    if body > 100 then body = body / 10 end
    if body < 0 then body = 0 end
    if body > 100 then body = 100 end
    return math.floor(body + 0.5)
end

local function decodeProps(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) ~= 'string' or raw == '' then return {} end
    local ok, decoded = pcall(json.decode, raw)
    if ok and type(decoded) == 'table' then return decoded end
    return {}
end

local function displayVehicle(model)
    local name = clip(model, 32)
    local category = nil
    if GetResourceState('sunset_vehicles') == 'started' then
        pcall(function()
            local label = exports.sunset_vehicles:GetVehicleDisplayName(model)
            if type(label) == 'string' and label ~= '' then name = clip(label, 48) end
        end)
        pcall(function()
            local meta = exports.sunset_vehicles:GetVehicleDisplayMetadata(model)
            if type(meta) == 'table' and type(meta.category) == 'string' then
                category = clip(meta.category, 24)
            end
        end)
    end
    return name, category
end

local function activeListing(listingType, assetKey, characterId)
    if GetResourceState('oxmysql') ~= 'started' then return nil end
    local ok, row = pcall(function()
        return MySQL.single.await([[
            SELECT id, asking_price, status
            FROM phone_market_listings
            WHERE listing_type = ? AND asset_id = ? AND seller_character_id = ? AND status = 'active'
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY id DESC
            LIMIT 1
        ]], { listingType, tostring(assetKey), characterId })
    end)
    if not ok or not row then return nil end
    return {
        listingId = tonumber(row.id),
        price = tonumber(row.asking_price) or 0,
        listingStatus = 'active',
    }
end

local function listed(kind, assetId)
    if GetResourceState('sunset_phone') ~= 'started' then return false end
    local listedNow = false
    pcall(function()
        if kind == 'vehicle' then listedNow = exports.sunset_phone:MarketVehicleListed(assetId) == true end
        if kind == 'property' then listedNow = exports.sunset_phone:MarketPropertyListed(assetId) == true end
    end)
    return listedNow
end

local function offered(kind, assetId)
    if type(IsAssetOfferedInTrade) ~= 'function' then return false end
    local ok, busy = pcall(IsAssetOfferedInTrade, kind, assetId)
    return ok and busy == true
end

function SanitizePublicAttachment(raw)
    if type(raw) ~= 'table' then return nil end
    local assetType = raw.type
    if not ASSET_TYPES[assetType] then return nil end
    local out = {
        type = assetType,
        assetId = clip(raw.assetId or raw.id, 64),
        label = clip(raw.label, 80),
        displayName = clip(raw.displayName, 64),
        plate = clip(raw.plate, 12),
        area = clip(raw.area, 80),
        item = imageKey(raw.item) or nil,
        icon = imageKey(raw.icon),
        imageModel = imageKey(raw.imageModel),
        description = clip(raw.description, 180),
        businessType = clip(raw.businessType, 32),
        category = clip(raw.category, 24),
        ownerName = clip(raw.ownerName, 32),
        listingStatus = clip(raw.listingStatus, 16),
        contactPhone = clip(raw.contactPhone, 20):gsub('[^0-9%+%-%(%) ]', ''),
    }
    local quantity = tonumber(raw.quantity)
    if quantity and quantity >= 1 and quantity <= 100000 then out.quantity = math.floor(quantity) end
    local mileage = tonumber(raw.mileage)
    if mileage and mileage >= 0 and mileage < 100000000 then out.mileage = math.floor(mileage) end
    local condition = tonumber(raw.condition)
    if condition and condition >= 0 and condition <= 100 then out.condition = math.floor(condition) end
    local price = tonumber(raw.price)
    if price and price >= 0 and price <= 100000000 then out.price = math.floor(price) end
    local listingId = tonumber(raw.listingId)
    if listingId and listingId > 0 then out.listingId = math.floor(listingId) end
    if type(raw.meta) == 'table' then
        local meta = safeMeta(raw.meta)
        if meta then out.meta = meta end
    end
    if out.contactPhone == '' then out.contactPhone = nil end
    if out.label == '' then out.label = nil end
    if out.displayName == '' then out.displayName = nil end
    if out.plate == '' then out.plate = nil end
    if out.assetId == '' then return nil end
    return out
end
exports('SanitizePublicAttachment', SanitizePublicAttachment)

local function vehicleRowToPublic(row, owner, listing)
    local props = decodeProps(row.props)
    local name, category = displayVehicle(row.model)
    local snap = {
        type = 'vehicle',
        assetId = tostring(row.id),
        displayName = name,
        label = name,
        plate = clip(row.plate, 12),
        imageModel = imageKey(row.model),
        category = category,
        ownerName = owner,
        mileage = tonumber(props.odometer) and math.max(0, math.floor(tonumber(props.odometer))) or nil,
        condition = vehicleCondition(props),
    }
    if listing then
        snap.listingId = listing.listingId
        snap.price = listing.price
        snap.listingStatus = listing.listingStatus
    end
    return SanitizePublicAttachment(snap)
end

local function propertyRowToPublic(row, owner, listing)
    local label = clip(row.label, 80)
    if label == '' then label = ('#%s'):format(row.id) end
    local snap = {
        type = 'property',
        assetId = tostring(row.id),
        label = label,
        displayName = label,
        area = label,
        ownerName = owner,
    }
    if listing then
        snap.listingId = listing.listingId
        snap.price = listing.price
        snap.listingStatus = listing.listingStatus
    end
    return SanitizePublicAttachment(snap)
end

local function businessRowToPublic(row, owner)
    local label = clip(row.label, 80)
    if label == '' then label = ('#%s'):format(row.id) end
    return SanitizePublicAttachment({
        type = 'business',
        assetId = tostring(row.id),
        label = label,
        displayName = label,
        businessType = clip(row.businessType or row.business_type or row.catalogKey, 32),
        ownerName = owner,
    })
end

local function itemRowToPublic(row, owner, listing)
    local def = itemDef(row.item) or {}
    local label = clip(def.label or row.item, 64)
    local snap = {
        type = 'item',
        assetId = tostring(row.id or row.item),
        item = row.item,
        label = label,
        displayName = label,
        icon = def.icon,
        description = clip(def.description, 180),
        quantity = tonumber(row.count or row.quantity) or 1,
        meta = safeMeta(row.metadata),
        ownerName = owner,
    }
    if listing then
        snap.listingId = listing.listingId
        snap.price = listing.price
        snap.listingStatus = listing.listingStatus
    end
    return SanitizePublicAttachment(snap)
end

local function modeOf(mode)
    mode = tostring(mode or 'CHAT_LINK')
    if not MODES[mode] then return nil end
    return mode
end

function GetPlayerAssetCatalog(source, mode)
    mode = modeOf(mode)
    local char = character(source)
    if not mode or not char then return nil, { localeKey = 'inventory.message.character_not_loaded' } end
    local ownerId = tonumber(char.id)
    local transferable = mode == 'TRADE' or mode == 'MARKET_LISTING'
    local includeItems = mode ~= 'TRADE'

    local vehicles = {}
    local vehicleSql = transferable
        and [[SELECT id, plate, model, props FROM vehicles
              WHERE character_id = ? AND stored = 1 AND (destroyed IS NULL OR destroyed = 0)
              ORDER BY model ASC, plate ASC]]
        or [[SELECT id, plate, model, props FROM vehicles
             WHERE character_id = ? AND (destroyed IS NULL OR destroyed = 0)
             ORDER BY model ASC, plate ASC]]
    local vehicleRows = MySQL.query.await(vehicleSql, { ownerId }) or {}
    for _, row in ipairs(vehicleRows) do
        local id = tonumber(row.id)
        if id and not (transferable and (offered('vehicle', id) or listed('vehicle', id))) then
            local listing = (not transferable) and activeListing('vehicle', id, ownerId) or nil
            local snap = vehicleRowToPublic(row, publicName(source), listing)
            vehicles[#vehicles + 1] = {
                assetType = 'vehicle',
                id = id,
                label = snap and (snap.plate and ((snap.displayName or snap.label or '') .. ' · ' .. snap.plate) or (snap.displayName or snap.label)) or clip(row.plate, 12),
                detail = snap and snap.category or nil,
            }
        end
    end

    local properties = {}
    local propertyRows = MySQL.query.await(
        'SELECT id, label FROM properties WHERE owner_character_id = ? AND enabled = 1 ORDER BY label ASC',
        { ownerId }
    ) or {}
    for _, row in ipairs(propertyRows) do
        local id = tonumber(row.id)
        local renters = 0
        if mode == 'MARKET_LISTING' then
            local okRent, rented = pcall(function()
                return MySQL.scalar.await(
                    'SELECT COUNT(*) FROM property_rentals WHERE property_id = ? AND active = 1', { id }
                )
            end)
            renters = okRent and (tonumber(rented) or 0) or 0
        end
        if id and renters == 0 and not (transferable and (offered('property', id) or listed('property', id))) then
            local listing = (not transferable) and activeListing('property', id, ownerId) or nil
            local snap = propertyRowToPublic(row, publicName(source), listing)
            properties[#properties + 1] = {
                assetType = 'property',
                id = id,
                label = snap and snap.label or clip(row.label, 80),
                detail = nil,
            }
        end
    end

    local businesses = {}
    if mode ~= 'MARKET_LISTING' and GetResourceState('sunset_businesses') == 'started' then
        local ok, rows = pcall(function() return exports.sunset_businesses:GetOwnedBusinesses(source) end)
        if ok and type(rows) == 'table' then
            for _, row in ipairs(rows) do
                local id = tonumber(row.id)
                if id and not (mode == 'TRADE' and offered('business', id)) then
                    local snap = businessRowToPublic(row, publicName(source))
                    businesses[#businesses + 1] = {
                        assetType = 'business',
                        id = id,
                        label = snap and snap.label or clip(row.label, 80),
                        detail = snap and snap.businessType or nil,
                    }
                end
            end
        end
    end

    local items = {}
    if includeItems then
        local itemRows = MySQL.query.await(
            'SELECT id, item, count, metadata FROM character_inventory WHERE character_id = ? ORDER BY slot ASC, id ASC',
            { ownerId }
        ) or {}
        for _, row in ipairs(itemRows) do
            if itemAllowed(row.item, mode) then
                local listing = activeListing('item', row.item, ownerId)
                local snap = itemRowToPublic(row, publicName(source), listing)
                items[#items + 1] = {
                    assetType = 'item',
                    id = tonumber(row.id),
                    item = row.item,
                    label = snap and snap.label or row.item,
                    count = tonumber(row.count) or 1,
                }
            end
        end
    end

    return {
        mode = mode,
        items = items,
        vehicles = vehicles,
        properties = properties,
        businesses = businesses,
    }
end
exports('GetPlayerAssetCatalog', GetPlayerAssetCatalog)

local function resolveOwned(source, assetType, assetId, mode)
    mode = modeOf(mode)
    local char = character(source)
    if not mode or not char or not ASSET_TYPES[assetType] then
        return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
    end
    local ownerId = tonumber(char.id)
    local owner = publicName(source)
    local transferable = mode == 'TRADE' or mode == 'MARKET_LISTING'

    if assetType == 'item' then
        local rowId = tonumber(assetId)
        if not rowId then return nil, { localeKey = 'inventory.message.invalid_trade_asset' } end
        local row = MySQL.single.await(
            'SELECT id, item, count, metadata FROM character_inventory WHERE id = ? AND character_id = ?',
            { rowId, ownerId }
        )
        if not row or not itemAllowed(row.item, mode) then
            return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
        end
        return itemRowToPublic(row, owner, activeListing('item', row.item, ownerId))
    end

    local id = tonumber(assetId)
    if not id then return nil, { localeKey = 'inventory.message.invalid_trade_asset' } end

    if assetType == 'vehicle' then
        local row = MySQL.single.await(
            'SELECT id, plate, model, props, stored, destroyed FROM vehicles WHERE id = ? AND character_id = ?',
            { id, ownerId }
        )
        if not row or tonumber(row.destroyed) == 1 then
            return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
        end
        if transferable and (tonumber(row.stored) ~= 1 or offered('vehicle', id) or listed('vehicle', id)) then
            return nil, { localeKey = 'inventory.message.only_garage_stored_vehicles_can_be_traded' }
        end
        local listing = (not transferable) and activeListing('vehicle', id, ownerId) or nil
        return vehicleRowToPublic(row, owner, listing)
    end

    if assetType == 'property' then
        local row = MySQL.single.await(
            'SELECT id, label FROM properties WHERE id = ? AND owner_character_id = ? AND enabled = 1',
            { id, ownerId }
        )
        if not row or (transferable and (offered('property', id) or listed('property', id))) then
            return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
        end
        if mode == 'MARKET_LISTING' then
            local renters = tonumber(MySQL.scalar.await(
                'SELECT COUNT(*) FROM property_rentals WHERE property_id = ? AND active = 1', { id }
            )) or 0
            if renters > 0 then return nil, { localeKey = 'inventory.message.invalid_trade_asset' } end
        end
        local listing = (not transferable) and activeListing('property', id, ownerId) or nil
        return propertyRowToPublic(row, owner, listing)
    end

    if GetResourceState('sunset_businesses') ~= 'started' or mode == 'MARKET_LISTING' then
        return nil, { localeKey = 'inventory.message.business_trading_is_unavailable' }
    end
    local ok, row = pcall(function() return exports.sunset_businesses:GetBusinessRow(id) end)
    if not ok or not row or tonumber(row.ownerCharacterId) ~= ownerId then
        return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
    end
    if mode == 'TRADE' and offered('business', id) then
        return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
    end
    return businessRowToPublic(row, owner)
end

function ResolvePublicAsset(source, assetType, assetId, mode)
    local clientType = tostring(assetType or '')
    return resolveOwned(source, clientType, assetId, mode or 'CHAT_LINK')
end
exports('ResolvePublicAsset', ResolvePublicAsset)

function ResolveChatAttachment(source, raw)
    if type(raw) ~= 'table' or type(raw[1]) == 'table' then
        return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
    end
    -- Client-supplied names, plates, prices, and metadata are ignored on purpose.
    local assetType = raw.type or raw.assetType
    local assetId = raw.id or raw.assetId
    return ResolvePublicAsset(source, assetType, assetId, 'CHAT_LINK')
end
exports('ResolveChatAttachment', ResolveChatAttachment)

function ResolveMarketListing(source, listingId)
    local char = character(source)
    listingId = tonumber(listingId)
    if not char or not listingId then return nil, { localeKey = 'inventory.message.invalid_trade_asset' } end
    local row = MySQL.single.await([[
        SELECT id, listing_type, asset_id, quantity, asking_price, status, seller_character_id
        FROM phone_market_listings
        WHERE id = ? AND seller_character_id = ? AND status = 'active'
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ]], { listingId, tonumber(char.id) })
    if not row then return nil, { localeKey = 'cnn.message.promote_not_your_listing' } end
    local owner = publicName(source)
    local listing = {
        listingId = tonumber(row.id),
        price = tonumber(row.asking_price) or 0,
        listingStatus = 'active',
    }
    local snap
    if row.listing_type == 'vehicle' then
        local vehicle = MySQL.single.await(
            'SELECT id, plate, model, props FROM vehicles WHERE id = ? AND character_id = ?',
            { tonumber(row.asset_id), tonumber(char.id) }
        )
        if not vehicle then return nil, { localeKey = 'inventory.message.invalid_trade_asset' } end
        snap = vehicleRowToPublic(vehicle, owner, listing)
    elseif row.listing_type == 'property' then
        local property = MySQL.single.await(
            'SELECT id, label FROM properties WHERE id = ? AND owner_character_id = ?',
            { tonumber(row.asset_id), tonumber(char.id) }
        )
        if not property then return nil, { localeKey = 'inventory.message.invalid_trade_asset' } end
        snap = propertyRowToPublic(property, owner, listing)
    elseif row.listing_type == 'item' then
        if not itemAllowed(row.asset_id, 'MARKET_LISTING') then
            return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
        end
        snap = itemRowToPublic({
            item = row.asset_id,
            count = tonumber(row.quantity) or 1,
            id = row.asset_id,
        }, owner, listing)
    else
        return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
    end
    return snap
end
exports('ResolveMarketListing', ResolveMarketListing)

exports.sunset_core:RegisterCallback('sunset:assetCatalog', function(source, data)
    local mode = type(data) == 'table' and data.mode or 'CHAT_LINK'
    if mode == 'TRADE' then return nil, { localeKey = 'inventory.message.no_active_trade' } end
    if not exports.sunset_core:RateLimit(source, 'assetCatalog', 400) then
        return nil, { localeKey = 'chat.rate_limited' }
    end
    return GetPlayerAssetCatalog(source, mode)
end)

exports.sunset_core:RegisterCallback('sunset:assetListingState', function(source, data)
    if not exports.sunset_core:RateLimit(source, 'assetListingState', 300) then
        return { status = 'unknown' }
    end
    local listingId = tonumber(type(data) == 'table' and data.listingId)
    if not listingId then return { listingId = nil, status = 'none' } end
    local ok, row = pcall(function()
        return MySQL.single.await([[
            SELECT status, (expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP) AS expired
            FROM phone_market_listings WHERE id = ?
        ]], { listingId })
    end)
    if not ok or not row then return { listingId = listingId, status = 'missing' } end
    local status = tostring(row.status or 'missing')
    if status == 'active' and (row.expired == 1 or row.expired == true) then status = 'expired' end
    if status ~= 'active' and status ~= 'sold' and status ~= 'expired' and status ~= 'cancelled' then
        status = 'missing'
    end
    return { listingId = listingId, status = status }
end)
