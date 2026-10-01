#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const luaDir = path.join(root, 'resources/[sunset]/sunset_core/shared/locales');
const nuiFile = path.join(root, 'resources/[sunset]/sunset_ui/web/js/i18n.js');
const nuiGeneratedFile = path.join(root, 'resources/[sunset]/sunset_ui/web/js/i18n.generated.js');
let failures = 0;

function placeholders(value) {
    const named = [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => `named:${m[1]}`);
    const positional = [...value.matchAll(/%(?:\d+\$)?[-+0 #]*(?:\d+|\*)?(?:\.\d+)?[cdeEfgGiouxXqs]/g)]
        .map((m) => `printf:${m[0].slice(-1)}`);
    return [...named, ...positional].sort();
}

function parsePairs(text, source) {
    const map = new Map();
    const duplicates = [];
    const pair = source === 'lua'
        ? /\[\s*['"]([^'"\r\n]+)['"]\s*\]\s*=\s*(['"])((?:\\.|(?!\2)[^\r\n])*?)\2\s*,?/g
        : /['"]([^'"\r\n]+)['"]\s*:\s*(['"])((?:\\.|(?!\2)[^\r\n])*?)\2\s*,?/g;
    let match;
    while ((match = pair.exec(text))) {
        const key = match[1];
        if (!key.includes('.') && source === 'nui') continue;
        if (map.has(key)) duplicates.push(key);
        map.set(key, match[3]);
    }
    return { map, duplicates };
}

function balancedObject(text, marker) {
    const start = text.indexOf(marker);
    if (start < 0) throw new Error(`Missing ${marker}`);
    const open = text.indexOf('{', start);
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === '{') depth++;
        if (ch === '}' && --depth === 0) return text.slice(open, i + 1);
    }
    throw new Error(`Unclosed object after ${marker}`);
}

function validatePair(label, enResult, roResult) {
    for (const duplicate of [...enResult.duplicates, ...roResult.duplicates]) {
        console.error(`${label}: duplicate key: ${duplicate}`);
        failures++;
    }
    const keys = new Set([...enResult.map.keys(), ...roResult.map.keys()]);
    for (const key of [...keys].sort()) {
        const en = enResult.map.get(key);
        const ro = roResult.map.get(key);
        if (!en || !en.trim()) { console.error(`${label}: missing/empty EN: ${key}`); failures++; continue; }
        if (!ro || !ro.trim()) { console.error(`${label}: missing/empty RO: ${key}`); failures++; continue; }
        const enParams = placeholders(en).join(',');
        const roParams = placeholders(ro).join(',');
        if (enParams !== roParams) {
            console.error(`${label}: placeholder mismatch ${key}: EN={${enParams}} RO={${roParams}}`);
            failures++;
        }
    }
    console.log(`${label}: EN ${enResult.map.size}, RO ${roResult.map.size}`);
}

function mergeResults(base, extra) {
    const map = new Map(base.map);
    const duplicates = [...base.duplicates, ...extra.duplicates];
    for (const [key, value] of extra.map) {
        if (map.has(key)) duplicates.push(key);
        map.set(key, value);
    }
    return { map, duplicates };
}

const luaEn = parsePairs(fs.readFileSync(path.join(luaDir, 'en.lua'), 'utf8'), 'lua');
const luaRo = parsePairs(fs.readFileSync(path.join(luaDir, 'ro.lua'), 'utf8'), 'lua');
validatePair('Lua', luaEn, luaRo);

const nuiSource = fs.readFileSync(nuiFile, 'utf8');
const generatedSource = fs.readFileSync(nuiGeneratedFile, 'utf8');
const nuiEn = mergeResults(
    parsePairs(balancedObject(nuiSource, 'en:'), 'nui'),
    parsePairs(balancedObject(generatedSource, '"en":'), 'nui')
);
const nuiRo = mergeResults(
    parsePairs(balancedObject(nuiSource, 'ro:'), 'nui'),
    parsePairs(balancedObject(generatedSource, '"ro":'), 'nui')
);
validatePair('NUI', nuiEn, nuiRo);

// Chat suggestions are assembled at runtime from the shared command usage
// registry and chat:addSuggestion events. Literal usages must be translated in
// both languages even though the regular literal-key scanner cannot see the
// concatenated `chat.suggestion.` lookup in suggestions.lua.
const sunsetDir = path.join(root, 'resources/[sunset]');
function luaFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        return entry.isDirectory() ? luaFiles(file) : file.endsWith('.lua') ? [file] : [];
    });
}
const helpRegistry = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_core/shared/help_registry.lua'), 'utf8');
const usageSection = helpRegistry.slice(helpRegistry.indexOf('Sunset.CommandUsage ='));
const suggested = new Set();
for (const match of usageSection.matchAll(/^\s*(?:\[['"]([^'"]+)['"]\]|([a-zA-Z0-9_]+))\s*=\s*\{\s*usage\s*=/gm)) {
    suggested.add(match[1] || match[2]);
}
const registered = new Set();
for (const file of luaFiles(sunsetDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:chat:addSuggestion|chat:addSuggestions)[^\n]*?['"]\/([a-z0-9_]+)['"]/gi)) {
        suggested.add(match[1].toLowerCase());
    }
    for (const match of source.matchAll(/RegisterCommand\(\s*['"]([a-z0-9_]+)['"]/gi)) {
        registered.add(match[1].toLowerCase());
    }
}
for (const command of [...suggested].sort()) {
    const key = `chat.suggestion.${command}`;
    if (!luaEn.map.get(key)) { console.error(`Command suggestion missing EN: ${key}`); failures++; }
    if (!luaRo.map.get(key)) { console.error(`Command suggestion missing RO: ${key}`); failures++; }
}
console.log(`Commands: ${registered.size} literal RegisterCommand names, ${suggested.size} translated suggestions (EN/RO).`);

for (const locale of ['en', 'ro']) {
    if (!fs.existsSync(path.join(luaDir, `${locale}.lua`))) {
        console.error(`Invalid locale registry: ${locale} has no Lua locale file`);
        failures++;
    }
}

if (failures) {
    console.error(`Locale validation FAILED: ${failures} issue(s).`);
    process.exit(1);
}
console.log('Locale validation OK: 0 missing keys, 0 empty translations, 0 placeholder mismatches, 0 duplicates.');
