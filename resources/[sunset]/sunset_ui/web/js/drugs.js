/* ═══════════════════════════════════════════════════════════════
   SUNSETMP — DRUG SYSTEM CONTROLLER (Harvest, Lab, Street Sale)
   Matches design templates 1:1 with real item icons, rich badges & security.
   ═══════════════════════════════════════════════════════════════ */

const ITEM_CONFIG = {
    weed_leaf: { get label() { return I18n.t('interface.cannabis_leaves'); }, img: 'assets/items/weed_leaf.webp' },
    coke_leaf: { get label() { return I18n.t('interface.coca_leaves'); }, img: 'assets/items/coke_leaf.webp' },
    meth_chemical: { get label() { return I18n.t('interface.chemical_precursors'); }, img: 'assets/items/meth_chemical.webp' },
    chemicals: { get label() { return I18n.t('interface.chemicals'); }, img: 'assets/items/chemicals.webp' },
    weed_brick: { get label() { return I18n.t('interface.cannabis_packages'); }, img: 'assets/items/weed_brick.webp', value: 250 },
    coke_brick: { get label() { return I18n.t('interface.cocaine_powder'); }, img: 'assets/items/coke_brick.webp', value: 800 },
    meth_bag: { get label() { return I18n.t('interface.meth_crystals'); }, img: 'assets/items/meth_bag.webp', value: 1200 },
};

function getItemMeta(key) {
    if (ITEM_CONFIG[key]) return ITEM_CONFIG[key];
    const clean = key ? key.toLowerCase() : '';
    if (clean.includes('coke') || clean.includes('coca')) {
        return clean.includes('brick') ? ITEM_CONFIG.coke_brick : ITEM_CONFIG.coke_leaf;
    }
    if (clean.includes('meth')) {
        return clean.includes('bag') ? ITEM_CONFIG.meth_bag : ITEM_CONFIG.meth_chemical;
    }
    if (clean.includes('chem')) return ITEM_CONFIG.chemicals;
    return ITEM_CONFIG.weed_brick;
}

const SVG_ICONS = {
    weed: `<svg viewBox="0 0 24 24"><path d="M17.5 11c-1.3 0-2.6-.4-3.7-1.1L12 8.7 10.2 9.9c-1.1.7-2.4 1.1-3.7 1.1C3.5 11 1 8.5 1 5.5v-1l2 .5c1.8.4 3.7 0 5.1-1.1L10 .2h4l1.9 3.7c1.4 1.1 3.3 1.5 5.1 1.1l2-.5v1C23 8.5 20.5 11 17.5 11zM12 11c-2.8 0-5 2.2-5 5v5h10v-5c0-2.8-2.2-5-5-5z"></path></svg>`,
    coca: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`,
    coke: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`,
    meth: `<svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`
};

