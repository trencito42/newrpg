#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'resources/[sunset]/sunset_ui/web/assets/vehicles');
const catalog = fs.readFileSync(path.join(root, 'sql/12-dealership.sql'), 'utf8')
    + '\n' + fs.readFileSync(path.join(root, 'sql/82-public-addon-dealership.sql'), 'utf8');
const models = new Set();
for (const match of catalog.matchAll(/'([A-Za-z0-9_]+)'\s+AS\s+`model`/g)) models.add(match[1]);
for (const match of catalog.matchAll(/UNION ALL SELECT '([A-Za-z0-9_]+)'/g)) models.add(match[1]);
for (const match of catalog.matchAll(/^\s+\('([A-Za-z0-9_]+)',\s+'/gm)) models.add(match[1]);
models.delete('initial_catalog_v1');
const missing = [];
for (const model of models) {
    const webp = path.join(dir, model + '.webp');
    const png = path.join(dir, model + '.png');
    if (!fs.existsSync(webp) && !fs.existsSync(png)) missing.push(model);
}
const fallback = fs.existsSync(path.join(dir, 'fallback.svg'));
console.log('dealership models ' + models.size + ', missing thumbs ' + missing.length + ', fallback ' + fallback);
missing.sort().forEach((model) => console.log('  missing ' + model));
if (!fallback || models.size < 12) process.exit(1);
process.exit(0);
