const fs = require('fs');
const path = require('path');

const resourcesDir = path.resolve(__dirname, '../resources');

const uiManifests = [];
const uiPages = [];
const nuiCallbacksRegistered = new Map();
const nuiCallbacksPosted = new Map();
const fontsUsed = new Set();
const colorsUsed = new Set();
const zIndexValues = [];
const allButtons = [];

function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== '.git') {
                scanDir(full);
            }
        } else if (ent.name === 'fxmanifest.lua') {
            const content = fs.readFileSync(full, 'utf8');
            const match = content.match(/ui_page\s+['"]([^'"]+)['"]/);
            if (match) {
                const resName = path.basename(dir);
                uiManifests.push({ resource: resName, uiPage: match[1], fullPath: full });
            }
        }
    }
}
scanDir(resourcesDir);

console.log('UI Pages declared in fxmanifest.lua:', uiManifests);

// Scan for NUI callbacks in Lua files
function scanLuaNui(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== '.git') scanLuaNui(full);
        } else if (ent.name.endsWith('.lua')) {
            const content = fs.readFileSync(full, 'utf8');
            const matches = content.matchAll(/RegisterNUICallback\s*\(\s*['"]([^'"]+)['"]/g);
            for (const m of matches) {
                const cb = m[1];
                if (!nuiCallbacksRegistered.has(cb)) nuiCallbacksRegistered.set(cb, []);
                nuiCallbacksRegistered.get(cb).push(path.relative(resourcesDir, full));
            }
        }
    }
}
scanLuaNui(resourcesDir);

// Scan for fetch / NUI posts in JS/HTML/TSX files
function scanJsNui(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== '.git') scanJsNui(full);
        } else if (ent.name.endsWith('.js') || ent.name.endsWith('.html') || ent.name.endsWith('.tsx') || ent.name.endsWith('.jsx')) {
            const content = fs.readFileSync(full, 'utf8');
            const fetchMatches = content.matchAll(/https:\/\/(?:[a-zA-Z0-9_\-]+|\$\{[^}]+\})\/([a-zA-Z0-9_\-]+)/g);
            for (const m of fetchMatches) {
                const cb = m[1];
                if (!nuiCallbacksPosted.has(cb)) nuiCallbacksPosted.set(cb, []);
                nuiCallbacksPosted.get(cb).push(path.relative(resourcesDir, full));
            }
        } else if (ent.name.endsWith('.css')) {
            const content = fs.readFileSync(full, 'utf8');
            const fontMatches = content.matchAll(/font-family:\s*([^;]+);/g);
            for (const m of fontMatches) fontsUsed.add(m[1].trim());

            const zMatches = content.matchAll(/z-index:\s*(\d+);/g);
            for (const m of zMatches) {
                zIndexValues.push({ file: path.relative(resourcesDir, full), z: parseInt(m[1], 10) });
            }

            const colorMatches = content.matchAll(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g);
            for (const m of colorMatches) colorsUsed.add(m[1].trim());
        }
    }
}
scanJsNui(resourcesDir);

console.log(`Registered NUI Callbacks: ${nuiCallbacksRegistered.size}`);
console.log(`Posted NUI Callbacks: ${nuiCallbacksPosted.size}`);
console.log('Fonts discovered:', Array.from(fontsUsed));

fs.writeFileSync(path.resolve(__dirname, '../docs/audit/nui_scan.json'), JSON.stringify({
    uiManifests,
    registeredCallbacks: Object.fromEntries(nuiCallbacksRegistered),
    postedCallbacks: Object.fromEntries(nuiCallbacksPosted),
    fonts: Array.from(fontsUsed),
    zIndexSample: zIndexValues.slice(0, 50),
    colorsCount: colorsUsed.size
}, null, 2));

console.log('NUI Scan completed.');
