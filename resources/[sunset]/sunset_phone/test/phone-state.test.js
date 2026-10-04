const assert = require('assert');
const path = require('path');
const state = require(path.join(__dirname, '../../sunset_ui/web/js/phone-state.js'));

const layout = state.normalizeLayout({ grid: ['jobs', 'nope', 'bank', 'jobs', 'phone'] });
assert.deepStrictEqual(layout.grid.slice(0, 3), ['jobs', 'bank', 'phone']);
assert.strictEqual(layout.grid.length, state.HOME.length);
assert.ok(layout.grid.includes('faction'));
assert.ok(!layout.grid.includes('taxi'));

const defaults = state.normalizeLayout(null);
assert.deepStrictEqual(defaults.grid, state.HOME);

assert.strictEqual(state.shouldRunTimer('ACTIVE'), true);
assert.strictEqual(state.shouldRunTimer('INCOMING_RINGING'), false);
assert.strictEqual(state.shouldRunTimer('OUTGOING_RINGING'), false);
assert.strictEqual(state.shouldConnectVoice('ACTIVE'), true);
assert.strictEqual(state.shouldConnectVoice('INCOMING_RINGING'), false);
assert.strictEqual(state.shouldAutoLower('INCOMING_RINGING'), false);
assert.strictEqual(state.shouldAutoLower('ACTIVE'), false);

assert.strictEqual(state.callIsLive('IDLE'), false);
assert.strictEqual(state.callIsLive('ENDED'), false);
assert.strictEqual(state.callIsLive('INCOMING_RINGING'), true);
assert.strictEqual(state.callIsLive('OUTGOING_RINGING'), true);
assert.strictEqual(state.callIsLive('ACTIVE'), true);

assert.strictEqual(state.nextPresentation('closed', 'IDLE', 'toggle'), 'full');
assert.strictEqual(state.nextPresentation('full', 'IDLE', 'toggle'), 'closed');
assert.strictEqual(state.nextPresentation('full', 'INCOMING_RINGING', 'toggle'), 'peek');
assert.strictEqual(state.nextPresentation('peek', 'INCOMING_RINGING', 'toggle'), 'full');
assert.strictEqual(state.nextPresentation('full', 'OUTGOING_RINGING', 'toggle'), 'peek');
assert.strictEqual(state.nextPresentation('peek', 'OUTGOING_RINGING', 'toggle'), 'full');
assert.strictEqual(state.nextPresentation('full', 'ACTIVE', 'toggle'), 'peek');
assert.strictEqual(state.nextPresentation('peek', 'ACTIVE', 'toggle'), 'full');
assert.strictEqual(state.nextPresentation('closed', 'ACTIVE', 'toggle'), 'full');
assert.strictEqual(state.nextPresentation('peek', 'ENDED', 'terminal'), 'closed');
assert.strictEqual(state.nextPresentation('full', 'ENDED', 'terminal'), 'full');
assert.strictEqual(state.nextPresentation('peek', 'ACTIVE', 'forceClose'), 'closed');
assert.strictEqual(state.nextPresentation('full', 'ACTIVE', 'open'), 'full');
assert.strictEqual(state.nextPresentation('peek', 'ACTIVE', 'open'), 'full');
assert.strictEqual(state.nextPresentation('closed', 'ACTIVE', 'open'), 'full');
assert.strictEqual(state.nextPresentation('full', 'IDLE', 'open'), 'full');

assert.strictEqual(state.routeLocalCallText('all', null, false), 'nearby');
assert.strictEqual(state.routeLocalCallText('all', null, true), 'phone_call');
assert.strictEqual(state.routeLocalCallText('all', 'phone', false), 'reject');
assert.strictEqual(state.routeLocalCallText('ooc', 'phone', true), 'explicit');
assert.strictEqual(state.routeLocalCallText('all', null, false), 'nearby');

const liveCall = { state: 'ACTIVE', callId: 9, peerName: 'Sarah' };
assert.strictEqual(state.nextPresentation('full', liveCall.state, 'toggle'), 'peek');
assert.strictEqual(liveCall.state, 'ACTIVE');
assert.strictEqual(liveCall.callId, 9);

const ringing = state.applyCall({ state: 'IDLE' }, { state: 'OUTGOING_RINGING', callId: 4, peerName: 'Ada', peerPhone: '555-0002' });
assert.strictEqual(ringing.runTimer, false);
assert.strictEqual(ringing.connectVoice, false);
assert.strictEqual(ringing.peerName, 'Ada');

const active = state.applyCall(ringing, { state: 'ACTIVE', callId: 4, peerPhone: '555-0002' });
assert.strictEqual(active.runTimer, true);
assert.ok(active.localStart);

const again = state.applyCall(active, { state: 'ACTIVE', callId: 4 });
assert.strictEqual(again.localStart, active.localStart);

const ended = state.applyCall(active, { state: 'ENDED', callId: 4, reason: 'hangup' });
assert.strictEqual(ended.runTimer, false);
assert.strictEqual(state.terminalState('BUSY'), true);
assert.strictEqual(state.terminalState('ACTIVE'), false);

