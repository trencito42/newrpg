-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — server/main.lua
--  Racket Shop server: wires the pure settlement engine (server/settlement.lua)
--  and product handlers (server/handlers/*.lua) to the real database, the core
--  Racket Credit API and the owning domain resources.
--
--  Server is authoritative for EVERYTHING: product, price, reward, balance and
--  eligibility. The client sends only { productId, requestId, params }.
--  Tables owned here: shop_orders, shop_entitlements, shop_audit_log.
-- ═══════════════════════════════════════════════════════════════

local RESOURCE = GetCurrentResourceName()

local function log(level, message)
    local color = (level == 'critical' or level == 'error') and '^1' or '^3'
    print(('%s[sunset_shop]^7 [%s] %s'):format(color, tostring(level), tostring(message)))
end

local function getContext(source)
    local player = exports.sunset_core:GetPlayer(source)
    local char = player and player.character
    if not player or not char or not player.account_id then return nil end
    return {
        accountId = tonumber(player.account_id),
        characterId = tonumber(char.id),
    }
end

local function safeJson(value)
    if value == nil then return nil end
    local ok, encoded = pcall(json.encode, value)
    return ok and encoded or nil
end

-- ═══ Racket Credits (stored as accounts.premium_points) ═══

function GetRacketCredits(source)
    local ok, balance = pcall(function() return exports.sunset_core:RefreshBlazePoints(source) end)
    return ok and (tonumber(balance) or 0) or 0
end

-- Guarded atomic debit delegated to sunset_core (owner of the accounts table):
-- SpendBlazePoints only subtracts when premium_points >= amount, in one statement.
function TrySpendRacketCredits(source, amount, reason)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return false, { localeKey = 'shop.purchase.failed' } end
    local ok, spent, spendErr = pcall(function() return exports.sunset_core:SpendBlazePoints(source, amount) end)
    if not ok then
        log('error', ('SpendBlazePoints raised for src %s: %s'):format(tostring(source), tostring(spent)))
        return false, { localeKey = 'shop.purchase.failed' }
    end
    if not spent then return false, { localeKey = 'shop.purchase.insufficient_rc' } end
    return true
end

local function refundRacketCredits(source, amount, reason)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return true end
    local ok, added = pcall(function() return exports.sunset_core:AddBlazePoints(source, amount) end)
    return ok and added == true
end

-- ═══ Data access (ShopStore) ═══

local function auditRow(event, data)
    data = type(data) == 'table' and data or {}
    MySQL.insert.await(
        'INSERT INTO shop_audit_log (event, account_id, character_id, order_id, amount, details) VALUES (?, ?, ?, ?, ?, ?)',
        { tostring(event):sub(1, 48), tonumber(data.accountId), tonumber(data.characterId), tonumber(data.orderId),
          math.floor(tonumber(data.amount) or 0), safeJson(data) }
    )
end

ShopStore = {
    findOrder = function(requestId)
        return MySQL.single.await(
            'SELECT id, account_id, product_id, status FROM shop_orders WHERE request_id = ? LIMIT 1',
            { requestId }
        )
    end,

    createOrder = function(order)
        local ok, id = pcall(function()
            return MySQL.insert.await([[
                INSERT INTO shop_orders (request_id, account_id, character_id, product_id, currency, price, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            ]], { order.requestId, order.accountId, order.characterId, order.productId, order.currency, order.price })
        end)
        if not ok then return nil end -- duplicate request_id (UNIQUE) or DB failure
        return tonumber(id)
    end,

    setOrderStatus = function(orderId, status, metadata)
        local done = status == 'completed' or status == 'refunded' or status == 'failed'
        MySQL.update.await(
            ('UPDATE shop_orders SET status = ?, metadata = COALESCE(?, metadata)%s WHERE id = ?')
                :format(done and ', completed_at = NOW()' or ''),
            { status, safeJson(metadata), orderId }
        )
    end,

    createEntitlement = function(entry)
        local ok, id = pcall(function()
            return MySQL.insert.await([[
                INSERT INTO shop_entitlements (account_id, character_id, clan_id, entitlement_type, quantity, metadata, order_id)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            ]], { entry.accountId, entry.characterId, entry.clanId, entry.type, safeJson(entry.metadata), entry.orderId })
        end)
        if not ok then
            log('error', ('entitlement insert failed: %s'):format(tostring(id)))
            return nil
        end
        return tonumber(id)
    end,

    findOpenEntitlement = function(filter)
        if filter.clanId then
            return MySQL.single.await([[
                SELECT id, order_id FROM shop_entitlements
                WHERE account_id = ? AND clan_id = ? AND entitlement_type = ? AND consumed_at IS NULL
                ORDER BY id ASC LIMIT 1
            ]], { filter.accountId, filter.clanId, filter.type })
        end
        return MySQL.single.await([[
            SELECT id, order_id FROM shop_entitlements
            WHERE account_id = ? AND character_id = ? AND entitlement_type = ? AND consumed_at IS NULL
            ORDER BY id ASC LIMIT 1
        ]], { filter.accountId, filter.characterId, filter.type })
    end,

    consumeEntitlement = function(id)
        local changed = MySQL.update.await(
            'UPDATE shop_entitlements SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL', { id })
        return tonumber(changed) == 1
    end,

    restoreEntitlement = function(id)
        local changed = MySQL.update.await('UPDATE shop_entitlements SET consumed_at = NULL WHERE id = ?', { id })
        return tonumber(changed) == 1
    end,

    openEntitlements = function(accountId, characterId, clanId)
        local rows = MySQL.query.await([[
            SELECT entitlement_type, COUNT(*) AS n FROM shop_entitlements
            WHERE account_id = ? AND consumed_at IS NULL
              AND ((entitlement_type = 'char_name_change' AND character_id = ?)
                OR (entitlement_type = 'clan_name_change' AND clan_id = ?))
            GROUP BY entitlement_type
        ]], { accountId, characterId, clanId or 0 }) or {}
        local out = {}
        for _, row in ipairs(rows) do out[row.entitlement_type] = tonumber(row.n) or 0 end
        return out
    end,

    audit = function(event, data)
        local ok, err = pcall(auditRow, event, data)
        if not ok then log('error', ('audit %s failed: %s'):format(tostring(event), tostring(err))) end
    end,
}

-- ═══ Domain services (ShopServices) ═══

local function clansStarted()
    return GetResourceState('sunset_clans') == 'started'
end

ShopServices = {
    getContext = getContext,

    renameCharacter = function(source, firstname, lastname)
        return exports.sunset_core:RenameCharacter(source, firstname, lastname)
    end,

    publicName = function(source)
        local char = exports.sunset_core:GetCharacter(source)
        if not char then return nil end
        return exports.sunset_core:FormatPublicName(char.firstname, char.lastname)
    end,

    nicknameTaken = function(nickname, characterId)
        local taken = MySQL.scalar.await([[
            SELECT id FROM characters
            WHERE id <> ? AND LOWER(TRIM(CONCAT(firstname, ' ', IFNULL(lastname, '')))) = LOWER(?)
            LIMIT 1
        ]], { characterId, nickname })
        return taken ~= nil
    end,

    creditBank = function(source, amount, reason)
        return exports.sunset_core:AddMoney(source, 'bank', amount, reason) == true
    end,

    clanCheck = function(source, action, params)
        if not clansStarted() then return false, { localeKey = 'shop.unavailable' } end
        return exports.sunset_clans:ShopCheckClanProduct(source, action, params)
    end,

    clanApply = function(source, action, params)
        if not clansStarted() then return nil, { localeKey = 'shop.unavailable' } end
        return exports.sunset_clans:ShopApplyClanProduct(source, action, params)
    end,

    clanContext = function(source)
        if not clansStarted() then return { inClan = false } end
        local ok, ctx = pcall(function() return exports.sunset_clans:GetShopClanContext(source) end)
        return ok and ctx or { inClan = false }
    end,
}

-- ═══ Settlement engine ═══

local Engine = ShopSettlement.create({
    now = GetGameTimer,
    log = log,
    handlers = ShopHandlers,
    getContext = getContext,
    findOrder = ShopStore.findOrder,
    createOrder = ShopStore.createOrder,
    setOrderStatus = ShopStore.setOrderStatus,
    spendCredits = function(source, amount, reason) return TrySpendRacketCredits(source, amount, reason) end,
    refundCredits = refundRacketCredits,
    getBalance = GetRacketCredits,
    audit = ShopStore.audit,
})

local function purchase(source, productId, requestId, params)
    local result, err = Engine.purchase(source, productId, requestId, params)
    if result and not result.replay then
        TriggerClientEvent('sunset:shop:balance', source, GetRacketCredits(source))
    end
    return result, err
end

-- ═══ Callbacks ═══

local function catalogPayload(source)
    local ctx = getContext(source)
    if not ctx then return nil, { localeKey = 'shop.purchase.not_loaded' } end
    local clan = ShopServices.clanContext(source) or { inClan = false }
    return {
        products = ShopPublicProducts(),
        categories = ShopCategories,
        balance = GetRacketCredits(source),
        clan = clan,
        entitlements = ShopStore.openEntitlements(ctx.accountId, ctx.characterId, clan.clanId),
    }
end

exports.sunset_core:RegisterCallback('sunset:shop:getProducts', function(source)
    return catalogPayload(source)
end)

exports.sunset_core:RegisterCallback('sunset:shop:purchase', function(source, data)
    if type(data) ~= 'table' then return nil, { localeKey = 'shop.purchase.invalid_request' } end
    -- Only these three fields are read; any client price/amount/definition is ignored.
    local productId = type(data.productId) == 'string' and data.productId or nil
    local requestId = type(data.requestId) == 'string' and data.requestId or nil
    local params = type(data.params) == 'table' and data.params or {}
    return purchase(source, productId, requestId, { tag = params.tag, color = params.color })
end)

exports.sunset_core:RegisterCallback('sunset:shop:consumeNameChange', function(source, data)
    local result, err = ShopConsumeNameChange(source, data)
    if result then
        TriggerClientEvent('sunset:client:notify', source,
            exports.sunset_core:TFor(source, 'shop.name_change.success'), 'success', 6000)
    end
    return result, err
end)

exports.sunset_core:RegisterCallback('sunset:shop:consumeClanNameChange', function(source, data)
    return ShopConsumeClanNameChange(source, data)
end)

exports.sunset_core:RegisterCallback('sunset:shop:getHistory', function(source)
    local ctx = getContext(source)
    if not ctx then return nil, { localeKey = 'shop.purchase.not_loaded' } end
    local rows = MySQL.query.await([[
        SELECT id, product_id, price, currency, status, UNIX_TIMESTAMP(created_at) AS created
        FROM shop_orders WHERE account_id = ?
        ORDER BY id DESC LIMIT ?
    ]], { ctx.accountId, ShopConfig.HistoryLimit or 25 }) or {}
    local out = {}
    for _, row in ipairs(rows) do
        local product = ShopProducts[row.product_id]
        out[#out + 1] = {
            id = tonumber(row.id),
            productId = row.product_id,
            labelKey = product and product.labelKey or nil,
            price = tonumber(row.price) or 0,
            currency = row.currency,
            status = row.status,
            created = tonumber(row.created) or 0,
        }
    end
    return out
end)

-- ═══ Server exports (other resources only) ═══

exports('PurchaseProduct', function(source, productId, requestId, params)
    return purchase(source, productId, requestId, params)
end)

-- Panel queue settlement: same engine path as in-game, requires the account to be
-- online on the selected character (no parallel financial logic in Next.js).
exports('PurchaseProductForPanel', function(accountId, characterId, productId, requestId, params)
    accountId = tonumber(accountId)
    characterId = tonumber(characterId)
    if not accountId or not characterId then
        return nil, { localeKey = 'shop.purchase.invalid_request' }
    end
    local source = exports.sunset_core:GetSourceByAccountId(accountId)
    if not source or source <= 0 then
        return nil, { localeKey = 'shop.purchase.not_online' }
    end
    local ctx = getContext(source)
    if not ctx or tonumber(ctx.accountId) ~= accountId or tonumber(ctx.characterId) ~= characterId then
        return nil, { localeKey = 'shop.purchase.character_mismatch' }
    end
    params = type(params) == 'table' and params or {}
    local result, err = purchase(source, productId, requestId, { tag = params.tag, color = params.color })
    return result, err
end)

exports('GetProductPrice', function(productId)
    local product = ShopGetProduct(productId)
    return product and product.price or nil
end)

exports('GetRacketCredits', GetRacketCredits)
exports('TrySpendRacketCredits', TrySpendRacketCredits)

AddEventHandler('playerDropped', function()
    Engine.release(source)
end)

AddEventHandler('onResourceStart', function(resource)
    if resource ~= RESOURCE then return end
    local problems = ShopValidateCatalog()
    for _, problem in ipairs(problems) do log('error', 'catalog: ' .. problem) end
end)
