#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../resources/[sunset]/sunset_ui/web/js/chat.js'), 'utf8');
const method = source.match(/    positionChannelDropdown\(\) \{[\s\S]*?\n    \},/);
assert.ok(method, 'channel dropdown placement method exists');

function placement(top, bottom, contentHeight, viewportHeight) {
    const classes = new Set();
    const dropdown = {
        scrollHeight: contentHeight,
        style: {},
        classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    };
    const toggle = { getBoundingClientRect: () => ({ top, bottom }) };
    const context = {
        window: { innerHeight: viewportHeight },
        $: (selector) => selector === '#chat-channel-toggle' ? toggle : dropdown,
        Math,
    };
    vm.runInNewContext(`const Chat = { ${method[0]} }; Chat.positionChannelDropdown();`, context);
    return { below: classes.has('open-below'), maxHeight: Number.parseInt(dropdown.style.maxHeight, 10) };
}

assert.deepEqual(placement(210, 240, 260, 1080), { below: true, maxHeight: 828 });
assert.deepEqual(placement(700, 730, 260, 1080), { below: false, maxHeight: 688 });
assert.deepEqual(placement(150, 180, 1200, 360), { below: true, maxHeight: 168 });
console.log('Chat dropdown: opens on the visible side and caps its scroll height.');
