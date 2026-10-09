#!/usr/bin/env node
'use strict';

/**
 * Assign turfs.owner_clan_id evenly across active/grace clans (round-robin by turf id).
 * Usage: node scripts/distribute-turfs-evenly.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env missing');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

function mariadb(env, sql) {
  const args = [
    `-h${env.MARIADB_HOST || '127.0.0.1'}`,
    `-u${env.MARIADB_USER}`,
    `-p${env.MARIADB_PASSWORD}`,
    env.MARIADB_DATABASE,
    '-e',
    sql,
  ];
  return execFileSync('mariadb', args, { encoding: 'utf8' });
}

async function main() {
  const env = loadEnv();
  const clanCount = Number(
    mariadb(env, "SELECT COUNT(*) FROM clans WHERE status IN ('active','grace')").trim(),
  );
  if (!clanCount) {
    console.error('No active/grace clans.');
    process.exit(1);
  }

  if (dryRun) {
    const preview = mariadb(
      env,
      `SELECT t.id, t.name, c.tag FROM turfs t
       LEFT JOIN clans c ON c.id = t.owner_clan_id ORDER BY t.id`,
    );
    console.log('Current state:\n' + preview);
    console.log(`Would redistribute ${clanCount} clan(s) round-robin. Run without --dry-run to apply.`);
    return;
  }

  const updateSql = `
START TRANSACTION;
SET @i := 0;
SET @j := 0;
UPDATE turfs t
JOIN (SELECT id, (@i := @i + 1) AS rn FROM turfs ORDER BY id) ordered ON ordered.id = t.id
JOIN (
  SELECT id, (@j := @j + 1) AS rn FROM clans WHERE status IN ('active','grace') ORDER BY id
) c ON c.rn = ((ordered.rn - 1) % ${clanCount}) + 1
SET t.owner_clan_id = c.id;
COMMIT;
SELECT t.id, t.name, c.tag FROM turfs t LEFT JOIN clans c ON c.id = t.owner_clan_id ORDER BY t.id;
`;
  const out = mariadb(env, updateSql);
  console.log(out);
  console.log('Done. Restart sunset_turfs on the game server (or reconnect) to refresh the map.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
