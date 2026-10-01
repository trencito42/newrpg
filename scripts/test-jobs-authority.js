#!/usr/bin/env node
// Static regression guards for server-authoritative job rewards.
// Domain: sunset_jobs, sunset_taxi, sunset_fishingshop, sunset_racing, sunset_sessions.
// Usage: node scripts/test-jobs-authority.js   (exit 1 on any failed assertion)
'use strict';
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'resources', '[sunset]');
const read = (rel) => fs.readFileSync(path.join(base, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(base, rel));
const stripComments = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
const listLua = (res, sub) => {
    const dir = path.join(base, res, sub);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.lua')).map((f) => `${res}/${sub}/${f}`);
};

const failures = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) failures.push(msg); };

const RES = ['sunset_jobs', 'sunset_taxi', 'sunset_fishingshop', 'sunset_racing', 'sunset_sessions'];
const serverFiles = RES.flatMap((r) => listLua(r, 'server'));

// 1. No net event handler takes a reward/amount-like parameter from the client.
const BAD_PARAM = /^(amount|reward|pay|payout|money|cash|price|total|xp|value|fare|bonus|earned|tip)$/i;
// sunset:taxiTip is a callback (not a net event) that moves the passenger's own money; see allowlist below.
for (const f of serverFiles) {
    const src = stripComments(read(f));
    const re = /Register(?:Net|Server)Event\(\s*'([^']+)'\s*,\s*function\s*\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(src))) {
        for (const p of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
            ok(!BAD_PARAM.test(p), `${f}: net event ${m[1]} takes client-supplied reward-like param "${p}"`);
        }
    }
}

// 2. Callbacks: no reward-like parameter except the audited, server-clamped taxi tip.
const CB_ALLOW = new Set(['sunset:taxiTip']);
for (const f of serverFiles) {
    const src = stripComments(read(f));
    const re = /RegisterCallback\(\s*'([^']+)'\s*,\s*function\s*\(\s*source\s*,([^)]*)\)/g;
    let m;
    while ((m = re.exec(src))) {
        if (CB_ALLOW.has(m[1])) continue;
        for (const p of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
            ok(!BAD_PARAM.test(p), `${f}: callback ${m[1]} takes client-supplied reward-like param "${p}"`);
        }
    }
}

