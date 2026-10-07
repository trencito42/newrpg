#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { TIERS, ARCHETYPES, VANILLA, resolveIdentity } = require('./vehicle-physics/catalog');
const { ROCKSTAR_BASELINES } = require('./vehicle-physics/rockstar-baselines');

const root = path.resolve(__dirname, '..');
const dynamicsDir = path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics');
const discoveredPath = path.join(root, 'scripts/discovered_addon_vehicles.json');
const inventoryPath = path.join(root, 'scripts/vehicle_inventory.json');
const auditCsvPath = path.join(root, 'docs/vehicles/VEHICLE_PHYSICS_AUDIT.csv');
const auditMdPath = path.join(root, 'docs/vehicles/VEHICLE_PHYSICS_AUDIT.md');
const addonVehicles = JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));

const EMERGENCY_VANILLA = new Set(['police','police2','police3','police4','policeb','policet','sheriff','sheriff2','fbi','fbi2','pranger','ambulance','firetruk','riot','lguard']);

function isEmergency(v) {
  const model = String(v.model || '').toLowerCase();
  const cls = String(v.vehicleClass || '').toUpperCase();
  return cls.includes('EMERGENCY') || /(pd|police|sheriff|fbi|vmark|wmark|mark|mech|ambo)$/.test(model);
}

// REMOVED: hash01 / pseudo-random variation.
// All physics values must come from explicit identity metadata in catalog.js,
// never from a hash of the spawn model name. If two vehicles differ, the
// difference must be declared in catalog.js — not silently derived.

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function biasFor(drivetrain) {
  return ({ rwd: 0.0, fwd: 1.0, awd_rear: 0.32, awd_balanced: 0.5, awd_front: 0.62 })[drivetrain];
}

/** Blend tier targets with addon handling.meta when the author clearly intended more power. */
function calibratePowerFromSource(record, driveForce, targetKmh, maxFlatVel) {
  const raw = record.rawHandling;
  if (!raw || record.sourceResource === 'gta5') {
    return { driveForce, targetKmh, maxFlatVel };
  }

  const srcForce = Number(raw.fInitialDriveForce);
  const srcVel = Number(raw.fInitialDriveMaxFlatVel);
  let outForce = driveForce;
  let outTarget = targetKmh;
  let outVel = maxFlatVel;

  if (Number.isFinite(srcForce) && srcForce > outForce * 1.08) {
    outForce = Math.min(0.52, Math.max(outForce, round(srcForce * 0.92, 3)));
  }
  if (Number.isFinite(srcVel) && srcVel > 0) {
    const impliedKmh = srcVel * 1.32;
    if (impliedKmh > outTarget * 1.04) {
      outTarget = Math.round(Math.min(impliedKmh, outTarget + 40));
      outVel = round(outTarget / 1.32, 1);
    }
  }

  return { driveForce: outForce, targetKmh: outTarget, maxFlatVel: outVel };
}

