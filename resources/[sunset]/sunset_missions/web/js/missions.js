'use strict';

// Safe translation helper
function tr(key, params, fallback) {
    try {
        if (window.I18n?.t) {
            const res = window.I18n.t(key, params);
            if (res && res !== key) return res;
        }
    } catch (_) {}
    return (typeof fallback === 'string' ? fallback : null) || key;
}

if (!window.I18n) {
    window.I18n = {
        t: (k, p) => tr(k, p, k),
        getLocale: () => 'en',
        translateTree: () => {},
    };
}

(function setupNuiDiagnostics() {
    let lastError = '';
    function report(type, msg, source, line, col, stack) {
        const sig = `${msg}:${source}:${line}:${col}`;
        if (sig === lastError) return;
        lastError = sig;
        console.error('[NUI ERROR sunset_missions]', msg, source, `${line}:${col}`, stack);
    }
    window.onerror = function(msg, source, line, col, error) {
        report('onerror', msg, source, line, col, error?.stack);
    };
    window.addEventListener('unhandledrejection', function(event) {
        report('unhandledrejection', event.reason?.message || String(event.reason), '', 0, 0, event.reason?.stack);
    });
})();

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

    function fmt(n) { return '$' + I18n.number(Number(n)); }
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
        if (hdr) hdr.textContent = (data.contact ? data.contact + ' — ' : '') + I18n.t('ui.missions.mission_offer');

        // Logo
        const logo = $('#offer-logo');
        if (logo) {
            if (data.logo) {
                logo.src = `assets/${data.logo}`;
                logo.classList.remove('hidden');
            } else {
                logo.classList.add('hidden');
            }
        }

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
            if (cdVal) cdVal.textContent = I18n.t('ui.missions.cooldown_remaining', { time: fmtTime(data.cooldown) });
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
                    row.innerHTML = I18n.t('dynamic.missions.condition_value1', { value0: col, value1: pct });
                    ext.appendChild(row);
                }
                if (data.extra.plate) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = I18n.t('dynamic.missions.plate_value0', { value0: data.extra.plate });
                    ext.appendChild(row);
                }
                if (data.extra.color) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = I18n.t('dynamic.missions.color_value0', { value0: data.extra.color });
                    ext.appendChild(row);
                }
                if (data.extra.row) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = I18n.t('dynamic.missions.row_value0', { value0: data.extra.row });
                    ext.appendChild(row);
                }
                if (data.extra.id) {
                    const row = document.createElement('div');
                    row.className = 'ms-hud-extra';
                    row.innerHTML = I18n.t('dynamic.missions.container_value0', { value0: data.extra.id });
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
        const xp = data.xp || reward.xp || 0;
        const rows = $('#complete-rewards');
        if (rows) {
            rows.innerHTML = '';
            [
                [I18n.t('ui.missions.base_pay'),         reward.base],
                [I18n.t('ui.missions.condition_bonus'),  reward.conditionBonus],
                [I18n.t('ui.missions.escape_bonus'),     reward.escapeBonus],
                [I18n.t('ui.missions.reputation_bonus'), reward.reputationBonus],
            ].forEach(([label, val]) => {
                if (!val) return;
                const row = document.createElement('div');
                row.className = 'ms-complete-row';
                row.innerHTML = `<span class="ms-complete-row-label">${label}</span>
                    <span class="ms-complete-row-val positive">+${fmt(val)}</span>`;
                rows.appendChild(row);
            });
            if (xp > 0) {
                const xpRow = document.createElement('div');
                xpRow.className = 'ms-complete-row';
                xpRow.innerHTML = `<span class="ms-complete-row-label">XP</span>
                    <span class="ms-complete-row-val positive">+${xp} XP</span>`;
                rows.appendChild(xpRow);
            }
        }

        const total = $('#complete-total');
        if (total) total.textContent = fmt(reward.total || 0);

        const rep = $('#complete-rep');
        if (rep) rep.textContent = I18n.t('ui.missions.rep_with_contact', { rep: 25 });

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
