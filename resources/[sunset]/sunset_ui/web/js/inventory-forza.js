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
            const valText = val > 0 ? ` Valoare estimata la vanzare: $${val}.` : ' Poate fi vandut la cherhana sau preparat.';
            return `Peste proaspat capturat${kgText}.${valText}`;
        }
        if (def === 'gas_can') {
            const liters = meta.liters != null ? Math.round(Number(meta.liters)) : 20;
            return `Canistra de combustibil portabila. Contine ${liters}/20 litri de benzina pentru alimentarea vehiculelor pe drum.`;
        }
        if (def === 'venison' || def === 'boar_meat') {
            const qual = meta.quality != null ? ` Calitate: ${meta.quality}%.` : '';
            return `Carne proaspata recoltata din vanat.${qual} Poate fi gatita sau vanduta la procesare.`;
        }
        if (def === 'animal_hide' || def === 'coyote_pelt') {
            const grade = meta.grade ? ` (Grad: ${meta.grade})` : '';
            return `Piele bruta de animal salbatic${grade}. Resursa valoroasa pentru mestesugit sau vanzare la tabacarie.`;
        }
        if (def === 'salvage_parts' || def === 'marine_electronics' || def === 'sealed_cargo' || def === 'marine_artifact') {
            const cond = meta.condition != null ? ` Stare: ${meta.condition}%.` : '';
            return `Obiect valoros recuperat din adancurile oceanului.${cond} Aduce un profit considerabil la vanzare.`;
        }

        const DESCRIPTIONS = {
            // Alimente & Bauturi
            water: 'Potoleste setea rapid si mentine corpul hidratat (+25% Sete).',
            bread: 'Paine proaspata si hranitoare ce alunga foamea (+20% Hrana).',
            burger: 'Burger consistent si gustos cu carne si sosuri (+35% Hrana, -5% Sete).',
            sandwich: 'Sandvis proaspat ambalat pentru o masa rapida (+28% Hrana).',
            pizza_slice: 'Felie calda de pizza cu branza si sos de rosii (+30% Hrana, -2% Sete).',
            hotdog: 'Hotdog cald cu mustar si sosuri (+26% Hrana, -2% Sete).',
            chips: 'Punga cu chipsuri crocante de cartofi (+15% Hrana, -4% Sete).',
            cookies: 'Biscuiti dulci si deliciosi (+12% Hrana, -2% Sete).',
            chocolate: 'Baton de ciocolata dulce ce reduce stresul (+14% Hrana, -3% Stres).',
            apple: 'Mar proaspat, crocant si suculent (+12% Hrana, +3% Sete).',
            banana: 'Banana hranitoare bogata in potasiu (+14% Hrana).',
            soda: 'Bautura carbogazoasa racoritoare Sprunk (+20% Sete).',
            coffee: 'Cafea fierbinte ce iti da energie si reduce stresul (+12% Sete, -5% Stres).',
            energy_drink: 'Bautura energizanta ce iti creste reflexele si alunga oboseala (+18% Sete, -4% Stres).',
            juice: 'Suc natural de fructe plin de vitamine (+22% Sete).',
            beer: 'Bere rece la doza/sticla ce ofera o stare de relaxare (+20% Sete, -5% Stres).',
            wine: 'Pahar de vin rosu select; relaxeaza mintea (+25% Sete, -8% Stres).',
            whiskey: 'Bautura spirtoasa tare; alunga stresul intens (+30% Sete, -12% Stres).',
            cocktail: 'Cocktail exotic preparat cu ingrediente fine (+35% Sete, -10% Stres).',
            champagne: 'Sampanie frantuzeasca fina pentru momente speciale (+50% Sete, -15% Stres).',

            // Medical & Suport
            bandage: 'Pansament steril de prim ajutor; opreste sangerarea si reface viata (+25 HP).',
            painkillers: 'Calmante puternice ce amelioreaza durerea si vindeca ranile (+12 HP).',
            cigarette: 'Tigara din tutun fin; calmeaza nervii si alunga stresul (-10% Stres).',
            sealed_pouch: 'Plic sigilat cu continut aromat special; alunga stresul profund (-15% Stres).',

            // Unelte & Utilitare
            repairkit: 'Trusa completa de scule auto; repara defectiunile motorului si caroseriei pe loc.',
            lockpick: 'Speraclu din otel calit; folosit pentru deblocarea vehiculelor si a usilor inchise.',
            phone: 'Smartphone cu ecran tactil pentru apeluri, GPS si servicii bancare.',
            id_card: 'Act de identitate oficial ce confirma datele cetatenesti.',
            driver_license: 'Permis de conducere categoria B emis de autoritatile rutiere.',
            casino_chips: 'Jetoane oficiale de cazino; se pot converti in numerar la casierie.',

            // Pescuit
            fishing_rod_1: 'Undita standard nivel 1; potrivita pentru pescuit la mal.',
            fishing_rod_2: 'Undita ranforsata nivel 2; rezistenta crescuta la capturi medii.',
            fishing_rod_3: 'Undita profesionala nivel 3; sporeste sansa de pesti rari.',
            fishing_rod_4: 'Undita de elita nivel 4; rezistenta maxima pentru pesti masivi.',
            fishing_rod_5: 'Undita de maestru nivel 5; eficienta extrema pentru capturi de trofeu.',
            bait_worm: 'Rame naturale pentru pescuit; momeala de baza.',
            bait_lure: 'Naluca artificiala reflectorizanta; atrage specii rapitoare.',
            bait_premium: 'Momeala speciala parfumata; atrage pesti epici si legendari.',

            // Arme & Munitie
            weapon_flashlight: 'Lanterna tactica din aluminiu cu fascicul luminos puternic.',
            weapon_bat: 'Bata de baseball din lemn masiv; arma contondenta eficienta in lupta apropiata.',
            weapon_knife: 'Cutit utilitar ascutit; folosit pentru autoaparare sau transat.',
            hunting_knife: 'Cutit de vanatoare special pentru recoltarea animalelor salbatice.',
            weapon_snspistol: 'Pistol compact de buzunar calibrul 9mm; port facil si discret.',
            weapon_pistol: 'Pistol semi-automat calibrul 9mm; fiabilitate si precizie ridicata.',
            weapon_vintagepistol: 'Pistol clasic de colectie gravat manual, de calibru 9mm.',
            weapon_pumpshotgun: 'Pusca cu pompa calibru 12 Gauge; forta de oprire devastatoare.',
            weapon_sniperrifle: 'Pusca cu luneta de inalta precizie pentru distante mari.',
            ammo_9mm: 'Cutie cu 24 de gloante calibrul 9mm pentru pistoale.',
            ammo_shotgun: 'Cutie cu 12 cartuse calibru 12 Gauge pentru pusti cu pompa.',
            ammo_rifle: 'Cutie cu 10 cartuse de mare putere pentru pusti de vanatoare.',

            // Materiale & Productie
            metal_scrap: 'Bucati de fier si resturi metalice refolosibile pentru crafting sau reciclare.',
            plastic: 'Polimeri din plastic industrial pentru asamblarea componentelor.',
            cloth: 'Fibra textila rezistenta utilizata in confectii si bandaje.',
            chemicals: 'Solutii chimice reactive folosite in procese industriale si sinteza.',
            gunpowder: 'Pulbere exploziva utilizata la fabricarea cartuselor de munitie.',

            // Ilegale / Droguri
            weed_leaf: 'Frunze proaspete de canabis recoltate de pe plantatie.',
            weed_brick: 'Pachet compact presat de marijuana pentru livrare clandestina.',
            coke_leaf: 'Frunze de coca pentru prelucrare si rafinare.',
            coke_brick: 'Caramida de cocaina pura; marfa de mare valoare pe piata neagra.',
            meth_chemical: 'Substante chimice precursoare pentru productia de metamfetamina.',
            meth_bag: 'Punga cu cristale de metamfetamina de puritate superioara.',

            // Jafuri & Bunuri amanet
            stolen_silver_watch: 'Ceas de argint sustras; se vinde la amanet pentru bani lichizi.',
            stolen_luxury_watch: 'Ceas de lux din jaf; valoreaza o suma importanta la amanet.',
            stolen_gold_watch: 'Ceas din aur masiv; piesa cautata pe piata bunurilor furate.',
            stolen_diamond_watch: 'Ceas exclusivist cu diamante; captura de mare valoare.',
            stolen_collector_watch: 'Ceas de epoca rar; aduce profituri mari la vanzare.',
            stolen_bracelet: 'Bratara fin lucrata; se poate topi sau vinde la amanet.',
            stolen_gold_chain: 'Lant gros de aur masiv; valoare mare la amanet.',
            stolen_gold_bracelet: 'Bratara masiva din aur galben; prada valoroasa.',
            stolen_diamond_jewelry: 'Set de bijuterii din platina cu diamante veritabile.',

            // Scufundari
            scuba_gear: 'Costum complet de scufundari cu masca si butelie de oxigen.',
            advanced_tank: 'Tub de oxigen de inalta presiune pentru imersiuni de adancime.',
        };

        if (DESCRIPTIONS[def]) return DESCRIPTIONS[def];
        if (row?.desc) return row.desc;
        if (row?.description) return row.description;
        if (row?.usable) return 'Obiect util ce poate fi activat direct din inventar prin dublu-click.';
        return 'Obiect pastrat in rucsac pentru comert, depozitare sau utilizare ulterioara.';
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
        if (countEl) countEl.textContent = I18n.t('ui.inventory.pieces', { count });
        const weightEl = tooltip.querySelector('#tt-weight');
        if (weightEl) {
            weightEl.textContent = count > 1
                ? I18n.t('ui.inventory.total_unit_weight', { total: totalWeight, unit: unitWeight.toFixed(2) })
                : I18n.t('ui.inventory.weight', { weight: unitWeight.toFixed(2) });
        }
        const descEl = tooltip.querySelector('#tt-desc');
        if (descEl) descEl.textContent = desc;
        const footerEl = tooltip.querySelector('#tt-footer');
        if (footerEl) {
            if (row.weapon || (row.item && String(row.item).startsWith('weapon_'))) {
                footerEl.innerHTML = `<i class="ph-bold ph-crosshair"></i> ${I18n.t('ui.inventory.double_click_equip')}`;
            } else if (row.usable) {
                footerEl.innerHTML = `<i class="ph-bold ph-lightning"></i> ${I18n.t('ui.inventory.double_click_use')}`;
            } else {
                footerEl.innerHTML = `<i class="ph-bold ph-hand-coins"></i> ${I18n.t('ui.inventory.trade_item')}`;
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
            empty.textContent = I18n.t('dynamic.inventory_forza.no_players_nearby_3m');
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
                <button type="button" class="btn-trade-invite" title="${I18n.t('ui.inventory.invite_trade')}">
                    <i class="ph-bold ph-handshake"></i>
                    <span>${I18n.t('ui.inventory.invite_trade')}</span>
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
