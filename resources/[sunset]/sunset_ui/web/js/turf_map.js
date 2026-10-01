/* ═══════════════════════════════════════════════════════════════════
   SUNSETMP — Turf Map SVG Visualization Engine (turf_map.js)
   Renders real world polygon territories onto GTA V Los Santos map.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // GTA V World Bounds to SVG 2048x2048 calibration
    const WORLD_BOUNDS = {
        minX: -4000.0,
        maxX: 4000.0,
        minY: -4000.0,
        maxY: 8000.0
    };
    const MAP_SIZE = 2048;

    // Calibration Landmarks for Visual Verification
    const LANDMARKS = [
        { name: 'Legion Square', x: 215.0, y: -915.0, color: '#f1c40f' },
        { name: 'Maze Bank Tower', x: -75.0, y: -818.0, color: '#3498db' },
        { name: 'LSIA Airport', x: -1035.0, y: -2733.0, color: '#e67e22' },
        { name: 'Grove Street', x: 108.0, y: -1935.0, color: '#2ecc71' },
        { name: 'Sandy Shores Airfield', x: 1735.0, y: 3285.0, color: '#e74c3c' },
        { name: 'Paleto Bay Bank', x: -110.0, y: 6465.0, color: '#9b59b6' }
    ];

    /**
     * Centralized transform: GTA world coords (X, Y) -> SVG (mapX, mapY)
     */
    function worldToSvg(worldX, worldY) {
        const x = Number(worldX) || 0.0;
        const y = Number(worldY) || 0.0;
        const mapX = ((x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * MAP_SIZE;
        const mapY = MAP_SIZE - (((y - WORLD_BOUNDS.minY) / (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY)) * MAP_SIZE);
        return { x: mapX, y: mapY };
    }

    /**
     * Helper to convert hex or color string to rgba
     */
    function hexToRgba(color, alpha = 0.35) {
        if (!color) return `rgba(144, 164, 174, ${alpha})`;
        if (color.startsWith('rgba') || color.startsWith('rgb')) return color;
        let c = color.replace('#', '');
        if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
        if (c.length === 6) {
            const num = parseInt(c, 16);
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgba(144, 164, 174, ${alpha})`;
    }

    const TurfMap = {
        isOpen: false,
        debugMode: false,
        turfs: {},
        adjacency: {},
        activeWars: {},
        cooldowns: {},
        playerCoords: null,

        // Canvas pan & zoom state
        viewX: -400,
        viewY: -900,
        scale: 1.0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        initialPanSet: false,

        init() {
            this.bindEvents();
        },

        bindEvents() {
            const screen = document.getElementById('turf-map-screen');
            const viewport = document.getElementById('turf-map-viewport');
            const closeBtn = document.getElementById('turf-map-close-btn');
            const debugBtn = document.getElementById('turf-map-debug-toggle');
            const zoomIn = document.getElementById('turf-zoom-in');
            const zoomOut = document.getElementById('turf-zoom-out');
            const zoomReset = document.getElementById('turf-zoom-reset');
            const focusPlayer = document.getElementById('turf-focus-player');

            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            if (debugBtn) {
                debugBtn.addEventListener('click', () => this.toggleDebug());
            }

            if (zoomIn) {
                zoomIn.addEventListener('click', () => this.zoom(0.25));
            }
            if (zoomOut) {
                zoomOut.addEventListener('click', () => this.zoom(-0.25));
            }
            if (zoomReset) {
                zoomReset.addEventListener('click', () => this.resetView());
            }
            if (focusPlayer) {
                focusPlayer.addEventListener('click', () => this.centerOnPlayer());
            }

            if (viewport) {
                // Drag Pan
                viewport.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return; // Left click only
                    this.isDragging = true;
                    viewport.classList.add('is-dragging');
                    this.dragStartX = e.clientX - this.viewX;
                    this.dragStartY = e.clientY - this.viewY;
                });

                window.addEventListener('mousemove', (e) => {
                    if (!this.isOpen) return;
                    if (this.isDragging) {
                        this.viewX = e.clientX - this.dragStartX;
                        this.viewY = e.clientY - this.dragStartY;
                        this.updateTransform();
                    }
                    this.updateTooltipPosition(e);
                });

                window.addEventListener('mouseup', () => {
                    if (this.isDragging) {
                        this.isDragging = false;
                        viewport?.classList.remove('is-dragging');
                    }
                });

                // Wheel Zoom (Zoom around mouse cursor)
                viewport.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const rect = viewport.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;

                    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
                    const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.4), 4.5);

                    // Adjust viewX and viewY so point under cursor stays stationary
                    this.viewX = mouseX - (mouseX - this.viewX) * (newScale / this.scale);
                    this.viewY = mouseY - (mouseY - this.viewY) * (newScale / this.scale);
                    this.scale = newScale;

                    this.updateTransform();
                }, { passive: false });
            }
        },

        open(payload = {}) {
            this.isOpen = true;
            this.turfs = payload.turfs || {};
            this.adjacency = payload.adjacency || {};
            this.activeWars = payload.activeWars || {};
            this.cooldowns = payload.cooldowns || {};
            this.playerCoords = payload.playerCoords || null;

            const screen = document.getElementById('turf-map-screen');
            if (screen) {
                screen.classList.remove('hidden');
                screen.setAttribute('aria-hidden', 'false');
            }

            // Initial view setup: Focus on player or default to Los Santos city center
            if (!this.initialPanSet) {
                if (this.playerCoords && this.playerCoords.x) {
                    this.centerOnCoords(this.playerCoords.x, this.playerCoords.y);
                } else {
                    // Default to Los Santos downtown (Legion Square / Davis)
                    this.centerOnCoords(100, -1500, 1.3);
                }
                this.initialPanSet = true;
            }

            this.render();
        },

        close() {
            if (!this.isOpen) return;
            this.isOpen = false;
            const screen = document.getElementById('turf-map-screen');
            if (screen) {
                screen.classList.add('hidden');
                screen.setAttribute('aria-hidden', 'true');
            }
            this.hideTooltip();
            window.post?.('turfMapClose', {});
        },

        sync(payload = {}) {
            if (payload.turfs) this.turfs = payload.turfs;
            if (payload.adjacency) this.adjacency = payload.adjacency;
            if (this.isOpen) this.render();
        },

        updateWar(war) {
            if (!war || !war.turfId) return;
            this.activeWars[war.turfId] = war;
            if (this.isOpen) this.render();
        },

        endWar(data) {
            if (data && data.turfId) {
                delete this.activeWars[data.turfId];
                if (this.isOpen) this.render();
            }
        },

        toggleDebug() {
            this.debugMode = !this.debugMode;
            const btn = document.getElementById('turf-map-debug-toggle');
            const panel = document.getElementById('turf-debug-panel');
            const debugLayer = document.getElementById('turf-debug-layer');
            const linksLayer = document.getElementById('turf-links-layer');

            if (btn) btn.classList.toggle('active', this.debugMode);
            if (panel) panel.classList.toggle('hidden', !this.debugMode);
            if (debugLayer) debugLayer.classList.toggle('hidden', !this.debugMode);
            if (linksLayer) linksLayer.classList.toggle('hidden', !this.debugMode);

            this.render();
        },

        zoom(delta) {
            const viewport = document.getElementById('turf-map-viewport');
            if (!viewport) return;
            const rect = viewport.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const newScale = Math.min(Math.max(this.scale + delta, 0.4), 4.5);
            this.viewX = centerX - (centerX - this.viewX) * (newScale / this.scale);
            this.viewY = centerY - (centerY - this.viewY) * (newScale / this.scale);
            this.scale = newScale;
            this.updateTransform();
        },

        resetView() {
            this.centerOnCoords(100, -1500, 1.2);
        },

        centerOnPlayer() {
            if (this.playerCoords && this.playerCoords.x != null) {
                this.centerOnCoords(this.playerCoords.x, this.playerCoords.y, 1.6);
            } else {
                this.resetView();
            }
        },

        centerOnCoords(worldX, worldY, targetScale = null) {
            const viewport = document.getElementById('turf-map-viewport');
            if (!viewport) return;
            if (targetScale) this.scale = targetScale;

            const svgPt = worldToSvg(worldX, worldY);
            const rect = viewport.getBoundingClientRect();
            this.viewX = (rect.width / 2) - (svgPt.x * this.scale);
            this.viewY = (rect.height / 2) - (svgPt.y * this.scale);
            this.updateTransform();
        },

        updateTransform() {
            const canvas = document.getElementById('turf-map-canvas');
            if (canvas) {
                canvas.style.transform = `translate(${this.viewX}px, ${this.viewY}px) scale(${this.scale})`;
            }
        },

        /**
         * Render turf polygons and layers into SVG
         */
        render() {
            const polygonsLayer = document.getElementById('turf-polygons-layer');
            const linksLayer = document.getElementById('turf-links-layer');
            const markersLayer = document.getElementById('turf-markers-layer');
            const debugLayer = document.getElementById('turf-debug-layer');

            if (!polygonsLayer) return;

            polygonsLayer.innerHTML = '';
            if (linksLayer) linksLayer.innerHTML = '';
            if (markersLayer) markersLayer.innerHTML = '';
            if (debugLayer) debugLayer.innerHTML = '';

            let turfCount = 0;
            let warCount = Object.keys(this.activeWars).length;

            const turfsList = Object.values(this.turfs);
            turfCount = turfsList.length;

            // Update stats
            const statCount = document.getElementById('turf-stat-count');
            const statWars = document.getElementById('turf-stat-wars');
            if (statCount) statCount.textContent = turfCount;
            if (statWars) statWars.textContent = warCount;

            // 1. Render Adjacency Links (if debug mode)
            if (this.debugMode && linksLayer && this.adjacency) {
                for (const [turfAId, connectedMap] of Object.entries(this.adjacency)) {
                    const turfA = this.turfs[turfAId];
                    if (!turfA) continue;
                    const centerA = turfA.coords || { x: 0, y: 0 };
                    const ptA = worldToSvg(centerA.x, centerA.y);

                    for (const turfBId of Object.keys(connectedMap || {})) {
                        const turfB = this.turfs[turfBId];
                        if (!turfB || Number(turfBId) < Number(turfAId)) continue;
                        const centerB = turfB.coords || { x: 0, y: 0 };
                        const ptB = worldToSvg(centerB.x, centerB.y);

                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('x1', ptA.x.toFixed(1));
                        line.setAttribute('y1', ptA.y.toFixed(1));
                        line.setAttribute('x2', ptB.x.toFixed(1));
                        line.setAttribute('y2', ptB.y.toFixed(1));
                        line.setAttribute('stroke', 'rgba(0, 255, 204, 0.4)');
                        line.setAttribute('stroke-width', '2');
                        line.setAttribute('stroke-dasharray', '4 4');
                        linksLayer.appendChild(line);
                    }
                }
            }

            // 2. Render Turf Polygons
            turfsList.forEach((turf) => {
                const war = this.activeWars[turf.id];
                const isWar = !!war;
                const hasOwner = !!turf.ownerClanId;
                const ownerColor = turf.ownerColor || (hasOwner ? '#2ecc71' : '#90a4ae');

                // Generate SVG Points string
                let pointsStr = '';
                let centerPt = { x: 0, y: 0 };

                if (turf.polygon && turf.polygon.length >= 3) {
                    pointsStr = turf.polygon.map((p) => {
                        const pt = worldToSvg(p.x, p.y);
                        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                    }).join(' ');

                    const centerCoords = turf.coords || { x: 0, y: 0 };
                    centerPt = worldToSvg(centerCoords.x, centerCoords.y);
                } else if (turf.coords) {
                    // Fallback to circle polygon approximation if no hand-drawn polygon
                    const c = turf.coords;
                    const r = turf.radius || 100;
                    const sides = 16;
                    const pts = [];
                    for (let i = 0; i < sides; i++) {
                        const angle = (i / sides) * Math.PI * 2;
                        const wx = c.x + Math.cos(angle) * r;
                        const wy = c.y + Math.sin(angle) * r;
                        const pt = worldToSvg(wx, wy);
                        pts.push(`${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
                    }
                    pointsStr = pts.join(' ');
                    centerPt = worldToSvg(c.x, c.y);
                }

                if (!pointsStr) return;

                // SVG Polygon element
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', pointsStr);
                polygon.setAttribute('class', `turf-polygon ${isWar ? 'turf-polygon--war' : ''}`);
                polygon.setAttribute('data-turf-id', turf.id);

                if (isWar) {
                    polygon.setAttribute('fill', 'rgba(255, 59, 48, 0.45)');
                    polygon.setAttribute('stroke', '#ff3838');
                    polygon.setAttribute('stroke-width', '3');
                    polygon.setAttribute('filter', 'url(#war-glow)');
                } else {
                    const fillRgba = hexToRgba(ownerColor, hasOwner ? 0.32 : 0.22);
                    polygon.setAttribute('fill', fillRgba);
                    polygon.setAttribute('stroke', ownerColor);
                    polygon.setAttribute('stroke-width', '2');
                }

                // Interactive hover & click
                polygon.addEventListener('mouseenter', (e) => this.showTooltip(turf, war, e));
                polygon.addEventListener('mouseleave', () => this.hideTooltip());
                polygon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const c = turf.coords || { x: 0, y: 0 };
                    this.centerOnCoords(c.x, c.y, 1.8);
                });

                polygonsLayer.appendChild(polygon);

                // Turf Center Name & Clan Tag Labels
                if (centerPt.x > 0 && centerPt.y > 0) {
                    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    labelGroup.setAttribute('class', 'turf-label-group');

                    const textName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    textName.setAttribute('x', centerPt.x.toFixed(1));
                    textName.setAttribute('y', (centerPt.y - 4).toFixed(1));
                    textName.setAttribute('class', 'turf-label-text');
                    textName.textContent = turf.name || `Turf #${turf.id}`;
                    labelGroup.appendChild(textName);

                    const textTag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    textTag.setAttribute('x', centerPt.x.toFixed(1));
                    textTag.setAttribute('y', (centerPt.y + 8).toFixed(1));
                    textTag.setAttribute('class', 'turf-tag-text');
                    textTag.setAttribute('fill', isWar ? '#ff4757' : ownerColor);
                    textTag.textContent = isWar ? '⚔ ' + I18n.t('ui.turf.war_caps') + ' ⚔' : (hasOwner ? (turf.ownerTag ? `[${turf.ownerTag}]` : turf.ownerName) : I18n.t('ui.turf.free_caps'));
                    labelGroup.appendChild(textTag);

                    polygonsLayer.appendChild(labelGroup);
                }

                // 3. Render Debug Geometry Overlay (Vertices, indices, coordinates)
                if (this.debugMode && debugLayer && turf.polygon) {
                    turf.polygon.forEach((v, idx) => {
                        const pt = worldToSvg(v.x, v.y);

                        // Vertex point circle
                        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        circle.setAttribute('cx', pt.x.toFixed(1));
                        circle.setAttribute('cy', pt.y.toFixed(1));
                        circle.setAttribute('r', '3.5');
                        circle.setAttribute('fill', '#00ffcc');
                        circle.setAttribute('stroke', '#0d1117');
                        circle.setAttribute('stroke-width', '1.5');
                        debugLayer.appendChild(circle);

                        // Vertex index label
                        const vLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        vLabel.setAttribute('x', (pt.x + 5).toFixed(1));
                        vLabel.setAttribute('y', (pt.y - 5).toFixed(1));
                        vLabel.setAttribute('font-size', '8px');
                        vLabel.setAttribute('font-family', 'monospace');
                        vLabel.setAttribute('fill', '#00ffcc');
                        vLabel.textContent = `${idx}`;
                        debugLayer.appendChild(vLabel);
                    });
                }
            });

            // 4. Render Calibration Landmark Markers (in debug mode)
            if (this.debugMode && markersLayer) {
                LANDMARKS.forEach((lm) => {
                    const pt = worldToSvg(lm.x, lm.y);

                    const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

                    // Crosshair
                    const ch1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    ch1.setAttribute('x1', (pt.x - 8).toFixed(1));
                    ch1.setAttribute('y1', pt.y.toFixed(1));
                    ch1.setAttribute('x2', (pt.x + 8).toFixed(1));
                    ch1.setAttribute('y2', pt.y.toFixed(1));
                    ch1.setAttribute('stroke', lm.color);
                    ch1.setAttribute('stroke-width', '1.5');

                    const ch2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    ch2.setAttribute('x1', pt.x.toFixed(1));
                    ch2.setAttribute('y1', (pt.y - 8).toFixed(1));
                    ch2.setAttribute('x2', pt.x.toFixed(1));
                    ch2.setAttribute('y2', (pt.y + 8).toFixed(1));
                    ch2.setAttribute('stroke', lm.color);
                    ch2.setAttribute('stroke-width', '1.5');

                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', (pt.x + 10).toFixed(1));
                    text.setAttribute('y', (pt.y + 3).toFixed(1));
                    text.setAttribute('font-size', '9px');
                    text.setAttribute('font-weight', '700');
                    text.setAttribute('fill', lm.color);
                    text.textContent = `★ ${lm.name} (${lm.x.toFixed(0)}, ${lm.y.toFixed(0)})`;

                    markerGroup.appendChild(ch1);
                    markerGroup.appendChild(ch2);
                    markerGroup.appendChild(text);
                    markersLayer.appendChild(markerGroup);
                });
            }

            // 5. Render Player Marker (if coords available)
            if (this.playerCoords && this.playerCoords.x != null && markersLayer) {
                const pt = worldToSvg(this.playerCoords.x, this.playerCoords.y);
                const pGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                pGroup.setAttribute('class', 'turf-player-marker');

                const pulseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                pulseCircle.setAttribute('cx', pt.x.toFixed(1));
                pulseCircle.setAttribute('cy', pt.y.toFixed(1));
                pulseCircle.setAttribute('r', '8');
                pulseCircle.setAttribute('fill', 'rgba(0, 255, 204, 0.3)');
                pulseCircle.setAttribute('stroke', '#00ffcc');
                pulseCircle.setAttribute('stroke-width', '2');

                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', pt.x.toFixed(1));
                dot.setAttribute('cy', pt.y.toFixed(1));
                dot.setAttribute('r', '3.5');
                dot.setAttribute('fill', '#ffffff');

                pGroup.appendChild(pulseCircle);
                pGroup.appendChild(dot);
                markersLayer.appendChild(pGroup);
            }
        },

        showTooltip(turf, war, event) {
            const tooltip = document.getElementById('turf-map-tooltip');
            if (!tooltip) return;

            const idEl = document.getElementById('tooltip-turf-id');
            const nameEl = document.getElementById('tooltip-turf-name');
            const ownerEl = document.getElementById('tooltip-turf-owner');
            const statusEl = document.getElementById('tooltip-turf-status');
            const warRow = document.getElementById('tooltip-war-row');
            const warInfo = document.getElementById('tooltip-war-info');
            const incomeEl = document.getElementById('tooltip-turf-income');

            if (idEl) idEl.textContent = `#${turf.id}`;
            if (nameEl) nameEl.textContent = turf.name || `Turf #${turf.id}`;

            const hasOwner = !!turf.ownerClanId;
            if (ownerEl) {
                ownerEl.textContent = hasOwner ? `${turf.ownerName} [${turf.ownerTag || '--'}]` : 'Unowned (Neutral)';
                ownerEl.style.color = hasOwner ? (turf.ownerColor || '#2ecc71') : '#8b949e';
            }

            if (war) {
                if (statusEl) {
                    statusEl.textContent = I18n.t('dynamic.turf_map.contested_at_war');
                    statusEl.className = 'tooltip-val tooltip-status war';
                }
                if (warRow) warRow.style.display = 'flex';
                if (warInfo) {
                    const remSec = war.remainingSec || 0;
                    const mins = Math.floor(remSec / 60);
                    const secs = remSec % 60;
                    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    warInfo.textContent = `${war.attackerName || 'Attacker'} vs ${war.defenderName || 'Defender'} (${timeStr})`;
                }
            } else {
                if (statusEl) {
                    statusEl.textContent = I18n.t('dynamic.turf_map.peace');
                    statusEl.className = 'tooltip-val tooltip-status';
                }
                if (warRow) warRow.style.display = 'none';
            }

            if (incomeEl) {
                const payout = turf.payout || 1500;
                incomeEl.textContent = I18n.t('ui.turf.income_interval', { amount: I18n.number(payout) });
            }

            tooltip.classList.remove('hidden');

            // Update debug content panel if debug mode active
            if (this.debugMode) {
                const debugContent = document.getElementById('turf-debug-content');
                if (debugContent) {
                    const c = turf.coords || { x: 0, y: 0, z: 0 };
                    const svgPt = worldToSvg(c.x, c.y);
                    const vertexCount = turf.polygon ? turf.polygon.length : 0;
                    debugContent.innerHTML = `
                        <strong>Turf #${((v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])))(turf.id)}: ${((v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])))(turf.name)}</strong><br>
                        Vertices: ${vertexCount} points<br>
                        World Center: X=${c.x.toFixed(1)}, Y=${c.y.toFixed(1)}, Z=${c.z.toFixed(1)}<br>
                        SVG Center: X=${svgPt.x.toFixed(1)}, Y=${svgPt.y.toFixed(1)}<br>
                        Owner Clan: ID=${turf.ownerClanId || 'None'} (${((v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])))(turf.ownerName)})<br>
                        Bounds: minZ=${turf.minZ || -50}, maxZ=${turf.maxZ || 500}<br>
                        Radius: ${turf.radius ? turf.radius.toFixed(1) : 'N/A'}m
                    `;
                }
            }
        },

        hideTooltip() {
            const tooltip = document.getElementById('turf-map-tooltip');
            if (tooltip) tooltip.classList.add('hidden');
        },

        updateTooltipPosition(e) {
            const tooltip = document.getElementById('turf-map-tooltip');
            if (!tooltip || tooltip.classList.contains('hidden')) return;

            const viewport = document.getElementById('turf-map-viewport');
            if (!viewport) return;
            const rect = viewport.getBoundingClientRect();

            let x = e.clientX - rect.left + 15;
            let y = e.clientY - rect.top + 15;

            // Boundary checks
            if (x + 240 > rect.width) x = e.clientX - rect.left - 250;
            if (y + 160 > rect.height) y = e.clientY - rect.top - 170;

            tooltip.style.left = `${Math.max(10, x)}px`;
            tooltip.style.top = `${Math.max(10, y)}px`;
        }
    };

    window.TurfMap = TurfMap;

    document.addEventListener('DOMContentLoaded', () => {
        TurfMap.init();
    });
})();
