/* ═══════════════════════════════════════════════════════════════
   SUNSETMP — DRUG SYSTEM CONTROLLER (Harvest, Lab, Street Sale)
   Matches design templates 1:1 with animations, SVG icons & security.
   ═══════════════════════════════════════════════════════════════ */

const SVG_ICONS = {
    weed: `<svg viewBox="0 0 24 24"><path d="M17.5 11c-1.3 0-2.6-.4-3.7-1.1L12 8.7 10.2 9.9c-1.1.7-2.4 1.1-3.7 1.1C3.5 11 1 8.5 1 5.5v-1l2 .5c1.8.4 3.7 0 5.1-1.1L10 .2h4l1.9 3.7c1.4 1.1 3.3 1.5 5.1 1.1l2-.5v1C23 8.5 20.5 11 17.5 11zM12 11c-2.8 0-5 2.2-5 5v5h10v-5c0-2.8-2.2-5-5-5z"></path></svg>`,
    coca: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`,
    meth: `<svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`
};

const Drugs = {
    // ─────────────────────────────────────────────────────────────
    // 1. HARVEST CONTROLLER
    // ─────────────────────────────────────────────────────────────
    harvest: {
        visible: false,
        playing: false,
        currentAmount: 0,
        maxAmount: 50,
        type: 'weed',
        sessionToken: null,
        cursorPos: 0,
        cursorDir: 1,
        cursorSpeed: 1.2,
        targetPos: 0,
        targetWidth: 25,
        animationFrame: null,
        isWaitingFeedback: false,

        open(data) {
            this.visible = true;
            this.playing = true;
            this.type = data.type || 'weed';
            this.currentAmount = data.amount || 0;
            this.maxAmount = data.maxAmount || 50;
            this.sessionToken = data.token || null;
            this.cursorPos = 0;
            this.cursorDir = 1;
            this.cursorSpeed = 1.2;
            this.targetWidth = 25;
            this.isWaitingFeedback = false;

            const wrap = document.getElementById('harvest-wrapper');
            const titleEl = document.getElementById('harvest-title');
            const iconEl = document.getElementById('harvest-icon');
            const instrEl = document.getElementById('harvest-instruction');
            if (!wrap) return;

            wrap.className = `theme-${this.type} visible`;
            if (titleEl) titleEl.innerText = this.type === 'coca' ? 'Recoltare Coca' : (this.type === 'meth' ? 'Recoltare Chimicale' : 'Recoltare Weed');
            if (iconEl) iconEl.innerHTML = SVG_ICONS[this.type] || SVG_ICONS.weed;
            if (instrEl) instrEl.innerHTML = 'Apasă <span class="keybind">E</span> în zona marcată';

            this.randomizeTarget();
            this.updateUI();

            cancelAnimationFrame(this.animationFrame);
            this.loop();
        },

        close() {
            this.visible = false;
            this.playing = false;
            cancelAnimationFrame(this.animationFrame);
            const wrap = document.getElementById('harvest-wrapper');
            if (wrap) wrap.classList.remove('visible', 'hit-success', 'hit-fail');
        },

        randomizeTarget() {
            const targetZoneEl = document.getElementById('harvest-target-zone');
            this.targetPos = Math.random() * (100 - this.targetWidth - 10) + 5;
            if (targetZoneEl) {
                targetZoneEl.style.left = `${this.targetPos}%`;
                targetZoneEl.style.width = `${this.targetWidth}%`;
            }
        },

        updateUI() {
            const cursorEl = document.getElementById('harvest-cursor');
            const countEl = document.getElementById('harvest-count');
            const maxEl = document.getElementById('harvest-max');
            if (cursorEl) cursorEl.style.left = `${this.cursorPos}%`;
            if (countEl) countEl.innerText = this.currentAmount;
            if (maxEl) maxEl.innerText = this.maxAmount;
        },

        loop() {
            if (!this.playing || this.isWaitingFeedback) return;

            this.cursorPos += this.cursorSpeed * this.cursorDir;
            if (this.cursorPos >= 100) {
                this.cursorPos = 100;
                this.cursorDir = -1;
            } else if (this.cursorPos <= 0) {
                this.cursorPos = 0;
                this.cursorDir = 1;
            }

            this.updateUI();
            this.animationFrame = requestAnimationFrame(() => this.loop());
        },

        handleHit() {
            if (!this.visible || !this.playing || this.isWaitingFeedback) return;
            this.isWaitingFeedback = true;
            const wrap = document.getElementById('harvest-wrapper');

            const isHit = (this.cursorPos >= this.targetPos && this.cursorPos <= (this.targetPos + this.targetWidth));
            if (isHit) {
                if (wrap) wrap.classList.add('hit-success');
                if (this.currentAmount < this.maxAmount) {
                    this.currentAmount++;
                    this.cursorSpeed = Math.min(this.cursorSpeed + 0.05, 3.0);
                    this.targetWidth = Math.max(this.targetWidth - 0.5, 12);
                    
                    fetch(`https://${GetParentResourceName()}/giveHarvestItem`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: this.type, token: this.sessionToken })
                    }).catch(() => {});
                }

                if (this.currentAmount >= this.maxAmount) {
                    this.playing = false;
                    const instrEl = document.getElementById('harvest-instruction');
                    if (instrEl) instrEl.innerText = "Rucsacul este plin!";
                }
            } else {
                if (wrap) wrap.classList.add('hit-fail');
                fetch(`https://${GetParentResourceName()}/failHarvestHit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: this.type, token: this.sessionToken })
                }).catch(() => {});
            }

            this.updateUI();

            setTimeout(() => {
                if (!this.visible) return;
                if (wrap) wrap.classList.remove('hit-success', 'hit-fail');
                if (this.playing) {
                    this.randomizeTarget();
                    this.isWaitingFeedback = false;
                    this.loop();
                }
            }, 300);
        }
    },

    // ─────────────────────────────────────────────────────────────
    // 2. LAB PROCESSING CONTROLLER
    // ─────────────────────────────────────────────────────────────
    lab: {
        visible: false,
        playing: false,
        currentRecipe: null,
        sessionToken: null,
        temperature: 0,
        progress: 0,
        isHeating: false,
        animationFrame: null,
        inventory: {},

        recipes: {
            weed: { title: "Pachete Weed", min: 30, max: 70, drop: 0.15, heat: 0.45, prog: 0.22 },
            coca: { title: "Pudră Cocaină", min: 40, max: 60, drop: 0.25, heat: 0.55, prog: 0.17 },
            meth: { title: "Cristale Meth", min: 45, max: 55, drop: 0.38, heat: 0.72, prog: 0.13 }
        },

        open(data) {
            this.visible = true;
            this.playing = false;
            this.currentRecipe = null;
            this.sessionToken = data.token || null;
            this.inventory = data.inventory || {};

            const wrap = document.getElementById('lab-wrapper');
            const emptyEl = document.getElementById('lab-empty-state');
            const activeEl = document.getElementById('lab-active-state');
            const overlayEl = document.getElementById('lab-game-overlay');
            if (!wrap) return;

            wrap.classList.add('visible');
            if (emptyEl) emptyEl.style.display = 'flex';
            if (activeEl) activeEl.style.display = 'none';
            if (overlayEl) overlayEl.style.display = 'none';

            document.querySelectorAll('.recipe-card').forEach(c => c.classList.remove('selected'));
            this.updateStockUI();
        },

        updateStockUI() {
            const weedLeaves = this.inventory['weed_leaf'] || 0;
            const cocaLeaves = this.inventory['coke_leaf'] || 0;
            const methChem = this.inventory['meth_chemical'] || 0;
            const chemicals = this.inventory['chemicals'] || 0;

            const reqWeed = document.getElementById('req-weed');
            if (reqWeed) reqWeed.innerHTML = `Necesită: <span>5x Frunze Weed (${weedLeaves}/5)</span>`;

            const reqCoca = document.getElementById('req-coca');
            if (reqCoca) reqCoca.innerHTML = `Necesită: <span>5x Frunze Coca (${cocaLeaves}/5), 1x Substanțe Chimice (${chemicals}/1)</span>`;

            const reqMeth = document.getElementById('req-meth');
            if (reqMeth) reqMeth.innerHTML = `Necesită: <span>3x Chimicale Meth (${methChem}/3), 1x Substanțe Chimice (${chemicals}/1)</span>`;
        },

        close() {
            if (this.playing) return;
            this.visible = false;
            cancelAnimationFrame(this.animationFrame);
            const wrap = document.getElementById('lab-wrapper');
            if (wrap) wrap.classList.remove('visible');
            fetch(`https://${GetParentResourceName()}/closeMenu`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
        },

        selectRecipe(type) {
            if (this.playing) return;
            this.currentRecipe = type;

            document.querySelectorAll('.recipe-card').forEach(c => c.classList.remove('selected'));
            const selectedCard = document.getElementById(`recipe-card-${type}`);
            if (selectedCard) selectedCard.classList.add('selected');

            const emptyEl = document.getElementById('lab-empty-state');
            const activeEl = document.getElementById('lab-active-state');
            const gameAreaEl = document.getElementById('lab-game-area');
            const btnStart = document.getElementById('btn-lab-start');
            const titleEl = document.getElementById('lab-process-title');
            const statusEl = document.getElementById('lab-process-status');
            const targetZoneEl = document.getElementById('lab-target-zone');

            if (emptyEl) emptyEl.style.display = 'none';
            if (activeEl) activeEl.style.display = 'flex';
            if (gameAreaEl) gameAreaEl.style.display = 'none';
            if (btnStart) btnStart.style.display = 'block';

            const conf = this.recipes[type];
            if (titleEl) titleEl.innerText = conf.title;
            if (statusEl) {
                statusEl.innerText = "Pregătit pentru sinteză";
                statusEl.style.color = "var(--brand-accent)";
            }

            if (targetZoneEl) {
                targetZoneEl.style.bottom = `${conf.min}%`;
                targetZoneEl.style.height = `${conf.max - conf.min}%`;
            }
        },

        startGame() {
            if (!this.currentRecipe) return;

            // Check inventory client-side before starting
            const weedLeaves = this.inventory['weed_leaf'] || 0;
            const cocaLeaves = this.inventory['coke_leaf'] || 0;
            const methChem = this.inventory['meth_chemical'] || 0;
            const chemicals = this.inventory['chemicals'] || 0;

            let hasItems = false;
            if (this.currentRecipe === 'weed' && weedLeaves >= 5) hasItems = true;
            if (this.currentRecipe === 'coca' && cocaLeaves >= 5 && chemicals >= 1) hasItems = true;
            if (this.currentRecipe === 'meth' && methChem >= 3 && chemicals >= 1) hasItems = true;

            if (!hasItems) {
                const statusEl = document.getElementById('lab-process-status');
                if (statusEl) {
                    statusEl.innerText = "Materiale insuficiente în inventar!";
                    statusEl.style.color = "var(--status-bad)";
                }
                return;
            }

            this.temperature = 20;
            this.progress = 0;
            this.playing = true;
            this.isHeating = false;

            const btnStart = document.getElementById('btn-lab-start');
            const gameAreaEl = document.getElementById('lab-game-area');
            const statusEl = document.getElementById('lab-process-status');

            if (btnStart) btnStart.style.display = 'none';
            if (gameAreaEl) gameAreaEl.style.display = 'flex';
            if (statusEl) {
                statusEl.innerText = "Procesare în curs...";
                statusEl.style.color = "var(--brand-primary)";
            }

            this.updateVisuals();
            cancelAnimationFrame(this.animationFrame);
            this.loop();
        },

        startHeating() {
            if (this.playing) this.isHeating = true;
        },

        stopHeating() {
            this.isHeating = false;
        },

        loop() {
            if (!this.playing) return;
            const conf = this.recipes[this.currentRecipe];

            if (this.isHeating) {
                this.temperature += conf.heat;
            } else {
                this.temperature -= conf.drop;
            }

            if (this.temperature > 100) this.temperature = 100;
            if (this.temperature < 0) this.temperature = 0;

            if (this.temperature <= 0 || this.temperature >= 100) {
                this.endGame(false, "Temperatura a ieșit de sub control. Lot distrus.");
                return;
            }

            const tempGauge = document.getElementById('lab-temp-gauge');
            const inZone = (this.temperature >= conf.min && this.temperature <= conf.max);
            if (inZone) {
                if (tempGauge) tempGauge.classList.add('in-zone');
                this.progress += conf.prog;
            } else {
                if (tempGauge) tempGauge.classList.remove('in-zone');
            }

            if (this.progress >= 100) {
                this.progress = 100;
                this.endGame(true, "Lot procesat cu succes. Ai obținut produsele.");
                return;
            }

            this.updateVisuals();
            this.animationFrame = requestAnimationFrame(() => this.loop());
        },

        updateVisuals() {
            const tempFill = document.getElementById('lab-temp-fill');
            const progFill = document.getElementById('lab-prog-fill');
            const progText = document.getElementById('lab-prog-text');

            if (tempFill) tempFill.style.height = `${this.temperature}%`;
            if (progFill) progFill.style.width = `${this.progress}%`;
            if (progText) progText.innerText = `${Math.floor(this.progress)}%`;
        },

        endGame(success, message) {
            this.playing = false;
            cancelAnimationFrame(this.animationFrame);

            const overlay = document.getElementById('lab-game-overlay');
            const resTitle = document.getElementById('lab-res-title');
            const resDesc = document.getElementById('lab-res-desc');

            if (overlay) overlay.style.display = 'flex';
            if (resDesc) resDesc.innerText = message;

            if (success) {
                if (resTitle) {
                    resTitle.innerText = "SUCCES";
                    resTitle.style.color = "var(--status-good)";
                }
                fetch(`https://${GetParentResourceName()}/processSuccess`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: this.currentRecipe, token: this.sessionToken })
                }).catch(() => {});
            } else {
                if (resTitle) {
                    resTitle.innerText = "EȘEC";
                    resTitle.style.color = "var(--status-bad)";
                }
                fetch(`https://${GetParentResourceName()}/processFail`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: this.currentRecipe, token: this.sessionToken })
                }).catch(() => {});
            }
        },

        resetUI() {
            const overlay = document.getElementById('lab-game-overlay');
            const gameAreaEl = document.getElementById('lab-game-area');
            const btnStart = document.getElementById('btn-lab-start');
            const tempGauge = document.getElementById('lab-temp-gauge');
            const statusEl = document.getElementById('lab-process-status');

            if (overlay) overlay.style.display = 'none';
            if (gameAreaEl) gameAreaEl.style.display = 'none';
            if (btnStart) btnStart.style.display = 'block';

            this.temperature = 0;
            this.progress = 0;
            this.updateVisuals();
            if (tempGauge) tempGauge.classList.remove('in-zone');

            if (statusEl) {
                statusEl.innerText = "Pregătit pentru sinteză";
                statusEl.style.color = "var(--brand-accent)";
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // 3. STREET SALE CONTROLLER
    // ─────────────────────────────────────────────────────────────
    sale: {
        visible: false,
        isNegotiating: false,
        hasNegotiated: false,
        currentPrice: 0,
        basePrice: 0,
        qty: 1,
        type: 'weed',
        riskLevel: 'low',
        sessionToken: null,
        cursorPos: 0,
        cursorDir: 1,
        cursorSpeed: 2.5,
        targetPos: 0,
        targetWidth: 20,
        animationFrame: null,

        open(data) {
            this.visible = true;
            this.isNegotiating = false;
            this.hasNegotiated = false;
            this.type = data.type || 'weed';
            this.qty = data.qty || 1;
            this.basePrice = data.price || 250;
            this.currentPrice = this.basePrice;
            this.riskLevel = data.risk || 'low';
            this.sessionToken = data.token || null;

            const wrap = document.getElementById('sale-wrapper');
            const statusMsg = document.getElementById('sale-status-msg');
            const actionsEl = document.getElementById('sale-actions');
            const negoBox = document.getElementById('sale-nego-box');
            const btnNego = document.getElementById('btn-sale-nego');
            const priceEl = document.getElementById('sale-price');
            const iconEl = document.getElementById('sale-icon');
            const itemNameEl = document.getElementById('sale-item-name');
            const itemQtyEl = document.getElementById('sale-item-qty');
            const riskEl = document.getElementById('sale-risk');

            if (!wrap) return;

            if (statusMsg) {
                statusMsg.className = '';
                statusMsg.style.display = 'none';
            }
            if (actionsEl) actionsEl.style.display = 'flex';
            if (negoBox) negoBox.style.display = 'none';
            if (btnNego) btnNego.style.display = 'block';
            if (priceEl) {
                priceEl.classList.remove('updated');
                priceEl.innerText = `$${this.currentPrice}`;
            }

            wrap.setAttribute('data-theme', this.type);
            if (iconEl) iconEl.innerHTML = SVG_ICONS[this.type] || SVG_ICONS.weed;
            if (itemNameEl) itemNameEl.innerText = this.type === 'coca' ? 'Pachete Coca' : (this.type === 'meth' ? 'Pachete Meth' : 'Pachete Weed');
            if (itemQtyEl) itemQtyEl.innerText = `Cantitate: ${this.qty}x`;

            if (riskEl) {
                if (this.riskLevel === 'low') {
                    riskEl.className = 's-risk risk-low';
                    riskEl.innerText = 'RISC: SCĂZUT';
                } else if (this.riskLevel === 'med') {
                    riskEl.className = 's-risk risk-med';
                    riskEl.innerText = 'RISC: MEDIU';
                } else {
                    riskEl.className = 's-risk risk-high';
                    riskEl.innerText = 'RISC: RIDICAT';
                }
            }

            wrap.classList.add('visible');
        },

        close() {
            this.visible = false;
            this.isNegotiating = false;
            cancelAnimationFrame(this.animationFrame);
            const wrap = document.getElementById('sale-wrapper');
            if (wrap) wrap.classList.remove('visible');
            fetch(`https://${GetParentResourceName()}/closeSaleUI`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
        },

        accept() {
            if (this.isNegotiating) return;
            const actionsEl = document.getElementById('sale-actions');
            const statusMsg = document.getElementById('sale-status-msg');

            if (actionsEl) actionsEl.style.display = 'none';
            if (statusMsg) {
                statusMsg.className = 'success';
                statusMsg.innerText = `Tranzacție Reușită! (+$${this.currentPrice})`;
            }

            fetch(`https://${GetParentResourceName()}/acceptDrugSale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: this.type, qty: this.qty, price: this.currentPrice, token: this.sessionToken, negotiated: this.hasNegotiated })
            }).catch(() => {});

            setTimeout(() => this.close(), 1500);
        },

        decline() {
            if (this.isNegotiating) return;
            fetch(`https://${GetParentResourceName()}/declineDrugSale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: this.sessionToken })
            }).catch(() => {});
            this.close();
        },

        startNegotiation() {
            if (this.hasNegotiated) return;
            this.isNegotiating = true;

            const actionsEl = document.getElementById('sale-actions');
            const negoBox = document.getElementById('sale-nego-box');
            const targetZoneEl = document.getElementById('sale-target-zone');

            if (actionsEl) actionsEl.style.display = 'none';
            if (negoBox) negoBox.style.display = 'flex';

            this.targetWidth = 20;
            this.targetPos = Math.random() * (100 - this.targetWidth - 10) + 5;
            if (targetZoneEl) {
                targetZoneEl.style.left = `${this.targetPos}%`;
                targetZoneEl.style.width = `${this.targetWidth}%`;
            }

            this.cursorPos = 0;
            this.cursorDir = 1;

            cancelAnimationFrame(this.animationFrame);
            this.loop();
        },

        loop() {
            if (!this.isNegotiating) return;

            this.cursorPos += this.cursorSpeed * this.cursorDir;
            if (this.cursorPos >= 100) {
                this.cursorPos = 100;
                this.cursorDir = -1;
            } else if (this.cursorPos <= 0) {
                this.cursorPos = 0;
                this.cursorDir = 1;
            }

            const cursorEl = document.getElementById('sale-cursor');
            if (cursorEl) cursorEl.style.left = `${this.cursorPos}%`;
            this.animationFrame = requestAnimationFrame(() => this.loop());
        },

        handleHit() {
            if (!this.isNegotiating) return;
            this.isNegotiating = false;
            cancelAnimationFrame(this.animationFrame);

            const isHit = (this.cursorPos >= this.targetPos && this.cursorPos <= (this.targetPos + this.targetWidth));
            const negoBox = document.getElementById('sale-nego-box');
            const actionsEl = document.getElementById('sale-actions');
            const btnNego = document.getElementById('btn-sale-nego');
            const priceEl = document.getElementById('sale-price');
            const statusMsg = document.getElementById('sale-status-msg');

            if (isHit) {
                const increase = Math.floor(this.currentPrice * 0.25);
                this.currentPrice += increase;
                if (priceEl) {
                    priceEl.innerText = `$${this.currentPrice}`;
                    priceEl.classList.add('updated');
                }

                this.hasNegotiated = true;
                if (negoBox) negoBox.style.display = 'none';
                if (actionsEl) actionsEl.style.display = 'flex';
                if (btnNego) btnNego.style.display = 'none';
            } else {
                if (negoBox) negoBox.style.display = 'none';
                if (statusMsg) {
                    statusMsg.className = 'fail';
                    statusMsg.innerText = 'Clientul s-a speriat și a plecat!';
                }

                fetch(`https://${GetParentResourceName()}/failNegotiation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: this.sessionToken, risk: this.riskLevel })
                }).catch(() => {});

                setTimeout(() => this.close(), 1500);
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // INITIALIZATION & EVENT LISTENERS
    // ─────────────────────────────────────────────────────────────
    init() {
        // Lab recipe click handlers
        document.getElementById('recipe-card-weed')?.addEventListener('click', () => this.lab.selectRecipe('weed'));
        document.getElementById('recipe-card-coca')?.addEventListener('click', () => this.lab.selectRecipe('coca'));
        document.getElementById('recipe-card-meth')?.addEventListener('click', () => this.lab.selectRecipe('meth'));

        // Lab buttons
        document.getElementById('btn-lab-start')?.addEventListener('click', () => this.lab.startGame());
        document.getElementById('btn-lab-continue')?.addEventListener('click', () => this.lab.resetUI());
        document.getElementById('lab-close-btn')?.addEventListener('click', () => this.lab.close());

        const btnHeat = document.getElementById('btn-lab-heat');
        if (btnHeat) {
            btnHeat.addEventListener('mousedown', () => this.lab.startHeating());
            btnHeat.addEventListener('mouseup', () => this.lab.stopHeating());
            btnHeat.addEventListener('mouseleave', () => this.lab.stopHeating());
        }

        // Sale buttons
        document.getElementById('btn-sale-accept')?.addEventListener('click', () => this.sale.accept());
        document.getElementById('btn-sale-nego')?.addEventListener('click', () => this.sale.startNegotiation());
        document.getElementById('btn-sale-decline')?.addEventListener('click', () => this.sale.decline());

        // Keyboard listeners
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'e') {
                if (this.harvest.visible && this.harvest.playing) {
                    this.harvest.handleHit();
                } else if (this.sale.visible && this.sale.isNegotiating) {
                    this.sale.handleHit();
                }
            } else if (e.code === 'Space' && this.lab.visible && this.lab.playing) {
                e.preventDefault();
                this.lab.startHeating();
                btnHeat?.classList.add('active');
            } else if (e.key === 'Escape') {
                if (this.lab.visible && !this.lab.playing) {
                    this.lab.close();
                } else if (this.sale.visible && !this.sale.isNegotiating) {
                    this.sale.close();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this.lab.visible) {
                this.lab.stopHeating();
                btnHeat?.classList.remove('active');
            }
        });
    }
};

// Expose globally
window.Drugs = Drugs;

// NUI Messages
window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (data.action === "showHarvest") {
        Drugs.harvest.open(data);
    } else if (data.action === "hideHarvest") {
        Drugs.harvest.close();
    } else if (data.action === "openLab") {
        Drugs.lab.open(data);
    } else if (data.action === "closeLab") {
        Drugs.lab.close();
    } else if (data.action === "openStreetSale") {
        Drugs.sale.open(data);
    } else if (data.action === "closeStreetSale") {
        Drugs.sale.close();
    }
});

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Drugs.init());
} else {
    Drugs.init();
}
