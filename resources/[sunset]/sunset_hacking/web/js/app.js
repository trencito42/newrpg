/**
 * Watch Dogs Network Hacking Minigame Controller
 * Full recreation with SVG directional energy propagation, custom targeting cursor,
 * 3D parallax depth, transform-isolated rotations, high-contrast cable layering,
 * and unified node geometry.
 */

(function () {
    let graph = null;
    let timerInterval = null;
    let timeRemaining = 0;
    let totalTime = 0;
    let isWon = false;
    let isTransitioning = false;
    let activeSessionId = null;

    // DOM Elements
    const rootEl = document.getElementById('hack-root');
    const svgEl = document.getElementById('network-svg');
    const edgesShadowLayer = document.getElementById('edges-shadow-layer');
    const edgesBaseLayer = document.getElementById('edges-base-layer');
    const edgesPowerLayer = document.getElementById('edges-power-layer');
    const nodesLayer = document.getElementById('nodes-layer');
    const effectsLayer = document.getElementById('effects-layer');
    const puzzleContainer = document.getElementById('puzzle-container');
    const cursor = document.getElementById('cursor');
    const successMsg = document.getElementById('success-message');

    const hudTitle = document.getElementById('hud-title');
    const hudTime = document.getElementById('hud-time');
    const hudTimeBar = document.getElementById('hud-time-bar');
    const hudStatus = document.getElementById('hud-status');
    const hintCancel = document.getElementById('hint-cancel');

    const GEOM = window.NODE_GEOMETRY || {
        radius: 24,
        armLength: 24,
        portDistance: 24,
        hitRadius: 34,
        targetSize: 26,
        centerDotRadius: 3.5
    };

    // NUI Bridge Helper
    function postNui(event, data = {}) {
        try {
            return fetch(`https://${GetParentResourceName()}/${event}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(() => {});
        } catch (e) {
            return Promise.resolve();
        }
    }

    function createSvgEl(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
        return el;
    }

    function createArm(x2, y2) {
        const line = createSvgEl('line', {
            x1: 0, y1: 0,
            x2: x2, y2: y2,
            class: 'node-arm'
        });
        return line;
    }

    // ── NETWORK RENDERING ────────────────────────────────────────────
    function drawNetwork() {
        if (edgesShadowLayer) edgesShadowLayer.innerHTML = '';
        edgesBaseLayer.innerHTML = '';
        edgesPowerLayer.innerHTML = '';
        nodesLayer.innerHTML = '';
        effectsLayer.innerHTML = '';

        if (!graph) return;

        const vb = graph.viewBox || { width: 1000, height: 650 };
        svgEl.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height}`);

        // 1. Draw 3-Layer Orthogonal Edges (Shadow -> Inactive Base -> Luminous Power)
        graph.links.forEach(edge => {
            const pathD = edge.pathD || '';
            if (!pathD) return;

            // Layer 1: Dark Under-Stroke / Shadow for maximum contrast on transparent scenes
            if (edgesShadowLayer) {
                const pathShadow = createSvgEl('path', {
                    d: pathD,
                    class: 'edge-shadow',
                    id: `${edge.id}_shadow`
                });
                edgesShadowLayer.appendChild(pathShadow);
            }

            // Layer 2: Inactive neutral physical cable (ALWAYS visible)
            const pathBase = createSvgEl('path', {
                d: pathD,
                class: 'edge-base',
                id: `${edge.id}_base`
            });
            edgesBaseLayer.appendChild(pathBase);

            // Layer 3: Active luminous power flow edge
            const pathPower = createSvgEl('path', {
                d: pathD,
                class: 'edge-power',
                id: `${edge.id}_power`
            });
            edgesPowerLayer.appendChild(pathPower);

            try {
                edge.length = pathPower.getTotalLength() || 100;
            } catch (e) {
                edge.length = 100;
            }

            pathPower.style.strokeDasharray = `${edge.length} ${edge.length}`;
            pathPower.style.strokeDashoffset = `${edge.length}`;
            edge.powerDom = pathPower;
        });

        // 2. Draw Nodes with Transform Isolation & Unified Geometry
        graph.nodes.forEach(node => {
            const group = createSvgEl('g', {
                class: `node-group ${node.type.toLowerCase()}${node.locked ? ' locked' : ''}`,
                id: `node_${node.id}`,
                transform: `translate(${node.x}, ${node.y})`
            });

            const rotator = createSvgEl('g', {
                class: 'node-rotator'
            });
            rotator.style.transform = `rotate(${node.rotation}deg)`;

            const r = GEOM.radius;

            if (node.isSource) {
                // SOURCE: Core + rotating dashed ring
                const bgCircle = createSvgEl('circle', { r: r, class: 'node-border' });
                const ring = createSvgEl('circle', { r: r + 4, class: 'source-ring' });
                const core = createSvgEl('circle', { r: 10, class: 'source-core' });
                group.appendChild(bgCircle);
                group.appendChild(ring);
                group.appendChild(core);
            } else if (node.isTarget) {
                // TARGET: Diamond shape
                const size = GEOM.targetSize;
                const diamond = createSvgEl('rect', {
                    x: -size / 2, y: -size / 2,
                    width: size, height: size,
                    transform: 'rotate(45)',
                    class: 'target-diamond'
                });
                const innerDiamond = createSvgEl('rect', {
                    x: -size / 4, y: -size / 4,
                    width: size / 2, height: size / 2,
                    transform: 'rotate(45)',
                    class: 'target-inner-diamond'
                });
                group.appendChild(diamond);
                group.appendChild(innerDiamond);
            } else {
                // INTERACTIVE NODE: Base circle + all exposed arms for node type
                const bgCircle = createSvgEl('circle', { r: r, class: 'node-border' });
                rotator.appendChild(bgCircle);

                const armLen = GEOM.armLength;
                node.basePorts.forEach(port => {
                    if (port === DIR.TOP) rotator.appendChild(createArm(0, -armLen));
                    if (port === DIR.RIGHT) rotator.appendChild(createArm(armLen, 0));
                    if (port === DIR.BOTTOM) rotator.appendChild(createArm(0, armLen));
                    if (port === DIR.LEFT) rotator.appendChild(createArm(-armLen, 0));
                });

                // Center node dot
                const centerDot = createSvgEl('circle', { r: GEOM.centerDotRadius, class: 'node-center-dot' });
                rotator.appendChild(centerDot);

                group.appendChild(rotator);

                // Lock graphic overlay if locked
                if (node.locked) {
                    const lockIcon = createSvgEl('path', {
                        d: 'M -4 2 L -4 -2 A 4 4 0 0 1 4 -2 L 4 2 M -6 2 L 6 2 L 6 8 L -6 8 Z',
                        class: 'node-lock-icon'
                    });
                    group.appendChild(lockIcon);
                }
            }

            // Click target (uses GEOM.hitRadius)
            const clickTarget = createSvgEl('circle', {
                r: GEOM.hitRadius,
                class: 'click-target'
            });
            group.appendChild(clickTarget);

            // Mouse interactions
            clickTarget.addEventListener('mouseenter', () => {
                if (!node.locked && node.rotatable) {
                    cursor.classList.add('hover');
                    window.HackingAudio.play('hover');
                }
            });

            clickTarget.addEventListener('mouseleave', () => {
                cursor.classList.remove('hover');
            });

            clickTarget.addEventListener('click', (e) => {
                e.preventDefault();
                handleNodeClick(node.id, 1);
            });

            clickTarget.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleNodeClick(node.id, -1);
            });

            node.domElement = group;
            node.rotatorEl = rotator;
            nodesLayer.appendChild(group);
        });
    }

    // ── ROTATION INTERACTION ─────────────────────────────────────────
    function handleNodeClick(nodeId, dir = 1) {
        if (isWon || isTransitioning) return;

        const rotated = graph.rotateNode(nodeId, dir);
        if (!rotated) return;

        const node = graph.nodes.get(nodeId);
        if (node && node.rotatorEl) {
            node.rotatorEl.style.transform = `rotate(${node.rotation}deg)`;
        }

        window.HackingAudio.play('rotate');
        updatePower(false);
    }

    // ── DIRECTIONAL POWER FLOW ANIMATION ─────────────────────────────
    function animateEdge(edge, state, instant = false) {
        const dom = edge.powerDom;
        if (!dom) return;

        if (state === 'on') {
            dom.classList.add('active');
            if (instant) {
                dom.style.transition = 'none';
                dom.style.strokeDashoffset = '0';
            } else {
                dom.style.transition = 'none';
                dom.style.strokeDashoffset = edge.flowForward ? `${edge.length}` : `${-edge.length}`;
                dom.getBoundingClientRect(); // force reflow

                const duration = Math.max(90, Math.min(220, edge.length * 0.9));
                const delay = (edge.depth || 0) * 35;
                dom.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`;
                dom.style.strokeDashoffset = '0';
            }
        } else {
            if (instant) {
                dom.classList.remove('active');
                dom.style.transition = 'none';
                dom.style.strokeDashoffset = `${edge.length}`;
            } else {
                dom.style.transition = 'opacity 120ms ease-out';
                dom.classList.remove('active');
                setTimeout(() => {
                    dom.style.strokeDashoffset = `${edge.length}`;
                }, 130);
            }
        }
    }

    function updatePower(instant = false) {
        if (!graph) return;

        const flow = graph.propagate();

        // 1. Update Node Visuals
        graph.nodes.forEach(node => {
            if (!node.domElement) return;
            if (node.energized) {
                node.domElement.classList.add('energized');
            } else {
                node.domElement.classList.remove('energized');
            }
        });

        // 2. Update Edge Visuals
        graph.links.forEach(edge => {
            const isEnergized = flow.energizedLinks.has(edge.id);
            if (isEnergized && !edge.isPowered) {
                edge.isPowered = true;
                animateEdge(edge, 'on', instant);
            } else if (!isEnergized && edge.isPowered) {
                edge.isPowered = false;
                animateEdge(edge, 'off', instant);
            }
        });

        // Audio triggers
        if (flow.newlyEnergizedLinks.length > 0 && !instant) {
            window.HackingAudio.play('propagate');
        }

        if (flow.newlyUnlockedNodes.length > 0) {
            window.HackingAudio.play('unlock');
            flow.newlyUnlockedNodes.forEach(uId => {
                const uNode = graph.nodes.get(uId);
                if (uNode && uNode.domElement) {
                    uNode.domElement.classList.add('unlocking');
                    setTimeout(() => { uNode.domElement.classList.remove('locked', 'unlocking'); }, 280);
                }
            });
            hudStatus.textContent = 'GATE DECRYPTED // DATA CHANNEL UNLOCKED';
        }

        // 3. Victory Check
        if (flow.targetReached && !isWon) {
            handleWin();
        }
    }

    // ── VICTORY SEQUENCE ─────────────────────────────────────────────
    function handleWin() {
        isWon = true;
        cursor.classList.remove('hover');
        clearInterval(timerInterval);

        window.HackingAudio.play('target');
        setTimeout(() => { window.HackingAudio.play('success'); }, 180);

        hudStatus.textContent = 'CIRCUIT COMPLETE // ACCESS GRANTED';
        hudStatus.style.color = '#00e5ff';

        setTimeout(() => {
            graph.targetIds.forEach(tId => {
                const tNode = graph.nodes.get(tId);
                if (tNode && tNode.domElement) {
                    tNode.domElement.classList.add('target-win');
                }
            });

            successMsg.classList.add('visible');

            document.body.style.filter = 'invert(1) hue-rotate(180deg)';
            setTimeout(() => {
                document.body.style.filter = 'none';
            }, 100);
        }, 180);

        const nodeRotations = {};
        graph.nodes.forEach((node, id) => {
            nodeRotations[id] = node.rotation;
        });

        setTimeout(() => {
            postNui('nui:complete', {
                sessionId: activeSessionId,
                puzzleId: graph.id,
                rotations: nodeRotations,
                timeRemaining: timeRemaining
            });
        }, 850);
    }

    // ── COUNTDOWN TIMER ──────────────────────────────────────────────
    function startTimer(seconds) {
        clearInterval(timerInterval);
        totalTime = seconds || 35;
        timeRemaining = totalTime;

        hudTime.textContent = `${timeRemaining.toFixed(1)}s`;
        hudTimeBar.style.width = '100%';
        hudTimeBar.className = 'meter-bar';

        timerInterval = setInterval(() => {
            timeRemaining -= 0.1;
            if (timeRemaining <= 0) {
                timeRemaining = 0;
                clearInterval(timerInterval);
                handleTimeout();
            }

            hudTime.textContent = `${timeRemaining.toFixed(1)}s`;
            const pct = Math.max(0, (timeRemaining / totalTime) * 100);
            hudTimeBar.style.width = `${pct}%`;

            if (pct < 25) {
                hudTimeBar.className = 'meter-bar danger';
            } else if (pct < 50) {
                hudTimeBar.className = 'meter-bar warning';
            }
        }, 100);
    }

    function handleTimeout() {
        if (isWon) return;
        isWon = true;
        window.HackingAudio.play('timeout');
        hudStatus.textContent = 'SECURITY OVERRIDE FAILED // TRACE EXCEEDED';
        hudStatus.style.color = '#ef4444';

        setTimeout(() => {
            postNui('nui:fail', { reason: 'timeout' });
        }, 600);
    }

    // ── MOUSEMOVE PARALLAX & CUSTOM CURSOR ───────────────────────────
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;

        cursor.style.transform = `translate(${x}px, ${y}px)`;

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const px = (x - cx) / cx;
        const py = (y - cy) / cy;

        puzzleContainer.style.transform = `translate(calc(-50% + ${-px * 8}px), calc(-50% + ${-py * 8}px))`;
    });

    document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { cursor.style.opacity = '1'; });

    // ── OPEN & CLOSE LIFECYCLE ───────────────────────────────────────
    function openPuzzle(data) {
        isWon = false;
        isTransitioning = false;
        activeSessionId = data.sessionId || null;
        successMsg.classList.remove('visible');

        graph = new PuzzleGraph(data.puzzle);

        hudTitle.textContent = data.title || graph.title;
        hudStatus.textContent = 'NETWORK TOPOLOGY MAPPED // ROUTE SOURCE TO TARGET';
        hudStatus.style.color = '#e2e8f0';

        if (hintCancel) {
            hintCancel.style.display = data.allowCancel !== false ? 'flex' : 'none';
        }

        drawNetwork();
        setTimeout(() => updatePower(true), 50);

        rootEl.classList.remove('hidden');
        rootEl.classList.add('visible');

        window.HackingAudio.play('enter');
        startTimer(data.timeLimit || graph.timeLimit);
    }

    function closePuzzle() {
        clearInterval(timerInterval);
        rootEl.classList.remove('visible');
        setTimeout(() => {
            rootEl.classList.add('hidden');
            if (edgesShadowLayer) edgesShadowLayer.innerHTML = '';
            edgesBaseLayer.innerHTML = '';
            edgesPowerLayer.innerHTML = '';
            nodesLayer.innerHTML = '';
            effectsLayer.innerHTML = '';
            graph = null;
            activeSessionId = null;
        }, 250);
    }

    // ── NUI MESSAGE LISTENER ─────────────────────────────────────────
    window.addEventListener('message', (event) => {
        const item = event.data;
        if (!item || !item.action) return;

        switch (item.action) {
            case 'open':
                openPuzzle(item.data || {});
                break;
            case 'close':
                closePuzzle();
                break;
        }
    });

    postNui('nui:ready');
})();
