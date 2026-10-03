-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — shared/products.lua
--  THE canonical Racket Shop product registry. Every price, reward and
--  product rule lives here and ONLY here; server handlers read from this
--  table and never accept a price, amount or definition from the client.
--
--  Visible currency: "Racket Credits" (RC). Internal storage remains
--  accounts.premium_points (kept for compatibility).
--
--  Product fields:
--    id, category, labelKey, descriptionKey, currency ('rc'), price (RC),
--    enabled, repeatable, cooldown (seconds, 0 = none), entitlement,
--    icon, handler ('character' | 'clan' | 'economy'),
--    plus handler-specific fields:
--      clanAction = 'name' | 'tag' | 'color' | 'slots' | 'renew'
--      slots      = target clan member capacity (clanAction 'slots')
--      days       = lifetime extension in days   (clanAction 'renew')
--      bankAmount = bank dollars granted          (economy cash packs)
--      input      = purchase-time input the UI collects ('tag' | 'color')
--      requiresLeader = product needs the buyer to lead a clan
-- ═══════════════════════════════════════════════════════════════

ShopConfig = {
    Currency = 'rc',
    -- Minimum gap between two purchase attempts by the same player.
    PurchaseCooldownMs = 1500,
    HistoryLimit = 25,
    RequestIdMinLength = 8,
    RequestIdMaxLength = 64,
    NameChange = {
        MinLength = 2,
        MaxLength = 32,
    },
}

ShopCategories = {
    { id = 'character', labelKey = 'shop.category.character', icon = 'user', order = 1 },
    { id = 'clan', labelKey = 'shop.category.clan', icon = 'shield', order = 2 },
    { id = 'economy', labelKey = 'shop.category.economy', icon = 'coins', order = 3 },
    { id = 'vehicle', labelKey = 'shop.category.vehicle', icon = 'car', order = 4 },
    { id = 'qol', labelKey = 'shop.category.qol', icon = 'star', order = 5 },
}

ShopProducts = {
    -- ═══ CHARACTER ═══
    char_name_change = {
        id = 'char_name_change',
        category = 'character',
        labelKey = 'shop.product.char_name_change.label',
        descriptionKey = 'shop.product.char_name_change.desc',
        currency = 'rc',
        price = 500,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        entitlement = 'char_name_change',
        icon = 'user-edit',
        handler = 'character',
    },

    -- ═══ CLAN ═══
    clan_name_change = {
        id = 'clan_name_change',
        category = 'clan',
        labelKey = 'shop.product.clan_name_change.label',
        descriptionKey = 'shop.product.clan_name_change.desc',
        currency = 'rc',
        price = 300,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        entitlement = 'clan_name_change',
        icon = 'shield-edit',
        handler = 'clan',
        clanAction = 'name',
        requiresLeader = true,
    },
    clan_tag_change = {
        id = 'clan_tag_change',
        category = 'clan',
        labelKey = 'shop.product.clan_tag_change.label',
        descriptionKey = 'shop.product.clan_tag_change.desc',
        currency = 'rc',
        price = 200,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'tag',
        handler = 'clan',
        clanAction = 'tag',
        input = 'tag',
        requiresLeader = true,
    },
    clan_color_change = {
        id = 'clan_color_change',
        category = 'clan',
        labelKey = 'shop.product.clan_color_change.label',
        descriptionKey = 'shop.product.clan_color_change.desc',
        currency = 'rc',
        price = 150,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'palette',
        handler = 'clan',
        clanAction = 'color',
        input = 'color',
        requiresLeader = true,
    },
    clan_slots_15 = {
        id = 'clan_slots_15',
        category = 'clan',
        labelKey = 'shop.product.clan_slots_15.label',
        descriptionKey = 'shop.product.clan_slots_15.desc',
        currency = 'rc',
        price = 500,
        enabled = true,
        repeatable = false,
        cooldown = 0,
        icon = 'users',
        handler = 'clan',
        clanAction = 'slots',
        slots = 15,
        requiresLeader = true,
    },
    clan_slots_20 = {
        id = 'clan_slots_20',
        category = 'clan',
        labelKey = 'shop.product.clan_slots_20.label',
        descriptionKey = 'shop.product.clan_slots_20.desc',
        currency = 'rc',
        price = 1000,
        enabled = true,
        repeatable = false,
        cooldown = 0,
        icon = 'users',
        handler = 'clan',
        clanAction = 'slots',
        slots = 20,
        requiresLeader = true,
    },
    clan_slots_25 = {
        id = 'clan_slots_25',
        category = 'clan',
        labelKey = 'shop.product.clan_slots_25.label',
        descriptionKey = 'shop.product.clan_slots_25.desc',
        currency = 'rc',
        price = 2000,
        enabled = true,
        repeatable = false,
        cooldown = 0,
        icon = 'users',
        handler = 'clan',
        clanAction = 'slots',
        slots = 25,
        requiresLeader = true,
    },
    clan_renew_7 = {
        id = 'clan_renew_7',
        category = 'clan',
        labelKey = 'shop.product.clan_renew_7.label',
        descriptionKey = 'shop.product.clan_renew_7.desc',
        currency = 'rc',
        price = 100,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'clock',
        handler = 'clan',
        clanAction = 'renew',
        days = 7,
        requiresLeader = true,
    },
    clan_renew_30 = {
        id = 'clan_renew_30',
        category = 'clan',
        labelKey = 'shop.product.clan_renew_30.label',
        descriptionKey = 'shop.product.clan_renew_30.desc',
        currency = 'rc',
        price = 350,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'clock',
        handler = 'clan',
        clanAction = 'renew',
        days = 30,
        requiresLeader = true,
    },
    clan_renew_90 = {
        id = 'clan_renew_90',
        category = 'clan',
        labelKey = 'shop.product.clan_renew_90.label',
        descriptionKey = 'shop.product.clan_renew_90.desc',
        currency = 'rc',
        price = 900,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'clock',
        handler = 'clan',
        clanAction = 'renew',
        days = 90,
        requiresLeader = true,
    },

    -- ═══ ECONOMY ═══
    cash_pack_s = {
        id = 'cash_pack_s',
        category = 'economy',
        labelKey = 'shop.product.cash_pack_s.label',
        descriptionKey = 'shop.product.cash_pack_s.desc',
        currency = 'rc',
        price = 100,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'cash',
        handler = 'economy',
        bankAmount = 25000,
    },
    cash_pack_m = {
        id = 'cash_pack_m',
        category = 'economy',
        labelKey = 'shop.product.cash_pack_m.label',
        descriptionKey = 'shop.product.cash_pack_m.desc',
        currency = 'rc',
        price = 250,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'cash',
        handler = 'economy',
        bankAmount = 70000,
    },
    cash_pack_l = {
        id = 'cash_pack_l',
        category = 'economy',
        labelKey = 'shop.product.cash_pack_l.label',
        descriptionKey = 'shop.product.cash_pack_l.desc',
        currency = 'rc',
        price = 500,
        enabled = true,
        repeatable = true,
        cooldown = 0,
        icon = 'cash',
        handler = 'economy',
        bankAmount = 150000,
    },

    -- ═══ VEHICLE ═══
    -- No RC vehicle products: vanity plates are already sold for cash at the
    -- tuning shop (sunset_tuning, in-transaction plate uniqueness). The
    -- category stays visible with an empty state until a product ships.
}

