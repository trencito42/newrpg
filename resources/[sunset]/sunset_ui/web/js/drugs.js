/* ═══ DRUG PIPELINE — NUI controller ═══ */

const Drugs = {
    mode: null,
    index: null,      // world interaction index (spot/lab/dealer) — authoritative for posts
    status: null,
    busy: false,

    esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    },

    show(data) {
        this.mode = data?.mode || 'harvest';
        this.index = Number(data?.index) || null;
        this.status = data?.status || {};
        this.busy = false;
        const el = $('#drugs-overlay');
        if (!el) return;
        el.classList.remove('hidden');
        this.render();
    },

    hide() {
        const el = $('#drugs-overlay');
        if (el) el.classList.add('hidden');
        this.busy = false;
        this.hideProgress();
    },

    update(data) {
        this.status = data?.status || this.status;
        this.render();
    },

    setBusy(busy) {
        this.busy = !!busy;
        // Disable every action button while an action is in flight (UX lock;
        // the server enforces the real lock).
        document.querySelectorAll('#drugs-body .drugs-btn').forEach((btn) => {
            btn.disabled = this.busy || btn.dataset.drugsDisabled === '1';
        });
    },

    showProgress(data) {
        if (data?.hide) return this.hideProgress();
        let bar = $('#drugs-progress');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'drugs-progress';
            bar.className = 'drugs-progress';
            bar.innerHTML = '<div class="drugs-progress__label"></div><div class="drugs-progress__track"><div class="drugs-progress__fill"></div></div>';
            document.body.appendChild(bar);
        }
        bar.classList.remove('hidden');
        const label = bar.querySelector('.drugs-progress__label');
        const fill = bar.querySelector('.drugs-progress__fill');
        if (label) label.textContent = data.label || 'Working...';
        if (fill) {
            fill.style.transition = 'none';
            fill.style.width = '0%';
            // next frame: animate to 100% over durationMs
            requestAnimationFrame(() => {
                fill.style.transition = `width ${(Number(data.durationMs) || 5000)}ms linear`;
                fill.style.width = '100%';
            });
        }
    },

    hideProgress() {
        const bar = $('#drugs-progress');
        if (bar) bar.classList.add('hidden');
    },

    render() {
        const body = $('#drugs-body');
        const title = $('#drugs-title');
        const sub = $('#drugs-sub');
        if (!body) return;

        const modeNames = { harvest: I18n.t('ui.drugs.mode_harvest'), process: I18n.t('ui.drugs.mode_process'), sell: I18n.t('ui.drugs.mode_sell') };
        if (title) title.textContent = modeNames[this.mode] || I18n.t('ui.drugs.title');

        const drugs = this.status.drugs || {};
        const entries = Object.entries(drugs);
        if (!entries.length) {
            body.innerHTML = `<div style="text-align:center;padding:30px;color:rgba(255,245,235,0.35);">${I18n.t('ui.drugs.no_data')}</div>`;
            return;
        }

        if (this.mode === 'harvest') {
            // [OPTION A] This spot grows exactly ONE drug (server-derived).
            // The UI shows only that drug — no fake per-drug buttons.
            const spotInfo = (this.status.spots || [])[this.index] || {};
            const spotDrug = spotInfo.drug;
            const drug = spotDrug ? drugs[spotDrug] : null;
            if (sub) sub.textContent = spotInfo.label
                ? I18n.t('ui.drugs.field_named', { label: this.esc(spotInfo.label) })
                : I18n.t('ui.drugs.pick_raw');
            if (!drug) {
                body.innerHTML = `<div style="text-align:center;padding:30px;color:rgba(255,245,235,0.35);">${I18n.t('ui.drugs.nothing_to_harvest')}</div>`;
                return;
            }
            body.innerHTML = `
                <div class="drugs-drug">
                    <div class="drugs-drug__name">${this.esc(drug.rawLabel || drug.label)}</div>
                    <div class="drugs-drug__meta"><span>${I18n.t('ui.drugs.you_have', { count: drug.rawCount })}</span></div>
                    <div class="drugs-drug__actions">
                        <button type="button" class="drugs-btn" data-drugs-harvest="1">${I18n.t('ui.drugs.harvest_5s')}</button>
                    </div>
                </div>`;
        } else if (this.mode === 'process') {
            if (sub) sub.textContent = I18n.t('dynamic.drugs.convert_raw_materials_into_product');
            body.innerHTML = entries.map(([type, d]) => {
                const ratio = this.status.ratio || 2;
                const canProcess = d.rawCount >= ratio;
                return `
                <div class="drugs-drug">
                    <div class="drugs-drug__name">${this.esc(d.label)}</div>
                    <div class="drugs-drug__meta">
                        <span>${this.esc(d.rawLabel || d.label)}: ${d.rawCount}x</span>
                        <span>${this.esc(d.productLabel || d.label)}: ${d.productCount}x</span>
                    </div>
                    <div class="drugs-drug__actions">
                        <button type="button" class="drugs-btn drugs-btn--process" data-drugs-process="${this.esc(type)}" data-drugs-disabled="${canProcess ? '0' : '1'}" ${canProcess && !this.busy ? '' : 'disabled'}>Process ${ratio} → 1 (8s)</button>
                    </div>
                </div>`;
            }).join('');
        } else {
            // SELL — show price RANGE (server randomizes 0.8–1.3x base).
            const variance = this.status.priceVariance || { min: 0.8, max: 1.3 };
            const maxAmount = this.status.maxSellAmount || 10;
            if (sub) sub.textContent = I18n.t('dynamic.drugs.sell_your_product_market_price_varies');
            body.innerHTML = entries.map(([type, d]) => {
                const lo = Math.floor(d.basePrice * variance.min);
                const hi = Math.floor(d.basePrice * variance.max);
                const count = Math.min(d.productCount, maxAmount);
                const canSell = d.productCount > 0;
                let amountRow = '';
                if (canSell) {
                    const opts = [];
                    for (let n = 1; n <= count; n++) opts.push(`<option value="${n}">${n}</option>`);
                    amountRow = `<select class="drugs-amount" data-drugs-amount="${this.esc(type)}">${opts.join('')}</select>`;
                }
                return `
                <div class="drugs-drug">
                    <div class="drugs-drug__name">${this.esc(d.productLabel || d.label)}</div>
                    <div class="drugs-drug__meta">
                        <span>${I18n.t('ui.drugs.you_have', { count: d.productCount })}</span>
                        <span>${I18n.t('ui.drugs.est_each', { lo: I18n.number(lo), hi: I18n.number(hi) })}</span>
                    </div>
                    <div class="drugs-drug__actions">
                        ${amountRow}
                        <button type="button" class="drugs-btn drugs-btn--sell" data-drugs-sell="${this.esc(type)}" data-drugs-disabled="${canSell ? '0' : '1'}" ${canSell && !this.busy ? '' : 'disabled'}>${I18n.t('ui.drugs.sell')}</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Harvest posts the REAL world interaction index (Lua overrides with
        // currentIndex anyway — the server validates regardless).
        $$('[data-drugs-harvest]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (this.busy) return;
                post('drugsHarvest', { spotIndex: this.index || null });
            });
        });
        $$('[data-drugs-process]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (this.busy) return;
                post('drugsProcess', { drugType: btn.dataset.drugsProcess });
            });
        });
        $$('[data-drugs-sell]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (this.busy) return;
                const type = btn.dataset.drugsSell;
                const sel = document.querySelector(`[data-drugs-amount="${CSS.escape(type)}"]`);
                const amount = sel ? Number(sel.value) || 1 : 1;
                post('drugsSell', { drugType: type, amount });
            });
        });
    },
};

window.Drugs = Drugs;

// ── Close handlers ──
$('#drugs-close')?.addEventListener('click', () => post('drugsClose'));
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const overlay = $('#drugs-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    e.preventDefault();
    post('drugsClose');
}, true);
