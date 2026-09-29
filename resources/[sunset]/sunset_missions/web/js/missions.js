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

    function fmt(n) { return '$' + Number(n).toLocaleString('en-US'); }
    function fmtTime(sec) {
        if (sec < 60) return `${sec}s`;
        return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    }

    // ── Mission Offer ─────────────────────────────────────────────
    function showOffer(data) {
        const el = $('#mission-offer');
        if (!el) return;

        // Panel header: "RICO — MISSION OFFER"
        const hdr = $('#offer-contact-label');
        if (hdr) hdr.textContent = (data.contact ? data.contact + ' — ' : '') + 'MISSION OFFER';

        // Large mission name
        const mn = $('#offer-mission-name');
        if (mn) mn.textContent = data.label || '';

        // Area
        const areaRow = $('#offer-area-row');
        const areaVal = $('#offer-area');
        if (data.area) {
            if (areaVal) areaVal.textContent = data.area;
            if (areaRow) areaRow.style.display = '';
        } else {
            if (areaRow) areaRow.style.display = 'none';
        }

        // Payout
        const payout = $('#offer-payout');
        if (payout) payout.textContent = data.rewards
            ? `${fmt(data.rewards.min)} — ${fmt(data.rewards.max)}`
            : '';

        // Rep
        const repRow = $('#offer-rep-row');
        const repVal = $('#offer-rep');
        if (data.stats && data.stats.rep !== undefined) {
            if (repVal) repVal.textContent = data.stats.rep + ' REP';
            if (repRow) repRow.style.display = '';
        } else {
            if (repRow) repRow.style.display = 'none';
        }

        // Cooldown
        const cdRow = $('#offer-cooldown-row');
        const cdVal = $('#offer-cooldown');
        const acceptBtn = $('#btn-accept');
        if (data.cooldown && data.cooldown > 0) {
            if (cdVal) cdVal.textContent = fmtTime(data.cooldown) + ' remaining';
            if (cdRow) cdRow.classList.remove('hidden');
            if (acceptBtn) { acceptBtn.disabled = true; acceptBtn.style.opacity = '0.35'; }
        } else {
            if (cdRow) cdRow.classList.add('hidden');
            if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.style.opacity = ''; }
        }

        // Buttons
        const acc = $('#btn-accept');
        const dec = $('#btn-decline');
        if (acc) acc.onclick = () => { post('missionAccept', { missionId: data.missionId }); };
        if (dec) dec.onclick = () => { post('missionDecline', {}); };

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
        if (data.objective !== undefined) {
            const obj = $('#hud-objective');
            if (obj && data.objective !== null) obj.textContent = data.objective;
        }
        if (data.sub !== undefined) {
            const sub = $('#hud-sub');
            if (sub) sub.textContent = data.sub || '';
        }
        if (data.extra) {
            const ext = $('#hud-extras');
            if (ext) {
                // rebuild extras
                ext.innerHTML = '';
                if (data.extra.condition !== undefined) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    const pct = data.extra.condition;
                    const col = pct > 60 ? '#00ffcc' : pct > 30 ? '#fbbf24' : '#f87171';
                    row.innerHTML = `CONDITION <span style="color:${col}">${pct}%</span>`;
                    ext.appendChild(row);
                }
                if (data.extra.plate) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = `PLATE <span>${data.extra.plate}</span>`;
                    ext.appendChild(row);
                }
                if (data.extra.color) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = `COLOR <span>${data.extra.color}</span>`;
                    ext.appendChild(row);
                }
                if (data.extra.row) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = `ROW <span>${data.extra.row}</span>`;
                    ext.appendChild(row);
                }
                if (data.extra.id) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = `CONTAINER <span>${data.extra.id}</span>`;
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

        const missionName = $('#complete-mission-name');
        if (missionName) missionName.textContent = data.mission
            ? data.mission.replace(/_/g, ' ').toUpperCase() : '';

        const reward = (data.reward) || {};
        const rows = $('#complete-rewards');
        if (rows) {
            rows.innerHTML = '';
            [
                ['Base Pay',         reward.base],
                ['Condition Bonus',  reward.conditionBonus],
                ['Escape Bonus',     reward.escapeBonus],
                ['Reputation Bonus', reward.reputationBonus],
            ].forEach(([label, val]) => {
                if (!val) return;
                const row = document.createElement('div');
                row.className = 'ms-complete-row';
                row.innerHTML = `<span class="ms-complete-row-label">${label}</span>
                    <span class="ms-complete-row-val positive">+${fmt(val)}</span>`;
                rows.appendChild(row);
            });
        }

        const total = $('#complete-total');
        if (total) total.textContent = fmt(reward.total || 0);

        const rep = $('#complete-rep');
        if (rep) rep.textContent = '+25 REP with contact';

        const btn = $('#btn-complete');
        if (btn) btn.onclick = () => post('missionCompleteClose', {});

        el.classList.remove('hidden');
    }

    function hideScreen(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    }

    function hideAll() {
        ['mission-offer', 'mission-hud', 'lockpick', 'seal-game', 'mission-complete']
            .forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); });
    }

    // ── NUI message router ────────────────────────────────────────
    window.addEventListener('message', (e) => {
        const { action, data } = e.data;
        if (!action) return;
        switch (action) {
            case 'missionOffer':     showOffer(data);   break;
            case 'missionOfferHide': hideOffer();       break;
            case 'hudShow':          showHUD(data);     break;
            case 'hudUpdate':        updateHUD(data);   break;
            case 'hudHide':          hideHUD();         break;
            case 'lockpickShow':     showLockpick();    break;
            case 'sealShow':         showSeal();        break;
            case 'missionComplete':  showComplete(data); break;
            case 'hideAll':          hideAll();         break;
        }
    });

    return { showOffer, hideOffer, showHUD, updateHUD, hideHUD, showLockpick, showSeal, showComplete, hideAll };
})();

window.MissionsUI = Missions;
