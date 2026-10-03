import fs from 'node:fs';
import ts from 'typescript';
import lua from 'luaparse';
import { parseFragment } from 'parse5';

const presentationFields = /^(?:label|description|title|help|prompt|message|placeholder|objective|hint|stationHint|lockedReason|subtitle)$/;
const keyFields = /^(?:localeKey|factionTypeKey|labelKey|descriptionKey|titleKey|helpKey|promptKey|messageKey|placeholderKey|objectiveKey|hintKey|stationHintKey|lockedReasonKey|subtitleKey)$/;
const literalTypes = new Set(['StringLiteral']);
function luaText(node) {
    if (!node || !literalTypes.has(node.type)) return null;
    const raw = node.raw;
    try {
        const parsed = lua.parse('return ' + Buffer.from(raw, 'utf8').toString('latin1'), { encodingMode: 'pseudo-latin1', luaVersion: '5.3' });
        return Buffer.from(parsed.body[0].arguments[0].value, 'latin1').toString('utf8');
    } catch { return null; }
}
const lineAt = (source, index) => source.slice(0, index).split('\n').length;
function ignored(source, index) {
    const lines = source.split('\n'), line = lineAt(source, index) - 1;
    return [lines[line], lines[line - 1] || ''].some(l => /(?:--|\/\/|\/\*|<!--)\s*i18n-ignore:\s*\S.+/.test(l));
}

/** Parse Lua, including inline table fields and nested notification arguments. */
export function scanLuaPresentation(file, source, visible, report, reference) {
    if (/fxmanifest\.lua$|\/locales\//.test(file)) return;
    const sanitized = source.replace(/`[^`\n]+`/g, text => '0' + ' '.repeat(text.length - 1));
    let tree;
    try { tree = lua.parse(sanitized, { luaVersion: '5.3', ranges: true }); }
    catch (error) { report(file, '', `Lua parse failed: ${error.message}`); return; }
    // English fallback text may live next to a semantic locale key. Keep the
    // fallback for compatibility, but treat the key as the presentation source.
    const keyedFallbacks = new WeakSet();
    (function collect(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'TableConstructorExpression') {
            const names = new Set((n.fields || [])
                .filter(field => field.type === 'TableKeyString')
                .map(field => field.key.name));
            for (const field of n.fields || []) {
                if (field.type === 'TableKeyString' && presentationFields.test(field.key.name)
                    && names.has(`${field.key.name}Key`)) keyedFallbacks.add(field);
            }
        }
        for (const value of Object.values(n)) if (Array.isArray(value)) value.forEach(collect); else if (value && typeof value === 'object') collect(value);
    })(tree);
    const hit = (n, reason) => {
        const text = luaText(n);
        if (text && visible(text) && !ignored(source, n.range[0])) report(file, lineAt(source, n.range[0]), `${reason}: ${text}`);
    };
    function callName(base) {
        if (!base) return '';
        if (base.type === 'Identifier') return base.name;
        if (base.type === 'MemberExpression') return base.identifier.name;
        return '';
    }
    function values(n, reason) {
        if (!n) return;
        if (n.type === 'StringLiteral') hit(n, reason);
        else if (n.type === 'BinaryExpression' || n.type === 'LogicalExpression') { values(n.left, reason); values(n.right, reason); }
    }
    function each(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'TableKeyString') {
            if (presentationFields.test(n.key.name) && !keyedFallbacks.has(n)) values(n.value, 'Lua presentation field');
            if (keyFields.test(n.key.name) && luaText(n.value)) reference(file, luaText(n.value));
        }
        if (n.type === 'ReturnStatement' && ['NilLiteral', 'BooleanLiteral'].includes(n.arguments[0]?.type)) {
            const text = luaText(n.arguments[1]);
            if (text && /\s/.test(text)) hit(n.arguments[1], 'Lua error return');
        }
        if (n.type === 'CallExpression') {
            const name = callName(n.base), args = n.arguments || [];
            if (/^(?:Translate|T|tr|TFor|TLocale|NotifyFor|LocalizedError|localeError)$/.test(name)) {
                const index = /^(?:TFor|TLocale|NotifyFor)$/.test(name) || name === 'Translate' && args[0]?.type !== 'StringLiteral' ? 1 : 0;
                const key = luaText(args[index]); if (key) reference(file, key);
            }
            if (/^(?:Notify|notify|uiNotify|showHint|ShowHelpNotification|DrawText3D|AddTextComponentString|AddTextComponentSubstringPlayerName)$/.test(name)) {
                const index = name === 'DrawText3D' || file.includes('/server/') && args.length > 1 && args[0]?.type === 'Identifier' && /^(source|src|target|targetSrc|playerId|id)$/.test(args[0].name) ? 1 : 0;
                values(args[index], 'Lua visible call');
            }
            const event = luaText(args[0]);
            if (event && /notify$/i.test(event) && name === 'TriggerClientEvent') values(args[2], 'Lua outgoing notification');
        }
        for (const value of Object.values(n)) if (Array.isArray(value)) value.forEach(each); else if (value && typeof value === 'object') each(value);
    }
    each(tree);
}

export function scanJsPresentation(file, source, visible, report, reference) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const hit = (node, text, reason) => {
        if (visible(text) && !ignored(source, node.getStart(sf))) report(file, sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, `${reason}: ${text.slice(0, 180)}`);
    };
    function textParts(node) {
        if (ts.isStringLiteralLike(node)) return node.text;
        if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(s => '{value}' + s.literal.text).join('');
        return null;
    }
    function values(node, html = false) {
        if (!node) return;
        const text = textParts(node);
        if (text !== null) {
            if (!html) hit(node, text, 'JS presentation literal');
            else {
                const fragment = parseFragment(text);
                const visit = n => {
                    if (n.nodeName === '#text') hit(node, n.value, 'JS HTML text');
                    for (const a of n.attrs || []) if (/^(title|placeholder|aria-label|alt)$/.test(a.name)) hit(node, a.value, 'JS HTML attribute');
                    for (const child of n.childNodes || []) visit(child);
                };
                visit(fragment);
            }
        } else if (ts.isConditionalExpression(node)) { values(node.whenTrue, html); values(node.whenFalse, html); }
        else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) { values(node.left, html); values(node.right, html); }
    }
    function each(n) {
        if (ts.isPropertyAssignment(n)) {
            if (presentationFields.test(n.name.text || '')) values(n.initializer);
            if (keyFields.test(n.name.text || '') && ts.isStringLiteralLike(n.initializer)) reference(file, n.initializer.text);
        }
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && /^(textContent|innerText|innerHTML|placeholder|title)$/.test(n.left.name.text)) values(n.right, n.left.name.text === 'innerHTML');
        if (ts.isCallExpression(n)) {
            const name = n.expression.getText(sf);
            if (/^(?:I18n\.t|I18n\.plural)$/.test(name) && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) reference(file, n.arguments[0].text, name.endsWith('plural'));
            if (/^(?:showToast|showFeedback|showNotify|showError|setError|setStatus|confirm|alert)$/.test(name)) values(n.arguments[0]);
            if (/\.insertAdjacentHTML$/.test(name)) values(n.arguments[1], true);
        }
        ts.forEachChild(n, each);
    }
    each(sf);
}
