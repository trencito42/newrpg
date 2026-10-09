#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const manifest = fs.readFileSync(
  path.join(__dirname, '../resources/[sunset]/sunset_chat/fxmanifest.lua'),
  'utf8'
);

assert.match(manifest, /@oxmysql\/lib\/MySQL\.lua/);
assert.match(manifest, /dependencies\s*\{[^}]*oxmysql/);

console.log('test-chat-log-manifest: OK');
