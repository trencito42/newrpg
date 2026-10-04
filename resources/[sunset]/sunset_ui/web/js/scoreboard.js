const Scoreboard = {
    myId: null,
    active: false,

    escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    factionColor(kind) {
        const root = document.getElementById('scoreboard');
        const style = root ? getComputedStyle(root) : null;
        const pick = (name, fallback) => (style ? style.getPropertyValue(name).trim() : '') || fallback;
        if (kind === 'police') return pick('--fac-police', '#3b82f6');
        if (kind === 'medic') return pick('--fac-medic', '#ef4444');
        if (kind === 'mafia') return pick('--fac-mafia', '#a855f7');
        if (kind === 'mechanic') return pick('--fac-mechanic', '#f97316');
        return pick('--fac-civilian', '#F2EFE8');
    },

    pingColor(ping) {
        const root = document.getElementById('scoreboard');
        const style = root ? getComputedStyle(root) : null;
        const pick = (name, fallback) => (style ? style.getPropertyValue(name).trim() : '') || fallback;
        if (ping > 150) return pick('--ping-bad', '#ef4444');
        if (ping > 80) return pick('--ping-ok', '#f59e0b');
        return pick('--ping-good', '#10b981');
    },

    show(data) {
        data = data || {};
        this.active = true;
        this.myId = Number(data.myId) || this.myId;
        const sb = document.getElementById('scoreboard');
        if (!sb) return;
        sb.classList.add('is-active');
        sb.setAttribute('aria-hidden', 'false');
        document.body.classList.add('scoreboard-open');
        document.getElementById('hud')?.classList.add('scoreboard-open');

        const count = data.count || (data.players || []).length || 0;
        const max = data.max || 100;
        const countDisplay = document.getElementById('sb-count-display');
        if (countDisplay) countDisplay.textContent = `${count}/${max}`;

        const list = document.getElementById('sb-player-list');
        if (!list) return;
        list.innerHTML = '';

        (data.players || []).forEach((player) => {
            const row = document.createElement('div');
            row.className = 'player-row' + (Number(player.id) === Number(this.myId) ? ' is-self' : '');
            const ping = Number(player.ping) || 0;
            const pingColor = this.pingColor(ping);
            const nameColor = this.factionColor(player.faction);
            const identity = window.SunsetPlayerIdentity;
            const playerName = identity
                ? identity.formatNameHtml(Object.assign({}, player, { factionColor: nameColor }), { showId: false })
                : this.escape(player.name || 'Player');
            row.innerHTML = `
                <div class="p-id">${this.escape(player.id)}</div>
                <div class="p-name">${playerName}</div>
                <div class="p-ping" style="color: ${pingColor};">
                    ${this.escape(ping)} <div class="ping-dot" style="background-color: ${pingColor};"></div>
                </div>
            `;
            list.appendChild(row);
        });
    },

    hide() {
        this.active = false;
        const sb = document.getElementById('scoreboard');
        if (sb) {
            sb.classList.remove('is-active');
            sb.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('scoreboard-open');
        document.getElementById('hud')?.classList.remove('scoreboard-open');
    },
};

window.Scoreboard = Scoreboard;
