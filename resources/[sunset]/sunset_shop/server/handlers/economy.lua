-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — server/handlers/economy.lua
--  Cash packs: RC → bank dollars. The bank credit goes through the core money
--  API (exports.sunset_core:AddMoney → guarded UPDATE + money_transactions
--  ledger row). If the credit fails, apply() returns nil and the settlement
--  engine refunds the debited RC in full.
-- ═══════════════════════════════════════════════════════════════

ShopHandlers = ShopHandlers or {}

ShopHandlers.economy = {
    validate = function(source, product, ctx, params)
        local amount = math.floor(tonumber(product.bankAmount) or 0)
        if amount <= 0 then return nil, { localeKey = 'shop.purchase.unknown_product' } end
        return true
    end,

    apply = function(source, product, ctx, params, orderId)
        local amount = math.floor(tonumber(product.bankAmount) or 0)
        if amount <= 0 then return nil, { localeKey = 'shop.purchase.unknown_product' } end
        local credited = ShopServices.creditBank(source, amount, ('shop_order:%s'):format(tostring(orderId)))
        if not credited then return nil, { localeKey = 'shop.purchase.failed' } end
        return {
            bankAmount = amount,
            metadata = { bankAmount = amount },
        }
    end,
}
