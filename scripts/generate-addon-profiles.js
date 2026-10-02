const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vdDir = path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics');
const allVehicles = JSON.parse(fs.readFileSync(path.join(root, 'scripts/discovered_addon_vehicles.json'), 'utf8'));

const emergency = [];
const civilian = [];

for (const v of allVehicles) {
  const isEmerg = v.vehicleClass.includes('EMERGENCY') || v.model.endsWith('pd') || v.model.includes('police') || v.model.includes('sheriff') || v.model.includes('fbi') || v.model.includes('ambo') || v.model.includes('mech');
  if (isEmerg) emergency.push(v);
  else civilian.push(v);
}

function determineArchetype(v, isEmergency) {
  if (isEmergency) {
    if (v.vehicleClass.includes('SUV') || (v.rawHandling && v.rawHandling.fMass > 2200)) return 'emergency_suv';
    return 'emergency_sedan';
  }

  const cls = (v.vehicleClass || '').toUpperCase();
  const raw = v.rawHandling || {};
  const driveBias = raw.fDriveBiasFront != null ? raw.fDriveBiasFront : 0.0;
  const isAWD = driveBias >= 0.25 && driveBias <= 0.75;
  const isFWD = driveBias > 0.75;

  if (cls.includes('MOTORCYCLE')) return 'motorcycle_sport';
  if (cls.includes('SUPER')) return isAWD ? 'super_awd' : 'super_rwd';
  if (cls.includes('SPORT')) return isAWD ? 'sports_awd' : (isFWD ? 'compact_fwd' : 'sports_rwd');
  if (cls.includes('MUSCLE')) return 'muscle_rwd';
  if (cls.includes('SUV')) return 'suv_awd';
  if (cls.includes('OFF_ROAD') || cls.includes('OFFROAD')) return 'offroad';
  if (cls.includes('COMPACT')) return isFWD ? 'compact_fwd' : 'sports_rwd';
  if (cls.includes('SEDAN') || cls.includes('COUPE')) return isAWD ? 'sedan_awd' : 'sedan_rwd';
  if (cls.includes('VAN') || cls.includes('SERVICE')) return 'van';

  const mass = raw.fMass || 1500;
  if (mass > 2200) return isAWD ? 'suv_awd' : 'sedan_rwd';
  if (mass < 1300 && isFWD) return 'compact_fwd';
  if ((raw.fInitialDriveForce || 0.3) > 0.35) return isAWD ? 'super_awd' : 'super_rwd';
  return isAWD ? 'sports_awd' : 'sports_rwd';
}

function buildHandlingProfile(v, isEmergency) {
  const arch = determineArchetype(v, isEmergency);
  const raw = v.rawHandling || {};

  let mass = raw.fMass || 1500.0;
  if (mass < 800) mass = 1200.0;
  if (mass > 3500) mass = 2800.0;

  let driveBias = raw.fDriveBiasFront != null ? raw.fDriveBiasFront : 0.0;
  let drivetrain = 'rwd';
  if (driveBias >= 0.25 && driveBias <= 0.75) {
    drivetrain = 'awd';
    if (driveBias < 0.30) driveBias = 0.35;
    if (driveBias > 0.50) driveBias = 0.50;
  } else if (driveBias > 0.75) {
    drivetrain = 'fwd';
    driveBias = 1.0;
  } else {
    drivetrain = 'rwd';
    driveBias = 0.0;
  }

  let driveForce = raw.fInitialDriveForce || (isEmergency ? 0.35 : 0.32);
  if (driveForce > 0.42) driveForce = 0.40;
  if (driveForce < 0.23) driveForce = 0.26;

  let maxFlatVel = raw.fInitialDriveMaxFlatVel || (isEmergency ? 168.0 : 165.0);
  if (maxFlatVel > 210.0) maxFlatVel = 195.0;
  if (maxFlatVel < 130.0) maxFlatVel = 145.0;

  let brakeForce = raw.fBrakeForce || (isEmergency ? 1.00 : 0.90);
  if (brakeForce > 1.25) brakeForce = 1.15;
  if (brakeForce < 0.65) brakeForce = 0.75;

  let tractionMax = raw.fTractionCurveMax || (isEmergency ? 2.50 : 2.45);
  if (tractionMax > 2.80) tractionMax = 2.72;
  if (tractionMax < 2.10) tractionMax = 2.25;

  let tractionMin = raw.fTractionCurveMin || (tractionMax * 0.90);
  if (tractionMin >= tractionMax) tractionMin = tractionMax * 0.92;

  let steerLock = raw.fSteeringLock || 38.0;
  if (steerLock > 43.0) steerLock = 40.0;
  if (steerLock < 33.0) steerLock = 36.0;

  let gears = raw.nInitialDriveGears || 6;
  if (gears < 4) gears = 5;
  if (gears > 8) gears = 8;

  return {
    archetype: arch,
    category: isEmergency ? ('police_' + (arch.includes('suv') ? 'suv' : 'sedan')) : ('addon_' + (v.vehicleClass ? v.vehicleClass.replace('VC_', '').toLowerCase() : 'custom')),
    drivetrain: drivetrain,
    weightKg: Math.round(mass),
    handling: {
      fMass: Number(mass.toFixed(1)),
      fInitialDragCoeff: arch.includes('super') ? 6.0 : (arch.includes('suv') ? 8.0 : 6.8),
      vecCentreOfMassOffset: { x: 0.0, y: 0.0, z: arch.includes('super') ? -0.12 : (arch.includes('suv') ? 0.01 : -0.09) },
      fDriveBiasFront: Number(driveBias.toFixed(2)),
      nInitialDriveGears: gears,
      fInitialDriveForce: Number(driveForce.toFixed(3)),
      fDriveInertia: 1.0,
      fInitialDriveMaxFlatVel: Number(maxFlatVel.toFixed(1)),
      fBrakeForce: Number(brakeForce.toFixed(2)),
      fBrakeBiasFront: drivetrain === 'fwd' ? 0.60 : 0.53,
      fHandBrakeForce: 0.75,
      fSteeringLock: Number(steerLock.toFixed(1)),
      fTractionCurveMax: Number(tractionMax.toFixed(2)),
      fTractionCurveMin: Number(tractionMin.toFixed(2)),
      fSuspensionForce: arch.includes('super') ? 2.6 : (arch.includes('suv') ? 2.4 : 2.2),
      fSuspensionCompDamp: arch.includes('super') ? 1.9 : 1.6,
      fSuspensionReboundDamp: arch.includes('super') ? 3.3 : 2.8,
      fAntiRollBarForce: arch.includes('super') ? 1.40 : (arch.includes('suv') ? 0.90 : 1.15)
    }
  };
}

