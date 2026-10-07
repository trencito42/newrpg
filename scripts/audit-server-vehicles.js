#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const resourcesDir = path.join(root, 'resources');
const outputPath = path.join(__dirname, 'discovered_addon_vehicles.json');
const { isVanillaHandlingId, normalizeHandlingId } = require('./vehicle-physics/gta-vanilla-handling-index');
const numericHandlingFields = [
  'fMass', 'fInitialDriveForce', 'fDriveBiasFront', 'fInitialDriveMaxFlatVel',
  'nInitialDriveGears', 'fBrakeForce', 'fTractionCurveMax', 'fTractionCurveMin',
  'fSteeringLock',
];

function findFiles(dir, wanted, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, wanted, results);
    else if (entry.name.toLowerCase() === wanted) results.push(full);
  }
  return results;
}

function tag(segment, name) {
  const textMatch = segment.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'));
  if (textMatch) return textMatch[1].trim();
  const valueMatch = segment.match(new RegExp(`<${name}[^>]*\\bvalue=["']([^"']*)["'][^>]*/?>`, 'i'));
  return valueMatch ? valueMatch[1].trim() : '';
}

function segmentsFromTag(xml, marker) {
  const starts = [...xml.matchAll(new RegExp(`<${marker}[^>]*>`, 'gi'))].map((match) => match.index);
  return starts.map((start, index) => xml.slice(start, starts[index + 1] ?? xml.length));
}

function sourcePath(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function discover() {
  const vehicleFiles = findFiles(resourcesDir, 'vehicles.meta').sort();
  const handlingFiles = findFiles(resourcesDir, 'handling.meta').sort();
  const handling = new Map();
  const duplicateHandling = [];

  for (const file of handlingFiles) {
    const xml = fs.readFileSync(file, 'utf8');
    for (const segment of segmentsFromTag(xml, 'handlingName')) {
      const handlingName = tag(segment, 'handlingName').toLowerCase();
      if (!handlingName) continue;
      const record = { handlingName };
      for (const field of numericHandlingFields) {
        const rawValue = tag(segment, field);
        const value = Number(rawValue);
        if (rawValue !== '' && Number.isFinite(value)) record[field] = value;
      }
      record.source = sourcePath(file);
      if (handling.has(handlingName)) duplicateHandling.push(handlingName);
      else handling.set(handlingName, record);
    }
  }

  const vehicles = new Map();
  const duplicateModels = [];
  for (const file of vehicleFiles) {
    const xml = fs.readFileSync(file, 'utf8');
    for (const segment of segmentsFromTag(xml, 'modelName')) {
      const model = tag(segment, 'modelName').toLowerCase();
      if (!model) continue;
      const handlingIdRaw = tag(segment, 'handlingId');
      const handlingId = handlingIdRaw.toLowerCase();
      const vanillaDonor = isVanillaHandlingId(handlingIdRaw);
      const record = {
        model,
        handlingId,
        nativeDonorHandlingId: vanillaDonor ? normalizeHandlingId(handlingIdRaw) : null,
        gameName: tag(segment, 'gameName'),
        vehicleClass: tag(segment, 'vehicleClass'),
        rawHandling: vanillaDonor
          ? { nativeDonor: true, handlingName: normalizeHandlingId(handlingIdRaw) }
          : (handling.get(handlingId) || null),
        source: sourcePath(file),
      };
      if (vehicles.has(model)) duplicateModels.push(model);
      else vehicles.set(model, record);
    }
  }

  if (duplicateModels.length || duplicateHandling.length) {
    const details = [
      duplicateModels.length ? `duplicate models: ${[...new Set(duplicateModels)].join(', ')}` : '',
      duplicateHandling.length ? `duplicate handling IDs: ${[...new Set(duplicateHandling)].join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`Ambiguous vehicle metadata (${details})`);
  }

  const inventory = [...vehicles.values()].sort((a, b) => a.model.localeCompare(b.model));
  return { inventory, vehicleFiles, handlingFiles };
}

const { inventory, vehicleFiles, handlingFiles } = discover();
const rendered = `${JSON.stringify(inventory, null, 2)}\n`;
const missingHandling = inventory.filter((vehicle) => !vehicle.rawHandling && !vehicle.nativeDonorHandlingId);

if (process.argv.includes('--write')) {
  fs.writeFileSync(outputPath, rendered);
  console.log(`Wrote ${inventory.length} addon models to ${path.relative(root, outputPath)}.`);
} else if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== rendered) {
    console.error('discovered_addon_vehicles.json is stale; run npm run discover:vehicles.');
    process.exit(1);
  }
  console.log(`Vehicle metadata discovery is current (${inventory.length} models).`);
} else {
  console.log(JSON.stringify({
    vehicleMetaFiles: vehicleFiles.length,
    handlingMetaFiles: handlingFiles.length,
    models: inventory.length,
    missingHandling: missingHandling.map((vehicle) => vehicle.model),
  }, null, 2));
}

if (missingHandling.length) {
  console.error(`Missing handling metadata for ${missingHandling.length} model(s).`);
  process.exitCode = 1;
}
