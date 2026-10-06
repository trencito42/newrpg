#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Racket Shop / clan lifecycle / business cap / standard_tank regression suite.
//
//  Behavioural tests execute the REAL Lua modules (sunset_shop products,
//  validation, settlement engine, handlers and sunset_clans/server/shop_ops.lua)
//  through scripts/lib/mini-lua.js with in-memory mocks for oxmysql, the core
//  Racket Credit API and FiveM natives. Paths that need a live database
//  transaction (business purchase, trade settlement) are locked statically.
//
//  This suite does NOT replace runtime FiveM verification (see
//  docs/release/RELEASE_GATE.md, Racket Shop runtime checklist).
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const { LuaVM, LuaTable, toLua, toJs, luaFn, multi } = require('./lib/mini-lua');

const root = path.resolve(__dirname, '..');
const res = (p) => path.join(root, 'resources', '[sunset]', p);
const read = (p) => fs.readFileSync(p, 'utf8');

let passed = 0;
let failed = 0;
let section = '';
function check(condition, name) {
    if (condition) { passed++; console.log(`  \x1b[32mPASS\x1b[0m ${name}`); }
    else { failed++; console.error(`  \x1b[31mFAIL\x1b[0m [${section}] ${name}`); }
}
function group(name) { section = name; console.log(`\n[${name}]`); }
const keyOf = (err) => (err instanceof LuaTable ? err.get('localeKey') : (err && err.localeKey));

