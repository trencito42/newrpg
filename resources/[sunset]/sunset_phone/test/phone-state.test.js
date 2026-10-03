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

console.log('phone-state tests passed');
