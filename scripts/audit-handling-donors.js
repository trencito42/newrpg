#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildAll } = require('./generate-addon-profiles');
const { isVanillaHandlingId, normalizeHandlingId } = require('./vehicle-physics/gta-vanilla-handling-index');
const { EXPLICIT_DONORS } = require('./vehicle-physics/handling-donors');

const root = path.resolve(__dirname, '..');
const discoveredPath = path.join(__dirname, 'discovered_addon_vehicles.json');
const applyLua = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/client/apply.lua'), 'utf8');
const baselineLua = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/client/baseline.lua'), 'utf8');

const failures = [];
const fail = (ok, msg) => { if (!ok) failures.push(msg); };

const discovered = JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));
const all = buildAll();
const byModel = new Map(all.profiles.map((p) => [p.model, p]));

fail(discovered.length === 179, `expected 179 discovered addon models, got ${discovered.length}`);

for (const row of discovered) {
  const model = row.model.toLowerCase();
  const profile = byModel.get(model);
  fail(profile, `${model}: missing generated profile`);
  if (!profile) continue;
  fail(profile.handlingMode === 'native_donor', `${model}: addon must use native_donor handlingMode`);
  const metaDonor = normalizeHandlingId(row.nativeDonorHandlingId || row.handlingId);
  fail(isVanillaHandlingId(metaDonor), `${model}: vehicles.meta handlingId ${metaDonor} is not a known vanilla donor`);
  fail(profile.nativeDonorHandlingId === metaDonor, `${model}: profile donor ${profile.nativeDonorHandlingId} != meta ${metaDonor}`);
  fail(!row.rawHandling || row.rawHandling.nativeDonor === true, `${model}: third-party handling.meta still bound (handlingId must be vanilla donor)`);
}

fail(applyLua.includes("profile.handlingMode == 'native_donor'"), 'apply.lua must skip canonical handling for native_donor');
fail(baselineLua.includes('readLiveHandlingBaseline'), 'baseline.lua must read live handling for native donors');
fail(baselineLua.includes('UsesNativeDonorHandling'), 'baseline.lua must export UsesNativeDonorHandling');

fail(byModel.get('tolap2')?.nativeDonorHandlingId === 'T20', 'tolap2 donor must be T20');
fail(byModel.get('tolrrmansory')?.nativeDonorHandlingId === 'WINDSOR', 'tolrrmansory donor must be WINDSOR');
fail(EXPLICIT_DONORS.tolap2.donorId === 'T20', 'explicit donor map tolap2');

const vanillaProfiles = all.profiles.filter((p) => p.handlingMode !== 'native_donor');
fail(vanillaProfiles.length >= 60, 'vanilla canonical profiles must remain for managed GTA vehicles');
for (const p of vanillaProfiles) {
  fail(p.handling && p.handling.fMass, `${p.model}: canonical profile missing handling table`);
}

const donorCsv = path.join(root, 'docs/vehicles/HANDLING_DONOR_MAP.csv');
fail(fs.existsSync(donorCsv), 'HANDLING_DONOR_MAP.csv must exist (run apply-handling-donor-meta.js)');

if (failures.length) {
  console.error('Handling donor audit failures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`Handling donor audit passed (${discovered.length} addon models, ${all.addon.length} native_donor profiles).`);
