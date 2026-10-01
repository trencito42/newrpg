#!/usr/bin/env node
// Regression guards for the inventory-owned transactional API (static; no Lua runtime available).
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const sunset = path.join(root, 'resources', '[sunset]');
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : e.name.endsWith('.lua') && o.push(p); } return o; };
const read = f => fs.readFileSync(f, 'utf8');

// 1. Only sunset_inventory (plus documented in-own-transaction writers) may touch inventory tables in SQL.
const DOCUMENTED = new Set(['sunset_inventory', 'sunset_crafting', 'sunset_jobs', 'sunset_core', 'sunset_testdriver']);
const SQL = /\b(UPDATE|INSERT\s+(?:IGNORE\s+)?INTO|DELETE(?:\s+\w+)?\s+FROM|SELECT[^;]*?FROM|JOIN)\s+`?(character_inventory|container_inventory)\b/i;
const offenders = [];
for (const f of walk(sunset)) {
  const res = path.relative(sunset, f).split(path.sep)[0];
  if (DOCUMENTED.has(res)) continue;
  if (SQL.test(read(f))) offenders.push(path.relative(root, f));
}
ok(offenders.length === 0, 'no undocumented resource references inventory tables in SQL ' + offenders.join(','));
// documented writers must not grow: crafting/jobs writes are inside their own txns (see IMPL doc)
for (const r of ['sunset_vehicles', 'sunset_robbery', 'sunset_properties', 'sunset_dealership'])
  ok(!walk(path.join(sunset, r)).some(f => /character_inventory|container_inventory/.test(read(f))), r + ' has no inventory SQL');

// 2. API validates counts
const api = read(path.join(sunset, 'sunset_inventory/server/api.lua'));
ok(/local function whole\(/.test(api) && /v == math\.floor\(v\)/.test(api) && /v ~= math\.huge/.test(api) && /v == v/.test(api), 'whole-number/NaN/inf check present');
ok((api.match(/whole\(op\.count, 1, MAX_OP_COUNT\)/g) || []).length === 2, 'add and remove both bound count to [1, MAX_OP_COUNT]');
ok(/MAX_OPS\s*=\s*\d+/.test(api) && /FOR UPDATE/.test(api) && /MySQL\.startTransaction/.test(api), 'ops capped, rows locked, single transaction');
ok(/count >= \?/.test(api), 'decrement is guarded (count >= ?)');
ok(/exports\('ApplyOperation'/.test(api), 'ApplyOperation exported');
const m = api.match(/MAX_OP_COUNT\s*=\s*(\d+)/); ok(m && +m[1] <= 1000000, 'MAX_OP_COUNT is sane');
const man = read(path.join(sunset, 'sunset_inventory/fxmanifest.lua'));
ok(/server\/api\.lua/.test(man) && /'ApplyOperation'/.test(man), 'manifest loads api.lua and lists export');

// 3. vehicles uses the API
const veh = read(path.join(sunset, 'sunset_vehicles/server/main.lua'));
ok((veh.match(/sunset_inventory:ApplyOperation/g) || []).length >= 3, 'vehicles uses ApplyOperation (fill, use, rollback)');
ok(!/UPDATE characters/i.test(veh), 'vehicles has no direct characters writes');

// 4. dropSync not broadcast
const trade = read(path.join(sunset, 'sunset_inventory/server/trade.lua'));
ok(!/dropSync', -1/.test(trade), 'dropSync is not broadcast with -1');
ok(/DROP_SYNC_RADIUS/.test(trade) && /GetPlayerRoutingBucket/.test(trade), 'dropSync is radius + routing-bucket aware');

// 5. no bare MySQL.* inside startTransaction callbacks in inventory main.lua (the old moveSlot bug)
const inv = read(path.join(sunset, 'sunset_inventory/server/main.lua'));
const blocks = inv.split('MySQL.startTransaction(').slice(1).map(b => b.slice(0, b.indexOf('\n            end)') > 0 ? b.indexOf('\n            end)') : 1500));
ok(blocks.every(b => !/MySQL\.(update|query|single|scalar|insert)\.await/.test(b.split('end)')[0])), 'no bare MySQL.* inside inventory transaction callbacks');

console.log(failed ? `\n${failed} FAILED` : '\nall inventory API guards passed');
process.exit(failed ? 1 : 0);
