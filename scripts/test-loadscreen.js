#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assetDir = path.join(__dirname, '../resources/[sunset]/sunset_loadscreen');
const source = fs.readFileSync(path.join(__dirname, '../resources/[sunset]/sunset_loadscreen/script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../resources/[sunset]/sunset_loadscreen/index.html'), 'utf8');
assert.match(html, /id="loading-pct">0<span>%<\/span>/, 'initial HTML must contain 0%');
for (const [file, url] of [['script.js', 'script.js'], ['style.css', 'style.css'], ['assets/fonts/gfonts.css', 'assets/fonts/gfonts.css']]) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(assetDir, file))).digest('hex').slice(0, 16);
    assert(html.includes(`${url}?v=${hash}`), `${url} URL must match its content hash`);
}

function boot(debug = false) {
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
    elements.get('loading-pct').innerHTML = '0<span>%</span>';
    const listeners = new Map();
    const rafs = [];
    const timers = [];
    const logs = [];
    const document = {
        documentElement: { lang: 'en' }, visibilityState: 'visible',
        currentScript: { src: 'nui://script.js?v=test' },
        getElementById(id) { return elements.get(id); },
        createElement() { return element(); },
        querySelector(selector) { return selector.startsWith('meta') ? { content: 'test' } : { href: 'nui://style.css?v=test' }; },
        querySelectorAll(selector) { return selector === '.rpm-segment' ? elements.get('rpm-bar').children : []; },
        addEventListener(name, callback) { listeners.set(name, callback); },
    };
    const window = {
        localStorage: { getItem() { return debug ? '1' : null; } },
        addEventListener(name, callback) { listeners.set(name, callback); },
    };
    vm.runInNewContext(source, {
        document, window, navigator: { language: 'en' },
        console: { log(...args) { logs.push(args.join(' ')); }, error(...args) { logs.push(args.join(' ')); } },
        Date, Math, Number, String, Object, Array, Set,
        performance: { now: () => 0, timeOrigin: 1 },
        setTimeout(callback) { timers.push(callback); }, setInterval() {},
        requestAnimationFrame(callback) { rafs.push(callback); },
    });
    return {
        send(eventName, extra = {}) { listeners.get('message')({ data: { eventName, ...extra } }); },
        frame() { const callbacks = rafs.splice(0); callbacks.forEach((callback) => callback()); },
        pct() { return Number(elements.get('loading-pct').innerHTML.match(/\d+/)?.[0] || 0); },
        faded() { return elements.get('loadscreen').classList.contains('fade-out'); },
        logs, timers,
    };
}

const normal = boot();
normal.send('loadProgress', { loadFraction: 1 });
normal.send('onLogLine', { message: 'diagnostics should be ignored' });
normal.send('startDataFileEntries', { count: 10 });
normal.send('onDataFileEntry', { name: 'example' });
normal.send('endDataFileEntries');
normal.send('startInitFunction', { type: 'resource' });
normal.send('startInitFunctionOrder', { count: 2 });
normal.send('initFunctionInvoking', { name: 'first' });
normal.send('initFunctionInvoked', { name: 'first' });
normal.send('initFunctionInvoked', { name: 'second' });
normal.send('endInitFunction', { type: 'resource' });
normal.send('performMapLoadFunction', { idx: 1, count: 1 });
assert.strictEqual(normal.pct(), 0, 'events before first paint must not mutate initial visual 0%');
normal.frame();
assert.strictEqual(normal.pct(), 0, 'first rAF is before paint and must still show 0%');
normal.frame();
assert.strictEqual(normal.pct(), 95, 'second frame flushes real progress');
normal.send('loadProgress', { loadFraction: 0.5 });
assert.strictEqual(normal.pct(), 95, 'progress must never move backwards');
normal.send('sunsetHandoff');
assert.strictEqual(normal.pct(), 100, 'terminal handoff may display 100 after first paint');
assert.strictEqual(normal.faded(), true, 'handoff immediately begins fade');
normal.send('sunsetHandoff');
assert.strictEqual(normal.timers.length, 0, 'handoff must not schedule an artificial delay');
assert.strictEqual(normal.logs.length, 0, 'normal boots must not emit diagnostic logs');

const early = boot();
early.send('loadProgress', { loadFraction: 1 });
early.send('sunsetHandoff');
assert.strictEqual(early.pct(), 0, 'handoff before paint must never expose 100 as first visible frame');
assert.strictEqual(early.faded(), true, 'early handoff closes immediately');
early.frame();
early.frame();
assert.strictEqual(early.pct(), 0, 'late paint callbacks must not reveal terminal 100');

const traced = boot(true);
traced.send('loadProgress', { loadFraction: 0.2 });
traced.frame();
traced.frame();
assert(traced.logs.some((line) => line.includes('[LOADSCREEN BUILD]')), 'debug build fingerprint required');
assert(traced.logs.some((line) => line.includes('[LS-PAINT] first_raf')), 'debug first-rAF trace required');
assert(traced.logs.some((line) => line.includes('[LS-PAINT] second_raf')), 'debug second-rAF trace required');
assert(traced.logs.some((line) => line.includes('[LS-EVENT] first_loadProgress')), 'debug event order required');

console.log('Loadscreen: pre-paint 0%, first-frame gate, real progress, terminal handoff, no delay, quiet production, debug trace OK.');
