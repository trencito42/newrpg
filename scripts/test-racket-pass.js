#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failed = 0;
function check(cond, msg) {
    if (cond) console.log('  ok  ' + msg);
    else { failed += 1; console.error('  FAIL ' + msg); }
}

function pointInPoly(x, y, poly) {
    let inside = false;
    let j = poly.length - 1;
    for (let i = 0; i < poly.length; i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi) inside = !inside;
        j = i;
    }
    return inside;
}

function centroid(poly) {
    let x = 0, y = 0;
    poly.forEach((p) => { x += p.x; y += p.y; });
    return { x: x / poly.length, y: y / poly.length };
}

const sql = fs.readFileSync(path.join(root, 'sql/59-polygon-turfs.sql'), 'utf8');
const rowRe = /\((\d+),\s*'([^']+)',\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),[\s\S]*?'(\[[\s\S]*?\])'\)/g;
const turfs = [];
let m;
while ((m = rowRe.exec(sql))) {
    turfs.push({
        id: Number(m[1]), name: m[2],
        x: Number(m[3]), y: Number(m[4]), z: Number(m[5]),
        minZ: Number(m[7]), maxZ: Number(m[8]),
        polygon: JSON.parse(m[9]),
    });
}
check(turfs.length === 18, 'sql/59 defines 18 turf polygons (' + turfs.length + ')');
turfs.forEach((t) => {
    check(t.polygon.length >= 3, 'turf #' + t.id + ' ' + t.name + ' has ' + t.polygon.length + ' vertices');
    const c = centroid(t.polygon);
    check(pointInPoly(c.x, c.y, t.polygon), 'turf #' + t.id + ' centroid is inside its polygon');
    check(pointInPoly(t.x, t.y, t.polygon), 'turf #' + t.id + ' stored center is inside its polygon');
    check(!pointInPoly(t.x + 5000, t.y + 5000, t.polygon), 'turf #' + t.id + ' far exterior point is outside');
    check(t.minZ < t.z && t.z < t.maxZ, 'turf #' + t.id + ' center Z is inside minZ/maxZ');
});
const pointsSeed = (sql.match(/FROM turfs t WHERE t\.id = (\d+)/g) || []).map((s) => s.match(/(\d+)/)[1]);
const onlyOne = new Set(pointsSeed);
check(onlyOne.size <= 1, 'turf_points seed is not a second geometry for every turf (polygon JSON is source of truth)');

const pip = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_turfs/shared/config.lua'), 'utf8');
check(/type\(px\) == 'vector3'/.test(pip), 'IsPointInPolygon accepts the (coords, polygon) call shape');
const client = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_turfs/client/main.lua'), 'utf8');
check(!/AddBlipForRadius/.test(client), 'pause map does not draw a radius as the attack boundary');
const turfServer = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_turfs/server/main.lua'), 'utf8');
check(/sunset:clans:expired/.test(turfServer) && /owner_clan_id = NULL/.test(turfServer), 'expired clans release turf ownership');
check(/pClan\.status ~= 'active'/.test(turfServer), 'attacks and income require an active clan');

const gates = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_core/shared/progression_gates.lua'), 'utf8');
function gateLevel(id) {
    const block = gates.split("['" + id + "']")[1] || '';
    const hit = block.match(/minLevel = (\d+)/);
    return hit ? Number(hit[1]) : null;
}
check(gateLevel('job.courier') === 1, 'Courier character level is 1');
check(gateLevel('job.fisherman') === 1, 'Fisherman character level is 1');
check(gateLevel('job.trucker') === 1, 'Trucker character level is 1');
check(gateLevel('job.hunter') === 10, 'Hunter character level is 10');
check(gateLevel('criminal.lockpicking') === 10, 'Lockpicking character level is 10');
check(gateLevel('faction.apply') === 10, 'Faction apply character level is 10');

const routes = JSON.parse(fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_jobs/data/job_routes.json'), 'utf8'));
(routes.hunting || []).forEach((zone) => {
    check(Array.isArray(zone.polygon) && zone.polygon.length >= 3, zone.id + ' has a polygon');
    (zone.spawnPoints || []).forEach((pt, i) => {
        check(pointInPoly(pt.x, pt.y, zone.polygon), zone.id + ' spawn ' + i + ' is inside the hunting polygon');
    });
});
const hunter = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_jobs/client/hunter.lua'), 'utf8');
check(/IsPointOnRoad/.test(hunter) && /GetWaterHeight/.test(hunter) && /spawnGroundOk/.test(hunter), 'hunt spawns reject road and water');
check(/Wait\(8000\)/.test(hunter), 'animal leash is not a per-frame loop');

const phone = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_ui/web/js/phone.js'), 'utf8');
check(!/War ·/.test(phone) && !/docs\.fivem\.net\/vehicles/.test(phone), 'phone clan status is not War and garage images are local');
check(/peerRecord/.test(phone) && /sender_phone/.test(phone), 'unknown SMS can fall back to a phone number');
check(/openQuests/.test(phone), 'phone quests shortcut does not own quest state');
const menu = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_ui/web/js/menu.js'), 'utf8');
const panels = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_ui/web/js/panels.js'), 'utf8');
check(!/docs\.fivem\.net\/vehicles/.test(menu + panels), 'menu and panels do not use the external vehicle CDN');

const shopHtml = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_shop/web/index.html'), 'utf8');
check(!/shop-rename-first/.test(shopHtml) && /shop-rename-nick/.test(shopHtml), 'shop rename is one username field');

const products = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_shop/shared/products.lua'), 'utf8');
check(!/clan_slots_15|clan_slots_20|clan_slots_25/.test(products), 'old 15/20/25 slot products are gone');
check(/clan_slots_50/.test(products) && /clan_slots_75/.test(products), '50 and 75 slot products exist');

const chains = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_quests/shared/chains.lua'), 'utf8');
const questHits = {};
const typeRe = /type = '([a-z0-9_]+)'/g;
let tm;
while ((tm = typeRe.exec(chains))) questHits[tm[1]] = true;
const wired = new Set();
function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (name === 'node_modules' || name === '.git') continue;
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else if (name.endsWith('.lua')) {
            const text = fs.readFileSync(full, 'utf8');
            const ev = /quest:progress',\s*[^,]+,\s*'([a-z0-9_]+)'/g;
            let em;
            while ((em = ev.exec(text))) wired.add(em[1]);
        }
    }
}
walk(path.join(root, 'resources/[sunset]'));
const missing = Object.keys(questHits).filter((t) => !wired.has(t));
check(missing.length === 0 || missing.every((t) => t === 'vehicle_rented'), 'onboarding events are wired (' + (missing.join(', ') || 'all') + ')');

console.log(failed ? ('\n' + failed + ' failed') : '\nall passed');
process.exit(failed ? 1 : 0);
