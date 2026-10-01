/* ============================================================
   job-hud.js — shared job HUD (JobHud). Module "job_hud".
   Actions (from exports.sunset_ui:Send via the JobHud helpers):
     jobHud        { title, objective, tone, key, progress, distance,
                     earnings, timer, timerLabel, vehicle, keyHints, patch }
     jobHudResult  { kind: success|fail|cancel, title, message, earnings, ttl }
     jobHudClear   {}
   All text is set with textContent. Hidden = display:none, no
   timers, no rAF. A 1s interval runs ONLY while a ticking timer is
   visible; the result auto-hide timeout only while a result shows.
   ============================================================ */
const JobHud = (() => {
    'use strict';
    const t = (key, params) => (window.I18n && window.I18n.t ? window.I18n.t(key, params) : key);
    const TONES = { info: 1, warn: 1, danger: 1, success: 1 };
    const KINDS = {
        success: { tone: 'success', title: 'ui.jobhud.result_success' }, // i18n-ignore: value is an I18n key
        fail: { tone: 'danger', title: 'ui.jobhud.result_fail' }, // i18n-ignore: value is an I18n key
        cancel: { tone: 'warn', title: 'ui.jobhud.result_cancel' }, // i18n-ignore: value is an I18n key
    };

    let root = null;
    let els = null;
    let state = {};
    let tickId = 0;
    let resultId = 0;
    let timerBase = null; // { at: performance.now(), sec, dir }
    let showing = false;

    const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function metaItem(name) {
        const li = el('li', 'hidden');
        li.dataset.meta = name;
        const label = el('span', 'jobhud__meta-label');
        const value = el('span', 'jobhud__meta-value');
        li.append(label, value);
        return { li, label, value };
    }

    function build() {
        if (root) return;
        root = el('div', 'jobhud hidden');
        root.id = 'job-hud';
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');
        const live = el('div', 'jobhud__live');
        const head = el('div', 'jobhud__head');
        const title = el('div', 'jobhud__title');
        const count = el('div', 'jobhud__count hidden');
        head.append(title, count);
        const objective = el('div', 'jobhud__objective');
        const bar = el('div', 'jobhud__bar hidden');
        const fill = el('i', 'jobhud__fill');
        bar.append(fill);
        const meta = el('ul', 'jobhud__meta');
        const items = { distance: metaItem('distance'), earnings: metaItem('earnings'), timer: metaItem('timer'), vehicle: metaItem('vehicle') };
        Object.values(items).forEach((m) => meta.append(m.li));
        const keys = el('div', 'jobhud__keys hidden');
        live.style.display = 'contents';
        live.append(head, objective, bar, meta, keys);
        const result = el('div', 'jobhud__result hidden');
        const rTitle = el('div', 'jobhud__result-title');
        const rMsg = el('div', 'jobhud__result-msg');
        const rEarn = el('div', 'jobhud__result-earn');
        result.append(rTitle, rMsg, rEarn);
        root.append(live, result);
        document.body.appendChild(root);
        els = { live, title, count, objective, bar, fill, meta, items, keys, result, rTitle, rMsg, rEarn };
    }

    function fmtDistance(m) {
        const n = Math.max(0, Math.round(m));
        return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${n} m`;
    }
    function fmtMoney(v) {
        return `$${I18n.number(Math.round(v))}`;
    }
    function fmtClock(sec) {
        const s = Math.max(0, Math.floor(sec));
        const m = Math.floor(s / 60);
        return `${m}:${String(s % 60).padStart(2, '0')}`;
    }

    function setMeta(name, labelKey, value, labelOverride) {
        const m = els.items[name];
        if (value == null || value === '') { m.li.classList.add('hidden'); return; }
        m.li.classList.remove('hidden');
        m.label.textContent = labelOverride || t(labelKey);
        m.value.textContent = value;
    }

    function renderObjective(text, key) {
        const target = els.objective;
        target.replaceChildren();
        const raw = clip(text, 220);
        const marker = '{key}';
        const i = raw.indexOf(marker);
        if (i < 0) { target.textContent = raw; return; }
        const cap = el('span', 'jobhud__key', clip(key || 'E', 4));
        target.append(document.createTextNode(raw.slice(0, i)), cap, document.createTextNode(raw.slice(i + marker.length)));
    }

    function renderHints(list) {
        els.keys.replaceChildren();
        const hints = Array.isArray(list) ? list.slice(0, 4) : [];
        els.keys.classList.toggle('hidden', hints.length === 0);
        hints.forEach((h) => {
            if (!h) return;
            const row = el('span', 'jobhud__hint');
            row.append(el('span', 'jobhud__key', clip(h.key || 'E', 4)), el('span', 'jobhud__hint-label', clip(h.label, 60)));
            els.keys.append(row);
        });
    }

    function progressView(p) {
        // Accepts { current, total }, { pct }, or a bare 0..100 number.
        if (p == null) return null;
        if (typeof p === 'number') return { pct: p, text: null };
        const cur = num(p.current);
        const tot = num(p.total);
        if (cur != null && tot != null && tot > 0) return { pct: (cur / tot) * 100, text: `${cur}/${tot}` };
        const pct = num(p.pct);
        return pct == null ? null : { pct, text: null };
    }

    function stopTick() {
        if (tickId) { clearInterval(tickId); tickId = 0; }
        timerBase = null;
    }

    function paintTimer() {
        if (!timerBase) return;
        const elapsed = (performance.now() - timerBase.at) / 1000;
        const sec = timerBase.dir === 'down' ? timerBase.sec - elapsed : timerBase.sec + elapsed;
        els.items.timer.value.textContent = fmtClock(sec);
        if (timerBase.dir === 'down' && sec <= 0) stopTick();
    }

    function setTimer(timer, label) {
        stopTick();
        if (timer == null) { setMeta('timer', '', null); return; }
        const sec = typeof timer === 'object' ? num(timer.seconds) : num(timer);
        if (sec == null) { setMeta('timer', '', null); return; }
        const dir = typeof timer === 'object' ? timer.dir : null;
        setMeta('timer', 'ui.jobhud.timer', fmtClock(sec), label);
        if (dir === 'down' || dir === 'up') {
            timerBase = { at: performance.now(), sec, dir };
            tickId = setInterval(paintTimer, 1000);
        }
    }

    function render(d) {
        els.title.textContent = clip(d.title, 48) || t('ui.jobhud.title_default');
        renderObjective(d.objective, d.key);
        els.objective.classList.toggle('hidden', !d.objective);
        const tone = TONES[d.tone] ? d.tone : 'info';
        root.dataset.tone = tone;
        const pv = progressView(d.progress);
        els.bar.classList.toggle('hidden', !pv);
        els.count.classList.toggle('hidden', !(pv && pv.text));
        if (pv) {
            els.fill.style.transform = `scaleX(${Math.max(0, Math.min(100, pv.pct)) / 100})`;
            if (pv.text) els.count.textContent = pv.text;
        }
        const dist = num(d.distance);
        setMeta('distance', 'ui.jobhud.distance', dist == null ? null : fmtDistance(dist));
        const earn = num(d.earnings);
        setMeta('earnings', 'ui.jobhud.earnings', earn == null || earn <= 0 ? null : fmtMoney(earn));
        setTimer(d.timer, d.timerLabel ? clip(d.timerLabel, 12) : null);
        setMeta('vehicle', 'ui.jobhud.vehicle', d.vehicle ? clip(d.vehicle, 32) : null);
        renderHints(d.keyHints);
    }

    function reveal() {
        if (!showing) {
            root.classList.remove('hidden');
            root.classList.remove('jobhud--enter');
            void root.offsetWidth; // restart enter animation once per show
            root.classList.add('jobhud--enter');
            showing = true;
        }
    }

    function clearResultTimer() {
        if (resultId) { clearTimeout(resultId); resultId = 0; }
    }

    function show(data) {
        if (data && data.patch && !showing) return; // late patch after a clear must not resurrect the card
        build();
        const d = data || {};
        clearResultTimer();
        els.result.classList.add('hidden');
        els.live.style.display = 'contents';
        // patch: merge into the current state (cheap distance/timer refreshes)
        state = d.patch ? Object.assign({}, state, d) : Object.assign({}, d);
        delete state.patch;
        render(state);
        reveal();
    }

    function result(data) {
        build();
        const d = data || {};
        const kind = KINDS[d.kind] || KINDS.success;
        stopTick();
        clearResultTimer();
        state = {};
        els.live.style.display = 'none';
        els.result.classList.remove('hidden');
        root.dataset.tone = kind.tone;
        els.rTitle.textContent = clip(d.title, 60) || t(kind.title);
        els.rMsg.textContent = clip(d.message, 200);
        els.rMsg.classList.toggle('hidden', !d.message);
        const earn = num(d.earnings);
        els.rEarn.textContent = earn != null && earn > 0 ? `${t('ui.jobhud.total_earned')}: ${fmtMoney(earn)}` : '';
        els.rEarn.classList.toggle('hidden', !els.rEarn.textContent);
        reveal();
        const ttl = Math.max(1500, Math.min(15000, num(d.ttl) || 5000));
        resultId = setTimeout(hide, ttl);
    }

    function hide() {
        stopTick();
        clearResultTimer();
        state = {};
        showing = false;
        if (root) {
            root.classList.add('hidden');
            root.classList.remove('jobhud--enter');
        }
    }

    // Legacy jobShiftShow payload { title, counter, message, key, progress, detail }
    function showLegacy(d) {
        const data = d || {};
        show({ title: data.title, objective: [data.message, data.detail].filter(Boolean).join(' · '), key: data.key, progress: data.progress });
    }

    return { show, result, hide, showLegacy };
})();

window.JobHud = JobHud;
