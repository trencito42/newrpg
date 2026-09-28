'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const luaparse = require('luaparse');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('migration names are unique, ordered, and tracked by immutable checksum runner', () => {
  const files = fs.readdirSync(path.join(root, 'database/migrations')).filter((name) => name.endsWith('.sql')).sort();
  assert.deepEqual(files, ['001_accounts.sql', '002_players.sql', '003_sessions.sql', '004_admin.sql', '005_staff_tools.sql', '006_support_invariants.sql']);
  assert.equal(new Set(files.map((name) => name.slice(0, 3))).size, files.length);
  const runner = read('scripts/migrate.sh');
  assert.match(runner, /checksum mismatch/);
  assert.match(runner, /GET_LOCK/);
});

test('identity schema has one-to-one player and case-insensitive uniqueness', () => {
  const accounts = read('database/migrations/001_accounts.sql');
  const players = read('database/migrations/002_players.sql');
  assert.match(accounts, /UNIQUE KEY uq_accounts_username_normalized/);
  assert.match(accounts, /UNIQUE KEY uq_accounts_email_normalized/);
  assert.match(players, /PRIMARY KEY \(account_id\)/);
  assert.match(players, /FOREIGN KEY \(account_id\).*ON DELETE CASCADE/);
  assert.match(players, /a_m_m_bevhills_02|model VARCHAR/);
});

test('registration maps both allowed sex values to the required models', () => {
  const config = read('resources/[framework]/rpg_core/shared/config.lua');
  const registry = read('resources/[framework]/rpg_core/server/registry.lua');
  assert.match(config, /male\s*=\s*'a_m_m_bevhills_02'/);
  assert.match(config, /female\s*=\s*'u_f_y_taylor'/);
  assert.match(registry, /sex ~= 'male' and sex ~= 'female'/);
  assert.match(registry, /model = RPG\.Config\.models\[sex\]/);
});

test('all required admin commands are registered centrally', () => {
  const source = read('resources/[framework]/rpg_admin/server/main.lua');
  const required = ['aduty','a','admins','ainfo','goto','bring','back','coords','freeze','unfreeze','heal','revive','respawn','spectate','warn','history','kick','ban','banip','unban','announce','cc','setadmin','serverstats'];
  for (const command of required) {
    const direct = new RegExp(`name\\s*=\\s*['\"]${command}['\"]`).test(source);
    const helper = new RegExp(`healthCommand\\(['\"]${command}['\"]`).test(source);
    assert.equal(direct || helper, true, `missing /${command}`);
  }
  assert.match(source, /aliases\s*=\s*\{['"]tempban['"]\}/);
});

test('core excludes unrequested gameplay domains and client cannot complete tutorial directly', () => {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target); else if (/\.(lua|js)$/.test(entry.name)) files.push(target);
    }
  };
  walk(path.join(root, 'resources/[framework]/rpg_core'));
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n').toLowerCase();
  for (const forbidden of ['inventory', 'crafting', 'casino', 'owned_vehicle', 'businesses']) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(read('resources/[framework]/rpg_core/server/registry.lua'), /player\.state ~= 'onboarding'/);
});

test('staff extension includes every requested command and persisted support schema', () => {
  const source = read('resources/[framework]/rpg_admin/server/extended.lua');
  const main = read('resources/[framework]/rpg_admin/server/main.lua');
  const requested = ['hduty','e','lc','pm','report','cr','n','an','nd','nmute','mute','noclip','mark','gotomark','disarm','disarmarea','sethp','sethparea','givegun','givemoney','giverpall','setstat','setvw','createhouse','setleader','sethelper','spawncar','gotocar','getcar','respawncars','fixveh','entercar','togfind','afklist'];
  for (const command of requested) assert.match(source, new RegExp(`name=['"]${command}['"]`), `missing /${command}`);
  assert.match(main, /aliases\s*=\s*\{['"]spec['"]\}/);
  assert.match(main, /aliases\s*=\s*\{['"]gethere['"]\}/);
  assert.match(main, /aliases\s*=\s*\{['"]anno['"]\}/);
  const migration = read('database/migrations/005_staff_tools.sql');
  for (const table of ['player_reports','newbie_questions','houses','server_vehicles','factions']) assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
  const invariants = read('database/migrations/006_support_invariants.sql');
  assert.match(invariants, /uq_one_open_report_per_account/);
  assert.match(invariants, /uq_one_open_question_per_account/);
});

test('Lua sources parse and fxmanifest file references exist', () => {
  const framework = path.join(root, 'resources/[framework]');
  for (const resource of fs.readdirSync(framework)) {
    const resourcePath = path.join(framework, resource);
    for (const directory of ['shared', 'server', 'client']) {
      const sourcePath = path.join(resourcePath, directory);
      if (!fs.existsSync(sourcePath)) continue;
      for (const file of fs.readdirSync(sourcePath).filter((name) => name.endsWith('.lua'))) {
        const source = fs.readFileSync(path.join(sourcePath, file), 'utf8');
        assert.doesNotThrow(() => luaparse.parse(source, { luaVersion: '5.3' }), `${resource}/${directory}/${file}`);
      }
    }
    const manifest = read(`resources/[framework]/${resource}/fxmanifest.lua`);
    for (const match of manifest.matchAll(/['"]((?:shared|server|client)\/[^'"]+\.(?:lua|js))['"]/g)) {
      assert.equal(fs.existsSync(path.join(resourcePath, match[1])), true, `${resource}: missing ${match[1]}`);
    }
  }
});
