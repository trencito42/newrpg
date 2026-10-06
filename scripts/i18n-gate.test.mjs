import test from 'node:test';
import assert from 'node:assert/strict';
import { placeholders, scanPanel } from './i18n-gate.mjs';
const pair = { en: new Map(), ro: new Map() };
const scan = source => {
    const findings = [];
    scanPanel('fixture.tsx', source, pair, (...args) => findings.push(args));
    return findings;
};
test('AST finds JSX, attributes, messages, object labels and visible locale branches', () => {
    for (const source of [
        'const view = <h1>Hello</h1>;',
        'const view = <input placeholder="Search player" />;',
        'const view = <button aria-label={"Delete player"} />;',
        'const data = { label: "Player management" };',
        'setError("Could not save changes");',
        'const label = locale === "ro" ? "Jucători" : "Players";',
    ]) assert.ok(scan(source).length, source);
});
test('AST keeps content expressions and style classes unchanged', () => {
    assert.equal(scan('const view = <div className="bg-brand text-white">{player.name}{message.body}</div>;').length, 0);
    assert.equal(scan('const format = locale === "ro" ? "ro-RO" : "en-US";').length, 0);
});
test('AST flags JSX expression string literals', () => {
    assert.ok(scan('const view = <h1>{"Forum"}</h1>;').length);
    assert.equal(scan('const view = <h1>{t(locale, "forumUi.title")}</h1>;').length, 0);
});
test('ignore requires an adjacent explanation', () => {
    assert.equal(scan('// i18n-ignore: product brand\nconst view = <h1>ExampleBrand</h1>;').length, 0);
    assert.ok(scan('// i18n-ignore\nconst view = <h1>Hello</h1>;').length);
});
test('placeholder comparison checks names, multiplicity, printf order and escaped percent', () => {
    assert.notEqual(placeholders('{amount}'), placeholders('{money}'));
    assert.notEqual(placeholders('{amount} {amount}'), placeholders('{amount}'));
    assert.notEqual(placeholders('%s %d'), placeholders('%d %s'));
    assert.equal(placeholders('20%%'), placeholders(''));
    assert.equal(placeholders('{percent}% of sales'), placeholders('{percent}% din vânzări'));
});
