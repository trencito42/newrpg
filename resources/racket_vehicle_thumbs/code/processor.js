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

function buildConvertArgs(rawPath, temporaryPath, chroma, fuzz, padding) {
  return [
    rawPath,
    '-alpha', 'on',
    '-bordercolor', chroma, '-border', '1',
    '-fuzz', `${fuzz}%`, '-fill', 'none', '-draw', 'color 0,0 floodfill',
    '-shave', '1x1',
    '-trim', '+repage',
    '-bordercolor', 'none', '-border', `${padding}x${padding}`,
    '-define', 'png:color-type=6', temporaryPath,
  ];
}

function isChromaPixel(pixel, mode) {
  if (pixel.length !== 3) return false;
  const [red, green, blue] = pixel;
  if (mode === 'magenta') return red > 95 && blue > 95 && red > green * 1.45 && blue > green * 1.45;
  return green > 95 && green > red * 1.45 && green > blue * 1.45;
}

async function processImage(token, model, options) {
  if (!validToken(token) || !validName(model)) throw new Error('Invalid capture identifier');
  if (!options || !validDirectory(options.rawDir) || !validDirectory(options.outputDir)) {
    throw new Error('Invalid thumbnail directories');
  }
  const mode = options.chromaMode === 'magenta' ? 'magenta' : 'green';
  const chroma = mode === 'magenta' ? '#ff00ff' : '#00ff00';
  const fuzz = Math.max(0, Math.min(25, Math.round(Number(options.fuzz) || 0)));
  const padding = Math.max(0, Math.min(128, Math.round(Number(options.padding) || 0)));
  const rawPath = path.join(resourcePath, options.rawDir, `${token}.png`);
  const outputPath = path.join(resourcePath, options.outputDir, `${model}.png`);
  const temporaryPath = path.join(resourcePath, options.outputDir, `${model}.${token}.tmp.png`);
  if (!fs.existsSync(rawPath)) throw new Error('Screenshot was not saved');
  if (!fs.existsSync(path.dirname(outputPath))) throw new Error('Output directory is not mounted');

  try {
    // Fail closed if the studio backdrop did not render: never publish a PNG
    // whose sky/world was accidentally flood-filled as the background.
    const corner = await runImageMagick([rawPath, '-crop', '1x1+0+0', '-depth', '8', 'rgb:-']);
    if (!isChromaPixel(corner, mode)) {
      throw new Error(`Chroma backdrop missing at screenshot corner (${[...corner].join(',')})`);
    }
    const args = buildConvertArgs(rawPath, temporaryPath, chroma, fuzz, padding);
    if (options.debug) console.log(`[racket_vehicle_thumbs] ${binary} ${args.join(' ')}`);
    await runImageMagick(args);
    const size = (await runImageMagick([temporaryPath, '-format', '%w,%h', 'info:'])).toString().trim();
    const [width, height] = size.split(',').map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 80) {
      throw new Error(`Transparent crop looks empty or incomplete (${size})`);
    }
    fs.renameSync(temporaryPath, outputPath);
    if (!options.debug) fs.unlinkSync(rawPath);
    return `${model}.png`;
  } finally {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (_) {}
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

module.exports = { validName, validToken, validDirectory, buildConvertArgs, isChromaPixel, processImage };
