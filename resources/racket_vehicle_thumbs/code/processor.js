'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RESOURCE = 'racket_vehicle_thumbs';
const resourcePath = typeof GetResourcePath === 'function' ? GetResourcePath(RESOURCE) : path.join(__dirname, '..');

// Hardcoded — FiveM's Node.js permission model blocks fs.existsSync on system paths
// even with add_filesystem_permission. Alpine imagemagick always installs to /usr/bin/magick.
const binary = '/usr/bin/magick';

function validName(value) {
  return typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value);
}

function validToken(value) {
  return typeof value === 'string' && /^[a-z0-9-]{8,80}$/.test(value);
}

function validDirectory(value) {
  return typeof value === 'string' && /^[a-z0-9_-]{1,32}$/.test(value);
}

function runImageMagick(args, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (part) => stdout.push(part));
    child.stderr.on('data', (part) => { stderr = (stderr + part.toString()).slice(-8192); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(stderr || `ImageMagick exited with code ${code}`));
      else resolve(Buffer.concat(stdout));
    });
  });
}

// Dual-pass alpha reconstruction from black and white background captures.
//
// Math:
//   B = fg * alpha          (black bg: only vehicle contributes)
//   W = fg * alpha + (1-alpha)   (white bg: vehicle + white bleeds through)
//   alpha = 1 - (W - B)    (difference reveals how much white bled through)
//   fg = B / alpha          (un-premultiply to recover true vehicle color)
//
// This handles semi-transparent glass correctly: no chroma contamination.
async function processImage(token, model, options) {
  if (!validToken(token) || !validName(model)) throw new Error('Invalid capture identifier');
  if (!options || !validDirectory(options.rawDir) || !validDirectory(options.outputDir)) {
    throw new Error('Invalid thumbnail directories');
  }
  const padding = Math.max(0, Math.min(128, Math.round(Number(options.padding) || 0)));
  const blackPath = path.join(resourcePath, options.rawDir, `${token}_b.png`);
  const whitePath = path.join(resourcePath, options.rawDir, `${token}_w.png`);
  const outputPath = path.join(resourcePath, options.outputDir, `${model}.png`);
  const tmpAlpha = path.join(resourcePath, options.outputDir, `${model}.${token}.alpha.png`);
  const tmpRgb   = path.join(resourcePath, options.outputDir, `${model}.${token}.rgb.png`);
  const tmpFinal = path.join(resourcePath, options.outputDir, `${model}.${token}.tmp.png`);

  if (!fs.existsSync(blackPath)) throw new Error('Black capture not found');
  if (!fs.existsSync(whitePath)) throw new Error('White capture not found');
  if (!fs.existsSync(path.dirname(outputPath))) throw new Error('Output directory is not mounted');

  try {
    // Step 1: alpha channel = 1 - (white - black), as grayscale
    if (options.debug) console.log(`[racket_vehicle_thumbs] ${model}: step 1 — reconstruct alpha`);
    await runImageMagick([
      whitePath, blackPath,
      '-compose', 'Difference', '-composite',
      '-colorspace', 'Gray', '-negate',
      tmpAlpha,
    ]);

    // Step 2: recover foreground RGB — un-premultiply: fg = black / alpha
    // DivideDst compose: dst / src = black / alpha
    if (options.debug) console.log(`[racket_vehicle_thumbs] ${model}: step 2 — un-premultiply RGB`);
    await runImageMagick([
      blackPath, tmpAlpha,
      '-alpha', 'Off',
      '-compose', 'DivideDst', '-composite',
      tmpRgb,
    ]);

    // Step 3: merge RGB + alpha, trim transparent edges, add padding, export RGBA PNG
    if (options.debug) console.log(`[racket_vehicle_thumbs] ${model}: step 3 — compose, trim, pad`);
    await runImageMagick([
      tmpRgb, tmpAlpha,
      '-compose', 'CopyOpacity', '-composite',
      '-trim', '+repage',
      '-bordercolor', 'none', '-border', `${padding}x${padding}`,
      '-define', 'png:color-type=6',
      tmpFinal,
    ]);

    const size = (await runImageMagick([tmpFinal, '-format', '%w,%h', 'info:'])).toString().trim();
    const [width, height] = size.split(',').map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 40 || height < 30) {
      throw new Error(`Reconstructed image looks empty (${size})`);
    }

    if (options.debug) console.log(`[racket_vehicle_thumbs] ${model}: output ${size} → ${model}.png`);
    fs.renameSync(tmpFinal, outputPath);
    return `${model}.png`;
  } finally {
    for (const tmp of [tmpAlpha, tmpRgb, tmpFinal]) {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    }
    if (!options.debug) {
      for (const raw of [blackPath, whitePath]) {
        try { if (fs.existsSync(raw)) fs.unlinkSync(raw); } catch (_) {}
      }
    }
  }
}

if (typeof on === 'function') {
  on('racket_thumbs:process', (token, model, options) => {
    processImage(token, model, options).then(
      (file) => emit('racket_thumbs:processed', token, true, file),
      (error) => {
        console.error(`[racket_vehicle_thumbs] ${model}: ${error.message}`);
        emit('racket_thumbs:processed', token, false, error.message);
      }
    );
  });
}

module.exports = { validName, validToken, validDirectory, processImage };
