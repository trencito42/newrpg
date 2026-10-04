'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const asset = require(path.join(root, 'resources', '[sunset]', 'sunset_ui', 'web', 'js', 'asset-public.js'));

test('public snapshot drops forged fields and keeps text as text', () => {
    const clean = asset.sanitize({
        type: 'vehicle',
        id: 381,
        displayName: 'Comet Noire',
        plate: 'B 69 RNK',
        mileage: 12431,
        condition: 92,
        imageModel: 'comet6',
        owner: 'renk',
        price: 85000,
        label: '<img src=x onerror=alert(1)>',
        metadata: { serial: 'SECRET' },
        meta: { durability: 80, serial: 'SECRET' },
    });
    assert.equal(clean.assetId, '381');
    assert.equal(clean.displayName, 'Comet Noire');
    assert.equal(clean.owner, undefined);
    assert.equal(clean.metadata, undefined);
    assert.deepEqual(clean.meta, { durability: 80 });
    assert.equal(clean.label.includes('onerror'), true);
    assert.equal(typeof clean.label, 'string');
    assert.equal(asset.chipText({ type: 'item', id: 1, label: '<img src=x onerror=alert(1)>' }).includes('<img'), true);
});

test('chip text formats the linked asset types', () => {
    assert.equal(asset.chipText({ type: 'item', id: 4, label: 'Repair Kit', quantity: 5 }), 'Repair Kit ×5');
    assert.equal(asset.chipText({ type: 'vehicle', id: 9, displayName: 'Comet Noire', plate: 'B 69 RNK' }), 'Comet Noire · B 69 RNK');
    assert.equal(asset.chipText({ type: 'property', id: 14, label: 'House · Vinewood Hills #14' }), 'House · Vinewood Hills #14');
    assert.equal(asset.chipText({ type: 'business', id: 3, label: '24/7 Grove' }), '24/7 Grove');
    assert.equal(asset.chipText({ type: 'admin', id: 1, label: 'hidden' }), '');
});

test('listing banners distinguish active, sold, and expired', () => {
    assert.equal(asset.listingBanner('active'), 'active');
    assert.equal(asset.listingBanner('sold'), 'sold');
    assert.equal(asset.listingBanner('expired'), 'expired');
    assert.equal(asset.listingBanner('cancelled'), 'expired');
    assert.equal(asset.listingBanner('missing'), 'unavailable');
});

test('promotion throttle blocks an active ad and allows a later one', () => {
    assert.equal(asset.promotionAllowed(null, 1000, 3600), true);
    assert.equal(asset.promotionAllowed({ status: 'pending' }, 1000, 3600), false);
    assert.equal(asset.promotionAllowed({ status: 'approved' }, 1000, 3600), false);
    assert.equal(asset.promotionAllowed({ status: 'published', publishedAt: 900 }, 1000, 3600), false);
    assert.equal(asset.promotionAllowed({ status: 'published', publishedAt: 100 }, 4000, 3600), true);
});

test('chat send forwards only type and id', () => {
    const client = read('resources/[sunset]/sunset_chat/client/main.lua');
    assert.match(client, /return \{ type = assetType, id = assetId \}/);
    assert.doesNotMatch(client, /attachment\.model/);
    assert.doesNotMatch(client, /attachment\.price/);
    const server = read('resources/[sunset]/sunset_chat/server/main.lua');
    assert.match(server, /ResolveChatAttachment\(src, requested\)/);
    assert.match(server, /type = 'staff_chat'/);
    assert.doesNotMatch(server, /staff_chat'[\s\S]{0,240}attachment = requested/);
});

test('catalog ignores client labels and rejects foreign assets by owner column', () => {
    const catalog = read('resources/[sunset]/sunset_inventory/server/asset_catalog.lua');
    assert.match(catalog, /Client-supplied names, plates, prices, and metadata are ignored/);
    assert.match(catalog, /character_id = \?/);
    assert.match(catalog, /owner_character_id = \?/);
    assert.doesNotMatch(catalog, /label = raw\.label/);
    assert.match(catalog, /GetPlayerAssetCatalog/);
    assert.match(read('resources/[sunset]/sunset_inventory/server/trade.lua'), /GetPlayerAssetCatalog\(source, 'TRADE'\)/);
});

test('business links use the owned-business export', () => {
    const catalog = read('resources/[sunset]/sunset_inventory/server/asset_catalog.lua');
    assert.match(catalog, /GetOwnedBusinesses/);
    assert.match(catalog, /GetBusinessRow/);
    assert.doesNotMatch(catalog, /balance =/);
});

test('cnn text ads still submit and promotion does not touch listing rows', () => {
    const cnn = read('resources/[sunset]/sunset_cnn/server/main.lua');
    assert.match(cnn, /function SubmitAd\(source, text, attachment\)/);
    assert.match(cnn, /SubmitAd\(source, text, pending\)/);
    assert.match(cnn, /listingPromotionBlocked/);
    assert.match(cnn, /promoteCooldown/);
    assert.doesNotMatch(cnn, /DELETE FROM phone_market_listings/);
    assert.doesNotMatch(cnn, /UPDATE phone_market_listings/);
    const market = read('resources/[sunset]/sunset_phone/server/market.lua');
    assert.doesNotMatch(market, /SubmitAd/);
    assert.match(market, /cnnPrice = cnnPrice\(\)/);
});

test('picker has a single focus owner', () => {
    const picker = read('resources/[sunset]/sunset_ui/web/js/trade-forza.js');
    assert.match(picker, /if \(this\._pickerOwner && this\._pickerOwner !== mode\) return false/);
    assert.match(picker, /if \(tradeOpen && mode !== 'TRADE'\) return false/);
    assert.match(picker, /this\._pickerOwner = null/);
    const preview = read('resources/[sunset]/sunset_ui/web/js/asset-preview.js');
    assert.doesNotMatch(preview, /innerHTML/);
    const chat = read('resources/[sunset]/sunset_ui/web/js/chat.js');
    assert.match(chat, /chip\.textContent = label/);
    assert.match(chat, /type: pending\.type, id: pending\.id/);
});

test('migration and locale keys exist in English and Romanian', () => {
    const sql = read('sql/85-cnn-ad-attachments.sql');
    assert.match(sql, /attachment_type/);
    assert.match(sql, /attachment_id/);
    assert.match(sql, /market_listing_id/);
    assert.match(sql, /attachment_snapshot/);
    for (const locale of ['en.lua', 'ro.lua']) {
        const text = read(`resources/[sunset]/sunset_core/shared/locales/${locale}`);
        for (const key of [
            'asset.attach', 'asset.choose', 'asset.link_in_chat', 'asset.promote',
            'asset.promote_prompt', 'asset.view_market', 'asset.listing_sold',
            'asset.listing_expired', 'asset.unavailable', 'asset.contact_seller',
            'asset.attached', 'asset.remove', 'cnn.message.promote_throttled',
        ]) {
            assert.match(text, new RegExp(`\\['${key.replace('.', '\\.')}'\\]`));
        }
    }
});
