const fs = require('fs');
const path = require('path');

const resourcesDir = path.resolve(__dirname, '../resources');
const sunsetDir = path.join(resourcesDir, '[sunset]');

function getDirectories(srcPath) {
    return fs.readdirSync(srcPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

const allResources = [];

// 1. External resources
getDirectories(resourcesDir).forEach(dir => {
    if (dir !== '[sunset]') {
        allResources.push({ name: dir, path: path.join(resourcesDir, dir), isSunset: false });
    }
});

// 2. Sunset resources
getDirectories(sunsetDir).forEach(dir => {
    allResources.push({ name: dir, path: path.join(sunsetDir, dir), isSunset: true });
});

console.log(`Discovered ${allResources.length} total resources.`);

const resourceMap = [];

allResources.forEach(res => {
    const fxPath = path.join(res.path, 'fxmanifest.lua');
    let manifest = '';
    if (fs.existsSync(fxPath)) {
        manifest = fs.readFileSync(fxPath, 'utf8');
    }

    const files = [];
    function scanFiles(p, rel = '') {
        if (!fs.existsSync(p)) return;
        const entries = fs.readdirSync(p, { withFileTypes: true });
        for (const entry of entries) {
            const curRel = path.join(rel, entry.name);
            const curFull = path.join(p, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    scanFiles(curFull, curRel);
                }
            } else {
                files.push({ rel: curRel, full: curFull, size: fs.statSync(curFull).size });
            }
        }
    }
    scanFiles(res.path);

    const clientScripts = files.filter(f => f.rel.startsWith('client') || f.rel.endsWith('_cl.lua') || f.rel === 'client.lua');
    const serverScripts = files.filter(f => f.rel.startsWith('server') || f.rel.endsWith('_sv.lua') || f.rel === 'server.lua');
    const sharedScripts = files.filter(f => f.rel.startsWith('shared') || f.rel.startsWith('config') || f.rel === 'config.lua' || f.rel === 'shared.lua');
    const nuiFiles = files.filter(f => f.rel.startsWith('html') || f.rel.startsWith('web') || f.rel.startsWith('ui') || f.rel.endsWith('.html'));

    // Scan for events, callbacks, commands, state bags, exports, DB queries
    const clientEvents = new Set();
    const serverEvents = new Set();
    const serverCallbacks = new Set();
    const commands = new Set();
    const stateBags = new Set();
    const exportsList = new Set();
    const dbTables = new Set();
    const loops = { wait0: 0, waitShort: 0, waitMedium: 0, waitLong: 0 };

    files.filter(f => f.rel.endsWith('.lua') || f.rel.endsWith('.js')).forEach(f => {
        const content = fs.readFileSync(f.full, 'utf8');

        // Net events
        const regNetMatches = content.matchAll(/RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]/g);
        for (const m of regNetMatches) {
            if (f.rel.startsWith('server') || f.rel.endsWith('_sv.lua') || f.rel === 'server.lua') {
                serverEvents.add(m[1]);
            } else {
                clientEvents.add(m[1]);
            }
        }

        // Callbacks
        const cbMatches = content.matchAll(/RegisterCallback\s*\(\s*['"]([^'"]+)['"]/g);
        for (const m of cbMatches) serverCallbacks.add(m[1]);

        // Commands
        const cmdMatches = content.matchAll(/RegisterCommand\s*\(\s*['"]([^'"]+)['"]/g);
        for (const m of cmdMatches) commands.add(m[1]);

        // State bags
        const sbMatches = content.matchAll(/state(?::set|\.)(\w+)/g);
        for (const m of sbMatches) stateBags.add(m[1]);

        // Exports
        const expMatches = content.matchAll(/exports\s*\(\s*['"]([^'"]+)['"]/g);
        for (const m of expMatches) exportsList.add(m[1]);

        // DB tables
        const dbMatches = content.matchAll(/(?:FROM|INTO|UPDATE|JOIN)\s+`?([a-zA-Z0-9_]+)`?/gi);
        for (const m of dbMatches) {
            const tbl = m[1].toLowerCase();
            const sqlKeywords = ['select', 'where', 'set', 'values', 'left', 'inner', 'outer', 'group', 'order', 'limit', 'on', 'duplicate', 'key', 'table', 'database', 'as', 'and', 'or', 'not', 'null', 'default', 'char', 'source'];
            if (!sqlKeywords.includes(tbl) && tbl.length > 2) {
                dbTables.add(tbl);
            }
        }

        // Wait loops
        const waitMatches = content.matchAll(/Wait\s*\(\s*(\d+)\s*\)/g);
        for (const m of waitMatches) {
            const ms = parseInt(m[1], 10);
            if (ms === 0) loops.wait0++;
            else if (ms <= 50) loops.waitShort++;
            else if (ms <= 500) loops.waitMedium++;
            else loops.waitLong++;
        }
    });

    resourceMap.push({
        name: res.name,
        isSunset: res.isSunset,
        fileCount: files.length,
        totalSizeKb: Math.round(files.reduce((a, b) => a + b.size, 0) / 1024),
        clientScripts: clientScripts.map(s => s.rel),
        serverScripts: serverScripts.map(s => s.rel),
        sharedScripts: sharedScripts.map(s => s.rel),
        hasNui: nuiFiles.length > 0,
        nuiFileCount: nuiFiles.length,
        clientEvents: Array.from(clientEvents),
        serverEvents: Array.from(serverEvents),
        serverCallbacks: Array.from(serverCallbacks),
        commands: Array.from(commands),
        stateBags: Array.from(stateBags),
        exports: Array.from(exportsList),
        dbTables: Array.from(dbTables),
        loops
    });
});

fs.writeFileSync(path.resolve(__dirname, '../docs/audit/resource_scan.json'), JSON.stringify(resourceMap, null, 2));
console.log('Saved resource_scan.json to docs/audit/');
