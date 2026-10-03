/* ═══════════════════════════════════════════════════════════════
   RACKET LOCKPICK CONTROLLER (Skyrim-style pin rotation)
   ═══════════════════════════════════════════════════════════════ */

const LockpickGame = (() => {
    let isPlaying = false;
    let isTransitioning = false;
    let animationFrameId = null;

    let health = 100;
    let currentStage = 1;
    const TOTAL_PINS = 3;

    let pickAngle = 0;       // -90 to +90
    let cylinderAngle = 0;   // 0 to 90
    let sweetSpot = 0;
    let tolerance = 15;
    let difficulty = 'medium';

    let keys = { a: false, d: false, space: false };
    let sessionCb = null;

    function post(name, data = {}) {
        fetch(`https://sunset_ui/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).catch(() => {});
    }

    function initGame(diff = 'medium') {
        difficulty = diff;
        health = 100;
        currentStage = 1;
        pickAngle = 0;
        cylinderAngle = 0;
        keys = { a: false, d: false, space: false };
        isTransitioning = false;

        updateHealthUI();

        for (let i = 1; i <= TOTAL_PINS; i++) {
            const pinEl = document.getElementById(`lp-pin-${i}`);
            if (pinEl) pinEl.classList.remove('unlocked');
        }

        const overlay = document.getElementById('lp-overlay');
        if (overlay) overlay.style.display = 'none';

        generateStage();
    }

    function generateStage() {
        let baseTol = 16;
        if (difficulty === 'easy') baseTol = 20;
        else if (difficulty === 'hard') baseTol = 12;

        tolerance = Math.max(6, baseTol - (currentStage * 2.5));
        sweetSpot = (Math.random() * 150) - 75;

        pickAngle = 0;
        cylinderAngle = 0;

        const cursorGrp = document.getElementById('lp-cursor');
        const cylinderGrp = document.getElementById('lp-cylinder');
        if (cursorGrp) cursorGrp.setAttribute('transform', `rotate(0 100 100)`);
        if (cylinderGrp) cylinderGrp.setAttribute('transform', `rotate(0 100 100)`);
    }

    function gameLoop() {
        if (!isPlaying) return;

        const cursorGrp = document.getElementById('lp-cursor');
        const cylinderGrp = document.getElementById('lp-cylinder');

        if (!isTransitioning) {
            if (!keys.space) {
                // Spring back cylinder
                if (cylinderAngle > 0) {
                    cylinderAngle = Math.max(0, cylinderAngle - 8);
                }

                if (keys.a) pickAngle -= 2.2;
                if (keys.d) pickAngle += 2.2;

                pickAngle = Math.max(-88, Math.min(88, pickAngle));
                if (cursorGrp) cursorGrp.setAttribute('transform', `rotate(${pickAngle} 100 100)`);
            } else {
                // Apply force with Space
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
                        // Pick is blocked & shaking
                        const shake = (Math.random() - 0.5) * 6;
                        if (cursorGrp) cursorGrp.setAttribute('transform', `rotate(${pickAngle + shake} 100 100)`);

                        const drainRate = difficulty === 'hard' ? 0.45 : (difficulty === 'easy' ? 0.22 : 0.32);
                        health -= drainRate;
                        updateHealthUI();

                        if (health <= 0) {
                            health = 0;
                            updateHealthUI();
                            endGame(false);
                        }
                    } else {
                        // Reached 90 degrees!
                        handlePinSuccess();
                    }
                }
            }

            if (cylinderGrp) cylinderGrp.setAttribute('transform', `rotate(${cylinderAngle} 100 100)`);
        }

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function handlePinSuccess() {
        isTransitioning = true;
        keys.space = false;

        cylinderAngle = 0;
        const cylinderGrp = document.getElementById('lp-cylinder');
        if (cylinderGrp) cylinderGrp.setAttribute('transform', `rotate(0 100 100)`);

        const panelEl = document.getElementById('lp-ui-panel');
        if (panelEl) {
            panelEl.classList.remove('flash-green', 'flash-red');
            void panelEl.offsetWidth;
            panelEl.classList.add('flash-green');
        }

        const pinEl = document.getElementById(`lp-pin-${currentStage}`);
        if (pinEl) pinEl.classList.add('unlocked');

        currentStage++;

        if (currentStage > TOTAL_PINS) {
            endGame(true);
        } else {
            setTimeout(() => {
                if (health > 0 && isPlaying) {
                    generateStage();
                    isTransitioning = false;
                }
            }, 300);
        }
    }

    function updateHealthUI() {
        const hpFill = document.getElementById('lp-hp-fill');
        const hpText = document.getElementById('lp-hp-text');
        if (!hpFill || !hpText) return;

        const safeHp = Math.max(0, Math.floor(health));
        hpFill.style.width = `${safeHp}%`;
        hpText.innerText = `${safeHp}%`;

        if (safeHp <= 30) {
            hpFill.style.backgroundColor = '#ef4444';
        } else if (safeHp <= 60) {
            hpFill.style.backgroundColor = '#D7B558';
        } else {
            hpFill.style.backgroundColor = '#F2EFE8';
        }
    }

    function endGame(isSuccess) {
        isPlaying = false;
        isTransitioning = false;
        keys = { a: false, d: false, space: false };
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        const overlay = document.getElementById('lp-overlay');
        const oTitle = document.getElementById('lp-o-title');
        const oSub = document.getElementById('lp-o-sub');
        const panelEl = document.getElementById('lp-ui-panel');

        if (panelEl) {
            panelEl.classList.remove('flash-green', 'flash-red');
            panelEl.classList.add(isSuccess ? 'flash-green' : 'flash-red');
        }

        if (overlay) {
            overlay.style.display = 'flex';
            if (isSuccess) {
                if (oTitle) { oTitle.innerText = "SUCCES"; oTitle.style.color = "#10b981"; }
                if (oSub) oSub.innerText = "Contactul a fost deblocat.";
                post('lockpickResult', { success: true });
                post('lockpickSuccess', {});
            } else {
                if (oTitle) { oTitle.innerText = "ESEC"; oTitle.style.color = "#ef4444"; }
                if (oSub) oSub.innerText = "Speraclul s-a rupt.";
                post('lockpickResult', { success: false });
                post('lockpickFail', {});
            }
        }

        if (sessionCb) {
            const cb = sessionCb;
            sessionCb = null;
            cb(isSuccess);
        }

        setTimeout(() => {
            close();
        }, 1600);
    }

    function open(data = {}, cb = null) {
        sessionCb = cb;
        const wrap = document.getElementById('lockpick-wrapper');
        const titleEl = document.getElementById('lp-title');
        const subtitleEl = document.getElementById('lp-subtitle');

        if (titleEl && data.title) titleEl.innerText = data.title;
        if (subtitleEl && data.subtitle) subtitleEl.innerText = data.subtitle;

        initGame(data.difficulty || 'medium');
        if (wrap) wrap.classList.add('visible');

        isPlaying = true;
        gameLoop();
    }

    function close() {
        isPlaying = false;
        isTransitioning = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        const wrap = document.getElementById('lockpick-wrapper');
        const panelEl = document.getElementById('lp-ui-panel');
        if (wrap) wrap.classList.remove('visible');
        if (panelEl) panelEl.classList.remove('flash-green', 'flash-red');

        post('closeLockpick', {});
    }

    // Keyboard listeners
    document.addEventListener('keydown', (e) => {
        const wrap = document.getElementById('lockpick-wrapper');
        if (!isPlaying || isTransitioning || !wrap || !wrap.classList.contains('visible')) return;

        const key = e.key.toLowerCase();
        if (key === 'a') keys.a = true;
        if (key === 'd') keys.d = true;
        if (e.code === 'Space') {
            e.preventDefault();
            keys.space = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'a') keys.a = false;
        if (key === 'd') keys.d = false;
        if (e.code === 'Space') keys.space = false;
        if (e.key === 'Escape' && isPlaying) {
            endGame(false);
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const closeBtn = document.getElementById('lp-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => close());
    });

    return {
        open,
        close,
    };
})();

window.LockpickGame = LockpickGame;
