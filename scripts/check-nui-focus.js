#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const sunset = path.join(root, 'resources/[sunset]');
const manager = path.join(sunset, 'sunset_ui/client/main.lua');
const violations = [];

function inspect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) { inspect(file); continue; }
        if (!file.endsWith('.lua') || file === manager) continue;
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
            if (/^\s*--/.test(line)) return;
            if (/(?:^|[^\w])SetNuiFocus(?:KeepInput)?\s*\(/.test(line)) {
                violations.push(`${path.relative(root, file)}:${index + 1}`);
            }
        });
    }
}

inspect(sunset);
if (violations.length) {
    console.error(`Direct NUI focus outside sunset_ui manager:\n${violations.join('\n')}`);
    process.exitCode = 1;
} else {
    console.log('NUI focus: direct natives confined to sunset_ui/client/main.lua.');
}
