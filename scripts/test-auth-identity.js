#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_core/server/main.lua'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_auth/server/main.lua'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'sql/76-account-identity-isolation.sql'), 'utf8');

const start = core.indexOf('local function completeAuthenticationInner');
const end = core.indexOf('local AuthInFlight', start);
assert(start >= 0 && end > start, 'CompleteAuthentication implementation must be present');
const complete = core.slice(start, end);

assert.match(complete, /SELECT \* FROM players WHERE account_id = \?/,
    'player ownership must be loaded by authenticated account_id');
assert.doesNotMatch(complete, /SELECT[^\n]*FROM players WHERE license\s*=\s*\?/i,
    'authentication must never recover player ownership by FiveM license');
assert.doesNotMatch(complete, /UPDATE players SET account_id\s*=/i,
    'authentication must never reassign an existing player profile');
assert.match(complete, /INSERT INTO players \(account_id, license, steam, discord, name\)/,
    'a new account must create its own player profile');

assert.match(core, /SELECT \* FROM characters WHERE id = \? AND player_id = \?/,
    'character loading must prove ownership through the authenticated player');
assert.match(core, /SELECT \* FROM characters WHERE player_id = \? ORDER BY slot/,
    'character listing must be scoped to the authenticated player');
assert.match(auth, /LOWER\(a\.username\) = LOWER\(\?\) AND q\.token_hash = \? AND q\.device_hash = \?/,
    'quick login must bind username, token, and device');
assert.match(auth, /DELETE FROM auth_quick_tokens WHERE account_id = \?/,
    'password changes must revoke only the affected account tokens');

assert.match(migration, /DROP INDEX license/,
    'the global unique license ownership constraint must be removed');
assert.match(migration, /UNIQUE KEY uq_players_account_id \(account_id\)/,
    'database must enforce one player profile per account');
assert.match(migration, /UNIQUE KEY uq_account_identifier \(account_id, identifier_type, identifier_value\)/,
    'device history uniqueness must be account-scoped');

console.log('Auth identity invariant: account_id owns players and characters; license is device metadata only.');