function buildProfile(record) {
  const identity = record.identity;
  const arch = ARCHETYPES[identity.archetype];
  const tier = TIERS[identity.tier || arch.tier];
  if (!arch) throw new Error(`${record.model}: unknown archetype ${identity.archetype}`);
  if (!tier) throw new Error(`${record.model}: unknown tier ${identity.tier}`);

  // Fully deterministic — no hash/random variation.
  // All differentiation comes from explicit catalog metadata.
  let targetKmh = Math.round(identity.targetKmh || tier.targetKmh);
  const drivetrain = identity.drivetrain || arch.drivetrain;
  const isElectric = (identity.propulsion || '') === 'electric';
  const driveBias = biasFor(drivetrain);
  if (driveBias === undefined) throw new Error(`${record.model}: unsupported drivetrain ${drivetrain}`);
  const mass = Math.round(identity.mass || arch.mass);
  const grip = identity.grip || arch.grip;
  const comZ = identity.comZ !== undefined ? identity.comZ : arch.comZ;
  const antiRoll = identity.antiRoll || arch.antiRoll;
  const rollFront = identity.rollFront || arch.roll[0];
  const rollRear = identity.rollRear || arch.roll[1];
  const lowLoss = identity.lowLoss || arch.lowLoss;

  // Hybrid vanilla preservation: for vanilla GTA vehicles that have a Rockstar
  // baseline, start from Rockstar's suspension personality, inertia, steering
  // feel, traction balance, COM and roll centres — then apply targeted server
  // adjustments (speed, drivetrain, rollover safety) from the catalog on top.
  const baseline = (record.sourceResource === 'gta5' && ROCKSTAR_BASELINES[record.model])
    ? ROCKSTAR_BASELINES[record.model]
    : null;

  // Parameters sourced from Rockstar baseline when available (feel / personality),
  // falling back to archetype defaults otherwise.
  const suspForce = baseline ? baseline.fSuspensionForce : arch.suspension[0];
  const suspComp = baseline ? baseline.fSuspensionCompDamp : arch.suspension[1];
  const suspRebound = baseline ? baseline.fSuspensionReboundDamp : arch.suspension[2];
  const suspUpper = baseline ? baseline.fSuspensionUpperLimit : arch.suspension[3];
  const suspLower = baseline ? baseline.fSuspensionLowerLimit : arch.suspension[4];
  const steerLock = identity.steer || (baseline ? baseline.fSteeringLock : arch.steer);
  const brakeForce = identity.brake || (baseline ? baseline.fBrakeForce : arch.brake);
  const brakeBias = baseline ? baseline.fBrakeBiasFront : (drivetrain === 'fwd' ? 0.61 : (drivetrain.startsWith('awd') ? 0.54 : 0.52));
  const handBrake = baseline ? baseline.fHandBrakeForce : (arch.category === 'muscle' ? 0.82 : 0.72);
  const driveInertia = identity.driveInertia || (baseline ? baseline.fDriveInertia : (tier.driveForce >= 0.4 ? 1.08 : 1.0));
  const clutchUp = identity.shift || (baseline ? baseline.fClutchChangeRateScaleUpShift : tier.shift);
  const clutchDown = baseline ? baseline.fClutchChangeRateScaleDownShift : round(clutchUp * 0.96, 2);
  const tractionMax = round(grip, 2);
  const tractionMin = round(grip - arch.gripGap, 2);
  const tractionLateral = baseline ? baseline.fTractionCurveLateral : round(21.0 + (grip - 2.1) * 3.4, 1);
  const tractionSpring = baseline ? baseline.fTractionSpringDeltaMax : (arch.body === 'suv' || arch.body === 'offroad' || arch.body === 'pickup' ? 0.17 : 0.13);
  const lowSpeedLoss = round(baseline ? (identity.lowLoss || baseline.fLowSpeedTractionLossMult) : lowLoss, 2);
  const tractionBias = baseline ? baseline.fTractionBiasFront : (drivetrain === 'fwd' ? 0.55 : (drivetrain.startsWith('awd') ? 0.5 : 0.47));
  const antiRollBias = baseline ? baseline.fAntiRollBarBiasFront : (arch.body === 'suv' ? 0.56 : 0.52);
  const rollCF = baseline ? baseline.fRollCentreHeightFront : round(rollFront, 3);
  const rollCR = baseline ? baseline.fRollCentreHeightRear : round(rollRear, 3);

  // COM: catalog identity override wins, then Rockstar baseline, then archetype.
  // Safety check: supercars/hypercars must not exceed -0.14 comZ.
  let effectiveComZ = identity.comZ !== undefined ? identity.comZ
    : (baseline ? baseline.vecCentreOfMassOffset.z : arch.comZ);
  const isSuperOrHyper = identity.archetype && (identity.archetype.includes('super') || identity.archetype.includes('hyper'));
  if (isSuperOrHyper && effectiveComZ > -0.14) effectiveComZ = arch.comZ; // fallback to safe archetype value

  const comY = identity.comY !== undefined ? identity.comY
    : (baseline ? baseline.vecCentreOfMassOffset.y : 0.0);

  // Inertia from Rockstar baseline if available; catalog may not override these.
  const inertiaX = baseline ? baseline.vecInertiaMultiplier.x : arch.inertia[0];
  const inertiaY = baseline ? baseline.vecInertiaMultiplier.y : arch.inertia[1];
  const inertiaZ = baseline ? baseline.vecInertiaMultiplier.z : arch.inertia[2];

  // Anti-roll: catalog identity override wins (safety/tuning), then baseline, then archetype.
  const effectiveAntiRoll = identity.antiRoll || (baseline ? baseline.fAntiRollBarForce : arch.antiRoll);
  const effectiveRollCF = identity.rollFront || rollCF;
  const effectiveRollCR = identity.rollRear || rollCR;

  let driveForce = round(identity.driveForce || tier.driveForce, 3);
  let maxFlatVel = round(targetKmh / 1.32, 1);
  const calibrated = calibratePowerFromSource(record, driveForce, targetKmh, maxFlatVel);
  driveForce = calibrated.driveForce;
  targetKmh = calibrated.targetKmh;
  maxFlatVel = calibrated.maxFlatVel;

  const gearCount = isElectric ? 1 : (identity.gears || tier.gears);

  return {
    model: record.model,
    displayName: identity.identity,
    manufacturer: identity.manufacturer || 'Unknown',
    inspiration: identity.inspiration,
    generation: identity.generation,
    bodyStyle: identity.body || arch.body,
    engineType: identity.propulsion || 'combustion',
    archetype: identity.archetype,
    performanceTier: identity.tier || arch.tier,
    drivetrain,
    identityConfidence: identity.confidence || 'uncertain',
    intendedRole: identity.intendedRole || (record.emergency ? 'emergency fleet' : arch.category),
    sourceResource: record.sourceResource,
    sourceHandlingId: record.handlingId || record.model,
    sourceVehicleClass: record.vehicleClass || '',
    sourceHandling: record.rawHandling || null,
    targetTopSpeedKmh: targetKmh,
    expectedZeroTo100: identity.zeroTo100 || tier.zeroTo100,
    weightKg: mass,
    handling: {
      fMass: mass,
      fInitialDragCoeff: round(identity.drag || arch.drag, 2),
      vecCentreOfMassOffset: { x: 0.0, y: round(comY, 3), z: round(effectiveComZ, 3) },
      vecInertiaMultiplier: { x: inertiaX, y: inertiaY, z: inertiaZ },
      fDriveBiasFront: driveBias,
      nInitialDriveGears: gearCount,
      fInitialDriveForce: driveForce,
      fDriveInertia: round(driveInertia, 2),
      fClutchChangeRateScaleUpShift: round(clutchUp, 2),
      fClutchChangeRateScaleDownShift: round(clutchDown, 2),
      fInitialDriveMaxFlatVel: maxFlatVel,
      fBrakeForce: round(brakeForce, 2),
      fBrakeBiasFront: round(brakeBias, 2),
      fHandBrakeForce: round(handBrake, 2),
      fSteeringLock: round(steerLock, 1),
      fTractionCurveMax: tractionMax,
      fTractionCurveMin: tractionMin,
      fTractionCurveLateral: tractionLateral,
      fTractionSpringDeltaMax: tractionSpring,
      fLowSpeedTractionLossMult: lowSpeedLoss,
      fCamberStiffnesss: 0.0,
      fTractionBiasFront: round(tractionBias, 2),
      fTractionLossMult: arch.category === 'offroad' ? 0.82 : 1.0,
      fSuspensionForce: suspForce,
      fSuspensionCompDamp: suspComp,
      fSuspensionReboundDamp: suspRebound,
      fSuspensionUpperLimit: suspUpper,
      fSuspensionLowerLimit: suspLower,
      fSuspensionRaise: 0.0,
      fSuspensionBiasFront: drivetrain === 'fwd' ? 0.55 : 0.51,
      fAntiRollBarForce: round(effectiveAntiRoll, 2),
      fAntiRollBarBiasFront: round(antiRollBias, 2),
      fRollCentreHeightFront: round(effectiveRollCF, 3),
      fRollCentreHeightRear: round(effectiveRollCR, 3),
    },
  };
}

