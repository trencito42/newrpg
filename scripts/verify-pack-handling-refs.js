#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { isVanillaHandlingId } = require('./vehicle-physics/gta-vanilla-handling-index');
const {
  findVehicleMetaFiles,
  resolveExpectedHandlingId,
  segmentsFromTag,
  tag,
  findCarResourceRoot,
  buildHandlingCatalog,
} = require('./lib/pack-handling-meta');

const root = path.resolve(__dirname, '..');

function isAddonVehiclesMeta(file) {
  return file.includes(`${path.sep}[cars]${path.sep}`) || file.includes('/[cars]/')
    || file.includes(`${path.sep}sunset_addon_vehicles${path.sep}`);
}

function main() {
  const errors = [];
  let verified = 0;

  for (const vehiclesFile of findVehicleMetaFiles(path.join(root, 'resources'))) {
    if (!isAddonVehiclesMeta(vehiclesFile)) continue;
    const resourceRoot = findCarResourceRoot(vehiclesFile);
    const catalog = buildHandlingCatalog(resourceRoot);
    const xml = fs.readFileSync(vehiclesFile, 'utf8');

    for (const segment of segmentsFromTag(xml, 'modelName')) {
      const model = tag(segment, 'modelName');
      if (!model) continue;
      const modelKey = model.toLowerCase();
      const current = tag(segment, 'handlingId');
      if (!current) {
        errors.push({ model: modelKey, issue: 'missing_handlingId', file: path.relative(root, vehiclesFile) });
        continue;
      }

      const expected = resolveExpectedHandlingId(vehiclesFile, model);
      if (expected.error) {
        errors.push({ model: modelKey, issue: expected.error, currentHandlingId: current, file: path.relative(root, vehiclesFile) });
        continue;
      }

      if (current.toLowerCase() !== expected.handlingId.toLowerCase()) {
        errors.push({
          model: modelKey,
          issue: 'handlingId_mismatch',
          current,
          expected: expected.handlingId,
          rule: expected.rule,
          file: path.relative(root, vehiclesFile),
        });
        continue;
      }

      const hidKey = current.toLowerCase();
      if (!catalog.has(hidKey)) {
        if (isVanillaHandlingId(current)) {
          errors.push({
            model: modelKey,
            issue: 'rockstar_donor_handlingId',
            handlingId: current,
            file: path.relative(root, vehiclesFile),
          });
        } else {
          errors.push({
            model: modelKey,
            issue: 'handlingId_not_in_resource_handling.meta',
            handlingId: current,
            file: path.relative(root, vehiclesFile),
          });
        }
        continue;
      }

      verified += 1;
    }
  }

  console.log(`Verified addon handling references: ${verified}`);
  if (errors.length) {
    console.error(`FAIL: ${errors.length} problem(s)`);
    errors.slice(0, 30).forEach((e) => console.error(JSON.stringify(e)));
    process.exit(1);
  }
  console.log('Pack handling reference verification passed.');
}

main();
