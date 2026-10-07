#!/usr/bin/env node
'use strict';

/**
 * Writes native GTA handlingId references into addon vehicles.meta files.
 * Does not modify spawn names, models, or other metadata.
 */

const fs = require('fs');
const path = require('path');
const { resolveIdentity } = require('./vehicle-physics/catalog');
const { buildDonorMap, normalizeHandlingId } = require('./vehicle-physics/handling-donors');
const { isVanillaHandlingId } = require('./vehicle-physics/gta-vanilla-handling-index');

const root = path.resolve(__dirname, '..');
const discoveredPath = path.join(__dirname, 'discovered_addon_vehicles.json');

function isEmergency(raw) {
  const model = String(raw.model || '').toLowerCase();
  const cls = String(raw.vehicleClass || '').toUpperCase();
  return cls.includes('EMERGENCY') || /(pd|police|sheriff|fbi|vmark|wmark|mark|mech|ambo)$/.test(model);
}

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

function tag(segment, name) {
  const textMatch = segment.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'));
  if (textMatch) return textMatch[1].trim();
  const valueMatch = segment.match(new RegExp(`<${name}[^>]*\\bvalue=["']([^"']*)["'][^>]*/?>`, 'i'));
  return valueMatch ? valueMatch[1].trim() : '';
}

function segmentsFromTag(xml, marker) {
  const starts = [...xml.matchAll(new RegExp(`<${marker}[^>]*>`, 'gi'))].map((m) => m.index);
  return starts.map((start, index) => xml.slice(start, starts[index + 1] ?? xml.length));
}

function setHandlingId(segment, donorId) {
  const id = normalizeHandlingId(donorId);
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
  const addonVehicles = JSON.parse(fs.readFileSync(discoveredPath, 'utf8'));
  const records = addonVehicles.map((raw) => ({
    model: raw.model.toLowerCase(),
    emergency: isEmergency(raw),
    identity: resolveIdentity(raw.model, raw.vehicleClass, isEmergency(raw)),
  }));
  const donorMap = buildDonorMap(records);

  const changes = [];
  for (const file of findVehicleMetaFiles()) {
    let xml = fs.readFileSync(file, 'utf8');
    let fileChanged = false;
    for (const segment of segmentsFromTag(xml, 'modelName')) {
      const model = tag(segment, 'modelName').toLowerCase();
      if (!model || !donorMap.has(model)) continue;
      const donor = donorMap.get(model);
      if (!isVanillaHandlingId(donor.donorId)) {
        throw new Error(`${model}: invalid donor ${donor.donorId}`);
      }
      const current = tag(segment, 'handlingId');
      if (normalizeHandlingId(current) === donor.donorId) continue;
      const updatedSegment = setHandlingId(segment, donor.donorId);
      if (updatedSegment === segment) continue;
      xml = xml.replace(segment, updatedSegment);
      fileChanged = true;
      changes.push({ model, from: current, to: donor.donorId, file: path.relative(root, file) });
    }
    if (fileChanged) {
      if (!check) fs.writeFileSync(file, xml);
    }
  }

  const mapPath = path.join(root, 'docs/vehicles/HANDLING_DONOR_MAP.csv');
  const csvHeader = 'model,donor_handling_id,confidence,source,note\n';
  const csvRows = [...donorMap.values()]
    .sort((a, b) => a.model.localeCompare(b.model))
    .map((d) => `"${d.model}","${d.donorId}","${d.confidence}","${d.source}","${String(d.note || '').replace(/"/g, '""')}"`)
    .join('\n');
  const csv = csvHeader + csvRows + '\n';

  if (check) {
    const currentCsv = fs.existsSync(mapPath) ? fs.readFileSync(mapPath, 'utf8') : '';
    if (currentCsv !== csv) {
      console.error('HANDLING_DONOR_MAP.csv drift — run node scripts/apply-handling-donor-meta.js');
      process.exit(1);
    }
    if (changes.length) {
      console.error(`vehicles.meta drift for ${changes.length} model(s); run apply-handling-donor-meta without --check`);
      process.exit(1);
    }
    console.log(`Donor meta check OK (${donorMap.size} addon models).`);
    return;
  }

  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, csv);
  console.log(`Updated ${changes.length} handlingId reference(s) across vehicles.meta.`);
  console.log(`Wrote ${donorMap.size} rows to ${path.relative(root, mapPath)}.`);
}

if (require.main === module) main();

module.exports = { main };
