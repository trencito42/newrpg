#!/usr/bin/env node
// Static regression guard: casino resources must be server-authoritative.
//  (a) no client-reachable handler takes a payout/result/win/multiplier parameter
//  (b) chip credits only happen inside the single settle function of each resource
//  (c) no math.random in gameplay server files (CSPRNG helper only)
//  (d) slots paytable RTP computed from server_config.lua is sane (Monte Carlo)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'resources', '[sunset]');
let problems = 0;
const fail = (m) => { problems++; console.log('FAIL: ' + m); };

const FILES = [
  'sunset_slots/server.lua', 'sunset_blackjack/server.lua', 'sunset_roulette/server.lua',
  'sunset_luckywheel/server.lua', 'sunset_casino/server/main.lua',
  'sunset_economy/server/dice.lua', 'sunset_economy/server/lottery.lua',
];
const src = {};
for (const f of FILES) src[f] = fs.readFileSync(path.join(root, f), 'utf8');

// (a) handler signatures
const BAD = /(payout|payouts|won|win|wins|winnings|reward|rewards|result|prize|multiplier|jackpot|amountwon|grid|reels|outcome)/i;
for (const [f, text] of Object.entries(src)) {
  const fnParams = {};
  for (const m of text.matchAll(/function\s+([A-Za-z_][\w.]*)\s*\(([^)]*)\)/g)) fnParams[m[1]] = m[2];
  const check = (name, params) => {
    for (const p of params.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (p !== '...' && BAD.test(p)) fail(`${f}: handler ${name} accepts suspicious param '${p}'`);
    }
  };
  for (const m of text.matchAll(/(?:RegisterNetEvent|RegisterServerEvent|AddEventHandler|RegisterCallback)\(\s*'([^']+)'\s*,\s*function\s*\(([^)]*)\)/g)) {
    if (m[1] === 'playerDropped' || m[1] === 'onResourceStop') continue;
    check(m[1], m[2]);
  }
  for (const m of text.matchAll(/AddEventHandler\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z_]\w*)\s*\)/g)) {
    if (fnParams[m[2]] !== undefined) check(m[1], fnParams[m[2]]);
  }
}

