'use strict';

const PED_IMG_BASE = 'https://docs-backend.fivem.net/peds/';

let allSkins      = [];
let activeFilter  = 'all';
let pendingAction = false;

const overlay  = document.getElementById('overlay');
const grid     = document.getElementById('grid');
const closeBtn = document.getElementById('closeBtn');

function resourceName() {
    return typeof GetParentResourceName === 'function'
        ? GetParentResourceName()
        : 'sunset_skins';
}

async function nuiPost(endpoint, payload) {
    const res = await fetch(`https://${resourceName()}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });
    return res.json();
}

function renderGrid() {
    grid.innerHTML = '';

    const list = activeFilter === 'all'
        ? allSkins
        : allSkins.filter(s => s.category === activeFilter);

    if (list.length === 0) {
        grid.innerHTML = `<p class="no-skins">${I18n.t('skinshop.no_category')}</p>`;
        return;
    }

    list.forEach(skin => {
        const card = document.createElement('div');
        card.className = 'skin-card'
            + (skin.owned ? ' owned' : '')
            + (skin.battlepass ? ' bp' : '');

        // Badge
        let badge = '';
        if (skin.owned)           badge = '<span class="skin-badge badge-owned">Owned</span>';
        else if (skin.battlepass) badge = '<span class="skin-badge badge-bp">Battlepass</span>';

        // Price row
        let prices = '';
        if (!skin.battlepass) {
            prices = `
                <div class="skin-prices">
                    <span class="price-cash">$${skin.priceCash.toLocaleString()}</span>
                    <span class="price-sep">|</span>
                    <span class="price-pp">${skin.pricePP} PP</span>
                </div>`;
        }

        // Action buttons
        let actions = '';
        if (skin.owned) {
            actions = `<button class="btn btn-equip" data-model="${skin.model}" data-action="equip">Equip</button>`;
        } else if (!skin.battlepass) {
            actions = `
                <button class="btn btn-cash" data-model="${skin.model}" data-action="buy" data-currency="cash">Buy Cash</button>
                <button class="btn btn-pp"   data-model="${skin.model}" data-action="buy" data-currency="pp">Buy PP</button>`;
        }

        card.innerHTML = `
            <div class="skin-preview">
                <img src="${PED_IMG_BASE}${skin.model}.webp"
                     alt="${skin.label}"
                     loading="lazy"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
                <div class="skin-preview-fallback" style="display:none">?</div>
            </div>
            <div class="skin-info">
                <div class="skin-label">${skin.label}</div>
                <div class="skin-model">${skin.model}</div>
                <div class="skin-cat">${skin.category}</div>
                ${badge}
                ${prices}
                <div class="skin-actions">${actions}</div>
            </div>`;
        grid.appendChild(card);
    });
}

async function handleAction(btn) {
    if (pendingAction) return;
    const action   = btn.dataset.action;
    const model    = btn.dataset.model;
    const currency = btn.dataset.currency;

    pendingAction = true;
    btn.disabled  = true;

    if (action === 'buy') {
        const data = await nuiPost('buy', { model, currency });
        if (data.success && data.skins) {
            allSkins = data.skins;
            renderGrid();
        }
    } else if (action === 'equip') {
        await nuiPost('equip', { model });
    }

    btn.disabled  = false;
    pendingAction = false;
}

grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) handleAction(btn);
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.cat;
        renderGrid();
    });
});

closeBtn.addEventListener('click', () => nuiPost('close'));

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        nuiPost('close');
    }
});

window.addEventListener('message', e => {
    const data = e.data;
    if (!data || !data.action) return;

    if (data.action === 'open') {
        allSkins     = data.skins || [];
        activeFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === 'all');
        });
        renderGrid();
        overlay.classList.remove('hidden');
    } else if (data.action === 'close') {
        overlay.classList.add('hidden');
        allSkins = [];
    }
});
