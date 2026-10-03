/**
 * Comprehensive Vehicle Dynamics Validation & Consistency Suite
 * Verifies namespace integrity, manifest order, export parity, addon vehicle coverage,
 * physics limits, tuning integration, and security gating.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vdDir = path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics');

console.log('===============================================================');
console.log('  RUNNING PRODUCTION VEHICLE DYNAMICS VERIFICATION SUITE');
console.log('===============================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`[PASS] ${message}`);
    passedTests++;
  }
}

// -------------------------------------------------------------
// Test 1: File Existence
// -------------------------------------------------------------
const requiredFiles = [
  'fxmanifest.lua',
  'shared/config.lua',
  'shared/classes.lua',
  'shared/registry.lua',
  'shared/resolver.lua',
  'shared/profiles_vanilla.lua',
  'shared/profiles_addon.lua',
  'shared/profiles_emergency.lua',
  'client/baseline.lua',
  'client/apply.lua',
  'client/lifecycle.lua',
  'client/diagnostics.lua',
  'server/main.lua'
];

let filesExist = true;
for (const f of requiredFiles) {
  if (!fs.existsSync(path.join(vdDir, f))) {
    console.error(`Missing required file: ${f}`);
    filesExist = false;
  }
}
assert(filesExist, `All ${requiredFiles.length} core files present in sunset_vehicle_dynamics.`);

// -------------------------------------------------------------
// Test 2: Canonical Namespace Consistency (Zero Legacy Globals)
// -------------------------------------------------------------
const forbiddenGlobals = [
  'SunsetDynamics',
  'SunsetVehicleDynamicsConfig',
  'SunsetVehicleDynamicsArchetypes',
  'SunsetVehicleDynamicsClassMapping'
];

let foundForbidden = false;
function checkDirForGlobals(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) checkDirForGlobals(full);
    else if (ent.name.endsWith('.lua')) {
      const content = fs.readFileSync(full, 'utf8');
      for (const fg of forbiddenGlobals) {
        if (content.includes(fg)) {
          console.error(`Forbidden legacy global '${fg}' found in ${path.relative(root, full)}`);
          foundForbidden = true;
        }
      }
    }
  }
}
checkDirForGlobals(vdDir);
assert(!foundForbidden, 'Zero legacy or inconsistent namespace globals found in codebase.');

// -------------------------------------------------------------
// Test 3: Manifest Load Order (Registry before Profiles)
// -------------------------------------------------------------
const manifestContent = fs.readFileSync(path.join(vdDir, 'fxmanifest.lua'), 'utf8');
const sharedScriptsMatch = manifestContent.match(/shared_scripts\s*\{([\s\S]*?)\}/);
assert(sharedScriptsMatch != null, 'shared_scripts section found in fxmanifest.lua');

if (sharedScriptsMatch) {
  const scripts = [...sharedScriptsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  const configIdx = scripts.indexOf('shared/config.lua');
  const classesIdx = scripts.indexOf('shared/classes.lua');
  const registryIdx = scripts.indexOf('shared/registry.lua');
  const resolverIdx = scripts.indexOf('shared/resolver.lua');
  const vanillaIdx = scripts.indexOf('shared/profiles_vanilla.lua');
  const addonIdx = scripts.indexOf('shared/profiles_addon.lua');
  const emergIdx = scripts.indexOf('shared/profiles_emergency.lua');

  assert(configIdx !== -1 && classesIdx !== -1 && registryIdx !== -1 && resolverIdx !== -1, 'All shared core scripts declared.');
  assert(registryIdx < vanillaIdx && registryIdx < addonIdx && registryIdx < emergIdx, 'shared/registry.lua loads BEFORE profile files.');
}

// -------------------------------------------------------------
// Test 4: Manifest Exports Match Implementations
// -------------------------------------------------------------
const expectedClientExports = ['GetCanonicalBaseline', 'GetVehicleDynamicsProfile', 'ApplyVehicleDynamics', 'IsVehicleManaged'];
const expectedServerExports = ['GetVehicleDynamicsProfile', 'GetModelProfile'];

let clientExportsMatch = true;
for (const exp of expectedClientExports) {
  if (!manifestContent.includes(`'${exp}'`)) {
    console.error(`Missing client export '${exp}' in fxmanifest.lua`);
    clientExportsMatch = false;
  }
}
assert(clientExportsMatch, 'All client exports declared in fxmanifest.lua.');

const baselineContent = fs.readFileSync(path.join(vdDir, 'client/baseline.lua'), 'utf8');
const applyContent = fs.readFileSync(path.join(vdDir, 'client/apply.lua'), 'utf8');
const serverContent = fs.readFileSync(path.join(vdDir, 'server/main.lua'), 'utf8');

for (const exp of expectedClientExports) {
  assert(baselineContent.includes(`exports('${exp}'`) || applyContent.includes(`exports('${exp}'`), `Client export '${exp}' implemented.`);
}

for (const exp of expectedServerExports) {
  assert(serverContent.includes(`exports('${exp}'`), `Server export '${exp}' implemented.`);
}

// -------------------------------------------------------------
// Test 5: Addon Vehicle Coverage Against vehicles.meta
// -------------------------------------------------------------
function extractProfiles(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const modelMatches = [...content.matchAll(/\['([a-zA-Z0-9_]+)'\]\s*=\s*\{/g)];
  return modelMatches.map(m => m[1].toLowerCase());
}

const vanillaModels = extractProfiles(path.join(vdDir, 'shared/profiles_vanilla.lua'));
const addonModels = extractProfiles(path.join(vdDir, 'shared/profiles_addon.lua'));
const emergencyModels = extractProfiles(path.join(vdDir, 'shared/profiles_emergency.lua'));

console.log(`\n  Profile Counts:`);
console.log(`    Vanilla Profiles:   ${vanillaModels.length}`);
console.log(`    Addon Profiles:     ${addonModels.length}`);
console.log(`    Emergency Profiles: ${emergencyModels.length}`);
console.log(`    TOTAL EXPLICIT:     ${vanillaModels.length + addonModels.length + emergencyModels.length}\n`);

// Check for duplicates
const allExplicit = new Map();
let duplicateCount = 0;
function registerCheck(list, group) {
  for (const m of list) {
    if (allExplicit.has(m)) {
      console.error(`Duplicate model profile: '${m}' in ${group} (already defined in ${allExplicit.get(m)})`);
      duplicateCount++;
    } else {
      allExplicit.set(m, group);
    }
  }
}
registerCheck(vanillaModels, 'vanilla');
registerCheck(addonModels, 'addon');
registerCheck(emergencyModels, 'emergency');
assert(duplicateCount === 0, 'Zero duplicate model profiles across all categories.');

// Check discovered vehicles coverage
const discovered = JSON.parse(fs.readFileSync(path.join(root, 'scripts/discovered_addon_vehicles.json'), 'utf8'));
let missingAddons = 0;
for (const v of discovered) {
  if (!allExplicit.has(v.model)) {
    console.error(`Discovered addon vehicle '${v.model}' has NO explicit profile!`);
    missingAddons++;
  }
}
assert(missingAddons === 0, `100% of discovered addon vehicles (${discovered.length}/${discovered.length}) have explicit canonical profiles.`);

// Dealership seeds are player-facing inventory even when they use vanilla models.
const dealershipSql = [
  fs.readFileSync(path.join(root, 'sql/12-dealership.sql'), 'utf8'),
  fs.readFileSync(path.join(root, 'sql/53-addon-vehicles.sql'), 'utf8'),
].join('\n');
const dealershipModels = new Set([
  ...[...dealershipSql.matchAll(/'([a-zA-Z0-9_]+)'\s+AS\s+`model`/g)].map((match) => match[1].toLowerCase()),
  ...[...dealershipSql.matchAll(/UNION\s+ALL\s+SELECT\s+'([a-zA-Z0-9_]+)'/gi)].map((match) => match[1].toLowerCase()),
  ...[...dealershipSql.matchAll(/^\s*\('([a-zA-Z0-9_]+)'\s*,/gm)].map((match) => match[1].toLowerCase()),
]);
const missingDealership = [...dealershipModels].filter((model) => !allExplicit.has(model));
assert(missingDealership.length === 0, `All ${dealershipModels.size} dealership seed models have explicit canonical profiles.`);

// -------------------------------------------------------------
// Test 6: Old Police Handling Migration Parity
// -------------------------------------------------------------
const oldPoliceModels = ['police', 'police2', 'police3', 'police4', 'sheriff', 'sheriff2', 'fbi', 'fbi2'];
let missingPolice = 0;
for (const m of oldPoliceModels) {
  if (!emergencyModels.includes(m)) {
    console.error(`Old police model '${m}' missing from emergency profiles!`);
    missingPolice++;
  }
}
assert(missingPolice === 0, `All legacy sunset_police_handling models (${oldPoliceModels.join(', ')}) migrated.`);

// -------------------------------------------------------------
// Test 7: Tuning Integration
// -------------------------------------------------------------
const tuningBaseline = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/baseline.lua'), 'utf8');
const tuningApply = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/apply.lua'), 'utf8');
assert(tuningBaseline.includes('sunset_vehicle_dynamics'), 'sunset_tuning checks sunset_vehicle_dynamics.');
assert(tuningBaseline.includes('GetCanonicalBaseline'), 'sunset_tuning queries GetCanonicalBaseline.');
assert(tuningBaseline.includes('ApplyVehicleDynamics'), 'sunset_tuning calls ApplyVehicleDynamics on stock reset.');
assert(tuningBaseline.includes('STC.modelBaselines[modelHash] = copyTable(handlingBaseline)'), 'Model baseline cache contains handling only, isolated from entity hardware.');
assert(tuningApply.includes('priorState.modelHash == modelHash'), 'Repeated tuning reuses the original entity baseline without stacking.');
assert(tuningApply.includes("AddEventHandler('sunset:vehicleDynamics:applied'"), 'Persisted tunes are restored after canonical dynamics reapplication.');
assert(applyContent.includes("TriggerEvent('sunset:vehicleDynamics:applied'"), 'Dynamics application publishes the tuning integration event.');

// -------------------------------------------------------------
// Test 8: Server Startup Order
// -------------------------------------------------------------
const serverCfg = fs.readFileSync(path.join(root, 'config/server.cfg.template'), 'utf8');
const vdPos = serverCfg.indexOf('ensure sunset_vehicle_dynamics');
const tuningPos = serverCfg.indexOf('ensure sunset_tuning');
assert(vdPos !== -1 && tuningPos !== -1 && vdPos < tuningPos, 'sunset_vehicle_dynamics starts BEFORE sunset_tuning in server.cfg.template.');

// -------------------------------------------------------------
// Test 9: Diagnostic Security Gating
// -------------------------------------------------------------
const diagContent = fs.readFileSync(path.join(vdDir, 'client/diagnostics.lua'), 'utf8');
assert(diagContent.includes('if not SunsetVehicleDynamics.Config.Debug then'), 'Developer benchmark command is gated by Config.Debug.');
assert(serverContent.includes("exports.sunset_admin:IsAdmin(source, 2)"), 'Production diagnostic commands require sunset_admin level 2.');
assert(serverContent.includes("RegisterCommand('vehphysics'") && serverContent.includes("RegisterCommand('reapplyhandling'"), 'Admin vehicle diagnostic and reapply commands are registered server-side.');

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n===============================================================');
console.log(`  SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('===============================================================');

if (failedTests > 0) {
  process.exit(1);
}