// (b) single settle function per resource
const ALLOWED = {
  'sunset_slots/server.lua': { call: /giveChips\(/, fns: ['giveChips', 'creditChips', 'claimPending'] },
  'sunset_roulette/server.lua': { call: /giveChips\(/, fns: ['giveChips', 'settleCredit'] },
  'sunset_blackjack/server.lua': { call: /giveChipsCallback\(/, fns: ['GiveMoney', 'defaultGiveChips'] },
  'sunset_casino/server/main.lua': { call: /giveChips\(/, fns: ['giveChips', 'settleChips'] },
};
for (const [f, rule] of Object.entries(ALLOWED)) {
  const lines = src[f].split('\n');
  lines.forEach((line, i) => {
    if (!rule.call.test(line) || /^\s*--/.test(line)) return;
    if (/function\s+\w*[gG]ive/.test(line)) return;
    let fn = null;
    for (let j = i; j >= 0; j--) {
      const m = lines[j].match(/^\s*(?:local\s+)?function\s+([\w.]+)/);
      if (m) { fn = m[1]; break; }
      if (/RegisterCallback\(|AddEventHandler\(/.test(lines[j]) && /function\s*\(/.test(lines[j])) { fn = '<handler>'; break; }
    }
    // claim lambdas (`function(n) return giveChips(...)`) pay out only previously persisted chips
    if (/CasinoPending\.Claim|function\(n\)\s*return giveChips/.test(line)) return;
    // non-game credits in sunset_casino: wheel chip prize (server-picked), cashier buy/sell refunds
    if (f.startsWith('sunset_casino') && /giveChips\(source, (prize\.value|amount)\)/.test(line)) return;
    if (!rule.fns.includes(fn)) fail(`${f}:${i + 1} chip credit outside the settle function (in ${fn}): ${line.trim()}`);
  });
}
for (const f of ['sunset_slots/server.lua', 'sunset_roulette/server.lua', 'sunset_luckywheel/server.lua', 'sunset_casino/server/main.lua', 'sunset_blackjack/server.lua']) {
  if (!/CasinoRNG/.test(src[f])) fail(`${f}: does not use CasinoRNG`);
}
if (/RegisterNetEvent\('sunset_slots:PayOutRewards'|sunset_slots:BetsAndMoney/.test(src['sunset_slots/server.lua'])) fail('legacy slots PayOutRewards/BetsAndMoney events still registered');

// (c) no math.random in gameplay files
for (const [f, text] of Object.entries(src)) {
  text.split('\n').forEach((l, i) => {
    if (/math\.random\(/.test(l) && !/^\s*--/.test(l)) fail(`${f}:${i + 1} uses math.random (use CasinoRNG)`);
  });
}

// (d) RTP of slots paytable (server_config.lua is the single source of truth)
const cfg = fs.readFileSync(path.join(root, 'sunset_slots/server_config.lua'), 'utf8');
const arr = (name) => {
  const m = cfg.match(new RegExp(name + '\\s*=\\s*\\{([^}]*)\\}'));
  if (!m) { fail('server_config.lua missing ' + name); return []; }
  return m[1].split(',').map((x) => parseFloat(x)).filter((x) => !isNaN(x));
};
const num = (name) => parseFloat((cfg.match(new RegExp(name + '\\s*=\\s*([\\d.]+)')) || [])[1]);
const W = arr('SymbolWeights'), T3 = arr('TripleMult'), T4 = arr('QuadrupleMult'), T5 = arr('QuintupleMult');
const B2 = num('MultiLineBonus2'), B3 = num('MultiLineBonus3');
const bets = arr('Bets');
if (W.length !== 7 || T3.length !== 7 || T4.length !== 7 || T5.length !== 7) fail('paytable arrays must have 7 entries');
if (!bets.length || bets.some((b) => !Number.isInteger(b) || b <= 0)) fail('Bets must be positive integers');
const tot = W.reduce((a, b) => a + b, 0);
// deterministic xorshift so the test is reproducible
let st = 123456789;
const rnd = () => { st ^= st << 13; st ^= st >>> 17; st ^= st << 5; return (st >>> 0) / 4294967296; };
const pick = () => { let r = rnd() * tot, a = 0; for (let i = 0; i < 7; i++) { a += W[i]; if (r < a) return i + 1; } return 7; };
const DIAG = [[[0,2],[1,1],[2,0]],[[1,2],[2,1],[3,0]],[[2,2],[3,1],[4,0]],[[0,0],[1,1],[2,2]],[[1,0],[2,1],[3,2]],[[2,0],[3,1],[4,2]]];
function evalGrid(g) {
  const wins = [];
  for (let r = 0; r < 3; r++) { let i = 0; while (i < 5) { let j = i; while (j + 1 < 5 && g[j + 1][r] === g[i][r]) j++; if (j - i + 1 >= 3) wins.push([j - i + 1, g[i][r]]); i = j + 1; } }
  for (const l of DIAG) { const v = l.map(([a, b]) => g[a][b]); if (v[0] === v[1] && v[1] === v[2]) wins.push([3, v[0]]); }
  for (let i = 0; i < 5; i++) if (g[i][0] === g[i][1] && g[i][1] === g[i][2]) wins.push([3, g[i][0]]);
  let p = 0; for (const [len, s] of wins) p += (len === 3 ? T3 : len === 4 ? T4 : T5)[s - 1];
  if (wins.length > 2) p *= 1 + B3; else if (wins.length > 1) p *= 1 + B2;
  return p;
}
const N = 400000; let sum = 0;
for (let n = 0; n < N; n++) { const g = []; for (let a = 0; a < 5; a++) g.push([pick(), pick(), pick()]); sum += evalGrid(g); }
const rtp = sum / N;
console.log(`slots RTP (base game, excl. fair 50/50 gamble) = ${(rtp * 100).toFixed(1)}% over ${N} spins`);
if (!(rtp > 0.5 && rtp < 1.0)) fail(`slots RTP ${rtp.toFixed(3)} outside sane (0.5, 1.0) range`);

console.log(problems ? `${problems} problem(s)` : 'casino authority checks OK');
process.exit(problems ? 1 : 0);
