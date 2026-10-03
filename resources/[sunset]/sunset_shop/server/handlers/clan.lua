-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — server/handlers/clan.lua
--  Clan products. sunset_clans owns the clans table, so every check and
--  mutation is delegated to its server exports (ShopServices.clanCheck /
--  ShopServices.clanApply → exports.sunset_clans:ShopCheckClanProduct /
--  ShopApplyClanProduct). Those exports verify: character loaded, clan
--  membership, LEADER rank, tier/lifecycle rules, and run guarded UPDATEs.
--
--  Only the free-form value a product needs (tag, color) is read from the
--  client; slot tiers and renewal days come from the product registry.
-- ═══════════════════════════════════════════════════════════════

ShopHandlers = ShopHandlers or {}

-- Builds the clan-side parameters for a product. Client params contribute
-- only the declared `input`; everything else is taken from the registry.
local function clanParams(product, params)
    local out = { productId = product.id }
    if product.clanAction == 'slots' then out.slots = product.slots end
    if product.clanAction == 'renew' then out.days = product.days end
    if product.input == 'tag' then
        out.tag = type(params.tag) == 'string' and params.tag:sub(1, 16) or nil
    elseif product.input == 'color' then
        local color = ShopValidation.hexColor(params.color)
        if not color then return nil, { localeKey = 'shop.clan.invalid_color' } end
        out.color = color
    end
    return out
end

ShopHandlers.clan = {
    validate = function(source, product, ctx, params)
        local clanArgs, argErr = clanParams(product, params)
        if not clanArgs then return nil, argErr end
        local ok, err = ShopServices.clanCheck(source, product.clanAction, clanArgs)
        if not ok then return nil, err or { localeKey = 'shop.clan.not_leader' } end
        return true
    end,

    apply = function(source, product, ctx, params, orderId)
        local clanArgs, argErr = clanParams(product, params)
        if not clanArgs then return nil, argErr end

        if product.clanAction == 'name' then
            -- Entitlement flow: the rename itself is chosen later (Use Now).
            local ok, err, info = ShopServices.clanCheck(source, 'name', clanArgs)
            if not ok or type(info) ~= 'table' or not info.clanId then
                return nil, err or { localeKey = 'shop.clan.not_leader' }
            end
            local entitlementId = ShopStore.createEntitlement({
                accountId = ctx.accountId,
                characterId = ctx.characterId,
                clanId = info.clanId,
                type = product.entitlement,
                orderId = orderId,
            })
            if not entitlementId then return nil, { localeKey = 'shop.purchase.failed' } end
            return {
                entitlement = product.entitlement,
                entitlementId = entitlementId,
                useNow = 'clan_name_change',
                metadata = { entitlementId = entitlementId, clanId = info.clanId },
            }
        end

        clanArgs.orderId = orderId
        local result, err = ShopServices.clanApply(source, product.clanAction, clanArgs)
        if not result then return nil, err or { localeKey = 'shop.purchase.failed' } end
        return {
            clan = result,
            metadata = { clanId = type(result) == 'table' and result.clanId or nil, action = product.clanAction },
        }
    end,
}

-- Consumes one clan rename entitlement. data = { name }.
function ShopConsumeClanNameChange(source, data)
    if type(data) ~= 'table' or type(data.name) ~= 'string' then
        return nil, { localeKey = 'shop.clan.invalid_name' }
    end
    local ctx = ShopServices.getContext(source)
    if type(ctx) ~= 'table' or not ctx.accountId or not ctx.characterId then
        return nil, { localeKey = 'shop.purchase.not_loaded' }
    end

    local clanArgs = { name = data.name:sub(1, 64) }
    local ok, err, info = ShopServices.clanCheck(source, 'name', clanArgs)
    if not ok or type(info) ~= 'table' or not info.clanId then
        return nil, err or { localeKey = 'shop.clan.not_leader' }
    end

    local entitlement = ShopStore.findOpenEntitlement({
        accountId = ctx.accountId,
        clanId = info.clanId,
        type = 'clan_name_change',
    })
    if not entitlement then return nil, { localeKey = 'shop.clan.no_entitlement' } end
    if not ShopStore.consumeEntitlement(entitlement.id) then
        return nil, { localeKey = 'shop.clan.no_entitlement' }
    end

    clanArgs.orderId = tonumber(entitlement.order_id)
    local okApply, result, applyErr = pcall(ShopServices.clanApply, source, 'name', clanArgs)
    if not okApply or not result then
        ShopStore.restoreEntitlement(entitlement.id)
        if okApply and type(applyErr) == 'table' and applyErr.localeKey then return nil, applyErr end
        return nil, { localeKey = 'shop.purchase.failed' }
    end

    ShopStore.audit('clan_name_change', {
        accountId = ctx.accountId,
        characterId = ctx.characterId,
        orderId = tonumber(entitlement.order_id),
        clanId = info.clanId,
        oldName = type(result) == 'table' and result.oldName or nil,
        newName = type(result) == 'table' and result.name or clanArgs.name,
        entitlementId = entitlement.id,
    })
    return { ok = true, name = type(result) == 'table' and result.name or clanArgs.name }
end
