#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildAll, biasFor } = require('./generate-addon-profiles');
const { ARCHETYPES, TIERS } = require('./vehicle-physics/catalog');
const { sanitizeMass, sanitizeProfileMass, MOTORCYCLE_MASS_LIMITS } = require('./vehicle-physics/runtime-sanitize');

const root = path.resolve(__dirname, '..');
const all = buildAll();
const again = buildAll();
const failures = [];
const warnings = [];
const fail = (condition, message) => { if (!condition) failures.push(message); };

fail(JSON.stringify(all) === JSON.stringify(again), 'generator is not deterministic');
fail(all.profiles.length >= 240, `inventory unexpectedly small (${all.profiles.length})`);
fail(new Set(all.profiles.map((p) => p.model)).size === all.profiles.length, 'duplicate model names');

const required = ['zentorno','adder','banshee','comet2','sultan','tol22m5','tolm5cs22','tolm5e60','tolrs5','tolrs6','tolrs7c821','tolf360','tolf8spider','tolfxxk','tol675ltsp','tolr8v10','tolgtr','toldemon','tolcurus','varx','police','sheriff2'];
const byModel = new Map(all.profiles.map((p) => [p.model, p]));
for (const model of required) fail(byModel.has(model), `required profile missing: ${model}`);

const signatures = new Map();
for (const p of all.profiles) {
  const h = p.handling;
  const expectedBias = biasFor(p.drivetrain);
  fail(ARCHETYPES[p.archetype], `${p.model}: invalid archetype ${p.archetype}`);
  fail(TIERS[p.performanceTier], `${p.model}: invalid tier ${p.performanceTier}`);
  fail(h.fDriveBiasFront === expectedBias, `${p.model}: ${p.drivetrain} contradicts drive bias ${h.fDriveBiasFront}`);
  fail(h.fMass >= 120 && h.fMass <= 12000, `${p.model}: absurd mass ${h.fMass}`);
  fail(h.fInitialDriveForce >= 0.16 && h.fInitialDriveForce <= 0.52, `${p.model}: unsafe drive force ${h.fInitialDriveForce}`);
  fail(h.fInitialDriveMaxFlatVel >= 90 && h.fInitialDriveMaxFlatVel <= 240, `${p.model}: top-speed parameter outlier ${h.fInitialDriveMaxFlatVel}`);
  fail(h.fInitialDragCoeff >= 4.5 && h.fInitialDragCoeff <= 12, `${p.model}: drag outlier ${h.fInitialDragCoeff}`);
  fail(h.fBrakeForce >= 0.55 && h.fBrakeForce <= 1.4, `${p.model}: brake force outlier ${h.fBrakeForce}`);
  fail(h.fTractionCurveMin < h.fTractionCurveMax, `${p.model}: traction min must be below max`);
  fail(h.fTractionCurveMax <= 3.15, `${p.model}: excessive grip ${h.fTractionCurveMax}`);
  fail(h.fDriveBiasFront >= 0 && h.fDriveBiasFront <= 1, `${p.model}: invalid drive bias`);
  fail(h.fSteeringLock >= 30 && h.fSteeringLock <= 44, `${p.model}: steering lock outlier ${h.fSteeringLock}`);
  fail(h.fSuspensionUpperLimit > 0 && h.fSuspensionLowerLimit < 0, `${p.model}: invalid suspension travel`);
  fail(h.fSuspensionReboundDamp > h.fSuspensionCompDamp, `${p.model}: rebound damping must exceed compression damping`);
  fail(h.fRollCentreHeightFront > 0 && h.fRollCentreHeightRear > 0, `${p.model}: invalid roll centre`);
  fail(!(p.archetype.includes('super') || p.archetype.includes('hyper')) || (h.vecCentreOfMassOffset.z <= -0.14 && h.fAntiRollBarForce >= 1.45), `${p.model}: supercar rollover configuration is not planted`);
  const signature = [h.fMass,h.fInitialDriveForce,h.fInitialDriveMaxFlatVel,h.fDriveBiasFront,h.fTractionCurveMax,h.fAntiRollBarForce].join('|');
  const same = signatures.get(signature) || [];
  same.push(p.model); signatures.set(signature, same);
}
for (const models of signatures.values()) fail(models.length <= 3, `suspicious identical profile shared by ${models.length}: ${models.join(', ')}`);

const tierAverage = (tier, field) => {
  const values = all.profiles.filter((p) => p.performanceTier === tier).map((p) => field(p));
  return values.reduce((a,b) => a+b, 0) / values.length;
};
fail(tierAverage('super', (p) => p.targetTopSpeedKmh) > tierAverage('economy', (p) => p.targetTopSpeedKmh) + 75, 'supercar hierarchy collapsed toward economy cars');
fail(tierAverage('performance_sedan', (p) => p.targetTopSpeedKmh) > tierAverage('civilian', (p) => p.targetTopSpeedKmh) + 50, 'performance sedan hierarchy collapsed');
fail(byModel.get('tol22m5').drivetrain === 'awd_rear' && byModel.get('tol22m5').handling.fDriveBiasFront === 0.32, 'BMW M5 drivetrain regression');
fail(byModel.get('zentorno').handling.vecCentreOfMassOffset.z <= -0.17 && byModel.get('zentorno').handling.fAntiRollBarForce >= 1.65, 'Zentorno rollover fix regressed');
fail(byModel.get('toldemon').drivetrain === 'rwd' && byModel.get('toldemon').handling.fLowSpeedTractionLossMult >= 1.5, 'Demon lost RWD muscle character');
fail(byModel.get('hycsedan').performanceTier === 'performance_sedan' && byModel.get('hycsedan').handling.fInitialDriveForce >= 0.38, 'hycsedan downgraded to economy sedan tier');
fail(byModel.get('dubmono').handling.fInitialDriveForce >= 0.38, 'dubmono lost SUV performance calibration');
fail(byModel.get('neonvenm').handling.nInitialDriveGears === 1, 'neonvenm must stay single-speed EV');
fail(byModel.get('tol22m5').handling.fInitialDriveForce >= byModel.get('tailgater').handling.fInitialDriveForce + 0.08, 'M5 must out-accelerate civilian sedans');

