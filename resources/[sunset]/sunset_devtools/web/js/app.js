/* ═══════════════════════════════════════════════════════════════════
   SUNSET DEVTOOLS — Route Creator Web App (app.js)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function post(action, data = {}) {
        const resource = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'sunset_devtools';
        return fetch(`https://${resource}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        }).then(res => res.json()).catch(() => ({}));
    }

    const State = {
        activeAdapter: 'trucker',
        routes: {
            trucker: [],
            garbage: [],
            hunting: [],
            diving: [],
        },
        selectedRouteId: null,
        isDirty: false,
        pendingAction: null,
    };

    // ── NUI Event Listeners ────────────────────────────────────────

    window.addEventListener('message', (event) => {
        const msg = event.data || {};
        switch (msg.action) {
            case 'open':
                $('#route-creator-app').classList.remove('hidden');
                if (msg.adapter) State.activeAdapter = msg.adapter;
                if (msg.routes) {
                    State.routes[State.activeAdapter] = msg.routes;
                }
                renderAdapters();
                renderRouteList();
                if (msg.selectedRouteId) {
                    selectRoute(msg.selectedRouteId);
                } else if (State.routes[State.activeAdapter]?.length > 0) {
                    selectRoute(State.routes[State.activeAdapter][0].id);
                } else {
                    deselectRoute();
                }
                break;

            case 'close':
                $('#route-creator-app').classList.add('hidden');
                break;

            case 'hideForGizmo':
                $('#route-creator-app').classList.add('hidden');
                break;

            case 'showAfterGizmo':
                $('#route-creator-app').classList.remove('hidden');
                break;

            case 'updateRoutes':
                if (msg.adapter && msg.routes) {
                    State.routes[msg.adapter] = msg.routes;
                    if (State.activeAdapter === msg.adapter) {
                        renderRouteList();
                        if (State.selectedRouteId) {
                            renderInspector();
                        }
                    }
                }
                break;

            case 'updateFieldCoords':
                $('#route-creator-app').classList.remove('hidden');
                if (msg.routeId && msg.stageKey !== undefined && msg.coords) {
                    const r = findRoute(State.activeAdapter, msg.routeId);
                    if (r) {
                        if (State.activeAdapter === 'trucker') {
                            r[msg.stageKey] = msg.coords;
                        } else if (State.activeAdapter === 'garbage') {
                            if (msg.stageKey === 9999 || msg.stageKey === '9999') {
                                r.bins = r.bins || [];
                                r.bins.push(msg.coords);
                            } else {
                                const idx = Number(msg.stageKey);
                                if (!isNaN(idx) && r.bins) {
                                    r.bins[idx] = msg.coords;
                                }
                            }
                        } else if (State.activeAdapter === 'hunting') {
                            if (msg.stageKey === 'polygonPoint') {
                                r.polygon = r.polygon || [];
                                r.polygon.push(msg.coords);
                            } else if (msg.stageKey === 'spawnPoint') {
                                r.spawnPoints = r.spawnPoints || [];
                                r.spawnPoints.push(msg.coords);
                            }
                        } else if (State.activeAdapter === 'diving') {
                            if (msg.stageKey === 'lootPoint') {
                                r.lootPoints = r.lootPoints || [];
                                r.lootPoints.push(msg.coords);
                            } else if (msg.stageKey === 'searchZoneCenter') {
                                r.searchZone = r.searchZone || {};
                                r.searchZone.center = msg.coords;
                            } else {
                                // Named single-coord fields: diveEntry, returnPoint, boatSpawn
                                r[msg.stageKey] = msg.coords;
                            }
                        }
                        markDirty();
                        renderInspector();
                        renderRouteList();
                    }
                }
                break;
        }
    });

    // ── Global Controls & Keyboard ─────────────────────────────────

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!$('#rc-modal').classList.contains('hidden')) {
                hideModal();
            } else if (!$('#rc-test-modal').classList.contains('hidden')) {
                hideTestModal();
            } else {
                requestClose();
            }
        }
    });

    function requestClose() {
        if (State.isDirty) {
            showModal('Unsaved Changes', 'You have unsaved changes in this route configuration. Do you want to close and discard unsaved modifications?', () => {
                post('close', {});
                $('#route-creator-app').classList.add('hidden');
            });
        } else {
            post('close', {});
            $('#route-creator-app').classList.add('hidden');
        }
    }

    function markDirty() {
        State.isDirty = true;
        $('#rc-global-save-status').className = 'rc-save-badge dirty';
        $('#rc-global-save-status').textContent = I18n.t('dynamic.app.unsaved');
        $('#rc-route-dirty-badge').className = 'rc-save-badge dirty';
        $('#rc-route-dirty-badge').textContent = I18n.t('dynamic.app.unsaved');
    }

    function markSaved() {
        State.isDirty = false;
        $('#rc-global-save-status').className = 'rc-save-badge saved';
        $('#rc-global-save-status').textContent = I18n.t('dynamic.app.saved');
        $('#rc-route-dirty-badge').className = 'rc-save-badge saved';
        $('#rc-route-dirty-badge').textContent = I18n.t('dynamic.app.saved');
    }

    // ── Helper Finders ─────────────────────────────────────────────

    function findRoute(adapter, id) {
        const list = State.routes[adapter] || [];
        return list.find(r => r.id === id);
    }

    function getSelectedRoute() {
        return findRoute(State.activeAdapter, State.selectedRouteId);
    }

    // ── Render Adapters ────────────────────────────────────────────

    function renderAdapters() {
        $$('.rc-adapter-item').forEach(el => {
            const ad = el.dataset.adapter;
            el.classList.toggle('active', ad === State.activeAdapter);
        });
    }

    // ── Render Route List ──────────────────────────────────────────

    function renderRouteList() {
        const container = $('#rc-route-list');
        container.innerHTML = '';

        const routes = State.routes[State.activeAdapter] || [];
        const filter = ($('#rc-search-input').value || '').toLowerCase();

        const filtered = routes.filter(r =>
            (r.label || '').toLowerCase().includes(filter) ||
            (r.id || '').toLowerCase().includes(filter) ||
            (r.category || '').toLowerCase().includes(filter)
        );

        $('#rc-route-count-text').textContent = `${routes.length} Route${routes.length === 1 ? '' : 's'} Configured`;

        filtered.forEach(r => {
            const card = document.createElement('div');
            card.className = `rc-route-card ${r.id === State.selectedRouteId ? 'selected' : ''}`;
            card.dataset.id = r.id;

            let metaHtml = '';
            if (State.activeAdapter === 'trucker') {
                metaHtml = `<span class="rc-tag">${r.category || 'fuel'}</span> <span>$${r.pay || 500}</span>`;
            } else if (State.activeAdapter === 'garbage') {
                const binCount = (r.bins && r.bins.length) || 0;
                metaHtml = `<span class="rc-tag">${binCount} BINS</span> <span>Ordered</span>`;
            } else if (State.activeAdapter === 'hunting') {
                const ptCount = (r.polygon && r.polygon.length) || 0;
                const spCount = (r.spawnPoints && r.spawnPoints.length) || 0;
                metaHtml = `<span class="rc-tag">Rank ${r.minRank || 1}</span> <span>${ptCount} pts / ${spCount} spawns</span>`;
            } else if (State.activeAdapter === 'diving') {
                const lpCount = (r.lootPoints && r.lootPoints.length) || 0;
                metaHtml = `<span class="rc-tag">${r.difficulty || 'easy'}</span> <span>$${r.pay || 0} / ${lpCount} loot pts</span>`;
            }

            card.innerHTML = `
                <div class="rc-route-card__title">${escapeHtml(r.label || r.id)}</div>
                <div class="rc-route-card__meta">${metaHtml}</div>
            `;

            card.addEventListener('click', () => selectRoute(r.id));
            container.appendChild(card);
        });
    }

    // ── Select Route ───────────────────────────────────────────────

    function selectRoute(id) {
        State.selectedRouteId = id;
        renderRouteList();
        renderInspector();
        post('selectRoute', { adapter: State.activeAdapter, routeId: id });
    }

    function deselectRoute() {
        State.selectedRouteId = null;
        $('#rc-empty-inspector').classList.remove('hidden');
        $('#rc-inspector-content').classList.add('hidden');
    }

    // ── Render Inspector ───────────────────────────────────────────

    function renderInspector() {
        const route = getSelectedRoute();
        if (!route) {
            deselectRoute();
            return;
        }

        $('#rc-empty-inspector').classList.add('hidden');
        $('#rc-inspector-content').classList.remove('hidden');

        $('#rc-insp-label').value = route.label || '';
        $('#rc-insp-id').value = route.id || '';

        const body = $('#rc-insp-body');
        body.innerHTML = '';

        if (State.activeAdapter === 'trucker') {
            renderTruckerInspector(body, route);
        } else if (State.activeAdapter === 'garbage') {
            renderGarbageInspector(body, route);
        } else if (State.activeAdapter === 'hunting') {
            renderHunterInspector(body, route);
        } else if (State.activeAdapter === 'diving') {
            renderDiverInspector(body, route);
        }

        renderValidation(route);
    }

    // ── Trucker Inspector Sub-renderer ─────────────────────────────

    function renderTruckerInspector(container, route) {
        // Meta Row (Category + Pay)
        const metaCard = document.createElement('div');
        metaCard.className = 'rc-field-card';
        metaCard.innerHTML = `
            <div class="rc-field-header">
                <span class="rc-field-title">ROUTE CONFIGURATION</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                    <label class="rc-coord-lbl">Category</label>
                    <select id="rc-trucker-category" class="rc-input-hero" style="font-size: 12px; padding: 4px 8px;">
                        <option value="fuel" ${route.category === 'fuel' ? 'selected' : ''}>Fuel (Tanker)</option>
                        <option value="general" ${route.category === 'general' ? 'selected' : ''}>General Freight</option>
                        <option value="heavy" ${route.category === 'heavy' ? 'selected' : ''}>Heavy Equipment</option>
                    </select>
                </div>
                <div>
                    <label class="rc-coord-lbl">Base Pay ($)</label>
                    <input type="number" id="rc-trucker-pay" class="rc-input-hero" style="font-size: 12px; padding: 4px 8px;" value="${route.pay || 650}">
                </div>
            </div>
        `;
        container.appendChild(metaCard);

        metaCard.querySelector('#rc-trucker-category').addEventListener('change', (e) => {
            route.category = e.target.value;
            markDirty();
            renderRouteList();
        });

        metaCard.querySelector('#rc-trucker-pay').addEventListener('input', (e) => {
            route.pay = Number(e.target.value) || 500;
            markDirty();
            renderRouteList();
        });

        // Stages: Pickup, Delivery, Parking Bay
        const stages = [
            { key: 'pickup', title: 'TRAILER PICKUP BAY', val: route.pickup || {}, canCaptureTrailer: true },
            { key: 'delivery', title: 'DELIVERY ENTRANCE CHECKPOINT', val: route.delivery || {}, canCaptureTrailer: false },
            { key: 'parkingBay', title: 'MANUAL PARKING BAY (ORIENTED RECTANGLE)', val: route.parkingBay || {}, canCaptureTrailer: true },
        ];

        stages.forEach(st => {
            const card = document.createElement('div');
            card.className = 'rc-field-card';

            const x = (st.val.x || 0).toFixed(2);
            const y = (st.val.y || 0).toFixed(2);
            const z = (st.val.z || 0).toFixed(2);
            const h = ((st.val.h !== undefined ? st.val.h : st.val.w) || 0).toFixed(1);

            card.innerHTML = `
                <div class="rc-field-header">
                    <span class="rc-field-title">${st.title}</span>
                </div>
                <div class="rc-coord-grid">
                    <div class="rc-coord-box"><span class="rc-coord-lbl">X</span><span class="rc-coord-val">${x}</span></div>
                    <div class="rc-coord-box"><span class="rc-coord-lbl">Y</span><span class="rc-coord-val">${y}</span></div>
                    <div class="rc-coord-box"><span class="rc-coord-lbl">Z</span><span class="rc-coord-val">${z}</span></div>
                    <div class="rc-coord-box"><span class="rc-coord-lbl">Heading</span><span class="rc-coord-val">${h}°</span></div>
                </div>
                <div class="rc-field-actions">
                    <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto"><span>📍</span> Go To</button>
                    <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny btn-gizmo"><span>🎛️</span> Edit with Gizmo</button>
                    ${st.canCaptureTrailer ? `<button type="button" class="rc-btn rc-btn--accent rc-btn--tiny btn-capture-trailer"><span>🚛</span> Capture From Trailer</button>` : ''}
                </div>
            `;

            card.querySelector('.btn-goto').addEventListener('click', () => {
                post('teleportToCoords', { coords: st.val });
            });

            card.querySelector('.btn-gizmo').addEventListener('click', () => {
                post('startGizmoEdit', {
                    adapter: 'trucker',
                    routeId: route.id,
                    stageKey: st.key,
                    coords: st.val,
                });
            });

            if (st.canCaptureTrailer) {
                card.querySelector('.btn-capture-trailer').addEventListener('click', () => {
                    post('captureFromTrailer', {
                        adapter: 'trucker',
                        routeId: route.id,
                        stageKey: st.key,
                    });
                });
            }

            container.appendChild(card);
        });
    }

    // ── Garbage Inspector Sub-renderer ─────────────────────────────

    function renderGarbageInspector(container, route) {
        const bins = route.bins || [];

        const card = document.createElement('div');
        card.className = 'rc-field-card';
        card.innerHTML = `
            <div class="rc-bins-header">
                <span class="rc-field-title">COLLECTION STOPS (${bins.length} BINS)</span>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny" id="rc-btn-add-bin-here"><span>+</span> Add Bin at Ped</button>
                    <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny" id="rc-btn-add-bin-crosshair"><span>🎯</span> Crosshair</button>
                </div>
            </div>
            <div class="rc-bins-list" id="rc-bins-list-container"></div>
        `;

        const listContainer = card.querySelector('#rc-bins-list-container');

        bins.forEach((b, idx) => {
            const row = document.createElement('div');
            row.className = 'rc-bin-row';
            row.innerHTML = `
                <span class="rc-bin-num">#${idx + 1}</span>
                <span class="rc-bin-coords">${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}</span>
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto-bin" title="Teleport">📍</button>
                <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny btn-edit-bin" title="Gizmo">🎛️</button>
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-up-bin" ${idx === 0 ? 'disabled' : ''} title="Move Up">▲</button>
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-down-bin" ${idx === bins.length - 1 ? 'disabled' : ''} title="Move Down">▼</button>
                <button type="button" class="rc-btn rc-btn--danger-soft rc-btn--tiny btn-del-bin" title="Delete">✕</button>
            `;

            row.querySelector('.btn-goto-bin').addEventListener('click', () => {
                post('teleportToCoords', { coords: b });
            });

            row.querySelector('.btn-edit-bin').addEventListener('click', () => {
                post('startGizmoEdit', {
                    adapter: 'garbage',
                    routeId: route.id,
                    stageKey: idx,
                    coords: b,
                });
            });

            row.querySelector('.btn-up-bin').addEventListener('click', () => {
                if (idx > 0) {
                    const temp = bins[idx - 1];
                    bins[idx - 1] = bins[idx];
                    bins[idx] = temp;
                    markDirty();
                    renderInspector();
                }
            });

            row.querySelector('.btn-down-bin').addEventListener('click', () => {
                if (idx < bins.length - 1) {
                    const temp = bins[idx + 1];
                    bins[idx + 1] = bins[idx];
                    bins[idx] = temp;
                    markDirty();
                    renderInspector();
                }
            });

            row.querySelector('.btn-del-bin').addEventListener('click', () => {
                bins.splice(idx, 1);
                markDirty();
                renderInspector();
                renderRouteList();
            });

            listContainer.appendChild(row);
        });

        card.querySelector('#rc-btn-add-bin-here').addEventListener('click', () => {
            post('capturePlayerPosAsBin', {
                adapter: 'garbage',
                routeId: route.id,
            });
        });

        card.querySelector('#rc-btn-add-bin-crosshair').addEventListener('click', () => {
            post('startCrosshairAddBin', {
                adapter: 'garbage',
                routeId: route.id,
            });
        });

        container.appendChild(card);
    }

    // ── Hunter Inspector Sub-renderer ─────────────────────────────

    function renderHunterInspector(container, route) {
        // Config card: minRank, minZ, maxZ, maxAlive, species
        const cfgCard = document.createElement('div');
        cfgCard.className = 'rc-field-card';
        const speciesVal = (route.species || []).join(', ');
        cfgCard.innerHTML = `
            <div class="rc-field-header"><span class="rc-field-title">ZONE CONFIGURATION</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                <div><label class="rc-coord-lbl">Min Rank</label>
                     <input type="number" class="rc-input-hero" id="rc-h-minrank" style="font-size:12px;padding:4px 8px;" value="${route.minRank || 1}"></div>
                <div><label class="rc-coord-lbl">Min Z</label>
                     <input type="number" class="rc-input-hero" id="rc-h-minz" style="font-size:12px;padding:4px 8px;" value="${route.minZ || 0}"></div>
                <div><label class="rc-coord-lbl">Max Z</label>
                     <input type="number" class="rc-input-hero" id="rc-h-maxz" style="font-size:12px;padding:4px 8px;" value="${route.maxZ || 300}"></div>
                <div><label class="rc-coord-lbl">Max Alive</label>
                     <input type="number" class="rc-input-hero" id="rc-h-maxalive" style="font-size:12px;padding:4px 8px;" value="${route.maxAlive || 8}"></div>
            </div>
            <div><label class="rc-coord-lbl">Species (comma-separated)</label>
                 <input type="text" class="rc-input-hero" id="rc-h-species" style="font-size:12px;padding:4px 8px;width:100%;box-sizing:border-box;" value="${escapeHtml(speciesVal)}"></div>
        `;
        container.appendChild(cfgCard);
        cfgCard.querySelector('#rc-h-minrank').addEventListener('input', e => { route.minRank = Number(e.target.value) || 1; markDirty(); });
        cfgCard.querySelector('#rc-h-minz').addEventListener('input', e => { route.minZ = Number(e.target.value) || 0; markDirty(); });
        cfgCard.querySelector('#rc-h-maxz').addEventListener('input', e => { route.maxZ = Number(e.target.value) || 300; markDirty(); });
        cfgCard.querySelector('#rc-h-maxalive').addEventListener('input', e => { route.maxAlive = Number(e.target.value) || 8; markDirty(); });
        cfgCard.querySelector('#rc-h-species').addEventListener('input', e => {
            route.species = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            markDirty();
        });

        // Polygon points card
        const polyCard = document.createElement('div');
        polyCard.className = 'rc-field-card';
        const polyPts = route.polygon || [];
        polyCard.innerHTML = `
            <div class="rc-bins-header">
                <span class="rc-field-title">POLYGON BOUNDARY (${polyPts.length} pts)</span>
                <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny" id="rc-h-add-poly">+ Add Point at Player</button>
            </div>
            <div class="rc-bins-list" id="rc-h-poly-list"></div>
        `;
        const polyList = polyCard.querySelector('#rc-h-poly-list');
        polyPts.forEach((pt, idx) => {
            const row = document.createElement('div');
            row.className = 'rc-bin-row';
            row.innerHTML = `
                <span class="rc-bin-num">#${idx + 1}</span>
                <span class="rc-bin-coords">${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}</span>
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto-poly" title="Go to">📍</button>
                <button type="button" class="rc-btn rc-btn--danger-soft rc-btn--tiny btn-del-poly" title="Delete">✕</button>
            `;
            row.querySelector('.btn-goto-poly').addEventListener('click', () => {
                post('teleportToCoords', { coords: { x: pt.x, y: pt.y, z: (route.minZ || 0) + 2 } });
            });
            row.querySelector('.btn-del-poly').addEventListener('click', () => {
                polyPts.splice(idx, 1);
                markDirty(); renderInspector(); renderRouteList();
            });
            polyList.appendChild(row);
        });
        polyCard.querySelector('#rc-h-add-poly').addEventListener('click', () => {
            post('capturePlayerPosAsPolygonPoint', { adapter: 'hunting', routeId: route.id });
        });
        container.appendChild(polyCard);

        // Spawn points card
        const spawnCard = document.createElement('div');
        spawnCard.className = 'rc-field-card';
        const spawnPts = route.spawnPoints || [];
        spawnCard.innerHTML = `
            <div class="rc-bins-header">
                <span class="rc-field-title">ANIMAL SPAWN POINTS (${spawnPts.length} pts)</span>
                <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny" id="rc-h-add-spawn">+ Add Spawn at Player</button>
            </div>
            <div class="rc-bins-list" id="rc-h-spawn-list"></div>
        `;
        const spawnList = spawnCard.querySelector('#rc-h-spawn-list');
        spawnPts.forEach((pt, idx) => {
            const row = document.createElement('div');
            row.className = 'rc-bin-row';
            row.innerHTML = `
                <span class="rc-bin-num">#${idx + 1}</span>
                <span class="rc-bin-coords">${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)} h:${(pt.h||0).toFixed(1)}°</span>
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto-spawn" title="Teleport">📍</button>
                <button type="button" class="rc-btn rc-btn--danger-soft rc-btn--tiny btn-del-spawn" title="Delete">✕</button>
            `;
            row.querySelector('.btn-goto-spawn').addEventListener('click', () => {
                post('teleportToCoords', { coords: pt });
            });
            row.querySelector('.btn-del-spawn').addEventListener('click', () => {
                spawnPts.splice(idx, 1);
                markDirty(); renderInspector(); renderRouteList();
            });
            spawnList.appendChild(row);
        });
        spawnCard.querySelector('#rc-h-add-spawn').addEventListener('click', () => {
            post('capturePlayerPosAsSpawnPoint', { adapter: 'hunting', routeId: route.id });
        });
        container.appendChild(spawnCard);
    }

    // ── Diver Inspector Sub-renderer ───────────────────────────────

    function renderDiverInspector(container, route) {
        // Config card
        const cfgCard = document.createElement('div');
        cfgCard.className = 'rc-field-card';
        cfgCard.innerHTML = `
            <div class="rc-field-header"><span class="rc-field-title">DIVE SITE CONFIGURATION</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                <div><label class="rc-coord-lbl">Min Rank</label>
                     <input type="number" class="rc-input-hero" id="rc-d-minrank" style="font-size:12px;padding:4px 8px;" value="${route.minRank || 1}"></div>
                <div><label class="rc-coord-lbl">Pay ($)</label>
                     <input type="number" class="rc-input-hero" id="rc-d-pay" style="font-size:12px;padding:4px 8px;" value="${route.pay || 200}"></div>
                <div><label class="rc-coord-lbl">Req. Salvage</label>
                     <input type="number" class="rc-input-hero" id="rc-d-reqsalvage" style="font-size:12px;padding:4px 8px;" value="${route.requiredSalvage || 3}"></div>
                <div><label class="rc-coord-lbl">Requires Boat</label>
                     <select class="rc-input-hero" id="rc-d-reqboat" style="font-size:12px;padding:4px 8px;">
                         <option value="false" ${!route.requiresBoat ? 'selected' : ''}>No</option>
                         <option value="true" ${route.requiresBoat ? 'selected' : ''}>Yes</option>
                     </select></div>
            </div>
            <div style="margin-bottom:8px;">
                <label class="rc-coord-lbl">Difficulty</label>
                <select class="rc-input-hero" id="rc-d-difficulty" style="font-size:12px;padding:4px 8px;">
                    <option value="easy" ${route.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                    <option value="medium" ${route.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="hard" ${route.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                </select>
            </div>
        `;
        container.appendChild(cfgCard);
        cfgCard.querySelector('#rc-d-minrank').addEventListener('input', e => { route.minRank = Number(e.target.value) || 1; markDirty(); });
        cfgCard.querySelector('#rc-d-pay').addEventListener('input', e => { route.pay = Number(e.target.value) || 0; markDirty(); renderRouteList(); });
        cfgCard.querySelector('#rc-d-reqsalvage').addEventListener('input', e => { route.requiredSalvage = Number(e.target.value) || 3; markDirty(); });
        cfgCard.querySelector('#rc-d-reqboat').addEventListener('change', e => { route.requiresBoat = e.target.value === 'true'; markDirty(); });
        cfgCard.querySelector('#rc-d-difficulty').addEventListener('change', e => { route.difficulty = e.target.value; markDirty(); renderRouteList(); });

        // Single-coord fields (boatSpawn, diveEntry, returnPoint)
        const singleCoords = [
            { key: 'boatSpawn',    label: 'BOAT SPAWN',     hasHeading: true  },
            { key: 'diveEntry',    label: 'DIVE ENTRY',     hasHeading: false },
            { key: 'returnPoint',  label: 'RETURN POINT',   hasHeading: false },
        ];
        singleCoords.forEach(sc => {
            const val = route[sc.key] || {};
            const card = document.createElement('div');
            card.className = 'rc-field-card';
            const xv = (val.x || 0).toFixed(2);
            const yv = (val.y || 0).toFixed(2);
            const zv = (val.z || 0).toFixed(2);
            const hv = sc.hasHeading ? (val.h || 0).toFixed(1) : null;
            card.innerHTML = `
                <div class="rc-field-header"><span class="rc-field-title">${sc.label}</span></div>
                <div class="rc-coord-grid">
                    <div class="rc-coord-box"><span class="rc-coord-lbl">X</span><span class="rc-coord-val">${xv}</span></div>
                    <div class="rc-coord-box"><span class="rc-coord-lbl">Y</span><span class="rc-coord-val">${yv}</span></div>
                    <div class="rc-coord-box"><span class="rc-coord-lbl">Z</span><span class="rc-coord-val">${zv}</span></div>
                    ${hv !== null ? `<div class="rc-coord-box"><span class="rc-coord-lbl">Heading</span><span class="rc-coord-val">${hv}°</span></div>` : ''}
                </div>
                <div class="rc-field-actions">
                    <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto">📍 Go To</button>
                    <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny btn-capture">+ Capture at Player</button>
                </div>
            `;
            card.querySelector('.btn-goto').addEventListener('click', () => {
                if (val.x) post('teleportToCoords', { coords: val });
            });
            card.querySelector('.btn-capture').addEventListener('click', () => {
                post('capturePlayerPosAsField', {
                    adapter: 'diving', routeId: route.id,
                    field: sc.key, hasHeading: sc.hasHeading, groundSnap: false,
                });
            });
            container.appendChild(card);
        });

        // Loot points card
        const lootCard = document.createElement('div');
        lootCard.className = 'rc-field-card';
        const lootPts = route.lootPoints || [];
        lootCard.innerHTML = `
            <div class="rc-bins-header">
                <span class="rc-field-title">LOOT POINTS (${lootPts.length} pts)</span>
                <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny" id="rc-d-add-loot">+ Add Loot Point at Player</button>
            </div>
            <div class="rc-bins-list" id="rc-d-loot-list"></div>
        `;
        const lootList = lootCard.querySelector('#rc-d-loot-list');
        lootPts.forEach((pt, idx) => {
            const row = document.createElement('div');
            row.className = 'rc-bin-row';
            row.innerHTML = `
                <span class="rc-bin-num">#${idx + 1}</span>
                <span class="rc-bin-coords">${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)}</span>
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto-loot" title="Go to">📍</button>
                <button type="button" class="rc-btn rc-btn--danger-soft rc-btn--tiny btn-del-loot" title="Delete">✕</button>
            `;
            row.querySelector('.btn-goto-loot').addEventListener('click', () => {
                post('teleportToCoords', { coords: pt });
            });
            row.querySelector('.btn-del-loot').addEventListener('click', () => {
                lootPts.splice(idx, 1);
                markDirty(); renderInspector(); renderRouteList();
            });
            lootList.appendChild(row);
        });
        lootCard.querySelector('#rc-d-add-loot').addEventListener('click', () => {
            post('capturePlayerPosAsLootPoint', { adapter: 'diving', routeId: route.id });
        });
        container.appendChild(lootCard);

        // Search zone (center + radius) card
        const szCard = document.createElement('div');
        szCard.className = 'rc-field-card';
        const sz = route.searchZone || {};
        const szCenter = sz.center || {};
        szCard.innerHTML = `
            <div class="rc-field-header"><span class="rc-field-title">SEARCH ZONE</span></div>
            <div class="rc-coord-grid" style="margin-bottom:8px;">
                <div class="rc-coord-box"><span class="rc-coord-lbl">X</span><span class="rc-coord-val">${(szCenter.x || 0).toFixed(2)}</span></div>
                <div class="rc-coord-box"><span class="rc-coord-lbl">Y</span><span class="rc-coord-val">${(szCenter.y || 0).toFixed(2)}</span></div>
                <div class="rc-coord-box"><span class="rc-coord-lbl">Z</span><span class="rc-coord-val">${(szCenter.z || 0).toFixed(2)}</span></div>
            </div>
            <div style="margin-bottom:8px;">
                <label class="rc-coord-lbl">Radius (m)</label>
                <input type="number" class="rc-input-hero" id="rc-d-sz-radius" style="font-size:12px;padding:4px 8px;width:100px;" value="${sz.radius || 50}">
            </div>
            <div class="rc-field-actions">
                <button type="button" class="rc-btn rc-btn--secondary rc-btn--tiny btn-goto-sz">📍 Go To</button>
                <button type="button" class="rc-btn rc-btn--primary rc-btn--tiny btn-capture-sz">+ Capture Center at Player</button>
            </div>
        `;
        szCard.querySelector('#rc-d-sz-radius').addEventListener('input', e => {
            route.searchZone = route.searchZone || {};
            route.searchZone.radius = Number(e.target.value) || 50;
            markDirty();
        });
        szCard.querySelector('.btn-goto-sz').addEventListener('click', () => {
            if (szCenter.x) post('teleportToCoords', { coords: szCenter });
        });
        szCard.querySelector('.btn-capture-sz').addEventListener('click', () => {
            post('capturePlayerPosAsField', {
                adapter: 'diving', routeId: route.id,
                field: 'searchZoneCenter', hasHeading: false, groundSnap: false,
            });
        });
        container.appendChild(szCard);
    }

    // ── Validation Section ─────────────────────────────────────────

    function renderValidation(route) {
        const list = $('#rc-validation-list');
        list.innerHTML = '';

        const results = [];

        if (!route.id) results.push({ status: 'FAIL', message: 'Route ID is missing' });
        else results.push({ status: 'PASS', message: `ID: ${route.id}` });

        if (!route.label) results.push({ status: 'FAIL', message: 'Route label is missing' });
        else results.push({ status: 'PASS', message: `Label: ${route.label}` });

        if (State.activeAdapter === 'trucker') {
            if (!route.pay || route.pay <= 0) results.push({ status: 'FAIL', message: 'Pay must be > $0' });
            else results.push({ status: 'PASS', message: `Base Pay: $${route.pay}` });

            if (route.delivery && route.parkingBay) {
                const dx = (route.delivery.x || 0) - (route.parkingBay.x || 0);
                const dy = (route.delivery.y || 0) - (route.parkingBay.y || 0);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 250) {
                    results.push({ status: 'WARNING', message: `Delivery & Parking Bay are ${dist.toFixed(1)}m apart` });
                } else {
                    results.push({ status: 'PASS', message: `Delivery -> Bay distance: ${dist.toFixed(1)}m` });
                }
            }
        } else if (State.activeAdapter === 'garbage') {
            const count = (route.bins && route.bins.length) || 0;
            if (count === 0) results.push({ status: 'FAIL', message: 'Route has no bins' });
            else if (count < 8) results.push({ status: 'WARNING', message: `Route has ${count}/8 bins` });
            else results.push({ status: 'PASS', message: `${count} collection stops configured` });
        } else if (State.activeAdapter === 'hunting') {
            const polyCount = (route.polygon && route.polygon.length) || 0;
            if (polyCount < 3) results.push({ status: 'FAIL', message: `Polygon needs ≥3 points (has ${polyCount})` });
            else results.push({ status: 'PASS', message: `Polygon: ${polyCount} vertices` });
            const spawnCount = (route.spawnPoints && route.spawnPoints.length) || 0;
            if (spawnCount === 0) results.push({ status: 'FAIL', message: 'No spawn points defined' });
            else results.push({ status: 'PASS', message: `${spawnCount} spawn point(s)` });
            const speciesCount = (route.species && route.species.length) || 0;
            if (speciesCount === 0) results.push({ status: 'WARNING', message: 'No species defined — will use job defaults' });
            else results.push({ status: 'PASS', message: `Species: ${route.species.join(', ')}` });
        } else if (State.activeAdapter === 'diving') {
            const lpCount = (route.lootPoints && route.lootPoints.length) || 0;
            const reqSalvage = route.requiredSalvage || 3;
            if (lpCount === 0) results.push({ status: 'FAIL', message: 'No loot points defined' });
            else if (lpCount < reqSalvage) results.push({ status: 'WARNING', message: `${lpCount} loot pts < ${reqSalvage} required salvage` });
            else results.push({ status: 'PASS', message: `${lpCount} loot point(s) configured` });
            if (!route.diveEntry || !route.diveEntry.x) results.push({ status: 'WARNING', message: 'Dive entry not set' });
            else results.push({ status: 'PASS', message: `Dive entry set` });
            if (!route.searchZone || !route.searchZone.center || !route.searchZone.center.x)
                results.push({ status: 'WARNING', message: 'Search zone center not set' });
            else results.push({ status: 'PASS', message: `Search zone radius: ${route.searchZone.radius || 50}m` });
            if (!route.pay || route.pay <= 0) results.push({ status: 'FAIL', message: 'Pay must be > $0' });
            else results.push({ status: 'PASS', message: `Contract pay: $${route.pay}` });
        }

        results.forEach(res => {
            const item = document.createElement('div');
            item.className = 'rc-val-item';
            item.innerHTML = `
                <span class="rc-val-badge rc-val-badge--${res.status}">${res.status}</span>
                <span>${escapeHtml(res.message)}</span>
            `;
            list.appendChild(item);
        });
    }

    // ── Modals & Dialogs ───────────────────────────────────────────

    function showModal(title, msg, onConfirm) {
        $('#rc-modal-title').textContent = title;
        $('#rc-modal-msg').textContent = msg;
        State.pendingAction = onConfirm;
        $('#rc-modal').classList.remove('hidden');
    }

    function hideModal() {
        $('#rc-modal').classList.add('hidden');
        State.pendingAction = null;
    }

    $('#rc-modal-cancel').addEventListener('click', hideModal);
    $('#rc-modal-confirm').addEventListener('click', () => {
        if (typeof State.pendingAction === 'function') {
            State.pendingAction();
        }
        hideModal();
    });

    function showTestModal() {
        const route = getSelectedRoute();
        if (!route) return;

        const list = $('#rc-test-actions-list');
        list.innerHTML = '';

        if (State.activeAdapter === 'trucker') {
            const actions = [
                { label: 'Teleport Ped Near Pickup Dock', type: 'ped_pickup', coords: route.pickup },
                { label: 'Teleport Work Rig to Pickup Bay', type: 'rig_pickup', coords: route.pickup },
                { label: 'Teleport Work Rig Near Delivery Entrance', type: 'rig_delivery', coords: route.delivery },
                { label: 'Teleport Work Rig Near Manual Parking Bay', type: 'rig_bay', coords: route.parkingBay },
            ];

            actions.forEach(act => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rc-btn rc-btn--primary';
                btn.textContent = act.label;
                btn.addEventListener('click', () => {
                    post('testTeleport', { type: act.type, coords: act.coords });
                });
                list.appendChild(btn);
            });
        } else if (State.activeAdapter === 'garbage') {
            (route.bins || []).forEach((b, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rc-btn rc-btn--secondary';
                btn.textContent = I18n.t('dynamic.app.teleport_to_bin_value0', { value0: idx + 1 });
                btn.addEventListener('click', () => {
                    post('testTeleport', { type: 'ped_bin', coords: b });
                });
                list.appendChild(btn);
            });
        } else if (State.activeAdapter === 'hunting') {
            (route.spawnPoints || []).forEach((pt, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rc-btn rc-btn--secondary';
                btn.textContent = I18n.t('dynamic.app.teleport_to_spawn_point_value0', { value0: idx + 1 });
                btn.addEventListener('click', () => {
                    post('testTeleport', { type: 'ped_spawn', coords: pt });
                });
                list.appendChild(btn);
            });
        } else if (State.activeAdapter === 'diving') {
            const previewActions = [
                { label: 'Teleport to Dive Entry', coords: route.diveEntry },
                { label: 'Teleport to Boat Spawn', coords: route.boatSpawn },
                { label: 'Teleport to Return Point', coords: route.returnPoint },
            ];
            previewActions.forEach(act => {
                if (!act.coords || !act.coords.x) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rc-btn rc-btn--secondary';
                btn.textContent = act.label;
                btn.addEventListener('click', () => {
                    post('testTeleport', { type: 'ped_coord', coords: act.coords });
                });
                list.appendChild(btn);
            });
            (route.lootPoints || []).forEach((pt, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rc-btn rc-btn--accent';
                btn.textContent = I18n.t('dynamic.app.teleport_to_loot_point_value0', { value0: idx + 1 });
                btn.addEventListener('click', () => {
                    post('testTeleport', { type: 'ped_coord', coords: pt });
                });
                list.appendChild(btn);
            });
        }

        $('#rc-test-modal').classList.remove('hidden');
    }

    function hideTestModal() {
        $('#rc-test-modal').classList.add('hidden');
    }

    $('#rc-test-modal-close').addEventListener('click', hideTestModal);

    // ── Button Listeners ───────────────────────────────────────────

    // Adapter Switch
    $$('.rc-adapter-item').forEach(el => {
        el.addEventListener('click', () => {
            if (el.classList.contains('disabled')) return;
            const ad = el.dataset.adapter;
            if (ad !== State.activeAdapter) {
                State.activeAdapter = ad;
                renderAdapters();
                post('getRoutes', { adapter: ad }).then(res => {
                    if (res && res.routes) {
                        State.routes[ad] = res.routes;
                    }
                    renderRouteList();
                    if (State.routes[ad]?.length > 0) {
                        selectRoute(State.routes[ad][0].id);
                    } else {
                        deselectRoute();
                    }
                });
            }
        });
    });

    // Search Input
    $('#rc-search-input').addEventListener('input', renderRouteList);

    // New Route
    $('#rc-btn-new-route').addEventListener('click', () => {
        const timestamp = Date.now().toString().slice(-4);
        let newRoute;
        if (State.activeAdapter === 'trucker') {
            newRoute = {
                id: `fuel_custom_${timestamp}`,
                label: `New Trucker Route ${timestamp}`,
                category: 'fuel',
                pay: 750,
                pickup: { x: 1234.3, y: -3104.2, z: 4.8, h: 3.5, w: 3.5 },
                delivery: { x: 1181.2, y: 2671.5, z: 37.9, h: 0.0, w: 0.0 },
                parkingBay: { x: 1181.2, y: 2671.5, z: 37.9, h: 0.0, w: 0.0 },
            };
        } else if (State.activeAdapter === 'garbage') {
            newRoute = {
                id: `garbage_custom_${timestamp}`,
                label: `New Garbage Route ${timestamp}`,
                bins: [],
            };
        } else if (State.activeAdapter === 'hunting') {
            newRoute = {
                id: `hunt_zone_${timestamp}`,
                label: `New Hunt Zone ${timestamp}`,
                minRank: 1,
                minZ: 0,
                maxZ: 300,
                maxAlive: 8,
                species: ['a_c_deer'],
                polygon: [],
                spawnPoints: [],
            };
        } else {
            newRoute = {
                id: `dive_site_${timestamp}`,
                label: `New Dive Site ${timestamp}`,
                minRank: 1,
                difficulty: 'easy',
                requiredSalvage: 3,
                pay: 200,
                requiresBoat: false,
                searchZone: { center: { x: 0, y: 0, z: -20 }, radius: 50 },
                boatSpawn: { x: 0, y: 0, z: 0, h: 0 },
                diveEntry: { x: 0, y: 0, z: -5 },
                returnPoint: { x: 0, y: 0, z: 0 },
                lootPoints: [],
            };
        }
        State.routes[State.activeAdapter].push(newRoute);
        markDirty();
        renderRouteList();
        selectRoute(newRoute.id);
    });

    // Duplicate Route
    $('#rc-btn-duplicate-route').addEventListener('click', () => {
        const cur = getSelectedRoute();
        if (!cur) return;
        const copy = JSON.parse(JSON.stringify(cur));
        copy.id = `${cur.id}_copy`;
        copy.label = `${cur.label || cur.id} (Copy)`;
        State.routes[State.activeAdapter].push(copy);
        markDirty();
        renderRouteList();
        selectRoute(copy.id);
    });

    // Delete Route
    $('#rc-btn-delete-route').addEventListener('click', () => {
        const cur = getSelectedRoute();
        if (!cur) return;
        showModal('Delete Route', `Are you sure you want to delete "${cur.label || cur.id}"? This will remove it for new job shifts. Active sessions will continue using their route snapshot.`, () => {
            const list = State.routes[State.activeAdapter];
            const idx = list.findIndex(r => r.id === cur.id);
            if (idx !== -1) {
                list.splice(idx, 1);
                markDirty();
                renderRouteList();
                if (list.length > 0) {
                    selectRoute(list[0].id);
                } else {
                    deselectRoute();
                }
            }
        });
    });

    // Preview in World
    $('#rc-btn-preview-world').addEventListener('click', () => {
        const cur = getSelectedRoute();
        if (!cur) return;
        post('previewRouteInWorld', {
            adapter: State.activeAdapter,
            route: cur,
        });
    });

    // Test Mode Modal
    $('#rc-btn-test-route').addEventListener('click', showTestModal);

    // Save All Routes to Disk
    $('#rc-btn-save-routes').addEventListener('click', () => {
        const list = State.routes[State.activeAdapter] || [];
        post('saveJobRoutes', {
            adapter: State.activeAdapter,
            routes: list,
        }).then(res => {
            if (res && res.ok) {
                markSaved();
            }
        });
    });

    // Reload From Disk
    $('#rc-btn-reload').addEventListener('click', () => {
        showModal('Reload From Disk', 'Reload route configuration from disk? Any unsaved in-memory edits will be overwritten.', () => {
            post('reloadJobRoutes', {}).then(res => {
                if (res && res.routes) {
                    State.routes = res.routes;
                    markSaved();
                    renderRouteList();
                    if (State.routes[State.activeAdapter]?.length > 0) {
                        selectRoute(State.routes[State.activeAdapter][0].id);
                    } else {
                        deselectRoute();
                    }
                }
            });
        });
    });

    // Header Label & ID Inputs
    $('#rc-insp-label').addEventListener('input', (e) => {
        const cur = getSelectedRoute();
        if (cur) {
            cur.label = e.target.value;
            markDirty();
            renderRouteList();
        }
    });

    $('#rc-insp-id').addEventListener('input', (e) => {
        const cur = getSelectedRoute();
        if (cur) {
            cur.id = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
            markDirty();
            renderRouteList();
        }
    });

    $('#rc-btn-close').addEventListener('click', requestClose);

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
})();
