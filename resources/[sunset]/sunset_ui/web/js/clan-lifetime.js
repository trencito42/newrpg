/* Clan lifetime presentation. Remaining days are derived from clans.expires_at
   by the server (remainingDays / expiresInSeconds / calendar parts). This file
   only chooses the label and warning state. */
(function (root) {
    const MONTHS = {
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        ro: ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'],
    };

    function formatDate(year, month, day, locale) {
        const names = MONTHS[locale] || MONTHS.en;
        const index = (Number(month) || 1) - 1;
        const name = names[index] || String(month);
        return `${Number(day)} ${name} ${Number(year)}`;
    }

    function view(data, locale, t) {
        data = data || {};
        locale = locale === 'ro' ? 'ro' : 'en';
        const translate = typeof t === 'function' ? t : ((key) => key);
        const status = String(data.status || 'active');
        const days = Number(data.remainingDays);
        const year = Number(data.expiresYear);
        const month = Number(data.expiresMonth);
        const day = Number(data.expiresDay);
        const hasDate = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);
        const date = hasDate ? formatDate(year, month, day, locale) : '';

        if (!hasDate && !Number.isFinite(days)) {
            return { state: 'ok', primary: '—', expires: '' };
        }

        let state = 'ok';
        let primaryKey = 'ui.clans.days_remaining';
        let primaryParams = { days: Number.isFinite(days) ? days : 0 };

        if (status === 'expired') {
            state = 'expired';
            primaryKey = 'ui.clans.expired';
            primaryParams = {};
        } else if (status === 'grace') {
            state = 'warning';
            primaryKey = 'ui.clans.grace';
            primaryParams = {};
        } else if (!Number.isFinite(days) || days <= 0) {
            state = 'warning';
            primaryKey = 'ui.clans.expires_today';
            primaryParams = {};
        } else if (days <= 7) {
            state = 'warning';
            primaryKey = days === 1 ? 'ui.clans.day_remaining' : 'ui.clans.days_remaining';
            primaryParams = { days };
        } else {
            primaryKey = 'ui.clans.days_remaining';
            primaryParams = { days };
        }

        return {
            state,
            primary: translate(primaryKey, primaryParams),
            expires: date ? translate('ui.clans.expires', { date }) : '',
            date,
        };
    }

    root.ClanLifetime = { view, formatDate, MONTHS };
})(typeof window !== 'undefined' ? window : globalThis);
