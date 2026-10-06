#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const catalogPath = path.join(root, 'resources/[sunset]/sunset_shop/shared/catalog.json');
const generatedPath = path.join(root, 'panel/src/generated/shop-catalog.ts');

const before = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, 'utf8') : '';

const sync = spawnSync(process.execPath, [path.join(root, 'scripts/sync-shop-catalog.mjs')], {
  cwd: root,
  encoding: 'utf8',
});
if (sync.status !== 0) {
  console.error(sync.stderr || sync.stdout);
  process.exit(sync.status || 1);
}

const after = fs.readFileSync(generatedPath, 'utf8');
if (before !== after) {
  console.error('panel shop catalog is stale — run: node scripts/sync-shop-catalog.mjs');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const ids = Object.keys(catalog.products || {});
for (const id of ids) {
  const p = catalog.products[id];
  if (p.id !== id) {
    console.error(`catalog product id mismatch: ${id}`);
    process.exit(1);
  }
}

console.log(`shop catalog OK (${ids.length} products)`);
