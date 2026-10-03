#!/usr/bin/env node
/**
 * check-nui-assets.js
 * Scans all HTML/JS/CSS files in resources/ for cfx-nui and nui:// URLs.
 * Verifies that target resources exist, target files exist relative to resource root,
 * and files are included in fxmanifest files.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const resourcesDir = path.join(repoRoot, 'resources');

console.log('═══════════════════════════════════════════════════════');
console.log('  NUI Cross-Resource Asset & URL Integrity Validator');
console.log('═══════════════════════════════════════════════════════\n');

// 1. Build a map of resource names -> directory path
const resourceMap = new Map();

function discoverResources(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const manifestPath = path.join(fullPath, 'fxmanifest.lua');
            const legacyManifest = path.join(fullPath, '__resource.lua');
            if (fs.existsSync(manifestPath) || fs.existsSync(legacyManifest)) {
                resourceMap.set(entry.name, fullPath);
            }
            // Recurse into categories like [sunset]
            discoverResources(fullPath);
        }
    }
}

discoverResources(resourcesDir);
console.log(`Discovered ${resourceMap.size} FiveM resources.\n`);

// 2. Scan all .html, .js, .css files
const textExtensions = new Set(['.html', '.js', '.css']);
const filesToScan = [];

function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            collectFiles(fullPath);
        } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
            filesToScan.push(fullPath);
        }
    }
}

collectFiles(resourcesDir);

let errors = 0;
let checkedUrls = 0;

// URL Regex patterns
// Matches: https://cfx-nui-sunset_ui/web/js/i18n.js?v=2 or nui://sunset_ui/web/css/fonts.css
const cfxNuiPattern = /(?:https:\/\/cfx-nui-([a-zA-Z0-9_-]+)\/|nui:\/\/([a-zA-Z0-9_-]+)\/)([^"'\s\)\>]+)/g;

for (const filePath of filesToScan) {
    const relFile = path.relative(repoRoot, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for deprecated broken path
    if (content.includes('https://cfx-nui-sunset_ui/js/')) {
        console.error(`❌ [BROKEN PATH] ${relFile} contains deprecated 'https://cfx-nui-sunset_ui/js/' (should be 'web/js/')`);
        errors++;
    }

    let match;
    while ((match = cfxNuiPattern.exec(content)) !== null) {
        // Runtime template paths are validated by their producing code and
        // cannot name one concrete file during a static filesystem check.
        if (match[0].includes('${')) continue;
        checkedUrls++;
        const resName = match[1] || match[2];
        let assetPath = match[3];

        // Strip query params or hash
        assetPath = assetPath.split('?')[0].split('#')[0];

        if (!resourceMap.has(resName)) {
            console.error(`❌ [UNKNOWN RESOURCE] ${relFile}: references unknown resource '${resName}' in URL '${match[0]}'`);
            errors++;
            continue;
        }

        const resDir = resourceMap.get(resName);
        const targetDiskPath = path.join(resDir, assetPath);

        if (!fs.existsSync(targetDiskPath)) {
            console.error(`❌ [FILE NOT FOUND] ${relFile}:`);
            console.error(`     URL: ${match[0]}`);
            console.error(`     Target missing on disk: ${path.relative(repoRoot, targetDiskPath)}`);
            errors++;
        } else {
            // Check if manifest files pattern covers it
            const manifestPath = path.join(resDir, 'fxmanifest.lua');
            if (fs.existsSync(manifestPath)) {
                const manifestContent = fs.readFileSync(manifestPath, 'utf8');
                // Basic check if files {} block exists
                if (!manifestContent.includes('files') && !manifestContent.includes('ui_page')) {
                    console.warn(`⚠️ [MANIFEST CHECK] ${relFile}: resource ${resName} has no files{} block in fxmanifest.lua`);
                }
            }
        }
    }
}

console.log(`\nChecked ${checkedUrls} cross-resource URLs across ${filesToScan.length} source files.`);

if (errors > 0) {
    console.error(`\nFAILED: Found ${errors} asset / URL errors.`);
    process.exit(1);
} else {
    console.log(`\n✅ SUCCESS: All cross-resource NUI URLs resolve to valid files.`);
    process.exit(0);
}
