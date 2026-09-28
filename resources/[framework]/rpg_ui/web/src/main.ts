import './style.css';

type NuiMessage = { action?: string; panel?: string; data?: Record<string, unknown> };
type ChatMessage = { message?: string; kind?: string };

const resource = typeof (window as unknown as { GetParentResourceName?: () => string }).GetParentResourceName === 'function'
  ? (window as unknown as { GetParentResourceName: () => string }).GetParentResourceName()
  : 'rpg_ui';

async function post<T>(event: string, data: unknown = {}): Promise<T> {
  const response = await fetch(`https://${resource}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });
  return response.json() as Promise<T>;
}

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
};

const auth = byId('auth');
const loginView = byId('login-view');
const registerView = byId('register-view');
const loginForm = byId<HTMLFormElement>('login-form');
const registerForm = byId<HTMLFormElement>('register-form');
const authError = byId('auth-error');
const authErrorText = byId('auth-error-text');
const switchToRegisterBtn = byId<HTMLButtonElement>('switch-to-register');
const switchToLoginBtn = byId<HTMLButtonElement>('switch-to-login');

const chat = byId('chat');
const chatForm = byId<HTMLFormElement>('chat-form');
const chatInput = byId<HTMLInputElement>('chat-input');
const chatMessages = byId('chat-messages');
const notifications = byId('notifications');

const history: string[] = [];
let historyIndex = 0;
let submitting = false;

function showError(message: string) {
  authErrorText.textContent = message;
  authError.classList.remove('hidden');
}

function clearError() {
  authErrorText.textContent = '';
  authError.classList.add('hidden');
}

function setAuthMode(mode: 'login' | 'register') {
  clearError();
  if (mode === 'register') {
    loginView.classList.remove('active-view');
    loginView.classList.add('hidden-view');
    window.setTimeout(() => {
      registerView.classList.remove('hidden-view');
      registerView.classList.add('active-view');
      const first = registerForm.querySelector<HTMLInputElement>('input');
      first?.focus();
    }, 120);
  } else {
    registerView.classList.remove('active-view');
    registerView.classList.add('hidden-view');
    window.setTimeout(() => {
      loginView.classList.remove('hidden-view');
      loginView.classList.add('active-view');
      const first = loginForm.querySelector<HTMLInputElement>('input');
      first?.focus();
    }, 120);
  }
}

switchToRegisterBtn.addEventListener('click', () => setAuthMode('register'));
switchToLoginBtn.addEventListener('click', () => setAuthMode('login'));

async function submitAuth(form: HTMLFormElement, eventName: 'authLogin' | 'authRegister') {
  if (submitting) return;
  submitting = true;
  clearError();

  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const btnText = submitBtn?.querySelector<HTMLElement>('.btn-text');
  const originalHtml = btnText ? btnText.innerHTML : (submitBtn?.innerHTML || 'Submit');

  if (submitBtn) {
    submitBtn.disabled = true;
    if (btnText) {
      btnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    }
  }

  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await post<{ ok: boolean; error?: string }>(eventName, values);
    if (!result.ok) {
      showError(result.error || 'Request failed.');
    }
  } catch (_) {
    showError('The interface could not reach the game client.');
  } finally {
    submitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      if (btnText) {
        btnText.innerHTML = originalHtml;
      }
    }
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitAuth(loginForm, 'authLogin');
});

registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitAuth(registerForm, 'authRegister');
});

function addChatMessage(data: ChatMessage) {
  const row = document.createElement('div');
  row.className = `chat-line ${String(data.kind || 'normal').replace(/[^a-z-]/gi, '')}`;
  row.textContent = String(data.message || '');
  chatMessages.append(row);
  while (chatMessages.children.length > 100) chatMessages.firstElementChild?.remove();
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = chatInput.value.trim();
  if (value) {
    if (history.at(-1) !== value) history.push(value);
    if (history.length > 50) history.shift();
    historyIndex = history.length;
    void post('chatSubmit', { value });
  } else {
    void post('chatClose');
  }
  chatInput.value = '';
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    chatInput.value = '';
    void post('chatClose');
    return;
  }
  if (event.key === 'ArrowUp' && history.length) {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    chatInput.value = history[historyIndex] || '';
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    chatInput.value = history[historyIndex] || '';
  }
});

function notify(data: Record<string, unknown>) {
  const item = document.createElement('div');
  const kind = String(data.kind || 'info').replace(/[^a-z-]/gi, '');
  item.className = `notice ${kind}`;
  item.textContent = String(data.message || '');
  notifications.append(item);
  window.setTimeout(() => item.classList.add('leaving'), Math.max(1000, Number(data.duration) || 4500));
  window.setTimeout(() => item.remove(), Math.max(1400, Number(data.duration) || 4500) + 350);
}

window.addEventListener('message', ({ data }: MessageEvent<NuiMessage>) => {
  if (!data || typeof data !== 'object') return;
  console.log('[RPG_UI] Received NUI message:', JSON.stringify(data));

  if (data.action === 'show' && data.panel === 'auth') {
    auth.classList.remove('hidden');
    setAuthMode('login');
    requestAnimationFrame(() => requestAnimationFrame(() => { void post('authRendered'); }));
  } else if (data.action === 'hide' && data.panel === 'auth') {
    auth.classList.add('hidden');
  } else if (data.action === 'show' && data.panel === 'chat') {
    chat.classList.remove('hidden');
    chat.classList.add('open');
    requestAnimationFrame(() => chatInput.focus());
  } else if (data.action === 'hide' && data.panel === 'chat') {
    chat.classList.remove('open');
  } else if (data.action === 'chatMessage') {
    addChatMessage((data.data || {}) as ChatMessage);
    chat.classList.remove('hidden');
  } else if (data.action === 'chatClear') {
    chatMessages.replaceChildren();
  } else if (data.action === 'notify') {
    notify(data.data || {});
  } else if ((data.action === 'show' && data.panel === 'cinematic') || data.action === 'cinematicScene') {
    const payload = (data.data || {}) as Record<string, unknown>;
    const cinematic = byId('cinematic');
    cinematic.classList.remove('hidden');
    byId('cinematic-kicker').textContent = String(payload.kicker || 'LOS SANTOS');
    byId('cinematic-title').textContent = String(payload.title || '');
    byId('cinematic-description').textContent = String(payload.description || '');
    const bar = byId('cinematic-progress-bar');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = `progress ${Math.max(250, Number(payload.duration) || 4000)}ms linear forwards`;
  } else if (data.action === 'hide' && data.panel === 'cinematic') {
    byId('cinematic').classList.add('hidden');
  } else if (data.action === 'hideAll') {
    auth.classList.add('hidden');
    byId('cinematic').classList.add('hidden');
    chat.classList.remove('open');
  }
});

void post('ready');
