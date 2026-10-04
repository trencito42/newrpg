'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const phoneJs = read('resources/[sunset]/sunset_ui/web/js/phone.js');
const phoneClient = read('resources/[sunset]/sunset_phone/client/main.lua');
const phoneApps = read('resources/[sunset]/sunset_phone/client/apps.lua');
const phoneServer = read('resources/[sunset]/sunset_phone/server/main.lua');
const taxiClient = read('resources/[sunset]/sunset_taxi/client/main.lua');
const taxiServer = read('resources/[sunset]/sunset_taxi/server/main.lua');
const bridge = read('resources/[sunset]/sunset_ui/client/nui_bridge.lua');
const en = read('resources/[sunset]/sunset_core/shared/locales/en.lua');
const ro = read('resources/[sunset]/sunset_core/shared/locales/ro.lua');

test('phone clock comes from the GTA clock, not the CEF date', () => {
    assert.equal(phoneJs.includes('new Date()'), false);
    assert.match(phoneJs, /setClock/);
    assert.match(phoneClient, /GetClockHours\(\)/);
    assert.match(phoneClient, /GetClockMinutes\(\)/);
    assert.doesNotMatch(phoneClient, /TriggerServerEvent\('sunset:[^']*clock/);
});

test('SMS send keeps the server error instead of collapsing it', () => {
    const send = phoneClient.slice(phoneClient.indexOf("sunset:nui:phoneSend"));
    assert.doesNotMatch(send.slice(0, 1200), /pcall\(function\(\)\s*\n\s*return Sunset\.AwaitCallback\('sunset:phoneSend'/);
    assert.match(phoneClient, /function PhoneExplain/);
    assert.match(phoneServer, /error\.too_many_requests/);
    assert.match(phoneServer, /return \{ ok = true, message = msgPayload \}/);
    assert.match(en, /phone\.message\.cannot_message_yourself/);
    assert.match(en, /phone\.message\.player_character_not_found/);
    assert.match(ro, /phone\.message\.invalid_recipient_or_message/);
});

test('a failed SMS keeps retry data and does not use a browser dialog', () => {
    assert.match(phoneJs, /_pendingBubble/);
    assert.match(phoneJs, /phone\.ui\.retry/);
    assert.match(phoneJs, /localId/);
    assert.doesNotMatch(phoneJs, /window\.prompt|window\.alert|window\.confirm|\bprompt\(/);
});

test('open phone actions do not also raise the HUD notification', () => {
    const send = phoneClient.slice(phoneClient.indexOf("sunset:nui:phoneSend"), phoneClient.indexOf("sunset:nui:phoneAddContact"));
    assert.doesNotMatch(send, /exports\.sunset_ui:Notify/);
    assert.match(phoneClient, /function PhoneFeedback/);
});

test('account identity uses the base nickname', () => {
    assert.match(phoneServer, /myName = exports\.sunset_core:GetPlayerBaseName\(source\)/);
    assert.doesNotMatch(phoneJs, /\/buylevel/);
    assert.match(phoneJs, /phone\.ui\.buy_level/);
    assert.match(phoneJs, /formatMoney/);
});

test('ringtone and notification sound are real preferences', () => {
    assert.match(phoneApps, /PhonePrefs\.ringtone == false/);
    assert.match(phoneClient, /PhonePrefs\.notifySound ~= false/);
    assert.doesNotMatch(phoneJs, /compactNotes/);
});

test('taxi defaults to popular places and can use a waypoint', () => {
    assert.match(phoneJs, /d\.popular === true/);
    assert.match(taxiServer, /popular = dest\.category == 'Popular'/);
    assert.match(phoneJs, /taxiUseWaypoint/);
    assert.match(taxiClient, /GetFirstBlipInfoId\(8\)/);
    assert.match(bridge, /forward\('taxiUseWaypoint'\)/);
    assert.doesNotMatch(taxiClient, /Map pin \(%\.0f/);
});

test('character switch clears phone state and avatars are not captured', () => {
    assert.match(phoneJs, /resetCharacter/);
    assert.match(phoneClient, /phoneReset/);
    assert.doesNotMatch(phoneClient, /RegisterPedheadshot/);
    assert.doesNotMatch(phoneServer, /phoneSaveAvatar/);
});

test('closed phone does not poll every frame', () => {
    assert.doesNotMatch(phoneClient, /DisableControlAction\(0, 199, true\)[\s\S]{0,180}Wait\(0\)/);
    assert.match(phoneClient, /RegisterKeyMapping\('phone'/);
});

test('bank reasons use canonical ids and never invent missing i18n keys', () => {
    const reasons = require(path.join(root, 'resources/[sunset]/sunset_ui/web/js/phone-reasons.js'));
    const i18n = read('resources/[sunset]/sunset_ui/web/js/i18n.js');
    const quests = read('resources/[sunset]/sunset_ui/web/modules/quests/index.html');
    assert.equal(reasons.canonical('CNN Ad Submission'), 'cnn_ad_submission');
    assert.equal(reasons.canonical('refund:vehicle_insurance_claim'), 'refund_vehicle_insurance_claim');
    assert.equal(reasons.canonical('hospital'), 'hospital');

    const calls = [];
    const known = reasons.display('CNN Ad Submission', {
        has: (key) => key === 'phone.ui.reason_cnn_ad_submission',
        t: (key) => { calls.push(key); return 'CNN ad'; },
    });
    assert.equal(known, 'CNN ad');
    assert.deepEqual(calls, ['phone.ui.reason_cnn_ad_submission']);

    const warned = [];
    const unknown = reasons.display('Hello <b>legacy</b>', {
        has: () => false,
        t: (key) => { warned.push(key); return key; },
    });
    assert.equal(unknown, 'Hello legacy');
    assert.deepEqual(warned, []);

    const prefixed = reasons.display('quest_future_chain', {
        has: (key) => key === 'phone.ui.reason_quest',
        t: (key) => key,
    });
    assert.equal(prefixed, 'phone.ui.reason_quest');

    for (const id of reasons.CANONICAL_IDS) {
        const key = `'phone.ui.reason_${id}'`;
        const hits = i18n.split(key).length - 1;
        assert.equal(hits, 2, `${key} must exist in English and Romanian`);
    }
    for (const attr of quests.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) {
        const key = attr[1];
        const hits = i18n.split(`'${key}'`).length - 1;
        assert.equal(hits, 2, `${key} must exist in English and Romanian`);
    }
    assert.match(phoneJs, /PhoneReasons\.display/);
    assert.doesNotMatch(phoneJs, /phone\.ui\.reason_' \+/);
    assert.match(i18n, /function has\(key\)/);
});

test('locale keys used by the phone pass exist in English and Romanian', () => {
    for (const key of [
        'phone.message.request_timed_out',
        'phone.message.settings_failed',
        'phone.ui.level_bought',
        'taxi.message.no_waypoint',
    ]) {
        assert.match(en, new RegExp(key.replace(/\./g, '\\.')));
        assert.match(ro, new RegExp(key.replace(/\./g, '\\.')));
    }
});