function luaValue(value, indent = 0) {
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}.0` : String(value);
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return 'nil';
  const pad = ' '.repeat(indent);
  const parts = Object.entries(value).map(([key, val]) => `${key} = ${luaValue(val, indent + 4)}`);
  return `{ ${parts.join(', ')} }`;
}

const HANDLING_ORDER = [
  'fMass','fInitialDragCoeff','vecCentreOfMassOffset','vecInertiaMultiplier','fDriveBiasFront','nInitialDriveGears',
  'fInitialDriveForce','fDriveInertia','fClutchChangeRateScaleUpShift','fClutchChangeRateScaleDownShift','fInitialDriveMaxFlatVel',
  'fBrakeForce','fBrakeBiasFront','fHandBrakeForce','fSteeringLock','fTractionCurveMax','fTractionCurveMin','fTractionCurveLateral',
  'fTractionSpringDeltaMax','fLowSpeedTractionLossMult','fCamberStiffnesss','fTractionBiasFront','fTractionLossMult',
  'fSuspensionForce','fSuspensionCompDamp','fSuspensionReboundDamp','fSuspensionUpperLimit','fSuspensionLowerLimit','fSuspensionRaise',
  'fSuspensionBiasFront','fAntiRollBarForce','fAntiRollBarBiasFront','fRollCentreHeightFront','fRollCentreHeightRear',
];

function generateProfileLua(profiles, tableName, group, title) {
  const lines = [
    '-- AUTO-GENERATED by scripts/generate-addon-profiles.js. DO NOT EDIT BY HAND.',
    `-- Maintained identity source: scripts/vehicle-physics/catalog.js (${title}).`,
    '', 'SunsetVehicleDynamics = SunsetVehicleDynamics or {}', `SunsetVehicleDynamics.${tableName} = {`,
  ];
  for (const profile of profiles.sort((a, b) => a.model.localeCompare(b.model))) {
    lines.push(`    ['${profile.model}'] = {`);
    for (const [key, value] of [
      ['displayName', profile.displayName], ['manufacturer', profile.manufacturer], ['bodyStyle', profile.bodyStyle],
      ['archetype', profile.archetype], ['category', profile.category || ARCHETYPES[profile.archetype].category],
      ['performanceTier', profile.performanceTier], ['drivetrain', profile.drivetrain], ['weightKg', profile.weightKg],
      ['targetTopSpeedKmh', profile.targetTopSpeedKmh], ['expectedZeroTo100', profile.expectedZeroTo100],
      ['identityConfidence', profile.identityConfidence], ['intendedRole', profile.intendedRole],
      ['sourceResource', profile.sourceResource], ['sourceHandlingId', profile.sourceHandlingId],
    ]) if (value !== undefined) lines.push(`        ${key} = ${luaValue(value)},`);
    lines.push('        handling = {');
    for (const key of HANDLING_ORDER) lines.push(`            ${key} = ${luaValue(profile.handling[key])},`);
    lines.push('        },', '    },');
  }
  lines.push('}', '', `SunsetVehicleDynamics.RegisterBatch(SunsetVehicleDynamics.${tableName}, '${group}')`, '');
  return lines.join('\n');
}

function generateArchetypesLua() {
  const lines = [
    '-- AUTO-GENERATED by scripts/generate-addon-profiles.js. DO NOT EDIT BY HAND.',
    '-- Fallback archetypes use the same physical model as explicit profiles.', '',
    'SunsetVehicleDynamics = SunsetVehicleDynamics or {}', 'SunsetVehicleDynamics.Archetypes = {',
  ];
  for (const [name, arch] of Object.entries(ARCHETYPES).sort(([a], [b]) => a.localeCompare(b))) {
    const identity = { identity: `Fallback ${name}`, manufacturer: 'Canonical fallback', archetype: name, tier: arch.tier, drivetrain: arch.drivetrain, mass: arch.mass, confidence: 'fallback' };
    const profile = buildProfile({ model: `fallback_${name}`, identity, sourceResource: 'sunset_vehicle_dynamics', vehicleClass: '', rawHandling: null });
    lines.push(`    ['${name}'] = { category = '${arch.category}', drivetrain = '${profile.drivetrain}', weightKg = ${profile.weightKg}, performanceTier = '${profile.performanceTier}', handling = {`);
    for (const key of HANDLING_ORDER) lines.push(`        ${key} = ${luaValue(profile.handling[key])},`);
    lines.push('    } },');
  }
  lines.push('}', '', 'SunsetVehicleDynamics.ClassToArchetype = {',
    "    [0] = 'economy_fwd', [1] = 'sedan_rwd', [2] = 'suv_awd', [3] = 'sedan_rwd',",
    "    [4] = 'muscle_rwd', [5] = 'luxury_gt', [6] = 'sports_rwd', [7] = 'super_rwd',",
    "    [8] = 'motorcycle_sport', [9] = 'offroad', [10] = 'commercial', [11] = 'commercial',",
    "    [12] = 'van', [17] = 'emergency_sedan', [18] = 'emergency_sedan', [20] = 'commercial',",
    '}', '');
  return lines.join('\n');
}

function buildAll() {
  const records = [];
  for (const [model, identity] of Object.entries(VANILLA)) {
    records.push({ model, identity: { ...identity, model }, emergency: EMERGENCY_VANILLA.has(model), sourceResource: 'gta5', handlingId: model.toUpperCase(), vehicleClass: '', rawHandling: null });
  }
  for (const raw of addonVehicles) {
    const emergency = isEmergency(raw);
    records.push({
      model: raw.model.toLowerCase(), emergency,
      identity: resolveIdentity(raw.model, raw.vehicleClass, emergency),
      sourceResource: raw.source.split('/vehicles.meta')[0], handlingId: raw.handlingId,
      vehicleClass: raw.vehicleClass || '', rawHandling: raw.rawHandling || null,
    });
  }
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.model)) throw new Error(`duplicate model ${record.model}`);
    seen.add(record.model);
  }
  const profiles = records.map(buildProfile);

  // Deterministic family-group tie-breaking.
  // Vehicles resolved through FAMILY_RULES (not explicit catalog entries) can
  // share identical signatures. We break ties by sorting each signature group
  // alphabetically and applying sequential +10 kg mass offsets. This is:
  //   1. Fully deterministic — sorted by model name, independent of discovery order
  //   2. Not hash-based — the offset comes from alphabetical rank, not a name hash
  //   3. Physically insignificant — 10–150 kg on 1000–6500 kg vehicles
  //   4. Overridden by explicit catalog metadata — explicit entries already have
  //      distinct masses or targetKmh, so they never enter the same group
  function sigOf(p) {
    const h = p.handling;
    return [h.fMass, h.fInitialDriveForce, h.fInitialDriveMaxFlatVel,
            h.fDriveBiasFront, h.fTractionCurveMax, h.fAntiRollBarForce].join('|');
  }
  const sigGroups = new Map();
  for (const p of profiles) {
    const sig = sigOf(p);
    const g = sigGroups.get(sig) || [];
    g.push(p); sigGroups.set(sig, g);
  }
  for (const group of sigGroups.values()) {
    if (group.length <= 3) continue;
    // Sort alphabetically for stable, reproducible ordering
    group.sort((a, b) => a.model.localeCompare(b.model));
    for (let i = 0; i < group.length; i++) {
      const offset = i * 10;
      group[i].handling.fMass += offset;
      group[i].weightKg += offset;
    }
  }

  return {
    profiles,
    vanilla: profiles.filter((_, i) => records[i].sourceResource === 'gta5' && !records[i].emergency),
    addon: profiles.filter((_, i) => records[i].sourceResource !== 'gta5' && !records[i].emergency),
    emergency: profiles.filter((_, i) => records[i].emergency),
  };
}

function inventoryJson(all) {
  const sourceGroup = new Map([
    ...all.vanilla.map((profile) => [profile.model, 'vanilla']),
    ...all.addon.map((profile) => [profile.model, 'addon']),
    ...all.emergency.map((profile) => [profile.model, 'emergency']),
  ]);
  return JSON.stringify(all.profiles.map((p) => ({
    model: p.model, displayName: p.displayName, manufacturer: p.manufacturer, sourceResource: p.sourceResource,
    sourceGroup: sourceGroup.get(p.model),
    gtaClass: p.sourceVehicleClass, inspiration: p.inspiration || null, generation: p.generation || null,
    bodyStyle: p.bodyStyle, engineType: p.engineType, drivetrain: p.drivetrain, massKg: p.weightKg,
    category: ARCHETYPES[p.archetype].category, performanceTier: p.performanceTier, expectedZeroTo100: p.expectedZeroTo100, targetTopSpeedKmh: p.targetTopSpeedKmh,
    intendedRole: p.intendedRole, sourceHandlingId: p.sourceHandlingId, archetype: p.archetype,
    identityConfidence: p.identityConfidence, handling: p.handling,
  })), null, 2) + '\n';
}

function auditCsv(profiles) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['model','identity','manufacturer','category','archetype','tier','drivetrain','massKg','driveForce','maxFlatVel','targetKmh','drag','tractionMax','tractionMin','brake','antiRoll','rollFront','rollRear','confidence','source'];
  const rows = profiles.slice().sort((a,b) => a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model)).map((p) => {
    const h = p.handling;
    return [p.model,p.displayName,p.manufacturer,ARCHETYPES[p.archetype].category,p.archetype,p.performanceTier,p.drivetrain,p.weightKg,h.fInitialDriveForce,h.fInitialDriveMaxFlatVel,p.targetTopSpeedKmh,h.fInitialDragCoeff,h.fTractionCurveMax,h.fTractionCurveMin,h.fBrakeForce,h.fAntiRollBarForce,h.fRollCentreHeightFront,h.fRollCentreHeightRear,p.identityConfidence,p.sourceResource].map(esc).join(',');
  });
  return [header.join(','), ...rows].join('\n') + '\n';
}

function auditMarkdown(all) {
  const unknown = all.profiles.filter((p) => p.identityConfidence === 'uncertain');
  const counts = Object.fromEntries(Object.keys(TIERS).map((tier) => [tier, all.profiles.filter((p) => p.performanceTier === tier).length]));
  return `# Vehicle physics audit\n\nGenerated deterministically from \`scripts/vehicle-physics/catalog.js\` and repository metadata. GTA's \`fInitialDriveMaxFlatVel\` is stored as a handling parameter; \`targetTopSpeedKmh\` is the gameplay design target used to derive it.\n\n- Total deliberate profiles: **${all.profiles.length}**\n- Vanilla/configured road vehicles: **${all.vanilla.length}**\n- Addon civilian vehicles: **${all.addon.length}**\n- Emergency/faction vehicles: **${all.emergency.length}**\n- Uncertain identities: **${unknown.length}**\n\n## Tier distribution\n\n${Object.entries(counts).map(([k,v]) => `- ${k}: ${v}`).join('\n')}\n\n## Genuinely uncertain models\n\n${unknown.length ? unknown.map((p) => `- \`${p.model}\`: ${p.displayName}; source \`${p.sourceResource}\`.`).join('\n') : 'None.'}\n\nThe sortable numeric dataset is [VEHICLE_PHYSICS_AUDIT.csv](VEHICLE_PHYSICS_AUDIT.csv); the full machine-readable catalog is \`scripts/vehicle_inventory.json\`. Runtime road tests are still required for measured acceleration, braking distance and rollover behavior.\n`;
}

function outputs(all) {
  return new Map([
    [path.join(dynamicsDir, 'shared/classes.lua'), generateArchetypesLua()],
    [path.join(dynamicsDir, 'shared/profiles_vanilla.lua'), generateProfileLua(all.vanilla, 'VanillaProfiles', 'vanilla', 'configured GTA vehicles')],
    [path.join(dynamicsDir, 'shared/profiles_addon.lua'), generateProfileLua(all.addon, 'AddonProfiles', 'addon', 'addon civilian vehicles')],
    [path.join(dynamicsDir, 'shared/profiles_emergency.lua'), generateProfileLua(all.emergency, 'EmergencyProfiles', 'emergency', 'emergency and faction vehicles')],
    [inventoryPath, inventoryJson(all)], [auditCsvPath, auditCsv(all.profiles)], [auditMdPath, auditMarkdown(all)],
  ]);
}

function main() {
  const check = process.argv.includes('--check');
  const all = buildAll();
  let drift = 0;
  for (const [file, content] of outputs(all)) {
    if (check) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) { console.error(`DRIFT ${path.relative(root, file)}`); drift++; }
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }
  console.log(`${check ? 'Checked' : 'Generated'} ${all.profiles.length} profiles (${all.vanilla.length} vanilla, ${all.addon.length} addon, ${all.emergency.length} emergency).`);
  if (check && drift) process.exit(1);
}

if (require.main === module) main();
module.exports = { buildAll, buildProfile, outputs, isEmergency, biasFor };
