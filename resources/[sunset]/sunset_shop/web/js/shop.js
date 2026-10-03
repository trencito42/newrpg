/* Racket Shop NUI. Display only: every price, reward and eligibility decision
   is made by the server (sunset_shop/server). The client sends productId,
   a requestId (idempotency key) and the declared input (tag / color). */
(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const t = (key, params) => (window.I18n && window.I18n.t ? window.I18n.t(key, params) : key);
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'sunset_shop';

    const ICONS = {
        user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'user-edit': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m18 8 3 3-5 5h-3v-3z"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        'shield-edit': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m10 14 4-4 2 2-4 4h-2z"/>',
        tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
        palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a3 3 0 0 1 0-6h2"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
        coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
        car: '<path d="M5 17h14l-1.5-6h-11z"/><path d="M3 17h18v2H3z"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
        star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    };

    const state = {
        open: false,
        data: null,
        category: 'character',
        selected: null,
        busy: false,
        pending: null,      // { productId, requestId, params }
        useNow: null,       // 'name_change' | 'clan_name_change'
    };

    function post(name, data) {
        return fetch(`https://${resourceName}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data || {}),
        }).then((res) => res.json()).catch(() => ({ ok: false }));
    }

    function icon(name) {
        const body = ICONS[name] || ICONS.star;
        return `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[ch]));
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('en-US');
    }

    function rc(amount) {
        return t('shop.ui.amount_rc', { amount: formatNumber(amount) });
    }

    function newRequestId() {
        const rand = Math.random().toString(36).slice(2, 12);
        return `shop-${Date.now().toString(36)}-${rand}`;
    }

    function show(el, visible) {
        if (el) el.classList.toggle('hidden', !visible);
    }

    function products() {
        return (state.data && state.data.products) || [];
    }

    function clan() {
        return (state.data && state.data.clan) || { inClan: false };
    }

    function entitlements() {
        return (state.data && state.data.entitlements) || {};
    }

    // Client-side hint only: the server re-checks every rule at purchase time.
    function blockReason(product) {
        if (!product) return null;
        const c = clan();
        if (product.requiresLeader) {
            if (!c.inClan) return t('shop.ui.not_in_clan');
            if (!c.leader) return t('shop.clan.not_leader');
            if (c.status === 'expired') return t('clans.err.clan_is_expired');
        }
        if (product.clanAction === 'slots' && Number(c.maxMembers || 0) >= Number(product.slots || 0)) {
            return t('shop.purchase.already_owned');
        }
        if ((state.data?.balance || 0) < product.price) return t('shop.purchase.insufficient_rc');
        return null;
    }

    /* ── rendering ─────────────────────────────────────────── */

    function renderBalance() {
        const el = $('#shop-balance');
        if (el) el.textContent = rc(state.data?.balance || 0);
    }

    function renderCategories() {
        const nav = $('#shop-categories');
        if (!nav) return;
        const categories = (state.data && state.data.categories) || [];
        nav.innerHTML = categories.map((cat) => {
            const count = products().filter((p) => p.category === cat.id).length;
            const active = cat.id === state.category ? ' is-active' : '';
            return `<button type="button" class="shop-cat${active}" data-category="${escapeHtml(cat.id)}">
                ${icon(cat.icon)}<span class="shop-cat__label">${escapeHtml(t(cat.labelKey))}</span><span class="shop-cat__count">${count}</span>
            </button>`;
        }).join('');
        nav.querySelectorAll('.shop-cat').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.category = btn.dataset.category;
                state.selected = null;
                render();
            });
        });
    }

    function renderEntitlements() {
        const box = $('#shop-entitlements');
        if (!box) return;
        const owned = entitlements();
        const rows = [];
        if (state.category === 'character' && owned.char_name_change > 0) {
            rows.push({ kind: 'name_change', count: owned.char_name_change, labelKey: 'shop.product.char_name_change.label' });
        }
        if (state.category === 'clan' && owned.clan_name_change > 0) {
            rows.push({ kind: 'clan_name_change', count: owned.clan_name_change, labelKey: 'shop.product.clan_name_change.label' });
        }
        box.innerHTML = rows.map((row) => `<div class="shop-ent">
            <span>${escapeHtml(t('shop.ui.unused_entitlements', { count: row.count, product: t(row.labelKey) }))}</span>
            <button type="button" class="shop-btn shop-btn--primary shop-btn--sm" data-use="${row.kind}">${escapeHtml(t('shop.ui.use_now'))}</button>
        </div>`).join('');
        box.querySelectorAll('[data-use]').forEach((btn) => btn.addEventListener('click', () => openUseNow(btn.dataset.use)));
        show(box, rows.length > 0);
    }

    function renderGrid() {
        const grid = $('#shop-grid');
        if (!grid) return;
        const list = products().filter((p) => p.category === state.category);
        show($('#shop-empty'), list.length === 0);
        grid.innerHTML = list.map((p) => {
            const selected = state.selected === p.id ? ' is-selected' : '';
            const blocked = blockReason(p) ? ' is-blocked' : '';
            return `<button type="button" class="shop-card${selected}${blocked}" data-product="${escapeHtml(p.id)}">
                <span class="shop-card__icon">${icon(p.icon)}</span>
                <span class="shop-card__name">${escapeHtml(t(p.labelKey))}</span>
                <span class="shop-card__price">${escapeHtml(rc(p.price))}</span>
            </button>`;
        }).join('');
        grid.querySelectorAll('.shop-card').forEach((card) => {
            card.addEventListener('click', () => {
                state.selected = card.dataset.product;
                renderGrid();
                renderDetail();
            });
        });
    }

    function productFacts(p) {
        const facts = [];
        if (p.bankAmount) facts.push(t('shop.ui.bank_reward', { amount: formatNumber(p.bankAmount) }));
        if (p.clanAction === 'slots') facts.push(t('shop.ui.slots_reward', { slots: p.slots }));
        if (p.clanAction === 'renew') facts.push(t('shop.ui.days_reward', { days: p.days }));
        if (p.requiresLeader) facts.push(t('shop.ui.req_leader'));
        if (p.clanAction === 'slots' && clan().inClan) facts.push(t('shop.ui.current_slots', { slots: clan().maxMembers }));
        facts.push(t(p.repeatable ? 'shop.ui.repeatable' : 'shop.ui.one_time'));
        return facts;
    }

    function renderDetail() {
        const p = products().find((x) => x.id === state.selected);
        show($('#shop-detail-placeholder'), !p);
        show($('#shop-detail-body'), Boolean(p));
        if (!p) return;
        $('#shop-detail-icon').innerHTML = icon(p.icon);
        $('#shop-detail-name').textContent = t(p.labelKey);
        $('#shop-detail-desc').textContent = t(p.descriptionKey);
        $('#shop-detail-facts').innerHTML = productFacts(p).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
        $('#shop-detail-price').textContent = rc(p.price);
        show($('#shop-input-tag'), p.input === 'tag');
        show($('#shop-input-color'), p.input === 'color');
        if (p.input === 'tag') $('#shop-tag-field').value = '';
        if (p.input === 'color') {
            const current = /^#[0-9a-f]{6}$/i.test(clan().tagColor || '') ? clan().tagColor.toUpperCase() : '#D7B558';
            $('#shop-color-picker').value = current;
            $('#shop-color-hex').value = current;
        }
        const reason = blockReason(p);
        const block = $('#shop-detail-block');
        block.textContent = reason || '';
        show(block, Boolean(reason));
        $('#shop-buy-btn').disabled = Boolean(reason) || state.busy;
    }

    function render() {
        renderBalance();
        renderCategories();
        renderEntitlements();
        renderGrid();
        renderDetail();
    }

    /* ── purchase flow ─────────────────────────────────────── */

    function collectParams(p) {
        if (p.input === 'tag') return { tag: ($('#shop-tag-field').value || '').trim() };
        if (p.input === 'color') return { color: ($('#shop-color-hex').value || '').trim().toUpperCase() };
        return {};
    }

    function openConfirm() {
        const p = products().find((x) => x.id === state.selected);
        if (!p || blockReason(p)) return;
        const params = collectParams(p);
        if (p.input === 'tag' && !/^[A-Za-z0-9]{2,6}$/.test(params.tag)) {
            setDetailError(t('shop.clan.invalid_tag'));
            return;
        }
        if (p.input === 'color' && !/^#[0-9A-F]{6}$/.test(params.color)) {
            setDetailError(t('shop.clan.invalid_color'));
            return;
        }
        // One requestId per confirmation dialog: a retry after a lost response
        // reuses it, so the server replays instead of charging twice.
        state.pending = { productId: p.id, requestId: newRequestId(), params };
        $('#shop-confirm-text').textContent = t('shop.ui.confirm_text', { product: t(p.labelKey), price: rc(p.price) });
        $('#shop-confirm-after').textContent = t('shop.ui.balance_after', { amount: rc((state.data?.balance || 0) - p.price) });
        setModalState('#shop-confirm-state', null);
        $('#shop-confirm-ok').disabled = false;
        show($('#shop-confirm'), true);
    }

    function setDetailError(message) {
        const block = $('#shop-detail-block');
        block.textContent = message;
        show(block, true);
    }

    function setModalState(sel, message, kind) {
        const el = $(sel);
        if (!el) return;
        el.textContent = message || '';
        el.className = `shop-modal__state${kind ? ` is-${kind}` : ''}`;
        show(el, Boolean(message));
    }

    async function confirmPurchase() {
        if (state.busy || !state.pending) return;
        state.busy = true;
        $('#shop-confirm-ok').disabled = true;
        $('#shop-confirm-cancel').disabled = true;
        setModalState('#shop-confirm-state', t('shop.ui.processing'), 'loading');
        const response = await post('shopPurchase', state.pending);
        state.busy = false;
        $('#shop-confirm-cancel').disabled = false;
        if (!response || !response.ok) {
            $('#shop-confirm-ok').disabled = false;
            setModalState('#shop-confirm-state', (response && response.error) || t('shop.purchase.failed'), 'error');
            return;
        }
        const result = response.result || {};
        const product = products().find((x) => x.id === state.pending.productId);
        state.pending = null;
        show($('#shop-confirm'), false);
        await refresh();
        showResult(product, result);
    }

    function showResult(product, result) {
        $('#shop-result-title').textContent = t('shop.purchase.success');
        $('#shop-result-text').textContent = product ? t('shop.ui.result_text', { product: t(product.labelKey) }) : '';
        state.useNow = result.useNow || null;
        show($('#shop-result-use'), Boolean(state.useNow));
        show($('#shop-result'), true);
    }

    function openUseNow(kind) {
        show($('#shop-result'), false);
        if (kind === 'name_change') {
            $('#shop-rename-first').value = '';
            $('#shop-rename-last').value = '';
            setModalState('#shop-rename-state', null);
            show($('#shop-rename'), true);
            $('#shop-rename-first').focus();
        } else if (kind === 'clan_name_change') {
            $('#shop-clanname-field').value = '';
            setModalState('#shop-clanname-state', null);
            show($('#shop-clanname'), true);
            $('#shop-clanname-field').focus();
        }
    }

    const NAME_PART = /^[A-Za-z][A-Za-z -]*[A-Za-z]$/;
    function validNamePart(value) {
        return typeof value === 'string' && value.length >= 2 && value.length <= 32
            && NAME_PART.test(value) && !/(\s\s|--|\s-|-\s)/.test(value);
    }

    async function submitRename(event) {
        event.preventDefault();
        if (state.busy) return;
        const firstname = $('#shop-rename-first').value;
        const lastname = $('#shop-rename-last').value;
        if (!validNamePart(firstname) || !validNamePart(lastname)) {
            setModalState('#shop-rename-state', t('shop.name_change.invalid'), 'error');
            return;
        }
        state.busy = true;
        $('#shop-rename-submit').disabled = true;
        setModalState('#shop-rename-state', t('shop.ui.processing'), 'loading');
        const response = await post('shopUseNameChange', { firstname, lastname });
        state.busy = false;
        $('#shop-rename-submit').disabled = false;
        if (!response || !response.ok) {
            setModalState('#shop-rename-state', (response && response.error) || t('shop.name_change.failed'), 'error');
            return;
        }
        show($('#shop-rename'), false);
        await refresh();
    }

    async function submitClanName(event) {
        event.preventDefault();
        if (state.busy) return;
        const name = ($('#shop-clanname-field').value || '').trim();
        if (name.length < 3 || name.length > 32) {
            setModalState('#shop-clanname-state', t('shop.clan.invalid_name'), 'error');
            return;
        }
        state.busy = true;
        $('#shop-clanname-submit').disabled = true;
        setModalState('#shop-clanname-state', t('shop.ui.processing'), 'loading');
        const response = await post('shopUseClanNameChange', { name });
        state.busy = false;
        $('#shop-clanname-submit').disabled = false;
        if (!response || !response.ok) {
            setModalState('#shop-clanname-state', (response && response.error) || t('shop.purchase.failed'), 'error');
            return;
        }
        show($('#shop-clanname'), false);
        await refresh();
    }

    /* ── history ───────────────────────────────────────────── */

    async function openHistory() {
        const list = $('#shop-history-list');
        list.innerHTML = `<div class="shop-history__empty">${escapeHtml(t('shop.ui.processing'))}</div>`;
        show($('#shop-history'), true);
        const response = await post('shopGetHistory');
        const orders = (response && response.ok && response.orders) || [];
        if (!orders.length) {
            list.innerHTML = `<div class="shop-history__empty">${escapeHtml(t('shop.ui.history_empty'))}</div>`;
            return;
        }
        list.innerHTML = orders.map((o) => {
            const when = o.created ? new Date(o.created * 1000).toLocaleString() : '';
            return `<div class="shop-history__row">
                <span class="shop-history__name">${escapeHtml(o.labelKey ? t(o.labelKey) : o.productId)}</span>
                <span class="shop-history__when">${escapeHtml(when)}</span>
                <span class="shop-history__price">${escapeHtml(rc(o.price))}</span>
                <span class="shop-history__status is-${escapeHtml(o.status)}">${escapeHtml(t(`shop.ui.status.${o.status}`))}</span>
            </div>`;
        }).join('');
    }

    /* ── lifecycle ─────────────────────────────────────────── */

    async function refresh() {
        const response = await post('shopOpen');
        if (response && response.ok && response.state) {
            state.data = response.state;
            render();
        }
    }

    function closeModals() {
        let closed = false;
        ['#shop-confirm', '#shop-result', '#shop-rename', '#shop-clanname', '#shop-history'].forEach((sel) => {
            const el = $(sel);
            if (el && !el.classList.contains('hidden')) { el.classList.add('hidden'); closed = true; }
        });
        if (closed) state.pending = null;
        return closed;
    }

    function openShop(data) {
        state.data = data || {};
        state.open = true;
        state.selected = null;
        if (!products().some((p) => p.category === state.category)) state.category = 'character';
        closeModals();
        show($('#shop'), true);
        if (window.I18n && window.I18n.translateTree) window.I18n.translateTree(document);
        render();
    }

    function hideShop() {
        state.open = false;
        state.busy = false;
        closeModals();
        show($('#shop'), false);
    }

    function requestClose() {
        if (state.busy) return;
        post('shopClose');
    }

    window.addEventListener('message', (event) => {
        const msg = event.data || {};
        if (msg.action === 'shopShow') openShop(msg.data);
        else if (msg.action === 'shopHide') hideShop();
        else if (msg.action === 'shopBalance' && state.data) {
            state.data.balance = Number(msg.data?.balance) || 0;
            renderBalance();
        } else if (msg.action === 'localeSet' && state.open) {
            render();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (!state.open || event.key !== 'Escape') return;
        event.preventDefault();
        if (state.busy) return;
        if (!closeModals()) requestClose();
    });

    document.addEventListener('DOMContentLoaded', () => {
        $('#shop-close-btn').addEventListener('click', requestClose);
        $('#shop-history-btn').addEventListener('click', openHistory);
        $('#shop-history-close').addEventListener('click', () => show($('#shop-history'), false));
        $('#shop-buy-btn').addEventListener('click', openConfirm);
        $('#shop-confirm-ok').addEventListener('click', confirmPurchase);
        $('#shop-confirm-cancel').addEventListener('click', () => {
            if (state.busy) return;
            state.pending = null;
            show($('#shop-confirm'), false);
        });
        $('#shop-result-close').addEventListener('click', () => show($('#shop-result'), false));
        $('#shop-result-use').addEventListener('click', () => openUseNow(state.useNow));
        $('#shop-rename-form').addEventListener('submit', submitRename);
        $('#shop-rename-cancel').addEventListener('click', () => show($('#shop-rename'), false));
        $('#shop-clanname-form').addEventListener('submit', submitClanName);
        $('#shop-clanname-cancel').addEventListener('click', () => show($('#shop-clanname'), false));
        $('#shop-color-picker').addEventListener('input', (e) => { $('#shop-color-hex').value = e.target.value.toUpperCase(); });
        $('#shop-color-hex').addEventListener('input', (e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-f]{6}$/i.test(v)) $('#shop-color-picker').value = v.toLowerCase();
        });
    });
})();
