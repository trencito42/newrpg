#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const drugsServer = read('resources/[sunset]/sunset_drugs/server/main.lua');
const drugsClient = read('resources/[sunset]/sunset_drugs/client/main.lua');
const drugUi = read('resources/[sunset]/sunset_ui/web/js/drugs.js');
const inventory = read('resources/[sunset]/sunset_inventory/server/main.lua');
const bridge = read('resources/[sunset]/sunset_ui/client/nui_bridge.lua');

assert.match(drugsServer, /sunset:drugs:startLabAttempt/);
assert.match(drugsServer, /LabAttempts\[source\] = nil\n\n    local removals/,
    'lab attempt token must be consumed before craft mutation');
assert.match(drugsServer, /exports\.sunset_inventory:CraftRecipe/);
assert.match(drugsServer, /sunset:drugs:beginSaleNegotiation/);
assert.doesNotMatch(drugUi, /btnStart\.onclick/,
    'lab start must use a single delegated handler');
assert.match(drugUi, /await postToResource\('startLabAttempt'/);
assert.match(drugUi, /await postToResource\('processSuccess'/);
assert.doesNotMatch(drugUi, /this\.inventory\[recipe\.rawItem\] = Math\.max\(0, \(this\.inventory\[recipe\.rawItem\]/,
    'lab UI must not optimistically mutate inventory on success');
assert.match(inventory, /function CraftRecipe/);
assert.match(inventory, /exports\('CraftRecipe'/);
assert.match(drugsClient, /startLabAttempt/);
assert.match(drugsClient, /beginSaleNegotiation/);
assert.match(bridge, /forward\('startLabAttempt'\)/);
assert.match(bridge, /forward\('beginSaleNegotiation'\)/);

console.log('test-drug-lab: 13 checks passed');
