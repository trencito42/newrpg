const fs = require('fs');
const path = require('path');

const resourcesDir = path.resolve(__dirname, '../resources');

// 1. Audit Jobs
console.log('--- AUDITING JOBS ---');
const jobsPath = path.join(resourcesDir, '[sunset]/sunset_jobs');
const jobFiles = fs.readdirSync(path.join(jobsPath, 'client')).concat(fs.readdirSync(path.join(jobsPath, 'server')));
console.log('Job files found:', jobFiles);

// 2. Audit Factions
console.log('--- AUDITING FACTIONS ---');
const factionsPath = path.join(resourcesDir, '[sunset]/sunset_factions');
const factionFiles = fs.readdirSync(path.join(factionsPath, 'server'));
console.log('Faction server files:', factionFiles);

// 3. Audit Money Sources & Sinks
console.log('--- AUDITING ECONOMY ---');
const moneySources = [];
const moneySinks = [];

function scanDirForPatterns(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== '.git') {
                scanDirForPatterns(full);
            }
        } else if (ent.name.endsWith('.lua') || ent.name.endsWith('.js')) {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('AddMoney') || line.includes('addMoney') || line.includes('giveMoney') || line.includes('AddAccountMoney') || line.includes('GiveMoney') || line.includes('money = money +') || line.includes('bank = bank +')) {
                    moneySources.push({ file: path.relative(resourcesDir, full), line: idx + 1, code: line.trim() });
                }
                if (line.includes('RemoveMoney') || line.includes('removeMoney') || line.includes('deductMoney') || line.includes('RemoveAccountMoney') || line.includes('DeductMoney') || line.includes('money = money -') || line.includes('bank = bank -')) {
                    moneySinks.push({ file: path.relative(resourcesDir, full), line: idx + 1, code: line.trim() });
                }
            });
        }
    }
}
scanDirForPatterns(resourcesDir);

console.log(`Discovered ${moneySources.length} money source callsites and ${moneySinks.length} money sink callsites.`);

// 4. Audit Admin Commands & Permissions
const adminCommands = [];
function scanAdminCmds(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== '.git') {
                scanAdminCmds(full);
            }
        } else if (ent.name.endsWith('.lua')) {
            const content = fs.readFileSync(full, 'utf8');
            const cmdMatches = content.matchAll(/RegisterCommand\s*\(\s*['"]([^'"]+)['"]\s*,\s*function\s*\(([^)]*)\)/g);
            for (const m of cmdMatches) {
                const cmdName = m[1];
                const params = m[2];
                // Check if admin gated
                const isGated = content.includes(`IsPlayerAdmin`) || content.includes(`GetPlayerAdminLevel`) || content.includes(`HasPermission`) || content.includes(`adminOnly`) || content.includes(`checkAdmin`);
                adminCommands.push({
                    file: path.relative(resourcesDir, full),
                    command: cmdName,
                    params: params,
                    hasAdminCheckInFile: isGated
                });
            }
        }
    }
}
scanAdminCmds(resourcesDir);
console.log(`Discovered ${adminCommands.length} total commands registered.`);

fs.writeFileSync(path.resolve(__dirname, '../docs/audit/deep_audit_raw.json'), JSON.stringify({
    moneySourcesCount: moneySources.length,
    moneySinksCount: moneySinks.length,
    moneySources: moneySources.slice(0, 100),
    moneySinks: moneySinks.slice(0, 100),
    commands: adminCommands
}, null, 2));

console.log('Deep audit raw data generated.');
