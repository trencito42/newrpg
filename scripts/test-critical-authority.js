#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const hackingClient = read('resources/[sunset]/sunset_hacking/client/main.lua');
const hackingServer = read('resources/[sunset]/sunset_hacking/server/main.lua');
const robberyClient = read('resources/[sunset]/sunset_robbery/client/main.lua');
const robberyServer = read('resources/[sunset]/sunset_robbery/server/main.lua');
const drugs = read('resources/[sunset]/sunset_drugs/server/main.lua');
const drugUi = read('resources/[sunset]/sunset_ui/web/js/drugs.js');
const carjack = read('resources/[sunset]/sunset_carjack/server/main.lua');

assert.doesNotMatch(hackingClient, /resolve\(\{\s*success\s*=\s*true,\s*timeout\s*=\s*true/,
    'hacking verification timeout must fail closed');
assert.match(hackingServer, /deliverConsumerResult\(sess, result\)/,
    'verified hacking result must be delivered server-to-server');
assert.match(robberyServer, /exports\('CompleteHackingChallenge'/,
    'robbery must expose a server-only hacking completion boundary');
assert.doesNotMatch(robberyServer, /RegisterNetEvent\('sunset:robbery:hackComplete'/,
    'client must not be able to declare robbery hacking success');
assert.doesNotMatch(robberyClient, /TriggerServerEvent\('sunset:robbery:hackComplete'/,
    'robbery client must never report authoritative hacking success');

assert.match(drugs, /elapsed < \(Cfg\.process\.minProcessDurationMs/,
    'drug processing must enforce minimum elapsed time');
assert.match(drugs, /LabAttempts\[source\] = nil\n\n    local removals/,
    'drug lab attempt token must be consumed before economic mutation');
assert.match(drugs, /sunset:drugs:startLabAttempt/,
    'drug lab must issue a per-attempt token before minigame');
assert.match(drugs, /validateStreetPed\(source, pedNetId\)/,
    'street sale must validate the supplied network ped');
assert.match(drugs, /session\.negotiation\.verified == true/,
    'negotiation bonus must require a server-verified challenge');
assert.match(drugs, /SaleSessions\[source\] = nil\n\n    -- Verify authoritative price/,
    'sale token must be consumed before inventory and payout mutation');
assert.strictEqual((drugUi.match(/fetch\(`https:\/\/sunset_drugs\/\$\{action\}`/g) || []).length, 1,
    'drug NUI action must be posted exactly once');

assert.match(carjack, /RegisterCallback\('sunset:carjack:beginLockpick'/,
    'carjack must issue a server attempt token before the minigame');
assert.match(carjack, /RegisterCallback\('sunset:carjack:completeLockpick'/,
    'carjack must validate and consume the attempt token');
assert.match(carjack, /LockpickAttempts\[source\] = nil -- one-shot before any yielding mutation/,
    'carjack attempt must be one-shot');
assert.doesNotMatch(carjack, /onLockpickSuccess|onLockpickFail/,
    'legacy direct success/failure callbacks must be removed');
assert.match(carjack, /exports\.sunset_jobs:AddJobXP\(source, 'lockpicking'/,
    'lockpick XP must use the canonical job progression API');

console.log('Critical authority invariants: hacking, robbery, drugs, and carjack fail closed and use one-shot server sessions.');