const applyLua = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/client/apply.lua'), 'utf8');
const resolverLua = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/shared/resolver.lua'), 'utf8');
const nitrousLua = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/nitrous.lua'), 'utf8');
const benchmarkLua = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/client/benchmark.lua'), 'utf8');
const tuningApply = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/apply.lua'), 'utf8');

fail(applyLua.includes('baselineRestored'), 'apply.lua must emit baselineRestored on every successful apply (forced or not)');
fail(!applyLua.includes('vehicleDynamics:applied'), 'legacy vehicleDynamics:applied event must not remain');
fail(resolverLua.includes('massLimitsForProfile') && resolverLua.includes('120.0'), 'resolver must apply motorcycle-specific mass floor');
fail(tuningApply.includes('baselineRestored') && tuningApply.includes('_internalBaselineRestore'), 'tuning must listen for baselineRestored with loop guard');
fail(nitrousLua.includes('getAppliedEngineMultipliers'), 'nitrous must restore ECU engine multipliers not stage.power defaults');
fail(benchmarkLua.includes('0-200') && benchmarkLua.includes('vmaxWindowSec'), 'benchmark must measure 0-200 and vmax window');

fail(sanitizeMass({ archetype: 'motorcycle_sport', category: 'motorcycle' }, 205) === 205, 'runtime sanitize: motorcycle 205kg must not clamp to 400');
fail(sanitizeMass({ archetype: 'motorcycle_sport', category: 'motorcycle' }, 80) === MOTORCYCLE_MASS_LIMITS.min, 'runtime sanitize: ultra-light motorcycle clamped to 120kg min');
fail(sanitizeMass({ archetype: 'sedan_rwd', category: 'sedan' }, 250) === 400, 'runtime sanitize: light car still uses 400kg floor');

const bati = byModel.get('bati');
if (bati) {
  const runtimeBati = sanitizeProfileMass({ ...bati, category: 'motorcycle', bodyStyle: 'motorcycle' });
  fail(runtimeBati.handling.fMass <= 300, `bati runtime mass regression (${runtimeBati.handling.fMass})`);
}
fail(byModel.get('hycadetail')?.performanceTier === 'performance_sedan', 'hycadetail must be performance sedan not generic super');
fail(byModel.get('hycadetail')?.archetype === 'performance_sedan_awd', 'hycadetail archetype must match Tailgater Hycade');
fail(byModel.get('neonvenm')?.handling.nInitialDriveGears === 1, 'neonvenm EV gear count');

const raw = require('./discovered_addon_vehicles.json');
for (const item of raw) {
  const h = item.rawHandling || {};
  if (h.fBrakeForce > 1.5 || h.fTractionCurveMax > 3.2 || h.fMass < 400 || h.fMass > 10000) warnings.push(`${item.model}: suspicious raw source ignored`);
}

const tuningBaseline = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/baseline.lua'), 'utf8');
fail(tuningBaseline.includes('GetCanonicalBaseline') && tuningBaseline.includes('ApplyVehicleDynamics(veh, true)'), 'tuning no longer captures/restores canonical baseline');
fail(tuningApply.includes('STC.restoreBaselineHandling(veh, baseline)') && tuningApply.indexOf('STC.restoreBaselineHandling(veh, baseline)') < tuningApply.indexOf('TC.Compute(baseline, tune, caps)'), 'tuning application compounds instead of restoring baseline first');

const generated = ['classes.lua','profiles_vanilla.lua','profiles_addon.lua','profiles_emergency.lua'];
for (const file of generated) {
  const content = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/shared', file), 'utf8');
  fail(content.startsWith('-- AUTO-GENERATED'), `${file}: missing generated-file warning`);
}

console.log(`Vehicle physics audit: ${all.profiles.length} profiles (${all.vanilla.length} vanilla, ${all.addon.length} addon, ${all.emergency.length} emergency).`);
console.log(`Source audit: ${warnings.length} suspicious third-party handling records deliberately ignored by the canonical model.`);
console.log(`Identity confidence: ${all.profiles.filter((p) => p.identityConfidence === 'uncertain').length} uncertain, ${all.profiles.filter((p) => p.identityConfidence === 'inferred').length} inferred.`);
if (failures.length) {
  console.error(failures.map((x) => `FAIL: ${x}`).join('\n'));
  process.exit(1);
}
console.log('Vehicle physics invariants passed: coverage, drivetrain, hierarchy, ranges, rollover, uniqueness, determinism and tuning integration.');