assert.strictEqual(state.safeText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
assert.strictEqual(state.safeText(null), '');

const bothOn = state.resolveVoice('ACTIVE', true, true, true);
assert.deepStrictEqual(bothOn, { voiceAvailable: true, myVoiceEnabled: true, peerVoiceEnabled: true });
const mineOff = state.resolveVoice('ACTIVE', true, false, true);
assert.strictEqual(mineOff.myVoiceEnabled, false);
assert.strictEqual(mineOff.peerVoiceEnabled, true);
const peerOff = state.resolveVoice('ACTIVE', true, true, false);
assert.strictEqual(peerOff.myVoiceEnabled, true);
assert.strictEqual(peerOff.peerVoiceEnabled, false);
const bothOff = state.resolveVoice('ACTIVE', true, false, false);
assert.strictEqual(bothOff.myVoiceEnabled, false);
assert.strictEqual(bothOff.peerVoiceEnabled, false);
const down = state.resolveVoice('ACTIVE', false, true, true);
assert.deepStrictEqual(down, { voiceAvailable: false, myVoiceEnabled: false, peerVoiceEnabled: false });
const ringingVoice = state.resolveVoice('INCOMING_RINGING', true, true, true);
assert.strictEqual(ringingVoice.voiceAvailable, false);
const legacyOn = state.resolveVoice('ACTIVE', undefined, undefined, undefined);
assert.strictEqual(legacyOn.myVoiceEnabled, true);

const voiced = state.applyCall({ state: 'IDLE' }, {
    state: 'ACTIVE', callId: 4, voiceAvailable: true, myVoiceEnabled: false, peerVoiceEnabled: true,
});
assert.strictEqual(voiced.myVoiceEnabled, false);
assert.strictEqual(voiced.peerVoiceEnabled, true);
assert.ok(voiced.localStart);
const voicedAgain = state.applyCall(voiced, {
    state: 'ACTIVE', callId: 4, voiceAvailable: true, myVoiceEnabled: true, peerVoiceEnabled: false,
});
assert.strictEqual(voicedAgain.localStart, voiced.localStart);
assert.strictEqual(voicedAgain.myVoiceEnabled, true);
assert.strictEqual(voicedAgain.peerVoiceEnabled, false);

const scrambled = [
    { id: 3, sender_character_id: 2, receiver_character_id: 1, created_at: '2026-10-04 10:10:00' },
    { id: 1, sender_character_id: 1, receiver_character_id: 2, created_at: '2026-10-04 10:00:00' },
    { id: 2, sender_character_id: 2, receiver_character_id: 1, created_at: '2026-10-04 10:05:00' },
];
const ordered = state.conversationMessages(scrambled, 1, 2);
assert.deepStrictEqual(ordered.map((row) => row.id), [1, 2, 3]);
assert.notStrictEqual(ordered, scrambled);
assert.deepStrictEqual(scrambled.map((row) => row.id), [3, 1, 2]);
const withPending = ordered.concat([{ id: 4, sender_character_id: 1, receiver_character_id: 2, created_at_unix: Math.floor(Date.now() / 1000) }]);
assert.strictEqual(withPending[withPending.length - 1].id, 4);

const epochSeconds = 1791182370;
const epochMs = 1791182370000;
assert.strictEqual(state.formatBubbleTime(epochSeconds), state.formatBubbleTime(epochMs));
assert.match(state.formatBubbleTime(epochMs), /^\d{2}:\d{2}$/);
assert.doesNotMatch(state.formatBubbleTime(epochMs), /1791182370000/);
assert.match(state.formatBubbleTime('2026-10-04 13:53:00'), /^13:53$/);
assert.match(state.formatBubbleTime('2026-10-04T13:53:00Z'), /^\d{2}:\d{2}$/);
assert.strictEqual(state.formatBubbleTime(null), '--');
assert.strictEqual(state.formatBubbleTime('not-a-date'), '--');
assert.doesNotMatch(state.formatBubbleTime('1791182370000'), /1791182370000/);

const morning = new Date(2026, 9, 4, 10, 0).getTime();
const later = new Date(2026, 9, 4, 18, 0).getTime();
const nextDay = new Date(2026, 9, 5, 9, 0).getTime();
assert.strictEqual(state.dateSeparator(morning, later, { today: 'Today', yesterday: 'Yesterday', locale: 'en' }), 'Today');
assert.strictEqual(state.dateSeparator(morning, nextDay, { today: 'Today', yesterday: 'Yesterday', locale: 'en' }), 'Yesterday');
assert.strictEqual(state.dateSeparator(new Date(2026, 9, 2, 10).getTime(), nextDay, { today: 'Today', yesterday: 'Yesterday', locale: 'en' }), '02 Oct 2026');
assert.strictEqual(state.dateSeparator(new Date(2026, 9, 2, 10).getTime(), nextDay, { today: 'Astăzi', yesterday: 'Ieri', locale: 'ro' }), '02 oct. 2026');

assert.strictEqual(state.phoneDraftOnEnd('', false), 'clear');
assert.strictEqual(state.phoneDraftOnEnd('   ', false), 'clear');
assert.strictEqual(state.phoneDraftOnEnd('vin acu', false), 'hold');
assert.strictEqual(state.phoneDraftOnEnd('', true), 'hold');

console.log('phone-state tests passed');
