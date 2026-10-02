'use strict';

/* ═══════════════════════════════════════════════════════════════
   LOCKPICK MINIGAME
   5 pins, each with its own green zone. Press PICK when the
   sliding needle is in the zone to set the pin.
════════════════════════════════════════════════════════════════ */
const LockpickGame = (() => {
    let isPlaying = false;
    let isTransitioning = false;
    let rAF = null;
    let onDone = null;

    let health = 100;
    let currentStage = 1;
    const TOTAL_PINS = 3;

    let pickAngle = 0;
    let cylinderAngle = 0;
    let sweetSpot = 0;
    let tolerance = 15;

    let keys = { a: false, d: false, space: false };

    const $ = sel => document.querySelector(sel);

    function updateHealthUI() {
        const fill = $('#ms-lp-hp-fill');
        const text = $('#ms-lp-hp-text');
        if (!fill || !text) return;

        const val = Math.max(0, Math.floor(health));
        fill.style.width = `${val}%`;
        text.innerText = `${val}%`;

        if (val <= 30) fill.style.backgroundColor = '#ef4444';
        else if (val <= 60) fill.style.backgroundColor = '#D7B558';
        else fill.style.backgroundColor = '#F2EFE8';
    }

    function generateStage() {
        tolerance = Math.max(7, 15 - (currentStage * 2.2));
        sweetSpot = (Math.random() * 150) - 75;

        pickAngle = 0;
        cylinderAngle = 0;

        const cursorGrp = $('#ms-lp-cursor');
        const cylinderGrp = $('#ms-lp-cylinder');
        if (cursorGrp) cursorGrp.setAttribute('transform', 'rotate(0 100 100)');
        if (cylinderGrp) cylinderGrp.setAttribute('transform', 'rotate(0 100 100)');
    }

    function gameLoop() {
        if (!isPlaying) return;

        const cursorGrp = $('#ms-lp-cursor');
        const cylinderGrp = $('#ms-lp-cylinder');

        if (!isTransitioning) {
            if (!keys.space) {
                if (cylinderAngle > 0) {
                    cylinderAngle = Math.max(0, cylinderAngle - 8);
                }
                if (keys.a) pickAngle -= 2.2;
                if (keys.d) pickAngle += 2.2;

                pickAngle = Math.max(-88, Math.min(88, pickAngle));
                if (cursorGrp) cursorGrp.setAttribute('transform', `rotate(${pickAngle} 100 100)`);
            } else {
                const distance = Math.abs(pickAngle - sweetSpot);
                let maxTurn = 90;

                if (distance > tolerance) {
                    const penalty = (distance - tolerance) / 160;
                    maxTurn = 90 * (1 - (penalty * 1.6));
                    maxTurn = Math.max(4, maxTurn);
                }

                if (cylinderAngle < maxTurn) {
                    cylinderAngle += 3.2;
                } else {
                    if (cylinderAngle < 90) {
                        const shake = (Math.random() - 0.5) * 6;
                        if (cursorGrp) cursorGrp.setAttribute('transform', `rotate(${pickAngle + shake} 100 100)`);

                        health -= 0.35;
                        updateHealthUI();

                        if (health <= 0) {
                            health = 0;
                            updateHealthUI();
                            finish(false);
                        }
                    } else {
                        handleHit();
                    }
                }
            }

            if (cylinderGrp) cylinderGrp.setAttribute('transform', `rotate(${cylinderAngle} 100 100)`);
        }

        rAF = requestAnimationFrame(gameLoop);
    }

    function handleHit() {
        isTransitioning = true;
        keys.space = false;

        cylinderAngle = 0;
        const cylinderGrp = $('#ms-lp-cylinder');
        if (cylinderGrp) cylinderGrp.setAttribute('transform', 'rotate(0 100 100)');

        const panelEl = $('#ms-lp-panel');
        if (panelEl) {
            panelEl.classList.remove('flash-green', 'flash-red');
            void panelEl.offsetWidth;
            panelEl.classList.add('flash-green');
        }

        const pinDot = $(`#ms-pin-${currentStage}`);
        if (pinDot) pinDot.classList.add('unlocked');

        currentStage++;

        if (currentStage > TOTAL_PINS) {
            finish(true);
        } else {
            setTimeout(() => {
                if (health > 0 && isPlaying) {
                    generateStage();
                    isTransitioning = false;
                }
            }, 300);
        }
    }

    function finish(success) {
        isPlaying = false;
        isTransitioning = false;
        keys = { a: false, d: false, space: false };
        if (rAF) cancelAnimationFrame(rAF);

        const overlay = $('#ms-lp-overlay');
        const oTitle = $('#ms-lp-o-title');
        const oSub = $('#ms-lp-o-sub');
        const panelEl = $('#ms-lp-panel');

        if (panelEl) {
            panelEl.classList.remove('flash-green', 'flash-red');
            panelEl.classList.add(success ? 'flash-green' : 'flash-red');
        }

        if (overlay) {
            overlay.style.display = 'flex';
            if (success) {
                if (oTitle) { oTitle.innerText = "SUCCES"; oTitle.style.color = "#10b981"; }
                if (oSub) oSub.innerText = "Contactul a fost deblocat.";
            } else {
                if (oTitle) { oTitle.innerText = "EȘEC"; oTitle.style.color = "#ef4444"; }
                if (oSub) oSub.innerText = "Șperaclul s-a rupt.";
            }
        }

        setTimeout(() => {
            if (overlay) overlay.style.display = 'none';
            if (onDone) {
                const fn = onDone;
                onDone = null;
                fn(success);
            }
        }, 1500);
    }

    // Keyboard handlers for Skyrim lockpick in missions
    window.addEventListener('keydown', (e) => {
        const root = $('#lockpick');
        if (!isPlaying || isTransitioning || !root || root.classList.contains('hidden')) return;

        const key = e.key.toLowerCase();
        if (key === 'a') keys.a = true;
        if (key === 'd') keys.d = true;
        if (e.code === 'Space') {
            e.preventDefault();
            keys.space = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'a') keys.a = false;
        if (key === 'd') keys.d = false;
        if (e.code === 'Space') keys.space = false;
    });

    function start(cb) {
        onDone = cb;
        isPlaying = true;
        isTransitioning = false;
        health = 100;
        currentStage = 1;
        keys = { a: false, d: false, space: false };

        updateHealthUI();

        for (let i = 1; i <= TOTAL_PINS; i++) {
            const p = $(`#ms-pin-${i}`);
            if (p) p.classList.remove('unlocked');
        }

        const overlay = $('#ms-lp-overlay');
        if (overlay) overlay.style.display = 'none';

        generateStage();

        if (rAF) cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(gameLoop);
    }

    return { start };
})();


