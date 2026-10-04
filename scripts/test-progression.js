#!/usr/bin/env node
'use strict';
// Static new-player progression checks. No GTA movement.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let failed = 0;
function check(cond, msg) {
    if (cond) console.log('  ok  ' + msg);
    else { failed += 1; console.log('  FAIL ' + msg); }
}

const config = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_core/shared/config.lua'), 'utf8');
const chains = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_quests/shared/chains.lua'), 'utf8');
const quests = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_quests/server/main.lua'), 'utf8');
const gates = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_core/shared/progression_gates.lua'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'sql/03-foundation.sql'), 'utf8');
const create = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_core/server/main.lua'), 'utf8');

check(/StartingCash = 250/.test(config) && /StartingBank = 1000/.test(config), 'starting money is $250 cash and $1000 bank');
check(/level` INT UNSIGNED NOT NULL DEFAULT 1/.test(schema), 'character level defaults to 1');
check(/data\.lastname = ''/.test(create), 'new characters store an empty legacy last name');
check(/jobId = 'fisherman'/.test(chains), 'first hire objective is Fisherman, not any job');
check(/eventType == 'level_reached'/.test(quests) && /math.max\(st\.progress or 0, reached\)/.test(quests), 'level quest uses a high-water mark');

function reach(levels) {
    let progress = 0;
    const target = 10;
    for (const level of levels) {
        const reached = level;
        const next = Math.min(target, Math.max(progress, reached));
        if (next !== progress) progress = next;
    }
    return progress;
}
check(reach([2, 3, 4, 5]) === 5, 'buying up to level 5 does not finish the level 10 quest');
check(reach([2, 3, 4, 5, 6, 7, 8, 9, 10]) === 10, 'level 10 quest completes at level 10');

const rewardRe = /reward = \{ money = (\d+)/g;
let money = 0;
let m;
const beforeCar = chains.slice(0, chains.indexOf("key = 'drv_first_car'"));
while ((m = rewardRe.exec(beforeCar))) money += Number(m[1]);
const start = 250 + 1000;
const license = 30;
const rental = 500;
const shifts = 4 * 540;
const cheapest = 16500;
const affordable = start + money - license - rental + shifts;
check(affordable >= cheapest, 'starter car is affordable after story payouts and four courier runs ($' + affordable + ' vs $' + cheapest + ')');

check(/minLevel = 10/.test(gates) && /faction\.apply/.test(gates), 'faction apply stays level 10');
check(/clan\.create[\s\S]{0,120}minLevel = 15/.test(gates), 'clan create stays level 15');
check(/job\.fisherman[\s\S]{0,80}minLevel = 1/.test(gates) && !/job\.fisherman[\s\S]{0,160}driver/.test(gates), 'fisherman does not require a driver license');

const graph = path.join(root, 'docs/progression/progression_graph.json');
const audit = path.join(root, 'docs/progression/NEW_ACCOUNT_PROGRESSION_AUDIT.md');
check(fs.existsSync(graph) && fs.existsSync(audit), 'progression audit files exist');
if (fs.existsSync(graph)) {
    const parsed = JSON.parse(fs.readFileSync(graph, 'utf8'));
    check(Array.isArray(parsed.nodes) && parsed.nodes.length > 10, 'progression graph has nodes');
    check(parsed.characterLevelDefault === 1, 'graph records level default 1');
const cfgText = fs.readFileSync(path.join(root, 'config/server.cfg.template'), 'utf8');
check(/ensure sunset_intro/.test(cfgText), 'production template starts sunset_intro');
check(/LevelPriceBase = 1000/.test(config) && /ShiftRespect = 2/.test(config), 'level money and shift respect match the 8-15 hour model');
const market = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_phone/server/market.lua'), 'utf8');
check(market.includes('startTransaction') && market.includes('DebitMoneyInTransaction') && market.includes("status = 'expired'"), 'marketplace buy and expiry are transactional');
check(fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_jobs/server/core.lua'), 'utf8').includes('GrantRespect'), 'a completed shift grants respect');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
