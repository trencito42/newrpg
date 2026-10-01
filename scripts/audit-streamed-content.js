#!/usr/bin/env node
'use strict';

// Repository-side inventory, not a substitute for controlled FiveM client A/B
// boots: CExtraContentWrapper does not expose per-resource timings to JS.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const resources = path.join(root, 'resources');
const cfg = fs.readFileSync(path.join(root, 'config/server.cfg.template'), 'utf8');
const enabled = new Set([...cfg.matchAll(/^\s*(?:ensure|start)\s+([^\s#]+)/gm)].map((m) => m[1]));
const assetExt = new Set(['.ymap', '.ytyp', '.ydr', '.ydd', '.ytd', '.yft', '.ybn', '.ycd', '.awc', '.rpf']);
const assetDirs = [];
const hashes = new Map();
let failures = 0;

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(target, out);
        else if (entry.isFile()) out.push(target);
    }
}

for (const group of fs.readdirSync(resources, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupDir = path.join(resources, group.name);
    const names = fs.existsSync(path.join(groupDir, 'fxmanifest.lua')) ? [group.name] :
        fs.readdirSync(groupDir, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name);
    for (const name of names) {
        const dir = names.length === 1 && name === group.name ? groupDir : path.join(groupDir, name);
        const manifestPath = path.join(dir, 'fxmanifest.lua');
        if (!fs.existsSync(manifestPath)) continue;
        const manifest = fs.readFileSync(manifestPath, 'utf8');
        const all = [];
        walk(dir, all);
        const assets = all.filter((file) => assetExt.has(path.extname(file).toLowerCase()));
        const registrations = [...manifest.matchAll(/^\s*data_file\s+['"]([^'"]+)['"]\s+['"]([^'"]+)['"]/gm)];
        if (!assets.length && !registrations.length) continue;
        const bytes = assets.reduce((sum, file) => sum + fs.statSync(file).size, 0);
        const biggest = assets.map((file) => ({ file: path.relative(dir, file), size: fs.statSync(file).size }))
            .sort((a, b) => b.size - a.size).slice(0, 5);
        const extensionCounts = {};
        for (const file of assets) {
            const ext = path.extname(file).toLowerCase();
            extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
            const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
            if (!hashes.has(hash)) hashes.set(hash, []);
            hashes.get(hash).push(path.relative(resources, file));
        }
        for (const [, type, target] of registrations) {
            if (target.includes('*')) continue;
            const full = path.resolve(dir, target);
            if (!full.startsWith(dir + path.sep) || !fs.existsSync(full)) {
                console.error(`INVALID data_file ${name}: ${type} ${target}`);
                failures++;
            }
        }
        assetDirs.push({ name, enabled: enabled.has(name), files: assets.length, mib: +(bytes / 1048576).toFixed(2),
            extensions: extensionCounts, dataFiles: registrations.map(([, type, target]) => `${type}:${target}`), biggest });
    }
}

const duplicates = [...hashes.values()].filter((paths) => paths.length > 1);
console.log(JSON.stringify({ resources: assetDirs.sort((a, b) => b.mib - a.mib), duplicateAssets: duplicates,
    invalidDataFiles: failures }, null, 2));
if (failures) process.exitCode = 1;