function generateLuaFile(modelsList, tableName, registerGroup, headerDesc) {
  let lua = `--[[\n    Sunset Vehicle Dynamics - ${headerDesc}\n    Calibrated canonical handling profiles normalized from repository vehicles.meta and handling.meta.\n]]\n\nSunsetVehicleDynamics = SunsetVehicleDynamics or {}\nSunsetVehicleDynamics.${tableName} = {\n`;

  for (let i = 0; i < modelsList.length; i++) {
    const v = modelsList[i];
    const isEmerg = registerGroup === 'emergency';
    const profile = buildHandlingProfile(v, isEmerg);
    const h = profile.handling;
    const comma = i < modelsList.length - 1 ? ',' : '';

    lua += `    ['${v.model}'] = {\n`;
    lua += `        archetype = '${profile.archetype}',\n`;
    lua += `        category = '${profile.category}',\n`;
    lua += `        drivetrain = '${profile.drivetrain}',\n`;
    lua += `        weightKg = ${profile.weightKg},\n`;
    lua += `        handling = {\n`;
    lua += `            fMass = ${h.fMass},\n`;
    lua += `            fInitialDragCoeff = ${h.fInitialDragCoeff},\n`;
    lua += `            vecCentreOfMassOffset = { x = ${h.vecCentreOfMassOffset.x}, y = ${h.vecCentreOfMassOffset.y}, z = ${h.vecCentreOfMassOffset.z} },\n`;
    lua += `            fDriveBiasFront = ${h.fDriveBiasFront},\n`;
    lua += `            nInitialDriveGears = ${h.nInitialDriveGears},\n`;
    lua += `            fInitialDriveForce = ${h.fInitialDriveForce},\n`;
    lua += `            fDriveInertia = ${h.fDriveInertia},\n`;
    lua += `            fInitialDriveMaxFlatVel = ${h.fInitialDriveMaxFlatVel},\n`;
    lua += `            fBrakeForce = ${h.fBrakeForce},\n`;
    lua += `            fBrakeBiasFront = ${h.fBrakeBiasFront},\n`;
    lua += `            fHandBrakeForce = ${h.fHandBrakeForce},\n`;
    lua += `            fSteeringLock = ${h.fSteeringLock},\n`;
    lua += `            fTractionCurveMax = ${h.fTractionCurveMax},\n`;
    lua += `            fTractionCurveMin = ${h.fTractionCurveMin},\n`;
    lua += `            fSuspensionForce = ${h.fSuspensionForce},\n`;
    lua += `            fSuspensionCompDamp = ${h.fSuspensionCompDamp},\n`;
    lua += `            fSuspensionReboundDamp = ${h.fSuspensionReboundDamp},\n`;
    lua += `            fAntiRollBarForce = ${h.fAntiRollBarForce}\n`;
    lua += `        }\n`;
    lua += `    }${comma}\n\n`;
  }

  lua += `}\n\nSunsetVehicleDynamics.RegisterBatch(SunsetVehicleDynamics.${tableName}, '${registerGroup}')\n`;
  return lua;
}