function postToResource(action, data = {}) {
    // The controller is hosted by sunset_ui, but sunset_drugs owns these
    // callbacks. Send exactly one request so economic actions cannot duplicate.
    return fetch(`https://sunset_drugs/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then((response) => response.json()).catch(() => ({ success: false }));
}

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
            this.currentAmount = Number(data.amount) || 0;
            this.maxAmount = Number(data.maxAmount) || 50;
            this.sessionToken = data.token || null;
            this.negotiationChallenge = data.negotiation || null;
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

            wrap.classList.remove('hit-success', 'hit-fail');
            wrap.classList.add('visible');

            const typeLabel = (this.type === 'coca' || this.type === 'coke') ? 'Recoltare Coca' : (this.type === 'meth' ? 'Recoltare Precursori Chimici' : 'Recoltare Cannabis');
            if (titleEl) titleEl.innerText = typeLabel;

            const iconSrc = (this.type === 'coca' || this.type === 'coke') 
                ? 'assets/items/coke_leaf.webp' 
                : (this.type === 'meth' ? 'assets/items/meth_chemical.webp' : 'assets/items/weed_leaf.webp');

            if (iconEl) {
                iconEl.innerHTML = `<img src="${iconSrc}" style="width: 32px; height: 32px; object-fit: contain;" alt="${this.type}" onerror="this.onerror=null; this.src='assets/items/weed_leaf.webp';">`;
            }
            if (instrEl) instrEl.innerHTML = I18n.t('ui.drugs.press_e_marked_area');


            this.randomizeTarget();
            this.updateUI();

            if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
            this.loop();
        },

        close() {
            this.visible = false;
            this.playing = false;
            if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
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
                if (wrap) {
                    wrap.classList.remove('hit-fail');
                    wrap.classList.add('hit-success');
                }
                if (this.currentAmount < this.maxAmount) {
                    this.currentAmount++;
                    this.cursorSpeed = Math.min(this.cursorSpeed + 0.05, 2.8);
                    this.targetWidth = Math.max(this.targetWidth - 0.5, 12);
                    
                    postToResource('giveHarvestItem', { type: this.type, token: this.sessionToken });
                }

                if (this.currentAmount >= this.maxAmount) {
                    this.playing = false;
                    const instrEl = document.getElementById('harvest-instruction');
                    if (instrEl) instrEl.innerText = I18n.t('interface.your_backpack_is_full');
                }
            } else {
                if (wrap) {
                    wrap.classList.remove('hit-success');
                    wrap.classList.add('hit-fail');
                }
                postToResource('failHarvestHit', { type: this.type, token: this.sessionToken });
            }

            this.updateUI();

            setTimeout(() => {
                if (wrap) wrap.classList.remove('hit-success', 'hit-fail');
                if (this.playing) {
                    this.isWaitingFeedback = false;
                    this.randomizeTarget();
                    this.loop();
                }
            }, 320);
        }
    },

    // ─────────────────────────────────────────────────────────────
    // 2. CLANDESTINE LAB PROCESSING CONTROLLER
    // ─────────────────────────────────────────────────────────────
    lab: {
        visible: false,
        sessionToken: null,
        inventory: {},
        recipes: {},
        selectedRecipeKey: null,
        isPlayingMinigame: false,

        // Minigame state
        temp: 0,
        targetTemp: 50,
        targetZoneHeight: 22,
        progress: 0,
        isHeating: false,
        animFrame: null,

        open(data) {
            this.visible = true;
            this.sessionToken = data.token || null;
            this.inventory = data.inventory || {};
            this.recipes = data.recipes || {
                weed: {
                    get label() { return I18n.t('interface.cannabis_packages'); },
                    rawItem: 'weed_leaf',
                    rawCount: 5,
                    productItem: 'weed_brick',
                    productCount: 1,
                    difficulty: 'easy',
                },
                coca: {
                    get label() { return I18n.t('interface.cocaine_powder'); },
                    rawItem: 'coke_leaf',
                    rawCount: 5,
                    secondaryItem: 'chemicals',
                    secondaryCount: 1,
                    productItem: 'coke_brick',
                    productCount: 1,
                    difficulty: 'medium',
                },
                meth: {
                    get label() { return I18n.t('interface.meth_crystals'); },
                    rawItem: 'meth_chemical',
                    rawCount: 3,
                    secondaryItem: 'chemicals',
                    secondaryCount: 1,
                    productItem: 'meth_bag',
                    productCount: 1,
                    difficulty: 'hard',
                },
            };

            const wrap = document.getElementById('lab-wrapper');
            if (!wrap) return;

            this.renderRecipeList();
            
            // Select first recipe by default or clear selection
            const firstKey = Object.keys(this.recipes)[0];
            if (firstKey) {
                this.selectRecipe(firstKey);
            } else {
                this.showEmptyState();
            }

            wrap.classList.add('visible');
        },

        close() {
            this.visible = false;
            this.isPlayingMinigame = false;
            this.isHeating = false;
            if (this.animFrame) cancelAnimationFrame(this.animFrame);

            const wrap = document.getElementById('lab-wrapper');
            if (wrap) wrap.classList.remove('visible');

            postToResource('closeMenu', {});
            postToResource('drugsCloseMenu', {});
        },

        showEmptyState() {
            const emptyEl = document.getElementById('lab-empty-state');
            const activeEl = document.getElementById('lab-active-state');
            if (emptyEl) emptyEl.style.display = 'flex';
            if (activeEl) activeEl.style.display = 'none';
        },

        checkHasMaterials(recipe) {
            if (!recipe) return false;
            const rawHave = Number(this.inventory[recipe.rawItem]) || 0;
            if (rawHave < (recipe.rawCount || 1)) return false;

            if (recipe.secondaryItem && recipe.secondaryCount > 0) {
                const secHave = Number(this.inventory[recipe.secondaryItem]) || 0;
                if (secHave < recipe.secondaryCount) return false;
            }
            return true;
        },

        renderRecipeList() {
            const container = document.getElementById('lab-recipe-list');
            if (!container) return;
            container.innerHTML = '';

            Object.entries(this.recipes).forEach(([key, recipe]) => {
                const productMeta = getItemMeta(recipe.productItem || key);
                const rawMeta = getItemMeta(recipe.rawItem);
                const secMeta = recipe.secondaryItem ? getItemMeta(recipe.secondaryItem) : null;

                const rawHave = Number(this.inventory[recipe.rawItem]) || 0;
                const rawNeeded = Number(recipe.rawCount) || 1;
                const hasRaw = rawHave >= rawNeeded;

                let hasSec = true;
                let secHave = 0;
                let secNeeded = 0;
                if (secMeta && recipe.secondaryCount > 0) {
                    secHave = Number(this.inventory[recipe.secondaryItem]) || 0;
                    secNeeded = Number(recipe.secondaryCount) || 1;
                    hasSec = secHave >= secNeeded;
                }

                const isReady = hasRaw && hasSec;
                const isSelected = this.selectedRecipeKey === key;

                const card = document.createElement('div');
                card.className = `lab-card ${isSelected ? 'selected' : ''}`;
                card.dataset.key = key;

                let diffClass = 'diff-easy';
                let diffLabel = I18n.t('ui.drugs.difficulty_easy');
                if (recipe.difficulty === 'medium') { diffClass = 'diff-medium'; diffLabel = I18n.t('ui.drugs.difficulty_medium'); }
                else if (recipe.difficulty === 'hard') { diffClass = 'diff-hard'; diffLabel = I18n.t('ui.drugs.difficulty_hard'); }

                card.innerHTML = `
                    <div class="lab-card-top">
                        <div class="lab-card-thumb">
                            <img src="${productMeta.img}" alt="${recipe.label}" onerror="this.onerror=null; this.src='assets/items/weed_brick.webp';">
                        </div>
                        <div class="lab-card-header">
                            <div class="lab-card-name">${recipe.label}</div>
                            <div class="lab-card-diff ${diffClass}">${I18n.t('ui.drugs.difficulty_label', { difficulty: diffLabel })}</div>
                        </div>
                    </div>
                    <div class="lab-card-ingredients">
                        <div class="ing-tag">
                            <img src="${rawMeta.img}" alt="${rawMeta.label}">
                            <span>${rawMeta.label}</span>
                            <span class="ing-badge ${hasRaw ? 'ok' : 'missing'}">${rawHave}/${rawNeeded}</span>
                        </div>
                        ${secMeta ? `
                            <div class="ing-tag">
                                <img src="${secMeta.img}" alt="${secMeta.label}">
                                <span>${secMeta.label}</span>
                                <span class="ing-badge ${hasSec ? 'ok' : 'missing'}">${secHave}/${secNeeded}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="lab-card-status ${isReady ? 'ready' : 'missing'}">
                        ${isReady ? '● DISPONIBIL PENTRU SINTEZA' : '○ LIPSESC MATERIALE'}
                    </div>
                `;

                card.addEventListener('click', () => {
                    this.selectRecipe(key);
                });

                container.appendChild(card);
            });
        },

        selectRecipe(key) {
            this.selectedRecipeKey = key;
            const recipe = this.recipes[key];
            if (!recipe) return;

            // Highlight cards
            document.querySelectorAll('.lab-card').forEach((el) => {
                el.classList.toggle('selected', el.dataset.key === key);
            });

            const emptyEl = document.getElementById('lab-empty-state');
            const activeEl = document.getElementById('lab-active-state');
            const detailsView = document.getElementById('lab-details-view');
            const gameView = document.getElementById('lab-game-view');
            const overlay = document.getElementById('lab-game-overlay');

            if (emptyEl) emptyEl.style.display = 'none';
            if (activeEl) activeEl.style.display = 'flex';
            if (detailsView) detailsView.style.display = 'block';
            if (gameView) gameView.style.display = 'none';
            if (overlay) overlay.style.display = 'none';

            this.renderDetailsView(recipe);
        },

        renderDetailsView(recipe) {
            const productMeta = getItemMeta(recipe.productItem);
            const rawMeta = getItemMeta(recipe.rawItem);
            const secMeta = recipe.secondaryItem ? getItemMeta(recipe.secondaryItem) : null;

            const productImg = document.getElementById('lab-product-img');
            const productName = document.getElementById('lab-product-name');
            const yieldText = document.getElementById('lab-yield-text');
            const valText = document.getElementById('lab-val-text');
            const diffText = document.getElementById('lab-diff-text');
            const statusText = document.getElementById('lab-status-text');
            const btnStart = document.getElementById('btn-lab-start');
            const ingList = document.getElementById('lab-ingredients-list');

            if (productImg) productImg.src = productMeta.img;
            if (productName) productName.innerText = recipe.label;
            if (yieldText) yieldText.innerText = `${recipe.productCount || 1}x ${productMeta.label}`;
            if (valText) valText.innerText = `~$${productMeta.value || 300}`;

            let diffLabel = I18n.t('ui.drugs.difficulty_easy');
            if (recipe.difficulty === 'medium') diffLabel = I18n.t('ui.drugs.difficulty_medium');
            else if (recipe.difficulty === 'hard') diffLabel = I18n.t('ui.drugs.difficulty_hard');
            if (diffText) diffText.innerText = diffLabel;

            const isReady = this.checkHasMaterials(recipe);
            if (statusText) {
                statusText.innerText = isReady ? I18n.t('interface.available') : I18n.t('ui.drugs.materials_missing');
                statusText.style.color = isReady ? 'var(--drug-good)' : 'var(--drug-bad)';
            }

            if (btnStart) {
                btnStart.disabled = !isReady;
                btnStart.innerText = isReady ? I18n.t('interface.start_processing') : I18n.t('ui.drugs.insufficient_raw_material');
                btnStart.onclick = (e) => {
                    e.preventDefault();
                    if (isReady) this.startMinigame();
                };
            }


            // Build detailed ingredients checklist
            if (ingList) {
                ingList.innerHTML = '';

                // Raw Material Card
                const rawHave = Number(this.inventory[recipe.rawItem]) || 0;
                const rawNeeded = Number(recipe.rawCount) || 1;
                const rawOk = rawHave >= rawNeeded;
                const rawCard = document.createElement('div');
                rawCard.className = 'ing-row-card';
                rawCard.innerHTML = `
                    <div class="ing-row-left">
                        <div class="ing-row-thumb">
                            <img src="${rawMeta.img}" alt="${rawMeta.label}" onerror="this.onerror=null; this.src='assets/items/weed_leaf.webp';">
                        </div>
                        <div class="ing-row-info">
                            <div class="ing-row-name">${rawMeta.label}</div>
                            <div class="ing-row-count">${I18n.t('ui.drugs.inventory_required', { have: rawHave, needed: rawNeeded })}</div>
                        </div>
                    </div>
                    <div class="ing-row-right">
                        <span class="ing-stock-badge ${rawOk ? 'ready' : 'missing'}">${rawOk ? I18n.t('ui.drugs.ready') : I18n.t('ui.drugs.missing')}</span>
                    </div>
                `;
                ingList.appendChild(rawCard);

                // Secondary Material Card (if needed)
                if (secMeta && recipe.secondaryCount > 0) {
                    const secHave = Number(this.inventory[recipe.secondaryItem]) || 0;
                    const secNeeded = Number(recipe.secondaryCount) || 1;
                    const secOk = secHave >= secNeeded;
                    const secCard = document.createElement('div');
                    secCard.className = 'ing-row-card';
                    secCard.innerHTML = `
                        <div class="ing-row-left">
                            <div class="ing-row-thumb">
                                <img src="${secMeta.img}" alt="${secMeta.label}" onerror="this.onerror=null; this.src='assets/items/chemicals.webp';">
                            </div>
                            <div class="ing-row-info">
                                <div class="ing-row-name">${secMeta.label}</div>
                                <div class="ing-row-count">${I18n.t('ui.drugs.inventory_required', { have: secHave, needed: secNeeded })}</div>
                            </div>
                        </div>
                        <div class="ing-row-right">
                            <span class="ing-stock-badge ${secOk ? 'ready' : 'missing'}">${secOk ? '✓ GATA' : '✗ LIPSA'}</span>
                        </div>
                    `;
                    ingList.appendChild(secCard);
                }
            }
        },

        startMinigame() {
            const recipe = this.recipes[this.selectedRecipeKey];
            if (!recipe || !this.checkHasMaterials(recipe)) return;

            this.isPlayingMinigame = true;
            this.temp = 10;
            this.progress = 0;
            this.isHeating = false;

            const detailsView = document.getElementById('lab-details-view');
            const gameView = document.getElementById('lab-game-view');
            const overlay = document.getElementById('lab-game-overlay');

            if (detailsView) detailsView.style.display = 'none';
            if (gameView) gameView.style.display = 'block';
            if (overlay) overlay.style.display = 'none';

            // Target temperature band
            const diff = recipe.difficulty || 'medium';
            if (diff === 'easy') {
                this.targetZoneHeight = 26;
                this.targetTemp = 35 + (Math.random() * 30);
            } else if (diff === 'hard') {
                this.targetZoneHeight = 16;
                this.targetTemp = 40 + (Math.random() * 35);
            } else {
                this.targetZoneHeight = 20;
                this.targetTemp = 35 + (Math.random() * 35);
            }

            const targetZone = document.getElementById('lab-target-zone');
            if (targetZone) {
                targetZone.style.bottom = `${this.targetTemp}%`;
                targetZone.style.height = `${this.targetZoneHeight}%`;
            }

            const titleEl = document.getElementById('lab-process-title');
            if (titleEl) titleEl.innerText = I18n.t('ui.drugs.synthesis_title', { item: recipe.label });

            if (this.animFrame) cancelAnimationFrame(this.animFrame);
            this.minigameLoop();
        },

        minigameLoop() {
            if (!this.isPlayingMinigame) return;

            // Physics: Heating increases temp, ambient cools it down
            if (this.isHeating) {
                this.temp = Math.min(100, this.temp + 1.25);
            } else {
                this.temp = Math.max(0, this.temp - 0.75);
            }

            const inZone = (this.temp >= this.targetTemp && this.temp <= (this.targetTemp + this.targetZoneHeight));

            if (inZone) {
                this.progress += 0.38; // Progress advances while temperature is inside stable zone
            } else {
                if (this.temp > (this.targetTemp + this.targetZoneHeight + 15)) {
                    // Overheated dangerous spike
                    this.progress = Math.max(0, this.progress - 0.15);
                }
            }

            const gaugeEl = document.getElementById('lab-temp-gauge');
            const fillEl = document.getElementById('lab-temp-fill');
            const progFill = document.getElementById('lab-prog-fill');
            const progText = document.getElementById('lab-prog-text');

            if (fillEl) fillEl.style.height = `${this.temp}%`;
            if (gaugeEl) gaugeEl.classList.toggle('in-zone', inZone);

            const displayPct = Math.min(100, Math.floor(this.progress));
            if (progFill) progFill.style.width = `${displayPct}%`;
            if (progText) progText.innerText = `${displayPct}%`;

            if (this.progress >= 100) {
                this.endMinigame(true);
                return;
            }

            this.animFrame = requestAnimationFrame(() => this.minigameLoop());
        },

        endMinigame(success) {
            this.isPlayingMinigame = false;
            this.isHeating = false;
            if (this.animFrame) cancelAnimationFrame(this.animFrame);

            const overlay = document.getElementById('lab-game-overlay');
            const resIcon = document.getElementById('lab-res-icon');
            const resTitle = document.getElementById('lab-res-title');
            const resDesc = document.getElementById('lab-res-desc');
            const recipe = this.recipes[this.selectedRecipeKey];

            if (overlay) overlay.style.display = 'flex';

            if (success && recipe) {
                if (resIcon) { resIcon.innerText = '✓'; resIcon.className = 'overlay-icon'; }
                if (resTitle) { resTitle.innerText = I18n.t('interface.success'); resTitle.className = 'overlay-title'; }
                if (resDesc) resDesc.innerText = I18n.t('ui.drugs.synthesis_success', { item: recipe.label });

                // Update local inventory state
                this.inventory[recipe.rawItem] = Math.max(0, (this.inventory[recipe.rawItem] || 0) - recipe.rawCount);
                if (recipe.secondaryItem && recipe.secondaryCount > 0) {
                    this.inventory[recipe.secondaryItem] = Math.max(0, (this.inventory[recipe.secondaryItem] || 0) - recipe.secondaryCount);
                }
                this.inventory[recipe.productItem] = (this.inventory[recipe.productItem] || 0) + (recipe.productCount || 1);

                postToResource('processSuccess', { token: this.sessionToken, type: this.selectedRecipeKey });
            } else {
                if (resIcon) { resIcon.innerText = '✕'; resIcon.className = 'overlay-icon fail'; }
                if (resTitle) { resTitle.innerText = I18n.t('interface.failed'); resTitle.className = 'overlay-title fail'; }
                if (resDesc) resDesc.innerText = I18n.t('interface.the_chemical_reaction_failed_due_to_unstable_temperature');

                if (recipe) {
                    this.inventory[recipe.rawItem] = Math.max(0, (this.inventory[recipe.rawItem] || 0) - 1);
                }

                postToResource('processFail', { token: this.sessionToken, type: this.selectedRecipeKey });
            }

            this.renderRecipeList();
        }
    },

    // ─────────────────────────────────────────────────────────────
    // 3. STREET SALE CONTROLLER
    // ─────────────────────────────────────────────────────────────
    sale: {
        visible: false,
        isNegotiating: false,
        hasNegotiated: false,
        type: 'weed',
        qty: 1,
        basePrice: 250,
        currentPrice: 250,
        riskLevel: 'low',
        sessionToken: null,
        cursorPos: 0,
        cursorDir: 1,
        cursorSpeed: 2.2,
        targetPos: 0,
        targetWidth: 20,
        animationFrame: null,

        open(data) {
            this.visible = true;
            this.isNegotiating = false;
            this.hasNegotiated = false;
            this.type = data.type || 'weed';
            this.qty = Number(data.qty) || 1;
            this.basePrice = Number(data.price) || 250;
            this.currentPrice = this.basePrice;
            this.riskLevel = data.risk || 'low';
            this.sessionToken = data.token || null;

            const wrap = document.getElementById('sale-wrapper');
            const statusMsg = document.getElementById('sale-status-msg');
            const actionsEl = document.getElementById('sale-actions');
            const negoBox = document.getElementById('sale-nego-box');
            const btnNego = document.getElementById('btn-sale-nego');
            const priceEl = document.getElementById('sale-price');
            const drugImg = document.getElementById('sale-drug-img');
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

            const itemMeta = getItemMeta(this.type === 'coca' || this.type === 'coke' ? 'coke_brick' : (this.type === 'meth' ? 'meth_bag' : 'weed_brick'));
            wrap.setAttribute('data-theme', this.type);
            if (drugImg) drugImg.src = itemMeta.img;
            if (itemNameEl) itemNameEl.innerText = itemMeta.label;
            if (itemQtyEl) itemQtyEl.innerText = I18n.t('ui.drugs.quantity', { quantity: this.qty });

            if (riskEl) {
                if (this.riskLevel === 'low') {
                    riskEl.className = 's-risk risk-low';
                    riskEl.innerText = I18n.t('interface.risk_low');
                } else if (this.riskLevel === 'med') {
                    riskEl.className = 's-risk risk-med';
                    riskEl.innerText = I18n.t('interface.risk_medium');
                } else {
                    riskEl.className = 's-risk risk-high';
                    riskEl.innerText = I18n.t('interface.risk_high');
                }
            }

            wrap.classList.add('visible');
        },

        close() {
            this.visible = false;
            this.isNegotiating = false;
            if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
            const wrap = document.getElementById('sale-wrapper');
            if (wrap) wrap.classList.remove('visible');

            postToResource('closeSaleUI', {});
        },

        accept() {
            if (this.isNegotiating) return;
            const actionsEl = document.getElementById('sale-actions');
            const statusMsg = document.getElementById('sale-status-msg');

            if (actionsEl) actionsEl.style.display = 'none';
            if (statusMsg) {
                statusMsg.className = 'success';
                statusMsg.innerText = I18n.t('ui.drugs.transaction_success', { amount: this.currentPrice });
                statusMsg.style.display = 'block';
            }

            postToResource('acceptDrugSale', {
                type: this.type,
                qty: this.qty,
                price: this.currentPrice,
                token: this.sessionToken,
                negotiated: this.hasNegotiated
            });

            setTimeout(() => this.close(), 1500);
        },

        decline() {
            if (this.isNegotiating) return;
            postToResource('declineDrugSale', { token: this.sessionToken });
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

            this.targetWidth = Number(this.negotiationChallenge?.targetWidth) || 20;
            this.targetPos = Number(this.negotiationChallenge?.targetPos);
            if (!Number.isFinite(this.targetPos)) return this.close();
            if (targetZoneEl) {
                targetZoneEl.style.left = `${this.targetPos}%`;
                targetZoneEl.style.width = `${this.targetWidth}%`;
            }

            this.cursorPos = 0;
            this.cursorDir = 1;

            if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
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

        async handleNegotiationHit() {
            if (!this.isNegotiating) return;
            this.isNegotiating = false;
            this.hasNegotiated = true;
            if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

            const result = await postToResource('resolveNegotiation', {
                token: this.sessionToken,
                challengeToken: this.negotiationChallenge?.token,
                cursorPos: this.cursorPos,
            });
            const isHit = result?.success === true;
            const negoBox = document.getElementById('sale-nego-box');
            const actionsEl = document.getElementById('sale-actions');
            const statusMsg = document.getElementById('sale-status-msg');
            const btnNego = document.getElementById('btn-sale-nego');
            const priceEl = document.getElementById('sale-price');

            if (negoBox) negoBox.style.display = 'none';

            if (isHit) {
                // Success: +25% payout bonus
                this.currentPrice = Math.floor(this.basePrice * 1.25);
                if (priceEl) {
                    priceEl.innerText = `$${this.currentPrice}`;
                    priceEl.classList.add('updated');
                }
                if (statusMsg) {
                    statusMsg.className = 'success';
                    statusMsg.innerText = I18n.t('interface.negotiation_successful_price_increased_by_25');
                    statusMsg.style.display = 'block';
                }
                if (btnNego) btnNego.style.display = 'none';
                if (actionsEl) actionsEl.style.display = 'flex';
            } else {
                // Fail: Deal canceled
                if (statusMsg) {
                    statusMsg.className = 'fail';
                    statusMsg.innerText = I18n.t('interface.the_customer_was_scared_off_by_your_persistence_and_cancelled_the_deal');
                    statusMsg.style.display = 'block';
                }
                postToResource('failNegotiation', { token: this.sessionToken });
                setTimeout(() => this.close(), 1800);
            }
        }
    }
};

