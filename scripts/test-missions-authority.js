#!/usr/bin/env node
// Static regression guards for server-authoritative missions/quests/robbery/fire/turfs/fishing tournament.
// Run: node scripts/test-missions-authority.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RES = path.join(ROOT, 'resources', '[sunset]');
let failed = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };
const read = (p) => fs.readFileSync(p, 'utf8');
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.lua')) out.push(p);
  }
  return out;
}
const DOMAIN = ['sunset_missions', 'sunset_quests', 'sunset_robbery', 'sunset_fire', 'sunset_fishing_tournament', 'sunset_turfs'];

// 1. no client-triggerable handler takes a reward-ish parameter (allowlist: ignored fire amount)
const BAD = /\b(reward|amount|score|payout|money|cash|weight|xp|total|bonus)\w*\b/i;
const ALLOW = new Set(['sunset_fire:sunset:fireExtinguish']);
for (const res of DOMAIN) {
  for (const f of walk(path.join(RES, res, 'server'))) {
    const src = read(f);
    const re = /(RegisterNetEvent|RegisterCallback)\(\s*'([^']+)'\s*,\s*function\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(src))) {
      const params = m[3].split(',').map(s => s.trim()).filter(Boolean).filter(p => p !== 'source');
      const bad = params.filter(p => BAD.test(p));
      if (bad.length && !ALLOW.has(res + ':' + m[2])) ok(false, `${res}: handler ${m[2]} accepts client param(s) ${bad.join(',')}`);
      else ok(true, 'param ok');
    }
  }
}
// fire: client amount must be overwritten with server constant
const fire = read(path.join(RES, 'sunset_fire/server/main.lua'));
ok(/amount = Sunset\.Fire\.extinguishRate/.test(fire), 'fire: extinguish amount must be a server constant');
ok(/minBurnSec/.test(fire), 'fire: min burn time enforced');

// 2. missions: single settlement path + transition validation
const msnMain = read(path.join(RES, 'sunset_missions/server/main.lua'));
const msnRew = read(path.join(RES, 'sunset_missions/server/rewards.lua'));
const payCalls = (msnMain.match(/MSN_PayReward\(/g) || []).length;
ok(payCalls === 2, `missions: MSN_PayReward called from exactly the 2 deliver handlers (found ${payCalls})`);
ok(/rewardClaimed/.test(msnRew) && /minDurationSec/.test(msnRew), 'missions: exactly-once guard + min duration in rewards.lua');
ok(/MSN_RequestTransition/.test(msnMain), 'missions: setStage goes through MSN_RequestTransition');
ok(!/data\.condition/.test(msnMain), 'missions: condition must not be read from client data');
ok(/MSN_PlayerInMissionVehicle/.test(msnMain), 'missions: vehicle verified server-side');
ok(/acceptLock/.test(msnMain), 'missions: per-player accept lock');
ok(/onResourceStop/.test(msnMain), 'missions: server onResourceStop closes sessions');
const stages = read(path.join(RES, 'sunset_missions/server/stages.lua'));
ok(/MSN_Transitions/.test(stages) && /dwell/.test(stages), 'missions: transition table with dwell');
ok(!/RegisterNetEvent/.test(msnMain), 'missions: no net events on server');
ok(/'server\/stages\.lua'/.test(read(path.join(RES, 'sunset_missions/fxmanifest.lua'))), 'missions: stages.lua in manifest');
// the client may not trigger a "complete" server-side
for (const f of walk(path.join(RES, 'sunset_missions/server'))) ok(!/RegisterNetEvent\('sunset:missions:complete/.test(read(f)), 'missions: complete is server->client only');

// 3. money/XP paths
const tourn = read(path.join(RES, 'sunset_fishing_tournament/server/main.lua'));
ok(!/RegisterNetEvent/.test(tourn), 'tournament: no client net events');
const addMoneyCount = (tourn.match(/AddMoney\(/g) || []).length;
ok(addMoneyCount === 1, `tournament: single payout call (claimPendingRewards), found ${addMoneyCount}`);
ok(/UPDATE fishing_tournament_rewards SET claimed_at = NOW\(\) WHERE id = \? AND claimed_at IS NULL/.test(tourn), 'tournament: atomic claim before paying');
ok(/INSERT IGNORE INTO fishing_tournament_rewards/.test(tourn), 'tournament: reward rows INSERT IGNORE');
ok(/INSERT IGNORE INTO fishing_tournament_catches/.test(tourn), 'tournament: catch persisted idempotently');
ok(/fishing_tournaments/.test(tourn) && /resumeFromDb/.test(tourn), 'tournament: DB resume path');
ok(!/fishData\.score|\.totalWeight10 =\s*tonumber/.test(tourn), 'tournament: no client score');
const turf = read(path.join(RES, 'sunset_turfs/server/main.lua'));
ok((turf.match(/AddMoney\(/g) || []).length === 1 && /TurfPayoutAt/.test(turf), 'turfs: single payout (payday) with per-clan guard');
const quests = read(path.join(RES, 'sunset_quests/server/main.lua'));
ok(/status = 'complete'/.test(quests) && /UPDATE character_quests SET status = 'claimed'[^`]*status = 'complete'/.test(quests.replace(/\n/g, ' ')), 'quests: guarded claim UPDATE');
const rob = read(path.join(RES, 'sunset_robbery/server/main.lua'));
ok(/session\.stage ~= 'LOOTING' then return end/.test(rob) && /escapingAt/.test(rob), 'robbery: leaveStore only from LOOTING, escape has min dwell');

// 4. migration parses
const sqlDir = path.join(ROOT, 'sql');
const mig = fs.readdirSync(sqlDir).filter(f => /^\d+-fishing-tournament-persistence\.sql$/.test(f));
ok(mig.length === 1, 'migration: fishing tournament persistence file present');
if (mig.length) {
  const sql = read(path.join(sqlDir, mig[0])).replace(/--.*$/gm, '');
  const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
  ok(stmts.length === 3, 'migration: 3 statements');
  for (const s of stmts) {
    ok(/^CREATE TABLE IF NOT EXISTS/.test(s), 'migration: idempotent CREATE');
    ok((s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length, 'migration: balanced parens');
    ok(/UNIQUE KEY/.test(s) || /PRIMARY KEY/.test(s), 'migration: unique/primary key');
  }
  ok(/uq_ftc_idem \(tournament_id, character_id, catch_key\)/.test(sql), 'migration: catch idempotency key');
  const nums = fs.readdirSync(sqlDir).map(f => parseInt(f, 10)).filter(n => !isNaN(n));
  const mine = parseInt(mig[0], 10);
  ok(nums.filter(n => n === mine).length === 1, 'migration: number unique in sql/');
}
console.log(`missions-authority: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
