/* global post */
'use strict';

const SkinShopUI = (() => {
    const PED_BASE = 'https://docs-backend.fivem.net/peds/';

    const CATEGORIES = [
        { id: 'owned',     label: 'My Skins'   },
        { id: 'all',       label: 'All Skins'  },
        { id: 'civilian',  label: 'Civilian'   },
        { id: 'special',   label: 'Special'    },
        { id: 'premium',   label: 'Premium'    },
        { id: 'exclusive', label: 'Exclusive'  },
    ];

    let allSkins      = [];
    let activeCat     = 'owned';
    let selectedSkin  = null;
    let ready         = false;

    function $(sel) { return document.querySelector(sel); }

    function show(data) {
        init();
        allSkins     = (data && data.skins) || [];
        const startCat = (data && data.defaultCat) || 'owned';
        activeCat    = startCat;
        selectedSkin = null;

        selectCategory(startCat);
        clearDetail();

        const el = $('#skinshop');
        if (el) { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); }
    }

    function hide() {
        const el = $('#skinshop');
        if (el) { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); }
    }

    function refresh(skins) {
        allSkins = skins || [];
        renderSkinList();
        if (selectedSkin) {
            const updated = allSkins.find(s => s.model === selectedSkin.model);
            if (updated) selectSkin(updated);
        }
    }

    function selectCategory(catId) {
        activeCat = catId;
        document.querySelectorAll('#sk-cat-list .sk-cat-item').forEach(b => {
            b.classList.toggle('is-active', b.dataset.cat === catId);
        });
        const title = $('#sk-list-title');
        if (title) title.textContent = CATEGORIES.find(c => c.id === catId)?.label || 'Skins';
        renderSkinList();
    }

    function renderSkinList() {
        const list = $('#sk-skin-list');
        if (!list) return;
        list.innerHTML = '';

        let filtered = [];
        if (activeCat === 'owned') {
            filtered = allSkins.filter(s => s.owned);
            // Include default character reset option
            filtered = [
                { model: 'default', label: 'Default Character (Reset)', category: 'owned', owned: true, isDefault: true },
                ...filtered
            ];
        } else if (activeCat === 'all') {
            filtered = allSkins;
        } else {
            filtered = allSkins.filter(s => s.category === activeCat);
        }

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'sk-empty';
            empty.textContent = activeCat === 'owned' ? 'You do not own any skins yet' : 'No skins in this category';
            list.appendChild(empty);
            return;
        }

        filtered.forEach(skin => {
            const row = document.createElement('div');
            row.className = 'sk-skin-row' + (selectedSkin?.model === skin.model ? ' is-active' : '');
            row.dataset.model = skin.model;

            const priceText = skin.isDefault ? 'Original Outfit' : (skin.battlepass ? 'Battlepass' : (skin.owned ? 'Owned' : `$${(skin.priceCash || 0).toLocaleString()}`));
            let badge = '';
            if (skin.isDefault)       badge = '<span class="sk-skin-row-badge badge-owned">★</span>';
            else if (skin.owned)      badge = '<span class="sk-skin-row-badge badge-owned">✓</span>';
            else if (skin.battlepass) badge = '<span class="sk-skin-row-badge badge-bp">BP</span>';

            const thumbSrc = skin.isDefault ? '' : `${PED_BASE}${skin.model}.webp`;
            row.innerHTML = `
                <img class="sk-skin-thumb"
                     src="${thumbSrc}"
                     alt=""
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%2300ffcc\\' stroke-width=\\'1.5\\' opacity=\\'0.35\\'><path d=\\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\\'/><circle cx=\\'12\\' cy=\\'7\\' r=\\'4\\'/></svg>';"/>
                <div class="sk-skin-row-info">
                    <div class="sk-skin-row-name">${skin.label}</div>
                    <div class="sk-skin-row-price">${priceText}</div>
                </div>
                ${badge}`;
            row.addEventListener('click', () => selectSkin(skin));
            list.appendChild(row);
        });
    }

    function selectSkin(skin) {
        selectedSkin = skin;

        document.querySelectorAll('#sk-skin-list .sk-skin-row').forEach(r => {
            r.classList.toggle('is-active', r.dataset.model === skin.model);
        });

        const nameEl  = $('#sk-detail-name');
        const modelEl = $('#sk-detail-model');
        const img     = $('#sk-preview-img');
        if (nameEl)  nameEl.textContent  = skin.label;
        if (modelEl) modelEl.textContent = skin.model;
        if (img) {
            img.style.opacity = '1';
            img.src = `${PED_BASE}${skin.model}.webp`;
            img.onerror = () => { img.style.opacity = '0.1'; };
        }

        const ownedBadge = $('#sk-owned-badge');
        const bpBadge    = $('#sk-bp-badge');
        if (ownedBadge) ownedBadge.classList.toggle('hidden', !skin.owned);
        if (bpBadge)    bpBadge.classList.toggle('hidden', !skin.battlepass);

        const priceBlock = $('#sk-price-block');
        if (priceBlock) priceBlock.classList.toggle('hidden', !!skin.battlepass);
        if (!skin.battlepass) {
            const cashEl = $('#sk-price-cash');
            const ppEl   = $('#sk-price-pp');
            if (cashEl) cashEl.textContent = `$${(skin.priceCash || 0).toLocaleString()}`;
            if (ppEl)   ppEl.textContent   = `${skin.pricePP || 0} PP`;
        }

        const btnCash  = $('#sk-detail-btn-cash');
        const btnPP    = $('#sk-detail-btn-pp');
        const btnEquip = $('#sk-detail-btn-equip');

        if (skin.isDefault) {
            btnCash?.classList.add('hidden');
            btnPP?.classList.add('hidden');
            if (priceBlock) priceBlock.classList.add('hidden');
            if (btnEquip) {
                btnEquip.classList.remove('hidden');
                btnEquip.disabled = false;
                btnEquip.textContent = I18n.t('dynamic.skinshop.reset_to_original_outfit');
            }
        } else if (skin.owned) {
            btnCash?.classList.add('hidden');
            btnPP?.classList.add('hidden');
            if (priceBlock) priceBlock.classList.add('hidden');
            if (btnEquip) {
                btnEquip.classList.remove('hidden');
                btnEquip.disabled = false;
                btnEquip.textContent = I18n.t('dynamic.skinshop.equip_skin');
            }
        } else if (skin.battlepass) {
            btnCash?.classList.add('hidden');
            btnPP?.classList.add('hidden');
            btnEquip?.classList.add('hidden');
        } else {
            if (btnCash)  { btnCash.classList.remove('hidden');  btnCash.disabled  = false; }
            if (btnPP)    { btnPP.classList.remove('hidden');    btnPP.disabled    = false; }
            btnEquip?.classList.add('hidden');
        }
    }

    function clearDetail() {
        selectedSkin = null;
        const nameEl = $('#sk-detail-name');
        if (nameEl) nameEl.textContent = '—';
        const modelEl = $('#sk-detail-model');
        if (modelEl) modelEl.textContent = '';
        const img = $('#sk-preview-img');
        if (img) { img.src = ''; img.style.opacity = '0'; }
        $('#sk-owned-badge')?.classList.add('hidden');
        $('#sk-bp-badge')?.classList.add('hidden');
        $('#sk-price-block')?.classList.add('hidden');
        $('#sk-detail-btn-cash')?.classList.add('hidden');
        $('#sk-detail-btn-pp')?.classList.add('hidden');
        $('#sk-detail-btn-equip')?.classList.add('hidden');
    }

    function init() {
        if (ready) return;
        ready = true;

        // Build category buttons
        const catList = $('#sk-cat-list');
        if (catList) {
            CATEGORIES.forEach(cat => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'sk-cat-item' + (cat.id === 'all' ? ' is-active' : '');
                btn.dataset.cat = cat.id;
                btn.textContent = cat.label;
                catList.appendChild(btn);
            });
            catList.addEventListener('click', e => {
                const btn = e.target.closest('[data-cat]');
                if (btn) selectCategory(btn.dataset.cat);
            });
        }

        $('#sk-detail-btn-cash')?.addEventListener('click', () => {
            if (!selectedSkin || selectedSkin.owned || selectedSkin.battlepass) return;
            post('skinShopBuy', { model: selectedSkin.model, currency: 'cash' });
        });
        $('#sk-detail-btn-pp')?.addEventListener('click', () => {
            if (!selectedSkin || selectedSkin.owned || selectedSkin.battlepass) return;
            post('skinShopBuy', { model: selectedSkin.model, currency: 'pp' });
        });
        $('#sk-detail-btn-equip')?.addEventListener('click', () => {
            if (!selectedSkin || !selectedSkin.owned) return;
            post('skinShopEquip', { model: selectedSkin.model });
        });

        document.addEventListener('keydown', e => {
            if ($('#skinshop')?.classList.contains('hidden')) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                hide();
                post('skinShopClose');
            }
        });
    }

    return { show, hide, refresh };
})();

window.SkinShopUI = SkinShopUI;
