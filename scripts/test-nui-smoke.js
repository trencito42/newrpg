#!/usr/bin/env node
/**
 * test-nui-smoke.js
 * Headless NUI Smoke Tests for robbery hacking graph, pass rendering, and racing countdown.
 * Zero external dependencies — runs directly in standard Node.js vm environment.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');

console.log('═══════════════════════════════════════════════════════');
console.log('  NUI Headless Smoke Tests (Robbery, Pass, Racing)');
console.log('═══════════════════════════════════════════════════════\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${message}`);
        failedTests++;
    } else {
        console.log(`  ✅ PASS: ${message}`);
        passedTests++;
    }
}

// ─────────────────────────────────────────────────────────────
// Minimal DOM Mock Factory
// ─────────────────────────────────────────────────────────────
function createMockElement(tagName = 'div', id = '') {
    const classList = new Set();
    const children = [];
    const dataset = {};
    const style = {};
    const listeners = {};
    let innerHTML = '';
    let textContent = '';

    const el = {
        tagName: tagName.toUpperCase(),
        id,
        dataset,
        style,
        disabled: false,
        classList: {
            add: (c) => classList.add(c),
            remove: (c) => classList.delete(c),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (classList.has(c)) classList.delete(c);
                    else classList.add(c);
                } else if (force) {
                    classList.add(c);
                } else {
                    classList.delete(c);
                }
            },
            contains: (c) => classList.has(c),
        },
        appendChild: (child) => {
            children.push(child);
            return child;
        },
        removeChild: (child) => {
            const idx = children.indexOf(child);
            if (idx >= 0) children.splice(idx, 1);
            return child;
        },
        remove: function() {
            // noop or detach
        },
        setAttribute: (name, val) => {
            if (name === 'class') {
                classList.clear();
                val.split(/\s+/).filter(Boolean).forEach(c => classList.add(c));
            }
        },
        addEventListener: (event, handler) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        },
        querySelector: (sel) => el.querySelectorAll(sel)[0] || null,
        querySelectorAll: (sel) => {
            const results = [];
            function search(node) {
                for (const c of node.childNodes) {
                    let match = false;
                    if (sel.startsWith('#') && c.id === sel.slice(1)) match = true;
                    else if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) match = true;
                    else if (sel.startsWith('[data-id="') && c.dataset.id === sel.slice(10, -2)) match = true;
                    if (match) results.push(c);
                    search(c);
                }
            }
            search(el);
            return results;
        },
        hasChildNodes: () => children.length > 0,
        scrollIntoView: () => {},
        get children() { return children; },
        get childNodes() { return children; },
        get className() { return Array.from(classList).join(' '); },
        set className(val) {
            classList.clear();
            String(val).split(/\s+/).filter(Boolean).forEach(c => classList.add(c));
        },
        get textContent() { return textContent; },
        set textContent(val) { textContent = String(val); },
        get innerText() { return textContent; },
        set innerText(val) { textContent = String(val); },
        get innerHTML() { return innerHTML; },
        set innerHTML(val) {
            innerHTML = String(val);
            // If innerHTML contains elements, parse basic tags
            children.length = 0;
            const tagRegex = /<([a-z0-9-]+)([^>]*)>(.*?)<\/\1>|<div\s+class="([^"]+)"([^>]*)>(.*?)<\/div>/gis;
            let match;
            while ((match = tagRegex.exec(val)) !== null) {
                const tag = match[1] || 'div';
                const classAttr = match[4] || (match[2] && match[2].match(/class="([^"]+)"/)?.[1]);
                const child = createMockElement(tag);
                if (classAttr) {
                    classAttr.split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
                }
                children.push(child);
            }
        }
    };
    return el;
}

function createMockWindow() {
    const elementsById = new Map();
    const eventListeners = {};

    const doc = {
        getElementById: (id) => {
            if (!elementsById.has(id)) {
                elementsById.set(id, createMockElement('div', id));
            }
            return elementsById.get(id);
        },
        querySelector: (sel) => {
            if (sel.startsWith('#')) return doc.getElementById(sel.slice(1));
            return createMockElement('div');
        },
        querySelectorAll: (sel) => [],
        createElement: (tag) => createMockElement(tag),
        createElementNS: (ns, tag) => createMockElement(tag),
        addEventListener: (event, handler) => {
            if (!eventListeners[event]) eventListeners[event] = [];
            eventListeners[event].push(handler);
        },
        body: createMockElement('body', 'body'),
        documentElement: { lang: 'en' },
    };

    const win = {
        document: doc,
        window: null,
        location: { search: '' },
        URLSearchParams,
        URL,
        console,
        performance: { now: () => Date.now() },
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        GetParentResourceName: () => 'sunset_test',
        fetch: async () => ({ json: async () => ({}) }),
        addEventListener: (event, handler) => {
            if (!eventListeners[event]) eventListeners[event] = [];
            eventListeners[event].push(handler);
        },
        dispatchEvent: (ev) => {},
        postMessage: (data) => {
            if (eventListeners['message']) {
                eventListeners['message'].forEach(h => h({ data }));
            }
        },
        Intl,
        Math,
        Array,
        Object,
        String,
        Number,
        Set,
        Map,
        Date,
        JSON,
    };
    win.window = win;
    return win;
}

// ─────────────────────────────────────────────────────────────
// 1. ROBBERY HACKING GRAPH SMOKE TEST
// ─────────────────────────────────────────────────────────────
console.log('[Test 1] Sunset Robbery Hack Rendering');

const robberyAppJsPath = path.join(repoRoot, 'resources', '[sunset]', 'sunset_robbery', 'web', 'app.js');
const i18nGenPath = path.join(repoRoot, 'resources', '[sunset]', 'sunset_ui', 'web', 'js', 'i18n.generated.js');
const i18nJsPath = path.join(repoRoot, 'resources', '[sunset]', 'sunset_ui', 'web', 'js', 'i18n.js');

const rWin = createMockWindow();
rWin.GetParentResourceName = () => 'sunset_robbery';

// Initialize robbery DOM elements
const hackPanel = rWin.document.getElementById('hack');
hackPanel.classList.add('hidden');
const hackNodesContainer = rWin.document.getElementById('hack-nodes');
const hackLinesContainer = rWin.document.getElementById('hack-lines');
const hackTrace = rWin.document.getElementById('hack-trace');
const hackTraceFill = rWin.document.getElementById('hack-trace-fill');
const hackStatus = rWin.document.getElementById('hack-status');
const hackSignal = rWin.document.getElementById('hack-signal');
const hackTime = rWin.document.getElementById('hack-time');

// Execute i18n + robbery app.js
const contextR = vm.createContext(rWin);
vm.runInContext(fs.readFileSync(i18nGenPath, 'utf8'), contextR);
vm.runInContext(fs.readFileSync(i18nJsPath, 'utf8'), contextR);
vm.runInContext(fs.readFileSync(robberyAppJsPath, 'utf8'), contextR);

const mockHackData = {
    timeLimit: 34,
    sourceId: 'C1R1',
    currentNode: 'C1R1',
    signal: 2,
    nodes: [
        { id: 'C1R1', x: 20, y: 20, kind: 'source', frequency: 1, label: 'ENTRY' },
        { id: 'C1R2', x: 50, y: 20, kind: 'normal', frequency: 2, label: 'NODE-A' },
        { id: 'C1R3', x: 80, y: 50, kind: 'locked', frequency: 2, label: 'CORE' },
    ],
    edges: [
        { from: 'C1R1', to: 'C1R2' },
        { from: 'C1R2', to: 'C1R3' },
    ],
};

rWin.postMessage({ action: 'hackShow', data: mockHackData });

assert(!hackPanel.classList.contains('hidden'), 'Robbery #hack panel is visible');
assert(hackNodesContainer.children.length === 3, `Robbery rendered 3 hack nodes (got ${hackNodesContainer.children.length})`);
assert(hackLinesContainer.children.length === 2, `Robbery rendered 2 hack svg edges (got ${hackLinesContainer.children.length})`);
assert(hackTrace.textContent === '0%', `Initial trace percentage is 0% (got '${hackTrace.textContent}')`);
assert(hackStatus.textContent.length > 0, `Hack status text is populated (got '${hackStatus.textContent}')`);

// ─────────────────────────────────────────────────────────────
// 2. PASS / BATTLEPASS SMOKE TEST
// ─────────────────────────────────────────────────────────────
console.log('\n[Test 2] Sunset Pass / Battlepass UI Rendering');

const passAppJsPath = path.join(repoRoot, 'resources', '[sunset]', 'sunset_pass', 'web', 'app.js');
const pWin = createMockWindow();
pWin.GetParentResourceName = () => 'sunset_pass';

const bpWrapper = pWin.document.getElementById('bp-wrapper');
bpWrapper.classList.add('hidden');
const bpTrack = pWin.document.getElementById('bp-track');
const dailyList = pWin.document.getElementById('daily-list');
const weeklyList = pWin.document.getElementById('weekly-list');
const uiLvl = pWin.document.getElementById('ui-lvl');
const uiXpText = pWin.document.getElementById('ui-xp-text');
const seasonTitle = pWin.document.getElementById('season-title');

const contextP = vm.createContext(pWin);
vm.runInContext(fs.readFileSync(i18nGenPath, 'utf8'), contextP);
vm.runInContext(fs.readFileSync(i18nJsPath, 'utf8'), contextP);
vm.runInContext(fs.readFileSync(passAppJsPath, 'utf8'), contextP);

const mockPassData = {
    tab: 'battlepass',
    state: {
        seasonLabel: 'Season 01',
        tier: 3,
        tierXp: 300,
        tierGoal: 500,
        premium: false,
        premiumCost: 250,
        tiers: [
            { level: 1, free: { label: '$1,000', icon: 'cash', claimed: true }, premium: { label: 'VIP Pack', icon: 'backpack', claimed: false } },
            { level: 2, free: { label: '$2,000', icon: 'cash', claimed: true }, premium: { label: 'Skin Box', icon: 'backpack', claimed: false } },
            { level: 3, free: { label: '$3,000', icon: 'cash', claimed: false }, premium: { label: 'Super Car', icon: 'veh_engine', claimed: false } },
        ],
        missions: [
            { id: '1', type: 'daily', title: 'Daily Driver', description: 'Drive 10km', progress: 10, goal: 10, xp: 200, icon: 'veh_engine', completed: true },
            { id: '2', type: 'weekly', title: 'Big Heist', description: 'Complete 2 robberies', progress: 1, goal: 2, xp: 1000, icon: 'cash_stack', completed: false },
        ],
    },
};

pWin.postMessage({ action: 'passShow', data: mockPassData });

const bpTiers = bpTrack.querySelectorAll('.bp-tier');
assert(!bpWrapper.classList.contains('hidden'), 'Pass #bp-wrapper is visible');
assert(bpTiers.length === 3, `Pass rendered 3 battlepass tiers (got ${bpTiers.length})`);
assert(dailyList.children.length === 1, `Pass rendered 1 daily mission (got ${dailyList.children.length})`);
assert(weeklyList.children.length === 1, `Pass rendered 1 weekly mission (got ${weeklyList.children.length})`);
assert(uiLvl.innerText === '3', `Pass level set to 3 (got '${uiLvl.innerText}')`);

// ─────────────────────────────────────────────────────────────
// 3. RACING COUNTDOWN OBJECT BUG REGRESSION TEST
// ─────────────────────────────────────────────────────────────
console.log('\n[Test 3] Racing Countdown Object Bug Regression Test');

const racingJsPath = path.join(repoRoot, 'resources', '[sunset]', 'sunset_ui', 'web', 'js', 'racing.js');
const rcWin = createMockWindow();
rcWin.$ = (sel) => rcWin.document.querySelector(sel);

const contextRC = vm.createContext(rcWin);
vm.runInContext(fs.readFileSync(racingJsPath, 'utf8'), contextRC);

// Test calling showCountdown with object payload { n: 3 }
rcWin.Racing.showCountdown({ n: 3 });
const racingHud = rcWin.document.getElementById('racing-hud');
assert(racingHud && !racingHud.innerHTML.includes('[object Object]'), `Racing countdown does not contain '[object Object]'`);
assert(racingHud && racingHud.innerHTML.includes('3'), `Racing countdown contains '3'`);

console.log('\n═══════════════════════════════════════════════════════');
if (failedTests > 0) {
    console.error(`FAILED: ${failedTests} test(s) failed, ${passedTests} passed.`);
    process.exit(1);
} else {
    console.log(`ALL TESTS PASSED: ${passedTests}/${passedTests} checks succeeded.`);
    process.exit(0);
}
