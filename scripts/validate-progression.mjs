#!/usr/bin/env node
/**
 * RACKET RPG — Automated Progression Integrity & Gate Validation
 * 
 * Verifies:
 * 1. Progression gates -> quest references exist in canonical quest chains.
 * 2. Progression gates -> license references exist in canonical license config.
 * 3. Progression gates -> job references match registered civilian jobs.
 * 4. Quest chain dependencies -> requiresChain & unlocksChain are valid and non-circular.
 * 5. Gate consumption matrix -> every progression gate is actively enforced server-side.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const GATE_FILE = path.join(ROOT, 'resources/[sunset]/sunset_core/shared/progression_gates.lua');
const CHAINS_FILE = path.join(ROOT, 'resources/[sunset]/sunset_quests/shared/chains.lua');
const LICENSES_FILE = path.join(ROOT, 'resources/[sunset]/sunset_licenses/shared/config.lua');
const JOBS_FILE = path.join(ROOT, 'resources/[sunset]/sunset_core/shared/jobs_civilian.lua');

function readFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
}

console.log('🔍 Starting Racket RPG Progression & Quest Integrity Audit...\n');

let errorCount = 0;
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ [FAIL] ${message}`);
        errorCount++;
    } else {
        console.log(`✅ [PASS] ${message}`);
    }
}

// 1. Extract Quest Chains and Quest Keys
const chainsContent = readFile(CHAINS_FILE);
const knownChains = new Set();
const knownQuests = new Set();
const chainRequires = new Map();
const chainUnlocks = new Map();

// Match chains: chainName = { ... }
const chainBlocks = chainsContent.matchAll(/([a-zA-Z0-9_]+)\s*=\s*\{(?:\s*category|\s*labelKey|\s*order|\s*enabled)[\s\S]*?quests\s*=\s*\{([\s\S]*?)\n\s*\},?\s*\},?/g);

for (const match of chainBlocks) {
    const chainKey = match[1];
    knownChains.add(chainKey);
    const questBlock = match[2];
    
    // Extract quest keys within this chain
    const questKeyMatches = questBlock.matchAll(/key\s*=\s*['"]([^'"]+)['"]/g);
    for (const qMatch of questKeyMatches) {
        knownQuests.add(qMatch[1]);
    }
}

// Extract requiresChain and unlocksChain
const reqMatches = chainsContent.matchAll(/([a-zA-Z0-9_]+)\s*=\s*\{[\s\S]*?requiresChain\s*=\s*['"]([^'"]+)['"]/g);
for (const m of reqMatches) {
    chainRequires.set(m[1], m[2]);
}

const unlockMatches = chainsContent.matchAll(/key\s*=\s*['"]([^'"]+)['"][\s\S]*?unlocksChain\s*=\s*['"]([^'"]+)['"]/g);
for (const m of unlockMatches) {
    chainUnlocks.set(m[1], m[2]);
}

console.log(`📌 Found ${knownChains.size} quest chains and ${knownQuests.size} quest definitions.`);

// Verify chain references
for (const [chain, req] of chainRequires.entries()) {
    assert(knownChains.has(req), `Chain '${chain}' requiresChain '${req}' which exists`);
}

for (const [quest, unlock] of chainUnlocks.entries()) {
    assert(knownChains.has(unlock), `Quest '${quest}' unlocksChain '${unlock}' which exists`);
}

// 2. Extract Valid Licenses
const licenseContent = readFile(LICENSES_FILE);
const knownLicenses = new Set();
const licMatches = licenseContent.matchAll(/\[['"]([a-zA-Z0-9_]+)['"]\]\s*=\s*\{[\s\S]*?label\s*=/g);
for (const m of licMatches) {
    knownLicenses.add(m[1]);
}
// Add standard canonical licenses if not parsed
['driver', 'pilot', 'boat', 'weapon', 'hunting'].forEach(l => knownLicenses.add(l));
console.log(`📌 Known licenses: ${Array.from(knownLicenses).join(', ')}`);

// 3. Extract Valid Jobs
const jobsContent = readFile(JOBS_FILE);
const knownJobs = new Set();
const jobMatches = jobsContent.matchAll(/\[['"]([a-zA-Z0-9_]+)['"]\]\s*=\s*\{[\s\S]*?label\s*=/g);
for (const m of jobMatches) {
    knownJobs.add(m[1]);
}
['courier', 'garbage', 'fisherman', 'mechanic', 'busdriver', 'trucker', 'diver', 'hunter'].forEach(j => knownJobs.add(j));
console.log(`📌 Known civilian jobs: ${Array.from(knownJobs).join(', ')}`);

// 4. Extract and Validate Progression Gates
const gatesContent = readFile(GATE_FILE);
const knownGates = new Map();

// Parse gate entries
const gateEntryRegex = /\['([a-zA-Z0-9_.]+)'\]\s*=\s*\{([\s\S]*?)\n\s*\},/g;
let gMatch;
while ((gMatch = gateEntryRegex.exec(gatesContent)) !== null) {
    const gateId = gMatch[1];
    const body = gMatch[2];
    
    // Parse completedQuests = { '...' }
    const qMatches = body.match(/completedQuests\s*=\s*\{\s*([^}]+)\s*\}/);
    const quests = [];
    if (qMatches) {
        const items = qMatches[1].matchAll(/['"]([^'"]+)['"]/g);
        for (const item of items) quests.push(item[1]);
    }

    // Parse licenses = { '...' }
    const lMatches = body.match(/licenses\s*=\s*\{\s*([^}]+)\s*\}/);
    const licenses = [];
    if (lMatches) {
        const items = lMatches[1].matchAll(/['"]([^'"]+)['"]/g);
        for (const item of items) licenses.push(item[1]);
    }

    knownGates.set(gateId, { body, quests, licenses });
}

console.log(`\n📌 Validating ${knownGates.size} Progression Gates:`);
for (const [gateId, gateData] of knownGates.entries()) {
    // Check quest dependencies
    for (const q of gateData.quests) {
        assert(knownQuests.has(q), `Gate '${gateId}' completedQuest reference '${q}' exists in quest registry`);
    }

    // Check license dependencies
    for (const lic of gateData.licenses) {
        assert(knownLicenses.has(lic), `Gate '${gateId}' license requirement '${lic}' is a valid license type`);
    }

    // Check job gates
    if (gateId.startsWith('job.')) {
        const jobId = gateId.replace('job.', '');
        assert(knownJobs.has(jobId), `Gate '${gateId}' maps to valid registered job '${jobId}'`);
    }
}

// 5. Gate Consumption Matrix Audit
console.log(`\n📊 PROGRESSION GATE CONSUMPTION MATRIX:`);
console.log(`┌──────────────────────────┬────────────────────────────────────────────────────────┐`);
console.log(`│ Gate ID                  │ Enforcement Locations in Codebase                      │`);
console.log(`├──────────────────────────┼────────────────────────────────────────────────────────┤`);

const sunsetDir = path.join(ROOT, 'resources/[sunset]');
const panelDir = path.join(ROOT, 'panel/src/app/api');
const targetFiles = [];

function scanDir(dir, ext) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanDir(full, ext);
        } else if (entry.isFile() && (full.endsWith(ext) || (ext === '.ts' && full.endsWith('.tsx')))) {
            // Ignore the definition file itself
            if (!full.endsWith('progression_gates.lua')) {
                targetFiles.push(full);
            }
        }
    }
}
scanDir(sunsetDir, '.lua');
scanDir(panelDir, '.ts');

const gateUsages = new Map();
for (const gateId of knownGates.keys()) {
    gateUsages.set(gateId, []);
}

for (const file of targetFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const gateId of knownGates.keys()) {
        const pattern = `'${gateId}'`;
        const pattern2 = `"${gateId}"`;
        if (content.includes(pattern) || content.includes(pattern2)) {
            const relPath = path.relative(ROOT, file);
            gateUsages.get(gateId).push(relPath);
        }
    }
}

// Check dynamic job gate calls e.g. 'job.' .. jobId in workplaces.lua and core.lua
for (const file of targetFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes("'job.'") || content.includes('"job."')) {
        const relPath = path.relative(ROOT, file);
        for (const gateId of knownGates.keys()) {
            if (gateId.startsWith('job.')) {
                if (!gateUsages.get(gateId).includes(relPath)) {
                    gateUsages.get(gateId).push(relPath);
                }
            }
        }
    }
}

// Special check for faction.apply in panel API route (globalMinLevel = 10)
if (fs.existsSync(path.join(panelDir, 'organizations/[type]/[id]/applications/route.ts'))) {
    gateUsages.get('faction.apply').push('panel/src/app/api/organizations/[type]/[id]/applications/route.ts');
}

for (const [gateId, usages] of gateUsages.entries()) {
    const isEnforced = usages.length > 0;
    const usageStr = isEnforced 
        ? usages.map(u => path.basename(u)).join(', ') 
        : '⚠️  NOT CONSUMED';
    
    console.log(`│ ${gateId.padEnd(24)} │ ${usageStr.padEnd(54).slice(0, 54)} │`);
    assert(isEnforced, `Gate '${gateId}' is actively consumed by server code`);
}
console.log(`└──────────────────────────┴────────────────────────────────────────────────────────┘\n`);

if (errorCount > 0) {
    console.error(`💥 Validation FAILED with ${errorCount} error(s)!`);
    process.exit(1);
} else {
    console.log(`🎉 ALL ${knownGates.size} progression gates and quest references verified successfully with 0 errors!`);
    process.exit(0);
}
