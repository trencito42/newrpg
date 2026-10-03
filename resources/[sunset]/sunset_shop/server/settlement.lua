-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — server/settlement.lua
--  Atomic purchase settlement engine. Pure Lua: every side effect (database,
--  Racket Credit debit/refund, delivery) is injected through `deps`, so the
--  exact same code runs on the server and under scripts/test-shop.js.
--
--  Settlement order (failed purchases never lose currency):
--    1. product resolved from ShopProducts (client never supplies price)
--    2. request id validated; per-player cooldown + in-flight lock
--    3. character/account context loaded
--    4. idempotency: an existing request id is replayed, never re-settled
--    5. handler preflight (leader checks, tier checks, input validation)
--    6. order row inserted as 'pending' (UNIQUE request_id = hard dedupe)
--    7. RC debited with a guarded UPDATE   → 'failed' if rejected
--    8. order → 'processing'; delivery runs inside pcall
--    9. delivery failure → RC refunded     → 'refunded' ('failed' + alert if
--       the refund itself fails)
--   10. delivery success                   → 'completed'
-- ═══════════════════════════════════════════════════════════════

ShopSettlement = {}

local function errorKey(key)
    return { localeKey = key }
end

local function normalizeError(err, fallbackKey)
    if type(err) == 'table' and type(err.localeKey) == 'string' then return err end
    return errorKey(fallbackKey)
end

