const fs = require('fs');
const path = require('path');

function findFiles(dir, matchFileName, results = []) {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            findFiles(full, matchFileName, results);
        } else if (e.name.toLowerCase() === matchFileName.toLowerCase()) {
            results.push(full);
        }
    }
    return results;
}

const resourcesDir = path.join(__dirname, '../resources');
const vehicleMetaFiles = findFiles(resourcesDir, 'vehicles.meta');
const handlingMetaFiles = findFiles(resourcesDir, 'handling.meta');

console.log(`Found ${vehicleMetaFiles.length} vehicles.meta files, ${handlingMetaFiles.length} handling.meta files.`);

const vehicleInventory = new Map();

for (const vFile of vehicleMetaFiles) {
    const content = fs.readFileSync(vFile, 'utf8');
    const modelMatches = content.matchAll(/<modelName>([^<]+)<\/modelName>[\s\S]*?<handlingId>([^<]+)<\/handlingId>[\s\S]*?<vehicleClass>([^<]+)<\/vehicleClass>/g);
    for (const match of modelMatches) {
        const model = match[1].trim().toLowerCase();
        const handling = match[2].trim().toLowerCase();
        const vClass = match[3].trim();
        vehicleInventory.set(model, {
            model,
            handling,
            vClass,
            source: path.relative(resourcesDir, vFile)
        });
    }
}

console.log(`\nTotal unique addon models found in vehicles.meta: ${vehicleInventory.size}`);
const sorted = Array.from(vehicleInventory.values()).sort((a, b) => a.model.localeCompare(b.model));
console.log(JSON.stringify(sorted, null, 2));