local function categoryOrder(categoryId)
    for _, category in ipairs(ShopCategories) do
        if category.id == categoryId then return category.order or 99 end
    end
    return 99
end

-- Returns the product definition only when it exists AND is enabled.
function ShopGetProduct(productId)
    if type(productId) ~= 'string' then return nil end
    local product = ShopProducts[productId]
    if type(product) ~= 'table' or product.enabled ~= true then return nil end
    return product
end

-- Client-safe, sorted copy of the enabled catalog (no handler internals).
function ShopPublicProducts()
    local out = {}
    for id, product in pairs(ShopProducts) do
        if product.enabled == true then
            out[#out + 1] = {
                id = id,
                category = product.category,
                labelKey = product.labelKey,
                descriptionKey = product.descriptionKey,
                currency = product.currency,
                price = product.price,
                repeatable = product.repeatable == true,
                entitlement = product.entitlement,
                icon = product.icon,
                input = product.input,
                requiresLeader = product.requiresLeader == true,
                clanAction = product.clanAction,
                slots = product.slots,
                days = product.days,
                bankAmount = product.bankAmount,
            }
        end
    end
    table.sort(out, function(a, b)
        local ca, cb = categoryOrder(a.category), categoryOrder(b.category)
        if ca ~= cb then return ca < cb end
        if a.price ~= b.price then return a.price < b.price end
        return a.id < b.id
    end)
    return out
end

-- Static catalog sanity check (run on resource start and by scripts/test-shop.js).
function ShopValidateCatalog()
    local problems = {}
    local validCategory = {}
    for _, category in ipairs(ShopCategories) do validCategory[category.id] = true end
    local validHandler = { character = true, clan = true, economy = true }
    for id, product in pairs(ShopProducts) do
        if product.id ~= id then problems[#problems + 1] = id .. ': id mismatch' end
        if not validCategory[product.category] then problems[#problems + 1] = id .. ': unknown category' end
        if not validHandler[product.handler] then problems[#problems + 1] = id .. ': unknown handler' end
        if product.currency ~= 'rc' then problems[#problems + 1] = id .. ': unsupported currency' end
        if type(product.price) ~= 'number' or product.price <= 0 or product.price ~= math.floor(product.price) then
            problems[#problems + 1] = id .. ': price must be a positive integer'
        end
        if type(product.labelKey) ~= 'string' or type(product.descriptionKey) ~= 'string' then
            problems[#problems + 1] = id .. ': missing locale keys'
        end
        if product.handler == 'economy' and (type(product.bankAmount) ~= 'number' or product.bankAmount <= 0) then
            problems[#problems + 1] = id .. ': cash pack without bankAmount'
        end
        if product.clanAction == 'slots' and type(product.slots) ~= 'number' then
            problems[#problems + 1] = id .. ': slot product without slots'
        end
        if product.clanAction == 'renew' and type(product.days) ~= 'number' then
            problems[#problems + 1] = id .. ': renewal product without days'
        end
    end
    return problems
end
