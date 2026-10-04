const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const scale = require('../resources/[sunset]/sunset_ui/web/js/resolution-scale.js');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('canonical scale follows the limiting axis', () => {
    assert.equal(scale.resolutionScale(1920, 1080), 1);
    assert.ok(Math.abs(scale.resolutionScale(2560, 1440) - (1440 / 1080)) < 0.001);
    assert.ok(Math.abs(scale.resolutionScale(3440, 1440) - (1440 / 1080)) < 0.001);
    assert.equal(scale.resolutionScale(3840, 2160), 2);
    assert.ok(Math.abs(scale.resolutionScale(5120, 1440) - (1440 / 1080)) < 0.001);
    assert.equal(scale.resolutionScale(1280, 720), scale.MIN_SCALE);
    assert.ok(Math.abs(scale.resolutionScale(1600, 900) - (900 / 1080)) < 0.001);
});

test('user preference multiplies and stays inside 80 to 125 percent', () => {
    assert.equal(scale.finalScale(3840, 2160, 1), 2);
    assert.ok(Math.abs(scale.finalScale(3840, 2160, 0.9) - 1.8) < 0.001);
    assert.equal(scale.userScale(4), 1.25);
    assert.equal(scale.userScale(0.1), 0.8);
});

test('phone scale matches the reference and still fits the screen', () => {
    assert.equal(scale.phoneScale(1920, 1080, 1), 1);
    assert.ok(Math.abs(scale.phoneScale(2560, 1440, 1) - (1440 / 1080)) < 0.001);
    assert.equal(scale.phoneScale(3840, 2160, 1), 2);
    const phone = read('resources/[sunset]/sunset_ui/web/css/phone.css');
    assert.match(phone, /--phone-target-scale:\s*var\(--ui-scale, 1\)/);
    assert.match(phone, /--phone-fit-scale:\s*calc\(\(100vh - 36px\) \/ 720\)/);
    assert.doesNotMatch(phone, /--s:\s*min\(1,/);
});

test('world tooltips keep viewport coordinates and scale only the card', () => {
    const tip = read('resources/[sunset]/sunset_ui/web/js/world-tooltip.js');
    assert.match(tip, /window\.innerWidth/);
    assert.match(tip, /window\.innerHeight/);
    assert.match(tip, /class="wt-scale"/);
    assert.doesNotMatch(tip, /resolutionScale|ui-scale/);
});

test('mdc uses the canonical scale once and still fits the tablet', () => {
    const mdc = read('resources/[sunset]/sunset_ui/web/js/mdc_tablet.js');
    const css = read('resources/[sunset]/sunset_ui/web/css/mdc_tablet.css');
    assert.match(mdc, /ResolutionScale\.finalScale/);
    assert.match(mdc, /Math\.min\(ui, fitW, fitH\)/);
    assert.doesNotMatch(mdc, /Math\.min\(1\.15/);
    assert.match(css, /scale\(var\(--mdc-scale/);
    assert.doesNotMatch(css, /scale\(var\(--ui-scale\)\s*\*\s*var\(--mdc-scale/);
});

test('job hud tokens grow with the scale instead of a second transform', () => {
    const tokens = read('resources/[sunset]/sunset_ui/web/css/tokens.css');
    const job = read('resources/[sunset]/sunset_ui/web/css/job-hud.css');
    assert.match(tokens, /calc\(560px \* var\(--ui-scale, 1\)\)/);
    assert.doesNotMatch(job, /scale\(var\(--ui-scale/);
});
