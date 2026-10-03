#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import lua from 'luaparse';

const root = path.resolve(import.meta.dirname, '..');
const gameDir = path.join(root, 'resources/[sunset]/sunset_core/shared/locales');
const fields = new Set([
  'label', 'description', 'title', 'help', 'prompt', 'message', 'placeholder',
  'objective', 'hint', 'subtitle', 'stationHint', 'lockedReason',
]);
const excludedResources = new Set(['sunset_test_agent', 'sunset_testdriver']);

function decodeLuaString(raw) {
  try {
    const encoded = Buffer.from(raw, 'utf8').toString('latin1');
    const tree = lua.parse(`return ${encoded}`, { luaVersion: '5.3', encodingMode: 'pseudo-latin1' });
    return Buffer.from(tree.body[0].arguments[0].value, 'latin1').toString('utf8');
  } catch { return null; }
}

function localeMap(file) {
  const source = fs.readFileSync(file, 'utf8');
  const result = new Map();
  for (const match of source.matchAll(/\[\s*(['"])((?:\\.|(?!\1).)+)\1\s*\]\s*=\s*((['"])(?:\\.|(?!\4).)*\4)/g)) {
    const key = decodeLuaString(match[1] + match[2] + match[1]);
    const value = decodeLuaString(match[3]);
    if (key && value !== null) result.set(key, value);
  }
  return result;
}

const dictionaries = {
  en: localeMap(path.join(gameDir, 'en.lua')),
  ro: localeMap(path.join(gameDir, 'ro.lua')),
};

const translations = new Map();
for (const [key, english] of dictionaries.en) {
  const romanian = dictionaries.ro.get(key);
  if (romanian && romanian !== english && !translations.has(english)) translations.set(english, romanian);
}
const generatedFile = path.join(root, 'resources/[sunset]/sunset_ui/web/js/i18n.generated.js');
const generatedSource = fs.readFileSync(generatedFile, 'utf8');
const generated = JSON.parse(generatedSource.slice(generatedSource.indexOf('{'), generatedSource.lastIndexOf('}') + 1));
for (const [key, english] of Object.entries(generated.en)) {
  const romanian = generated.ro[key];
  if (romanian && romanian !== english && !translations.has(english)) translations.set(english, romanian);
}
const overrideFile = path.join(root, 'scripts/i18n-config-overrides.json');
const overrides = fs.existsSync(overrideFile) ? JSON.parse(fs.readFileSync(overrideFile, 'utf8')) : {};
for (const [source, pair] of Object.entries(overrides)) {
  if (pair && typeof pair.ro === 'string' && pair.ro.trim()) translations.set(source, pair.ro);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (excludedResources.has(entry.name)) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.lua') ? [file] : [];
  });
}

function slug(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'text';
}
function quote(value) { return JSON.stringify(value).replace(/\u2028|\u2029/g, ' '); }

const additions = { en: new Map(), ro: new Map() };
const unmatched = [];
let migrated = 0;

for (const file of walk(path.join(root, 'resources/[sunset]'))) {
  if (file.includes('/locales/') || file.endsWith('/fxmanifest.lua')) continue;
  let source = fs.readFileSync(file, 'utf8');
  const sanitized = source.replace(/`[^`\n]+`/g, text => '0' + ' '.repeat(text.length - 1));
  let tree;
  try { tree = lua.parse(sanitized, { luaVersion: '5.3', ranges: true }); }
  catch { continue; }
  const edits = [];
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const resource = rel.split('/')[2] || 'shared';
  const area = rel.replace(/^resources\/\[sunset\]\//, '').replace(/\.lua$/, '').replace(/[^a-z0-9]+/gi, '.').toLowerCase();

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'TableConstructorExpression') {
      const existing = new Set(node.fields.filter(f => f.type === 'TableKeyString').map(f => f.key.name));
      for (const field of node.fields) {
        if (field.type !== 'TableKeyString' || !fields.has(field.key.name) || existing.has(field.key.name + 'Key')) continue;
        if (field.value.type !== 'StringLiteral') continue;
        const sourceText = decodeLuaString(field.value.raw);
        if (!sourceText || !/[A-Za-zĂÂÎȘȚăâîșț]/.test(sourceText)) continue;
        const english = overrides[sourceText]?.en || sourceText;
        let romanian = translations.get(sourceText);
        if (!romanian) {
          unmatched.push({ file: rel, line: source.slice(0, field.range[0]).split('\n').length, field: field.key.name, value: sourceText });
          continue;
        }
        const digest = crypto.createHash('sha1').update(`${rel}:${field.key.name}:${english}`).digest('hex').slice(0, 8);
        const key = `config.${resource.replace(/^sunset_/, '')}.${field.key.name}.${slug(english)}.${digest}`;
        additions.en.set(key, english);
        additions.ro.set(key, romanian);
        edits.push({ at: field.range[0], text: `${field.key.name}Key = ${quote(key)}, ` });
        migrated++;
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(tree);
  for (const edit of edits.sort((a, b) => b.at - a.at)) source = source.slice(0, edit.at) + edit.text + source.slice(edit.at);
  if (edits.length) fs.writeFileSync(file, source);
}

for (const language of ['en', 'ro']) {
  const file = path.join(gameDir, `${language}.lua`);
  let source = fs.readFileSync(file, 'utf8');
  const at = source.lastIndexOf('}');
  const rows = [...additions[language]].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `    [${quote(key)}] = ${quote(value)},`).join('\n');
  fs.writeFileSync(file, source.slice(0, at) + (rows ? `${rows}\n` : '') + source.slice(at));
}

const report = path.join(root, 'docs/audit/i18n-config-unmatched.json');
fs.writeFileSync(report, JSON.stringify(unmatched, null, 2) + '\n');
console.log(`Added ${migrated} semantic config keys; ${unmatched.length} values need translations (${path.relative(root, report)}).`);
