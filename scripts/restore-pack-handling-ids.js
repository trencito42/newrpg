#!/usr/bin/env node
'use strict';

/**
 * Restore vehicles.meta handlingId to pack-author definitions when handling.meta
 * defines a matching <handlingName>. Does not assign GTA donor IDs.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function findVehicleMetaFiles() {
  const results = [];
  const resourcesDir = path.join(root, 'resources');
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.toLowerCase() === 'vehicles.meta') results.push(full);
    }
  };
  walk(resourcesDir);
  return results.sort();
}

function handlingNamesInFile(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const xml = fs.readFileSync(filePath, 'utf8');
  const map = new Map();
  for (const m of xml.matchAll(/<handlingName>\s*([^<]+?)\s*<\/handlingName>/gi)) {
    const name = m[1].trim();
    map.set(name.toLowerCase(), name);
  }
  return map;
}

function findHandlingMetaFiles(vehiclesMetaPath) {
  const dir = path.dirname(vehiclesMetaPath);
  const found = [];
  const walk = (d, depth) => {
    if (depth > 4 || !fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full, depth + 1);
      else if (ent.name.toLowerCase() === 'handling.meta') found.push(full);
    }
  };
  walk(dir, 0);
  const packRoot = dir;
  walk(path.join(packRoot, '..'), 0);
  return [...new Set(found)];
}

function tag(segment, name) {
  const textMatch = segment.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'));
  if (textMatch) return textMatch[1].trim();
  return '';
}

function segmentsFromTag(xml, marker) {
  const starts = [...xml.matchAll(new RegExp(`<${marker}[^>]*>`, 'gi'))].map((m) => m.index);
  return starts.map((start, index) => xml.slice(start, starts[index + 1] ?? xml.length));
}

function setHandlingId(segment, handlingId) {
  const id = String(handlingId).trim();
  if (segment.match(/<handlingId[^>]*>[^<]*<\/handlingId>/i)) {
    return segment.replace(/<handlingId[^>]*>[^<]*<\/handlingId>/i, `<handlingId>${id}</handlingId>`);
  }
  if (segment.match(/<handlingId[^>]*\/>/i)) {
    return segment.replace(/<handlingId[^>]*\/>/i, `<handlingId>${id}</handlingId>`);
  }
  return segment;
}

function main() {
  const check = process.argv.includes('--check');
  const inventory = [];
  const missing = [];
  const changes = [];

  for (const vehiclesFile of findVehicleMetaFiles()) {
    const handlingMaps = findHandlingMetaFiles(vehiclesFile).map(handlingNamesInFile);
    const merged = new Map();
    for (const m of handlingMaps) {
      for (const [k, v] of m) merged.set(k, v);
    }

    let xml = fs.readFileSync(vehiclesFile, 'utf8');
    let fileChanged = false;

    for (const segment of segmentsFromTag(xml, 'modelName')) {
      const model = tag(segment, 'modelName');
      if (!model) continue;
      const modelKey = model.toLowerCase();
      const packHandling = merged.get(modelKey);
      const current = tag(segment, 'handlingId');

      if (packHandling) {
        inventory.push({
          model: modelKey,
          handlingId: packHandling,
          vehiclesMeta: path.relative(root, vehiclesFile),
          source: 'pack_handling.meta',
        });
        if (current.toLowerCase() !== packHandling.toLowerCase()) {
          const updated = setHandlingId(segment, packHandling);
          xml = xml.replace(segment, updated);
          fileChanged = true;
          changes.push({
            model: modelKey,
            from: current,
            to: packHandling,
            file: path.relative(root, vehiclesFile),
          });
        }
      } else if (current && current.toLowerCase() !== modelKey) {
        missing.push({
          model: modelKey,
          currentHandlingId: current,
          file: path.relative(root, vehiclesFile),
          note: 'no matching handlingName in pack handling.meta',
        });
      }
    }

    if (fileChanged && !check) {
      fs.writeFileSync(vehiclesFile, xml);
    }
  }

  const outPath = path.join(root, 'docs/vehicles/PACK_HANDLING_ID_INVENTORY.json');
  if (!check) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), inventory, missing, changes }, null, 2));
  }

  console.log(`Pack handling inventory: ${inventory.length} models with pack definitions.`);
  console.log(`Restored handlingId changes: ${changes.length}${check ? ' (check only)' : ''}.`);
  if (missing.length) {
    console.log(`Models without pack handlingName (not auto-changed): ${missing.length}`);
    for (const row of missing.slice(0, 20)) {
      console.log(`  - ${row.model}: handlingId=${row.currentHandlingId} (${row.file})`);
    }
    if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);
  }

  if (check && changes.length) {
    console.error('vehicles.meta still points at non-pack handlingId — run without --check');
    process.exit(1);
  }
}

main();
