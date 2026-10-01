'use strict';

/* ═══════════════════════════════════════════════════════════════
   LOCKPICK MINIGAME
   5 pins, each with its own green zone. Press PICK when the
   sliding needle is in the zone to set the pin.
════════════════════════════════════════════════════════════════ */
const LockpickGame = (() => {
    const PIN_COUNT = 5;
    let pins        = [];
    let currentPin  = 0;
    let pickPos     = 0;       // 0..100%
    let pickDir     = 1;
    let pickSpeed   = 1.2;     // % per frame
    let attempts    = 3;
    let rAF         = null;
    let onDone      = null;

    const $ = sel => document.querySelector(sel);

    function buildPins() {
        const container = $('#lp-pins');
        container.innerHTML = '';
        pins = [];
        for (let i = 0; i < PIN_COUNT; i++) {
            const zoneStart = 20 + Math.random() * 50;
            const zoneWidth = 12 + Math.random() * 14;
            const el = document.createElement('div');
            el.className = 'lp-pin';
            el.style.height = (16 + Math.random() * 20) + 'px';
            container.appendChild(el);
            pins.push({ el, zoneStart, zoneEnd: zoneStart + zoneWidth, set: false });
        }
    }

    function updateZone() {
        const p   = pins[currentPin];
        const zone = $('#lp-zone');
        if (!zone || !p) return;
        zone.style.left  = p.zoneStart + '%';
        zone.style.width = (p.zoneEnd - p.zoneStart) + '%';
    }

    function frame() {
        pickPos += pickDir * pickSpeed;
        if (pickPos >= 100) { pickPos = 100; pickDir = -1; }
        if (pickPos <= 0)   { pickPos = 0;   pickDir =  1; }
        const pick = $('#lp-pick');
        if (pick) pick.style.left = pickPos + '%';
        rAF = requestAnimationFrame(frame);
    }

    function pick() {
        const p = pins[currentPin];
        if (!p) return;
        const inZone = pickPos >= p.zoneStart && pickPos <= p.zoneEnd;
        if (inZone) {
            p.set = true;
            p.el.classList.add('set');
            const fb = $('#lp-feedback');
            if (fb) { fb.textContent = I18n.t('dynamic.minigames.pin_set'); fb.style.color = '#00ffcc'; }
            currentPin++;
            pickSpeed += 0.3;
            if (currentPin >= PIN_COUNT) {
                setTimeout(() => finish(true), 400);
                return;
            }
            updateZone();
        } else {
            attempts--;
            const fb = $('#lp-feedback');
            if (fb) { fb.textContent = I18n.t('dynamic.minigames.missed'); fb.style.color = '#f87171'; }
            const att = $('#lp-attempts');
            if (att) att.textContent = I18n.t('ui.missions.attempts_remaining', { count: attempts });
            if (attempts <= 0) {
                setTimeout(() => finish(false), 600);
            }
        }
    }

    function finish(success) {
        cancelAnimationFrame(rAF);
        rAF = null;
        if (onDone) { const fn = onDone; onDone = null; fn(success); }
    }

    function start(cb) {
        onDone     = cb;
        currentPin = 0;
        pickPos    = 0;
        pickDir    = 1;
        pickSpeed  = 1.2;
        attempts   = 3;
        buildPins();
        updateZone();
        const att = $('#lp-attempts');
        if (att) att.textContent = I18n.t('ui.missions.attempts_remaining', { count: attempts });
        const fb = $('#lp-feedback');
        if (fb) fb.textContent = '';

        const btn = $('#btn-pick');
        if (btn) btn.onclick = pick;

        if (rAF) cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(frame);
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
