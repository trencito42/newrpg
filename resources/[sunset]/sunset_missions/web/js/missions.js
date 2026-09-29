'use strict';

const Missions = (() => {
    const RES = () => window.GetParentResourceName ? GetParentResourceName() : 'sunset_missions';
    const $ = sel => document.querySelector(sel);

    function post(name, data) {
        return fetch(`https://${RES()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        }).catch(() => {});
    }

    function fmt(n) {
        return '$' + Number(n).toLocaleString('en-US');
    }

    // ── Mission Offer ─────────────────────────────────────────────
    function showOffer(data) {
        const el = $('#mission-offer');
        if (!el) return;

        const logo = $('#offer-logo');
        if (logo) logo.src = data.logo ? `assets/${data.logo}` : '';

        const t = $('#offer-title');    if (t) t.textContent = data.label || '';
        const c = $('#offer-contact-name'); if (c) c.textContent = data.contact || '';
        const s = $('#offer-contact-sub');  if (s) s.textContent = data.subtitle || '';
        const a = $('#offer-area');         if (a) a.textContent = data.area || '';
        const p = $('#offer-payout');
        if (p) p.textContent = data.rewards
            ? `${fmt(data.rewards.min)} — ${fmt(data.rewards.max)}`
            : '';

        const repRow = $('#offer-rep-row');
        const repVal = $('#offer-rep');
        if (data.stats && data.stats.rep !== undefined) {
            if (repVal) repVal.textContent = data.stats.rep + ' REP';
            if (repRow) repRow.style.display = 'flex';
        } else {
            if (repRow) repRow.style.display = 'none';
        }

        const cdRow = $('#offer-cooldown-row');
        const cdVal = $('#offer-cooldown');
        const acceptBtn = $('#btn-accept');
        if (data.cooldown && data.cooldown > 0) {
            const mins = Math.ceil(data.cooldown / 60);
            if (cdVal) cdVal.textContent = `${mins} min remaining`;
            if (cdRow) cdRow.style.display = 'flex';
            if (acceptBtn) { acceptBtn.disabled = true; acceptBtn.style.opacity = '0.4'; }
        } else {
            if (cdRow) cdRow.style.display = 'none';
            if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.style.opacity = '1'; }
        }

        const acc = $('#btn-accept');
        const dec = $('#btn-decline');
        if (acc) acc.onclick = () => post('missionAccept', { missionId: data.missionId });
        if (dec) dec.onclick = () => post('missionDecline', {});

        el.classList.remove('hidden');
    }

    function hideOffer() {
        const el = $('#mission-offer');
        if (el) el.classList.add('hidden');
    }

    // ── HUD ───────────────────────────────────────────────────────
    function showHUD(data) {
        const el = $('#mission-hud');
        if (!el) return;
        updateHUD(data);
        el.classList.remove('hidden');
    }

    function updateHUD(data) {
        if (!data) return;
        if (data.label !== undefined) {
            const lbl = $('#hud-label');
            if (lbl) lbl.textContent = data.label || 'MISSION';
        }
        if (data.objective !== undefined) {
            const obj = $('#hud-objective');
            if (obj) obj.textContent = data.objective || '';
        }
        if (data.sub !== undefined) {
            const sub = $('#hud-sub');
            if (sub) sub.textContent = data.sub || '';
        }
        if (data.extra) {
            const ext = $('#hud-extras');
            if (ext) {
                ext.innerHTML = '';
                if (data.extra.condition !== undefined) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra-row';
                    row.innerHTML = `<span class="ms-hud-extra-key">CONDITION</span>
                        <span class="ms-hud-extra-val">${data.extra.condition}%</span>`;
                    ext.appendChild(row);
                    const bar = document.createElement('div');
                    bar.className = 'ms-hud-cond-bar';
                    const fill = document.createElement('div');
                    fill.className = 'ms-hud-cond-fill';
                    fill.style.width = data.extra.condition + '%';
                    const pct = data.extra.condition;
                    fill.style.background = pct > 60 ? '#00ffcc' : pct > 30 ? '#fbbf24' : '#f87171';
                    bar.appendChild(fill);
                    ext.appendChild(bar);
                }
                if (data.extra.plate) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra-row';
                    row.innerHTML = `<span class="ms-hud-extra-key">PLATE</span>
                        <span class="ms-hud-extra-val">${data.extra.plate}</span>`;
                    ext.appendChild(row);
                }
                if (data.extra.color) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra-row';
                    row.innerHTML = `<span class="ms-hud-extra-key">COLOR</span>
                        <span class="ms-hud-extra-val">${data.extra.color}</span>`;
                    ext.appendChild(row);
                }
                if (data.extra.row) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra-row';
                    row.innerHTML = `<span class="ms-hud-extra-key">ROW</span>
                        <span class="ms-hud-extra-val">${data.extra.row}</span>`;
                    ext.appendChild(row);
                }
            }
        }
    }

    function hideHUD() {
        const el = $('#mission-hud');
        if (el) el.classList.add('hidden');
    }

    // ── Lockpick ─────────────────────────────────────────────────
    function showLockpick() {
        const el = $('#lockpick');
        if (el) el.classList.remove('hidden');
        LockpickGame.start((success) => {
            hideScreen('lockpick');
            post('lockpickResult', { success });
        });
    }

    // ── Seal ─────────────────────────────────────────────────────
    function showSeal() {
        const el = $('#seal-game');
        if (el) el.classList.remove('hidden');
        SealGame.start((success) => {
            hideScreen('seal-game');
            post('sealResult', { success });
        });
    }

    // ── Mission Complete ─────────────────────────────────────────
    function showComplete(data) {
        const el = $('#mission-complete');
        if (!el) return;

        const title = $('#complete-title');
        const rows  = $('#complete-rewards');
        const total = $('#complete-total');
        const rep   = $('#complete-rep');

        if (title) title.textContent = data.mission ? data.mission.replace(/_/g,' ').toUpperCase() : 'MISSION';

        const reward = data.reward || {};
        if (rows) {
            rows.innerHTML = '';
            const fields = [
                ['Base Pay',           reward.base],
                ['Condition Bonus',    reward.conditionBonus],
                ['Escape Bonus',       reward.escapeBonus],
                ['Reputation Bonus',   reward.reputationBonus],
            ];
            fields.forEach(([label, val]) => {
                if (!val) return;
                const row = document.createElement('div');
                row.className = 'ms-reward-row';
                row.innerHTML = `<span class="ms-reward-row-label">${label}</span>
                    <span class="ms-reward-row-val">+${fmt(val)}</span>`;
                rows.appendChild(row);
            });
        }

        if (total) total.textContent = fmt(reward.total || 0);
        if (rep)   rep.textContent   = '+25 REP';

        const btn = $('#btn-complete');
        if (btn) btn.onclick = () => post('missionCompleteClose', {});

        el.classList.remove('hidden');
    }

    function hideScreen(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }

    function hideAll() {
        ['mission-offer','mission-hud','lockpick','seal-game','mission-complete'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    }

    // ── NUI message router ────────────────────────────────────────
    window.addEventListener('message', (e) => {
        const { action, data } = e.data;
        if (!action) return;
        switch (action) {
            case 'missionOffer':        showOffer(data); break;
            case 'missionOfferHide':    hideOffer(); break;
            case 'hudShow':
                showHUD({ label: 'MISSION', objective: data.objective, sub: data.sub, extra: data.extra });
                break;
            case 'hudUpdate':
                updateHUD({ objective: data.objective, sub: data.sub, extra: data.extra });
                break;
            case 'hudHide':             hideHUD(); break;
            case 'lockpickShow':        showLockpick(); break;
            case 'sealShow':            showSeal(); break;
            case 'missionComplete':     showComplete(data); break;
            case 'hideAll':             hideAll(); break;
        }
    });

    return { showOffer, hideOffer, showHUD, updateHUD, hideHUD, showLockpick, showSeal, showComplete, hideAll };
})();

window.MissionsUI = Missions;
