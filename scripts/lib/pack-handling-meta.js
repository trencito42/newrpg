'use strict';

const fs = require('fs');
const path = require('path');

function findVehicleMetaFiles(resourcesDir) {
  const results = [];
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
  if (!fs.existsSync(filePath)) return [];
  const xml = fs.readFileSync(filePath, 'utf8');
  return [...xml.matchAll(/<handlingName>\s*([^<]+?)\s*<\/handlingName>/gi)].map((m) => m[1].trim());
}

function collectHandlingMetaFiles(resourceRoot) {
  const files = [];
  const walk = (dir, depth) => {
    if (depth > 8 || !fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, depth + 1);
      else if (ent.name.toLowerCase() === 'handling.meta') files.push(full);
    }
  };
  walk(resourceRoot, 0);
  return files;
}

function findCarResourceRoot(vehiclesMetaPath) {
  let dir = path.dirname(vehiclesMetaPath);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'fxmanifest.lua'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(vehiclesMetaPath);
}

function tag(segment, name) {
  const textMatch = segment.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'i'));
  return textMatch ? textMatch[1].trim() : '';
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

function buildHandlingCatalog(resourceRoot) {
  const catalog = new Map();
  for (const file of collectHandlingMetaFiles(resourceRoot)) {
    for (const name of handlingNamesInFile(file)) {
      const key = name.toLowerCase();
      if (!catalog.has(key)) catalog.set(key, { canonical: name, files: [] });
      catalog.get(key).files.push(file);
    }
  }
  return catalog;
}

function resolveExpectedHandlingId(vehiclesMetaPath, modelName) {
  const modelKey = modelName.toLowerCase();
  const sibling = path.join(path.dirname(vehiclesMetaPath), 'handling.meta');
  if (fs.existsSync(sibling)) {
    const names = handlingNamesInFile(sibling);
    if (names.length === 1) {
      return { handlingId: names[0], rule: 'sibling_single_handling.meta' };
    }
    const exact = names.find((n) => n.toLowerCase() === modelKey);
    if (exact) return { handlingId: exact, rule: 'sibling_handling_name_matches_model' };
    return { error: 'ambiguous_sibling_handling', names };
  }

  const resourceRoot = findCarResourceRoot(vehiclesMetaPath);
  const catalog = buildHandlingCatalog(resourceRoot);
  if (catalog.has(modelKey)) {
    return { handlingId: catalog.get(modelKey).canonical, rule: 'resource_handling_name_matches_model' };
  }
  return { error: 'no_pack_handling_for_model' };
}

module.exports = {
  findVehicleMetaFiles,
  handlingNamesInFile,
  collectHandlingMetaFiles,
  findCarResourceRoot,
  tag,
  segmentsFromTag,
  setHandlingId,
  buildHandlingCatalog,
  resolveExpectedHandlingId,
};
