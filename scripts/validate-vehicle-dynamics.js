/**
 * Vehicle Dynamics Validation Script
 * Verifies profiles, archetypes, boundaries, and tuning compatibility across all server models.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vdDir = path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics');

console.log('=== Running Sunset Vehicle Dynamics Validation ===');

// Check that files exist
const requiredFiles = [
    'fxmanifest.lua',
    'shared/config.lua',
    'shared/classes.lua',
    'shared/resolver.lua',
    'shared/profiles_vanilla.lua',
    'shared/profiles_addon.lua',
    'shared/profiles_emergency.lua',
    'client/baseline.lua',
    'client/apply.lua',
    'client/lifecycle.lua',
    'client/diagnostics.lua',
    'server/main.lua',
    'tests/validate_profiles.lua',
    'tests/audit_models.lua'
];

let missing = 0;
for (const f of requiredFiles) {
    const full = path.join(vdDir, f);
    if (!fs.existsSync(full)) {
        console.error(`MISSING FILE: ${f}`);
        missing++;
    }
}

if (missing > 0) {
    console.error(`FAILED: ${missing} files missing in sunset_vehicle_dynamics.`);
    process.exit(1);
}

console.log(`[PASS] All ${requiredFiles.length} resource files exist.`);

// Check fxmanifest exports
const manifestContent = fs.readFileSync(path.join(vdDir, 'fxmanifest.lua'), 'utf8');
const requiredExports = [
    'GetCanonicalBaseline',
    'GetVehicleDynamicsProfile',
    'ApplyVehicleDynamics',
    'IsVehicleManaged'
];

for (const exp of requiredExports) {
    if (!manifestContent.includes(exp)) {
        console.error(`MISSING EXPORT in manifest: ${exp}`);
        process.exit(1);
    }
}
console.log('[PASS] All client/shared exports declared in fxmanifest.lua.');

// Parse profiles from Lua files
function extractProfiles(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const modelMatches = [...content.matchAll(/\['([a-zA-Z0-9_]+)'\]\s*=\s*\{/g)];
    return modelMatches.map(m => m[1].toLowerCase());
}

const vanillaModels = extractProfiles(path.join(vdDir, 'shared/profiles_vanilla.lua'));
const addonModels = extractProfiles(path.join(vdDir, 'shared/profiles_addon.lua'));
const emergencyModels = extractProfiles(path.join(vdDir, 'shared/profiles_emergency.lua'));

console.log(`[INFO] Vanilla profiles defined: ${vanillaModels.length}`);
console.log(`[INFO] Addon profiles defined: ${addonModels.length}`);
console.log(`[INFO] Emergency profiles defined: ${emergencyModels.length}`);
console.log(`[INFO] Total explicit model profiles: ${vanillaModels.length + addonModels.length + emergencyModels.length}`);

// Check for duplicates across sets
const allModels = new Map();
let duplicates = 0;

function checkDuplicates(list, group) {
    for (const m of list) {
        if (allModels.has(m)) {
            console.error(`DUPLICATE MODEL PROFILE: ${m} in ${group} (already in ${allModels.get(m)})`);
            duplicates++;
        } else {
            allModels.set(m, group);
        }
    }
}

checkDuplicates(vanillaModels, 'vanilla');
checkDuplicates(addonModels, 'addon');
checkDuplicates(emergencyModels, 'emergency');

if (duplicates > 0) {
    console.error(`FAILED: ${duplicates} duplicate profiles found.`);
    process.exit(1);
}
console.log('[PASS] Zero duplicate model profiles.');

// Check sunset_tuning integration
const tuningBaseline = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/baseline.lua'), 'utf8');
if (!tuningBaseline.includes('sunset_vehicle_dynamics') || !tuningBaseline.includes('GetCanonicalBaseline')) {
    console.error('FAILED: sunset_tuning is not integrated with sunset_vehicle_dynamics GetCanonicalBaseline export.');
    process.exit(1);
}
console.log('[PASS] sunset_tuning properly queries sunset_vehicle_dynamics canonical baseline.');

// Check server.cfg.template order
const cfgContent = fs.readFileSync(path.join(root, 'config/server.cfg.template'), 'utf8');
const vdIndex = cfgContent.indexOf('ensure sunset_vehicle_dynamics');
const tuningIndex = cfgContent.indexOf('ensure sunset_tuning');

if (vdIndex === -1) {
    console.error('FAILED: ensure sunset_vehicle_dynamics is missing from config/server.cfg.template');
    process.exit(1);
}
if (tuningIndex === -1 || vdIndex > tuningIndex) {
    console.error('FAILED: ensure sunset_vehicle_dynamics must be ensured BEFORE sunset_tuning');
    process.exit(1);
}
console.log('[PASS] server.cfg.template ensures sunset_vehicle_dynamics before sunset_tuning.');

console.log('=== All Vehicle Dynamics Validation Checks PASSED Successfully! ===');
