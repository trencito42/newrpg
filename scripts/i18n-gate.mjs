#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { scanLuaPresentation, scanJsPresentation } from './i18n-presentation.mjs';
import lua from 'luaparse';
import { parse as parseHTML } from 'parse5';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.resolve(root, f), 'utf8');
const allowed = JSON.parse(read('scripts/i18n-allowlist.json'));
const issues = [];
const fail = (file, key, message) => issues.push({ file, key, message });
export function placeholders(value) {
    const named = [...value.matchAll(/\{([\w]+)\}/g)].map(m => m[1]).sort();
    const printf = [...value.replace(/%%/g, '').matchAll(/%(?:\d+\$)?[-+ #0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?([cdeEfgGiouXxqs])(?![A-Za-z])/g)].map(m => m[0]);
    return JSON.stringify({ named, printf });
}
export function walk(dir) {
    return fs.readdirSync(path.resolve(root, dir), { withFileTypes: true }).flatMap(e => {
        if (['node_modules', 'vendor', '.git', '.next', 'stream'].includes(e.name)) return [];
        const f = path.join(dir, e.name);
        return e.isDirectory() ? walk(f) : [f];
    });
}
function ast(file, source = read(file)) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const d of sf.parseDiagnostics) fail(file, d.start, ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    return sf;
}
function visit(node, fn) { fn(node); ts.forEachChild(node, child => visit(child, fn)); }
function objectMap(node, file, prefix = '', map = new Map()) {
    if (!ts.isObjectLiteralExpression(node)) { fail(file, prefix, 'invalid dictionary object'); return map; }
    const seen = new Set();
    for (const p of node.properties) {
        if (!ts.isPropertyAssignment(p)) { fail(file, prefix, 'dictionary must contain static properties'); continue; }
        const name = p.name.text;
        if (seen.has(name)) fail(file, prefix + name, 'duplicate key');
        seen.add(name);
        const key = prefix + name;
        if (ts.isObjectLiteralExpression(p.initializer)) objectMap(p.initializer, file, key + '.', map);
        else if (ts.isStringLiteralLike(p.initializer)) map.set(key, p.initializer.text);
        else fail(file, key, 'invalid translation data type');
    }
    return map;
}
function jsonMap(file) {
    const sf = ast(file + '.ts', '(' + read(file) + ')');
    return objectMap(sf.statements[0].expression.expression, file);
}
function jsLocales(file, name) {
    const sf = ast(file); let result;
    visit(sf, n => {
        let value = ts.isVariableDeclaration(n) && n.name.getText(sf) === name ? n.initializer
            : ts.isBinaryExpression(n) && n.left.getText(sf) === name ? n.right : null;
        if (value && ts.isCallExpression(value) && value.expression.getText(sf) === "Object.freeze") value = value.arguments[0];
        if (value && ts.isObjectLiteralExpression(value)) result = Object.fromEntries(value.properties.map(p => [p.name.text, objectMap(p.initializer, file + ':' + p.name.text)]));
    });
    if (!result?.en || !result?.ro) throw new Error(`Cannot read EN/RO dictionaries: ${file}`);
    return result;
}
function luaMap(file) {
    const tree = lua.parse(Buffer.from(read(file), 'utf8').toString('latin1'), { luaVersion: '5.3', encodingMode: 'pseudo-latin1' });
    const map = new Map();
    function each(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'TableKey' && n.key.type === 'StringLiteral') {
            const k = Buffer.from(n.key.value, 'latin1').toString('utf8');
            if (map.has(k)) fail(file, k, 'duplicate key');
            if (n.value.type !== 'StringLiteral') fail(file, k, 'invalid translation data type');
            else map.set(k, Buffer.from(n.value.value, 'latin1').toString('utf8'));
        }
        for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(each); else if (v && typeof v === 'object') each(v);
    }
    each(tree); return map;
}
function parity(label, pair) {
    for (const key of new Set([...pair.en.keys(), ...pair.ro.keys()])) {
        const en = pair.en.get(key), ro = pair.ro.get(key);
        for (const lang of ['en', 'ro']) if (!pair[lang].get(key)?.trim()) fail(label, key, `missing/empty ${lang.toUpperCase()}`);
        if (en && ro && placeholders(en) !== placeholders(ro)) fail(label, key, 'placeholder mismatch');
        if (/\.one$/.test(key)) for (const suffix of ['one', 'other']) for (const lang of ['en', 'ro']) {
            if (!pair[lang].has(key.replace(/\.(one|other)$/, '.' + suffix))) fail(label, key, `missing plural ${lang}.${suffix}`);
        }
        const languageText = value => (value || '').replace(/\{\w+\}|%[-+ #0\d.]*[cdeEfgGiouXxqs]|~[A-Z_]+~/g, '');
        if (en === ro && /\p{L}/u.test(languageText(en)) && !sharedTerm(en) && !/^\{\w+\}$/.test(languageText(en))) fail(label, key, `identical EN/RO: ${en}`);
        if (ro && /\b(?:your|please|loading|delete|purchase|vehicle|account)\b/i.test(languageText(ro))) fail(label, key, `probable English in RO: ${ro}`);
        if (en && /\b(?:jucător|mașină|salvează|șterge|cumpără|proprietate|caută|încarcă|eroare)\b/i.test(languageText(en))) fail(label, key, `probable Romanian in EN: ${en}`);
    }
    console.log(`${label}: EN ${pair.en.size}, RO ${pair.ro.size}`);
}
function used(pair, file, key, params, plural = false) {
    for (const k of plural ? [key + '.one', key + '.other'] : [key]) for (const lang of ['en', 'ro']) {
        if (!pair[lang].has(k)) fail(file, k, `referenced key missing in ${lang.toUpperCase()}`);
        else if (params !== null) for (const p of pair[lang].get(k).matchAll(/\{(\w+)\}/g)) if (!params.has(p[1])) fail(file, k, `missing parameter {${p[1]}}`);
    }
}
function sharedTerm(value) {
    let rest = value.replace(/<[^>]*>|\{\w+\}/g, ' ');
    for (const term of Object.keys(allowed.terms).sort((a, b) => b.length - a.length)) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        rest = rest.replace(new RegExp('(?<![\\p{L}])' + escaped + '(?![\\p{L}])', 'gu'), ' ');
    }
    return !/\p{L}/u.test(rest);
}
const visible = value => /\p{L}/u.test(value) && !sharedTerm(value);

function splitSqlList(source) {
    const parts = []; let start = 0, depth = 0, quote = '', escaped = false;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === quote && source[i + 1] === quote) i++;
            else if (ch === quote) quote = '';
        } else if (ch === "'" || ch === '"') quote = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) { parts.push(source.slice(start, i).trim()); start = i + 1; }
    }
    parts.push(source.slice(start).trim());
    return parts;
}