window.Drugs = Drugs;

// Event Listeners for Keyboard & Controls
document.addEventListener('keydown', (e) => {
    // Harvest hit on E
    if (e.key === 'e' || e.key === 'E') {
        if (Drugs.harvest.visible) {
            Drugs.harvest.handleHit();
        }
    }

    // Lab heating on Space
    if (e.code === 'Space') {
        if (Drugs.lab.visible && Drugs.lab.isPlayingMinigame) {
            e.preventDefault();
            Drugs.lab.isHeating = true;
            const btn = document.getElementById('btn-lab-heat');
            if (btn) btn.classList.add('active');
        }
    }

    // Escape closes modals
    if (e.key === 'Escape') {
        if (Drugs.lab.visible) Drugs.lab.close();
        if (Drugs.sale.visible) Drugs.sale.close();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        if (Drugs.lab.visible) {
            Drugs.lab.isHeating = false;
            const btn = document.getElementById('btn-lab-heat');
            if (btn) btn.classList.remove('active');
        }
    }
});

// Global Event Delegation for all dynamically injected Lab & Sale controls
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .btn-action, .btn-deal, .lab-close-btn');
    if (!target) return;

    if (target.id === 'btn-lab-start') {
        e.preventDefault();
        Drugs.lab.startMinigame();
    } else if (target.id === 'lab-close-btn') {
        e.preventDefault();
        Drugs.lab.close();
    } else if (target.id === 'btn-lab-continue') {
        e.preventDefault();
        const overlay = document.getElementById('lab-game-overlay');
        const detailsView = document.getElementById('lab-details-view');
        const gameView = document.getElementById('lab-game-view');
        if (overlay) overlay.style.display = 'none';
        if (gameView) gameView.style.display = 'none';
        if (detailsView) detailsView.style.display = 'block';
        if (Drugs.lab.selectedRecipeKey) Drugs.lab.selectRecipe(Drugs.lab.selectedRecipeKey);
    } else if (target.id === 'btn-sale-accept') {
        e.preventDefault();
        Drugs.sale.accept();
    } else if (target.id === 'btn-sale-nego') {
        e.preventDefault();
        Drugs.sale.startNegotiation();
    } else if (target.id === 'btn-sale-decline') {
        e.preventDefault();
        Drugs.sale.decline();
    } else if (target.id === 'btn-sale-hit') {
        e.preventDefault();
        Drugs.sale.handleNegotiationHit();
    }
});

// Heat button hold events (mouse and touch)
document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('#btn-lab-heat');
    if (btn && Drugs.lab.visible && Drugs.lab.isPlayingMinigame) {
        Drugs.lab.isHeating = true;
        btn.classList.add('active');
    }
});

document.addEventListener('mouseup', () => {
    if (Drugs.lab.visible) {
        Drugs.lab.isHeating = false;
        const btn = document.getElementById('btn-lab-heat');
        if (btn) btn.classList.remove('active');
    }
});

document.addEventListener('touchstart', (e) => {
    const btn = e.target.closest('#btn-lab-heat');
    if (btn && Drugs.lab.visible && Drugs.lab.isPlayingMinigame) {
        Drugs.lab.isHeating = true;
        btn.classList.add('active');
    }
}, { passive: true });

document.addEventListener('touchend', () => {
    if (Drugs.lab.visible) {
        Drugs.lab.isHeating = false;
        const btn = document.getElementById('btn-lab-heat');
        if (btn) btn.classList.remove('active');
    }
}, { passive: true });
