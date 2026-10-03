/* ═══ RACKET AUTH UI — Client Presentation Controller ═══
   Handles auth presentation and posts events to Lua.
   Quick Login / saved accounts removed by design. */

const $ = (sel) => document.querySelector(sel);
const authMouseProbe = { moves: 0, downs: 0, clicks: 0, lastTarget: 'none' };
document.addEventListener('pointermove', (event) => {
    authMouseProbe.moves += 1;
    authMouseProbe.lastTarget = event.target?.id || event.target?.tagName || 'unknown';
}, { passive: true });
document.addEventListener('pointerdown', (event) => {
    authMouseProbe.downs += 1;
    authMouseProbe.lastTarget = event.target?.id || event.target?.tagName || 'unknown';
}, { passive: true });
document.addEventListener('click', () => { authMouseProbe.clicks += 1; }, { passive: true });
function tr(key, params, fallback) {
    try {
        if (window.I18n?.t) {
            const res = window.I18n.t(key, params);
            if (res && res !== key) return res;
        }
    } catch (_) {}
    return (typeof fallback === 'string' ? fallback : null) || key;
}

function post(action, data = {}) {
    try {
        fetch(`https://${GetParentResourceName()}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        }).catch(() => {});
    } catch (_) { /* noop */ }
}

// [NUI PERF] 500ms timer-drift stall check instead of 60Hz rAF loop
(function authFrameWatchdog() {
    let last = performance.now();
    setInterval(() => {
        const now = performance.now();
        const gap = now - last - 500;
        last = now;
        if (gap > 200) {
            const screenVis = $('#auth-screen')?.classList.contains('is-visible') ? 'auth' : 'hidden';
            console.warn(`[HITCH] AUTH NUI STALL ${Math.round(gap)}ms screen=${screenVis} visibility=${document.visibilityState} mode=${AuthUI.mode || 'none'}`);
        }
    }, 500);
})();

const AuthUI = {
    mode: 'login', // 'login' | 'register'
    pendingSubmit: false,
    visibleGeneration: 0,

    init() {
        // Form switches
        $('#auth-go-register')?.addEventListener('click', () => this.switchMode('register'));
        $('#auth-go-login')?.addEventListener('click', () => this.switchMode('login'));
        $('#auth-go-forgot')?.addEventListener('click', () => this.switchMode('forgot'));
        $('#auth-forgot-back')?.addEventListener('click', () => this.switchMode('login'));

        // Login
        $('#auth-login-btn')?.addEventListener('click', () => this.submitLogin());
        $('#auth-pass')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitLogin();
        });
        $('#auth-user')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#auth-pass')?.focus();
        });

        // Forgot Password
        $('#auth-forgot-btn')?.addEventListener('click', () => this.submitForgot());
        $('#forgot-user')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitForgot();
        });

        // Register
        $('#auth-register-btn')?.addEventListener('click', () => this.submitRegister());
        $('#reg-pass2')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitRegister();
        });
        $('#reg-user')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#reg-email')?.focus();
        });
        $('#reg-email')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#reg-pass')?.focus();
        });
        $('#reg-pass')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#reg-pass2')?.focus();
        });

        // Email modal
        $('#auth-email-submit')?.addEventListener('click', () => this.submitEmail());
        $('#auth-email-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitEmail();
        });

        post('authReady', { locale: window.I18n?.getLocale() || 'en' });
        post('authDomReady', { now: Date.now() });
    },

    async waitForBackground() {
        const bg = new Image();
        bg.src = 'background.webp';
        try {
            if (typeof bg.decode === 'function') await bg.decode();
        } catch (_) { /* CSS background fallback remains usable */ }
    },

    async show(data = {}) {
        if (data.locale && window.I18n) window.I18n.setLocale(data.locale);
        const generation = ++this.visibleGeneration;
        // Show and enable pointer-events immediately so the form is clickable
        // the moment the NUI message arrives — don't block on background decode.
        const screen = $('#auth-screen');
        if (screen) {
            screen.classList.add('is-visible');
            screen.setAttribute('aria-hidden', 'false');
        }
        const panel = $('#auth-panel');
        if (panel) panel.classList.add('active');
        this.switchMode('login');
        this.showLoading(false);
        // Preload background in the background after showing the form
        this.waitForBackground().catch(() => {});
        if (generation !== this.visibleGeneration) return;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (generation !== this.visibleGeneration || !screen?.classList.contains('is-visible')) return;
            post('authVisibleRendered', { now: Date.now(), presentation: data.presentation || 'form', presentationId: data.presentationId });
        }));
        setTimeout(() => {
            const active = document.activeElement;
            if (!active || active.tagName !== 'INPUT') {
                $('#auth-user')?.focus({ preventScroll: true });
            }
        }, 100);
    },

    hide() {
        this.visibleGeneration += 1;
        const screen = $('#auth-screen');
        if (screen) {
            screen.classList.remove('is-visible');
            screen.setAttribute('aria-hidden', 'true');
        }
        const panel = $('#auth-panel');
        if (panel) panel.classList.remove('active');
        this.showLoading(false);
        this.hideError();
        this.hideEmailModal();
        this.pendingSubmit = false;
    },

    switchMode(mode) {
        this.mode = mode; // 'login' | 'register' | 'forgot'
        const isLogin = mode === 'login';
        const isRegister = mode === 'register';
        const isForgot = mode === 'forgot';

        $('#auth-form-login')?.classList.toggle('hidden', !isLogin);
        $('#auth-form-register')?.classList.toggle('hidden', !isRegister);
        $('#auth-form-forgot')?.classList.toggle('hidden', !isForgot);

        this.hideError();
        setTimeout(() => {
            if (isLogin) {
                $('#auth-user')?.focus({ preventScroll: true });
            } else if (isRegister) {
                $('#reg-user')?.focus({ preventScroll: true });
            } else if (isForgot) {
                $('#forgot-user')?.focus({ preventScroll: true });
            }
        }, 50);
    },

    submitForgot() {
        if (this.pendingSubmit) return;
        const identifier = ($('#forgot-user')?.value || '').trim();
        if (!identifier) {
            return this.showError('Te rugăm să introduci numele de utilizator sau emailul.');
        }

        this.hideError();
        this.showLoading(true, 'Se trimite emailul de resetare...');
        this.pendingSubmit = true;

        post('authForgotPassword', {
            identifier: identifier,
        });
    },

    showError(msg) {
        const el = $('#auth-error');
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
        this.showLoading(false);
        this.pendingSubmit = false;
    },

    hideError() {
        this.showError(null);
    },

    showLoading(show, label) {
        const el = $('#auth-loading');
        if (!el) return;
        el.classList.toggle('hidden', !show);
        const text = $('#auth-loading-text');
        if (text && label) text.textContent = label;
    },

    submitLogin() {
        if (this.pendingSubmit) return;
        const user = ($('#auth-user')?.value || '').trim();
        const pass = $('#auth-pass')?.value || '';
        if (!user || !pass) {
            return this.showError(tr('auth.required'));
        }

        this.hideError();
        this.showLoading(true, tr('auth.verifying'));
        this.pendingSubmit = true;

        post('authLogin', {
            username: user,
            password: pass,
            rememberQuickLogin: false,
        });
    },

    submitRegister() {
        if (this.pendingSubmit) return;
        const user = ($('#reg-user')?.value || '').trim();
        const email = ($('#reg-email')?.value || '').trim();
        const pass = $('#reg-pass')?.value || '';
        const pass2 = $('#reg-pass2')?.value || '';

        if (!user || !email || !pass || !pass2) {
            return this.showError(tr('auth.required'));
        }
        if (!email.includes('@') || !email.includes('.')) {
            return this.showError(tr('auth.email_invalid'));
        }
        if (pass !== pass2) {
            return this.showError(tr('auth.passwords_mismatch'));
        }
        if (pass.length < 6) {
            return this.showError(tr('auth.password_too_short'));
        }

        this.hideError();
        this.showLoading(true, tr('auth.creating'));
        this.pendingSubmit = true;

        post('authRegister', {
            username: user,
            email: email,
            password: pass,
            passwordConfirm: pass2,
            rememberQuickLogin: false,
        });
    },

    promptEmail(username) {
        this.showLoading(false);
        this.pendingSubmit = false;
        $('#auth-email-username').textContent = username || tr('auth.your_account');
        $('#auth-email-input').value = '';
        $('#auth-email-error')?.classList.add('hidden');
        $('#auth-email-modal')?.classList.remove('hidden');
        setTimeout(() => $('#auth-email-input')?.focus(), 100);
    },

    hideEmailModal() {
        $('#auth-email-modal')?.classList.add('hidden');
    },

    submitEmail() {
        const email = ($('#auth-email-input')?.value || '').trim();
        const errEl = $('#auth-email-error');
        if (!email || !email.includes('@') || !email.includes('.')) {
            if (errEl) {
                errEl.textContent = tr('auth.email_invalid');
                errEl.classList.remove('hidden');
            }
            return;
        }

        if (errEl) errEl.classList.add('hidden');
        this.showLoading(true, tr('auth.linking_email'));
        post('authSetEmail', { email });
    },
};

// Listen for incoming messages from sunset_auth / Lua
window.addEventListener('message', (event) => {
    const data = event.data || {};
    const action = data.action;
    const payload = data.data || {};

    switch (action) {
        case 'authMouseProbe':
            post('authMouseProbeResult', {
                ...authMouseProbe,
                visible: $('#auth-screen')?.classList.contains('is-visible') === true,
                activeElement: document.activeElement?.id || document.activeElement?.tagName || 'none',
                cursor: getComputedStyle(document.body).cursor,
                visibility: document.visibilityState,
            });
            break;
        case 'authShow':
            document.body.style.background = '';
            AuthUI.show(payload);
            break;
        case 'authHide':
            AuthUI.hide();
            // After hiding, make the NUI body transparent so the game world
            // shows through — body default is solid #08080a to prevent flicker
            // on first load, but must not block the game after auth completes.
            document.body.style.background = 'transparent';
            break;
        case 'authError':
            AuthUI.showError(payload.message || tr('auth.generic_error'));
            break;
        case 'authNeedsEmail':
            AuthUI.promptEmail(payload.username);
            break;
        case 'authEmailResult':
            if (payload.ok) {
                AuthUI.hideEmailModal();
            } else if (payload.message) {
                const errEl = $('#auth-email-error');
                if (errEl) {
                    errEl.textContent = payload.message;
                    errEl.classList.remove('hidden');
                }
                AuthUI.showLoading(false);
            }
            break;
        case 'authLoading':
            AuthUI.showLoading(payload.loading !== false, payload.text);
            break;
        case 'authAccountFill':
            AuthUI.showLoading(false);
            AuthUI.pendingSubmit = false;
            if ($('#auth-user')) $('#auth-user').value = payload.username || '';
            $('#auth-pass')?.focus({ preventScroll: true });
            break;
        case 'authSuccess':
            AuthUI.showLoading(true, payload.text || tr('auth.loading_character'));
            break;
        case 'localeSet':
            if (window.I18n && window.I18n.setLocale(payload.locale)) {
                AuthUI.switchMode(AuthUI.mode);
            }
            break;
        case 'authCapturePortrait':
            if (!payload.source || !payload.username) break;
            fetch(payload.source).then((r) => r.blob()).then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => post('authSavePortrait', {
                    username: payload.username,
                    characterName: payload.characterName,
                    characterId: payload.characterId,
                    level: payload.level,
                    cash: payload.cash,
                    bank: payload.bank,
                    avatar: reader.result,
                });
                reader.readAsDataURL(blob);
            }).catch(() => {});
            break;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (window.I18n) window.I18n.translateTree(document);
    AuthUI.init();
});