// Generate Addon Profiles
const addonLua = generateLuaFile(civilian, 'AddonProfiles', 'addon', 'Addon Vehicle Profiles');
fs.writeFileSync(path.join(vdDir, 'shared/profiles_addon.lua'), addonLua);
console.log(`Generated profiles_addon.lua with ${civilian.length} addon civilian vehicles.`);

// Generate Emergency Profiles (including vanilla emergency + addon emergency)
const vanillaEmergencyList = [
  { model: 'police', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 1750, fDriveBiasFront: 0.0, fInitialDriveForce: 0.33, fInitialDriveMaxFlatVel: 160, fBrakeForce: 0.95, fTractionCurveMax: 2.45, fSteeringLock: 39, nInitialDriveGears: 6 } },
  { model: 'police2', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 1800, fDriveBiasFront: 0.0, fInitialDriveForce: 0.36, fInitialDriveMaxFlatVel: 170, fBrakeForce: 1.05, fTractionCurveMax: 2.55, fSteeringLock: 38.5, nInitialDriveGears: 6 } },
  { model: 'police3', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 1820, fDriveBiasFront: 0.45, fInitialDriveForce: 0.35, fInitialDriveMaxFlatVel: 168, fBrakeForce: 1.00, fTractionCurveMax: 2.50, fSteeringLock: 38, nInitialDriveGears: 6 } },
  { model: 'police4', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 1720, fDriveBiasFront: 0.0, fInitialDriveForce: 0.33, fInitialDriveMaxFlatVel: 162, fBrakeForce: 0.95, fTractionCurveMax: 2.45, fSteeringLock: 39, nInitialDriveGears: 6 } },
  { model: 'sheriff', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 1760, fDriveBiasFront: 0.0, fInitialDriveForce: 0.33, fInitialDriveMaxFlatVel: 160, fBrakeForce: 0.95, fTractionCurveMax: 2.45, fSteeringLock: 39, nInitialDriveGears: 6 } },
  { model: 'sheriff2', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 2650, fDriveBiasFront: 0.40, fInitialDriveForce: 0.31, fInitialDriveMaxFlatVel: 155, fBrakeForce: 0.88, fTractionCurveMax: 2.30, fSteeringLock: 36, nInitialDriveGears: 6 } },
  { model: 'fbi', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 1800, fDriveBiasFront: 0.0, fInitialDriveForce: 0.36, fInitialDriveMaxFlatVel: 170, fBrakeForce: 1.05, fTractionCurveMax: 2.55, fSteeringLock: 38.5, nInitialDriveGears: 6 } },
  { model: 'fbi2', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 2650, fDriveBiasFront: 0.40, fInitialDriveForce: 0.31, fInitialDriveMaxFlatVel: 155, fBrakeForce: 0.88, fTractionCurveMax: 2.30, fSteeringLock: 36, nInitialDriveGears: 6 } },
  { model: 'pranger', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 2700, fDriveBiasFront: 0.45, fInitialDriveForce: 0.30, fInitialDriveMaxFlatVel: 150, fBrakeForce: 0.85, fTractionCurveMax: 2.25, fSteeringLock: 36, nInitialDriveGears: 6 } },
  { model: 'ambulance', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 3800, fDriveBiasFront: 0.0, fInitialDriveForce: 0.25, fInitialDriveMaxFlatVel: 140, fBrakeForce: 0.72, fTractionCurveMax: 2.05, fSteeringLock: 35, nInitialDriveGears: 5 } },
  { model: 'firetruk', vehicleClass: 'VC_EMERGENCY', rawHandling: { fMass: 8500, fDriveBiasFront: 0.0, fInitialDriveForce: 0.22, fInitialDriveMaxFlatVel: 125, fBrakeForce: 0.60, fTractionCurveMax: 1.90, fSteeringLock: 32, nInitialDriveGears: 6 } }
];

const fullEmergency = [...vanillaEmergencyList, ...emergency];
const emergLua = generateLuaFile(fullEmergency, 'EmergencyProfiles', 'emergency', 'Emergency & Police Vehicle Profiles');
fs.writeFileSync(path.join(vdDir, 'shared/profiles_emergency.lua'), emergLua);
console.log(`Generated profiles_emergency.lua with ${fullEmergency.length} total emergency vehicles (11 vanilla + ${emergency.length} addon).`);