/* ═══════════════════════════════════════════════════════════════
   SEAL MINIGAME
   Hold the button to apply pressure. Keep the indicator in the
   green zone. Pressure bar fills to 100% to succeed.
   Release = indicator drifts down. Out of zone = noise.
════════════════════════════════════════════════════════════════ */
const SealGame = (() => {
    let progress  = 0;
    let indicator = 10;    // 0..100
    let velocity  = 0;
    let pressing  = false;
    let noiseHits = 0;
    let rAF       = null;
    let onDone    = null;
    const ZONE_L = 35, ZONE_R = 65;
    const NOISE_LIMIT = 3;

    const $ = sel => document.querySelector(sel);

    function updateUI() {
        const ind  = $('#sl-indicator');
        const prog = $('#sl-progress');
        if (ind)  ind.style.left  = indicator + '%';
        if (prog) prog.style.width = progress  + '%';
    }

    function frame() {
        if (pressing) {
            velocity = Math.min(velocity + 0.8, 4.0);
        } else {
            velocity = Math.max(velocity - 0.5, -3.0);
        }
        indicator = Math.max(2, Math.min(98, indicator + velocity));

        const inZone = indicator >= ZONE_L && indicator <= ZONE_R;
        if (inZone && pressing) {
            progress = Math.min(100, progress + 0.6);
        } else if (!inZone && pressing) {
            noiseHits++;
            const fb = $('#sl-feedback');
            if (fb) { fb.textContent = I18n.t('dynamic.minigames.too_much_force'); fb.style.color = '#fbbf24'; }
            if (noiseHits >= NOISE_LIMIT) { finish(false); return; }
        } else {
            progress = Math.max(0, progress - 0.15);
        }

        updateUI();

        if (progress >= 100) { finish(true); return; }
        rAF = requestAnimationFrame(frame);
    }

    function finish(success) {
        pressing = false;
        cancelAnimationFrame(rAF);
        rAF = null;
        const btn = $('#btn-seal');
        if (btn) btn.classList.remove('pressing');
        if (onDone) { const fn = onDone; onDone = null; fn(success); }
    }

    function onPress() {
        pressing = true;
        const btn = $('#btn-seal');
        if (btn) btn.classList.add('pressing');
        const fb = $('#sl-feedback');
        if (fb) fb.textContent = '';
    }

    function onRelease() {
        pressing = false;
        const btn = $('#btn-seal');
        if (btn) btn.classList.remove('pressing');
    }

    function start(cb) {
        onDone    = cb;
        progress  = 0;
        indicator = 10;
        velocity  = 0;
        pressing  = false;
        noiseHits = 0;
        const fb = $('#sl-feedback');
        if (fb) fb.textContent = '';
        updateUI();
        if (rAF) cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(frame);
    }

    return { start, onPress, onRelease };
})();

window.LockpickGame = LockpickGame;
window.SealGame     = SealGame;
