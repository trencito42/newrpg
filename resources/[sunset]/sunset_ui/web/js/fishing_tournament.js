/* ═══════════════════════════════════════════════════════════════
   SUNSETMP — Fishing Tournament HUD & Results Controller (fishing_tournament.js)
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const FishingTournament = {
        _hud: null,
        _results: null,
        _timerInterval: null,
        _remainingSec: 0,
        _resultsTimeout: null,

        init() {
            if (this._hud) return;
            this._hud = document.getElementById('fishing-tournament-hud');
            this._results = document.getElementById('fishing-tournament-results');

            const closeBtn = document.getElementById('ft-results-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideResults();
                    if (typeof post === 'function') {
                        post('fishingTournamentDismissResults', {});
                    }
                });
            }
        },

        showHud(data = {}) {
            this.init();
            if (!this._hud) return;
            this._hud.classList.remove('hidden');
            this.updateHud(data);
        },

        updateHud(data = {}) {
            this.init();
            if (!this._hud) return;

            const rankEl = document.getElementById('ft-hud-rank');
            const weightEl = document.getElementById('ft-hud-weight');
            const qualEl = document.getElementById('ft-hud-qual');
            const leaderEl = document.getElementById('ft-hud-leader');
            const biggestEl = document.getElementById('ft-hud-biggest');
            const catchesEl = document.getElementById('ft-hud-catches');
            const boardEl = document.getElementById('ft-hud-board');

            if (rankEl) {
                rankEl.textContent = data.rank ? `#${data.rank}` : '#--';
            }
            if (weightEl) {
                const kg = typeof data.totalWeight === 'number' ? data.totalWeight.toFixed(1) : '0.0';
                weightEl.innerHTML = `${kg} <span class="ft-hud__unit">KG</span>`;
            }
            if (qualEl) {
                if (data.qualified) {
                    qualEl.textContent = I18n.t('dynamic.fishing_tournament.qualified');
                    qualEl.className = 'ft-hud__qual-badge qualified';
                } else {
                    const count = data.fishCount || 0;
                    const min = data.minFish || 3;
                    qualEl.textContent = `${count} / ${min} fish`;
                    qualEl.className = 'ft-hud__qual-badge unqualified';
                }
            }
            if (leaderEl) {
                if (data.leaderName) {
                    const lkg = typeof data.leaderWeight === 'number' ? data.leaderWeight.toFixed(1) : '0.0';
                    leaderEl.textContent = I18n.t('dynamic.fishing_tournament.leader_value0_value1_kg', { value0: data.leaderName, value1: lkg });
                } else {
                    leaderEl.textContent = I18n.t('dynamic.fishing_tournament.leader');
                }
            }
            if (biggestEl) {
                if (data.biggestFish && data.biggestFish.weight > 0) {
                    biggestEl.textContent = I18n.t('dynamic.fishing_tournament.biggest_value0_kg', { value0: data.biggestFish.weight.toFixed(1) });
                } else {
                    biggestEl.textContent = I18n.t('dynamic.fishing_tournament.biggest');
                }
            }
            if (catchesEl) {
                catchesEl.textContent = `${data.fishCount || 0} fish`;
            }

            // Timer
            if (typeof data.remaining === 'number') {
                this._remainingSec = Math.max(0, Math.floor(data.remaining));
                this._updateTimerDisplay();
                if (!this._timerInterval) {
                    this._timerInterval = setInterval(() => {
                        this._remainingSec = Math.max(0, this._remainingSec - 1);
                        this._updateTimerDisplay();
                    }, 1000);
                }
            }

            // Mini Leaderboard (Top 5)
            if (boardEl && Array.isArray(data.leaderboard)) {
                boardEl.innerHTML = '';
                data.leaderboard.slice(0, 5).forEach((entry, i) => {
                    const row = document.createElement('div');
                    const isMe = entry.isMe || (data.charId && entry.charId === data.charId);
                    row.className = `ft-hud__board-row ${isMe ? 'is-me' : ''}`;
                    const eKg = typeof entry.totalWeight === 'number' ? entry.totalWeight.toFixed(1) : '0.0';
                    row.innerHTML = `
                        <span class="ft-hud__board-rank">#${i + 1}</span>
                        <span class="ft-hud__board-name">${escapeHtml(entry.name)}</span>
                        <span class="ft-hud__board-kg">${eKg} kg</span>
                    `;
                    boardEl.appendChild(row);
                });
            }
        },

        _updateTimerDisplay() {
            const timerEl = document.getElementById('ft-hud-timer');
            if (!timerEl) return;
            const m = Math.floor(this._remainingSec / 60);
            const s = this._remainingSec % 60;
            timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        },

        hideHud() {
            if (this._timerInterval) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
            }
            if (this._hud) this._hud.classList.add('hidden');
        },

        catchFeedback(data = {}) {
            this.init();
            if (!this._hud) return;
            const toast = document.createElement('div');
            toast.className = 'ft-hud__catch-toast';
            const w = typeof data.weight === 'number' ? data.weight.toFixed(1) : '0.0';
            toast.textContent = `+${w} KG`;
            this._hud.appendChild(toast);
            setTimeout(() => toast.remove(), 1800);
        },

        showResults(data = {}) {
            this.init();
            if (!this._results) return;
            this.hideHud();
            this._results.classList.remove('hidden');

            const podiumEl = document.getElementById('ft-podium');
            const userEl = document.getElementById('ft-user-result');
            const subEl = document.getElementById('ft-results-sub');

            if (subEl) subEl.textContent = data.instanceLabel || 'Tournament Concluded';

            if (podiumEl) {
                podiumEl.innerHTML = '';
                const winners = data.winners || [];
                if (winners.length === 0) {
                    podiumEl.innerHTML = '<div class="ft-no-winners">No players caught enough fish to qualify.</div>';
                } else {
                    winners.forEach((w) => {
                        const card = document.createElement('div');
                        card.className = `ft-podium-card ft-rank-${w.rank}`;
                        const wKg = typeof w.totalWeight === 'number' ? w.totalWeight.toFixed(1) : '0.0';
                        card.innerHTML = `
                            <div class="ft-podium-rank">#${w.rank}</div>
                            <div class="ft-podium-name">${escapeHtml(w.name)}</div>
                            <div class="ft-podium-weight">${wKg} KG</div>
                            <div class="ft-podium-fish">${w.fishCount || 0} fish</div>
                            ${w.rewardCash ? `<div class="ft-podium-reward">+$${w.rewardCash.toLocaleString()}</div>` : ''}
                        `;
                        podiumEl.appendChild(card);
                    });
                }
            }

            if (userEl) {
                if (data.myResult) {
                    const res = data.myResult;
                    const mKg = typeof res.totalWeight === 'number' ? res.totalWeight.toFixed(1) : '0.0';
                    userEl.innerHTML = `
                        <div class="ft-user-box ${res.rank <= 3 && res.qualified ? 'is-winner' : ''}">
                            <div class="ft-user-badge">YOUR RESULT</div>
                            <div class="ft-user-rank">${res.qualified ? `#${res.rank}` : 'NOT QUALIFIED'}</div>
                            <div class="ft-user-stats">${mKg} KG total · ${res.fishCount || 0} fish</div>
                            ${res.rewardCash ? `<div class="ft-user-prize">Reward: $${res.rewardCash.toLocaleString()} + ${res.rewardXp || 0} XP</div>` : ''}
                        </div>
                    `;
                } else {
                    userEl.innerHTML = '';
                }
            }

            if (this._resultsTimeout) clearTimeout(this._resultsTimeout);
            this._resultsTimeout = setTimeout(() => {
                this.hideResults();
            }, 14000);
        },

        hideResults() {
            if (this._resultsTimeout) clearTimeout(this._resultsTimeout);
            this._resultsTimeout = null;
            if (this._results) this._results.classList.add('hidden');
        }
    };

    window.FishingTournament = FishingTournament;
})();
