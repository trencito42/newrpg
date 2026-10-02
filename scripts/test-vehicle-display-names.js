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
const models = [...meta.matchAll(/<modelName>([^<]+)<\/modelName>/g)].map((match) => match[1]);
const expected = new Map([
    ['tempesta2', 'Tempesta Widebody'],
    ['sentinel_rts', 'Sentinel RTS Track'],
    ['d7cyp', 'Cypher GTS Spec'],
    ['schlagenstr', 'Schlagen STR AMG'],
    ['cometcup', 'Comet Cup Edition'],
    ['h4rxst2', 'Harx ST2 GT'],
]);
assert.strictEqual(models.length, expected.size, 'audit every streamed vehicle model');
for (const model of models) {
    const label = expected.get(model.toLowerCase());
    assert(label, `MISSING LABEL: streamed addon ${model}`);
    assert(seed.includes(`'${model}', '${label}'`), `catalog seed missing ${model} -> ${label}`);
    assert(fallback.includes(`${model.toLowerCase()} = { label = '${label}'`), `shared fallback missing ${model}`);
}

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
assert(read('resources/[sunset]/sunset_vehicles/server/main.lua').includes('row.displayName = getVehicleDisplayName(row.model)'), 'owned vehicle DTO requires displayName');
assert(read('resources/[sunset]/sunset_vehicles/server/main.lua').includes('displayName   = displayModel'), 'entry DTO requires display label');
assert(read('resources/[sunset]/sunset_vehicles/client/main.lua').includes('model = info.displayName or exports.sunset_vehicles:GetVehicleDisplayName(info.model)'), 'entry chat must use friendly displayName');
assert(read('resources/[sunset]/sunset_carjack/client/main.lua').includes('exports.sunset_vehicles:GetVehicleDisplayName(veh)'), 'carjack interaction must use friendly displayName');
assert(read('resources/[sunset]/sunset_hud/client/main.lua').includes('tostring(data.vehicleName)'), 'HUD change detection must include the vehicle name');
console.log(`Vehicle names: ${models.length} streamed addons labeled; key player-facing surfaces avoid direct model interpolation.`);