// 3. Every direct AddMoney in sunset_jobs/server (outside SunsetJobs_PayReward) must be a refund or an
// explicitly reviewed payout (each one is guarded by state flip / lock / DB transaction).
const REVIEWED_PAYOUTS = new Set([
    'hunter_sell', 'hunter_contract_complete', 'diver_sell', 'diver_contract_complete',
]);
for (const f of listLua('sunset_jobs', 'server')) {
    const src = stripComments(read(f));
    const re = /AddMoney\(([^\n]*)\)/g;
    let m;
    while ((m = re.exec(src))) {
        const line = m[1];
        if (f.endsWith('/core.lua') && /reason or/.test(line)) continue; // SunsetJobs_PayReward itself
        const reason = (line.match(/'([a-z_0-9]+)'\s*\)?\s*$/) || line.match(/'([a-z_0-9]+)'\s*(?:\)|$)/) || [])[1];
        if (f.endsWith('/trucker.lua')) { ok(/trucker_/.test(line), `${f}: unexpected AddMoney ${line}`); continue; }
        ok(reason && (/refund/.test(reason) || REVIEWED_PAYOUTS.has(reason)),
            `${f}: AddMoney outside SunsetJobs_PayReward with unreviewed reason "${reason}"`);
    }
}
// Job-session payouts that go through PayReward must sit in files that hold a per-player lock or flip state.
for (const f of ['sunset_jobs/server/courier.lua', 'sunset_jobs/server/garbage.lua', 'sunset_jobs/server/trucker.lua']) {
    ok(/SunsetJobs_WithLock/.test(read(f)), `${f}: payout callbacks must run under SunsetJobs_WithLock`);
}
ok(/SunsetJobs_WithLock\(source, 'trucker_deliver'/.test(read('sunset_jobs/server/trucker.lua')), 'trucker deliver must be locked');
ok(/SunsetJobs_WithLock\(source, 'courier_deliver'/.test(read('sunset_jobs/server/courier.lua')), 'courier deliver must be locked');

// 4. Work-vehicle destruction cancels the shift with no reward.
const jc = read('sunset_core/shared/jobs_config.lua');
for (const job of ['trucker', 'garbage', 'courier']) {
    const blk = jc.split(new RegExp(`\\n    ${job} = \\{`))[1] || '';
    const head = blk.split(/\n    [a-z_]+ = \{/)[0];
    ok(/failOnWorkVehicleLoss\s*=\s*true/.test(head), `jobs_config: ${job} must set failOnWorkVehicleLoss = true`);
}
const core = read('sunset_jobs/server/core.lua');
ok(/function SunsetJobs_WorkVehicleStatus/.test(core), 'core: SunsetJobs_WorkVehicleStatus missing');
ok(/cfg\.failOnWorkVehicleLoss/.test(core) && /Work vehicle destroyed/.test(core), 'core: monitor must fail shift on wrecked vehicle');
ok(/SunsetJobs_WorkVehicleStatus\(session\) ~= 'ok'/.test(read('sunset_jobs/server/courier.lua')), 'courier deliver must verify the van is intact');
ok(/SunsetJobs_WorkVehicleStatus\(session\) == 'wrecked'/.test(core), 'ValidateVehicle must reject wrecked vehicles');

// 5. Every job/resource has stop cleanup.
const STOP = [
    'sunset_jobs/server/core.lua', 'sunset_jobs/server/hunter.lua', 'sunset_jobs/server/diver.lua',
    'sunset_jobs/client/core.lua', 'sunset_jobs/client/courier.lua', 'sunset_jobs/client/fisherman.lua',
    'sunset_jobs/client/garbage.lua', 'sunset_jobs/client/trucker.lua', 'sunset_jobs/client/trucker_npc.lua',
    'sunset_jobs/client/hunter.lua', 'sunset_jobs/client/diver.lua', 'sunset_jobs/client/workplaces.lua',
    'sunset_taxi/server/main.lua', 'sunset_taxi/client/main.lua',
    'sunset_racing/server/main.lua', 'sunset_racing/client/main.lua',
    'sunset_fishingshop/client/main.lua',
    'sunset_sessions/server/main.lua', 'sunset_sessions/client/main.lua',
];
for (const f of STOP) ok(exists(f) && /AddEventHandler\('onResourceStop'/.test(read(f)), `${f}: missing onResourceStop cleanup`);
// mechanic client has no entities of its own: relies on JobClient.cleanup in client/core.lua (checked above).
ok(/JobClient\.hudClear\(true\)/.test(read('sunset_jobs/client/core.lua')), 'client/core stop must JobHudClear');
ok(/playerDropped/.test(core) && /deleteSessionEntities\(session\)/.test(core), 'core: playerDropped must delete session entities');

// 6. Single fish price table.
ok(exists('sunset_core/shared/fish_prices.lua'), 'shared fish_prices.lua missing');
ok(/fish_prices\.lua/.test(read('sunset_jobs/fxmanifest.lua')) && /fish_prices\.lua/.test(read('sunset_fishingshop/fxmanifest.lua')), 'both manifests must load fish_prices.lua');
for (const f of ['sunset_jobs/server/fisherman.lua', 'sunset_fishingshop/server/main.lua']) {
    ok(!/fish_legendary\s*=\s*\{?\s*(min|\d)/.test(read(f)), `${f}: contains its own fish price table`);
}

// 7. Solo race reward is centrally configured and time-verified; taxi list has one source.
const rc = read('sunset_racing/shared/config.lua');
ok(/soloReward\s*=/.test(rc) && /soloMaxAvgSpeedMps\s*=/.test(rc), 'racing config: soloReward/soloMaxAvgSpeedMps');
ok(/implausible_time/.test(read('sunset_racing/server/main.lua')), 'racing: solo payout must be time-verified');
ok(!/'dynasty'|'rumpo'|'stretch'|'bus'/.test(read('sunset_taxi/shared/config.lua').replace(/--.*$/gm, '')), 'taxi config: civilian fleet must come from the Cab Depot faction fleet only');

if (failures.length) {
    console.error(`test-jobs-authority: ${failures.length} failure(s) of ${checks} checks`);
    for (const f of failures) console.error('  FAIL ' + f);
    process.exit(1);
}
console.log(`test-jobs-authority: ${checks} checks, 0 failed`);
