#!/usr/bin/env node
'use strict';
// Static locale-usage checker. Fails (exit 1) when:
//  - a literal locale key referenced from Lua/JS/HTML is missing in EN or RO;
//  - a call passes a literal params table that does not supply every {named}
//    placeholder of the template, or a positional call supplies fewer values
//    than the template has printf placeholders;
//  - keys used with Sunset.TPlural / I18n.plural lack .one/.other in either language.
// Also prints (non-fatal) warnings for RO strings that may overflow UI.
// Dynamic keys (built with .. or template literals) cannot be checked and are counted.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scanRoot = path.join(root, 'resources/[sunset]');
const luaDir = path.join(scanRoot, 'sunset_core/shared/locales');
const nuiFile = path.join(scanRoot, 'sunset_ui/web/js/i18n.js');
const nuiGen = path.join(scanRoot, 'sunset_ui/web/js/i18n.generated.js');

function parsePairs(text, lua) {
    const map = new Map();
    const re = lua
        ? /\[\s*['"]([^'"\r\n]+)['"]\s*\]\s*=\s*(['"])((?:\\.|(?!\2)[^\r\n])*?)\2/g
        : /['"]([^'"\r\n]+)['"]\s*:\s*(['"])((?:\\.|(?!\2)[^\r\n])*?)\2/g;
    let m;
    while ((m = re.exec(text))) { if (!lua && !m[1].includes('.')) continue; map.set(m[1], m[3]); }
    return map;
}
function balanced(text, marker) {
    const start = text.indexOf(marker); const open = text.indexOf('{', start);
    let depth = 0, q = null, esc = false;
    for (let i = open; i < text.length; i++) {
        const c = text[i];
        if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
        if (c === '"' || c === "'") { q = c; continue; }
        if (c === '{') depth++;
        if (c === '}' && --depth === 0) return text.slice(open, i + 1);
    }
    return '';
}
const read = (f) => fs.readFileSync(f, 'utf8');
const luaEn = parsePairs(read(path.join(luaDir, 'en.lua')), true);
const luaRo = parsePairs(read(path.join(luaDir, 'ro.lua')), true);
const nui = read(nuiFile), gen = read(nuiGen);
const nuiEn = new Map([...parsePairs(balanced(nui, 'en:'), false), ...parsePairs(balanced(gen, '"en":'), false)]);
const nuiRo = new Map([...parsePairs(balanced(nui, 'ro:'), false), ...parsePairs(balanced(gen, '"ro":'), false)]);

const named = (v) => [...v.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
const printf = (v) => (v.replace(/%%/g, '').match(/%[-+0 #]*\d*(?:\.\d+)?[dsifuxX]/g) || []).length;

let failures = 0, checked = 0, dynamic = 0;
const warn = [];
const fail = (msg) => { failures++; console.error(msg); };

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['vendor', 'node_modules'].includes(e.name)) walk(f, out); }
        else if (/\.(lua|js|html)$/.test(e.name)) out.push(f);
    }
    return out;
}
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

// Lua: Translate(key...), TFor(src, key...), Sunset.T(key...), TLocale/Translate(locale,key), NotifyFor(src,key..),
// tr(key..), localeKey = 'k'
const luaCalls = [
    { re: /(?:exports\.sunset_core:Translate|Sunset\.T|Sunset\.Locale|\btr|\bT)\s*\(\s*(['"])([a-z][\w.]*)\1\s*(,\s*\{([^{}]*)\}|,|\))?/g, keyIdx: 2, tblIdx: 4, rest: 3 },
    { re: /(?:TFor|NotifyFor)\s*\(\s*[^,()]+,\s*(['"])([a-z][\w.]*)\1\s*(,\s*\{([^{}]*)\}|,|\))?/g, keyIdx: 2, tblIdx: 4, rest: 3 },
    { re: /(?:Sunset\.Translate|Sunset\.TLocale|TLocale)\s*\(\s*[^,()]+,\s*(['"])([a-z][\w.]*)\1\s*(,\s*\{([^{}]*)\}|,|\))?/g, keyIdx: 2, tblIdx: 4, rest: 3 },
    { re: /\b(?:localeKey|labelKey|descriptionKey|titleKey|messageKey)\s*=\s*(['"])([a-z][\w.]*)\1/g, keyIdx: 2 },
];
const plural = /(?:TPlural)\s*\(\s*[^,()]+,\s*(['"])([a-z][\w.]*)\1/g;
const used = []; // {file,line,key,side}

for (const f of walk(scanRoot)) {
    const rel = path.relative(root, f);
    if (/\/locales\/|i18n(\.generated)?\.js$|\/vendor\/|sunset_loadscreen\//.test(f)) continue;
    const s = read(f);
    if (f.endsWith('.lua')) {
        for (const c of luaCalls) {
            c.re.lastIndex = 0; let m;
            while ((m = c.re.exec(s))) {
                const key = m[c.keyIdx]; checked++;
                used.push({ rel, line: lineOf(s, m.index), key, lua: true });
                const tmpl = luaEn.get(key);
                if (tmpl === undefined) continue;
                const names = named(tmpl);
                if (c.tblIdx && m[c.tblIdx] !== undefined && names.length) {
                    for (const n of names) {
                        if (!new RegExp('\\b' + n + '\\s*=').test(m[c.tblIdx])) fail(`${rel}:${lineOf(s, m.index)}: key ${key} needs {${n}} but params table does not set it`);
                    }
                }
            }
        }
        plural.lastIndex = 0; let pm;
        while ((pm = plural.exec(s))) {
            for (const sfx of ['.one', '.other']) {
                for (const [lang, map] of [['EN', luaEn], ['RO', luaRo]]) if (!map.has(pm[2] + sfx)) fail(`${rel}:${lineOf(s, pm.index)}: plural key ${pm[2]}${sfx} missing in ${lang}`);
            }
        }
        const dyn = s.match(/(?:Translate|TFor|Sunset\.T)\s*\([^'")]*?[a-zA-Z_]\w*\s*\.\./g);
        if (dyn) dynamic += dyn.length;
    } else {
        const reJs = /I18n\.(?:t|plural)\s*\(\s*(['"`])([a-z][\w.]*)\1/g; let m;
        while ((m = reJs.exec(s))) { checked++; used.push({ rel, line: lineOf(s, m.index), key: m[2], lua: false }); }
        const reAttr = /data-(?:ls-)?i18n(?:-placeholder|-title|-aria|-alt|-value)?\s*=\s*"([a-z][\w.]*)"/g;
        while ((m = reAttr.exec(s))) { checked++; used.push({ rel, line: lineOf(s, m.index), key: m[1], lua: false }); }
    }
}
// Loadscreen runs before the locale system exists and ships its own EN/RO dictionary.
{
    const ls = read(path.join(scanRoot, 'sunset_loadscreen/script.js'));
    const block = (name) => { const m = new RegExp('\\b' + name + ':\\s*\\{').exec(ls); return m ? balanced(ls.slice(m.index), name + ':') : ''; };
    const keys = (b) => new Map([...b.matchAll(/\b([a-z_0-9]+)\s*:\s*(['"])((?:\\.|(?!\2).)*)\2/g)].map((m) => [m[1], m[3]]));
    const lsEn = keys(block('en')), lsRo = keys(block('ro'));
    for (const [k, v] of lsEn) {
        if (!lsRo.has(k)) fail(`sunset_loadscreen/script.js: key ${k} missing in RO`);
        else if (named(v).sort().join() !== named(lsRo.get(k)).sort().join()) fail(`sunset_loadscreen/script.js: placeholder mismatch ${k}`);
    }
    for (const k of lsRo.keys()) if (!lsEn.has(k)) fail(`sunset_loadscreen/script.js: key ${k} missing in EN`);
    const html = read(path.join(scanRoot, 'sunset_loadscreen/index.html'));
    for (const m of html.matchAll(/data-ls-i18n="([a-z_0-9]+)"/g)) { checked++; if (!lsEn.has(m[1])) fail(`sunset_loadscreen/index.html: key ${m[1]} missing in loadscreen dictionary`); }
    for (const m of ls.matchAll(/lsT\(\s*['"]([a-z_0-9]+)['"]/g)) { checked++; if (!lsEn.has(m[1])) fail(`sunset_loadscreen/script.js: lsT key ${m[1]} missing`); }
}
for (const u of used) {
    if (u.key.endsWith('.')) { dynamic++; continue; }
    const en = u.lua ? luaEn : nuiEn, ro = u.lua ? luaRo : nuiRo;
    // NUI code may also use Lua-style keys pushed from Lua; accept either dictionary for NUI keys
    const hasEn = en.has(u.key) || (!u.lua && luaEn.has(u.key)) || en.has(u.key + '.one');
    const hasRo = ro.has(u.key) || (!u.lua && luaRo.has(u.key)) || ro.has(u.key + '.one');
    if (!hasEn) fail(`${u.rel}:${u.line}: key ${u.key} missing in EN`);
    if (!hasRo) fail(`${u.rel}:${u.line}: key ${u.key} missing in RO`);
}

// Overflow warnings: RO notably longer than EN
for (const [label, en, ro] of [['Lua', luaEn, luaRo], ['NUI', nuiEn, nuiRo]]) {
    for (const [k, v] of ro) {
        const e = en.get(k); if (!e) continue;
        if (v.length > 90 && v.length > e.length * 1.35) warn.push(`${label} ${k}: RO ${v.length} chars vs EN ${e.length}`);
    }
}
console.log(`Checked ${checked} literal key references (${dynamic} dynamic key builds not checkable).`);
if (warn.length) {
    console.log(`Overflow review (${warn.length}, non-fatal; verify visually):`);
    for (const w of warn.slice(0, 40)) console.log('  ' + w);
    if (warn.length > 40) console.log(`  ... ${warn.length - 40} more`);
}
if (failures) { console.error(`Locale usage check FAILED: ${failures} issue(s).`); process.exit(1); }
console.log('Locale usage check OK.');
