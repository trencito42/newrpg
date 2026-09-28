import './auth.css';
import { post } from '../../core/bridge';

export class AuthFeature {
  private element: HTMLElement | null = null;
  private mode: 'login' | 'register' = 'login';
  private submitting = false;

  mount(parent: HTMLElement): void {
    if (this.element) return;

    const root = document.createElement('section');
    root.id = 'auth';
    root.className = 'auth-screen hidden';
    root.setAttribute('aria-label', 'Account authentication');

    root.innerHTML = `
      <div class="auth-wrapper">
        <!-- Logo Area -->
        <div class="auth-logo-area">
          <svg class="auth-flame" width="64" height="74" viewBox="0 0 72 84" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="orange-gradient-auth" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FDBA74" />
                <stop offset="50%" stop-color="#F97316" />
                <stop offset="100%" stop-color="#9A3412" />
              </linearGradient>
            </defs>
            <path d="M36,0 C36,0 20,20 20,40 C20,55 30,65 30,65 C30,65 25,55 28,45 C28,45 15,55 10,70 C5,85 20,84 36,84 C52,84 67,85 62,70 C57,55 44,45 44,45 C47,55 42,65 42,65 C42,65 52,55 52,40 C52,20 36,0 36,0 Z" fill="url(#orange-gradient-auth)" />
            <path d="M36,20 C36,20 28,35 28,50 C28,58 33,65 33,65 C33,65 30,58 32,52 C32,52 24,60 21,70 C18,80 28,79 36,79 C44,79 54,80 51,70 C48,60 40,52 40,52 C42,58 39,65 39,65 C39,65 44,58 44,50 C44,35 36,20 36,20 Z" fill="#0a0a0c" opacity="0.6"/>
          </svg>
          <h1 class="auth-brand-title">RPG</h1>
          <p class="auth-brand-subtitle">AUTHENTICATION</p>
        </div>

        <!-- Glass Container -->
        <div class="glass-panel">
          <!-- LOGIN VIEW -->
          <div id="login-view" class="auth-view active-view">
            <div class="view-header">
              <h2>Welcome Back</h2>
              <p>Enter your credentials to enter the server.</p>
            </div>

            <form id="login-form" class="auth-form" autocomplete="off">
              <!-- Username -->
              <div class="form-group">
                <label for="login-username">Username</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input type="text" id="login-username" name="username" class="input-field" placeholder="Enter your username" minlength="3" maxlength="24" autocomplete="username" required />
                </div>
              </div>

              <!-- Password -->
              <div class="form-group">
                <label for="login-password">Password</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </span>
                  <input type="password" id="login-password" name="password" class="input-field" placeholder="••••••••••" minlength="10" maxlength="128" autocomplete="current-password" required />
                </div>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="btn-primary">
                <span class="btn-text">SIGN IN</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </form>

            <!-- Footer Switch -->
            <div class="view-footer">
              <span>New player?</span>
              <button type="button" id="switch-to-register" class="link-btn">Create an Account</button>
            </div>
          </div>

          <!-- REGISTER VIEW -->
          <div id="register-view" class="auth-view hidden-view">
            <div class="view-header">
              <h2>Create Account</h2>
              <p>Register your character profile to begin.</p>
            </div>

            <form id="register-form" class="auth-form" autocomplete="off">
              <!-- Username -->
              <div class="form-group">
                <label for="reg-username">Username</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input type="text" id="reg-username" name="username" class="input-field" placeholder="3-24 characters" minlength="3" maxlength="24" autocomplete="username" required />
                </div>
              </div>

              <!-- Email -->
              <div class="form-group">
                <label for="reg-email">Email Address</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  </span>
                  <input type="email" id="reg-email" name="email" class="input-field" placeholder="name@example.com" maxlength="254" autocomplete="email" required />
                </div>
              </div>

              <!-- Password -->
              <div class="form-group">
                <label for="reg-password">Password</label>
                <div class="input-wrap">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </span>
                  <input type="password" id="reg-password" name="password" class="input-field" placeholder="10-128 characters" minlength="10" maxlength="128" autocomplete="new-password" required />
                </div>
              </div>

              <!-- Sex Selection -->
              <div class="form-group">
                <label>Character Gender</label>
                <div class="gender-selector">
                  <label class="gender-option">
                    <input type="radio" name="sex" value="male" checked required />
                    <div class="gender-card">
                      <span class="gender-icon">♂</span>
                      <span class="gender-label">Male</span>
                    </div>
                  </label>
                  <label class="gender-option">
                    <input type="radio" name="sex" value="female" required />
                    <div class="gender-card">
                      <span class="gender-icon">♀</span>
                      <span class="gender-label">Female</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="btn-primary">
                <span class="btn-text">CREATE ACCOUNT</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </form>

            <!-- Footer Switch -->
            <div class="view-footer">
              <span>Already have an account?</span>
              <button type="button" id="switch-to-login" class="link-btn">Log In</button>
            </div>
          </div>

          <!-- Error Banner -->
          <div id="auth-error" class="auth-error-banner hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span id="auth-error-text"></span>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(root);
    this.element = root;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.element) return;

    const switchToRegisterBtn = this.element.querySelector('#switch-to-register') as HTMLButtonElement;
    const switchToLoginBtn = this.element.querySelector('#switch-to-login') as HTMLButtonElement;
    const loginForm = this.element.querySelector('#login-form') as HTMLFormElement;
    const registerForm = this.element.querySelector('#register-form') as HTMLFormElement;

    switchToRegisterBtn?.addEventListener('click', () => this.setMode('register'));
    switchToLoginBtn?.addEventListener('click', () => this.setMode('login'));

    loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submitForm(loginForm, 'authLogin');
    });

    registerForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submitForm(registerForm, 'authRegister');
    });
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.clearError();
    if (!this.element) return;

    const loginView = this.element.querySelector('#login-view');
    const registerView = this.element.querySelector('#register-view');

    if (mode === 'login') {
      loginView?.classList.remove('hidden-view');
      loginView?.classList.add('active-view');
      registerView?.classList.remove('active-view');
      registerView?.classList.add('hidden-view');
    } else {
      registerView?.classList.remove('hidden-view');
      registerView?.classList.add('active-view');
      loginView?.classList.remove('active-view');
      loginView?.classList.add('hidden-view');
    }
  }

  show(): void {
    if (!this.element && document.body) {
      this.mount(document.body);
    }
    this.setMode('login');
    this.element?.classList.remove('hidden');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void post('authRendered').catch(() => {});
      });
    });
  }

  hide(): void {
    this.element?.classList.add('hidden');
    this.clearError();
  }

  unmount(): void {
    this.element?.remove();
    this.element = null;
  }

  private async submitForm(form: HTMLFormElement, eventName: string): Promise<void> {
    if (this.submitting) return;
    this.submitting = true;
    this.clearError();

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    const btnText = submitBtn?.querySelector('.btn-text');
    const originalText = btnText?.textContent || '';

    if (submitBtn) {
      submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'CONNECTING...';
    }

    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await post<{ ok: boolean; error?: string }>(eventName, values);
      if (!result.ok) {
        this.showError(result.error || 'Authentication request failed.');
      }
    } catch (_) {
      this.showError('The interface could not reach the game client.');
    } finally {
      this.submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        if (btnText) btnText.textContent = originalText;
      }
    }
  }

  private showError(msg: string): void {
    if (!this.element) return;
    const errBanner = this.element.querySelector('#auth-error');
    const errText = this.element.querySelector('#auth-error-text');
    if (errText) errText.textContent = msg;
    errBanner?.classList.remove('hidden');
  }

  private clearError(): void {
    if (!this.element) return;
    const errBanner = this.element.querySelector('#auth-error');
    const errText = this.element.querySelector('#auth-error-text');
    if (errText) errText.textContent = '';
    errBanner?.classList.add('hidden');
  }
}
