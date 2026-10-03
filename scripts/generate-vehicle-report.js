#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'vehicle_inventory.json'), 'utf8'));
const count = (sourceGroup) => inventory.filter((vehicle) => vehicle.sourceGroup === sourceGroup).length;
const uncertain = inventory.filter((vehicle) => vehicle.identityConfidence === 'uncertain').length;

const document = `# Vehicle dynamics report

This repository uses a generated canonical vehicle-physics catalog. The maintained inputs are \`scripts/vehicle-physics/catalog.js\` and the vehicle metadata under \`resources/\`; generated Lua profiles must not be edited by hand.

| Inventory | Profiles |
| --- | ---: |
| Vanilla/configured road vehicles | ${count('vanilla')} |
| Addon civilian vehicles | ${count('addon')} |
| Emergency/faction vehicles | ${count('emergency')} |
| Total | ${inventory.length} |
| Identity explicitly left uncertain | ${uncertain} |

The complete per-model audit, including drivetrain, archetype, tier, target speed, mass, traction, rollover controls, source metadata and confidence, is in [\`docs/vehicles/VEHICLE_PHYSICS_AUDIT.md\`](vehicles/VEHICLE_PHYSICS_AUDIT.md) and [\`docs/vehicles/VEHICLE_PHYSICS_AUDIT.csv\`](vehicles/VEHICLE_PHYSICS_AUDIT.csv).

## Runtime pipeline

\`sunset_vehicle_dynamics\` applies the canonical stock baseline once per entity. \`sunset_tuning\` captures that immutable handling baseline, restores it before each calculation, then layers hardware and ECU changes on top. Removing a tune restores the canonical baseline and the vehicle's own hardware state.

Run \`npm run audit:vehicles\` after changing metadata or catalog rules. Use \`/vehphysics\` and \`/reapplyhandling\` as a level-2 administrator for live diagnosis; developer-only \`/handlingtest\` remains behind \`Config.Debug\`.
`;

const outputPath = path.join(root, 'docs/VEHICLE_DYNAMICS_REPORT.md');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== document) {
    console.error('docs/VEHICLE_DYNAMICS_REPORT.md is stale; run node scripts/generate-vehicle-report.js.');
    process.exit(1);
  }
  console.log(`Vehicle dynamics report is current (${inventory.length} profiles).`);
} else {
  fs.writeFileSync(outputPath, document);
  console.log(`Wrote docs/VEHICLE_DYNAMICS_REPORT.md for ${inventory.length} profiles.`);
}
