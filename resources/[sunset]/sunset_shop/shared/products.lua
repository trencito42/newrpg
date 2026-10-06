-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — shared/products.lua
--  Loads THE canonical catalog from shared/catalog.json (single source
--  for FiveM + racket.cat via scripts/sync-shop-catalog.mjs).
--
--  Visible currency: Racket Coins (RC). Internal: accounts.premium_points.
-- ═══════════════════════════════════════════════════════════════

local RESOURCE = 'sunset_shop'

local function loadCatalogRaw()
    if type(LoadResourceFile) == 'function' and type(GetCurrentResourceName) == 'function' then
        return LoadResourceFile(GetCurrentResourceName(), 'shared/catalog.json')
    end
    if type(LoadResourceFile) == 'function' then
        return LoadResourceFile(RESOURCE, 'shared/catalog.json')
    end
    return nil
end

local function decodeCatalog(raw)
    if type(raw) ~= 'string' or raw == '' then return nil end
    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then return nil end
    return decoded
end

local catalog = decodeCatalog(loadCatalogRaw())
if not catalog then
    error('[sunset_shop] failed to load shared/catalog.json')
end

ShopConfig = catalog.config or {}
ShopCategories = catalog.categories or {}
ShopProducts = catalog.products or {}

local function categoryOrder(categoryId)
    for _, category in ipairs(ShopCategories) do
        if category.id == categoryId then return category.order or 99 end
    end
    return 99
end

function ShopGetProduct(productId)
    if type(productId) ~= 'string' then return nil end
    local product = ShopProducts[productId]
    if type(product) ~= 'table' or product.enabled ~= true then return nil end
    return product
end

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
