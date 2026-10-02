const InventoryForza = {
    updateWeight(current, max) {
        const currentVal = Number(current || 0);
        const maxVal = Math.max(1, Number(max || 30));
        const val = document.getElementById('weight-val-player');
        if (val) val.textContent = currentVal.toFixed(1);
        const maxEl = document.getElementById('weight-max-player');
        if (maxEl) maxEl.textContent = maxVal.toFixed(1);

        const pct = Math.max(0, Math.min(100, (currentVal / maxVal) * 100));
        const barFill = document.getElementById('ui-weight-bar');
        if (barFill) {
            barFill.style.width = `${pct}%`;
            if (pct >= 90) barFill.style.backgroundColor = '#ef4444';
            else if (pct >= 75) barFill.style.backgroundColor = '#D7B558';
            else barFill.style.backgroundColor = '#D7B558';
        }
    },

    itemLabel(row) {
        const def = row?.item || 'unknown';
        let label = I18n.item(def, row?.label);
        if (def === 'gas_can' && row?.metadata) {
            const maxL = 20;
            let liters = Number(row.metadata.liters);
            if (Number.isNaN(liters) && row.metadata.fuel != null) {
                liters = (Number(row.metadata.fuel) / 100) * maxL;
            }
            if (!Number.isNaN(liters)) label = I18n.t('ui.inventory.gas_can_liters', { liters: Math.round(liters), max: maxL });
        }
        if (def === 'fresh_fish' && row?.metadata) {
            const value = Math.max(0, Number(row.metadata.value) || 0);
            label = I18n.t('ui.inventory.fresh_fish_value', { label: I18n.item(def, row.label), value: Math.round(value) });
        }
        return label;
    },

    itemWeightText(row) {
        const def = row?.item || '';
        const FISH_TYPES = ['fish_common', 'fish_uncommon', 'fish_rare', 'fish_epic', 'fish_legendary'];
        if (FISH_TYPES.includes(def) && row?.metadata) {
            const kg = Number(row.metadata.fishKg) || 0;
            if (kg > 0) return `${kg.toFixed(1)}kg`;
        }
        const w = Number(row?.weight) || 0;
        if (w > 0) return `${w.toFixed(1)}kg`;
        return '';
    },

    itemIconHtml(row) {
        const icon = row?.icon;
        if (icon && String(icon).startsWith('ph-')) {
            return `<i class="ph-fill ${icon} item-icon"></i>`;
        }
        const src = icon && /^[a-z0-9_-]+$/i.test(icon)
            ? `assets/items/${icon}.webp`
            : 'assets/items/backpack.webp';
        return `<img class="item-icon" src="${src}" alt="" draggable="false" onerror="this.src='assets/items/backpack.webp'">`;
    },

    buildItemButton(row, cell, hooks) {
        const label = this.itemLabel(row);
        const count = Math.max(0, Number(row.count) || 0);
        const weightText = this.itemWeightText(row);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'inv-item item';
        item.title = row.usable ? I18n.t('ui.inventory.select_use_hint', { label }) : I18n.t('ui.inventory.select_hint', { label });
        item.innerHTML = `
            ${count > 1 ? `<div class="item-count">${count}</div>` : ''}
            <div class="item-icon-wrap">${this.itemIconHtml(row)}</div>
            <div class="item-label">${label}</div>
            ${weightText ? `<div class="item-weight">${weightText}</div>` : ''}
        `;
        item.addEventListener('click', (event) => hooks.onClick?.(row, cell, item, event));
        item.addEventListener('dblclick', () => hooks.onDblClick?.(row));
        item.addEventListener('pointerdown', (event) => hooks.onPointerDown?.(row, cell, item, event));
        cell.appendChild(item);
        return item;
    },

    renderMainGrid(items, hooks, slotCount = 30) {
        const grid = document.getElementById('grid-player');
        if (!grid) return;
        grid.innerHTML = '';
        const bySlot = new Map((items || []).map((row, index) => [Math.max(1, Number(row.slot) || index + 1), row]));
        const total = Math.max(slotCount, ...Array.from(bySlot.keys()), 30);

        for (let slot = 1; slot <= total; slot += 1) {
            const row = bySlot.get(slot);
            const cell = document.createElement('div');
            cell.className = 'inv-slot slot';
            cell.dataset.slot = String(slot);
            cell.dataset.grid = 'grid-player';
            if (row) this.buildItemButton(row, cell, hooks);
            grid.appendChild(cell);
        }
    },

    renderNearby(players) {
        const list = document.getElementById('inventory-nearby-list');
        if (!list) return;
        list.innerHTML = '';
        const nearby = Array.isArray(players) ? players : [];
        if (!nearby.length) {
            const empty = document.createElement('div');
            empty.className = 'prox-empty';
            empty.textContent = I18n.t('dynamic.inventory_forza.no_players_nearby_3m') || 'Niciun jucător în apropiere (3m)';
            list.appendChild(empty);
            return;
        }
        nearby.forEach((player) => {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.dataset.playerId = String(player.id);
            const name = ((v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])))(player.name || I18n.t('ui.inventory.player_hash', { id: player.id }));
            card.innerHTML = `
                <div class="player-card-info">
                    <div class="p-name">${name}</div>
                    <div class="p-id">#${player.id}</div>
                </div>
                <button type="button" class="btn-trade-invite" title="Invită la trade">
                    <i class="ph-bold ph-handshake"></i>
                    <span>INVITĂ LA TRADE</span>
                </button>
            `;
            const btn = card.querySelector('.btn-trade-invite');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    post('inventoryTradeRequest', { targetId: player.id });
                });
            }
            card.addEventListener('click', () => {
                post('inventoryTradeRequest', { targetId: player.id });
            });
            list.appendChild(card);
        });
    },
};

window.InventoryForza = InventoryForza;
