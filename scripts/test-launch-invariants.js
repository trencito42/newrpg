'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const AUTH_BUCKET = 9999;

function mayResetRoutingBucket({ bucket, hasCharacter, inSession }) {
    if (inSession) return false;
    if (bucket === AUTH_BUCKET) return false;
    if (!hasCharacter) return false;
    if (bucket === AUTH_BUCKET) return false;
    return true;
}

function gateTuple(access) {
    if (!access || typeof access !== 'object' || Array.isArray(access)) {
        return { allowed: false, reason: 'progression_unavailable' };
    }
    if (access.allowed === false) {
        const missing = Array.isArray(access.missing) ? access.missing[0] : null;
        let reason = 'level_too_low';
        if (missing && missing.type === 'quest') reason = 'quest_required';
        if (missing && missing.type === 'license') reason = 'license_required';
        return { allowed: false, reason, detail: missing };
    }
    return { allowed: true, reason: null, detail: null };
}

function acceptClanInvite(state, clanId, characterId) {
    const clan = state.clans[clanId];
    if (!clan || clan.status === 'expired') return 'expired';
    if (clan.members.length >= clan.maxMembers) return 'full';
    clan.members.push(characterId);
    return 'ok';
}

function createLock() {
    let chain = Promise.resolve();
    return (fn) => {
        const run = chain.then(fn, fn);
        chain = run.then(() => {}, () => {});
        return run;
    };
}

function prepareSpawnAccepted(ack) {
    if (!ack || Number(ack.newBucket) !== 0) return false;
    return true;
}

test('auth isolation bucket cannot be cleared by session cleanup', () => {
    assert.equal(mayResetRoutingBucket({ bucket: 9999, hasCharacter: false, inSession: false }), false);
    assert.equal(mayResetRoutingBucket({ bucket: 9999, hasCharacter: true, inSession: false }), false);
    assert.equal(mayResetRoutingBucket({ bucket: 0, hasCharacter: false, inSession: false }), false);
    assert.equal(mayResetRoutingBucket({ bucket: 0, hasCharacter: true, inSession: true }), false);
    assert.equal(mayResetRoutingBucket({ bucket: 120, hasCharacter: true, inSession: false }), true);
    const sessions = read('resources/[sunset]/sunset_sessions/server/main.lua');
    const handler = sessions.slice(sessions.indexOf("RegisterNetEvent('sunset:sessions:resetRoutingBucket'"));
    const body = handler.slice(0, handler.indexOf('\nend)'));
    const guard = body.indexOf('AUTH_BUCKET');
    const release = body.lastIndexOf('SetPlayerRoutingBucket');
    assert.ok(guard > 0 && guard < release, 'auth bucket guard must run before the bucket is released');
    assert.match(body, /GetPlayerRoutingBucket\(src\) == AUTH_BUCKET/);
    assert.match(body, /player\.character\.id/);
});

test('faction gate export rejects a truthy table and a missing quest', () => {
    assert.deepEqual(gateTuple({ allowed: false, missing: [{ type: 'quest', questKey: 'life_reach_level10' }] }).reason, 'quest_required');
    assert.equal(gateTuple({ allowed: false, missing: [{ type: 'level' }] }).reason, 'level_too_low');
    assert.equal(gateTuple({ allowed: true }).allowed, true);
    assert.equal(gateTuple({ allowed: false }).allowed, false);
    const quests = read('resources/[sunset]/sunset_quests/server/main.lua');
    assert.match(quests, /function CanAccess\(source, gateId\)/);
    assert.match(quests, /function CanAccessCharacter\(characterId, gateId\)/);
    assert.match(quests, /reason = 'quest_required'/);
    assert.match(quests, /exports\('CanAccess', CanAccess\)/);
    assert.match(quests, /exports\('CanAccessCharacter', CanAccessCharacter\)/);
    const panel = read('resources/[sunset]/sunset_panel_bridge/server/main.lua');
    const setAt = panel.indexOf("row.action == 'set_faction' or row.action == 'faction_set_member'");
    const applyAt = panel.indexOf('SetFactionByCharacterId', setAt);
    const gateAt = panel.indexOf('CanAccessCharacter', setAt);
    assert.ok(setAt > 0 && gateAt > setAt && gateAt < applyAt, 'panel faction join must check progression before writing membership');
});

