/**
 * Watch Dogs Style Synthesized Audio Engine (Web Audio API)
 * Provides ultra-crisp, mechanical, zero-latency electronic sound effects
 * with automatic fallback to FiveM native PlaySoundFrontend bridge.
 */
class HackingAudioEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.muted = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                this.initialized = true;
            }
        } catch (e) {
            console.warn('[HackingAudio] WebAudio context init failed:', e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(soundName) {
        if (this.muted) return;
        this.init();
        this.resume();

        // Also trigger FiveM native sound bridge as backup
        try {
            fetch(`https://${GetParentResourceName()}/nui:sound`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: soundName })
            }).catch(() => {});
        } catch (e) {}

        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        switch (soundName) {
            case 'enter':
                this.playEnter(now);
                break;
            case 'hover':
                this.playHover(now);
                break;
            case 'rotate':
                this.playRotate(now);
                break;
            case 'propagate':
                this.playPropagate(now);
                break;
            case 'unlock':
                this.playUnlock(now);
                break;
            case 'target':
                this.playTarget(now);
                break;
            case 'success':
                this.playSuccess(now);
                break;
            case 'cancel':
                this.playCancel(now);
                break;
            case 'fail':
            case 'timeout':
                this.playFail(now);
                break;
        }
    }

    playEnter(t) {
        // Low surveillance sub-bass drone + high digital sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.exponentialRampToValueAtTime(120, t + 0.35);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.35);
    }

    playHover(t) {
        // Ultra-short 12ms tick
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, t);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.015);
    }

    playRotate(t) {
        // Mechanical relay ratchet click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(240, t + 0.045);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.045);
    }

    playPropagate(t) {
        // Resonant zap / current surge
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    playUnlock(t) {
        // Dual-tone security disarm chime (880Hz -> 1320Hz)
        [880, 1320].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.07);

            gain.gain.setValueAtTime(0.15, t + i * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.16);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.07);
            osc.stop(t + i * 0.07 + 0.16);
        });
    }

    playTarget(t) {
        // Sparkling ascending chord
        [587.33, 739.99, 880.00, 1174.66].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.04);

            gain.gain.setValueAtTime(0.12, t + i * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.04);
            osc.stop(t + i * 0.04 + 0.25);
        });
    }

    playSuccess(t) {
        // Signature Watch Dogs harmonic victory chord + resonant sub pulse
        const chords = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
        chords.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.035);

            gain.gain.setValueAtTime(0.15, t + idx * 0.035);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.035 + 0.75);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + idx * 0.035);
            osc.stop(t + idx * 0.035 + 0.75);
        });

        // Sub bass weight
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(90, t);
        sub.frequency.exponentialRampToValueAtTime(45, t + 0.6);
        subGain.gain.setValueAtTime(0.25, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        sub.connect(subGain);
        subGain.connect(this.ctx.destination);
        sub.start(t);
        sub.stop(t + 0.6);
    }

    playCancel(t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(360, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
    }

    playFail(t) {
        [220, 196, 174].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t + i * 0.09);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, t + i * 0.09);

            gain.gain.setValueAtTime(0.15, t + i * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.09);
            osc.stop(t + i * 0.09 + 0.2);
        });
    }
}

window.HackingAudio = new HackingAudioEngine();
