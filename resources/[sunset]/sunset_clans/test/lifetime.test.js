#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
function check(cond, message) {
    if (cond) {
        console.log(`  ok  ${message}`);
        return;
    }
    failed += 1;
    console.error(`  FAIL  ${message}`);
}

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(read('resources/[sunset]/sunset_ui/web/js/clan-lifetime.js'), context, { filename: 'clan-lifetime.js' });
const view = context.window.ClanLifetime.view;

const STR = {
    en: {
        'ui.clans.days_remaining': '{days} days remaining',
        'ui.clans.day_remaining': '{days} day remaining',
        'ui.clans.expires': 'Expires {date}',
        'ui.clans.expires_today': 'Expires today',
        'ui.clans.expired': 'Expired',
        'ui.clans.grace': 'Grace period',
    },
    ro: {
        'ui.clans.days_remaining': 'Mai sunt {days} zile',
        'ui.clans.day_remaining': 'Mai este {days} zi',
        'ui.clans.expires': 'Expiră la {date}',
        'ui.clans.expires_today': 'Expiră astăzi',
        'ui.clans.expired': 'Expirat',
        'ui.clans.grace': 'Perioadă de grație',
    },
};

function t(locale) {
    return (key, params) => String(STR[locale][key] || key).replace(/\{([A-Za-z0-9_]+)\}/g, (all, name) => (
        params && params[name] != null ? String(params[name]) : all
    ));
}

function clan(over) {
    return Object.assign({
        status: 'active',
        expiresYear: 2026,
        expiresMonth: 10,
        expiresDay: 30,
        expiresInSeconds: 27 * 86400,
        remainingDays: 27,
    }, over);
}

console.log('lifetime view');
{
    const many = view(clan({ remainingDays: 27, expiresInSeconds: 27 * 86400 }), 'en', t('en'));
    check(many.state === 'ok' && many.primary === '27 days remaining' && many.expires === 'Expires 30 Oct 2026', 'many days, English date');

    const manyRo = view(clan({ remainingDays: 27 }), 'ro', t('ro'));
    check(manyRo.primary === 'Mai sunt 27 zile' && manyRo.expires === 'Expiră la 30 oct. 2026', 'many days, Romanian date');

    const week = view(clan({ remainingDays: 7, expiresDay: 10 }), 'en', t('en'));
    check(week.state === 'warning' && week.primary === '7 days remaining', '7 days is a warning');

    const one = view(clan({ remainingDays: 1, expiresDay: 4 }), 'en', t('en'));
    check(one.state === 'warning' && one.primary === '1 day remaining', '1 day uses the singular label');

    const oneRo = view(clan({ remainingDays: 1, expiresDay: 4 }), 'ro', t('ro'));
    check(oneRo.primary === 'Mai este 1 zi', '1 day, Romanian singular');

    const today = view(clan({ remainingDays: 0, expiresInSeconds: 3 * 3600, expiresDay: 3 }), 'en', t('en'));
    check(today.state === 'warning' && today.primary === 'Expires today' && today.expires === 'Expires 3 Oct 2026', 'expiring today stays a warning');

    const lapsed = view(clan({ remainingDays: -1, expiresInSeconds: -3600, status: 'active' }), 'en', t('en'));
    check(lapsed.state === 'warning' && lapsed.primary === 'Expires today', 'ticker lag is not shown as hard-expired');

    const grace = view(clan({ status: 'grace', remainingDays: -2, expiresInSeconds: -2 * 86400 }), 'en', t('en'));
    check(grace.state === 'warning' && grace.primary === 'Grace period', 'grace follows backend status');

    const expired = view(clan({ status: 'expired', remainingDays: -10 }), 'en', t('en'));
    check(expired.state === 'expired' && expired.primary === 'Expired', 'expired status');

    const expiredRo = view(clan({ status: 'expired', remainingDays: -10 }), 'ro', t('ro'));
    check(expiredRo.primary === 'Expirat', 'expired, Romanian');

    const extended = view(clan({ remainingDays: 4 + 30, expiresDay: 6, expiresMonth: 11 }), 'en', t('en'));
    check(extended.primary === '34 days remaining' && extended.expires === 'Expires 6 Nov 2026' && extended.state === 'ok', 'extension is displayed from the new derived days');
}

console.log('interpolation root cause');
{
    const locale = read('resources/[sunset]/sunset_core/shared/locale.lua');
    check(/rawget\(value, field \.\. 'Params'\)/.test(locale), 'LocalizePresentation reads messageParams');
    check(/named = rawget\(value, 'params'\)/.test(locale), 'generic params remain the fallback');

    const shop = read('resources/[sunset]/sunset_clans/server/shop_ops.lua');
    check(/localeKey = BROADCAST_KEYS\[action\], params = \{ value = tostring\(value\.name or value\.tag or value\.color or value\.slots or value\.days/.test(shop), 'renew broadcast passes {value}');

    function interpolate(template, params) {
        if (!params || typeof params !== 'object') return template;
        return template.replace(/\{([A-Za-z0-9_]+)\}/g, (all, name) => (
            params[name] == null ? all : String(params[name])
        ));
    }
    const template = 'extended the clan lifetime by {value} days';
    const payload = { messageKey: 'shop.clan.broadcast_renew', messageParams: { value: 30 }, message: template };
    const broken = interpolate(template, payload.params);
    const fixed = interpolate(template, payload.messageParams || payload.params);
    check(broken === template, 'ignoring messageParams leaves {value}');
    check(fixed === 'extended the clan lifetime by 30 days', 'messageParams fills {value}');
}

console.log('canonical expiry');
{
    const display = read('resources/[sunset]/sunset_clans/server/display.lua');
    const main = read('resources/[sunset]/sunset_clans/server/main.lua');
    const clansJs = read('resources/[sunset]/sunset_ui/web/js/clans.js');
    const html = read('resources/[sunset]/sunset_ui/web/modules/clans/index.html');
    check(/UNIX_TIMESTAMP\(c\.expires_at\)/.test(display) && /TIMESTAMPDIFF\(DAY, NOW\(\), c\.expires_at\)/.test(display), 'remaining days are derived from expires_at');
    check(!/remaining_days/.test(display) && !/UPDATE clans[\s\S]{0,120}remaining/.test(main), 'no second remaining-days column is written');
    check(/ClanDisplay\.lifetimeFields\(row\)/.test(main), 'dashboard sends the derived lifetime');
    check(/renderLifetime\(payload\)/.test(clansJs) && /id="clan-lifetime-stat"/.test(html), '/clan overview renders lifetime');
    check(!/extendLifetime|data-clan-extend/.test(html), 'overview does not add a leader action');
    check(/action == 'extendLifetime'/.test(main) && /only_the_clan_leader_can_change_clan_settings/.test(main), 'extend stays leader-only on the server');
    check(/clans\.notify\.lifetime_extended_until/.test(main), 'success feedback includes the new expiry');
    check(/sunset:clans:dashboardRefresh/.test(main) && /clanUpdate/.test(read('resources/[sunset]/sunset_clans/client/main.lua')), 'open /clan refreshes without reconnect');
}

if (failed) {
    console.error(`lifetime tests failed: ${failed}`);
    process.exit(1);
}
console.log('lifetime tests passed');