test('clan accept capacity is serialized and a full clan rejects the second join', async () => {
    const state = {
        clans: { 7: { status: 'active', maxMembers: 25, members: Array.from({ length: 24 }, (_, i) => i + 1) } },
    };
    const lock = createLock();
    const [a, b] = await Promise.all([
        lock(() => acceptClanInvite(state, 7, 100)),
        lock(() => acceptClanInvite(state, 7, 101)),
    ]);
    assert.deepEqual([a, b].sort(), ['full', 'ok']);
    assert.equal(state.clans[7].members.length, 25);
    assert.equal(acceptClanInvite({ clans: { 1: { status: 'expired', maxMembers: 25, members: [] } } }, 1, 5), 'expired');
    const clans = read('resources/[sunset]/sunset_clans/server/main.lua');
    const accept = clans.slice(clans.indexOf('local function acceptInvite'));
    const body = accept.slice(0, accept.indexOf("exports.sunset_core:RegisterCallback('sunset:clanAcceptInvite'"));
    assert.match(body, /FOR UPDATE/);
    assert.match(body, /committed ~= true/);
    assert.ok(body.indexOf('FOR UPDATE') < body.indexOf('INSERT INTO clan_members'));
});

test('spawn handshake fails closed unless the server moved the player to bucket 0', () => {
    assert.equal(prepareSpawnAccepted(null), false);
    assert.equal(prepareSpawnAccepted({ newBucket: 9999 }), false);
    assert.equal(prepareSpawnAccepted({ newBucket: '0' }), true);
    const spawn = read('resources/[sunset]/sunset_spawn/client/main.lua');
    assert.match(spawn, /tonumber\(newBucket\) ~= 0/);
    assert.match(spawn, /error\('BUCKET_NOT_READY'\)/);
    assert.match(spawn, /SPAWN_REJECTED/);
});

test('marketplace item cancel can see returnEscrow and buy refreshes inventory', () => {
    const market = read('resources/[sunset]/sunset_phone/server/market.lua');
    const decl = market.indexOf('local function returnEscrow');
    const use = market.indexOf('returnEscrow(');
    assert.ok(decl > 0 && use > decl, 'returnEscrow must be declared before item cancel calls it');
    const buy = market.indexOf('if row.listing_type == \'item\' then syncInventory(char.id)');
    const txn = market.indexOf('local committed = MySQL.startTransaction');
    assert.ok(txn > 0 && buy > txn, 'inventory cache refresh happens after the buy transaction commits');
    assert.match(market, /dealership\.purchase/);
    assert.match(market, /minimum_level/);
    assert.match(market, /WHERE NOT EXISTS/);
});

test('contact rename uses the registered phoneAction bridge', () => {
    const phone = read('resources/[sunset]/sunset_ui/web/js/phone.js');
    assert.doesNotMatch(phone, /post\('phoneEditContact'/);
    assert.match(phone, /post\('phoneAction', \{ op: 'editContact'/);
});

test('hunting license earned early is reconciled onto the range quest', () => {
    const quests = read('resources/[sunset]/sunset_quests/server/main.lua');
    assert.match(quests, /hasHuntingLicense/);
    assert.match(quests, /markCompleteIfSatisfied\('hunt_range_challenge', 'hunting', true\)/);
});

test('new player-facing locale keys exist in English and Romanian', () => {
    const en = read('resources/[sunset]/sunset_core/shared/locales/en.lua');
    const ro = read('resources/[sunset]/sunset_core/shared/locales/ro.lua');
    for (const key of [
        'property.sell.listed',
        'dealership.message.purchase_requires_driver_license',
        'panel_bridge.msg.sunset_rpg_banned_by',
    ]) {
        assert.match(en, new RegExp(`\\['${key.replace(/\./g, '\\.')}'\\]`));
        assert.match(ro, new RegExp(`\\['${key.replace(/\./g, '\\.')}'\\]`));
    }
    assert.match(en, /\[RACKET\] Banned by/);
    assert.doesNotMatch(en, /\[Sunset RPG\] Banned by/);
});

test('turf intervention refuses a clan that is not active', () => {
    const turfs = read('resources/[sunset]/sunset_turfs/server/main.lua');
    const intervene = turfs.slice(turfs.indexOf('local function runIntervene'));
    const body = intervene.slice(0, intervene.indexOf("RegisterCommand('intervene'"));
    assert.match(body, /pClan\.status ~= 'active'/);
    const save = turfs.slice(turfs.indexOf("RegisterCallback('sunset:turfs:savePolygon'"));
    assert.match(save, /local cx, cy = SunsetTurfs\.ComputePolygonCenter/);
    assert.match(save, /ComputePolygonRadius\(cleanPoints, cx, cy\)/);
});
