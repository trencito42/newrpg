#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const listeners = new Map();
const nodes = {
    text: { dataset: { i18n: 'menu.settings.language' }, textContent: '' },
    placeholder: { dataset: { i18nPlaceholder: 'common.search' }, placeholder: '' },
    aria: { dataset: { i18nAria: 'menu.nav.label' }, setAttribute(name, value) { this[name] = value; } },
    alt: { dataset: { i18nAlt: 'common.vehicle' }, alt: '' },
    value: { dataset: { i18nValue: 'common.confirm' }, value: '' },
};
const document = {
    documentElement: { lang: 'en' },
    addEventListener(name, cb) { listeners.set(name, cb); },
    querySelectorAll(selector) {
        if (selector === '[data-i18n]') return [nodes.text];
        if (selector === '[data-i18n-placeholder]') return [nodes.placeholder];
        if (selector === '[data-i18n-aria]') return [nodes.aria];
        if (selector === '[data-i18n-alt]') return [nodes.alt];
        if (selector === '[data-i18n-value]') return [nodes.value];
        return [];
    },
};
const window = {
    dispatchEvent(event) { this.lastEvent = event; },
    addEventListener(name, cb) { listeners.set(`window:${name}`, cb); },
};
const context = vm.createContext({ window, document, console, Intl, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } });
const source = fs.readFileSync(path.resolve(__dirname, '../resources/[sunset]/sunset_ui/web/js/i18n.js'), 'utf8');
const generatedSource = fs.readFileSync(path.resolve(__dirname, '../resources/[sunset]/sunset_ui/web/js/i18n.generated.js'), 'utf8');
vm.runInContext(generatedSource, context, { filename: 'i18n.generated.js' });
vm.runInContext(source, context, { filename: 'i18n.js' });

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(window.I18n.getLocale() === 'en', 'default locale must be EN');
assert(window.I18n.t('menu.profile.level', { level: 7 }) === 'Level 7', 'EN interpolation failed');
assert(window.I18n.setLocale('ro') === true, 'RO locale rejected');
assert(window.I18n.t('menu.profile.level', { level: 7 }) === 'Nivel 7', 'RO interpolation failed');
assert(nodes.text.textContent === 'Limbă', 'visible text did not rerender');
assert(nodes.placeholder.placeholder === 'Caută', 'placeholder did not rerender');
assert(nodes.aria['aria-label'] === 'Secțiunile meniului jucătorului', 'ARIA label did not rerender');
assert(nodes.alt.alt === 'Vehicul', 'alt text did not rerender');
assert(nodes.value.value === 'Confirmă', 'input value did not rerender');
assert(window.I18n.t('ui.mdc.search') !== '[?ui.mdc.search]', 'generated catalog was not merged');
assert(document.documentElement.lang === 'ro', 'document language did not update');
assert(window.lastEvent?.type === 'sunset:localeChanged', 'locale event not dispatched');
assert(window.I18n.setLocale('xx') === false && window.I18n.getLocale() === 'ro', 'invalid locale changed state');
assert(window.I18n.t('does.not.exist') === 'Exist', 'readable missing-key fallback failed');
window.SUNSET_I18N_DEBUG = true;
assert(window.I18n.t('does.not.exist') === '[?does.not.exist]', 'debug missing-key marker failed');
window.SUNSET_I18N_DEBUG = false;
listeners.get('window:message')?.({ data: { action: 'localeSet', data: { locale: 'en' } } });
assert(window.I18n.getLocale() === 'en', 'standalone NUI locale message failed');
console.log('NUI localization tests OK: locale validation, interpolation, live rerender, attributes, event, and fallback marker.');

window.SUNSET_I18N_STRICT = true;
let missingFailed = false, parameterFailed = false;
try { window.I18n.t('does.not.exist'); } catch (error) { missingFailed = /locale=en key=does.not.exist/.test(error.message); }
try { window.I18n.t('menu.profile.level'); } catch (error) { parameterFailed = /missing parameter/.test(error.message); }
assert(missingFailed, 'strict mode must reject missing keys with context');
assert(parameterFailed, 'strict mode must reject missing parameters');
assert(window.I18n.t('menu.profile.level', { level: 7 }) === 'Level 7', 'strict valid call failed');
window.SUNSET_I18N_STRICT = false;
console.log('NUI strict localization tests OK.');
