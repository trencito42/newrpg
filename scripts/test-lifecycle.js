#!/usr/bin/env node
/*
 * Static lifecycle guard (no FiveM needed). Run: node scripts/test-lifecycle.js
 *
 *  A. STOP-CLEANUP: every sunset_* resource whose client code creates cameras,
 *     blips, entities (ped/vehicle/object), particle fx, or takes NUI focus must
 *     contain an `onResourceStop` handler that checks GetCurrentResourceName().
 *  B. NUI SPAM: a `while` loop that sleeps <= 50 ms (or Wait(0)) and calls
 *     Send( / SendNUIMessage( must show change detection in the same loop body
 *     (a `last*` / `prev*` variable compare, `~=`, a hash/changed token) .
 *  C. BLIND WAITS: a thread/handler whose FIRST statement is Wait(>=500) and that
 *     then calls exports.<other resource> without a readiness check
 *     (GetResourceState / IsPlayerReady / deadline loop) within the next lines.
 *
 * Allowlist: scripts/lifecycle-allowlist.json  { "A": {"resource": "reason"},
 *   "B": {"file:line-or-file": "reason"}, "C": {"file": "reason"} }.
 * Entries must carry a reason (owner / why safe). Stale entries are reported.
 * Exit code 1 on any non-allowlisted finding.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', '[sunset]');
const ALLOW_FILE = path.join(__dirname, 'lifecycle-allowlist.json');
const allow = fs.existsSync(ALLOW_FILE) ? JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8')) : { A: {}, B: {}, C: {} };
const used = { A: new Set(), B: new Set(), C: new Set() };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'web' && e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.lua')) out.push(p);
  }
  return out;
}
const isClient = (p) => /[\\/]client[\\/]|client\.lua$/.test(p);
const strip = (src) => src.replace(/--\[\[[\s\S]*?\]\]/g, '').split('\n').map((l) => l.replace(/--.*$/, ''));

const findings = { A: [], B: [], C: [] };
const resources = fs.readdirSync(ROOT).filter((d) => d.startsWith('sunset_'));

for (const res of resources) {
  const files = walk(path.join(ROOT, res)).filter(isClient);
  let creates = [], hasStop = false;
  for (const f of files) {
    const lines = strip(fs.readFileSync(f, 'utf8'));
    const txt = lines.join('\n');
    const m = txt.match(/\b(CreateCam|CreateCamWithParams|AddBlipForCoord|AddBlipForEntity|AddBlipForRadius|CreatePed|CreateVehicle|CreateObject(NoOffset)?|CreateScriptCamera|StartParticleFxLoopedAtCoord|StartNetworkedParticleFx\w*|SetNuiFocus|SetFocus\s*\(\s*true)/);
    if (m) creates.push(`${path.basename(f)}:${m[1]}`);
    if (/onResourceStop/.test(txt) && /GetCurrentResourceName\(\)/.test(txt)) {
      // handler must actually mention the stop event and the name check in the same file
      if (/AddEventHandler\(\s*['"]onResourceStop['"][\s\S]{0,200}GetCurrentResourceName\(\)/.test(txt) ||
          /AddEventHandler\(\s*['"]onClientResourceStop['"][\s\S]{0,200}GetCurrentResourceName\(\)/.test(txt)) hasStop = true;
    }

    // B: spam loops
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*while\b/.test(lines[i])) continue;
      const ind = lines[i].match(/^\s*/)[0].length;
      let k = i + 1; const body = [];
      while (k < lines.length && !(/^\s*end\b/.test(lines[k]) && lines[k].match(/^\s*/)[0].length <= ind)) { body.push(lines[k]); k++; }
      const b = body.join('\n');
      if (!/(exports\.sunset_ui:Send\(|SendNUIMessage\(|\bnui\()/.test(b)) continue;
      const waits = [...b.matchAll(/Wait\(\s*([^)]*)\)/g)].map((x) => x[1].trim());
      const fast = waits.length === 0 ? false : waits.some((w) => /^\d+$/.test(w) && Number(w) <= 50);
      if (!fast) continue;
      if (/(\blast\w*|\bprev\w*|Hash|hash|changed|dedupe)/.test(b) && /~=|>=|<=|math\.abs/.test(b)) continue;
      const key = `${res}/${path.relative(path.join(ROOT, res), f).replace(/\\/g, '/')}`;
      if (allow.B[key]) { used.B.add(key); continue; }
      findings.B.push(`${key}:${i + 1} fast loop (${waits.join(',')}) sends NUI without change detection`);
    }

    // C: blind waits
    for (let i = 1; i < lines.length; i++) {
      const m2 = lines[i].match(/^\s*Wait\(\s*(\d{3,5})\s*\)/);
      if (!m2 || Number(m2[1]) < 500) continue;
      if (!/(CreateThread\(function\(\)|AddEventHandler\(|SetTimeout)/.test(lines[i - 1])) continue;
      const next = lines.slice(i + 1, i + 7).join(' ');
      if (!/exports\.(sunset_\w+|ox_\w+)/.test(next) && !/exports\['sunset_/.test(next)) continue;
      const around = lines.slice(Math.max(0, i - 3), i + 10).join(' ');
      if (/GetResourceState|IsPlayerReady|deadline|waitFor|Await/.test(around)) continue;
      const key = `${res}/${path.relative(path.join(ROOT, res), f).replace(/\\/g, '/')}`;
      if (allow.C[key]) { used.C.add(key); continue; }
      findings.C.push(`${key}:${i + 1} blind Wait(${m2[1]}) then cross-resource export without readiness check`);
    }
  }
  if (creates.length && !hasStop) {
    if (allow.A[res]) used.A.add(res);
    else findings.A.push(`${res}: creates [${[...new Set(creates)].slice(0, 4).join(', ')}] but has no onResourceStop+GetCurrentResourceName() handler`);
  }
}

let stale = 0;
for (const k of ['A', 'B', 'C']) for (const e of Object.keys(allow[k] || {})) {
  if (!used[k].has(e)) { console.log(`[stale allowlist ${k}] ${e}`); stale++; }
  if (!allow[k][e] || String(allow[k][e]).length < 8) { console.log(`[allowlist ${k}] ${e} needs a reason`); findings[k].push(`allowlist ${e} lacks reason`); }
}
let total = 0;
for (const k of ['A', 'B', 'C']) {
  console.log(`\n== ${k} (${{ A: 'stop cleanup', B: 'NUI spam loops', C: 'blind waits' }[k]}) : ${findings[k].length} finding(s), ${used[k].size} allowlisted`);
  for (const f of findings[k]) console.log('  FAIL ' + f);
  total += findings[k].length;
}
console.log(total ? `\nlifecycle: ${total} problem(s)` : `\nlifecycle: OK (${stale} stale allowlist entries)`);
process.exit(total ? 1 : 0);
