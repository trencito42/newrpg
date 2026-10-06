const Menu = {
    activeTab: 'player',
    selectedVehicleId: null,
    openEcuVehicleId: null,

    init() {
        if (this._ready) return;
        this._ready = true;

        $('#menu-close-btn')?.addEventListener('click', () => this.close());

        $$('.menu-tab').forEach((tab) => {
            tab.addEventListener('click', () => this.setTab(tab.dataset.tab));
        });

        $$('.menu-action').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                if (btn.dataset.action === 'statistics') {
                    this.setTab('statistics');
                    return;
                }
                post('menuAction', { action: btn.dataset.action });
            });
        });

        $('#menu-profile-buy-level')?.addEventListener('click', () => {
            const btn = $('#menu-profile-buy-level');
            if (!btn || btn.disabled) return;
            post('menuAction', { action: 'buy_level' });
        });

        $('#menu-property-browse')?.addEventListener('click', () => {
            post('menuAction', { action: 'properties' });
        });

        $$('.menu-language-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (btn.disabled || btn.dataset.locale === window.I18n?.getLocale?.()) return;
                $$('.menu-language-btn').forEach((item) => { item.disabled = true; });
                const response = await post('localeSet', { locale: btn.dataset.locale });
                if (!response?.ok) {
                    notify(response?.error || window.I18n?.t('locale.failed'), 'error');
                }
                $$('.menu-language-btn').forEach((item) => { item.disabled = false; });
            });
        });

        window.addEventListener('sunset:localeChanged', () => {
            this.syncLanguageButtons();
            if (this._data && !$('#menu')?.classList.contains('hidden')) this.update(this._data);
        });

        if (window.ChatSettings) ChatSettings.init();
        this.syncLanguageButtons();
    },

    syncLanguageButtons() {
        const locale = window.I18n?.getLocale?.() || 'en';
        $$('.menu-language-btn').forEach((btn) => {
            const active = btn.dataset.locale === locale;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    setTab(tab) {
        if (!tab) return;
        this.activeTab = tab;
        $$('.menu-tab').forEach((el) => el.classList.toggle('is-active', el.dataset.tab === tab));
        $$('.menu-panel-view').forEach((el) => el.classList.toggle('is-active', el.dataset.panel === tab));
        $('#menu')?.classList.toggle('menu--vehicle-active', tab === 'vehicle');
        if (tab === 'settings' && window.ChatSettings) {
            ChatSettings.init();
            ChatSettings.syncControls();
        }
    },

    formatXp(n) {
        return window.I18n?.number(n || 0) || String(n || 0);
    },

    buyLevelState(data) {
        const level = Number(data?.level || 1);
        const rp = Number(data?.respectPoints || 0);
        const rpNeed = Number(data?.respectRequired || 4);
        const parsedPrice = Number(data?.levelPrice);
        const price = Number.isFinite(parsedPrice) ? parsedPrice : 1000;
        const money = Number(data?.cash || 0) + Number(data?.bank || 0);
        const canBuy = rp >= rpNeed && money >= price;
        let reason = '';
        if (!canBuy) {
            if (rp < rpNeed) {
                reason = window.I18n.t('menu.level.need_rp', { required: this.formatXp(rpNeed), current: this.formatXp(rp) });
            } else {
                reason = window.I18n.t('menu.level.need_money', { price: formatMoney(price) });
            }
        }
        return { level, rp, rpNeed, price, canBuy, reason };
    },

    applyBuyLevelState(data) {
        const state = this.buyLevelState(data);
        const profileBtn = $('#menu-profile-buy-level');
        const statsBtn = $('#menu-buy-level');
        const nextLevel = state.level + 1;

        [profileBtn, statsBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !state.canBuy;
            btn.classList.toggle('is-unaffordable', !state.canBuy);
            btn.setAttribute('aria-disabled', state.canBuy ? 'false' : 'true');
        });

        if (profileBtn) {
            if (state.canBuy) {
                profileBtn.innerHTML = `${window.I18n.t('menu.level.buy', { level: nextLevel })}<small>${this.formatXp(state.rpNeed)} RP · ${formatMoney(state.price)}</small>`;
            } else {
                profileBtn.innerHTML = `${window.I18n.t('menu.level.locked', { level: nextLevel })}<small>${this.escape(state.reason)}</small>`;
            }
        }

        if (statsBtn) {
            statsBtn.textContent = state.canBuy
                ? `${window.I18n.t('menu.level.buy', { level: nextLevel })} · ${this.formatXp(state.rpNeed)} RP · ${formatMoney(state.price)}`
                : state.reason;
        }
    },

    showAlert(message, type = 'error') {
        const el = $('#menu-level-alert');
        if (!message) {
            el?.classList.add('hidden');
            return;
        }
        if (typeof notify === 'function') notify(message, type, 7000);
        if (!el) return;
        el.textContent = String(message);
        el.className = `menu-level-alert menu-level-alert--${type}`;
        el.classList.remove('hidden');
        clearTimeout(this._alertTimer);
        this._alertTimer = setTimeout(() => el.classList.add('hidden'), 9000);
    },

    clearAlert() {
        clearTimeout(this._alertTimer);
        $('#menu-level-alert')?.classList.add('hidden');
    },

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[ch]);
    },

    t(key, params) {
        return window.I18n?.t(key, params) || `[?${key}]`;
    },

    factionTips(jobId) {
        const common = ['menu.job.tip.common1', 'menu.job.tip.common2'];
        const perJob = {
            police: ['menu.job.tip.police1', 'menu.job.tip.police2', 'menu.job.tip.police3'],
            medic: ['menu.job.tip.medic1', 'menu.job.tip.medic2', 'menu.job.tip.medic3'],
            taxi: ['menu.job.tip.taxi1', 'menu.job.tip.taxi2', 'menu.job.tip.taxi3'],
            mechanic: ['menu.job.tip.mechanic1', 'menu.job.tip.mechanic2', 'menu.job.tip.mechanic3'],
        };
        const tips = [...common, ...(perJob[jobId] || ['menu.job.tip.generic'])];
        return tips.map((key) => `<li>${this.escape(this.t(key))}</li>`).join('');
    },

    vehicleImage(model) {
        const m = String(model || 'sultan').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 64);
        if (!m) return 'assets/vehicles/sultan.webp';
        return `https://racket.cat/api/vehicle-thumbnails/${encodeURIComponent(m)}`;
    },

    vehicleImageFallbackHtml() {
        return '<i class="ph-fill ph-car-profile vi-icon vi-icon--fallback" aria-hidden="true"></i>';
    },

    formatEcuBlock(info, vehicleId) {
        const ecu = info || {};
        const vid = Number(vehicleId) || 0;
        if (ecu.stock) {
            return `<div class="menu-vcard__ecu-strip menu-vcard__ecu-strip--stock">
                <span class="menu-vcard__ecu-pill">${this.t('menu.vehicle.stock_ecu')}</span>
            </div>`;
        }

        const chips = (ecu.chips || []).slice(0, 5);
        const dyno = (ecu.lines || []).find((line) => (line.label || '').toUpperCase() === 'DYNO');
        const chipHtml = chips.map((c) => `<span class="menu-vcard__ecu-chip">${this.escape(c)}</span>`).join('');
        const detailLines = (ecu.lines || []).map((line) => `
            <div class="menu-vcard__ecu-line">
                <span>${this.escape(line.label || '')}</span>
                <em>${this.escape(line.value || '')}</em>
            </div>`).join('');

        return `<div class="menu-vcard__ecu-strip" data-ecu-id="${vid}">
            <div class="menu-vcard__ecu-strip-main">
                <span class="menu-vcard__ecu-pill">${this.t('menu.vehicle.tuned')}</span>
                <span class="menu-vcard__ecu-summary">${this.escape(ecu.summary || this.t('menu.vehicle.custom_map'))}</span>
                ${dyno ? `<span class="menu-vcard__ecu-dyno">${this.escape(dyno.value)}</span>` : ''}
                <button type="button" class="menu-vcard__ecu-toggle" data-ecu-toggle="${vid}" aria-label="${this.t('menu.vehicle.ecu_details')}">⋯</button>
            </div>
            <div class="menu-vcard__ecu-chips">${chipHtml}</div>
            <div class="menu-vcard__ecu-detail hidden" data-ecu-detail="${vid}">${detailLines}</div>
        </div>`;
    },

    bindEcuToggles(root) {
        if (!root) return;
        root.querySelectorAll('[data-ecu-toggle]').forEach((btn) => {
            const id = btn.dataset.ecuToggle;
            const detail = root.querySelector(`[data-ecu-detail="${id}"]`);
            if (!detail) return;
            const isOpen = String(this.openEcuVehicleId) === String(id);
            detail.classList.toggle('hidden', !isOpen);
            btn.classList.toggle('is-open', isOpen);
            btn.textContent = isOpen ? '−' : '⋯';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (String(this.openEcuVehicleId) === String(id)) {
                    this.openEcuVehicleId = null;
                } else {
                    this.openEcuVehicleId = id;
                }
                const nowOpen = String(this.openEcuVehicleId) === String(id);
                detail.classList.toggle('hidden', !nowOpen);
                btn.classList.toggle('is-open', nowOpen);
                btn.textContent = nowOpen ? '−' : '⋯';
            });
        });
    },

    vitalsRow(label, pct) {
        const value = Math.max(0, Math.min(100, Math.round(pct)));
        return `<div class="menu-vcard__vital" title="${label} ${value}%">
            <span>${label}</span>
            <i><b style="width:${value}%"></b></i>
            <em>${value}%</em>
        </div>`;
    },

    vmenuStatClass(val) {
        const value = Math.max(0, Math.min(100, Math.round(val)));
        if (value >= 80) return 'ok';
        if (value >= 40) return 'warn';
        return 'bad';
    },

    vmenuStatusTag(key) {
        if (key === 'garage') return { cls: 'garage', label: this.t('menu.vehicle.garage') };
        if (key === 'out' || key === 'parked') return { cls: 'out', label: key === 'parked' ? this.t('menu.vehicle.parked') : this.t('menu.vehicle.street') };
        return { cls: 'impound', label: this.t('menu.vehicle.impounded') };
    },

    vmenuTuningBadges(selected) {
        const badges = [];
        const ecu = selected.ecuInfo || {};
        if (ecu.tuned || (ecu.chips && ecu.chips.length && !ecu.stock)) {
            const summary = ecu.summary || (ecu.chips && ecu.chips[0]) || 'TUNED';
            badges.push(`<span class="tune-chip chip-tuned"><i class="ph-bold ph-lightning"></i> ${this.escape(summary)}</span>`);
        } else if (ecu.stock) {
            badges.push(`<span class="tune-chip chip-stock"><i class="ph-bold ph-check"></i> ECU FACTORY</span>`);
        }

        const mods = selected.mods || {};
        if (mods.turbo === 1 || mods.turbo === true) {
            badges.push(`<span class="tune-chip chip-turbo"><i class="ph-bold ph-wind"></i> TURBO</span>`);
        }
        if (mods.engine != null && Number(mods.engine) >= 0) {
            badges.push(`<span class="tune-chip"><i class="ph-bold ph-engine"></i> MOTOR STG ${Number(mods.engine) + 1}</span>`);
        }
        if (mods.brakes != null && Number(mods.brakes) >= 0) {
            badges.push(`<span class="tune-chip"><i class="ph-bold ph-circle-dashed"></i> FRANE STG ${Number(mods.brakes) + 1}</span>`);
        }
        if (mods.transmission != null && Number(mods.transmission) >= 0) {
            badges.push(`<span class="tune-chip"><i class="ph-bold ph-gear-six"></i> CUTIE STG ${Number(mods.transmission) + 1}</span>`);
        }
        if (mods.suspension != null && Number(mods.suspension) >= 0) {
            badges.push(`<span class="tune-chip"><i class="ph-bold ph-arrows-down-up"></i> SUSP. STG ${Number(mods.suspension) + 1}</span>`);
        }

        if (!badges.length) {
            return `<div class="tune-empty">${this.t('menu.vehicle.no_modifications')}</div>`;
        }
        return `<div class="tune-chips-container">${badges.join('')}</div>`;
    },

    vehicleSnapshotKey(vehicles, selectedId, openEcuId) {
        const list = (vehicles || []).map((v) => [
            v.id, v.model, v.displayName, v.plate, v.stored, v.inWorld, v.destroyed,
            v.fuel, v.engine, v.body, v.odometer,
            v.insurancePoints, v.insuranceLevel, v.claimCost, v.renewCost,
            v.ownershipDays,
            v.isCurrentVehicle, v.garage, v.parked_x, v.parked_y,
            JSON.stringify(v.mods || null),
            JSON.stringify(v.ecuInfo || null),
        ].join('|'));
        return JSON.stringify({ selectedId, openEcuId, list });
    },

    _vehicleStateOf(v) {
        const isDestroyed = v.destroyed === true || v.destroyed === 1 || v.destroyed === '1';
        const stored = !isDestroyed && (v.stored === true || v.stored === 1 || v.stored === '1' || Number(v.stored) === 1);
        // Trust the authoritative inWorld flag from buildMenuData (IsPlateInWorld).
        // Only fall back to !stored when the server did not supply the field, so
        // despawned-but-unstored vehicles are never shown as "in world".
        const serverInWorld = v.inWorld === true || v.inWorld === 1 || v.inWorld === '1';
        const inWorld = !isDestroyed && !stored && (v.inWorld != null ? serverInWorld : true);
        const hasPark = Number.isFinite(Number(v.parked_x)) && Number.isFinite(Number(v.parked_y));
        if (isDestroyed) return { key: 'impound', label: this.t('menu.vehicle.impounded'), stored: false, inWorld: false, isDestroyed: true };
        if (stored) return { key: 'garage', label: `${this.t('menu.vehicle.garage')} · ${v.garage || 'Central'}`, stored: true, inWorld: false };
        if (inWorld) return { key: 'out', label: v.garage || this.t('menu.vehicle.street'), stored: false, inWorld: true };
        if (hasPark) return { key: 'parked', label: this.t('menu.vehicle.parked'), stored: false, inWorld: true };
        return { key: 'garage', label: this.t('menu.vehicle.garage'), stored: true, inWorld: false };
    },

    _bindVehicleImpoundHold(root, vehicleId, claimCost) {
        const hold = root.querySelector('[data-v-impound-hold]');
        if (!hold) return;
        let prog = 0;
        let frame = null;
        const reset = () => {
            cancelAnimationFrame(frame);
            frame = null;
            prog = 0;
            const bar = hold.querySelector('.bh-progress');
            if (bar) bar.style.width = '0%';
        };
        const tick = () => {
            prog += 2.5;
            const bar = hold.querySelector('.bh-progress');
            if (bar) bar.style.width = `${Math.min(100, prog)}%`;
            if (prog >= 100) {
                reset();
                post('menuVehicleAction', { action: 'claim_insurance', vehicleId });
                return;
            }
            frame = requestAnimationFrame(tick);
        };
        hold.onpointerdown = (e) => { e.preventDefault(); reset(); frame = requestAnimationFrame(tick); };
        hold.onpointerup = reset;
        hold.onpointerleave = reset;
        const label = hold.querySelector('.bh-text');
        if (label) label.innerHTML = `<span class="key">ENTER</span> ${this.t('menu.vehicle.pay_impound', { price: formatMoney(claimCost) })}`;
    },

    renderVehicles(data) {
        const grid = $('#menu-vehicle-grid');
        if (!grid) return;
        const vehicles = data.vehicles || [];
        const query = String(this._vehicleSearch || '').trim().toLowerCase();

        const snapKey = this.vehicleSnapshotKey(vehicles, this.selectedVehicleId, this.openEcuVehicleId) + '|' + query;
        if (snapKey === this._vehicleSnapKey && grid.classList.contains('v-menu-forza')) {
            return;
        }
        this._vehicleSnapKey = snapKey;

        grid.className = 'v-menu-forza visible';

        if (!vehicles.length) {
            this.selectedVehicleId = null;
            grid.innerHTML = `<div class="vmenu-empty"><strong>${this.t('menu.vehicle.empty')}</strong><span>${this.t('menu.vehicle.empty_hint')}</span></div>`;
            return;
        }

        const filtered = query
            ? vehicles.filter((v) => {
                const model = String(v.model || '').toLowerCase();
                const plate = String(v.plate || '').toLowerCase();
                return model.includes(query) || plate.includes(query);
            })
            : vehicles;

        const selectedExists = filtered.some((v) => String(v.id) === String(this.selectedVehicleId));
        if (!selectedExists) this.selectedVehicleId = (filtered[0] || vehicles[0]).id;
        const selected = filtered.find((v) => String(v.id) === String(this.selectedVehicleId))
            || vehicles.find((v) => String(v.id) === String(this.selectedVehicleId))
            || vehicles[0];

        const listHtml = (filtered.length ? filtered : vehicles).map((v) => {
            const status = this._vehicleStateOf(v);
            const tag = this.vmenuStatusTag(status.key);
            const name = this.escape(v.displayName || v.label || this.t('common.vehicle'));
            const plate = this.escape(v.plate || '—');
            const isSelected = String(v.id) === String(this.selectedVehicleId);
            const modelKey = String(v.model || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 64);
            const thumb = this.vehicleImage(modelKey || v.model);
            return `<button type="button" class="v-item ${isSelected ? 'active' : ''}" data-v-select="${Number(v.id) || 0}">
                <span class="vi-thumb-wrap">
                    <img class="vi-thumb" src="${thumb}" alt="" loading="lazy" decoding="async"
                        onerror="this.classList.add('hidden');var n=this.nextElementSibling;if(n)n.classList.remove('hidden');">
                    ${this.vehicleImageFallbackHtml()}
                </span>
                <div class="vi-info">
                    <div class="vi-name">${name}</div>
                    <div class="vi-plate">${plate}</div>
                    <div class="vi-status-line ${tag.cls}">${tag.label}</div>
                </div>
            </button>`;
        }).join('');

        const status = this._vehicleStateOf(selected);
        const displayName = this.escape(selected.displayName || selected.label || this.t('common.vehicle'));
        const plate = this.escape(selected.plate || '—');
        const fuel = Math.max(0, Math.min(100, Math.round(Number(selected.fuel) || 0)));
        const engine = Math.max(0, Math.min(100, Math.round((Number(selected.engine) || 0) / 10)));
        const body = Math.max(0, Math.min(100, Math.round((Number(selected.body) || 0) / 10)));
        const odometer = Math.max(0, Number(selected.odometer) || 0);
        const claimCost = selected.claimCost != null ? Number(selected.claimCost) : 250;
        const renewCost = selected.renewCost != null ? Number(selected.renewCost) : 750;
        const insurancePts = selected.insurancePoints != null ? Number(selected.insurancePoints) : 5;
        const ownershipDays = selected.ownershipDays != null ? Number(selected.ownershipDays) : 0;

        let mainAction = '';
        let gpsAction = `<button type="button" class="btn-action secondary" data-v-action="gps" data-v-plate="${plate}" data-v-id="${Number(selected.id) || 0}"><i class="ph-bold ph-crosshair"></i> GPS</button>`;
        let impoundHold = `<div class="btn-hold hidden" data-v-impound-hold data-v-id="${Number(selected.id) || 0}"><div class="bh-progress"></div><div class="bh-text"><span class="key">ENTER</span> ${this.t('menu.vehicle.pay_impound', { price: formatMoney(claimCost) })}</div></div>`;

        if (status.isDestroyed) {
            mainAction = '';
            gpsAction = '';
            if (insurancePts > 0) {
                impoundHold = `<div class="btn-hold" data-v-impound-hold data-v-id="${Number(selected.id) || 0}"><div class="bh-progress"></div><div class="bh-text"><span class="key">ENTER</span> ${this.t('menu.vehicle.pay_impound', { price: formatMoney(claimCost) })}</div></div>`;
            } else {
                mainAction = `<button type="button" class="btn-action" data-v-action="renew_insurance" data-v-id="${Number(selected.id) || 0}"><i class="ph-bold ph-shield-check"></i> ${this.t('menu.vehicle.renew_insurance', { price: formatMoney(renewCost) })}</button>`;
                impoundHold = '';
            }
        } else if (status.stored) {
            mainAction = `<button type="button" class="btn-action" data-v-action="spawn" data-v-id="${Number(selected.id) || 0}"><i class="ph-bold ph-key"></i> ${this.t('menu.vehicle.valet')}</button>`;
            gpsAction = '';
        } else if (status.inWorld) {
            const parkAction = selected.isCurrentVehicle ? 'park' : 'store';
            const parkLabel = selected.isCurrentVehicle ? this.t('menu.vehicle.park') : this.t('menu.vehicle.send_garage');
            mainAction = `<button type="button" class="btn-action" data-v-action="${parkAction}" data-v-id="${Number(selected.id) || 0}"><i class="ph-bold ph-car"></i> ${parkLabel}</button>`;
            gpsAction = `<button type="button" class="btn-action secondary" data-v-action="gps" data-v-plate="${plate}" data-v-id="${Number(selected.id) || 0}"><i class="ph-bold ph-crosshair"></i> GPS (${this.escape(status.label)})</button>`;
        } else {
            mainAction = `<button type="button" class="btn-action" data-v-action="spawn" data-v-id="${Number(selected.id) || 0}"><i class="ph-bold ph-key"></i> ${this.t('menu.vehicle.respawn_here')}</button>`;
        }

        const engineCls = engine < 30 ? 'bad' : (engine < 60 ? 'warn' : 'ok');
        const bodyCls = body < 30 ? 'bad' : (body < 60 ? 'warn' : 'ok');
        const fuelCls = fuel < 15 ? 'bad' : (fuel < 35 ? 'warn' : 'ok');
        const insCls = insurancePts === 0 ? 'bad' : (insurancePts <= 2 ? 'warn' : 'ok');
        const locCls = status.isDestroyed ? 'bad' : (status.stored ? 'ok' : 'warn');
        const locText = status.isDestroyed ? this.t('menu.vehicle.impounded_damaged')
            : (status.stored ? this.t('menu.vehicle.in_garage') : this.t('menu.vehicle.on_street'));

        grid.innerHTML = `<div class="v-sidebar">
                <div class="v-header">
                    <h2 class="vh-title"><i class="ph-bold ph-steering-wheel"></i> ${this.t('menu.vehicle.title')}</h2>
                    <div class="v-search">
                        <i class="ph-bold ph-magnifying-glass"></i>
                        <input type="text" id="v-menu-search" placeholder="${this.t('menu.vehicle.search')}" value="${this.escape(query)}">
                    </div>
                </div>
                <div class="v-list">${listHtml || `<div class="vmenu-empty" style="transform:skewX(5deg);border:none;background:transparent"><span>${this.t('common.no_results')}</span></div>`}</div>
            </div>
            <div class="v-details">
                <div class="vd-header">
                    <div class="vd-title-box">
                        <div class="vd-class">${this.escape(selected.vehicleClass || this.t('menu.vehicle.personal'))}</div>
                        <h2 class="vd-name">${displayName}</h2>
                    </div>
                    <div class="vd-plate-box">
                        <div class="vd-plate-state">${this.t('ui.mdc.san_andreas')}</div>
                        <div class="vd-plate-text">${plate}</div>
                    </div>
                </div>
                <div class="vd-hero-thumb">
                    <img class="vd-hero-img" src="${this.vehicleImage(selected.model)}" alt=""
                        loading="eager" decoding="async"
                        onerror="this.classList.add('hidden');var n=this.nextElementSibling;if(n)n.classList.remove('hidden');">
                    <div class="vd-hero-fallback hidden">${this.vehicleImageFallbackHtml()}</div>
                </div>
                <div class="vd-body">
                    <div class="vd-bars-box">
                        <div class="vbar-row">
                            <div class="vbar-header">
                                <span class="vbar-title"><i class="ph-bold ph-engine"></i> ${this.t('menu.vehicle.engine')}</span>
                                <span class="vbar-val ${engineCls}">${engine}%</span>
                            </div>
                            <div class="vbar-track"><div class="vbar-fill ${engineCls}" style="width: ${engine}%"></div></div>
                        </div>
                        <div class="vbar-row">
                            <div class="vbar-header">
                                <span class="vbar-title"><i class="ph-bold ph-shield"></i> ${this.t('menu.vehicle.body')}</span>
                                <span class="vbar-val ${bodyCls}">${body}%</span>
                            </div>
                            <div class="vbar-track"><div class="vbar-fill ${bodyCls}" style="width: ${body}%"></div></div>
                        </div>
                        <div class="vbar-row">
                            <div class="vbar-header">
                                <span class="vbar-title"><i class="ph-bold ph-gas-pump"></i> ${this.t('menu.vehicle.fuel')}</span>
                                <span class="vbar-val ${fuelCls}">${fuel}%</span>
                            </div>
                            <div class="vbar-track"><div class="vbar-fill ${fuelCls}" style="width: ${fuel}%"></div></div>
                        </div>
                    </div>

                    <div class="vd-spec-grid">
                        <div class="spec-card">
                            <div class="spec-card-head">
                                <i class="ph-bold ph-gauge"></i>
                                <span>${this.t('menu.vehicle.odometer_age')}</span>
                            </div>
                            <div class="spec-card-main">
                                <div class="spec-odometer">${window.I18n.number(odometer, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span class="spec-unit">KM</span></div>
                                <div class="spec-sub"><i class="ph-bold ph-calendar"></i> ${ownershipDays === 0
                                    ? this.t('menu.vehicle.acquired_today')
                                    : this.t('menu.vehicle.owned_days', { days: ownershipDays })}</div>
                            </div>
                        </div>

                        <div class="spec-card">
                            <div class="spec-card-head">
                                <i class="ph-bold ph-shield-check"></i>
                                <span>${this.t('menu.vehicle.insurance')}</span>
                            </div>
                            <div class="spec-card-main">
                                <div class="spec-insurance ${insCls}">${insurancePts}/5 <span class="spec-unit">${this.t('menu.vehicle.points')}</span></div>
                                <div class="spec-sub"><i class="ph-bold ph-receipt"></i> ${this.t('menu.vehicle.insurance_level_claim', { level: selected.insuranceLevel || 1, amount: formatMoney(claimCost) })}</div>
                            </div>
                        </div>

                        <div class="spec-card">
                            <div class="spec-card-head">
                                <i class="ph-bold ph-map-pin"></i>
                                <span>${this.t('menu.vehicle.location_status')}</span>
                            </div>
                            <div class="spec-card-main">
                                <div class="spec-loc truncate">${this.escape(status.label)}</div>
                                <div class="spec-sub"><span class="spec-status-dot ${locCls}"></span> ${locText}</div>
                            </div>
                        </div>

                        <div class="spec-card">
                            <div class="spec-card-head">
                                <i class="ph-bold ph-cpu"></i>
                                <span>${this.t('menu.vehicle.tuning')}</span>
                            </div>
                            <div class="spec-card-main spec-tuning-main">
                                ${this.vmenuTuningBadges(selected)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="vd-actions">
                    ${gpsAction}
                    ${mainAction}
                    ${impoundHold}
                </div>
            </div>`;

        const searchInput = grid.querySelector('#v-menu-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._vehicleSearch = searchInput.value;
                this._vehicleSnapKey = null;
                this.renderVehicles(data);
            });
            searchInput.addEventListener('keydown', (e) => e.stopPropagation());
        }

        grid.querySelectorAll('[data-v-select]').forEach((button) => {
            button.addEventListener('click', () => {
                this.selectedVehicleId = Number(button.dataset.vSelect);
                this._vehicleSnapKey = null;
                this.renderVehicles(data);
            });
        });

        grid.querySelectorAll('[data-v-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.vAction;
                const vehicleId = btn.dataset.vId;
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
                this._vehicleSnapKey = null;
                post('menuVehicleAction', {
                    action: action,
                    vehicleId: vehicleId,
                    plate: btn.dataset.vPlate,
                });
            });
        });

        if (status.isDestroyed && insurancePts > 0) {
            this._bindVehicleImpoundHold(grid, Number(selected.id) || 0, claimCost);
        }
    },

    renderProperties(data) {
        const list = $('#menu-property-list');
        if (!list || !window.PropertyUI) return;
        const properties = data.properties || [];
        const owned = properties.filter((p) => p.owned);
        const rented = properties.filter((p) => p.rented);
        const mine = [...owned, ...rented.filter((p) => !p.owned)];
        PropertyUI.renderList(list, {
            properties: mine.length ? mine : properties.slice(0, 6),
            selectedId: data.selectedPropertyId,
            meta: data.propertyMeta,
        });
    },

    updateProperties(data) {
        if (!data) return;
        this.renderProperties(data);
        if (data.propertyCount != null) {
            $('#menu-property-count').textContent = String(data.propertyCount);
        }
        if (data.homeLabel) {
            $('#menu-home-label').textContent = data.homeLabel;
        }
    },

    renderJob(data) {
        const card = $('#menu-job-card');
        const side = $('#menu-job-side');
        if (!card || !side) return;

        const unemployed = !data.jobId || data.jobId === 'unemployed';
        const hasFaction = !!data.factionId;
        const dutyBadge = data.hasDuty
            ? (data.onDuty ? `<span class="menu-job-badge menu-job-badge--on">${this.t('menu.job.on_duty')}</span>` : `<span class="menu-job-badge menu-job-badge--off">${this.t('menu.job.off_duty')}</span>`)
            : '';

        const jobLine = this.escape(hasFaction
            ? (data.factionLabel || data.factionId)
            : (unemployed ? this.t('menu.profile.unemployed') : (data.job || this.t('menu.profile.unemployed'))));

        const rankLine = this.escape(hasFaction
            ? (data.factionGradeLabel || '—')
            : (data.jobGradeLabel || '—'));

        const salaryLine = hasFaction ? (data.factionSalary || 0) : (data.jobSalary || 0);

        const civilianSub = hasFaction
            ? `<p class="menu-job-sub">${this.t('menu.job.civilian', { job: this.escape(data.job || this.t('menu.profile.unemployed')) })}</p>`
            : '';

        card.innerHTML = `
            <div class="menu-job-card__header">
                <div>
                    <div class="menu-job-card__label">${hasFaction ? this.t('menu.job.faction') : this.t('menu.job.civilian_job')}</div>
                    <h4>${jobLine}</h4>
                    ${civilianSub}
                </div>
                ${dutyBadge}
            </div>
            <div class="menu-job-stats">
                <div><span>${this.t('menu.job.rank')}</span><strong>${rankLine}</strong></div>
                <div><span>${this.t('menu.job.salary')}</span><strong>${this.t('common.per_hour', { amount: formatMoney(salaryLine) })}</strong></div>
                <div><span>${this.t('menu.job.next_payday')}</span><strong>${data.payday || '—'}</strong></div>
                <div><span>${this.t('menu.job.server_time')}</span><strong>${data.serverTime || '—'}</strong></div>
            </div>`;

        let actions = '';
        if (!unemployed || hasFaction) {
            if (data.hasDuty) {
                actions += `<button type="button" class="menu-job-btn menu-job-btn--primary" data-j-action="duty">${data.onDuty ? this.t('menu.job.go_off_duty') : this.t('menu.job.go_on_duty')}</button>`;
            }
            if (hasFaction) {
                actions += `<button type="button" class="menu-job-btn" data-j-action="faction">${this.t('menu.job.faction_info')}</button>`;
                actions += `<button type="button" class="menu-job-btn menu-job-btn--danger" data-j-action="leave">${this.t('menu.job.leave_faction')}</button>`;
            }
            if (!unemployed) {
                actions += `<button type="button" class="menu-job-btn menu-job-btn--danger" data-j-action="quit_civilian">${this.t('menu.job.quit_civilian')}</button>`;
            }
        } else {
            actions = `<p class="menu-mgmt-empty">${this.t('menu.job.join_hint')}</p>`;
        }

        if (data.factionId === 'taxi') {
            actions += `<button type="button" class="menu-job-btn menu-job-btn--cab" data-j-action="phone">${this.t('menu.job.open_taxi')}</button>`;
        }

        side.innerHTML = `
            <div class="menu-job-side__box">
                <h5>${this.t('menu.job.quick_tips')}</h5>
                <ul>${this.factionTips(data.factionId || data.jobId)}</ul>
            </div>
            <div class="menu-job-actions">${actions}</div>`;

        side.querySelectorAll('[data-j-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.jAction;
                if (action === 'phone') {
                    post('menuAction', { action: 'phone' });
                    return;
                }
                post('menuJobAction', { action });
            });
        });
    },

    update(data) {
        this._data = data;
        if (!data) return;
        this.init();

        if (data.soloMode !== undefined) {
            this.soloMode = data.soloMode;
        }

        if (this.soloMode === 'vehicle') {
            this.renderVehicles(data);
            return;
        }

        $('#menu-name').textContent = (data.name || '—').toUpperCase();
        $('#menu-id').textContent = String(Number(data.id) || 0);
        const jobLabel = $('#menu-job-label');
        if (jobLabel) {
            jobLabel.textContent = data.factionLabel || data.job || I18n.t('menu.profile.unemployed');
        }
        const cidEl = $('#menu-cid');
        if (cidEl) cidEl.textContent = data.cid ? ('CID: ' + data.cid) : 'CID: —';
        $('#menu-rank').textContent = data.rank || I18n.t('ui.menu.default_rank');
        $('#menu-cash').textContent = formatMoney(data.cash || 0);
        $('#menu-bank').textContent = formatMoney(data.bank || 0);
        $('#menu-premium').textContent = `${this.formatXp(data.premium ?? 0)} ${I18n.t('menu.money.points')}`;
        $('#menu-playtime').textContent = data.playtime || '0H 0M';
        $('#menu-lastlogin').textContent = data.lastLogin || '—';

        $('#menu-stats-level').textContent = String(data.level || 1);
        $('#menu-stats-xp').textContent = `${this.formatXp(data.respectPoints || 0)} / ${this.formatXp(data.respectRequired || 4)} RP`;
        $('#menu-stats-paydays').textContent = String(data.paydaysReceived || 0);
        this.applyBuyLevelState(data);
        $('#menu-stats-playtime').textContent = data.playtime || '0H 0M';
        $('#menu-stats-session').textContent = data.sessionTime || '0H 0M';
        $('#menu-stats-created').textContent = data.characterCreated || '—';
        $('#menu-stats-lastlogin').textContent = `${window.I18n?.t('menu.stats.last_login') || 'Last login —'} ${data.lastLogin || '—'}`;
        $('#menu-stats-tasks').textContent = String(data.completedTasks || 0);
        $('#menu-stats-earned').textContent = formatMoney(data.careerEarnings || 0);
        $('#menu-stats-skills').textContent = String(data.combinedSkillLevels || 0);
        $('#menu-stats-assets').textContent = window.I18n?.t('menu.stats.asset_count', { vehicles: data.vehicleCount || 0, properties: data.propertyCount || 0 });
        $('#menu-stats-home').textContent = window.I18n?.t('menu.stats.home', { home: data.homeLabel || window.I18n?.t('common.none') });

        const xp = data.respectPoints || 0;
        const xpMax = data.respectRequired || 4;
        const level = data.level || 1;
        $('#menu-xp-text').textContent = `${this.formatXp(xp)} / ${this.formatXp(xpMax)} RP`;
        $('#menu-level').textContent = I18n.t('menu.profile.level', { level });
        const xpBar = $('#menu-xp-bar');
        if (xpBar) xpBar.style.width = `${Math.min(100, (xp / xpMax) * 100)}%`;

        const health = Math.max(0, Math.min(100, Math.round(data.health ?? 100)));
        const armor = Math.max(0, Math.min(100, Math.round(data.armor ?? 0)));
        const hunger = Math.max(0, Math.min(100, Math.round(data.hunger ?? 100)));
        const thirst = Math.max(0, Math.min(100, Math.round(data.thirst ?? 100)));
        const stress = Math.max(0, Math.min(100, Math.round(data.stress ?? 0)));
        const setBar = (id, pct) => {
            const el = document.getElementById(id);
            if (el) el.style.width = `${pct}%`;
        };
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('menu-health-pct', `${health}%`);
        setText('menu-armor-pct', `${armor}%`);
        setText('menu-hunger-pct', `${hunger}%`);
        setText('menu-thirst-pct', `${thirst}%`);
        setText('menu-stress-pct', `${stress}%`);
        setBar('menu-health-bar', health);
        setBar('menu-armor-bar', armor);
        setBar('menu-hunger-bar', hunger);
        setBar('menu-thirst-bar', thirst);
        setBar('menu-stress-bar', stress);

        $('#menu-property-count').textContent = String(data.propertyCount ?? 0);
        $('#menu-home-label').textContent = data.homeLabel || I18n.t('common.none');

        this.renderProperties(data);
        this.renderVehicles(data);
        this.renderJob(data);
        this.syncLanguageButtons();

        const avatar = $('#menu-avatar');
        if (avatar) {
            if (data.avatar) {
                avatar.style.backgroundImage = `url("${data.avatar}")`;
                avatar.style.backgroundSize = 'cover';
                avatar.textContent = '';
            } else {
                avatar.style.backgroundImage = '';
                avatar.textContent = (data.name || '?').charAt(0).toUpperCase();
            }
        }
    },

    show(data) {
        this.init();
        const menu = $('#menu');
        menu.classList.remove('menu--solo-vehicle', 'menu--solo-inventory', 'menu--vehicle-active');
        if (data?.soloMode) {
            menu.classList.add(`menu--solo-${data.soloMode}`);
        }
        this.soloMode = data?.soloMode || null;

        const closeBtn = $('#menu-close-btn');
        if (closeBtn) {
            if (!this._closeHtml) this._closeHtml = closeBtn.innerHTML;
            closeBtn.innerHTML = this.soloMode === 'vehicle'
                ? '<span class="menu-keycap">V</span> ' + I18n.t('common.close').toUpperCase()
                : this._closeHtml;
        }

        document.body.classList.add('menu-open');
        document.body.classList.toggle('menu--solo-vehicle-active', this.soloMode === 'vehicle');
        menu.classList.remove('hidden');
        this.clearAlert();
        this.update(data);
        this.setTab(data?.initialTab || (this.soloMode === 'vehicle' ? 'vehicle' : 'player'));
    },

    hide() {
        const menu = $('#menu');
        menu.classList.add('hidden');
        menu.classList.remove('menu--solo-vehicle', 'menu--solo-inventory', 'menu--vehicle-active');
        this.soloMode = null;
        this._vehicleSnapKey = null;

        const closeBtn = $('#menu-close-btn');
        if (closeBtn && this._closeHtml) closeBtn.innerHTML = this._closeHtml;

        document.body.classList.remove('menu-open', 'menu--solo-vehicle-active');
        this.clearAlert();
    },

    close() {
        post('menuClose');
    },
};

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const menu = $('#menu');
    if (!menu || menu.classList.contains('hidden')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;

    if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
        Menu.close();
        e.preventDefault();
        return;
    }
    if (menu.classList.contains('menu--solo-vehicle') && (e.key === 'v' || e.key === 'V')) {
        Menu.close();
        e.preventDefault();
    }
});

window.Menu = Menu;
