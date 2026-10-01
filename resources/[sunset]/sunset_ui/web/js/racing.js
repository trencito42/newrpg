/* ═══ STREET RACING — NUI controller ═══ */

const Racing = {
    status: null,
    selectedRoute: null,

    esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    },

    show(data) {
        this.status = data || {};
        this.selectedRoute = null;
        const el = $('#racing-overlay');
        if (!el) return;
        el.classList.remove('hidden');
        this.render();
    },

    hide() {
        const el = $('#racing-overlay');
        if (el) el.classList.add('hidden');
    },

    render() {
        const body = $('#racing-body');
        if (!body) return;

        const routes = this.status.routes || [];
        const inLobby = this.status.inLobby;
        const lobbyInfo = this.status.lobbyInfo;
        const entryFee = this.status.entryFee || 1000;
        const minMulti = this.status.minMultiPlayers || 2;
        const soloReward = this.status.soloReward || 500;
        const soloOnCooldown = this.status.soloOnCooldown;
        const raceNightActive = this.status.raceNightActive;
        const raceNightPoints = this.status.raceNightPoints || 0;

        // Race Night banner
        let banner = '';
        if (raceNightActive) {
            banner = `<div class="racing-banner racing-banner--active">
                <span class="racing-banner__dot"></span>
                RACE NIGHT LIVE — ${raceNightPoints} pts
            </div>`;
        }

        if (inLobby && lobbyInfo) {
            const players = (lobbyInfo.players || []).map((p) =>
                `<span class="racing-lobby-player${p.isSelf ? ' is-self' : ''}">${this.esc(p.name)}</span>`
            ).join('');
            const count = lobbyInfo.count || 0;
            const canStart = count >= minMulti;
            body.innerHTML = `${banner}
                <div class="racing-route is-selected">
                    <div class="racing-route__name">${I18n.t('ui.racing.lobby')} — ${this.esc(lobbyInfo.routeId || '')}</div>
                    <div class="racing-route__meta">
                        <span>${canStart ? I18n.t('ui.racing.ready_to_start') : I18n.t('ui.racing.waiting_for_racers')} — ${count}/${minMulti}</span>
                        <span>${I18n.t('ui.racing.entry', { fee: I18n.number(entryFee) })}</span>
                    </div>
                    <div class="racing-lobby-players">${players}</div>
                </div>
            `;
        } else {
            body.innerHTML = `${banner}
                ${routes.map((r) => `
                    <div class="racing-route" data-racing-route="${this.esc(r.id)}">
                        <div class="racing-route__name">${this.esc(r.label)}</div>
                        <div class="racing-route__desc">${this.esc(r.description || '')}</div>
                        <div class="racing-route__meta">
                            <span>${(r.checkpoints || []).length} CP</span>
                            <span>${I18n.t('ui.racing.route_fees', { solo: I18n.number(soloReward), multi: I18n.number(entryFee) })}</span>
                        </div>
                    </div>
                `).join('')}
                <div class="racing-solo-note">
                    ${soloOnCooldown
                        ? I18n.t('ui.racing.solo_cooldown')
                        : I18n.t('ui.racing.solo_info', { reward: I18n.number(soloReward) })}
                    ${I18n.t('ui.racing.multi_info', { fee: I18n.number(entryFee), pot: I18n.number((entryFee * minMulti * 0.8 | 0)) })}
                </div>
            `;

            $$('[data-racing-route]').forEach((el) => {
                el.addEventListener('click', () => {
                    $$('[data-racing-route]').forEach((e) => e.classList.remove('is-selected'));
                    el.classList.add('is-selected');
                    this.selectedRoute = el.dataset.racingRoute;
                    this._updateButtons();
                });
            });
        }

        this._updateButtons(inLobby, lobbyInfo);
    },

    _updateButtons(inLobby, lobbyInfo) {
        inLobby = inLobby ?? this.status?.inLobby;
        lobbyInfo = lobbyInfo ?? this.status?.lobbyInfo;
        const soloBtn = $('#racing-solo');
        const joinBtn = $('#racing-join');
        const startBtn = $('#racing-start-multi');
        const leaveBtn = $('#racing-leave');

        if (inLobby) {
            const count = lobbyInfo?.count || 0;
            const minMulti = this.status?.minMultiPlayers || 2;
            if (soloBtn) { soloBtn.classList.add('hidden'); soloBtn.disabled = true; }
            if (joinBtn) { joinBtn.classList.add('hidden'); joinBtn.disabled = true; }
            if (startBtn) {
                startBtn.classList.remove('hidden');
                startBtn.disabled = count < minMulti;
                startBtn.textContent = count >= minMulti ? I18n.t('ui.racing.start_race_n', { count, min: minMulti }) : I18n.t('ui.racing.waiting_count', { count, min: minMulti });
            }
            if (leaveBtn) leaveBtn.classList.remove('hidden');
        } else {
            const hasSel = !!this.selectedRoute;
            const cooldown = this.status?.soloOnCooldown;
            if (soloBtn) {
                soloBtn.classList.remove('hidden');
                soloBtn.disabled = !hasSel || cooldown;
                soloBtn.textContent = cooldown ? I18n.t('ui.racing.solo_on_cooldown') : I18n.t('ui.racing.start_solo');
            }
            if (joinBtn) {
                joinBtn.classList.remove('hidden');
                joinBtn.disabled = !hasSel;
            }
            if (startBtn) startBtn.classList.add('hidden');
            if (leaveBtn) leaveBtn.classList.add('hidden');
        }
    },

    // ── Race HUD ──
    showHud(data) {
        let hud = $('#racing-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'racing-hud';
            hud.className = 'racing-hud';
            document.body.appendChild(hud);
        }
        hud.classList.remove('hidden');
        const soloTag = data.isSolo ? ` <span class="racing-hud__solo">${I18n.t('ui.racing.time_trial')}</span>` : '';
        hud.innerHTML = `
            <div class="racing-hud__label">${this.esc(data.label || I18n.t('ui.racing.race'))}${soloTag}</div>
            <div class="racing-hud__progress">${data.currentCheckpoint || 0} / ${data.totalCheckpoints || 0}</div>
        `;
    },

    showCountdown(payload) {
        let hud = $('#racing-hud');
        if (!hud) return;
        const n = typeof payload === 'object' && payload !== null ? (payload.n ?? payload.count ?? '') : payload;
        const existing = hud.querySelector('.racing-hud__countdown');
        if (existing) existing.remove();
        hud.innerHTML += `<div class="racing-hud__countdown">${this.esc(String(n))}</div>`;
    },

    showGo() {
        let hud = $('#racing-hud');
        if (!hud) return;
        const cd = hud.querySelector('.racing-hud__countdown');
        if (cd) cd.remove();
        hud.innerHTML += `<div class="racing-hud__go">${I18n.t('ui.racing.go')}</div>`;
        setTimeout(() => {
            const go = hud.querySelector('.racing-hud__go');
            if (go) go.remove();
        }, 2000);
    },

    showFinished(data) {
        let hud = $('#racing-hud');
        if (!hud) return;
        const pos = data.position || 0;
        const timeStr = data.timeFormatted || '--:--.---';
        hud.innerHTML += `<div class="racing-hud__result">🏁 #${pos} — ${timeStr}</div>`;
        setTimeout(() => this.hideHud(), 8000);
    },

    hideHud() {
        const hud = $('#racing-hud');
        if (hud) hud.classList.add('hidden');
    },
};

window.Racing = Racing;

// ── Close handlers ──
$('#racing-close')?.addEventListener('click', () => post('racingClose'));
$('#racing-solo')?.addEventListener('click', () => {
    if (Racing.selectedRoute) post('racingStartSolo', { routeId: Racing.selectedRoute });
});
$('#racing-join')?.addEventListener('click', () => {
    if (Racing.selectedRoute) post('racingJoin', { routeId: Racing.selectedRoute });
});
$('#racing-start-multi')?.addEventListener('click', () => {
    const lobbyInfo = Racing.status?.lobbyInfo;
    if (lobbyInfo?.routeId) post('racingStartMulti', { routeId: lobbyInfo.routeId });
});
$('#racing-leave')?.addEventListener('click', () => post('racingLeave', {}));
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const overlay = $('#racing-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    e.preventDefault();
    post('racingClose');
}, true);
