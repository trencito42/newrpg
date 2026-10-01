#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function element() {
    const classes = new Set();
    return {
        innerHTML: '', textContent: '', innerText: '', dataset: {}, style: {}, children: [],
        classList: {
            add(...names) { names.forEach((name) => classes.add(name)); },
            remove(...names) { names.forEach((name) => classes.delete(name)); },
            contains(name) { return classes.has(name); },
        },
        appendChild(child) { this.children.push(child); },
    };
}

const elements = new Map(['loadscreen', 'loading-pct', 'loading-task', 'loading-files', 'tip-text', 'rpm-bar']
    .map((id) => [id, element()]));
const listeners = new Map();
const timers = [];
const document = {
    documentElement: { lang: 'en' },
    visibilityState: 'visible',
    getElementById(id) { return elements.get(id); },
    createElement() { return element(); },
    querySelectorAll(selector) { return selector === '.rpm-segment' ? elements.get('rpm-bar').children : []; },
    addEventListener() {},
};
const window = {
    localStorage: { getItem() { return null; } },
    addEventListener(name, callback) { listeners.set(name, callback); },
};
const source = fs.readFileSync(path.join(__dirname, '../resources/[sunset]/sunset_loadscreen/script.js'), 'utf8');
const logs = [];
vm.runInNewContext(source, {
    document, window, navigator: { language: 'en' }, console: { log(...args) { logs.push(args); } },
    Date, Math, Number, String, Object, Array, Set, performance: { now: () => 0 },
    setTimeout(callback) { timers.push(callback); }, setInterval() {}, requestAnimationFrame() {},
});
const send = (eventName, extra = {}) => listeners.get('message')({ data: { eventName, ...extra } });
const pct = () => Number(elements.get('loading-pct').innerHTML.match(/\d+/)?.[0] || 0);

send('loadProgress', { loadFraction: 1 });
assert.strictEqual(pct(), 70, 'download completion must not display 100%');
send('startInitFunctionOrder', { count: 2 });
send('initFunctionInvoked', { name: 'first' });
send('initFunctionInvoking', { name: 'second' });
send('initFunctionInvoked', { name: 'second' });
send('performMapLoadFunction', { idx: 1, count: 1 });
assert.strictEqual(pct(), 95, 'world initialization must stay below 100%');
send('loadProgress', { loadFraction: 0.5 });
assert.strictEqual(pct(), 95, 'progress must never move backwards');
send('sunsetHandoff');
assert.strictEqual(pct(), 100, 'handoff sets the terminal percentage');
send('sunsetHandoff');
assert.strictEqual(timers.length, 1, 'duplicate handoff must not schedule another fade');
assert.strictEqual(logs.length, 0, 'normal boots must not emit debug logs');
console.log('Loadscreen: monotonic progress, terminal handoff, idempotence, quiet production logging OK.');
