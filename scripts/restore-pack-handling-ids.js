#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  findVehicleMetaFiles,
  resolveExpectedHandlingId,
  segmentsFromTag,
  tag,
  setHandlingId,
} = require('./lib/pack-handling-meta');

const root = path.resolve(__dirname, '..');

function isAddonVehiclesMeta(file) {
  return file.includes(`${path.sep}[cars]${path.sep}`) || file.includes('/[cars]/')
    || file.includes(`${path.sep}sunset_addon_vehicles${path.sep}`);
}

function main() {
  const check = process.argv.includes('--check');
  const inventory = [];
  const unresolved = [];
  const changes = [];

  for (const vehiclesFile of findVehicleMetaFiles(path.join(root, 'resources'))) {
    if (!isAddonVehiclesMeta(vehiclesFile)) continue;

    let xml = fs.readFileSync(vehiclesFile, 'utf8');
    let fileChanged = false;

    for (const segment of segmentsFromTag(xml, 'modelName')) {
      const model = tag(segment, 'modelName');
      if (!model) continue;
      const modelKey = model.toLowerCase();
      const current = tag(segment, 'handlingId');
      const expected = resolveExpectedHandlingId(vehiclesFile, model);

      if (expected.error) {
        unresolved.push({
          model: modelKey,
          currentHandlingId: current,
          error: expected.error,
          names: expected.names,
          file: path.relative(root, vehiclesFile),
        });
        continue;
      }

      inventory.push({
        model: modelKey,
        handlingId: expected.handlingId,
        rule: expected.rule,
        vehiclesMeta: path.relative(root, vehiclesFile),
      });

      if (current.toLowerCase() !== expected.handlingId.toLowerCase()) {
        const updated = setHandlingId(segment, expected.handlingId);
        xml = xml.replace(segment, updated);
        fileChanged = true;
        changes.push({
          model: modelKey,
          from: current,
          to: expected.handlingId,
          file: path.relative(root, vehiclesFile),
        });
      }
    }

    if (fileChanged && !check) fs.writeFileSync(vehiclesFile, xml);
  }

  const outPath = path.join(root, 'docs/vehicles/PACK_HANDLING_ID_INVENTORY.json');
  if (!check) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), inventory, unresolved, changes }, null, 2),
    );
  }

  console.log(`Pack handling inventory: ${inventory.length} models resolved.`);
  console.log(`Restored handlingId changes: ${changes.length}${check ? ' (check only)' : ''}.`);
  if (unresolved.length) {
    console.log(`Unresolved (manual pack review): ${unresolved.length}`);
    for (const row of unresolved) {
      console.log(`  - ${row.model}: ${row.error} handlingId=${row.currentHandlingId}`);
    }
    if (check) process.exit(1);
  }

  if (check && changes.length) {
    console.error('vehicles.meta drift — run node scripts/restore-pack-handling-ids.js');
    process.exit(1);
  }
}

main();
