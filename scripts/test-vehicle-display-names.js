#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const meta = read('resources/[sunset]/sunset_addon_vehicles/vehicles.meta');
const seed = read('sql/53-addon-vehicles.sql');
const fallback = read('resources/[sunset]/sunset_vehicles/shared/display_names.lua');
const packFallback = read('resources/[sunset]/sunset_vehicles/shared/addon_pack_names.lua');
const discovered = JSON.parse(read('scripts/discovered_addon_vehicles.json'));
const models = [...meta.matchAll(/<modelName>([^<]+)<\/modelName>/g)].map((match) => match[1]);
const expected = new Map([
    ['tempesta2', 'Tempesta Widebody'],
    ['sentinel_rts', 'Sentinel RTS Track'],
    ['d7cyp', 'Cypher GTS Spec'],
    ['schlagenstr', 'Schlagen STR AMG'],
    ['cometcup', 'Comet Cup Edition'],
    ['h4rxst2', 'Harx ST2 GT'],
]);
assert.strictEqual(models.length, expected.size, 'audit every first-party streamed vehicle model');
for (const model of models) {
    const label = expected.get(model.toLowerCase());
    assert(label, `MISSING LABEL: first-party streamed addon ${model}`);
    assert(seed.includes(`'${model}', '${label}'`), `catalog seed missing ${model} -> ${label}`);
    assert(fallback.includes(`${model.toLowerCase()} = { label = '${label}'`), `shared fallback missing ${model}`);
}

const baseEntries = new Map(
    [...fallback.matchAll(/^\s*([A-Za-z0-9_]+)\s*=\s*\{\s*label\s*=\s*'([^']+)'/gm)]
        .map((match) => [match[1].toLowerCase(), match[2]])
);
const packEntries = new Map(
    [...packFallback.matchAll(/^([A-Za-z0-9_]+)\|([^|\r\n]+)\|/gm)]
        .map((match) => [match[1].toLowerCase(), match[2].trim()])
);
const discoveredModels = new Set();
for (const vehicle of discovered) {
    const key = String(vehicle.model || '').toLowerCase();
    assert(key, 'discovered addon entry missing model');
    assert(!discoveredModels.has(key), `duplicate discovered addon model ${key}`);
    discoveredModels.add(key);

    const label = baseEntries.get(key) || packEntries.get(key);
    assert(label, `MISSING LABEL: discovered addon ${key}`);
    assert(!['NULL', 'CARNOTFOUND', 'UNDEFINED', 'NIL'].includes(label.toUpperCase()), `invalid display label for ${key}`);

    if (key.startsWith('tol')) {
        assert(label.toLowerCase() !== key, `TOL addon still exposes technical name ${key}`);
        assert(!label.toLowerCase().startsWith('tol'), `TOL addon still looks technical: ${key} -> ${label}`);
    }
}
assert.strictEqual(baseEntries.size + packEntries.size, discoveredModels.size, 'display-name catalog should cover discovered addons exactly');

const playerVisible = [
    'resources/[sunset]/sunset_ui/web/js/panels.js',
    'resources/[sunset]/sunset_ui/web/js/menu.js',
    'resources/[sunset]/sunset_ui/web/js/impound.js',
    'resources/[sunset]/sunset_ui/web/js/mdc_tablet.js',
    'panel/src/app/my-character/vehicles/page.tsx',
    'panel/src/app/players/[id]/page.tsx',
    'panel/src/app/stats/page.tsx',
];
for (const file of playerVisible) {
    const code = read(file);
    assert(!/\$\{(?:v|veh|vehicle|selected)\.model\}/.test(code), `raw model interpolation in ${file}`);
    assert(!/>\{(?:v|veh|featuredVehicle)\.model\}</.test(code), `raw model JSX text in ${file}`);
    assert(!/alt=\{(?:v|veh|featuredVehicle)\.model\}/.test(code), `raw model JSX alt in ${file}`);
}
const clientResolver = read('resources/[sunset]/sunset_vehicles/client/display_names.lua');
assert(clientResolver.includes('registerAddonNativeLabels'), 'addon labels must be registered with GTA native text labels');
assert(clientResolver.includes('AddTextEntry(model, metadata.label)'), 'raw addon gameName keys must be overridden');
assert(read('resources/[sunset]/sunset_vehicles/server/main.lua').includes('row.displayName = getVehicleDisplayName(row.model)'), 'owned vehicle DTO requires displayName');
assert(read('resources/[sunset]/sunset_vehicles/server/main.lua').includes('displayName   = displayModel'), 'entry DTO requires display label');
assert(read('resources/[sunset]/sunset_vehicles/client/main.lua').includes('model = info.displayName or exports.sunset_vehicles:GetVehicleDisplayName(info.model)'), 'entry chat must use friendly displayName');
assert(read('resources/[sunset]/sunset_carjack/client/main.lua').includes('exports.sunset_vehicles:GetVehicleDisplayName(veh)'), 'carjack interaction must use friendly displayName');
assert(read('resources/[sunset]/sunset_hud/client/main.lua').includes('tostring(data.vehicleName)'), 'HUD change detection must include the vehicle name');
console.log(`Vehicle names: ${discoveredModels.size} discovered addons labeled; key player-facing surfaces avoid direct model interpolation.`);
