/**
 * Watch Dogs Network Hacking Minigame Controller
 * Full recreation with SVG directional energy propagation, custom targeting cursor,
 * 3D parallax depth, and authentic Watch Dogs audiovisual feedback.
 */

(function () {
    let graph = null;
    let timerInterval = null;
    let timeRemaining = 0;
    let totalTime = 0;
    let isWon = false;
    let isTransitioning = false;

    // DOM Elements
    const rootEl = document.getElementById('hack-root');
    const svgEl = document.getElementById('network-svg');
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

    // ── SVG CREATION HELPER ──────────────────────────────────────────
    function createSvgEl(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
        return el;
    }

    function createArm(x2, y2) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'node-arm');
        return line;
    }

    // ── NETWORK RENDERING ────────────────────────────────────────────
    function drawNetwork() {
        edgesBaseLayer.innerHTML = '';
        edgesPowerLayer.innerHTML = '';
        nodesLayer.innerHTML = '';
        effectsLayer.innerHTML = '';

        if (!graph) return;

        const vb = graph.viewBox || { width: 1000, height: 600 };
        svgEl.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height}`);

        // 1. Draw Edges
        graph.links.forEach(edge => {
            const n1 = graph.nodes.get(edge.from);
            const n2 = graph.nodes.get(edge.to);
            if (!n1 || !n2) return;

            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            edge.length = length;

            // Inactive base edge
            const pathBase = createSvgEl('line', {
                x1: n1.x, y1: n1.y,
                x2: n2.x, y2: n2.y,
                class: 'edge-base',
                id: `${edge.id}_base`
            });
            edgesBaseLayer.appendChild(pathBase);

            // Active luminous edge with traveling dashoffset
            const pathPower = createSvgEl('line', {
                x1: n1.x, y1: n1.y,
                x2: n2.x, y2: n2.y,
                class: 'edge-power',
                id: `${edge.id}_power`
            });
            pathPower.style.strokeDasharray = length;
            pathPower.style.strokeDashoffset = length; // Hidden by default
            edgesPowerLayer.appendChild(pathPower);

            edge.pathPower = pathPower;
        });

        // 2. Draw Nodes
        graph.nodes.forEach(node => {
            const group = createSvgEl('g', {
                class: `node-group ${node.locked ? 'locked' : ''}`,
                id: `node_${node.id}`,
                transform: `translate(${node.x}, ${node.y})`
            });

            // Rotatable inner group
            const rotGroup = createSvgEl('g', {
                class: 'rotatable',
                id: `rot_${node.id}`
            });
            rotGroup.style.transform = `rotate(${node.rotation}deg)`;

            renderNodeInternals(node, rotGroup);

            // Click target with generous hit area
            const clickTarget = createSvgEl('circle', {
                r: '38',
                class: 'click-target'
            });

            if (!node.locked && !node.isSource && !node.isTarget) {
                clickTarget.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleRotate(node.id, 1);
                });

                clickTarget.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleRotate(node.id, -1);
                });

                clickTarget.addEventListener('mouseenter', () => {
                    if (!isWon) {
                        cursor.classList.add('hover');
                        window.HackingAudio.play('hover');
                    }
                });

                clickTarget.addEventListener('mouseleave', () => {
                    cursor.classList.remove('hover');
                });
            }

            group.appendChild(rotGroup);
            group.appendChild(clickTarget);
            nodesLayer.appendChild(group);

            node.domElement = group;
            node.rotElement = rotGroup;
        });
    }

    function renderNodeInternals(node, group) {
        if (node.isSource) {
            // Spinning dashed ring + pulsing glowing core
            const outer = createSvgEl('circle', {
                r: '24',
                class: 'source-ring'
            });
            const core = createSvgEl('circle', {
                r: '12',
                class: 'source-core'
            });
            group.appendChild(outer);
            group.appendChild(core);
        } else if (node.isTarget) {
            // Diamond target destination
            const diamond = createSvgEl('polygon', {
                points: '0,-28 28,0 0,28 -28,0',
                class: 'target-shape'
            });
            const core = createSvgEl('rect', {
                x: '-7', y: '-7', width: '14', height: '14',
                class: 'target-core'
            });
            group.appendChild(diamond);
            group.appendChild(core);
        } else {
            // Circular junction node
            const bg = createSvgEl('circle', {
                r: '20',
                class: 'node-ring'
            });
            const core = createSvgEl('circle', {
                r: '5',
                class: 'node-core'
            });
            group.appendChild(bg);

            // Render directional port arms
            node.basePorts.forEach(port => {
                if (port === DIR.TOP) group.appendChild(createArm(0, -20));
                else if (port === DIR.RIGHT) group.appendChild(createArm(20, 0));
                else if (port === DIR.BOTTOM) group.appendChild(createArm(0, 20));
                else if (port === DIR.LEFT) group.appendChild(createArm(-20, 0));
            });

            group.appendChild(core);

            // Locked padlock badge
            if (node.locked) {
                const lockBody = createSvgEl('rect', {
                    x: '-5', y: '-2', width: '10', height: '8', rx: '1',
                    class: 'node-lock-icon'
                });
                const lockShackle = createSvgEl('path', {
                    d: 'M -3 -2 L -3 -6 A 3 3 0 0 1 3 -6 L 3 -2',
                    class: 'node-lock-icon'
                });
                group.appendChild(lockBody);
                group.appendChild(lockShackle);
            }
        }
    }

    // ── POWER PROPAGATION ANIMATION ──────────────────────────────────
    function animateEdge(edge, state, instant = false) {
        const path = edge.pathPower;
        if (!path) return;
        const length = edge.length || 100;
        const isForward = edge.flowSource === edge.from;

        path.style.transition = 'none';

        if (state === 'on') {
            // Start from the edge where current is coming from
            path.style.strokeDashoffset = isForward ? length : -length;
            if (!instant) path.getBoundingClientRect(); // Force reflow
            path.style.transition = instant ? 'none' : 'stroke-dashoffset 0.2s linear';
            path.style.strokeDashoffset = 0;
        } else {
            // Retract back towards origin
            path.style.transition = instant ? 'none' : 'stroke-dashoffset 0.15s linear';
            path.style.strokeDashoffset = isForward ? length : -length;
        }
    }

    function handleRotate(nodeId, dir) {
        if (isWon || isTransitioning || !graph) return;

        const rotated = graph.rotateNode(nodeId, dir);
        if (!rotated) return;

        const node = graph.nodes.get(nodeId);

        // Click squeeze feedback
        if (node.domElement) {
            node.domElement.classList.add('clicked');
            setTimeout(() => node.domElement.classList.remove('clicked'), 150);
        }

        if (node.rotElement) {
            node.rotElement.style.transform = `rotate(${node.rotation}deg)`;
        }

        window.HackingAudio.play('rotate');
        updatePower(false);
    }

    function updatePower(instant = false) {
        if (!graph) return;

        const flow = graph.propagate();

        // 1. Update Nodes Visual State
        graph.nodes.forEach(node => {
            if (node.domElement) {
                if (flow.energizedNodes.has(node.id)) {
                    node.domElement.classList.add('powered');
                } else {
                    node.domElement.classList.remove('powered');
                }

                if (!node.locked) {
                    node.domElement.classList.remove('locked');
                }
            }
        });

        // 2. Animate Edges Power Flow
        graph.links.forEach(edge => {
            const isEnergized = flow.energizedLinks.has(edge.id);
            if (isEnergized && !edge.isPowered) {
                edge.isPowered = true;
                // Determine flowSource based on which connected node is upstream
                edge.flowSource = flow.energizedNodes.has(edge.from) ? edge.from : edge.to;
                animateEdge(edge, 'on', instant);
            } else if (!isEnergized && edge.isPowered) {
                edge.isPowered = false;
                animateEdge(edge, 'off', instant);
            }
        });

        // Audio hooks
        if (flow.newlyEnergizedLinks.length > 0 && !instant) {
            window.HackingAudio.play('propagate');
        }

        if (flow.newlyUnlockedNodes.length > 0) {
            window.HackingAudio.play('unlock');
            flow.newlyUnlockedNodes.forEach(uId => {
                const uNode = graph.nodes.get(uId);
                if (uNode && uNode.domElement) {
                    uNode.domElement.classList.add('unlocking');
                    setTimeout(() => { uNode.domElement.classList.remove('locked', 'unlocking'); }, 300);
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
            // Target Node expansion
            graph.targetIds.forEach(tId => {
                const tNode = graph.nodes.get(tId);
                if (tNode && tNode.domElement) {
                    tNode.domElement.classList.add('target-win');
                }
            });

            // Glitching Override Message
            successMsg.classList.add('visible');

            // Brief 100ms invert flash for authentic hacking impact
            document.body.style.filter = 'invert(1) hue-rotate(180deg)';
            setTimeout(() => {
                document.body.style.filter = 'none';
            }, 100);
        }, 180);

        // Notify FiveM after celebration delay
        setTimeout(() => {
            postNui('nui:complete', {
                puzzleId: graph.id,
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
        hudStatus.style.color = '#f87171';

        setTimeout(() => {
            postNui('nui:fail', { reason: 'timeout' });
        }, 600);
    }

    // ── MOUSEMOVE PARALLAX & CUSTOM CURSOR ───────────────────────────
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;

        cursor.style.transform = `translate(${x}px, ${y}px)`;

        // 3D Parallax Depth on puzzle container
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
            edgesBaseLayer.innerHTML = '';
            edgesPowerLayer.innerHTML = '';
            nodesLayer.innerHTML = '';
            effectsLayer.innerHTML = '';
            graph = null;
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
