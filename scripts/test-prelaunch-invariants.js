#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

const quests = read('resources/[sunset]/sunset_quests/server/main.lua');
const chains = read('resources/[sunset]/sunset_quests/shared/chains.lua');
const factions = read('resources/[sunset]/sunset_factions/server/management.lua');
const panelApply = read('panel/src/app/api/organizations/[type]/[id]/applications/route.ts');
const panelReview = read('panel/src/app/api/organizations/[type]/[id]/applications/[appId]/review/route.ts');
const panelProgression = read('panel/src/lib/progression-access.ts');
const crafting = read('resources/[sunset]/sunset_crafting/server/main.lua');
const recipes = read('resources/[sunset]/sunset_core/shared/crafting.lua');
const items = read('resources/[sunset]/sunset_core/shared/items.lua');
const casino = read('resources/[sunset]/sunset_casino/server/main.lua');
const missions = read('resources/[sunset]/sunset_missions/server/main.lua');
const cfg = read('config/server.cfg.template');
const brand = read('resources/[sunset]/sunset_core/shared/config.lua');

must(chains.includes("key = 'life_reach_level10'"), 'missing life_reach_level10 quest');
must(quests.includes("['faction.apply'] = { minLevel = 10, questKey = 'life_reach_level10' }"), 'canonical faction gate drifted');
must(factions.includes("CanAccess(playerSource, 'faction.apply')"), 'in-game faction join does not use canonical gate');
must(panelApply.includes('getFactionApplicationAccess'), 'panel apply bypasses canonical panel progression gate');
must(panelReview.includes('session.adminLevel < 3'), 'panel review lacks explicit admin-only bypass');
must(panelReview.includes('getFactionApplicationAccess'), 'panel review bypasses canonical panel progression gate');
must(panelProgression.includes('life_reach_level10') && panelProgression.includes('FACTION_APPLICATION_LEVEL = 10'), 'panel progression policy drifted');

must(crafting.includes("RegisterCallback('sunset:craftBegin'"), 'crafting lacks begin handshake');
must(crafting.includes('now < pending.readyAt'), 'crafting does not enforce server timer');
must(crafting.includes('PendingCrafts[source] = nil -- one shot'), 'craft token is not consumed one-shot');
must(/ems_medkit\s*=\s*\{[\s\S]*?output\s*=\s*\{\s*item\s*=\s*'medkit'/.test(recipes), 'EMS medkit recipe output regressed');
must(/medkit\s*=\s*\{[^\n]*heal\s*=\s*75/.test(items), 'medkit item is missing or not usable');
must(!items.includes('driver_license ='), 'duplicate driver_license inventory truth returned');

for (const callback of ['blackjackStart', 'slotsSpin', 'rouletteSpin', 'wheelSpin']) {
  must(!casino.includes(`sunset:casino:${callback}`), `casino hub reintroduced duplicate ${callback} owner`);
}
must(!missions.includes('data.escaped == true'), 'mission escape bonus trusts client input');
must(cfg.includes('#@dev add_unsafe_child_process_permission racket_vehicle_thumbs'), 'thumbnail child process permission is not dev-only');
must(!/^add_unsafe_child_process_permission racket_vehicle_thumbs$/m.test(cfg), 'thumbnail child process permission is enabled in production');
must(/^# ensure sunset_needs$/m.test(cfg), 'legacy survival drain is enabled in production');
must(brand.includes("DisplayName = 'Racket RPG'") && brand.includes("CurrencyShort = 'RC'"), 'canonical Racket brand config drifted');

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Prelaunch invariants: progression, crafting, casino ownership, missions, branding and production tooling are locked.');
