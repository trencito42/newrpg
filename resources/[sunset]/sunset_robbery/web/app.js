const $ = (id) => document.getElementById(id);

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
        console.error('[NUI ERROR sunset_robbery]', msg, source, `${line}:${col}`, stack);
    }
    window.onerror = function(msg, source, line, col, error) {
        report('onerror', msg, source, line, col, error?.stack);
    };
    window.addEventListener('unhandledrejection', function(event) {
        report('unhandledrejection', event.reason?.message || String(event.reason), '', 0, 0, event.reason?.stack);
    });
})();

function post(name, data = {}) {
    fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

function money(n) {
    return '$' + I18n.number(Math.max(0, Math.floor(Number(n) || 0)));
}

const Hud = {
    show(data = {}) {
        $('rob-hud').classList.remove('hidden');
        const escaping = data.stage === 'ESCAPING';
        $('rob-hud-stage').textContent = escaping ? tr('ui.robbery.escape', null) : tr('ui.robbery.duffel', null);
        const used = data.bagUsed ?? 0;
        const cap = data.bagCap ?? 12;
        $('rob-hud-bag').textContent = `${used} / ${cap}`;
        $('rob-hud-value').textContent = money(data.estimated);
        if (escaping) {
            const left = Math.max(0, Math.floor(Number(data.escapeLeft) || 0));
            $('rob-hud-response').textContent = left > 0 ? tr('ui.robbery.minutes_out', { minutes: left }) : tr('ui.robbery.clear', null);
        } else {
            const sec = Math.max(0, Number(data.response) || 0);
            $('rob-hud-response').textContent = data.policeAlerted
                ? tr('ui.robbery.live', null)
                : `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
        }
        $('rob-hud-fill').style.width = `${Math.min(100, (used / Math.max(1, cap)) * 100)}%`;
    },
    hide() { $('rob-hud').classList.add('hidden'); },
};

const Hack = {
    timer: null,
    deadline: 0,
    burstDeadline: 0,
    currentNode: null,
    edges: [],
    passed: new Set(),
    clickLocked: false,
    show(data = {}) {
        $('hack').classList.remove('hidden');
        $('hack-trace').textContent = '0%';
        $('hack-trace-fill').style.width = '0%';
        $('hack-status').className = 'hack__status';
        $('hack-status').textContent = tr('dynamic.app.match_the_requested_channel_and_follow_a_connected_line', null, 'MATCH THE REQUESTED CHANNEL AND FOLLOW A CONNECTED LINE');
        this.deadline = performance.now() + ((Number(data.timeLimit) || 34) * 1000);
        this.burstDeadline = 0;
        this.currentNode = data.currentNode || data.sourceId;
        this.edges = Array.isArray(data.edges) ? data.edges : [];
        this.passed = new Set(this.currentNode ? [this.currentNode] : []);
        this.clickLocked = false;
        this.setSignal(data.signal);
        this.tick();
        clearInterval(this.timer);
        this.timer = setInterval(() => this.tick(), 80);
        try {
            this.draw(data.nodes || []);
            this.refreshRoute();
        } catch (e) {
            console.error('[Hack.show draw error]', e);
        }
        post('playSound', { key: 'terminal' });
    },
    tick() {
        const left = Math.max(0, (this.deadline - performance.now()) / 1000);
        $('hack-time').textContent = left.toFixed(1);
        if (left <= 5) $('hack-time').style.color = 'var(--r-red)';
        if (this.burstDeadline > 0) {
            const burst = Math.max(0, (this.burstDeadline - performance.now()) / 1000);
            $('hack-status').textContent = burst > 0
                ? tr('ui.robbery.burst_active', { seconds: burst.toFixed(1) })
                : tr('ui.robbery.burst_expired', null);
        }
    },
    draw(nodes) {
        const board = $('hack-nodes');
        const lines = $('hack-lines');
        board.innerHTML = '';
        lines.innerHTML = '';
        const positions = new Map(nodes.map((node) => [node.id, node]));
        this.edges.forEach((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
            line.setAttribute('class', 'hack-edge');
            line.dataset.from = edge.from;
            line.dataset.to = edge.to;
            lines.appendChild(line);
        });
        nodes.forEach((node) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `hack-node is-${node.kind || 'normal'}`;
            btn.style.left = `${node.x}%`;
            btn.style.top = `${node.y}%`;
            btn.dataset.id = node.id;
            btn.dataset.kind = node.kind || 'normal';
            btn.dataset.frequency = String(node.frequency || 1);
            const channel = `${tr('ui.robbery.ch_short', null)} ${String(node.frequency || 1).padStart(2, '0')}`;
            const type = node.kind === 'locked' ? `${channel} · ${tr('ui.robbery.lock', null)}`
                : (node.kind === 'timed' ? `${channel} · ${tr('ui.robbery.burst', null)}`
                    : (node.kind === 'corrupted' ? tr('ui.robbery.corrupt', null) : `${tr('ui.robbery.ch_short', null)} ${String(node.frequency || 1).padStart(2, '0')}`));
            btn.innerHTML = `${node.label || node.id}<small>${type}</small>`;
            if (node.kind === 'source') btn.classList.add('is-on');
            btn.addEventListener('click', () => {
                if (this.clickLocked || btn.disabled) return;
                this.clickLocked = true;
                setTimeout(() => { this.clickLocked = false; }, 280);
                post('hackClick', { nodeId: node.id });
                post('playSound', { key: 'terminal' });
            });
            board.appendChild(btn);
        });
    },
    setSignal(signal) {
        $('hack-signal').textContent = signal ? `${tr('ui.robbery.ch_short', null)} ${String(signal).padStart(2, '0')}` : tr('ui.robbery.core_open', null);
    },
    refreshRoute() {
        const available = new Set(this.edges.filter((edge) => edge.from === this.currentNode).map((edge) => edge.to));
        document.querySelectorAll('.hack-node').forEach((node) => {
            const active = available.has(node.dataset.id);
            const passed = this.passed.has(node.dataset.id);
            node.disabled = !active;
            node.classList.toggle('is-available', active);
            node.classList.toggle('is-offroute', !active && !passed);
            node.classList.toggle('is-on', passed);
            if (!active) node.classList.remove('is-armed');
        });
        document.querySelectorAll('.hack-edge').forEach((edge) => {
            edge.classList.toggle('is-live', edge.dataset.from === this.currentNode);
            edge.classList.toggle('is-passed', this.passed.has(edge.dataset.from) && this.passed.has(edge.dataset.to));
        });
    },
    progress(data = {}) {
        const trace = Math.min(100, Number(data.trace) || 0);
        $('hack-trace').textContent = `${trace}%`;
        $('hack-trace-fill').style.width = `${trace}%`;
        const status = $('hack-status');
        status.textContent = data.status || tr('ui.robbery.signal_accepted', null);
        status.classList.toggle('is-alert', Boolean(data.errorNode));
        status.classList.toggle('is-burst', Boolean(data.burstMs) && !data.lockArmed);
        this.setSignal(data.signal);
        if (data.burstMs && !data.lockArmed) this.burstDeadline = performance.now() + Number(data.burstMs);
        else if (!data.lockArmed) this.burstDeadline = 0;
        if (data.errorNode) {
            const bad = document.querySelector(`[data-id="${data.errorNode}"]`);
            if (bad) {
                bad.classList.add('is-error');
                setTimeout(() => bad.classList.remove('is-error'), 380);
            }
        }
        if (data.lockArmed && data.nodeId) {
            const armed = document.querySelector(`[data-id="${data.nodeId}"]`);
            if (armed) armed.classList.add('is-armed');
            return;
        }
        if (data.nodeId) {
            this.passed.add(data.nodeId);
            this.currentNode = data.currentNode || data.nodeId;
            this.refreshRoute();
        }
    },
    hide() {
        clearInterval(this.timer);
        this.burstDeadline = 0;
        $('hack-time').style.color = '';
        $('hack').classList.add('hidden');
    },
};

const Loot = {
    displayId: null,
    items: [],
    bagUsed: 0,
    bagCap: 12,
    estimated: 0,
    selectedUids: new Set(),
    timerInterval: null,
    timeLeft: 270,

    getIconHtml(item) {
        const id = String(item.item || item.id || '').trim();
        const family = String(item.family || '').toLowerCase();
        let fallback = 'stolen_silver_watch';
        if (family.includes('gold')) fallback = 'stolen_gold_chain';
        else if (family.includes('jewel')) fallback = 'stolen_diamond_jewelry';
        else if (family.includes('cash')) fallback = 'cash_stack';
        const itemImg = id || fallback;
        return `<img src="nui://sunset_ui/web/assets/items/${itemImg}.webp" onerror="this.onerror=null; this.src='nui://sunset_ui/web/assets/items/${fallback}.webp';" alt="${item.label || itemImg}" />`;
    },

    show(data = {}) {
        this.displayId = data.displayId;
        this.items = Array.isArray(data.items) ? data.items : [];
        this.bagUsed = Number(data.bagUsed) || 0;
        this.bagCap = Math.max(1, Number(data.bagCap) || 12);
        this.estimated = Number(data.estimated) || 0;
        this.selectedUids.clear();

        const wrapper = $('robbery-wrapper');
        if (!wrapper) return;
        wrapper.classList.remove('hidden');
        wrapper.classList.add('visible');

        const title = $('ui-rob-title');
        if (title) title.textContent = (data.locationTitle || data.label || tr('ui.robbery.display', null, 'PACIFIC STANDARD BANK')).toUpperCase();
        const subtitle = $('ui-rob-subtitle');
        if (subtitle) subtitle.textContent = (data.label || tr('ui.robbery.vault_access', null, 'Seif Principal / Acces Acordat')).toUpperCase();

        const maxWgtEl = $('ui-max-wgt');
        if (maxWgtEl) maxWgtEl.textContent = this.bagCap.toFixed(1);

        this.renderLootGrid();
        this.calculateTotals();
        this.startTimer(data.responseSeconds || 270);
    },

    startTimer(seconds) {
        clearInterval(this.timerInterval);
        this.timeLeft = Math.max(0, Math.floor(Number(seconds) || 270));
        const update = () => {
            const timerEl = $('ui-timer');
            if (!timerEl) return;
            const m = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
            const s = (this.timeLeft % 60).toString().padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        };
        update();
        this.timerInterval = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                update();
            }
        }, 1000);
    },

    renderLootGrid() {
        const grid = $('ui-loot-grid');
        if (!grid) return;
        grid.innerHTML = '';

        this.items.forEach((item) => {
            const isSelected = this.selectedUids.has(item.uid);
            const isTaken = Boolean(item.taken);
            const card = document.createElement('div');
            card.className = `loot-card ${isSelected ? 'selected' : ''} ${isTaken ? 'is-taken' : ''}`;
            card.dataset.uid = item.uid;

            const timeSec = item.skill ? '45s' : '15s';
            const weight = Number(item.weight || 1).toFixed(1);

            card.innerHTML = `
                <div class="check-icon"></div>
                <div class="loot-icon">${this.getIconHtml(item)}</div>
                <div class="loot-name">${item.label || item.item}</div>
                <div class="loot-details">
                    <span>Timp Colectare: <span style="color: var(--brand-primary); font-weight: 700;">~${timeSec}</span></span>
                    <span>Valoare: <span class="val-text">${money(item.baseValue || 0)}</span></span>
                    <span>Greutate: <span class="wgt-text">${weight} KG</span></span>
                </div>
            `;

            card.addEventListener('click', () => {
                if (isTaken) return;
                this.toggleLoot(item.uid);
            });

            grid.appendChild(card);
        });
    },

    toggleLoot(uid) {
        if (this.selectedUids.has(uid)) {
            this.selectedUids.delete(uid);
        } else {
            this.selectedUids.add(uid);
        }
        this.renderLootGrid();
        this.calculateTotals();
    },

    calculateTotals() {
        let selectedVal = 0;
        let selectedWgt = 0;

        this.selectedUids.forEach((uid) => {
            const item = this.items.find((x) => x.uid === uid);
            if (item) {
                selectedVal += Number(item.baseValue || 0);
                selectedWgt += Number(item.weight || 1);
            }
        });

        const totalVal = this.estimated + selectedVal;
        const totalWgt = this.bagUsed + selectedWgt;

        const valEl = $('ui-total-val');
        if (valEl) valEl.textContent = money(totalVal);
        const wgtEl = $('ui-total-wgt');
        if (wgtEl) wgtEl.textContent = totalWgt.toFixed(1);

        const pct = Math.max(0, Math.min(100, (totalWgt / this.bagCap) * 100));
        const barFill = $('ui-wgt-bar');
        const warnEl = $('ui-wgt-warn');
        const btn = $('btn-confirm');

        if (barFill) barFill.style.width = `${pct}%`;

        if (totalWgt > this.bagCap) {
            barFill?.classList.add('overload');
            if (warnEl) warnEl.style.display = 'block';
            if (btn) {
                btn.className = 'btn-start error';
                btn.textContent = 'RUCSAC SUPRAÎNCĂRCAT';
            }
        } else if (this.selectedUids.size > 0) {
            barFill?.classList.remove('overload');
            if (warnEl) warnEl.style.display = 'none';
            if (btn) {
                btn.className = 'btn-start ready';
                btn.textContent = `Începe Colectarea (${this.selectedUids.size})`;
            }
        } else {
            barFill?.classList.remove('overload');
            if (warnEl) warnEl.style.display = 'none';
            if (btn) {
                btn.className = 'btn-start';
                btn.textContent = 'Selectează prada';
            }
        }
    },

    startRobbery() {
        if (this.selectedUids.size === 0) return;
        let selectedWgt = 0;
        this.selectedUids.forEach((uid) => {
            const item = this.items.find((x) => x.uid === uid);
            if (item) selectedWgt += Number(item.weight || 1);
        });
        if (this.bagUsed + selectedWgt > this.bagCap) return;

        const uids = Array.from(this.selectedUids);
        uids.forEach((uid, index) => {
            setTimeout(() => {
                post('lootTake', { displayId: this.displayId, uid });
            }, index * 100);
        });
        this.selectedUids.clear();
        this.calculateTotals();
    },

    taken(data = {}) {
        this.bagUsed = Number(data.bagUsed ?? this.bagUsed);
        this.bagCap = Number(data.bagCap ?? this.bagCap);
        this.estimated = Number(data.estimated ?? this.estimated);

        const item = this.items.find((x) => x.uid === data.uid);
        if (item) item.taken = true;
        this.selectedUids.delete(data.uid);

        this.renderLootGrid();
        this.calculateTotals();
    },

    hide() {
        clearInterval(this.timerInterval);
        const wrapper = $('robbery-wrapper');
        if (wrapper) {
            wrapper.classList.remove('visible');
            wrapper.classList.add('hidden');
        }
    },
};

const Fence = {
    show(data = {}) {
        $('fence').classList.remove('hidden');
        const list = $('fence-list');
        list.innerHTML = '';
        const offers = data.offers || [];
        if (!offers.length) {
            list.innerHTML = `<div class="fence-row">${tr('ui.robbery.nothing_stolen', null)}</div>`;
            return;
        }
        offers.forEach((row) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fence-row';
            btn.innerHTML = `${row.label} ×${row.count}<small>${tr('ui.robbery.street_offer', { street: money(row.street), offer: money(row.offer) })}</small>`;
            btn.addEventListener('click', () => post('fenceSell', { offerId: row.offerId }));
            list.appendChild(btn);
        });
    },
    hide() { $('fence').classList.add('hidden'); },
};

$('btn-confirm')?.addEventListener('click', () => Loot.startRobbery());
$('btn-leave-robbery')?.addEventListener('click', () => post('lootClose'));
$('fence-leave')?.addEventListener('click', () => post('fenceClose'));

window.addEventListener('message', (event) => {
    const { action, data } = event.data || {};
    switch (action) {
        case 'hackShow': Hack.show(data); break;
        case 'hackProgress': Hack.progress(data); break;
        case 'hackHide': Hack.hide(); break;
        case 'lootShow': Loot.show(data); break;
        case 'lootTaken': Loot.taken(data); break;
        case 'lootHide': Loot.hide(); break;
        case 'hudShow': Hud.show(data); break;
        case 'hudHide': Hud.hide(); break;
        case 'fenceShow': Fence.show(data); break;
        case 'fenceHide': Fence.hide(); break;
        default: break;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('hack').classList.contains('hidden')) post('hackClose');
    if ($('robbery-wrapper')?.classList.contains('visible') || !$('robbery-wrapper')?.classList.contains('hidden')) post('lootClose');
    if (!$('fence').classList.contains('hidden')) post('fenceClose');
});
