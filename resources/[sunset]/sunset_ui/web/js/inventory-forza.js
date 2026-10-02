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

    itemLargeIconHtml(row) {
        const icon = row?.icon;
        if (icon && String(icon).startsWith('ph-')) {
            return `<i class="ph-fill ${icon} item-icon-lg"></i>`;
        }
        const src = icon && /^[a-z0-9_-]+$/i.test(icon)
            ? `assets/items/${icon}.webp`
            : 'assets/items/backpack.webp';
        return `<img class="item-icon-lg" src="${src}" alt="" draggable="false" onerror="this.src='assets/items/backpack.webp'">`;
    },

    getItemDescription(row) {
        const def = row?.item || '';
        const meta = row?.metadata || {};

        // Dynamic metadata-based descriptions
        if (def === 'fresh_fish' || def.startsWith('fish_')) {
            const kg = Number(meta.fishKg || row.weight || 0);
            const val = Number(meta.value || 0);
            const kgText = kg > 0 ? ` [${kg.toFixed(1)} kg]` : '';
            const valText = val > 0 ? ` Valoare estimată la vânzare: $${val}.` : ' Poate fi vândut la cherhana sau preparat.';
            return `Pește proaspăt capturat${kgText}.${valText}`;
        }
        if (def === 'gas_can') {
            const liters = meta.liters != null ? Math.round(Number(meta.liters)) : 20;
            return `Canistră de combustibil portabilă. Conține ${liters}/20 litri de benzină pentru alimentarea vehiculelor pe drum.`;
        }
        if (def === 'venison' || def === 'boar_meat') {
            const qual = meta.quality != null ? ` Calitate: ${meta.quality}%.` : '';
            return `Carne proaspătă recoltată din vânat.${qual} Poate fi gătită sau vândută la procesare.`;
        }
        if (def === 'animal_hide' || def === 'coyote_pelt') {
            const grade = meta.grade ? ` (Grad: ${meta.grade})` : '';
            return `Piele brută de animal sălbatic${grade}. Resursă valoroasă pentru meșteșugit sau vânzare la tăbăcărie.`;
        }
        if (def === 'salvage_parts' || def === 'marine_electronics' || def === 'sealed_cargo' || def === 'marine_artifact') {
            const cond = meta.condition != null ? ` Stare: ${meta.condition}%.` : '';
            return `Obiect valoros recuperat din adâncurile oceanului.${cond} Aduce un profit considerabil la vânzare.`;
        }

        const DESCRIPTIONS = {
            // Alimente & Băuturi
            water: 'Potolește setea rapid și menține corpul hidratat (+25% Sete).',
            bread: 'Pâine proaspătă și hrănitoare ce alungă foamea (+20% Hrană).',
            burger: 'Burger consistent și gustos cu carne și sosuri (+35% Hrană, -5% Sete).',
            sandwich: 'Sandviș proaspăt ambalat pentru o masă rapidă (+28% Hrană).',
            pizza_slice: 'Felie caldă de pizza cu brânză și sos de roșii (+30% Hrană, -2% Sete).',
            hotdog: 'Hotdog cald cu muștar și sosuri (+26% Hrană, -2% Sete).',
            chips: 'Pungă cu chipsuri crocante de cartofi (+15% Hrană, -4% Sete).',
            cookies: 'Biscuiți dulci și delicioși (+12% Hrană, -2% Sete).',
            chocolate: 'Baton de ciocolată dulce ce reduce stresul (+14% Hrană, -3% Stres).',
            apple: 'Măr proaspăt, crocant și suculent (+12% Hrană, +3% Sete).',
            banana: 'Banană hrănitoare bogată în potasiu (+14% Hrană).',
            soda: 'Băutură carbogazoasă răcoritoare Sprunk (+20% Sete).',
            coffee: 'Cafea fierbinte ce îți dă energie și reduce stresul (+12% Sete, -5% Stres).',
            energy_drink: 'Băutură energizantă ce îți crește reflexele și alungă oboseala (+18% Sete, -4% Stres).',
            juice: 'Suc natural de fructe plin de vitamine (+22% Sete).',
            beer: 'Bere rece la doză/sticlă ce oferă o stare de relaxare (+20% Sete, -5% Stres).',
            wine: 'Pahar de vin roșu select; relaxează mintea (+25% Sete, -8% Stres).',
            whiskey: 'Băutură spirtoasă tare; alungă stresul intens (+30% Sete, -12% Stres).',
            cocktail: 'Cocktail exotic preparat cu ingrediente fine (+35% Sete, -10% Stres).',
            champagne: 'Șampanie franțuzească fină pentru momente speciale (+50% Sete, -15% Stres).',

            // Medical & Suport
            bandage: 'Pansament steril de prim ajutor; oprește sângerarea și reface viața (+25 HP).',
            painkillers: 'Calmante puternice ce ameliorează durerea și vindecă rănile (+12 HP).',
            cigarette: 'Țigară din tutun fin; calmează nervii și alungă stresul (-10% Stres).',
            sealed_pouch: 'Plic sigilat cu conținut aromat special; alungă stresul profund (-15% Stres).',

            // Unelte & Utilitare
            repairkit: 'Trusă completă de scule auto; repară defecțiunile motorului și caroseriei pe loc.',
            lockpick: 'Șperaclu din oțel călit; folosit pentru deblocarea vehiculelor și a ușilor închise.',
            phone: 'Smartphone cu ecran tactil pentru apeluri, GPS și servicii bancare.',
            id_card: 'Act de identitate oficial ce confirmă datele cetățenești.',
            driver_license: 'Permis de conducere categoria B emis de autoritățile rutiere.',
            casino_chips: 'Jetoane oficiale de cazino; se pot converti în numerar la casierie.',

            // Pescuit
            fishing_rod_1: 'Undiță standard nivel 1; potrivită pentru pescuit la mal.',
            fishing_rod_2: 'Undiță ranforsată nivel 2; rezistență crescută la capturi medii.',
            fishing_rod_3: 'Undiță profesională nivel 3; sporește șansa de pești rari.',
            fishing_rod_4: 'Undiță de elită nivel 4; rezistență maximă pentru pești masivi.',
            fishing_rod_5: 'Undiță de maestru nivel 5; eficiență extremă pentru capturi de trofeu.',
            bait_worm: 'Râme naturale pentru pescuit; momeală de bază.',
            bait_lure: 'Nălucă artificială reflectorizantă; atrage specii răpitoare.',
            bait_premium: 'Momeală specială parfumată; atrage pești epici și legendari.',

            // Arme & Muniție
            weapon_flashlight: 'Lanternă tactică din aluminiu cu fascicul luminos puternic.',
            weapon_bat: 'Bâtă de baseball din lemn masiv; armă contondentă eficientă în luptă apropiată.',
            weapon_knife: 'Cuțit utilitar ascuțit; folosit pentru autoapărare sau tranșat.',
            hunting_knife: 'Cuțit de vânătoare special pentru recoltarea animalelor sălbatice.',
            weapon_snspistol: 'Pistol compact de buzunar calibrul 9mm; port facil și discret.',
            weapon_pistol: 'Pistol semi-automat calibrul 9mm; fiabilitate și precizie ridicată.',
            weapon_vintagepistol: 'Pistol clasic de colecție gravat manual, de calibru 9mm.',
            weapon_pumpshotgun: 'Pușcă cu pompă calibru 12 Gauge; forță de oprire devastatoare.',
            weapon_sniperrifle: 'Pușcă cu lunetă de înaltă precizie pentru distanțe mari.',
            ammo_9mm: 'Cutie cu 24 de gloanțe calibrul 9mm pentru pistoale.',
            ammo_shotgun: 'Cutie cu 12 cartușe calibru 12 Gauge pentru puști cu pompă.',
            ammo_rifle: 'Cutie cu 10 cartușe de mare putere pentru puști de vânătoare.',

            // Materiale & Producție
            metal_scrap: 'Bucăți de fier și resturi metalice refolosibile pentru crafting sau reciclare.',
            plastic: 'Polimeri din plastic industrial pentru asamblarea componentelor.',
            cloth: 'Fibră textilă rezistentă utilizată în confecții și bandaje.',
            chemicals: 'Soluții chimice reactive folosite în procese industriale și sinteză.',
            gunpowder: 'Pulbere explozivă utilizată la fabricarea cartușelor de muniție.',

            // Ilegale / Droguri
            weed_leaf: 'Frunze proaspete de canabis recoltate de pe plantație.',
            weed_brick: 'Pachet compact presat de marijuana pentru livrare clandestină.',
            coke_leaf: 'Frunze de coca pentru prelucrare și rafinare.',
            coke_brick: 'Cărămidă de cocaină pură; marfă de mare valoare pe piața neagră.',
            meth_chemical: 'Substanțe chimice precursoare pentru producția de metamfetamină.',
            meth_bag: 'Pungă cu cristale de metamfetamină de puritate superioară.',

            // Jafuri & Bunuri amanet
            stolen_silver_watch: 'Ceas de argint sustras; se vinde la amanet pentru bani lichizi.',
            stolen_luxury_watch: 'Ceas de lux din jaf; valorează o sumă importantă la amanet.',
            stolen_gold_watch: 'Ceas din aur masiv; piesă căutată pe piața bunurilor furate.',
            stolen_diamond_watch: 'Ceas exclusivist cu diamante; captură de mare valoare.',
            stolen_collector_watch: 'Ceas de epocă rar; aduce profituri mari la vânzare.',
            stolen_bracelet: 'Brățară fin lucrată; se poate topi sau vinde la amanet.',
            stolen_gold_chain: 'Lanț gros de aur masiv; valoare mare la amanet.',
            stolen_gold_bracelet: 'Brățară masivă din aur galben; pradă valoroasă.',
            stolen_diamond_jewelry: 'Set de bijuterii din platină cu diamante veritabile.',

            // Scufundări
            scuba_gear: 'Costum complet de scufundări cu mască și butelie de oxigen.',
            advanced_tank: 'Tub de oxigen de înaltă presiune pentru imersiuni de adâncime.',
        };

        if (DESCRIPTIONS[def]) return DESCRIPTIONS[def];
        if (row?.desc) return row.desc;
        if (row?.description) return row.description;
        if (row?.usable) return 'Obiect util ce poate fi activat direct din inventar prin dublu-click.';
        return 'Obiect păstrat în rucsac pentru comerț, depozitare sau utilizare ulterioară.';
    },

    showTooltip(e, row) {
        const tooltip = document.getElementById('item-tooltip');
        if (!tooltip) return;
        const label = this.itemLabel(row);
        const count = Math.max(1, Number(row.count) || 1);
        const unitWeight = Number(row.weight) || 0;
        const totalWeight = (unitWeight * count).toFixed(2);
        const desc = this.getItemDescription(row);

        const iconEl = tooltip.querySelector('#tt-icon');
        if (iconEl) iconEl.innerHTML = this.itemLargeIconHtml(row);
        const nameEl = tooltip.querySelector('#tt-name');
        if (nameEl) nameEl.textContent = label;
        const countEl = tooltip.querySelector('#tt-count');
        if (countEl) countEl.textContent = `${count} buc`;
        const weightEl = tooltip.querySelector('#tt-weight');
        if (weightEl) {
            weightEl.textContent = count > 1 ? `${totalWeight} kg (${unitWeight.toFixed(2)} kg/buc)` : `${unitWeight.toFixed(2)} kg`;
        }
        const descEl = tooltip.querySelector('#tt-desc');
        if (descEl) descEl.textContent = desc;
        const footerEl = tooltip.querySelector('#tt-footer');
        if (footerEl) {
            if (row.weapon || (row.item && String(row.item).startsWith('weapon_'))) {
                footerEl.innerHTML = '<i class="ph-bold ph-crosshair"></i> DUBLU-CLICK PENTRU A ECHIPA ARMA';
            } else if (row.usable) {
                footerEl.innerHTML = '<i class="ph-bold ph-lightning"></i> DUBLU-CLICK PENTRU A UTILIZA';
            } else {
                footerEl.innerHTML = '<i class="ph-bold ph-hand-coins"></i> OBIECT PENTRU COMERȚ / SCHIMB';
            }
        }

        tooltip.style.opacity = '1';
        this.moveTooltip(e);
    },

    hideTooltip() {
        const tooltip = document.getElementById('item-tooltip');
        if (tooltip) tooltip.style.opacity = '0';
    },

    moveTooltip(e) {
        const tooltip = document.getElementById('item-tooltip');
        if (!tooltip) return;
        const pad = 16;
        let x = e.clientX + pad;
        let y = e.clientY + pad;
        const rect = tooltip.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 12) {
            x = e.clientX - rect.width - pad;
        }
        if (y + rect.height > window.innerHeight - 12) {
            y = e.clientY - rect.height - pad;
        }
        tooltip.style.left = `${Math.max(10, x)}px`;
        tooltip.style.top = `${Math.max(10, y)}px`;
    },

    buildItemButton(row, cell, hooks) {
        const label = this.itemLabel(row);
        const count = Math.max(0, Number(row.count) || 0);
        const weightText = this.itemWeightText(row);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'inv-item item';
        item.title = '';
        item.innerHTML = `
            ${count > 1 ? `<div class="item-count">${count}</div>` : ''}
            <div class="item-icon-wrap">${this.itemIconHtml(row)}</div>
            <div class="item-label">${label}</div>
            ${weightText ? `<div class="item-weight">${weightText}</div>` : ''}
        `;
        item.addEventListener('mouseenter', (e) => this.showTooltip(e, row));
        item.addEventListener('mousemove', (e) => this.moveTooltip(e));
        item.addEventListener('mouseleave', () => this.hideTooltip());
        item.addEventListener('click', (event) => hooks.onClick?.(row, cell, item, event));
        item.addEventListener('dblclick', () => {
            this.hideTooltip();
            hooks.onDblClick?.(row);
        });
        item.addEventListener('pointerdown', (event) => {
            this.hideTooltip();
            hooks.onPointerDown?.(row, cell, item, event);
        });
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
