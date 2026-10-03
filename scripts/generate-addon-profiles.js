#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { TIERS, ARCHETYPES, VANILLA, resolveIdentity } = require('./vehicle-physics/catalog');

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

function hash01(text) {
  let hash = 2166136261;
  for (const char of text) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967295;
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function biasFor(drivetrain) {
  return ({ rwd: 0.0, fwd: 1.0, awd_rear: 0.32, awd_balanced: 0.5, awd_front: 0.62 })[drivetrain];
}

function buildProfile(record) {
  const identity = record.identity;
  const arch = ARCHETYPES[identity.archetype];
  const tier = TIERS[identity.tier || arch.tier];
  if (!arch) throw new Error(`${record.model}: unknown archetype ${identity.archetype}`);
  if (!tier) throw new Error(`${record.model}: unknown tier ${identity.tier}`);

  const variation = 0.985 + hash01(record.model) * 0.03;
  const targetKmh = round((identity.targetKmh || tier.targetKmh) * variation, 0);
  const drivetrain = identity.drivetrain || arch.drivetrain;
  const driveBias = biasFor(drivetrain);
  if (driveBias === undefined) throw new Error(`${record.model}: unsupported drivetrain ${drivetrain}`);
  const mass = Math.round(identity.mass || arch.mass);
  const grip = identity.grip || arch.grip;
  const comZ = identity.comZ !== undefined ? identity.comZ : arch.comZ;
  const antiRoll = identity.antiRoll || arch.antiRoll;
  const rollFront = identity.rollFront || arch.roll[0];
  const rollRear = identity.rollRear || arch.roll[1];
  const lowLoss = identity.lowLoss || arch.lowLoss;
  const performanceVariation = 0.99 + hash01(`${record.model}:power`) * 0.02;

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
      vecCentreOfMassOffset: { x: 0.0, y: identity.comY || 0.0, z: round(comZ, 3) },
      vecInertiaMultiplier: { x: arch.inertia[0], y: arch.inertia[1], z: arch.inertia[2] },
      fDriveBiasFront: driveBias,
      nInitialDriveGears: identity.gears || tier.gears,
      fInitialDriveForce: round((identity.driveForce || tier.driveForce) * performanceVariation, 3),
      fDriveInertia: round(identity.driveInertia || (tier.driveForce >= 0.4 ? 1.08 : 1.0), 2),
      fClutchChangeRateScaleUpShift: round(identity.shift || tier.shift, 2),
      fClutchChangeRateScaleDownShift: round((identity.shift || tier.shift) * 0.96, 2),
      fInitialDriveMaxFlatVel: round(targetKmh / 1.32, 1),
      fBrakeForce: round(identity.brake || arch.brake, 2),
      fBrakeBiasFront: drivetrain === 'fwd' ? 0.61 : (drivetrain.startsWith('awd') ? 0.54 : 0.52),
      fHandBrakeForce: arch.category === 'muscle' ? 0.82 : 0.72,
      fSteeringLock: round(identity.steer || arch.steer, 1),
      fTractionCurveMax: round(grip, 2),
      fTractionCurveMin: round(grip - arch.gripGap, 2),
      fTractionCurveLateral: round(21.0 + (grip - 2.1) * 3.4, 1),
      fTractionSpringDeltaMax: arch.body === 'suv' || arch.body === 'offroad' || arch.body === 'pickup' ? 0.17 : 0.13,
      fLowSpeedTractionLossMult: round(lowLoss, 2),
      fCamberStiffnesss: 0.0,
      fTractionBiasFront: drivetrain === 'fwd' ? 0.55 : (drivetrain.startsWith('awd') ? 0.5 : 0.47),
      fTractionLossMult: arch.category === 'offroad' ? 0.82 : 1.0,
      fSuspensionForce: arch.suspension[0],
      fSuspensionCompDamp: arch.suspension[1],
      fSuspensionReboundDamp: arch.suspension[2],
      fSuspensionUpperLimit: arch.suspension[3],
      fSuspensionLowerLimit: arch.suspension[4],
      fSuspensionRaise: 0.0,
      fSuspensionBiasFront: drivetrain === 'fwd' ? 0.55 : 0.51,
      fAntiRollBarForce: round(antiRoll, 2),
      fAntiRollBarBiasFront: arch.body === 'suv' ? 0.56 : 0.52,
      fRollCentreHeightFront: round(rollFront, 3),
      fRollCentreHeightRear: round(rollRear, 3),
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
