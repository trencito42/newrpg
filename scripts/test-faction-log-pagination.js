#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logs = fs.readFileSync(path.join(root, 'panel/src/lib/faction-logs.ts'), 'utf8');
const panel = fs.readFileSync(
  path.join(root, 'panel/src/components/organizations/OrganizationFactionLogsPanel.tsx'),
  'utf8'
);

assert.match(logs, /FACTION_LOG_PROFILE_PAGE_SIZE = 5/);
assert.match(logs, /5, 10, 25, 50/);
assert.match(panel, /requestSeq/);
assert.match(panel, /showing_range/);

console.log('test-faction-log-pagination: OK');
