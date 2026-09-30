#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scanRoot = path.join(root, 'resources/[sunset]');
const extensions = new Set(['.lua', '.js', '.html', '.json', '.css']);
const findings = [];
let filesScanned = 0;

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (extensions.has(path.extname(entry.name))) scan(full);
    }
}

function intentional(line) {
    return /i18n-ignore|console\.(?:log|warn|error)|\bprint\s*\(|Sunset\.(?:Debug|Warn)|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE FROM\b|RegisterNetEvent|TriggerEvent\s*\(\s*['"]sunset:|TriggerServerEvent\s*\(\s*['"]sunset:|https?:\/\/|^\s*<(?:svg|path|circle|line|polyline|polygon)\b/.test(line);
}

function scan(file) {
    filesScanned++;
    const rel = path.relative(root, file);
    const ext = path.extname(file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
        if (intentional(line) || /^\s*(?:--|\/\/|\/\*|\*)/.test(line)) return;
        let reason = null;
        if (ext === '.lua' && /(?:Notify|notify|uiNotify|CommandReply|chat:addMessage|AddTextComponent|BeginTextCommand|return\s+(?:nil|false)\s*,)\s*\(?\s*['"][A-Za-z]/.test(line)) reason = 'Lua player-facing literal';
        if (ext === '.lua' && /TriggerClientEvent\s*\([^\n]*(?:notify|chat:addMessage)[^\n]*['"][A-Za-z]/i.test(line)) reason = 'Lua outbound player-facing literal';
        if (ext === '.js' && /(?:textContent|innerText|innerHTML|insertAdjacentHTML|showToast|setStatus|showError)\s*(?:=|\()\s*[`'"][A-Za-z]/.test(line)) reason = 'JS visible literal';
        if (ext === '.html' && /(?:placeholder|title|aria-label)="[A-Za-z]/.test(line) && !/data-i18n-(?:placeholder|title|aria)=/.test(line)) reason = 'HTML attribute literal';
        if (ext === '.html' && />\s*[A-Za-z][^<{]{2,}\s*</.test(line) && !/data-i18n=/.test(line)) reason = 'HTML text literal';
        if (ext === '.css' && /content\s*:\s*['"][A-Za-z]/.test(line)) reason = 'CSS generated literal';
        if (reason) findings.push({ rel, line: index + 1, reason, text: line.trim().slice(0, 180) });
    });
}

walk(scanRoot);
for (const item of findings) console.log(`${item.rel}:${item.line}: ${item.reason}: ${item.text}`);
console.log(`Scanned ${filesScanned} files; ${findings.length} likely player-facing hardcoded string(s).`);
process.exit(findings.length ? 1 : 0);
