#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.name === 'node_modules' || entry.name === '.git') return [];
  return entry.isDirectory() ? walk(full) : [full];
});
const escape = (value) => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');

// Recorded release decisions for items the literal scan cannot fully explain.
const ITEM_NOTES = {
  standard_tank: 'DECISION 2026-10-03: kept and connected. Diver standard-tier gear rental (rank 2+, sunset_jobs rentGear) grants it, dive contracts accept it, and shift end removes it via session.data.rentedGearItem (dynamic RemoveItem, not detected literally).',
};

function itemMatrix() {
  const itemFile = 'resources/[sunset]/sunset_core/shared/items.lua';
  const source = read(itemFile);
  const start = source.indexOf('Sunset.Items = {');
  const end = source.indexOf('\n}\n\nSunset.Shops', start);
  const block = source.slice(start, end);
  const matches = [...block.matchAll(/^\s{4}([a-z0-9_]+)\s*=\s*\{/gm)];
  const luaFiles = walk(path.join(root, 'resources/[sunset]')).filter((file) => file.endsWith('.lua'));
  const corpus = luaFiles.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const crafting = read('resources/[sunset]/sunset_core/shared/crafting.lua');
  const shops = source.slice(end);
  const rows = matches.map((match, index) => {
    const id = match[1];
    const itemBlock = block.slice(match.index, matches[index + 1]?.index ?? block.length);
    const label = itemBlock.match(/label\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? id;
    const quoted = new RegExp(`['"]${id}['"]`, 'g');
    const users = new Set();
    for (const entry of corpus) {
      if (entry.file.endsWith(itemFile)) continue;
      if (quoted.test(entry.text)) users.add(path.basename(path.dirname(path.dirname(entry.file))) === '[sunset]'
        ? path.basename(path.dirname(entry.file)) : entry.file.split('/resources/[sunset]/')[1]?.split('/')[0]);
      quoted.lastIndex = 0;
    }
    const sources = [];
    if (new RegExp(`output\\s*=\\s*\\{\\s*item\\s*=\\s*['"]${id}['"]`).test(crafting)) sources.push('crafting');
    if (new RegExp(`\\{\\s*item\\s*=\\s*['"]${id}['"][^}]*price\\s*=`).test(shops)) sources.push('shop');
    if (corpus.some(({ text }) => new RegExp(`AddItem\\([^\\n]*['"]${id}['"]`).test(text))) sources.push('server reward');
    if (!sources.length && users.size) sources.push('configured gameplay/loot');
    const sinks = [];
    if (new RegExp(`inputs\\s*=\\s*\\{[^}]*\\b${id}\\s*=`).test(crafting)) sinks.push('craft input');
    if (corpus.some(({ text }) => new RegExp(`RemoveItem\\([^\\n]*['"]${id}['"]`).test(text))) sinks.push('server consume');
    if (/usable\s*=\s*true/.test(itemBlock)) sinks.push('use');
    const craftInput = sinks.includes('craft input') ? 'yes' : 'no';
    const craftOutput = sources.includes('crafting') ? 'yes' : 'no';
    const usedBy = [...users].filter(Boolean).sort().join(', ') || 'catalog only';
    const obtainable = sources.length ? 'yes' : 'review';
    const orphan = users.size === 0 && !sources.length ? 'yes' : 'no';
    return `| ${escape(id)} | ${escape(label)} | ${escape(sources.join(', ') || 'none detected')} | ${escape(sinks.join(', ') || 'none detected')} | ${escape(usedBy)} | — | ${craftInput} | ${craftOutput} | ${usedBy.includes('sunset_quests') ? 'yes' : 'no'} | ${usedBy.includes('sunset_factions') ? 'yes' : 'no'} | ${obtainable} | ${orphan} | ${escape(ITEM_NOTES[id] || 'Static literal analysis; dynamic loot paths require live verification.')} |`;
  });
  return `# Item Economy Matrix\n\nCanonical static inventory map generated from current code on 2026-10-03. “Review” means no literal shop, craft output, or direct server reward was detected; it is a release checklist item, not proof that an item is impossible to obtain.\n\n| item_id | label | source(s) | sink(s) | used_by | sell_value | craft_input | craft_output | quest use | faction use | obtainable? | orphan? | notes |\n|---|---|---|---|---|---:|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

function resourceMatrix() {
  const base = path.join(root, 'resources/[sunset]');
  const cfg = read('config/server.cfg.template');
  const resources = fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sunset_') && fs.existsSync(path.join(base, entry.name, 'fxmanifest.lua')))
    .map((entry) => entry.name).sort();
  const rows = resources.map((name) => {
    const dir = path.join(base, name);
    const files = walk(dir);
    const lua = files.filter((file) => file.endsWith('.lua')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const state = new RegExp(`^ensure ${name}$`, 'm').test(cfg) ? 'production'
      : new RegExp(`^#@dev ensure ${name}$`, 'm').test(cfg) ? 'dev only' : 'disabled/optional';
    const completeness = files.length <= 1 ? 'placeholder/manifest only' : 'implemented';
    const security = /RegisterNetEvent|RegisterCallback/.test(lua) ? 'server entry points statically reviewed' : 'no gameplay mutation entry point detected';
    const progression = /quest:progress|CanAccess|level|license|faction|clan/.test(lua) ? 'connected or gated' : 'no direct progression hook';
    const economy = /AddMoney|RemoveMoney|AddItem|RemoveItem|reward|payout|price/.test(lua) ? 'economy/item path present' : 'none/directly cosmetic';
    const integration = [...lua.matchAll(/exports\.([a-z0-9_]+)/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join(', ') || 'standalone/support';
    const remaining = state === 'dev only' ? 'Keep disabled in production.' : state === 'disabled/optional' ? 'Confirm product decision before enable.' : 'Run resource restart and multiplayer scenario.';
    return `| ${name} | ${state} | ${completeness} | ${security} | ${progression} | ${economy} | ${escape(integration)} | no | ${remaining} |`;
  });
  return `# Current Resource Matrix\n\nGenerated from the ${resources.length} current \`sunset_*\` manifests and production configuration on 2026-10-03. “Runtime Tested: no” is deliberate: this pass had no live FiveM server/client evidence. Static review cannot establish restart, OneSync, or 48-player readiness.\n\n| Resource | Production State | Completeness | Security | Progression | Economy | Integration | Runtime Tested | Remaining Work |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

const mode = process.argv[2];
if (mode === '--items') process.stdout.write(itemMatrix());
else if (mode === '--resources') process.stdout.write(resourceMatrix());
else { console.error('usage: generate-release-matrices.js --items|--resources'); process.exit(2); }
