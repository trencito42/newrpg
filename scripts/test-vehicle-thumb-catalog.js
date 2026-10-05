#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildCustomCatalog } = require('../resources/racket_vehicle_thumbs/code/processor');
const vanillaModels = require('../resources/racket_vehicle_thumbs/code/vanilla_models.json');
const { VANILLA } = require('./vehicle-physics/catalog');

const root = path.resolve(__dirname, '..');
const resources = [
  ['pitd_tol_car_pack_a', 'resources/[cars]/pitd_tol_car_pack_a'],
  ['showcasecars', 'resources/[cars]/showcasecars'],
  ['showcasecars2', 'resources/[cars]/showcasecars2'],
  ['sunset_addon_vehicles', 'resources/[sunset]/sunset_addon_vehicles'],
].map(([name, relativePath]) => ({ name, path: path.join(root, relativePath) }));

function runtime(entries) {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    count: () => entries.length,
    nameAt: (index) => entries[index] && entries[index].name,
    state: (name) => byName.get(name).state || 'started',
    resourcePath: (name) => byName.get(name).path,
  };
}

assert.deepEqual(
  [...vanillaModels].sort(),
  Object.keys(VANILLA).sort(),
  'runtime vanilla filter must stay in sync with the project vehicle catalogue'
);

const actual = buildCustomCatalog(runtime(resources));
assert.equal(actual.stats.vehicleResources, 4);
assert.equal(actual.stats.metaFiles, 126);
assert.equal(actual.stats.parseErrors, 0);
assert.equal(actual.stats.scanErrors, 0);
for (const model of [
  'elegyxa19', 'elegyxa19ven', 'neonvenm', 'paragonven', 'cometnor',
  'cometven', 'coquettepiston', 'draftven', 'jubven', 'remusx',
]) {
  assert(actual.models.includes(model), `expected repository addon model ${model}`);
}
assert(actual.byResource.showcasecars.includes('elegyxa19'));
assert(actual.byResource.showcasecars2.includes('varx'));
assert(actual.byResource.pitd_tol_car_pack_a.includes('tol22m5'));
assert(actual.byResource.sunset_addon_vehicles.includes('tempesta2'));

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vehicle-catalog-'));
try {
  fs.writeFileSync(path.join(fixtureRoot, 'vehicles.meta'), `
    <modelName>ADDER</modelName>
    <modelName>Custom_Test</modelName>
    <modelName>custom_test</modelName>
  `);
  const fixture = buildCustomCatalog(runtime([{ name: 'fixture_pack', path: fixtureRoot }]));
  assert.deepEqual(fixture.models, ['custom_test']);
  assert.equal(fixture.stats.vanillaIgnored, 1);
  assert.equal(fixture.stats.duplicatesIgnored, 1);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`Vehicle thumb catalogue check passed: ${actual.stats.vehicleResources} resources, ${actual.stats.metaFiles} metadata files, ${actual.models.length} custom models.`);
