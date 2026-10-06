#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { processImage, isStudioWallCapture } = require('../resources/racket_vehicle_thumbs/code/processor');

const root = path.resolve(__dirname, '..');
const sampleBlack = path.join(root, 'vehicle_thumbs_raw/6ac50fce-f5570-1c_b.png');
if (!fs.existsSync(sampleBlack)) {
  console.log('Vehicle thumb process check skipped: no sample raw capture on disk.');
  process.exit(0);
}
if (!fs.existsSync('/usr/bin/magick')) {
  console.log('Vehicle thumb process check skipped: ImageMagick not installed on this host.');
  process.exit(0);
}

const resourceRoot = path.join(root, 'resources/racket_vehicle_thumbs');
const rawDir = 'raw';
const outDir = '_test_process_out';
const token = 'fixture-void-black';
const blackPath = path.join(resourceRoot, rawDir, `${token}_b.png`);
const whitePath = path.join(resourceRoot, rawDir, `${token}_w.png`);
const outPath = path.join(resourceRoot, outDir);

fs.mkdirSync(path.join(resourceRoot, rawDir), { recursive: true });
fs.mkdirSync(outPath, { recursive: true });
fs.copyFileSync(sampleBlack, blackPath);
if (!fs.existsSync(whitePath)) fs.copyFileSync(sampleBlack, whitePath);

(async () => {
  assert.equal(await isStudioWallCapture(blackPath, whitePath), false);
  await processImage(token, 'fixture_car', { rawDir, outputDir: outDir, padding: 24, debug: false });
  const png = path.join(outPath, 'fixture_car.png');
  assert(fs.existsSync(png));
  assert(fs.statSync(png).size > 80_000, 'processed thumb should carry real paint bytes');
  fs.rmSync(outPath, { recursive: true, force: true });
  fs.unlinkSync(blackPath);
  if (fs.existsSync(whitePath)) fs.unlinkSync(whitePath);
  console.log('Vehicle thumb void-black process check passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
