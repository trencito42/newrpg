local Inside = {}

local function dbBool(value)
    return value == true or value == 1 or value == '1'
end

local function decodePos(raw)
    if type(raw) == 'table' then return raw end
    if not raw then return nil end
    local ok, value = pcall(json.decode, raw)
    return ok and value or nil
end

local function encodePos(pos, heading)
    return json.encode({ x = pos.x + 0.0, y = pos.y + 0.0, z = pos.z + 0.0, w = (heading or pos.w or 0.0) + 0.0 })
end

local function property(id)
    id = tonumber(id)
    if not id then return nil end
    return MySQL.single.await([[SELECT p.*,
      TRIM(CONCAT(COALESCE(c.firstname, ''), ' ', COALESCE(c.lastname, ''))) owner_name,
      (SELECT COUNT(*) FROM property_rentals r WHERE r.property_id=p.id AND r.active=1) renter_count
      FROM properties p LEFT JOIN characters c ON c.id=p.owner_character_id WHERE p.id=?]], { id })
end

local function activeRental(characterId, propertyId)
    local sql = 'SELECT * FROM property_rentals WHERE character_id=? AND active=1'
    local params = { characterId }
    if propertyId then sql = sql .. ' AND property_id=?'; params[2] = propertyId end
    return MySQL.single.await(sql .. ' LIMIT 1', params)
end

local function accessible(char, prop)
    return tonumber(prop.owner_character_id) == tonumber(char.id) or activeRental(char.id, prop.id) ~= nil
end

local function nearby(source, prop, distance)
    local entry, ped = decodePos(prop and prop.entry), GetPlayerPed(source)
    if not entry or not ped or ped == 0 then return false end
    local pos = GetEntityCoords(ped)
    local x, y, z = pos.x-entry.x, pos.y-entry.y, pos.z-entry.z
    return x*x+y*y+z*z <= (distance or 5.0)^2
end

local function message(source, text, kind)
    if not source or source <= 0 then return end
    kind = kind or 'info'
    TriggerClientEvent('sunset:client:propertyMessage', source, text, kind)
    if kind == 'error' or kind == 'warning' or kind == 'success' then
        exports.sunset_core:CommandReply(source, text, kind)
    end
end

local function t(source, key, params)
    return exports.sunset_core:TFor(source, key, params)
end

local PropertyChatHandlers = {}
local function registerPropertyCommand(name, handler)
    name = string.lower(name)
    PropertyChatHandlers[name] = handler
    RegisterCommand(name, handler, false)
end

-- [AUDIT SQL-1] publicRow now accepts an optional pre-fetched rentedIds set so
-- callers that process many rows (getProperties, getPropertiesPage) can batch
-- the rental lookup in a single query instead of one query per row (N+1).
local function publicRow(row, char, rentedIds)
    local owned = tonumber(row.owner_character_id) == tonumber(char.id)
    local rented
    if rentedIds then
        rented = rentedIds[tonumber(row.id)] == true
    else
        -- Fallback: single-row context (e.g. inline property() calls) — one query is fine.
        rented = activeRental(char.id, row.id) ~= nil
    end
    return {
        id=row.id, label=row.label, description=row.description, price=tonumber(row.price) or 0, entry=decodePos(row.entry),
        owner_character_id=row.owner_character_id,
        ownerName=(row.owner_name and row.owner_name ~= '' and not tostring(row.owner_name):find('license:') and row.owner_name)
            or (row.owner_character_id and ('Resident #' .. row.owner_character_id) or nil),
        interior=row.interior, minimumLevel=tonumber(row.minimum_level) or 1,
        locked=dbBool(row.locked), forSale=dbBool(row.for_sale),
        rentEnabled=dbBool(row.rent_enabled), rentPrice=tonumber(row.rent_price) or 0,
        renterCount=tonumber(row.renter_count) or 0, maxRenters=tonumber(row.max_renters) or 1,
        owned=owned, rented=rented, access=owned or rented,
    }
end

-- Fetch this character's active rental property IDs in one query.
local function fetchRentedIds(charId)
    local rentalRows = MySQL.query.await(
        'SELECT property_id FROM property_rentals WHERE character_id=? AND active=1',
        { charId }
    ) or {}
    local set = {}
    for _, r in ipairs(rentalRows) do set[tonumber(r.property_id)] = true end
    return set
end

-- ═══ SERVER-SIDE PROPERTY CACHE & VERSIONING ═══
local ServerPropertyCache = nil
local PropertyGeneration = 1
local PropertyCacheDirty = true

local function loadServerPropertyCache()
    if not PropertyCacheDirty and ServerPropertyCache then
        return ServerPropertyCache
    end
    local rows = MySQL.query.await([[SELECT p.*,
      TRIM(CONCAT(COALESCE(c.firstname, ''), ' ', COALESCE(c.lastname, ''))) owner_name,
      (SELECT COUNT(*) FROM property_rentals r WHERE r.property_id=p.id AND r.active=1) renter_count
      FROM properties p LEFT JOIN characters c ON c.id=p.owner_character_id
      WHERE p.enabled=1 ORDER BY p.price,p.id]]) or {}
    ServerPropertyCache = rows
    PropertyCacheDirty = false
    return ServerPropertyCache
end

local function notifyPropertiesChanged(propId, delta)
    PropertyCacheDirty = true
    PropertyGeneration = PropertyGeneration + 1
    if propId and type(delta) == 'table' then
        TriggerClientEvent('sunset:client:propertyDelta', -1, PropertyGeneration, propId, delta)
    else
        TriggerClientEvent('sunset:client:propertiesVersion', -1, PropertyGeneration)
    end
end

exports.sunset_core:RegisterCallback('sunset:getProperties', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return {} end
    local raw = loadServerPropertyCache()
    local rentedIds = fetchRentedIds(char.id)
    local rows = {}
    for i, row in ipairs(raw) do
        rows[i] = publicRow(row, char, rentedIds)
    end
    return rows
end)

