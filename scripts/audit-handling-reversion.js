#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function fail(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const serverCfg = fs.readFileSync(path.join(root, 'config/server.cfg.template'), 'utf8');
fail(!/^\s*ensure\s+sunset_vehicle_dynamics\s*$/m.test(serverCfg), 'sunset_vehicle_dynamics must not be ensured');
fail(!/^\s*ensure\s+sunset_police_handling\s*$/m.test(serverCfg), 'sunset_police_handling must not be ensured');

const applyLua = fs.readFileSync(
  path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/client/apply.lua'),
  'utf8',
);
fail(!applyLua.includes('SetVehicleHandlingFloat'), 'apply.lua must not call SetVehicleHandlingFloat');
fail(!applyLua.includes('SetVehicleHandlingVector'), 'apply.lua must not call SetVehicleHandlingVector');
fail(applyLua.includes('return false'), 'apply.lua must no-op ApplyVehicleDynamics');

const lifecycleLua = fs.readFileSync(
  path.join(root, 'resources/[sunset]/sunset_vehicle_dynamics/client/lifecycle.lua'),
  'utf8',
);
fail(!lifecycleLua.includes('ApplyVehicleDynamics'), 'lifecycle.lua must not invoke ApplyVehicleDynamics');

const tuningApply = fs.readFileSync(path.join(root, 'resources/[sunset]/sunset_tuning/client/apply.lua'), 'utf8');
fail(
  tuningApply.includes('restoreHandling = hadTune') || tuningApply.includes('restoreHandling = true'),
  'tuning must gate handling float restore',
);
fail(tuningApply.includes('if not calculated.isStock'), 'tuning must skip applyCalculated for stock tunes');

const entrypoint = path.join(root, 'docker/fivem/entrypoint.sh');
if (fs.existsSync(entrypoint)) {
  const ep = fs.readFileSync(entrypoint, 'utf8');
  fail(!/ensure\s+sunset_vehicle_dynamics/.test(ep), 'entrypoint must not auto-ensure sunset_vehicle_dynamics');
}

execSync('node scripts/verify-pack-handling-refs.js', { cwd: root, stdio: 'inherit' });

console.log('Handling reversion audit passed.');
