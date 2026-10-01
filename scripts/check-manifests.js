#!/usr/bin/env node
// Manifest reference check (Linux/CI replacement for the manifest part of audit-static.ps1).
// For every resources/**/fxmanifest.lua verifies that every referenced file exists:
//   ui_page, loadscreen, *_script(s) (incl. @resource/path imports), files{}, data_file paths.
// Glob patterns (*, **) must match at least one file. Also reports `ensure` lines in
// config/server.cfg.template that point at a missing resource.
//
// Usage: node scripts/check-manifests.js        (exit 1 on any missing reference)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const resRoot = path.join(root, 'resources');

function findManifests(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) findManifests(p, out);
        else if (ent.name === 'fxmanifest.lua' || ent.name === '__resource.lua') out.push(p);
    }
    return out;
}

// resource name -> directory
const resourceDirs = new Map();
const manifests = findManifests(resRoot);
for (const m of manifests) resourceDirs.set(path.basename(path.dirname(m)), path.dirname(m));

function stripComments(src) {
    return src.replace(/--\[\[[\s\S]*?\]\]/g, '').replace(/--[^\n]*/g, '');
}

function globToRegex(g) {
    let re = '';
    for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (c === '*') {
            if (g[i + 1] === '*') { re += '.*'; i++; if (g[i + 1] === '/') i++; } else re += '[^/]*';
        } else if ('.+?^${}()|[]\\'.includes(c)) re += '\\' + c;
        else re += c;
    }
    return new RegExp('^' + re + '$');
}

function listFiles(dir, out = [], base = dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) listFiles(p, out, base);
        else out.push(path.relative(base, p).split(path.sep).join('/'));
    }
    return out;
}

const fileCache = new Map();
function filesOf(dir) {
    if (!fileCache.has(dir)) fileCache.set(dir, listFiles(dir));
    return fileCache.get(dir);
}

function refExists(resDir, ref) {
    let dir = resDir;
    let rel = ref;
    if (ref.startsWith('@')) {
        const m = ref.match(/^@([^/]+)\/(.+)$/);
        if (!m) return false;
        dir = resourceDirs.get(m[1]);
        if (!dir) return false;
        rel = m[2];
    }
    if (/[*]/.test(rel)) {
        const re = globToRegex(rel);
        return filesOf(dir).some((f) => re.test(f));
    }
    return fs.existsSync(path.join(dir, rel));
}

// Resources that are not ensured by the template (e.g. unbuilt optional third-party copies)
// only produce warnings; ensured resources (incl. #@dev ones) fail the check.
const tplPath = path.join(root, 'config', 'server.cfg.template');
const ensured = new Set();
if (fs.existsSync(tplPath)) {
    for (const line of fs.readFileSync(tplPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^(?:#@dev\s+)?(?:ensure|start)\s+(\S+)/);
        if (m) ensured.add(m[1]);
    }
}
let missing = 0;
let warned = 0;
let checkedRefs = 0;
for (const manifest of manifests) {
    const dir = path.dirname(manifest);
    const name = path.basename(dir);
    const src = stripComments(fs.readFileSync(manifest, 'utf8'));
    const refs = new Set();

    // single-string directives
    for (const m of src.matchAll(/\b(ui_page|loadscreen|this_is_a_map)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        if (m[1] !== 'this_is_a_map') refs.add(m[2]);
    }
    // data_file 'TYPE' 'path'
    for (const m of src.matchAll(/\bdata_file\s*\(?\s*['"][^'"]+['"]\s*,?\s*['"]([^'"]+)['"]/g)) {
        // directory-style wavepack entries (AUDIO_WAVEPACK) are folders: accept dir or file
        refs.add('?' + m[1]);
    }
    // list directives: files {...}, client_scripts {...}, etc. (also single-string forms)
    const listRe = /\b(files|file|client_scripts?|server_scripts?|shared_scripts?|client_script|server_script|shared_script)\s*(\{[\s\S]*?\}|\(?\s*['"][^'"]+['"]\s*\)?)/g;
    for (const m of src.matchAll(listRe)) {
        for (const s of m[2].matchAll(/['"]([^'"]+)['"]/g)) refs.add(s[1]);
    }

    for (let ref of refs) {
        const optional = ref.startsWith('?');
        if (optional) ref = ref.slice(1);
        // not a path (e.g. 'cerulean') or an exclusion
        if (ref.startsWith('!')) continue;
        checkedRefs++;
        if (!refExists(dir, ref)) {
            // data_file may legitimately name a directory
            if (optional && fs.existsSync(path.join(dir, ref))) continue;
            if (!ensured.has(name)) {
                console.log(`WARN (not ensured) ${path.relative(root, manifest)} -> ${ref}`);
                warned++;
                continue;
            }
            console.log(`MISSING ${path.relative(root, manifest)} -> ${ref}`);
            missing++;
        }
    }
}

// ensure lines in the config template
const tpl = path.join(root, 'config', 'server.cfg.template');
let ensureMissing = 0;
if (fs.existsSync(tpl)) {
    for (const line of fs.readFileSync(tpl, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^(?:#@dev\s+)?(?:ensure|start)\s+(\S+)/);
        if (!m) continue;
        const bundled = ['mapmanager', 'sessionmanager', 'hardcap', 'chat', 'spawnmanager', 'fivem', 'rconlog', 'scoreboard'];
        if (bundled.includes(m[1])) continue; // shipped with the FXServer image
        if (!resourceDirs.has(m[1])) {
            console.log(`MISSING ensure ${m[1]} (config/server.cfg.template) -> no such resource`);
            ensureMissing++;
        }
    }
}

console.log(`\nChecked ${manifests.length} manifests, ${checkedRefs} file references: ${missing} missing, ${warned} warnings (non-ensured resources), ${ensureMissing} bad ensure line(s).`);
process.exit(missing + ensureMissing > 0 ? 1 : 0);
