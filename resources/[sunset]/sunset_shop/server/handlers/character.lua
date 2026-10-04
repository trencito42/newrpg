-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — server/handlers/character.lua
--  char_name_change: the purchase grants ONE rename entitlement bound to the
--  buying character. The rename itself happens later through
--  ShopConsumeNameChange (callback 'sunset:shop:consumeNameChange').
--  Data access goes through ShopStore / ShopServices (wired in server/main.lua,
--  mocked in scripts/test-shop.js).
-- ═══════════════════════════════════════════════════════════════

ShopHandlers = ShopHandlers or {}

ShopHandlers.character = {
    validate = function(source, product, ctx, params)
        if not ctx.characterId then return nil, { localeKey = 'shop.purchase.not_loaded' } end
        return true
    end,

    apply = function(source, product, ctx, params, orderId)
        if product.entitlement ~= 'char_name_change' then
            return nil, { localeKey = 'shop.purchase.unknown_product' }
        end
        local entitlementId = ShopStore.createEntitlement({
            accountId = ctx.accountId,
            characterId = ctx.characterId,
            type = product.entitlement,
            orderId = orderId,
        })
        if not entitlementId then return nil, { localeKey = 'shop.purchase.failed' } end
        return {
            entitlement = product.entitlement,
            entitlementId = entitlementId,
            useNow = 'name_change',
            metadata = { entitlementId = entitlementId },
        }
    end,
}

-- Consumes one rename entitlement and renames the active character.
-- data = { nickname }. The public name is stored in characters.firstname;
-- lastname is cleared. accounts.username is not touched.
function ShopConsumeNameChange(source, data)
    if type(data) ~= 'table' then return nil, { localeKey = 'shop.name_change.invalid' } end
    local ctx = ShopServices.getContext(source)
    if type(ctx) ~= 'table' or not ctx.accountId or not ctx.characterId then
        return nil, { localeKey = 'shop.purchase.not_loaded' }
    end

    local nickname = ShopValidation.nickname(data.nickname or data.username)
    if not nickname then return nil, { localeKey = 'shop.name_change.invalid' } end
    local firstname, lastname = nickname, ''

    local entitlement = ShopStore.findOpenEntitlement({
        accountId = ctx.accountId,
        characterId = ctx.characterId,
        type = 'char_name_change',
    })
    if not entitlement then return nil, { localeKey = 'shop.name_change.no_entitlement' } end

    -- Guarded consume (UPDATE ... WHERE consumed_at IS NULL): a double submit
    -- cannot spend the same entitlement twice.
    if not ShopStore.consumeEntitlement(entitlement.id) then
        return nil, { localeKey = 'shop.name_change.no_entitlement' }
    end

    local okRename, renamed, renameErr, oldName = pcall(ShopServices.renameCharacter, source, firstname, lastname)
    if not okRename or not renamed then
        -- Give the entitlement back: the player keeps what they paid for.
        ShopStore.restoreEntitlement(entitlement.id)
        if not okRename then return nil, { localeKey = 'shop.name_change.failed' } end
        if type(renameErr) == 'table' and renameErr.localeKey then return nil, renameErr end
        return nil, { localeKey = 'shop.name_change.failed' }
    end

    ShopStore.audit('char_name_change', {
        accountId = ctx.accountId,
        characterId = ctx.characterId,
        orderId = tonumber(entitlement.order_id),
        oldName = oldName,
        newName = nickname,
        entitlementId = entitlement.id,
    })
    return { ok = true, nickname = nickname, firstname = nickname, lastname = '' }
end
