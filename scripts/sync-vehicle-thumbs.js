#!/usr/bin/env node
'use strict';
// Canonical capture output is racket_vehicle_thumbs/output/<model>.png
// (or the panel bind at panel/public/vehicles). NUI can only serve files
// inside sunset_ui/web. This copies them to assets/vehicles/<model>.png.
// WebP is preferred when `magick` exists; otherwise PNG is the NUI file.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const sources = [
    path.join(root, 'resources/racket_vehicle_thumbs/output'),
    path.join(root, 'panel/public/vehicles'),
];
const dest = path.join(root, 'resources/[sunset]/sunset_ui/web/assets/vehicles');
fs.mkdirSync(dest, { recursive: true });
const magick = spawnSync('magick', ['-version'], { encoding: 'utf8' }).status === 0;
let copied = 0;
const seen = new Set();
for (const dir of sources) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
        if (!/^[a-z0-9_]+\.png$/i.test(name)) continue;
        const model = name.replace(/\.png$/i, '').toLowerCase();
        if (seen.has(model)) continue;
        seen.add(model);
        const from = path.join(dir, name);
        if (magick) {
            const to = path.join(dest, model + '.webp');
            const res = spawnSync('magick', [from, '-quality', '82', to], { encoding: 'utf8' });
            if (res.status !== 0) throw new Error(res.stderr || 'magick failed');
        } else {
            fs.copyFileSync(from, path.join(dest, model + '.png'));
        }
        copied += 1;
    }
}
console.log('synced ' + copied + ' vehicle thumbnails (' + (magick ? 'webp' : 'png') + ')');