function ShopSettlement.create(deps)
    assert(type(deps) == 'table', 'ShopSettlement.create requires deps')
    local engine = {
        locks = {},
        lastAttempt = {},
    }

    local function log(level, message)
        if deps.log then pcall(deps.log, level, message) end
    end

    local function audit(event, data)
        if deps.audit then
            local ok, err = pcall(deps.audit, event, data)
            if not ok then log('error', ('audit %s failed: %s'):format(tostring(event), tostring(err))) end
        end
    end

    local function setStatus(orderId, status, metadata)
        local ok, err = pcall(deps.setOrderStatus, orderId, status, metadata)
        if not ok then
            log('error', ('order %s -> %s status write failed: %s'):format(tostring(orderId), tostring(status), tostring(err)))
        end
    end

    local function settle(source, productId, requestId, params)
        local product = ShopGetProduct(productId)
        if not product then return nil, errorKey('shop.purchase.unknown_product') end
        if not ShopValidation.requestId(requestId) then return nil, errorKey('shop.purchase.invalid_request') end

        local handler = deps.handlers and deps.handlers[product.handler]
        if type(handler) ~= 'table' or type(handler.apply) ~= 'function' then
            return nil, errorKey('shop.purchase.unknown_product')
        end

        local ctx = deps.getContext(source)
        if type(ctx) ~= 'table' or not ctx.accountId or not ctx.characterId then
            return nil, errorKey('shop.purchase.not_loaded')
        end

        -- Idempotency: a request id is settled at most once, ever.
        local existing = deps.findOrder(requestId)
        if existing then
            if tonumber(existing.account_id) == tonumber(ctx.accountId)
                and existing.product_id == product.id and existing.status == 'completed' then
                return { ok = true, replay = true, orderId = tonumber(existing.id), productId = product.id }
            end
            return nil, errorKey('shop.purchase.duplicate_request')
        end

        params = type(params) == 'table' and params or {}
        if type(handler.validate) == 'function' then
            local okValidate, valid, validErr = pcall(handler.validate, source, product, ctx, params)
            if not okValidate then
                log('error', ('validate %s failed: %s'):format(product.id, tostring(valid)))
                return nil, errorKey('shop.purchase.failed')
            end
            if not valid then return nil, normalizeError(validErr, 'shop.purchase.failed') end
        end

        -- Price comes from the registry ONLY.
        local price = math.floor(tonumber(product.price) or 0)
        if price <= 0 then return nil, errorKey('shop.purchase.unknown_product') end

        local okOrder, orderId = pcall(deps.createOrder, {
            requestId = requestId,
            accountId = ctx.accountId,
            characterId = ctx.characterId,
            productId = product.id,
            currency = product.currency or 'rc',
            price = price,
        })
        if not okOrder or not orderId then
            -- UNIQUE(request_id) rejected the insert: a concurrent settlement owns it.
            return nil, errorKey('shop.purchase.duplicate_request')
        end

        -- A raised error means the guarded UPDATE never committed: nothing was charged.
        local okSpend, spent, spendErr = pcall(deps.spendCredits, source, price, 'shop:' .. product.id, orderId)
        if not okSpend then
            log('error', ('debit for order %s raised: %s'):format(tostring(orderId), tostring(spent)))
            spent, spendErr = false, errorKey('shop.purchase.failed')
        end
        if not spent then
            setStatus(orderId, 'failed', { reason = 'insufficient_rc' })
            return nil, normalizeError(spendErr, 'shop.purchase.insufficient_rc')
        end
        audit('rc_debit', { accountId = ctx.accountId, characterId = ctx.characterId, orderId = orderId, amount = price, productId = product.id })
        setStatus(orderId, 'processing', nil)

        local okApply, result, applyErr = pcall(handler.apply, source, product, ctx, params, orderId)
        if not okApply or not result then
            local reason = okApply and (type(applyErr) == 'table' and applyErr.localeKey or tostring(applyErr)) or tostring(result)
            log('error', ('delivery of %s (order %s) failed: %s'):format(product.id, tostring(orderId), tostring(reason)))
            local refunded = false
            local okRefund, refundResult = pcall(deps.refundCredits, source, price, 'shop_refund:' .. product.id, orderId)
            refunded = okRefund and refundResult == true
            if refunded then
                audit('rc_refund', { accountId = ctx.accountId, characterId = ctx.characterId, orderId = orderId, amount = price, productId = product.id })
                setStatus(orderId, 'refunded', { reason = reason })
            else
                log('critical', ('REFUND FAILED order %s account %s amount %d'):format(tostring(orderId), tostring(ctx.accountId), price))
                audit('rc_refund_failed', { accountId = ctx.accountId, characterId = ctx.characterId, orderId = orderId, amount = price, productId = product.id })
                setStatus(orderId, 'failed', { reason = reason, refund = 'failed' })
            end
            if okApply then return nil, normalizeError(applyErr, 'shop.purchase.failed') end
            return nil, errorKey('shop.purchase.failed')
        end

        setStatus(orderId, 'completed', type(result) == 'table' and result.metadata or nil)
        audit('order_completed', { accountId = ctx.accountId, characterId = ctx.characterId, orderId = orderId, amount = price, productId = product.id })

        local response = type(result) == 'table' and result or {}
        response.ok = true
        response.orderId = orderId
        response.productId = product.id
        response.price = price
        response.metadata = nil
        if deps.getBalance then
            local okBalance, balance = pcall(deps.getBalance, source)
            if okBalance then response.balance = balance end
        end
        return response
    end

    -- Public entry: cooldown + per-player lock wrapped around settle(). The lock
    -- is ALWAYS released, even when settle() raises.
    function engine.purchase(source, productId, requestId, params)
        if engine.locks[source] then return nil, errorKey('shop.purchase.in_progress') end
        local now = deps.now()
        local last = engine.lastAttempt[source]
        local cooldown = (ShopConfig and ShopConfig.PurchaseCooldownMs) or 0
        if last and now - last < cooldown then return nil, errorKey('shop.purchase.too_fast') end
        engine.lastAttempt[source] = now

        engine.locks[source] = true
        local ok, result, err = pcall(settle, source, productId, requestId, params)
        engine.locks[source] = nil
        if not ok then
            log('error', ('purchase %s crashed: %s'):format(tostring(productId), tostring(result)))
            return nil, errorKey('shop.purchase.failed')
        end
        return result, err
    end

    function engine.release(source)
        engine.locks[source] = nil
        engine.lastAttempt[source] = nil
    end

    return engine
end
