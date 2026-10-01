const fs = require('fs');
const path = require('path');

const enLuaPath = path.resolve(__dirname, '../resources/[sunset]/sunset_core/shared/locales/en.lua');
const roLuaPath = path.resolve(__dirname, '../resources/[sunset]/sunset_core/shared/locales/ro.lua');

function parseLuaTable(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const dict = {};
    for (const line of lines) {
        const m = line.match(/^\s*\[['"]([^'"]+)['"]\]\s*=\s*(['"].*['"]|\[\[.*\]\]),?/);
        if (m) {
            const key = m[1];
            let val = m[2];
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            dict[key] = val;
        }
    }
    return dict;
}

const enDict = parseLuaTable(enLuaPath);
const roDict = parseLuaTable(roLuaPath);

const enKeys = Object.keys(enDict);
const roKeys = Object.keys(roDict);

console.log(`EN Keys: ${enKeys.length}, RO Keys: ${roKeys.length}`);

// Compare placeholders
const placeholderMismatches = [];
enKeys.forEach(key => {
    if (roDict[key]) {
        const enPlaceholders = (enDict[key].match(/\{(\w+)\}/g) || []).sort();
        const roPlaceholders = (roDict[key].match(/\{(\w+)\}/g) || []).sort();
        if (enPlaceholders.join(',') !== roPlaceholders.join(',')) {
            placeholderMismatches.push({ key, en: enDict[key], ro: roDict[key], enP: enPlaceholders, roP: roPlaceholders });
        }
    }
});

console.log(`Placeholder Mismatches: ${placeholderMismatches.length}`);

fs.writeFileSync(path.resolve(__dirname, '../docs/audit/localization_audit_raw.json'), JSON.stringify({
    enTotal: enKeys.length,
    roTotal: roKeys.length,
    mismatches: placeholderMismatches,
    samples: enKeys.slice(0, 50).map(k => ({ key: k, en: enDict[k], ro: roDict[k] }))
}, null, 2));

console.log('Saved localization_audit_raw.json');
