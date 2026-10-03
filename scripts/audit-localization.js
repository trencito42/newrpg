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

function hasLiteralArgument(line, callPattern) {
    return new RegExp('(?:' + callPattern + ')\\s*\\([^\\n]*?[`\'\"](?:[A-Za-z]|[ĂÂÎȘȚăâîșț])').test(line);
}

function scan(file) {
    filesScanned++;
    const rel = path.relative(root, file);
    const ext = path.extname(file);
    const source = fs.readFileSync(file, 'utf8');
    if (/i18n-ignore-file:\s*\S.+/.test(source)) return;
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
        if (intentional(line) || intentional(lines[index - 1] || '') || /^\s*(?:--|\/\/|\/\*|\*)/.test(line)) return;
        let reason = null;
        // Already-localized calls (Translate('key'), TFor(src, 'key'), Sunset.T('key'), tr('key')) are not literals.
        const luaLine = ext === '.lua'
            ? line.replace(/(?:exports\.sunset_core:)?(?:Translate|TFor|Sunset\.TFor|Sunset\.T|tr|T)\s*\(\s*(?:[A-Za-z_][\w.]*\s*,\s*)?['"][a-z][\w.]*['"]/g, 'L10N(')
            : line;
        if (ext === '.lua' && /(?:Notify|notify|uiNotify|CommandReply|chat:addMessage|AddTextComponent|BeginTextCommand)\s*\(?\s*['"][A-Za-z]/.test(luaLine)) reason = 'Lua player-facing literal';
        // `return nil, 'text'` error returns: protocol codes (snake_case / UPPER_CODE, no spaces) are not player text.
        if (ext === '.lua' && /return\s+(?:nil|false)\s*,\s*['"][A-Za-z][^'"]*\s[^'"]*['"]/.test(luaLine)) reason = 'Lua player-facing literal';
        if (ext === '.lua' && hasLiteralArgument(luaLine,
            'showHint|ShowHelpNotification|DrawText|AddTextComponent(?:String|SubstringPlayerName)|chat:addSuggestion')) {
            reason = 'Lua visible call literal';
        }
        const configField = line.match(/^\s*(label|description|title|help|prompt)\s*=\s*['"][A-Za-zĂÂÎȘȚăâîșț]/)?.[1];
        const nearby = lines.slice(Math.max(0, index - 3), index + 4).join('\n');
        if (ext === '.lua' && configField && !new RegExp(configField + 'Key\\s*=').test(nearby)) {
            reason = 'Lua visible configuration literal';
        }
        if (ext === '.lua' && !/(?:TFor|NotifyFor)\s*\(/.test(line)
            && /TriggerClientEvent\s*\(\s*['"][^'"]*(?:notify|chat:addMessage)[^'"]*['"]\s*,\s*[^,]+,\s*(?:\(?\s*['"][A-Za-z]|\(\s*['"][^'"]+['"]\s*\):format)/i.test(line)) {
            reason = 'Lua outbound player-facing literal';
        }
        if (ext === '.js' && /(?:textContent|innerText|innerHTML|showToast|showNotify|notify|setStatus|showError|setError)\s*(?:=|\()\s*[`'"][A-Za-zĂÂÎȘȚăâîșț]/.test(line)) reason = 'JS visible literal';
        if (ext === '.js' && /(?:label|description|title|placeholder|message|error)\s*:\s*[`'"][A-Za-zĂÂÎȘȚăâîșț]/.test(line)
            && !/I18n\.t\s*\(/.test(line)) reason = 'JS visible object literal';
        if (ext === '.js' && /insertAdjacentHTML\s*\(\s*['"][^'"]+['"]\s*,\s*[`'"][A-Za-z]/.test(line)) reason = 'JS visible literal';
        if (ext === '.html' && /(?:placeholder|title|aria-label)="[A-Za-z]/.test(line) && !/data-(?:ls-)?i18n-(?:placeholder|title|aria)=/.test(line)) reason = 'HTML attribute literal';
        if (ext === '.html' && />\s*[A-Za-z][^<{]{2,}\s*</.test(line) && !/data-(?:ls-)?i18n=/.test(line)) reason = 'HTML text literal';
        if (ext === '.css' && /content\s*:\s*['"][A-Za-z]/.test(line)) reason = 'CSS generated literal';
        if (reason) findings.push({ rel, line: index + 1, reason, text: line.trim().slice(0, 180) });
    });
}

walk(scanRoot);
for (const item of findings) console.log(`${item.rel}:${item.line}: ${item.reason}: ${item.text}`);
console.log(`Scanned ${filesScanned} files; ${findings.length} likely player-facing hardcoded string(s).`);
process.exit(findings.length ? 1 : 0);