function validateDatabaseContent() {
    const sqlFiles = walk('sql').filter(file => file.endsWith('.sql'));
    let bilingualSeeds = 0, bilingualColumns = 0;
    for (const file of sqlFiles) {
        const source = read(file);
        const definitions = [...source.matchAll(/`([a-z0-9_]+)_(en|ro)`\s+(?:varchar\b[^,\n]*|text\b[^,\n]*)/gi)];
        const declared = new Set(definitions.map(match => `${match[1]}_${match[2]}`));
        for (const match of definitions) {
            const other = `${match[1]}_${match[2] === 'en' ? 'ro' : 'en'}`;
            if (!declared.has(other)) fail(file, match[0], `bilingual database column missing counterpart ${other}`);
            else bilingualColumns++;
        }

        for (const insert of source.matchAll(/INSERT(?:\s+IGNORE)?\s+INTO\s+`?([a-z0-9_]+)`?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/gi)) {
            const columns = splitSqlList(insert[2]).map(value => value.replace(/[`\s]/g, ''));
            const rowsSource = insert[3].trim();
            for (const row of splitSqlList(rowsSource)) {
                if (!row.startsWith('(') || !row.endsWith(')')) continue;
                const values = splitSqlList(row.slice(1, -1));
                for (let index = 0; index < columns.length; index++) {
                    const match = columns[index].match(/^(.+)_en$/);
                    if (!match) continue;
                    const roIndex = columns.indexOf(`${match[1]}_ro`);
                    if (roIndex < 0) { fail(file, insert[1], `seeded ${columns[index]} missing Romanian column`); continue; }
                    const en = values[index]?.trim(), ro = values[roIndex]?.trim();
                    const empty = value => !value || /^NULL$/i.test(value) || /^(['"])\1$/.test(value);
                    if (empty(en) !== empty(ro)) fail(file, insert[1], `seed row must provide both ${match[1]}_en and ${match[1]}_ro`);
                    else if (!empty(en)) bilingualSeeds++;
                }
            }
        }
    }
    const pollApi = read('panel/src/app/api/staff/polls/route.ts');
    if (!/!titleRo\s*\|\|\s*!titleEn/.test(pollApi) || !/hasInvalidOption/.test(pollApi)) {
        fail('panel/src/app/api/staff/polls/route.ts', '', 'system-authored polls must require EN and RO fields');
    }
    console.log(`DATABASE SYSTEM CONTENT: ${bilingualColumns / 2} bilingual column pair(s), ${bilingualSeeds} bilingual seeded value pair(s).`);
}

function validatePresentationCatalogs() {
    const catalogs = [
        ['ITEMS', 'resources/[sunset]/sunset_core/shared/items.lua', 'Items'],
        ['JOBS', 'resources/[sunset]/sunset_core/shared/jobs_civilian.lua', 'CivilianJobs'],
    ];
    for (const [label, file, member] of catalogs) {
        const source = read(file);
        const tree = lua.parse(source, { luaVersion: '5.3', ranges: true });
        let table;
        (function find(n) {
            if (!n || typeof n !== 'object' || table) return;
            if (n.type === 'AssignmentStatement') for (let i = 0; i < n.variables.length; i++) {
                const variable = n.variables[i];
                if (variable.type === 'MemberExpression' && variable.base?.name === 'Sunset'
                    && variable.identifier?.name === member && n.init[i]?.type === 'TableConstructorExpression') table = n.init[i];
            }
            for (const value of Object.values(n)) if (Array.isArray(value)) value.forEach(find); else if (value && typeof value === 'object') find(value);
        })(tree);
        if (!table) { fail(file, '', `could not find Sunset.${member} catalog`); continue; }
        let count = 0;
        for (const entry of table.fields || []) {
            if (entry.type !== 'TableKeyString' || entry.value?.type !== 'TableConstructorExpression') continue;
            count++;
            const names = new Set(entry.value.fields.filter(field => field.type === 'TableKeyString').map(field => field.key.name));
            if (!names.has('label') || !names.has('labelKey')) fail(file, entry.key.name, `${label.toLowerCase()} entry requires label and labelKey`);
        }
        console.log(`${label}: ${count} catalog entries with semantic presentation keys.`);
    }
    for (const file of [
        'resources/[sunset]/sunset_inventory/server/main.lua',
        'resources/[sunset]/sunset_inventory/server/containers.lua',
        'resources/[sunset]/sunset_inventory/server/trade.lua',
        'resources/[sunset]/sunset_inventory/server/quickslots.lua',
    ]) {
        const lines = read(file).split('\n');
        for (let i = 0; i < lines.length; i++) if (/label\s*=\s*def\.label/.test(lines[i])) {
            const nearby = lines.slice(Math.max(0, i - 4), i + 2).join('\n');
            if (!/labelKey\s*=\s*def\.labelKey/.test(nearby)) fail(file, i + 1, 'item payload drops labelKey before presentation');
        }
    }
}

export function scanPanel(file, source, pair, report = fail) {
    const sf = ast(file, source), lines = source.split('\n');
    const ignored = n => {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
        return [lines[line], lines[line - 1] || ''].some(l => /(?:\/\/|\/\*|\{\/\*)\s*i18n-ignore:\s*\S.+/.test(l));
    };
    const hit = (n, why) => { if (!ignored(n)) report(file, sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, `${why}: ${n.getText(sf).slice(0, 160)}`); };
    const literal = n => n && ts.isStringLiteralLike(n) && visible(n.text);
    const visibleJsxExpression = n => {
        let current = n;
        while (current && !ts.isStatement(current)) {
            if (ts.isCallExpression(current) && /^(?:t|I18n\.t)$/.test(current.expression.getText(sf))) return false;
            if (ts.isJsxAttribute(current)) return /^(?:title|placeholder|aria-label|alt)$/.test(current.name.text);
            if (ts.isJsxExpression(current)) {
                const attribute = current.parent && ts.isJsxAttribute(current.parent) ? current.parent : null;
                return !attribute || /^(?:title|placeholder|aria-label|alt)$/.test(attribute.name.text);
            }
            current = current.parent;
        }
        return false;
    };
    visit(sf, n => {
        if (ts.isJsxText(n) && visible(n.text.trim())) hit(n, 'JSX visible text');
        if (ts.isJsxAttribute(n) && /^(title|placeholder|aria-label|alt)$/.test(n.name.text)) {
            if (literal(n.initializer) || ts.isJsxExpression(n.initializer || sf) && literal(n.initializer.expression)) hit(n, 'visible attribute');
        }
        if (ts.isPropertyAssignment(n) && /^(label|description|title|placeholder|message|error)$/.test(n.name.text) && literal(n.initializer) && !(n.name.text === 'error' && /^(?:unauthorized|forbidden|[a-z]+(?:_[a-z]+)+)$/.test(n.initializer.text))) hit(n, 'visible object literal');
        if (ts.isConditionalExpression(n) && /(?:locale|\bro\b|language)/i.test(n.condition.getText(sf)) && (literal(n.whenTrue) || literal(n.whenFalse))) {
            const mechanics = ts.isStringLiteralLike(n.whenTrue) && ts.isStringLiteralLike(n.whenFalse) && ['ro|en', 'ro-RO|en-US'].includes(n.whenTrue.text + '|' + n.whenFalse.text);
            let parent = n.parent;
            while (parent && !ts.isJsxAttribute(parent) && !ts.isStatement(parent)) parent = parent.parent;
            const style = parent && ts.isJsxAttribute(parent) && ['className', 'style'].includes(parent.name.text);
            if (!mechanics && !style) hit(n, 'visible locale ternary');
        }
        if (ts.isConditionalExpression(n) && visibleJsxExpression(n) && (literal(n.whenTrue) || literal(n.whenFalse))) {
            hit(n, 'visible JSX conditional literal');
        }
        if (ts.isBinaryExpression(n) && visibleJsxExpression(n)
            && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)
            && literal(n.right)) hit(n, 'visible JSX fallback literal');
        if (ts.isCallExpression(n)) {
            const name = n.expression.getText(sf);
            if (/^(setError|setStatus|setMessage|alert|confirm|window\.confirm|toast(?:\.\w+)?)$/.test(name) && literal(n.arguments[0])) hit(n, 'visible message call');
            if (name === 't' && n.arguments[1] && ts.isStringLiteralLike(n.arguments[1])) {
                const p = n.arguments[2];
                const params = !p ? new Set() : ts.isObjectLiteralExpression(p) && !p.properties.some(ts.isSpreadAssignment) ? new Set(p.properties.map(x => x.name?.text)) : null;
                used(pair, file, n.arguments[1].text, params);
            }
        }
    });
}
function htmlScan(file, pair, loadscreen = false) {
    const tree = parseHTML(read(file), { sourceCodeLocationInfo: true });
    function each(n, skip = false) {
        const attrs = Object.fromEntries((n.attrs || []).map(a => [a.name, a.value]));
        const prefix = loadscreen ? 'data-ls-i18n' : 'data-i18n';
        const line = n.sourceCodeLocation?.startLine || 1;
        skip ||= ['script', 'style', 'svg'].includes(n.tagName);
        if (!skip) {
            for (const [a, suffix] of [['placeholder', '-placeholder'], ['title', '-title'], ['aria-label', '-aria'], ['alt', '-alt']]) if (visible(attrs[a] || '') && !attrs[prefix + suffix]) fail(file, line, `HTML ${a}: ${attrs[a]}`);
            for (const [a, key] of Object.entries(attrs)) if (a === prefix || a.startsWith(prefix + '-') && a !== prefix + '-ignore') used(pair, file, key, null);
            if (!attrs[prefix] && !attrs['data-i18n-ignore']) for (const child of n.childNodes || []) if (child.nodeName === '#text' && visible(child.value.trim())) fail(file, line, `HTML text: ${child.value.trim().slice(0, 100)}`);
        }
        for (const child of n.childNodes || []) each(child, skip);
    }
    each(tree);
}
export function main() {
    console.log('RACKET I18N GATE\n================================================');
    const game = Object.fromEntries(['en', 'ro'].map(l => [l, luaMap(`resources/[sunset]/sunset_core/shared/locales/${l}.lua`)]));
    const nui = jsLocales('resources/[sunset]/sunset_ui/web/js/i18n.js', 'dictionaries');
    const generated = jsLocales('resources/[sunset]/sunset_ui/web/js/i18n.generated.js', 'window.SunsetGeneratedLocales');
    for (const lang of ['en', 'ro']) for (const [k, v] of generated[lang]) { if (nui[lang].has(k)) fail('NUI', k, 'duplicate across dictionaries'); nui[lang].set(k, v); }
    const panel = Object.fromEntries(['en', 'ro'].map(l => [l, jsonMap(`panel/src/locales/${l}.json`)]));
    const loadscreen = jsLocales('resources/[sunset]/sunset_loadscreen/script.js', 'LOADSCREEN_LOCALES');
    for (const [label, pair] of [['GAME LUA', game], ['NUI', nui], ['PANEL', panel], ['LOADSCREEN', loadscreen]]) parity(label, pair);
    validateDatabaseContent();
    validatePresentationCatalogs();
    for (const file of walk('panel/src')) if (/\.[jt]sx?$/.test(file) && !file.endsWith('/i18n.ts')) scanPanel(file, read(file), panel);
    for (const file of walk('resources/[sunset]')) {
        const source = read(file);
        // The test bridge speaks a machine-facing HTTP/RPC protocol. Its status
        // and error payloads are API contracts, not presentation copy.
        const machineProtocol = /\/sunset_(?:test_agent|testdriver)\//.test(file);
        if (/\.lua$/.test(file) && !machineProtocol) scanLuaPresentation(file, source, visible, fail, (f, k) => used(game, f, k, null));
        if (/\.js$/.test(file) && !/i18n(?:\.generated)?\.js$|sunset_loadscreen\//.test(file) && !/i18n-ignore-file:\s*\S.+/.test(source)) scanJsPresentation(file, source, visible, fail, (f, k, plural) => used(nui, f, k, null, plural));
        if (/\.html$/.test(file)) htmlScan(file, file.includes('sunset_loadscreen/') ? loadscreen : nui, file.includes('sunset_loadscreen/'));
        if (/\.(lua|js|html|css)$/.test(file)) for (const [i, line] of read(file).split('\n').entries()) {
            if (/i18n-ignore(?:-file)?(?:\s|:|$)/.test(line) && !/i18n-ignore(?:-file)?:\s*\S.+/.test(line)) fail(file, i + 1, 'ignore annotation requires a reason');
        }
    }
    for (const script of ['check-locales.js', 'check-locale-usage.js', 'audit-localization.js']) {
        const result = spawnSync(process.execPath, ['scripts/' + script], { cwd: root, encoding: 'utf8' });
        if (result.status !== 0) fail(script, '', (result.stdout + result.stderr).trim());
        else console.log(`PASS - ${script}`);
    }
    const reportPath = process.argv.find(a => a.startsWith('--report='))?.slice(9);
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2) + '\n');
    for (const issue of issues.slice(0, 60)) console.error(`${issue.file}:${issue.key}: ${issue.message}`);
    if (issues.length > 60) console.error(`... ${issues.length - 60} more findings; use --report=<path> for full output.`);
    console.log(`================================================\n${issues.length} localization violations\nI18N GATE ${issues.length ? 'FAILED' : 'PASSED'}`);
    return issues.length ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { process.exitCode = main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