-- [AUDIT PAGINATION] Server-side filtered/sorted page for the /properties NUI.
-- Input:  page (1-based), pageSize, search (string), filter ('all'|'owned'|'rented'|'forsale'), sort ('price'|'id'|'name')
-- Output: { rows, total, page, totalPages }
exports.sunset_core:RegisterCallback('sunset:getPropertiesPage', function(source, opts)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return { rows={}, total=0, page=1, totalPages=0 } end
    opts = type(opts) == 'table' and opts or {}
    local page     = math.max(1, tonumber(opts.page) or 1)
    local pageSize = math.max(1, math.min(50, tonumber(opts.pageSize) or 20))
    local search   = type(opts.search) == 'string' and opts.search:match('^%s*(.-)%s*$') or ''
    local filter   = tostring(opts.filter or 'all')
    local sort     = tostring(opts.sort or 'price')

    -- Build WHERE clause fragments
    local conditions = { 'p.enabled=1' }
    local params = {}

    if search ~= '' then
        conditions[#conditions+1] = '(p.label LIKE ? OR p.description LIKE ?)'
        local like = '%' .. search .. '%'
        params[#params+1] = like
        params[#params+1] = like
    end

    if filter == 'owned' then
        conditions[#conditions+1] = 'p.owner_character_id=?'
        params[#params+1] = char.id
    elseif filter == 'rented' then
        conditions[#conditions+1] = 'EXISTS(SELECT 1 FROM property_rentals r WHERE r.property_id=p.id AND r.character_id=? AND r.active=1)'
        params[#params+1] = char.id
    elseif filter == 'forsale' then
        conditions[#conditions+1] = 'p.for_sale=1 AND p.owner_character_id IS NULL'
    end

    local whereClause = 'WHERE ' .. table.concat(conditions, ' AND ')

    local orderMap = { price='p.price,p.id', id='p.id', name='p.label' }
    local orderBy = orderMap[sort] or 'p.price,p.id'

    local countParams = {}; for _, v in ipairs(params) do countParams[#countParams+1] = v end
    local total = tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM properties p ' .. whereClause,
        countParams
    )) or 0

    local offset = (page - 1) * pageSize
    local pageParams = {}; for _, v in ipairs(params) do pageParams[#pageParams+1] = v end
    pageParams[#pageParams+1] = pageSize
    pageParams[#pageParams+1] = offset

    local rows = MySQL.query.await(([[
        SELECT p.*,
          TRIM(CONCAT(COALESCE(c.firstname,''),' ',COALESCE(c.lastname,''))) owner_name,
          (SELECT COUNT(*) FROM property_rentals r WHERE r.property_id=p.id AND r.active=1) renter_count
        FROM properties p
        LEFT JOIN characters c ON c.id=p.owner_character_id
        %s ORDER BY %s LIMIT ? OFFSET ?
    ]]):format(whereClause, orderBy), pageParams) or {}

    local rentedIds = fetchRentedIds(char.id)
    for i, row in ipairs(rows) do rows[i] = publicRow(row, char, rentedIds) end

    local totalPages = math.max(1, math.ceil(total / pageSize))
    return { rows=rows, total=total, page=page, totalPages=totalPages }
end)

exports.sunset_core:RegisterCallback('sunset:getSpawnHomes', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return {} end
    return MySQL.query.await([[SELECT p.id,p.label,
      CASE WHEN p.owner_character_id=? THEN 'owner' ELSE 'renter' END access_type
      FROM properties p LEFT JOIN property_rentals r
        ON r.property_id=p.id AND r.character_id=? AND r.active=1
      WHERE p.enabled=1 AND (p.owner_character_id=? OR r.id IS NOT NULL)
      ORDER BY access_type,p.id]], {char.id,char.id,char.id}) or {}
end)

local function spawnCoords(pos)
    if not pos then return nil end
    local x, y, z = tonumber(pos.x), tonumber(pos.y), tonumber(pos.z)
    if not x or not y or not z then return nil end
    return { x = x, y = y, z = z, w = tonumber(pos.w) or 0.0 }
end

local function resolveSpawnChoiceForChar(source, char, choice, propertyId)
    if not char then return nil, t(source, 'property.character_unavailable') end
    choice = tostring(choice or '')
    if source and source > 0 then
        local jailed = false
        pcall(function() jailed = exports.sunset_factions:IsJailed(source) == true end)
        if jailed and Sunset.Police and Sunset.Police.jailCoords then
            local jail = spawnCoords(Sunset.Police.jailCoords)
            if jail then return jail end
        end
    end

    local pos
    if choice == 'default' then
        pos = Sunset.Config.DefaultSpawn
    elseif choice == 'last' then
        pos = decodePos(char.position)
    elseif choice == 'house' then
        local prop = property(propertyId)
        if not prop or not dbBool(prop.enabled) then return nil, t(source, 'property.unavailable') end
        if not accessible(char, prop) then return nil, t(source, 'property.access_lost') end
        pos = decodePos(prop.entry)
        if SunsetBoot and SunsetBoot.IsDebug() then
            print(('^5[BOOTV src=%s] properties:resolve_house id=%s entry=%.2f,%.2f,%.2f^7'):format(
                tostring(source), tostring(propertyId), pos and pos.x or 0, pos and pos.y or 0, pos and pos.z or 0))
        end
    elseif choice == 'hq' then
        if source and source > 0 then
            local ok, hq = pcall(function()
                return exports.sunset_factions:GetFactionHqSpawn(source)
            end)
            if ok and type(hq) == 'table' then pos = hq end
        end
        if not pos then
            local metadata = type(char.metadata) == 'table' and char.metadata or {}
            local factionId = metadata.faction
            local faction = factionId and Sunset.Factions and Sunset.Factions[factionId]
            local hq = faction and faction.hq
            if hq then
                local heading = 0.0
                if faction.depot and faction.depot.spawn then
                    heading = faction.depot.spawn.w or 0.0
                end
                pos = { x = hq.x, y = hq.y, z = hq.z, w = heading }
            end
        end
        if not pos then return nil, t(source, 'property.hq_members_only') end
    else
        return nil, t(source, 'property.spawn_invalid')
    end

    local resolved = spawnCoords(pos)
    if not resolved then return nil, t(source, 'property.spawn_coords_invalid') end
    return resolved
end

exports('ResolveSpawnChoice', resolveSpawnChoiceForChar)

exports.sunset_core:RegisterCallback('sunset:resolveSpawnChoice', function(source, choice, propertyId)
    local char = exports.sunset_core:GetCharacter(source)
    local resolved, err = resolveSpawnChoiceForChar(source, char, choice, propertyId)
    if not resolved then return nil, err end
    exports.sunset_core:SetSpawnPreference(source, choice, propertyId)
    return resolved
end)

-- [AUTO SPAWN] Login spawn without the picker. Priority (owner spec):
--   1. saved preference (if valid — house > hq > default within it)
--   2. home property (owned/rented)
--   3. faction HQ
--   4. default spawn
function ResolveAutoSpawn(source)
    local tStart = GetGameTimer()
    local char = exports.sunset_core:GetCharacter(source)
    local defaultPos = Sunset.Config.DefaultSpawn or { x = -1037.6, y = -2737.8, z = 13.8, w = 330.0 }
    local defaultResult = { x = defaultPos.x, y = defaultPos.y, z = defaultPos.z, w = defaultPos.w or 0.0, source = 'default' }

    if not char then
        return defaultResult
    end

    local ok, res = pcall(function()
        -- jail lock wins over everything (resolveSpawnChoiceForChar handles it too)
        local jailed = false
        pcall(function() jailed = exports.sunset_factions:IsJailed(source) == true end)
        if jailed and Sunset.Police and Sunset.Police.jailCoords then
            local jail = spawnCoords(Sunset.Police.jailCoords)
            if jail then jail.source = 'jail'; return jail end
        end

        local metadata = type(char.metadata) == 'table' and char.metadata or {}

        -- 1. explicit saved preference
        if metadata.spawn_choice and metadata.spawn_choice ~= 'last' then
            local okChoice, resolved = pcall(resolveSpawnChoiceForChar, source, char, metadata.spawn_choice, metadata.spawn_property_id)
            if okChoice and resolved and resolved.x then
                resolved.source = 'saved_' .. metadata.spawn_choice
                return resolved
            end
        end

        -- 2. home property (owned or rented)
        if char.home_property_id then
            local okHome, resolved = pcall(resolveSpawnChoiceForChar, source, char, 'house', char.home_property_id)
            if okHome and resolved and resolved.x then
                resolved.source = 'house'
                return resolved
            end
        end

        -- 3. faction HQ
        local okHq, hq = pcall(resolveSpawnChoiceForChar, source, char, 'hq')
        if okHq and hq and hq.x then
            hq.source = 'hq'
            return hq
        end

        return defaultResult
    end)

    local finalSpawn = (ok and res and res.x) and res or defaultResult
    return finalSpawn
end
exports('ResolveAutoSpawn', ResolveAutoSpawn)

exports.sunset_core:RegisterCallback('sunset:resolveAutoSpawn', function(source)
    return ResolveAutoSpawn(source)
end)

local function charge(source, amount, reason)
    local account
    if exports.sunset_core:GetMoney(source,'bank')>=amount then account='bank'
    elseif exports.sunset_core:GetMoney(source,'cash')>=amount then account='cash' end
    if not account then return nil end
    if not exports.sunset_core:RemoveMoney(source,account,amount,reason) then return nil end
    return account
end

local function creditOwner(characterId, amount)
    -- core-owned atomic credit (online cache refresh or offline UPDATE + ledger)
    return exports.sunset_core:AddMoneyToCharacter(characterId, 'bank', amount, 'house_rent_income')
end

local function clearHome(characterId, propertyId, reason)
    MySQL.update.await('UPDATE characters SET home_property_id=NULL WHERE id=? AND home_property_id=?', { characterId, propertyId })
    for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        local online = exports.sunset_core:GetCharacter(src)
        if online and tonumber(online.id) == tonumber(characterId) and tonumber(online.home_property_id) == tonumber(propertyId) then
            exports.sunset_core:SetHomeProperty(src, nil)
            if reason then message(src, reason, 'error') end
            break
        end
    end
end

exports.sunset_core:RegisterCallback('sunset:buyProperty', function(source,id)
    local char=exports.sunset_core:GetCharacter(source)
    local prop=property(id)
    if not char then return nil,t(source, 'property.character_unavailable') end
    if not prop or not dbBool(prop.enabled) then return nil,t(source, 'property.not_found') end
    if not nearby(source,prop) then return nil,t(source, 'property.buy.nearby') end
    if not dbBool(prop.for_sale) then return nil,t(source, 'property.buy.not_for_sale') end
    if prop.owner_character_id then return nil,t(source, 'property.buy.owned') end

    if exports.sunset_core and exports.sunset_core.CanAccess then
        local access = exports.sunset_core:CanAccess(source, 'property.buy')
        if access and access.allowed == false then
            return nil, access.reason or t(source, 'property.buy.level', { required = 8, current = tonumber(char.level) or 1 })
        end
    end

    local currentLevel, requiredLevel = tonumber(char.level) or 1, tonumber(prop.minimum_level) or 1
    if currentLevel < requiredLevel then
        return nil,t(source, 'property.buy.level', { required = requiredLevel, current = currentLevel })
    end
    local maxOwned = tonumber(SunsetProperties.MaxOwnedPerCharacter) or 0
    if maxOwned > 0 then
        local ownedCount = tonumber(MySQL.scalar.await(
            'SELECT COUNT(*) FROM properties WHERE owner_character_id=?',
            { char.id }
        )) or 0
        if ownedCount >= maxOwned then
            return nil, t(source, 'property.buy.limit', { limit = maxOwned })
        end
    end
    local price=tonumber(prop.price) or 0
    local bank, cash = exports.sunset_core:GetMoney(source,'bank'), exports.sunset_core:GetMoney(source,'cash')
    if bank<price and cash<price then return nil,t(source, 'property.buy.money', { price = price, bank = bank, cash = cash }) end
    local paidFrom = bank >= price and 'bank' or 'cash'
    local defaultRent = math.floor(tonumber(SunsetProperties.DefaultRentPrice) or 500)
    local callOk, committed = pcall(function()
        return MySQL.startTransaction(function(query)
            local ownedNow = tonumber(query.await(
                'SELECT COUNT(*) AS total FROM properties WHERE owner_character_id = ?', { char.id })[1].total) or 0
            if maxOwned > 0 and ownedNow >= maxOwned then return false end
            local claimed = query.await([[UPDATE properties
                SET owner_character_id=?, locked=1, rent_enabled=1, rent_price=?
                WHERE id=? AND enabled=1 AND for_sale=1 AND owner_character_id IS NULL]],
                { char.id, defaultRent, prop.id })
            if tonumber(claimed) ~= 1 then return false end
            local charged = exports.sunset_core:DebitMoneyInTransaction(char.id, paidFrom, price, query.await, 'property_purchase')
            if not charged then return false end
            query.await('UPDATE property_rentals SET active=0 WHERE character_id=?', { char.id })
            local homeSaved = query.await('UPDATE characters SET home_property_id=? WHERE id=?', { prop.id, char.id })
            return tonumber(homeSaved) == 1
        end)
    end)
    if not callOk or not committed then
        return nil,t(source, 'property.buy.changed')
    end
    exports.sunset_core:RefreshMoney(source)
    exports.sunset_core:SetHomeProperty(source, prop.id)
    notifyPropertiesChanged()
    return true,t(source, 'property.buy.success', { property = prop.label, price = price, rent = defaultRent })
end)

exports.sunset_core:RegisterCallback('sunset:rentProperty', function(source,id)
    local char=exports.sunset_core:GetCharacter(source)
    local prop=property(id)
    if not char then return nil,t(source, 'property.character_unavailable') end
    if not prop or not prop.owner_character_id then return nil,t(source, 'property.rent.no_owner') end
    if not nearby(source,prop) then return nil,t(source, 'property.rent.nearby') end
    if tonumber(prop.owner_character_id)==tonumber(char.id) then return nil,t(source, 'property.rent.own') end

    if exports.sunset_core and exports.sunset_core.CanAccess then
        local access = exports.sunset_core:CanAccess(source, 'property.rent')
        if access and access.allowed == false then
            return nil, access.reason or t(source, 'property.buy.level', { required = 3, current = tonumber(char.level) or 1 })
        end
    end
    if not dbBool(prop.rent_enabled) then return nil,t(source, 'property.rent.disabled') end
    if tonumber(prop.renter_count)>=tonumber(prop.max_renters) then return nil,t(source, 'property.rent.full') end
    if activeRental(char.id,prop.id) then return nil,t(source, 'property.rent.already') end
    local price=tonumber(prop.rent_price) or 0
    local bank, cash = exports.sunset_core:GetMoney(source,'bank'), exports.sunset_core:GetMoney(source,'cash')
    if bank<price and cash<price then return nil,t(source, 'property.rent.money', { price = price }) end
    local paidFrom = bank >= price and 'bank' or 'cash'
    local ownerId = tonumber(prop.owner_character_id)
    local callOk, committed = pcall(function()
        return MySQL.startTransaction(function(query)
            local locked = query.await([[SELECT owner_character_id, rent_enabled, max_renters, rent_price,
                (SELECT COUNT(*) FROM property_rentals r WHERE r.property_id=properties.id AND r.active=1) AS renter_count
                FROM properties WHERE id=? AND enabled=1 FOR UPDATE]], { prop.id })
            local current = locked and locked[1]
            if not current or tonumber(current.owner_character_id) ~= ownerId
                or not dbBool(current.rent_enabled)
                or (tonumber(current.rent_price) or 0) ~= price -- [SEC3] owner changed the price after the client saw it
                or tonumber(current.renter_count or 0) >= tonumber(current.max_renters or 0) then return false end
            local charged = exports.sunset_core:DebitMoneyInTransaction(char.id, paidFrom, price, query.await, 'property_rent')
            if not charged then return false end
            query.await('UPDATE property_rentals SET active=0 WHERE character_id=?', { char.id })
            query.await([[INSERT INTO property_rentals(property_id,character_id,rent_price,active,last_paid_at)
                VALUES(?,?,?,1,NOW()) ON DUPLICATE KEY UPDATE property_id=VALUES(property_id),rent_price=VALUES(rent_price),
                active=1,started_at=NOW(),last_paid_at=NOW()]], { prop.id,char.id,price })
            local homeSaved = query.await('UPDATE characters SET home_property_id=? WHERE id=?', { prop.id, char.id })
            if tonumber(homeSaved) ~= 1 then return false end
            return exports.sunset_core:CreditMoneyInTransaction(ownerId, 'bank', price, query.await, 'house_rent_income') == true
        end)
    end)
    if not callOk or not committed then
        return nil,t(source, 'property.rent.changed')
    end
    exports.sunset_core:RefreshMoney(source)
    exports.sunset_core:SetHomeProperty(source, prop.id)
    for _, playerId in ipairs(GetPlayers()) do
        local ownerSource = tonumber(playerId)
        local online = exports.sunset_core:GetCharacter(ownerSource)
        if online and tonumber(online.id) == ownerId then exports.sunset_core:RefreshMoney(ownerSource) break end
    end
    notifyPropertiesChanged()
    -- [QUESTS] housing chain: first rental.
    TriggerEvent('sunset:quest:progress', char.id, 'property_rented', 1, { propertyId = prop.id })
    return true,t(source, 'property.rent.success', { property = prop.label, price = price })
end)

exports.sunset_core:RegisterCallback('sunset:leaveRental', function(source)
    local char=exports.sunset_core:GetCharacter(source)
    if not char then return nil,t(source, 'property.character_unavailable') end
    local rent=activeRental(char.id)
    if not rent then return nil,t(source, 'property.rent.none') end
    MySQL.update.await('UPDATE property_rentals SET active=0 WHERE id=?',{rent.id})
    if tonumber(char.home_property_id)==tonumber(rent.property_id) then exports.sunset_core:SetHomeProperty(source,nil) end
    notifyPropertiesChanged()
    return true,t(source, 'property.rent.ended')
end)

exports.sunset_core:RegisterCallback('sunset:setHome', function(source,id)
    local char=exports.sunset_core:GetCharacter(source)
    local prop=property(id)
    if not char or not prop or not accessible(char,prop) then return nil,t(source, 'property.home.requires_access') end
    if not exports.sunset_core:SetHomeProperty(source,prop.id) then return nil,t(source, 'property.home.save_failed') end
    return true,t(source, 'property.home.saved', { property = prop.label })
end)

local function enter(source,id)
    local char=exports.sunset_core:GetCharacter(source)
    local prop=property(id)
    if not char then return nil,t(source, 'property.character_unavailable') end
    if not prop or not dbBool(prop.enabled) then return nil,t(source, 'property.enter.disabled') end
    if not nearby(source,prop) then return nil,t(source, 'property.enter.nearby') end
    -- [AUDIT P6-10] A cuffed/escorted/downed suspect must not escape into a house
    -- routing bucket; nothing releases the escort attach on property enter.
    if GetResourceState('sunset_factions')=='started' then
        local ok,cuffed=pcall(function() return exports.sunset_factions:IsCuffed(source) end)
        if ok and cuffed then return nil,t(source, 'property.enter.cuffed') end
        local ok2,det=pcall(function() return exports.sunset_factions:GetDetentionState(source) end)
        if ok2 and tostring(det or ''):upper()=='ESCORTED' then return nil,t(source, 'property.enter.escorted') end
    end
    if GetResourceState('sunset_death')=='started' then
        local ok3,downed=pcall(function() return exports.sunset_death:IsPlayerDowned(source) end)
        if ok3 and downed then return nil,t(source, 'property.enter.downed') end
    end
    if dbBool(prop.locked) and not accessible(char,prop) then return nil,t(source, 'property.enter.locked') end
    local preset=SunsetProperties.Interiors[prop.interior]
    local interior=preset and preset.coords or decodePos(prop.interior_pos)
    if not interior then return nil,t(source, 'property.enter.no_interior') end
    Inside[source]=prop.id
    SetPlayerRoutingBucket(source,SunsetProperties.BucketBase+prop.id)
    local entry=decodePos(prop.entry)
    Player(source).state:set('sunsetPropertyExit',entry,false)
    TriggerClientEvent('sunset:client:propertyInterior',source,{id=prop.id,label=prop.label,interior=interior,entry=entry,isOwnerOrRenter=accessible(char,prop)})
    return true,t(source, 'property.enter.loading')
end
exports.sunset_core:RegisterCallback('sunset:enterProperty',enter)

local function ownedProperty(source,id)
    local char=exports.sunset_core:GetCharacter(source)
    if not char then return nil,nil,t(source, 'property.character_unavailable') end
    local prop=id and property(id) or (Inside[source] and property(Inside[source]))
    if not prop then
        local owned = MySQL.query.await('SELECT id FROM properties WHERE owner_character_id=?', { char.id }) or {}
        if #owned == 1 then
            prop = property(owned[1].id)
        elseif #owned > 1 then
            return char, nil, t(source, 'property.owner.multiple')
        end
    end
    if not prop then return char, nil, t(source, 'property.owner.specify') end
    if tonumber(prop.owner_character_id)~=tonumber(char.id) then return char,nil,t(source, 'property.owner.only') end
    return char,prop
end

local function toggleLock(source,id)
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    local locked=dbBool(prop.locked) and 0 or 1
    MySQL.update.await('UPDATE properties SET locked=? WHERE id=?',{locked,prop.id})
    notifyPropertiesChanged()
    return true,locked==1 and t(source, 'property.locked.success') or t(source, 'property.unlocked.success')
end

local function setRent(source,id,price)
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    if price == false or price == nil then
        MySQL.update.await('UPDATE properties SET rent_enabled=0 WHERE id=?',{prop.id})
        notifyPropertiesChanged()
        return true,t(source, 'property.rent.disabled_success')
    end
    price=tonumber(price)
    if not price or price ~= price or price<SunsetProperties.RentMin or price>SunsetProperties.RentMax then -- [SEC3] NaN
        return nil,t(source, 'property.rent.range', { min = SunsetProperties.RentMin, max = SunsetProperties.RentMax })
    end
    MySQL.update.await('UPDATE properties SET rent_enabled=1,rent_price=? WHERE id=?',{math.floor(price),prop.id})
    notifyPropertiesChanged()
    return true,t(source, 'property.rent.enabled', { price = price })
end

local function setMaxRenters(source,id,count)
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    count=tonumber(count)
    if not count or count ~= count or count<SunsetProperties.MaxRentersMin or count>SunsetProperties.MaxRentersMax then
        return nil,t(source, 'property.rent.capacity_range', { min = SunsetProperties.MaxRentersMin, max = SunsetProperties.MaxRentersMax })
    end
    local activeRenters = tonumber(prop.renter_count) or tonumber(MySQL.scalar.await(
        'SELECT COUNT(*) FROM property_rentals WHERE property_id = ? AND active = 1', { prop.id }
    )) or 0
    if count < activeRenters then
        return nil, t(source, 'property.rent.capacity_active', { count = activeRenters })
    end
    MySQL.update.await('UPDATE properties SET max_renters=? WHERE id=?',{math.floor(count),prop.id})
    notifyPropertiesChanged()
    return true,t(source, 'property.rent.capacity_saved', { count = count })
end

local function setDescription(source,id,text)
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    if text == false or text == nil or text == '' then
        MySQL.update.await('UPDATE properties SET description=NULL WHERE id=?',{prop.id})
        notifyPropertiesChanged()
        return true,t(source, 'property.description.removed')
    end
    text=tostring(text):match('^%s*(.-)%s*$')
    if text == '' then return nil,t(source, 'property.description.empty') end
    if #text>160 then return nil,t(source, 'property.description.long') end
    MySQL.update.await('UPDATE properties SET description=? WHERE id=?',{text,prop.id})
    notifyPropertiesChanged()
    return true,t(source, 'property.description.saved', { description = text })
end

local function changeInterior(source,id,key)
    local preset=SunsetProperties.Interiors[tostring(key or '')]
    if not preset then return nil,t(source, 'property.interior.invalid') end
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    for player,insideId in pairs(Inside) do
        if insideId==prop.id and tonumber(player)~=source then
            return nil,t(source, 'property.interior.occupied')
        end
    end
    MySQL.update.await('UPDATE properties SET interior=?,interior_pos=? WHERE id=?',{key,encodePos(preset.coords,preset.coords.w),prop.id})
    notifyPropertiesChanged()
    return true,t(source, 'property.interior.changed', { interior = preset.label })
end

local function kickRenter(source,id,characterId)
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    characterId=tonumber(characterId)
    if not characterId then return nil,t(source, 'property.renter.select') end
    local changed=MySQL.update.await('UPDATE property_rentals SET active=0 WHERE property_id=? AND character_id=? AND active=1',{prop.id,characterId})
    if changed<1 then return nil,t(source, 'property.renter.not_active') end
    clearHome(characterId,prop.id,('The owner removed you from %s. Your job and faction were not changed.'):format(prop.label))
    notifyPropertiesChanged()
    return true,t(source, 'property.renter.removed', { id = characterId })
end

local function evictPropertyRenters(propertyId, label, reasonSuffix)
    local renters = MySQL.query.await(
        'SELECT character_id FROM property_rentals WHERE property_id=? AND active=1',
        { propertyId }
    ) or {}
    MySQL.update.await('UPDATE property_rentals SET active=0 WHERE property_id=?', { propertyId })
    local suffix = reasonSuffix or 'ownership changed'
    for _, renter in ipairs(renters) do
        clearHome(renter.character_id, propertyId, ('Your rental at %s ended because %s.'):format(label, suffix))
    end
    MySQL.update.await('UPDATE characters SET home_property_id=NULL WHERE home_property_id=?', { propertyId })
end

local function transferPropertyOwnership(propertyId, fromCharId, toCharId, recipientSource)
    propertyId = tonumber(propertyId)
    fromCharId = tonumber(fromCharId)
    toCharId = tonumber(toCharId)
    if not propertyId or not fromCharId or not toCharId then return false, t(recipientSource, 'property.transfer.invalid') end
    local prop = property(propertyId)
    if not prop or tonumber(prop.owner_character_id) ~= fromCharId then
        return false, t(recipientSource, 'property.transfer.not_owned')
    end
    evictPropertyRenters(propertyId, prop.label or 'the house', 'the house was traded')
    local changed = MySQL.update.await(
        'UPDATE properties SET owner_character_id=? WHERE id=? AND owner_character_id=?',
        { toCharId, propertyId, fromCharId }
    )
    if changed ~= 1 then return false, t(recipientSource, 'property.transfer.failed') end
    if tonumber(prop.owner_character_id) == fromCharId then
        for _, playerId in ipairs(GetPlayers()) do
            local src = tonumber(playerId)
            local online = exports.sunset_core:GetCharacter(src)
            if online and tonumber(online.id) == fromCharId and tonumber(online.home_property_id) == propertyId then
                exports.sunset_core:SetHomeProperty(src, nil)
            end
        end
    end
    notifyPropertiesChanged()
    return true
end
exports('TransferPropertyOwnership', transferPropertyOwnership)
exports('GetMaxOwnedPerCharacter', function()
    return tonumber(SunsetProperties.MaxOwnedPerCharacter) or 0
end)

local function sellHouse(source,id,confirm)
    local owner,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    local refund=math.floor((tonumber(prop.price) or 0)*0.7)
    if not confirm then
        return false,t(source, 'property.sell.confirm', { property = prop.label, percent = 70, refund = refund })
    end
    -- [SEC3] claim the sale atomically BEFORE paying: parallel sell calls each paid the refund
    -- (the conditional UPDATE's affected-row count was never checked).
    local sold = MySQL.update.await('UPDATE properties SET owner_character_id=NULL,locked=1,rent_enabled=0 WHERE id=? AND owner_character_id=?',{prop.id,owner.id})
    if tonumber(sold) ~= 1 then return nil,t(source, 'property.owner.only') end
    evictPropertyRenters(prop.id, prop.label, 'the house was sold')
    exports.sunset_core:SetHomeProperty(source,nil)
    exports.sunset_core:AddMoney(source,'bank',refund,'house_sale')
    notifyPropertiesChanged()
    return true,t(source, 'property.sell.success', { refund = refund })
end

exports.sunset_core:RegisterCallback('sunset:getPropertyMeta', function()
    local interiors = {}
    for id,preset in pairs(SunsetProperties.Interiors) do
        interiors[#interiors+1] = { id = id, label = preset.label }
    end
    table.sort(interiors, function(a,b) return a.label < b.label end)
    return {
        rentMin = SunsetProperties.RentMin,
        rentMax = SunsetProperties.RentMax,
        maxRentersMin = SunsetProperties.MaxRentersMin,
        maxRentersMax = SunsetProperties.MaxRentersMax,
        sellRefundPercent = 70,
        interiors = interiors,
    }
end)

exports.sunset_core:RegisterCallback('sunset:getPropertyRenters', function(source,id)
    local _,prop,err=ownedProperty(source,id)
    if not prop then return nil,err end
    local rows=MySQL.query.await([[SELECT r.character_id,TRIM(CONCAT(c.firstname,' ',c.lastname)) name,r.rent_price,r.last_paid_at
      FROM property_rentals r JOIN characters c ON c.id=r.character_id WHERE r.property_id=? AND r.active=1 ORDER BY r.started_at]],{prop.id}) or {}
    for _,row in ipairs(rows) do
        row.rent_price = tonumber(row.rent_price) or 0
    end
    return rows
end)

exports.sunset_core:RegisterCallback('sunset:propertyAction', function(source,action,id,payload)
    payload = type(payload) == 'table' and payload or {}
    if action=='enter' then return enter(source,id)
    elseif action=='lock' then return toggleLock(source,id)
    elseif action=='sethome' then
        local char=exports.sunset_core:GetCharacter(source); local prop=property(id)
        if not char or not prop or not accessible(char,prop) then return nil,t(source, 'property.home.requires_access') end
        if not exports.sunset_core:SetHomeProperty(source,prop.id) then return nil,t(source, 'property.home.save_failed') end
        return true,t(source, 'property.home.saved', { property = prop.label })
    elseif action=='rent_on' then return setRent(source,id,payload.price)
    elseif action=='rent_off' then return setRent(source,id,false)
    elseif action=='max_renters' then return setMaxRenters(source,id,payload.count)
    elseif action=='description' then
        if payload.clear then return setDescription(source,id,false) end
        return setDescription(source,id,payload.text)
    elseif action=='interior' then return changeInterior(source,id,payload.key)
    elseif action=='kick_renter' then return kickRenter(source,id,payload.characterId)
    elseif action=='sell' then return sellHouse(source,id,payload.confirm == true)
    elseif action=='unrent' then
        local char=exports.sunset_core:GetCharacter(source)
        if not char then return nil,t(source, 'property.character_unavailable') end
        local rent=activeRental(char.id)
        if not rent then return nil,t(source, 'property.rent.none') end
        MySQL.update.await('UPDATE property_rentals SET active=0 WHERE id=?',{rent.id})
        if tonumber(char.home_property_id)==tonumber(rent.property_id) then exports.sunset_core:SetHomeProperty(source,nil) end
        notifyPropertiesChanged()
        return true,t(source, 'property.rent.ended')
    end
    return nil,t(source, 'property.action.unknown')
end)

RegisterNetEvent('sunset:server:exitProperty',function()
    local src=source; local id=Inside[src]
    if not id then return message(src,exports.sunset_core:TFor(src, 'property_not_inside'),'error') end
    local prop=property(id); Inside[src]=nil; SetPlayerRoutingBucket(src,0); Player(src).state:set('sunsetPropertyExit',nil,false)
    if prop then TriggerClientEvent('sunset:client:propertyExited',src,{id=prop.id,entry=decodePos(prop.exit_pos) or decodePos(prop.entry)}) end
end)
-- [AUDIT 3-5.1] Server export so death/hospital respawn, jail intake and admin
-- teleports can release a player from a house routing bucket. Without this a
-- downed player respawned at the hospital still inside their bucket (invisible).
exports('LeaveProperty', function(src)
    src = tonumber(src)
    if not src or not Inside[src] then return false end
    local id = Inside[src]
    local prop = property(id)
    Inside[src] = nil
    SetPlayerRoutingBucket(src, 0)
    if GetPlayerName(src) then
        Player(src).state:set('sunsetPropertyExit', nil, false)
        TriggerClientEvent('sunset:client:propertyExited', src, prop and {id=prop.id, entry=decodePos(prop.exit_pos) or decodePos(prop.entry)} or {})
    end
    return true
end)

AddEventHandler('playerDropped',function() Inside[source]=nil end)
AddEventHandler('onResourceStop',function(resource)
    if resource~=GetCurrentResourceName() then return end
    -- [RESTART SAFETY] Inside[] dies with the resource: walk everyone out to the
    -- entrance (bucket 0 + exit teleport + client radar/state reset) instead of
    -- leaving them in an interior with no server-side way to exit.
    for player,id in pairs(Inside) do
        SetPlayerRoutingBucket(player,0)
        if GetPlayerName(player) then
            local prop=property(id)
            Player(player).state:set('sunsetPropertyExit',nil,false)
            TriggerClientEvent('sunset:client:propertyExited',player,prop and {id=prop.id,entry=decodePos(prop.exit_pos) or decodePos(prop.entry)} or {})
        end
    end
end)

registerPropertyCommand('acreatehouse',function(source,args)
    if source==0 or not exports.sunset_admin:IsAdmin(source,SunsetProperties.AdminLevel) then return message(source,exports.sunset_core:TFor(source, 'properties.msg.admin_level_3_is_required_to'),'error') end
    local price = tonumber(args[1])
    local interior = tostring(args[2] or ''):lower()
    local level = tonumber(args[3])
    local preset = SunsetProperties.Interiors[interior]
    if not price or price < 1 or not preset or not level or level < 1 then
        local list = {}
        for id in pairs(SunsetProperties.Interiors) do list[#list+1] = id end
        table.sort(list)
        return message(source, exports.sunset_core:TFor(source, 'properties.msg.usage_acreatehouse_pret_interior_nivel_minim', { concat = table.concat(list, ', ') }), 'error')
    end
    local label = table.concat(args, ' ', 4):sub(1, 64)
    if #label < 3 then return message(source, exports.sunset_core:TFor(source, 'properties.msg.add_a_name_for_the_house'), 'error') end
    local ped = GetPlayerPed(source)
    if ped == 0 then return message(source, exports.sunset_core:TFor(source, 'properties.msg.player_position_unavailable_try_again'), 'error') end
    local pos, heading = GetEntityCoords(ped), GetEntityHeading(ped)
    local id = MySQL.insert.await([[INSERT INTO properties(label,price,interior,entry,interior_pos,exit_pos,minimum_level,for_sale,enabled)
      VALUES(?,?,?,?,?,?,?,1,1)]], {label, math.floor(price), interior, encodePos(pos, heading), encodePos(preset.coords, preset.coords.w), encodePos(pos, heading), math.floor(level)})
    notifyPropertiesChanged()
    message(source, exports.sunset_core:TFor(source, 'properties.msg.casa_a_fost_creata_interior_level', { id = math.floor(tonumber(id) or 0), label = tostring(label), price = math.floor(tonumber(price) or 0), interior = tostring(interior), level = math.floor(tonumber(level) or 0) }), 'success')
end)

registerPropertyCommand('houseinteriors',function(source)
    local list={}; for id,preset in pairs(SunsetProperties.Interiors) do list[#list+1]=id..' ('..preset.label..')' end; table.sort(list)
    message(source,exports.sunset_core:TFor(source, 'properties.msg.available_interiors', { concat = table.concat(list,', ') }),'info')
end)

registerPropertyCommand('houselock',function(source,args) local ok,msg=toggleLock(source,tonumber(args[1])); message(source,msg,ok and 'success' or 'error') end)

registerPropertyCommand('houserent',function(source,args)
    local price=tonumber(args[1]); local _,prop,err=ownedProperty(source,tonumber(args[2])); if not prop then return message(source,err,'error') end
    if args[1]=='off' then MySQL.update.await('UPDATE properties SET rent_enabled=0 WHERE id=?',{prop.id}); TriggerClientEvent('sunset:client:propertiesChanged',-1); return message(source,exports.sunset_core:TFor(source, 'properties.msg.new_rentals_disabled_existing_renters_keep'),'success') end
    if not price or price<SunsetProperties.RentMin or price>SunsetProperties.RentMax then return message(source,exports.sunset_core:TFor(source, 'properties.msg.usage_houserent_price_off_house_id', { rent_min = math.floor(tonumber(SunsetProperties.RentMin) or 0), rent_max = math.floor(tonumber(SunsetProperties.RentMax) or 0) }),'error') end
    MySQL.update.await('UPDATE properties SET rent_enabled=1,rent_price=? WHERE id=?',{math.floor(price),prop.id}); TriggerClientEvent('sunset:client:propertiesChanged',-1)
    message(source,exports.sunset_core:TFor(source, 'properties.msg.rent_enabled_at_per_payday', { price = math.floor(tonumber(price) or 0) }),'success')
end)

registerPropertyCommand('housemaxrenters',function(source,args)
    local count=tonumber(args[1]); local _,prop,err=ownedProperty(source,tonumber(args[2])); if not prop then return message(source,err,'error') end
    if not count or count<SunsetProperties.MaxRentersMin or count>SunsetProperties.MaxRentersMax then return message(source,exports.sunset_core:TFor(source, 'properties.msg.usage_housemaxrenters_house_id', { max_renters_min = math.floor(tonumber(SunsetProperties.MaxRentersMin) or 0), max_renters_max = math.floor(tonumber(SunsetProperties.MaxRentersMax) or 0) }),'error') end
    MySQL.update.await('UPDATE properties SET max_renters=? WHERE id=?',{math.floor(count),prop.id}); TriggerClientEvent('sunset:client:propertiesChanged',-1); message(source,exports.sunset_core:TFor(source, 'properties.msg.maximum_renters_set_to', { count = math.floor(tonumber(count) or 0) }),'success')
end)

registerPropertyCommand('houseinterior',function(source,args)
    local key=tostring(args[1] or ''); local preset=SunsetProperties.Interiors[key]
    if not preset then return message(source,exports.sunset_core:TFor(source, 'properties.msg.unknown_interior_use_houseinteriors_to_see'),'error') end
    local _,prop,err=ownedProperty(source,tonumber(args[2])); if not prop then return message(source,err,'error') end
    for player,id in pairs(Inside) do if id==prop.id and tonumber(player)~=source then return message(source,exports.sunset_core:TFor(source, 'properties.msg.everyone_else_must_leave_before_the'),'error') end end
    MySQL.update.await('UPDATE properties SET interior=?,interior_pos=? WHERE id=?',{key,encodePos(preset.coords,preset.coords.w),prop.id})
    message(source,exports.sunset_core:TFor(source, 'properties.msg.interior_changed_to_re_enter_to', { label = tostring(preset.label) }),'success')
end)

registerPropertyCommand('hdescription',function(source,args)
    local _,prop,err=ownedProperty(source,nil); if not prop then return message(source,err,'error') end
    local text=table.concat(args,' '):match('^%s*(.-)%s*$')
    if text=='' then return message(source,exports.sunset_core:TFor(source, 'properties.msg.usage_hdescription_text_or_hdescription_off'),'error') end
    if text:lower()=='off' then text=nil elseif #text>160 then return message(source,exports.sunset_core:TFor(source, 'properties.msg.house_description_is_too_long_maximum'),'error') end
    MySQL.update.await('UPDATE properties SET description=? WHERE id=?',{text,prop.id})
    notifyPropertiesChanged()
    message(source,text and exports.sunset_core:TFor(source, 'properties.msg.house_description_updated', { text = tostring(text) }) or exports.sunset_core:TFor(source, 'properties.msg.house_description_removed'),'success')
end)

registerPropertyCommand('houserenters',function(source,args)
    local _,prop,err=ownedProperty(source,tonumber(args[1])); if not prop then return message(source,err,'error') end
    local rows=MySQL.query.await([[SELECT r.character_id,TRIM(CONCAT(c.firstname,' ',c.lastname)) name,r.rent_price,r.last_paid_at
      FROM property_rentals r JOIN characters c ON c.id=r.character_id WHERE r.property_id=? AND r.active=1 ORDER BY r.started_at]],{prop.id}) or {}
    if #rows==0 then return message(source,exports.sunset_core:TFor(source, 'properties.msg.this_house_currently_has_no_renters'),'info') end
    local list={}; for _,row in ipairs(rows) do list[#list+1]=('#%d %s ($%d/payday)'):format(row.character_id,row.name,row.rent_price) end
    message(source,exports.sunset_core:TFor(source, 'properties.msg.renters', { concat = table.concat(list,', ') }),'info')
end)

registerPropertyCommand('housekickrenter',function(source,args)
    local characterId=tonumber(args[1]); local _,prop,err=ownedProperty(source,tonumber(args[2])); if not prop then return message(source,err,'error') end
    if not characterId then return message(source,exports.sunset_core:TFor(source, 'properties.msg.usage_housekickrenter_character_id_house_id'),'error') end
    local changed=MySQL.update.await('UPDATE property_rentals SET active=0 WHERE property_id=? AND character_id=? AND active=1',{prop.id,characterId})
    if changed<1 then return message(source,exports.sunset_core:TFor(source, 'properties.msg.that_character_is_not_an_active'),'error') end
    clearHome(characterId,prop.id,('The owner removed you from %s. Your job and faction were not changed.'):format(prop.label))
    notifyPropertiesChanged(); message(source,exports.sunset_core:TFor(source, 'properties.msg.renter_was_removed', { character_id = math.floor(tonumber(characterId) or 0) }),'success')
end)

registerPropertyCommand('sellhouse',function(source,args)
    local id=tonumber(args[1]); local owner,prop,err=ownedProperty(source,id); if not prop then return message(source,err,'error') end
    if tostring(args[2] or ''):lower()~='confirm' then return message(source,exports.sunset_core:TFor(source, 'properties.msg.this_permanently_sells_for_70_use', { label = tostring(prop.label), value = math.floor(tonumber(math.floor(prop.price*0.7)) or 0), id = math.floor(tonumber(prop.id) or 0) }),'error') end
    local refund=math.floor((tonumber(prop.price) or 0)*0.7)
    -- [SEC3] atomic claim first (double-refund race), then evict renters
    local sold=MySQL.update.await('UPDATE properties SET owner_character_id=NULL,locked=1,rent_enabled=0 WHERE id=? AND owner_character_id=?',{prop.id,owner.id})
    if tonumber(sold)~=1 then return message(source,exports.sunset_core:TFor(source, 'properties.msg.you_do_not_own_this_house'),'error') end
    local renters=MySQL.query.await('SELECT character_id FROM property_rentals WHERE property_id=? AND active=1',{prop.id}) or {}
    MySQL.update.await('UPDATE property_rentals SET active=0 WHERE property_id=?',{prop.id})
    for _,renter in ipairs(renters) do clearHome(renter.character_id,prop.id,('Your rental at %s ended because the house was sold.'):format(prop.label)) end
    MySQL.update.await('UPDATE characters SET home_property_id=NULL WHERE home_property_id=?',{prop.id})
    exports.sunset_core:SetHomeProperty(source,nil); exports.sunset_core:AddMoney(source,'bank',refund,'house_sale')
    notifyPropertiesChanged(); message(source,exports.sunset_core:TFor(source, 'properties.msg.house_sold_was_deposited_in_your', { refund = math.floor(tonumber(refund) or 0) }),'success')
end)

registerPropertyCommand('ahouseedit',function(source,args)
    if source==0 or not exports.sunset_admin:IsAdmin(source,SunsetProperties.AdminLevel) then return message(source,exports.sunset_core:TFor(source, 'properties.msg.admin_level_3_is_required'),'error') end
    local id,field=tonumber(args[1]),tostring(args[2] or ''):lower(); local fields={price='price',level='minimum_level',name='label',description='description',sale='for_sale',enabled='enabled'}
    if not id or not fields[field] then return message(source,exports.sunset_core:TFor(source, 'properties.msg.usage_ahouseedit_id_price_level_name'),'error') end
    local value=table.concat(args,' ',3); if field~='name' then value=tonumber(value) end
    if field=='name' or field=='description' then value=table.concat(args,' ',3) end
    if value==nil or ((field~='name' and field~='description') and value<0) or (field=='name' and #value<3) or (field=='description' and #value>160) then return message(source,exports.sunset_core:TFor(source, 'properties.msg.enter_a_valid_value_descriptions_may'),'error') end
    local changed=MySQL.update.await(('UPDATE properties SET %s=? WHERE id=?'):format(fields[field]),{value,id})
    if changed<1 then return message(source,exports.sunset_core:TFor(source, 'properties.msg.house_not_found_or_value_unchanged'),'error') end
    notifyPropertiesChanged(); message(source,exports.sunset_core:TFor(source, 'properties.msg.house_updated', { id = math.floor(tonumber(id) or 0), field = tostring(field), value = tostring(value) }),'success')
end)

registerPropertyCommand('aenablerent', function(source, args)
    if source==0 or not exports.sunset_admin:IsAdmin(source,SunsetProperties.AdminLevel) then return message(source,exports.sunset_core:TFor(source, 'properties.msg.admin_level_3_is_required'),'error') end
    local price = math.floor(tonumber(args[1]) or SunsetProperties.DefaultRentPrice or 500)
    local changed = MySQL.update.await(
        'UPDATE properties SET rent_enabled=1, rent_price=? WHERE owner_character_id IS NOT NULL AND rent_enabled=0',
        { price }
    )
    notifyPropertiesChanged()
    message(source, exports.sunset_core:TFor(source, 'properties.msg.rent_enabled_on_owned_houses_at', { changed = math.floor(tonumber(tonumber(changed) or 0) or 0), price = math.floor(tonumber(price) or 0) }), 'success')
end, false)

registerPropertyCommand('renthouse',function(source) message(source,exports.sunset_core:TFor(source, 'properties.msg.stand_at_a_house_marker_press'),'info') end)
registerPropertyCommand('unrent',function(source)
    local char=exports.sunset_core:GetCharacter(source); if not char then return end; local rent=activeRental(char.id)
    if not rent then return message(source,exports.sunset_core:TFor(source, 'properties.msg.you_do_not_currently_rent_a'),'error') end
    MySQL.update.await('UPDATE property_rentals SET active=0 WHERE id=?',{rent.id}); if tonumber(char.home_property_id)==tonumber(rent.property_id) then exports.sunset_core:SetHomeProperty(source,nil) end
    notifyPropertiesChanged(); message(source,exports.sunset_core:TFor(source, 'properties.msg.rental_ended_your_civilian_job_and'),'success')
end)

function ProcessRentPayday(source)
    local char=exports.sunset_core:GetCharacter(source); if not char then return {charged=0} end
    local rent=MySQL.single.await([[SELECT r.*,p.label,p.owner_character_id FROM property_rentals r JOIN properties p ON p.id=r.property_id WHERE r.character_id=? AND r.active=1 LIMIT 1]],{char.id})
    if not rent then return {charged=0} end
    local price=tonumber(rent.rent_price) or 0
    if not charge(source,price,'house_rent_payday') then
        MySQL.update.await('UPDATE property_rentals SET active=0 WHERE id=?',{rent.id}); if tonumber(char.home_property_id)==tonumber(rent.property_id) then clearHome(char.id,rent.property_id) end
        message(source,exports.sunset_core:TFor(source, 'properties.msg.rental_at_ended_because_you_could', { label = tostring(rent.label), price = math.floor(tonumber(price) or 0) }),'error'); return {charged=0,evicted=true}
    end
    MySQL.update.await('UPDATE property_rentals SET last_paid_at=NOW() WHERE id=?',{rent.id}); creditOwner(rent.owner_character_id,price)
    return {charged=price,label=rent.label}
end
exports('ProcessRentPayday',ProcessRentPayday)

function ExecutePlayerCommand(source, name, args)
    if source == 0 then return false end
    name = string.lower(tostring(name or ''))
    local handler = PropertyChatHandlers[name]
    if not handler then return false end
    handler(source, args or {})
    return true
end
exports('ExecutePlayerCommand', ExecutePlayerCommand)