// ── locale catalogs ───────────────────────────────────────────────────
function luaLocale(file) {
    const map = new Map();
    for (const m of read(file).matchAll(/\[\s*(['"])([^'"\r\n]+)\1\s*\]\s*=/g)) map.set(m[2], true);
    return map;
}
const gameEn = luaLocale(res('sunset_core/shared/locales/en.lua'));
const gameRo = luaLocale(res('sunset_core/shared/locales/ro.lua'));
const genSrc = read(res('sunset_ui/web/js/i18n.generated.js'));
const generated = JSON.parse(genSrc.slice(genSrc.indexOf('{'), genSrc.lastIndexOf('}') + 1));
const nuiDictSrc = read(res('sunset_ui/web/js/i18n.js'));
const nuiHas = (lang, key) => Object.prototype.hasOwnProperty.call(generated[lang], key) || nuiDictSrc.includes(`'${key}'`);

// ── shop VM ───────────────────────────────────────────────────────────
function createShopEnv(opts = {}) {
    const vm = new LuaVM();
    let clock = 100000;
    const state = {
        balances: new Map([[1, 10000], [2, 10000], [3, 10000]]),
        bank: new Map([[1, 0], [2, 0], [3, 0]]),
        contexts: new Map([[1, { accountId: 11, characterId: 101 }], [2, { accountId: 12, characterId: 102 }], [3, { accountId: 13, characterId: 103 }]]),
        orders: [],
        entitlements: [],
        audit: [],
        logs: [],
        renames: [],
        failCredit: false,
        throwCredit: false,
        failRefund: false,
        failRename: false,
        failRenameKey: null,
        throwAfterCommit: false,
        publicName: undefined,
        taken: new Set(),
        oldName: 'Old Name',
        onCredit: null,
    };

    const ordersByRequest = () => new Map(state.orders.map((o) => [o.requestId, o]));

    vm.setGlobal('ShopStore', toLua({
        createEntitlement: luaFn((entry) => {
            const e = toJs(entry);
            const id = state.entitlements.length + 1;
            state.entitlements.push({ id, account_id: e.accountId, character_id: e.characterId, clan_id: e.clanId, type: e.type, order_id: e.orderId, consumed: false });
            return id;
        }),
        findOpenEntitlement: luaFn((filter) => {
            const f = toJs(filter);
            const row = state.entitlements.find((e) => !e.consumed && e.type === f.type && e.account_id === f.accountId
                && (f.clanId ? e.clan_id === f.clanId : e.character_id === f.characterId));
            return row ? { id: row.id, order_id: row.order_id } : undefined;
        }),
        consumeEntitlement: luaFn((id) => {
            const row = state.entitlements.find((e) => e.id === id && !e.consumed);
            if (!row) return false;
            row.consumed = true;
            return true;
        }),
        restoreEntitlement: luaFn((id) => {
            const row = state.entitlements.find((e) => e.id === id);
            if (!row) return false;
            row.consumed = false;
            return true;
        }),
        audit: luaFn((event, data) => { state.audit.push({ event, data: toJs(data) }); }),
    }));

    const services = {
        getContext: luaFn((src) => state.contexts.get(src)),
        renameCharacter: luaFn((src, first, last) => {
            if (state.failRename) return multi(false, { localeKey: state.failRenameKey || 'shop.name_change.database' });
            state.publicName = first;
            state.renames.push({ src, first, last });
            if (state.throwAfterCommit) throw new Error('refresh failed');
            return multi(true, undefined, state.oldName || 'Old Name');
        }),
        publicName: luaFn(() => state.publicName),
        nicknameTaken: luaFn((nick) => !!(state.taken && state.taken.has(String(nick).toLowerCase()))),
        creditBank: luaFn((src, amount) => {
            if (state.onCredit) state.onCredit(src, amount);
            if (state.throwCredit) throw new Error('bank db down');
            if (state.failCredit) return false;
            state.bank.set(src, (state.bank.get(src) || 0) + amount);
            return true;
        }),
        clanCheck: luaFn(() => multi(false, { localeKey: 'shop.unavailable' })),
        clanApply: luaFn(() => multi(undefined, { localeKey: 'shop.unavailable' })),
    };
    vm.setGlobal('ShopServices', toLua(services));

    const catalogRaw = read(res('sunset_shop/shared/catalog.json'));
    vm.setGlobal('json', toLua({
        decode: luaFn((raw) => JSON.parse(String(toJs(raw) || ''))),
    }));
    vm.setGlobal('GetCurrentResourceName', luaFn(() => 'sunset_shop'));
    vm.setGlobal('LoadResourceFile', luaFn((resourceName, filePath) => {
        if (String(toJs(resourceName)) === 'sunset_shop' && String(toJs(filePath)) === 'shared/catalog.json') {
            return catalogRaw;
        }
        return '';
    }));

    for (const file of ['sunset_shop/shared/products.lua', 'sunset_shop/shared/validation.lua', 'sunset_shop/server/settlement.lua',
        'sunset_shop/server/handlers/character.lua', 'sunset_shop/server/handlers/clan.lua', 'sunset_shop/server/handlers/economy.lua']) {
        vm.run(read(res(file)), file);
    }

    const deps = toLua({
        now: luaFn(() => clock),
        log: luaFn((level, message) => { state.logs.push({ level, message }); }),
        handlers: vm.getGlobal('ShopHandlers'),
        getContext: luaFn((src) => state.contexts.get(src)),
        findOrder: luaFn((requestId) => {
            const o = ordersByRequest().get(requestId);
            return o ? { id: o.id, account_id: o.accountId, product_id: o.productId, status: o.status } : undefined;
        }),
        createOrder: luaFn((order) => {
            const o = toJs(order);
            if (ordersByRequest().has(o.requestId)) throw new Error("Duplicate entry for key 'idx_request_id'");
            const id = state.orders.length + 1;
            state.orders.push({ ...o, id, status: 'pending', metadata: null });
            return id;
        }),
        setOrderStatus: luaFn((orderId, status, metadata) => {
            const o = state.orders.find((x) => x.id === orderId);
            o.status = status;
            if (metadata !== undefined) o.metadata = toJs(metadata);
        }),
        spendCredits: luaFn((src, amount) => {
            const bal = state.balances.get(src) || 0;
            if (bal < amount) return multi(false, { localeKey: 'shop.purchase.insufficient_rc' });
            state.balances.set(src, bal - amount);
            return true;
        }),
        refundCredits: luaFn((src, amount) => {
            if (state.failRefund) return false;
            state.balances.set(src, (state.balances.get(src) || 0) + amount);
            return true;
        }),
        getBalance: luaFn((src) => state.balances.get(src) || 0),
        audit: luaFn((event, data) => { state.audit.push({ event, data: toJs(data) }); }),
    });
    const create = vm.getGlobal('ShopSettlement').get('create');
    const engine = create(deps)[0];
    const purchaseFn = engine.get('purchase');
    let seq = 0;
    const env = {
        vm, state, services,
        advance(ms = 5000) { clock += ms; },
        rid() { seq++; return `test-req-${String(seq).padStart(6, '0')}`; },
        purchase(src, productId, requestId, params) {
            const r = purchaseFn(src, productId, requestId, toLua(params || {}));
            clock += 5000; // step past the per-player cooldown between test purchases
            return { result: r[0], err: r[1], key: keyOf(r[1]), js: toJs(r[0]) };
        },
        purchaseRaw(src, productId, requestId, params) {
            const r = purchaseFn(src, productId, requestId, toLua(params || {}));
            return { result: r[0], err: r[1], key: keyOf(r[1]), js: toJs(r[0]) };
        },
        call(name, ...args) {
            const r = vm.getGlobal(name)(...args.map(toLua));
            return { result: r[0], err: r[1], key: keyOf(r[1]), js: toJs(r[0]) };
        },
        products: () => toJs(vm.getGlobal('ShopProducts')),
    };
    if (opts.clan) attachClanOps(env, opts.clan);
    return env;
}

// ── clans VM (real server/shop_ops.lua) ───────────────────────────────
function attachClanOps(env, setup) {
    const vm = new LuaVM();
    const db = {
        clans: new Map(setup.clans.map((c) => [c.id, { ...c }])),
        members: new Map(setup.members.map((m) => [m.cid, { ...m }])),
        failUpdate: false,
        staleRow: null,
        hookLog: [],
        events: [],
    };
    const membershipRow = (cid) => {
        const m = db.members.get(cid);
        if (!m) return undefined;
        const c = db.clans.get(m.clan_id);
        if (!c) return undefined;
        const row = {
            clan_id: c.id, character_id: cid, rank: m.rank, name: c.name, tag: c.tag, tag_color: c.tag_color,
            owner_character_id: c.owner, max_members: c.max_members, status: c.status, expires_at: c.expires,
        };
        return db.staleRow ? { ...row, ...db.staleRow } : row;
    };

    const exportsTable = new LuaTable();
    const registered = {};
    const meta = new LuaTable();
    meta.set('__call', (self, name, fn) => { registered[name] = fn; return []; });
    exportsTable.metatable = meta;
    exportsTable.set('sunset_core', toLua({
        GetCharacter: luaFn((self, src) => {
            const ctx = env.state.contexts.get(src);
            return ctx ? { id: ctx.characterId } : undefined;
        }),
    }));
    vm.setGlobal('exports', exportsTable);
    vm.setGlobal('TriggerEvent', luaFn((...args) => { db.events.push(args); }));
    vm.setGlobal('ClanDisplay', toLua({ getMembership: luaFn((cid) => membershipRow(cid)) }));
    vm.setGlobal('ClanShopHooks', toLua({
        audit: luaFn((clanId, cid, action, details) => { db.hookLog.push({ type: 'audit', clanId, action, details: toJs(details) }); }),
        broadcast: luaFn((clanId, src, msg) => { db.hookLog.push({ type: 'broadcast', clanId, msg: toJs(msg) }); }),
        syncMembers: luaFn((clanId) => { db.hookLog.push({ type: 'sync', clanId }); }),
    }));
    vm.setGlobal('MySQL', toLua({
        scalar: { await: luaFn((sql, args) => {
            const a = toJs(args);
            const field = /LOWER\(name\)/.test(sql) ? 'name' : /LOWER\(tag\)/.test(sql) ? 'tag' : null;
            if (!field) throw new Error('unexpected scalar ' + sql);
            for (const c of db.clans.values()) if (c.id !== a[1] && String(c[field]).toLowerCase() === String(a[0]).toLowerCase()) return c.id;
            return undefined;
        }) },
        update: { await: luaFn((sql, args) => {
            if (db.failUpdate) throw new Error('Deadlock found when trying to get lock');
            const a = toJs(args);
            if (/SET name = \?/.test(sql)) { db.clans.get(a[1]).name = a[0]; return 1; }
            if (/SET tag = \?/.test(sql)) { db.clans.get(a[1]).tag = a[0]; return 1; }
            if (/SET tag_color = \?/.test(sql)) { db.clans.get(a[1]).tag_color = a[0]; return 1; }
            if (/SET max_members = \?/.test(sql)) {
                const c = db.clans.get(a[1]);
                if (!(c.max_members < a[2])) return 0;
                c.max_members = a[0];
                return 1;
            }
            if (/SET expires_at = DATE_ADD\(GREATEST\(COALESCE\(expires_at, NOW\(\)\), NOW\(\)\)/.test(sql)) {
                const c = db.clans.get(a[1]);
                if (!/status IN \('active', 'grace'\)/.test(sql) || !['active', 'grace'].includes(c.status)) return 0;
                c.expires = Math.max(c.expires === undefined ? 0 : c.expires, 0) + a[0];
                c.status = 'active';
                return 1;
            }
            throw new Error('unexpected update ' + sql);
        }) },
    }));
    for (const file of ['sunset_clans/shared/config.lua', 'sunset_clans/shared/ranks.lua', 'sunset_clans/shared/validation.lua', 'sunset_clans/server/shop_ops.lua']) {
        vm.run(read(res(file)), file);
    }
    const ops = vm.getGlobal('ClanShopOps');
    const services = env.vm.getGlobal('ShopServices');
    services.set('clanCheck', (src, action, params) => ops.get('check')(src, action, params));
    services.set('clanApply', (src, action, params) => ops.get('apply')(src, action, params));
    env.clanDb = db;
    env.clanExports = registered;
    return env;
}

// ═══ 1. Catalog ═══════════════════════════════════════════════════════
group('catalog');
{
    const env = createShopEnv();
    const problems = toJs(env.vm.getGlobal('ShopValidateCatalog')()[0]);
    check(Array.isArray(problems) ? problems.length === 0 : Object.keys(problems || {}).length === 0, 'ShopValidateCatalog reports no problems');
    const expected = {
        char_name_change: 500, clan_name_change: 300, clan_tag_change: 200, clan_color_change: 150,
        clan_slots_50: 2500, clan_slots_75: 5000,
        clan_renew_7: 100, clan_renew_30: 350, clan_renew_90: 900,
        cash_pack_s: 100, cash_pack_m: 250, cash_pack_l: 500,
    };
    const products = env.products();
    for (const [id, price] of Object.entries(expected)) {
        check(products[id] && products[id].price === price && products[id].currency === 'rc', `${id} costs ${price} RC`);
    }
    check(products.cash_pack_s.bankAmount === 25000 && products.cash_pack_m.bankAmount === 70000 && products.cash_pack_l.bankAmount === 150000,
        'cash packs grant $25k / $70k / $150k');
    let missing = [];
    for (const p of Object.values(products)) {
        for (const key of [p.labelKey, p.descriptionKey]) {
            if (!gameEn.has(key) || !gameRo.has(key)) missing.push(`game:${key}`);
            if (!nuiHas('en', key) || !nuiHas('ro', key)) missing.push(`nui:${key}`);
        }
    }
    check(missing.length === 0, `every product label/description exists in EN+RO game and NUI catalogs ${missing.slice(0, 4).join(' ')}`);
    const pub = toJs(env.vm.getGlobal('ShopPublicProducts')()[0]);
    check(pub.length === Object.keys(expected).length && pub.every((p) => !('handler' in p)), 'public catalog lists enabled products without handler internals');
}

// ═══ 2. Settlement engine ═════════════════════════════════════════════
group('settlement');
{
    const env = createShopEnv();
    const { state } = env;

    let r = env.purchase(1, 'definitely_not_a_product', env.rid());
    check(!r.result && r.key === 'shop.purchase.unknown_product', 'unknown product rejected');
    check(state.orders.length === 0 && state.balances.get(1) === 10000, 'unknown product creates no order and charges nothing');

    env.vm.getGlobal('ShopProducts').get('cash_pack_s').set('enabled', false);
    r = env.purchase(1, 'cash_pack_s', env.rid());
    check(!r.result && r.key === 'shop.purchase.unknown_product', 'disabled product rejected');
    env.vm.getGlobal('ShopProducts').get('cash_pack_s').set('enabled', true);

    r = env.purchase(1, 'cash_pack_s', 'bad id!');
    check(!r.result && r.key === 'shop.purchase.invalid_request', 'malformed requestId rejected');

    r = env.purchase(9, 'cash_pack_s', env.rid());
    check(!r.result && r.key === 'shop.purchase.not_loaded', 'player without loaded character rejected');

    // Client-supplied price/amount must be ignored.
    const before = state.balances.get(1);
    r = env.purchase(1, 'cash_pack_s', env.rid(), { price: 1, bankAmount: 999999999, amount: 999999999 });
    check(r.result && r.js.ok === true, 'cash pack purchase succeeds');
    check(state.balances.get(1) === before - 100, 'server debits registry price (100 RC), not the client price');
    check(state.bank.get(1) === 25000, 'server credits registry reward ($25,000), not the client amount');
    const order = state.orders[state.orders.length - 1];
    check(order.price === 100 && order.productId === 'cash_pack_s' && order.accountId === 11 && order.characterId === 101,
        'order ledger stores server price, product, account and character');
    check(order.status === 'completed', 'order ledger records completion');
    check(state.audit.some((a) => a.event === 'rc_debit' && a.data.amount === 100 && a.data.orderId === order.id), 'RC debit is audit-logged with the order id');

    // Idempotency
    const rid = env.rid();
    r = env.purchase(1, 'cash_pack_m', rid);
    const balAfterFirst = state.balances.get(1);
    const bankAfterFirst = state.bank.get(1);
    check(r.result && bankAfterFirst === 25000 + 70000, 'medium cash pack grants $70,000');
    r = env.purchase(1, 'cash_pack_m', rid);
    check(r.result && r.js.replay === true, 'same requestId replays the completed order');
    check(state.balances.get(1) === balAfterFirst && state.bank.get(1) === bankAfterFirst, 'same requestId cannot settle twice (no second debit/credit)');
    r = env.purchase(1, 'cash_pack_l', rid);
    check(!r.result && r.key === 'shop.purchase.duplicate_request', 'reusing a requestId for another product is rejected');
    r = env.purchase(2, 'cash_pack_m', rid);
    check(!r.result && r.key === 'shop.purchase.duplicate_request', "another account cannot replay someone else's requestId");

    r = env.purchase(1, 'cash_pack_l', env.rid());
    check(r.result && state.bank.get(1) === 25000 + 70000 + 150000, 'large cash pack grants $150,000');

    // Insufficient RC
    state.balances.set(3, 50);
    r = env.purchase(3, 'cash_pack_s', env.rid());
    check(!r.result && r.key === 'shop.purchase.insufficient_rc', 'insufficient RC rejected');
    check(state.balances.get(3) === 50 && state.bank.get(3) === 0, 'insufficient RC leaves balance and bank untouched');
    const failedOrder = state.orders[state.orders.length - 1];
    check(failedOrder.status === 'failed' && failedOrder.metadata && failedOrder.metadata.reason === 'insufficient_rc',
        'failed settlement recorded as failed with reason');

    // Cooldown
    state.balances.set(2, 10000);
    env.purchaseRaw(2, 'cash_pack_s', env.rid());
    r = env.purchaseRaw(2, 'cash_pack_s', env.rid());
    check(!r.result && r.key === 'shop.purchase.too_fast', 'per-player purchase cooldown enforced');
    env.advance();

    // Simultaneous duplicate purchase (re-entrancy while the first is mid-delivery)
    let inner = null;
    let innerOther = null;
    const ridDup = env.rid();
    state.onCredit = (src) => {
        state.onCredit = null;
        env.advance();
        inner = env.purchaseRaw(src, 'cash_pack_s', env.rid());
        innerOther = env.purchaseRaw(3, 'cash_pack_s', ridDup);
    };
    const bal2 = state.balances.get(2);
    r = env.purchase(2, 'cash_pack_s', ridDup);
    check(r.result && inner && !inner.result && inner.key === 'shop.purchase.in_progress', 'second purchase while one is settling is refused (per-player lock)');
    check(innerOther && !innerOther.result && innerOther.key === 'shop.purchase.duplicate_request', 'concurrent settlement of the same requestId is refused');
    check(state.balances.get(2) === bal2 - 100, 'only one debit happened for the concurrent attempt');

    // Delivery failure → refund
    state.failCredit = true;
    const balBefore = state.balances.get(2);
    const bankBefore = state.bank.get(2);
    r = env.purchase(2, 'cash_pack_m', env.rid());
    state.failCredit = false;
    check(!r.result && r.key === 'shop.purchase.failed', 'cash-pack delivery failure returns purchase failed');
    check(state.balances.get(2) === balBefore && state.bank.get(2) === bankBefore, 'cash-pack failure refunds RC in full and grants nothing');
    const refunded = state.orders[state.orders.length - 1];
    check(refunded.status === 'refunded', 'refunded settlement recorded as refunded');
    check(state.audit.some((a) => a.event === 'rc_refund' && a.data.orderId === refunded.id && a.data.amount === 250), 'RC refund is audit-logged');

    state.throwCredit = true;
    r = env.purchase(2, 'cash_pack_s', env.rid());
    state.throwCredit = false;
    check(!r.result && state.balances.get(2) === balBefore && state.orders[state.orders.length - 1].status === 'refunded',
        'delivery that raises an error is refunded too');

    state.failCredit = true;
    state.failRefund = true;
    r = env.purchase(2, 'cash_pack_s', env.rid());
    state.failCredit = false;
    state.failRefund = false;
    const lost = state.orders[state.orders.length - 1];
    check(!r.result && lost.status === 'failed' && lost.metadata && lost.metadata.refund === 'failed', 'refund failure is recorded on the order');
    check(state.logs.some((l) => l.level === 'critical') && state.audit.some((a) => a.event === 'rc_refund_failed'), 'refund failure raises a critical log + audit row');

    // Lock always released, even after errors.
    r = env.purchase(2, 'cash_pack_s', env.rid());
    check(r.result && r.js.ok === true, 'per-player lock is released after failures');
}

// ═══ 3. Character rename ══════════════════════════════════════════════
group('character');
{
    const env = createShopEnv();
    const { state } = env;
    let r = env.call('ShopConsumeNameChange', 1, { nickname: 'trencito' });
    check(!r.result && r.key === 'shop.name_change.no_entitlement', 'rename without entitlement is rejected');
    check(state.renames.length === 0, 'no rename happens without entitlement');

    r = env.purchase(1, 'char_name_change', env.rid());
    check(r.result && r.js.useNow === 'name_change' && state.balances.get(1) === 9500, 'name change purchase debits 500 RC and offers Use Now');
    check(state.entitlements.length === 1 && state.entitlements[0].character_id === 101 && state.entitlements[0].type === 'char_name_change',
        'purchase grants one entitlement bound to the buying character');
    r = env.call('ShopConsumeNameChange', 2, { nickname: 'trencito' });
    check(!r.result && r.key === 'shop.name_change.no_entitlement', "another character cannot use someone else's entitlement");

    const invalid = ['ab', '1abc', 'John  Paul', 'A'.repeat(25), '-john', 'jo<hn', '', 'John Smith!', 'Mary-Jane', 'ren_k'];
    let allRejected = true;
    for (const nickname of invalid) {
        r = env.call('ShopConsumeNameChange', 1, { nickname });
        if (r.result || r.key !== 'shop.name_change.invalid') { allRejected = false; console.error('    accepted:', JSON.stringify(nickname)); }
    }
    r = env.call('ShopConsumeNameChange', 1, { firstname: 'John', lastname: 'Smith' });
    if (r.result || r.key !== 'shop.name_change.invalid') allRejected = false;
    check(allRejected, `invalid nicknames rejected (${invalid.length + 1} cases)`);
    check(state.entitlements[0].consumed === false, 'invalid names do not consume the entitlement');

    state.publicName = 'Renk';
    r = env.call('ShopConsumeNameChange', 1, { nickname: 'renk' });
    state.publicName = undefined;
    check(!r.result && r.key === 'shop.name_change.same', 'same nickname is rejected before the entitlement is spent');
    check(state.entitlements[0].consumed === false && state.renames.length === 0, 'same nickname does not call the rename writer');

    state.taken.add('renk');
    r = env.call('ShopConsumeNameChange', 1, { nickname: 'Renk' });
    state.taken.delete('renk');
    check(!r.result && r.key === 'shop.name_change.taken', 'duplicate nickname is rejected');
    check(state.entitlements[0].consumed === false, 'duplicate nickname does not consume the entitlement');

    state.failRename = true;
    r = env.call('ShopConsumeNameChange', 1, { nickname: 'trencito' });
    state.failRename = false;
    check(!r.result && r.key === 'shop.name_change.database' && state.entitlements[0].consumed === false, 'database failure restores the entitlement and keeps its own message');

    r = env.call('ShopConsumeNameChange', 1, { nickname: '  renk  ' });
    check(r.result && r.js.nickname === 'renk' && r.js.firstname === 'renk' && r.js.lastname === '', 'JS payload { nickname: renk } renames firstname and clears lastname');
    check(state.renames.length === 1 && state.renames[0].first === 'renk' && state.renames[0].last === '', 'server receives the trimmed nickname');
    check(state.entitlements[0].consumed === true, 'successful rename consumes the entitlement exactly once');
    const second = env.call('ShopConsumeNameChange', 1, { nickname: 'renk2' });
    check(!second.result && second.key === 'shop.name_change.no_entitlement' && state.renames.length === 1, 'double click cannot rename twice');

    state.entitlements[0].consumed = false;
    state.throwAfterCommit = true;
    r = env.call('ShopConsumeNameChange', 1, { nickname: 'after' });
    state.throwAfterCommit = false;
    check(r.result && r.js.ok === true && state.entitlements[0].consumed === true, 'a refresh failure after the database write does not restore the entitlement');
    const auditRow = state.audit.find((a) => a.event === 'char_name_change');
    check(auditRow && auditRow.data.oldName === 'Old Name' && auditRow.data.newName === 'renk'
        && auditRow.data.characterId === 101 && auditRow.data.accountId === 11 && auditRow.data.orderId === state.entitlements[0].order_id,
        'rename audit records old/new name, character, account and order');
    r = env.call('ShopConsumeNameChange', 1, { nickname: 'again' });
    check(!r.result && r.key === 'shop.name_change.no_entitlement', 'an entitlement can only be used once');
}

// ═══ 4. Clan products (real sunset_clans/server/shop_ops.lua) ══════════
group('clans');
{
    const env = createShopEnv({
        clan: {
            clans: [
                { id: 1, name: 'Night Owls', tag: 'OWL', tag_color: '#FF8C00', owner: 101, max_members: 25, status: 'active', expires: 5 },
                { id: 2, name: 'Grace Gang', tag: 'GRC', tag_color: '#FFFFFF', owner: 103, max_members: 25, status: 'grace', expires: -3 },
            ],
            members: [
                { cid: 101, clan_id: 1, rank: 7 },
                { cid: 102, clan_id: 1, rank: 1 },
                { cid: 103, clan_id: 2, rank: 7 },
            ],
        },
    });
    const { state, clanDb } = env;
    check(typeof env.clanExports.ShopCheckClanProduct === 'function' && typeof env.clanExports.ShopApplyClanProduct === 'function',
        'sunset_clans registers ShopCheckClanProduct / ShopApplyClanProduct exports');

    let r = env.purchase(2, 'clan_renew_7', env.rid());
    check(!r.result && r.key === 'shop.clan.not_leader', 'non-leader cannot buy clan products');
    check(state.balances.get(2) === 10000 && state.orders.length === 0, 'non-leader rejection charges nothing and creates no order');
    state.contexts.set(4, { accountId: 14, characterId: 104 });
    state.balances.set(4, 10000);
    r = env.purchase(4, 'clan_slots_50', env.rid());
    check(!r.result && r.key === 'clans.message.you_are_not_in_a_clan', 'player without a clan cannot buy clan products');

    // Slots: 25 base, then 50, then 75. Skipping 50 is rejected.
    const balSkip = state.balances.get(1);
    r = env.purchase(1, 'clan_slots_75', env.rid());
    check(!r.result && r.key === 'clans.message.clan_slot_upgrade_must_be_sequential' && state.balances.get(1) === balSkip && clanDb.clans.get(1).max_members === 25,
        '25 cannot jump to 75 and is not charged');
    r = env.purchase(1, 'clan_slots_50', env.rid());
    check(r.result && clanDb.clans.get(1).max_members === 50 && state.balances.get(1) === balSkip - 2500, 'slot upgrade 25 to 50 applied for 2500 RC');
    r = env.purchase(1, 'clan_slots_50', env.rid());
    check(!r.result && r.key === 'shop.purchase.already_owned' && state.balances.get(1) === balSkip - 2500, 'buying the current tier again is rejected before charging');
    r = env.purchase(1, 'clan_slots_75', env.rid());
    check(r.result && clanDb.clans.get(1).max_members === 75 && state.balances.get(1) === balSkip - 7500, 'slot upgrade 50 to 75 applied for 5000 RC');
    r = env.purchase(1, 'clan_slots_50', env.rid());
    check(!r.result && r.key === 'shop.purchase.already_owned' && clanDb.clans.get(1).max_members === 75, 'lower tier never downgrades capacity');

    // Concurrent upgrade: stale membership read, DB already raised by a parallel upgrade.
    clanDb.clans.get(1).max_members = 25;
    clanDb.staleRow = null;
    let reentrant = null;
    const origApply = env.vm.getGlobal('ShopServices').get('clanApply');
    env.vm.getGlobal('ShopServices').set('clanApply', (...args) => {
        env.advance();
        reentrant = env.purchaseRaw(1, 'clan_slots_75', env.rid());
        clanDb.staleRow = { max_members: 25 };
        clanDb.clans.get(1).max_members = 50; // parallel path upgraded first
        return origApply(...args);
    });
    const balBeforeRace = state.balances.get(1);
    r = env.purchase(1, 'clan_slots_50', env.rid());
    env.vm.getGlobal('ShopServices').set('clanApply', origApply);
    clanDb.staleRow = null;
    check(reentrant && reentrant.key === 'shop.purchase.in_progress', 'concurrent clan upgrade by the same player is locked out');
    check(!r.result && clanDb.clans.get(1).max_members === 50 && state.balances.get(1) === balBeforeRace,
        'guarded UPDATE (max_members < target) prevents a stale upgrade and the RC is refunded');
    check(state.orders[state.orders.length - 1].status === 'refunded', 'stale clan upgrade is recorded as refunded');

    // Renewal
    r = env.purchase(1, 'clan_renew_30', env.rid());
    check(r.result && clanDb.clans.get(1).expires === 35 && clanDb.clans.get(1).status === 'active', 'active clan renewal extends from current expiry (+30 days)');
    r = env.purchase(3, 'clan_renew_7', env.rid());
    check(r.result && clanDb.clans.get(2).expires === 7 && clanDb.clans.get(2).status === 'active' && r.js.clan.restored === true,
        'clan in grace is restored to active, renewed from now');
    clanDb.clans.get(2).status = 'expired';
    const bal3 = state.balances.get(3);
    r = env.purchase(3, 'clan_renew_90', env.rid());
    check(!r.result && r.key === 'clans.err.clan_is_expired' && state.balances.get(3) === bal3, 'expired clan cannot be renewed and is not charged');
    clanDb.clans.get(2).status = 'active';

    // Failed mutation → refund
    clanDb.failUpdate = true;
    const balFail = state.balances.get(1);
    r = env.purchase(1, 'clan_renew_7', env.rid());
    clanDb.failUpdate = false;
    check(!r.result && state.balances.get(1) === balFail && state.orders[state.orders.length - 1].status === 'refunded',
        'failed clan DB mutation refunds RC and records the order as refunded');

    // Tag
    r = env.purchase(1, 'clan_tag_change', env.rid(), { tag: 'x!' });
    check(!r.result && /clan_tag_must_be/.test(r.key) && state.balances.get(1) === balFail, 'invalid tag rejected before charging');
    r = env.purchase(1, 'clan_tag_change', env.rid(), { tag: 'grc' });
    check(!r.result && r.key === 'clans.message.that_clan_tag_is_already_taken', 'taken tag rejected (case-insensitive)');
    r = env.purchase(1, 'clan_tag_change', env.rid(), { tag: 'NOX' });
    check(r.result && clanDb.clans.get(1).tag === 'NOX' && state.balances.get(1) === balFail - 200, 'valid tag change applied for 200 RC');
    check(clanDb.hookLog.some((h) => h.type === 'broadcast' && h.msg.localeKey === 'shop.clan.broadcast_tag')
        && clanDb.hookLog.some((h) => h.type === 'sync' && h.clanId === 1), 'tag change notifies and re-syncs online members');

    // Color
    for (const bad of ['#GGGGGG', 'red', '#12345', '123456', '#1234567', undefined]) {
        r = env.purchase(1, 'clan_color_change', env.rid(), { color: bad });
        if (r.result || r.key !== 'shop.clan.invalid_color') check(false, `invalid color ${bad} rejected`);
    }
    check(clanDb.clans.get(1).tag_color === '#FF8C00', 'invalid hex colors rejected server-side');
    r = env.purchase(1, 'clan_color_change', env.rid(), { color: '#a1b2c3' });
    check(r.result && clanDb.clans.get(1).tag_color === '#A1B2C3', 'valid hex color stored upper-case');

    // Clan rename entitlement
    r = env.purchase(1, 'clan_name_change', env.rid());
    check(r.result && r.js.useNow === 'clan_name_change' && state.entitlements.some((e) => e.type === 'clan_name_change' && e.clan_id === 1),
        'clan name change grants an entitlement bound to the clan');
    r = env.call('ShopConsumeClanNameChange', 1, { name: 'grace gang' });
    check(!r.result && r.key === 'clans.message.that_clan_name_or_tag_is_already_taken'
        && state.entitlements.find((e) => e.type === 'clan_name_change').consumed === false, 'taken clan name rejected, entitlement kept');
    r = env.call('ShopConsumeClanNameChange', 2, { name: 'Member Coup' });
    check(!r.result && r.key === 'shop.clan.not_leader', 'non-leader cannot use the clan rename entitlement');
    r = env.call('ShopConsumeClanNameChange', 1, { name: 'Night Hawks' });
    check(r.result && clanDb.clans.get(1).name === 'Night Hawks' && state.entitlements.find((e) => e.type === 'clan_name_change').consumed === true,
        'clan rename applied and entitlement consumed');
    check(state.audit.some((a) => a.event === 'clan_name_change' && a.data.oldName === 'Night Owls' && a.data.newName === 'Night Hawks'), 'clan rename audited');
}

// ═══ 5. Clan panel paths + lifecycle migration (static) ════════════════
group('clan lifecycle (static)');
{
    const clans = read(res('sunset_clans/server/main.lua'));
    const config = read(res('sunset_clans/shared/config.lua'));
    check(/local ClansRenewLocks = \{\}/.test(clans) && /local ClansSlotLocks = \{\}/.test(clans), 'clan panel renewal/slot locks exist');
    check(/runLocked\(ClansRenewLocks, source, 'extendLifetime'/.test(clans) && /runLocked\(ClansSlotLocks, source, 'upgradeSlots'/.test(clans),
        'extendLifetime and upgradeSlots run under per-player locks');
    check(/locks\[source\] = true\s+local ok, res, err = pcall\(fn\)\s+locks\[source\] = nil/.test(clans), 'lock is always released (pcall-wrapped)');
    check(/refundCash\(source, cost, 'clan_extend_lifetime_refund'\)/.test(clans) && /refundCash\(source, cost, 'clan_upgrade_slots_refund'\)/.test(clans),
        'cash renewal/slot failures refund the payment');
    check(/max_members = \? WHERE id = \? AND max_members < \?/.test(clans), 'panel slot upgrade uses a guarded UPDATE');
    check(/WHERE id = \? AND status IN \('active', 'grace'\)/.test(clans), 'panel renewal never touches expired clans');
    check(/exports\.sunset_shop:PurchaseProduct\(source, productId, requestId/.test(clans), 'RC panel purchases settle through sunset_shop (shop_orders ledger)');
    check(!/RenewalPP|pp = \d+/.test(config), 'no RC prices remain in sunset_clans config (single source: products.lua)');
    check(/BaseSlots = 25/.test(config) && /MaxMembers = 75/.test(config), 'base capacity is 25 and the normal maximum is 75');
    check(/sunset:clans:expired/.test(clans), 'fully expired clans emit sunset:clans:expired');
    const cap = read(path.join(root, 'sql/81-clan-capacity.sql'));
    check(/SET max_members = 25/.test(cap) && /WHERE max_members < 25/.test(cap) && /DEFAULT 25/.test(cap), '81 migration only raises caps below 25 and sets the default');
    check(/clans\.message\.tag_color_changes_in_shop/.test(clans), 'free settings path no longer changes tag/color (paid products)');
    check(!/setPremiumPoints\(source, balanceBefore\)/.test(clans), 'clan creation refund no longer restores a stale balance snapshot');

    const mig = read(path.join(root, 'sql/77-clan-lifecycle-fix.sql'));
    check(/GREATEST\(IFNULL\(`expires_at`, NOW\(\)\), NOW\(\) \+ INTERVAL 30 DAY\)/.test(mig), '77 migration uses GREATEST (never shortens a valid expiry)');
    check(/WHERE \(`expires_at` IS NULL OR `expires_at` < NOW\(\)\)/.test(mig), '77 migration only touches NULL/lapsed expiries');
    check(/NOT EXISTS \(\s*SELECT 1 FROM `schema_data_fixes` WHERE `name` = '77-clan-lifecycle-fix'/.test(mig)
        && /INSERT IGNORE INTO `schema_data_fixes`/.test(mig), '77 migration is one-shot (entrypoint re-imports every migration)');
    const orders = read(path.join(root, 'sql/78-shop-orders.sql'));
    check(/UNIQUE KEY idx_request_id \(request_id\)/.test(orders) && /ENUM\('pending','processing','completed','refunded','failed'\)/.test(orders),
        'shop_orders has UNIQUE request_id and the full status lifecycle');
    const ent = read(path.join(root, 'sql/79-shop-entitlements.sql'));
    check(/CREATE TABLE IF NOT EXISTS shop_entitlements/.test(ent) && /CREATE TABLE IF NOT EXISTS shop_audit_log/.test(ent), 'entitlement + audit tables exist');
}

// ═══ 6. Server boundary (static) ══════════════════════════════════════
group('server boundary (static)');
{
    const main = read(res('sunset_shop/server/main.lua'));
    const cb = main.slice(main.indexOf("RegisterCallback('sunset:shop:purchase'"), main.indexOf("RegisterCallback('sunset:shop:consumeNameChange'"));
    check(cb.length > 0 && !/data\.price|data\.amount|data\.bankAmount|data\.product\b/.test(cb), 'purchase callback ignores client price/amount/definition');
    check(/function TrySpendRacketCredits\(source, amount, reason\)/.test(main) && /SpendBlazePoints/.test(main), 'TrySpendRacketCredits uses the core guarded debit');
    check(/function GetRacketCredits\(source\)/.test(main) && /RefreshBlazePoints/.test(main), 'GetRacketCredits reads the authoritative balance');
    check(!/print\([^)]*err\)[^\n]*TriggerClientEvent/.test(main), 'SQL errors are not forwarded to clients');
    const client = read(res('sunset_shop/client/main.lua'));
    const nameCb = client.slice(client.indexOf("RegisterNUICallback('shopUseNameChange'"), client.indexOf("RegisterNUICallback('shopUseClanNameChange'"));
    check(nameCb.includes('nickname = data.nickname') && !nameCb.includes('data.firstname') && !nameCb.includes('data.lastname'),
        'shopUseNameChange forwards { nickname } and drops the legacy firstname/lastname payload');
    const shopJs = read(res('sunset_shop/web/js/shop.js'));
    check(shopJs.includes("post('shopUseNameChange', { nickname })"), 'shop page sends { nickname }');
    const renameFn = read(res('sunset_core/server/player.lua'));
    const renameBody = renameFn.slice(renameFn.indexOf('function Sunset.RenameCharacter'), renameFn.indexOf('function Sunset.SetHomeProperty'));
    check(renameBody.includes('UPDATE characters SET firstname') && renameBody.includes('pcall(refreshRenamedCharacter') && !/UPDATE\s+accounts/i.test(renameBody),
        'rename writes characters.firstname, refreshes after commit, and does not touch accounts');
    check(read(res('sunset_scoreboard/server/main.lua')).includes("AddEventHandler('sunset:server:characterRenamed'"), 'scoreboard drops its cache when a character is renamed');
    check(read(res('sunset_phone/client/main.lua')).includes("RegisterNetEvent('sunset:client:characterRenamed'"), 'phone refreshes after a rename');
    for (const n of ['shopOpen', 'shopClose', 'shopPurchase', 'shopGetHistory']) check(client.includes(`RegisterNUICallback('${n}'`), `NUI callback ${n} registered`);
    check(/RegisterCommand\('shop'/.test(client) && /AddEventHandler\('sunset:shop:open'/.test(client), '/shop command and sunset:shop:open event open the shop');
    check(/ClaimFocus\(FOCUS_OWNER\)/.test(client) && /ReleaseFocus\(FOCUS_OWNER\)/.test(client), 'focus claimed/released through the sunset_ui manager');
    check(/sunset:ui:forceCloseAll/.test(client) && /onResourceStop/.test(client), 'forced close (death) and resource stop release focus');
    const js = read(res('sunset_shop/web/js/shop.js'));
    check(/event\.key !== 'Escape'/.test(js) && /post\('shopClose'\)/.test(js), 'ESC closes the shop');
    check(!/price:\s*p\.price|price:\s*product\.price/.test(js.slice(js.indexOf("post('shopPurchase'") - 400, js.indexOf("post('shopPurchase'") + 50)),
        'NUI purchase payload carries no price');
    const menuHtml = read(res('sunset_ui/web/modules/menu/index.html'));
    const menuLua = read(res('sunset_menu/client/main.lua'));
    check(/data-action="shop"/.test(menuHtml) && /data\.action == 'shop'[\s\S]{0,200}TriggerEvent\('sunset:shop:open'\)/.test(menuLua), 'M menu has a Racket Shop entry');
    const cfg = read(path.join(root, 'config/server.cfg.template'));
    check(/^ensure sunset_shop$/m.test(cfg) && cfg.indexOf('ensure sunset_shop') > cfg.indexOf('ensure sunset_clans'), 'sunset_shop ensured after its dependencies');

    // NUI keys used by the shop page exist in both languages.
    const html = read(res('sunset_shop/web/index.html'));
    const keys = new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]));
    for (const m of js.matchAll(/\bt\('([a-z][\w.]*)'/g)) keys.add(m[1]);
    for (const s of ['pending', 'processing', 'completed', 'refunded', 'failed']) keys.add(`shop.ui.status.${s}`);
    const missingNui = [...keys].filter((k) => !nuiHas('en', k) || !nuiHas('ro', k));
    check(missingNui.length === 0, `all shop NUI keys exist in EN+RO ${missingNui.slice(0, 5).join(' ')}`);
    const luaFiles = ['sunset_shop/server/main.lua', 'sunset_shop/server/settlement.lua', 'sunset_shop/server/handlers/character.lua',
        'sunset_shop/server/handlers/clan.lua', 'sunset_shop/server/handlers/economy.lua', 'sunset_shop/client/main.lua',
        'sunset_clans/server/shop_ops.lua', 'sunset_clans/server/main.lua'];
    const luaKeys = new Set();
    for (const f of luaFiles) for (const m of read(res(f)).matchAll(/(?:localeKey\s*=\s*|errorKey\(|TFor\(source,\s*|Translate\()'([a-z][\w.]*)'/g)) luaKeys.add(m[1]);
    for (const a of ['name', 'tag', 'color', 'slots', 'renew']) luaKeys.add(`shop.clan.broadcast_${a}`);
    const missingGame = [...luaKeys].filter((k) => !/[._]$/.test(k) && (!gameEn.has(k) || !gameRo.has(k)));
    check(missingGame.length === 0, `all shop/clan Lua locale keys exist in EN+RO ${missingGame.slice(0, 5).join(' ')}`);
}

// ═══ 7. Economy: business ownership cap (static) ══════════════════════
group('economy');
{
    const cfg = read(res('sunset_businesses/shared/config.lua'));
    const biz = read(res('sunset_businesses/server/main.lua'));
    const trade = read(res('sunset_inventory/server/trade.lua'));
    check(/SunsetBusinesses\.MaxOwnedPerCharacter = 2\b/.test(cfg), 'MaxOwnedPerCharacter defaults to 2');
    const buy = biz.slice(biz.indexOf("RegisterCallback('sunset:buyBusiness'"), biz.indexOf('local function ownerDashboard'));
    check(/ownedNow >= maxOwned then\s+return nil, \{ localeKey = 'businesses\.message\.business_ownership_limit_reached'/.test(buy), 'buyBusiness pre-checks the cap with a clear message');
    check(/startTransaction[\s\S]*if ownedNow >= maxOwned then return false end[\s\S]*owner_character_id IS NULL/.test(buy), 'buyBusiness re-checks the cap inside the purchase transaction');
    const transfer = biz.slice(biz.indexOf('function TransferOwnership'), biz.indexOf("exports('TransferOwnership'"));
    check(/owned\.total < \?/.test(transfer) && /business_ownership_limit_reached/.test(transfer), 'TransferOwnership enforces the cap in a guarded UPDATE');
    check(/GetMaxOwnedPerCharacter\(\)\) or 0\s+if maxOwned > 0 then\s+local countRows = query\.await\('SELECT COUNT\(\*\) AS total FROM player_businesses WHERE owner_character_id = \?', \{ toCharId \}\)/.test(trade)
        && /> maxOwned then return false end/.test(trade), 'player trades re-check the cap inside the settlement transaction');
    check(/receiverCanTakeAsset[\s\S]*GetMaxOwnedPerCharacter/.test(trade), 'player trades pre-check the cap');
    const adminClear = biz.slice(biz.indexOf("action == 'clearOwner'"), biz.indexOf("action == 'teleport'"));
    check(/owner_character_id = NULL/.test(adminClear), 'admin clearOwner path unaffected (never assigns ownership)');
}

// ═══ 8. Items: standard_tank ══════════════════════════════════════════
group('items');
{
    const items = read(res('sunset_core/shared/items.lua'));
    const diver = read(res('sunset_jobs/server/diver.lua'));
    const jobs = read(res('sunset_core/shared/jobs_config.lua'));
    check(/standard_tank\s*=\s*\{[^\n]*category = 'tools'/.test(items), 'standard_tank stays in the item catalog');
    check(/standard = 'standard_tank'/.test(diver) && /DIVE_GEAR_ITEMS\[tierName\]/.test(diver), 'diver standard-tier rental grants standard_tank');
    check(/for _, gearItem in pairs\(DIVE_GEAR_ITEMS\)/.test(diver), 'dive contract start accepts standard_tank');
    check(/exports\.sunset_inventory:RemoveItem\(src, data\.rentedGearItem, 1\)/.test(diver), 'rented standard_tank is consumed on shift end');
    check(/standard = \{[^\n]*minRank = 2/.test(jobs), 'standard tank is gated by diver rank 2 (progression)');
    check(nuiHas('en', 'item.standard_tank') && nuiHas('ro', 'item.standard_tank'), 'standard_tank has EN/RO inventory labels');
    check(fs.existsSync(res('sunset_ui/web/assets/items/standard_tank.webp')), 'standard_tank icon exists');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('Racket Shop, clan lifecycle, business cap and standard_tank invariants hold.');
