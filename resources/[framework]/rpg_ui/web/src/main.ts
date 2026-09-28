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
const loginForm = byId<HTMLFormElement>('login-form');
const registerForm = byId<HTMLFormElement>('register-form');
const authError = byId('auth-error');
const chat = byId('chat');
const chatForm = byId<HTMLFormElement>('chat-form');
const chatInput = byId<HTMLInputElement>('chat-input');
const chatMessages = byId('chat-messages');
const notifications = byId('notifications');
const history: string[] = [];
let historyIndex = 0;
let submitting = false;

function setAuthMode(mode: 'login' | 'register') {
  loginForm.classList.toggle('hidden', mode !== 'login');
  registerForm.classList.toggle('hidden', mode !== 'register');
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  byId('auth-subtitle').textContent = mode === 'login' ? 'Sign in to continue to the city.' : 'One account. One persistent identity.';
  authError.textContent = '';
  const first = (mode === 'login' ? loginForm : registerForm).querySelector<HTMLInputElement>('input');
  requestAnimationFrame(() => first?.focus());
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.mode === 'register' ? 'register' : 'login'));
});

async function submitAuth(form: HTMLFormElement, eventName: 'authLogin' | 'authRegister') {
  if (submitting) return;
  submitting = true;
  authError.textContent = '';
  form.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = true; });
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await post<{ ok: boolean; error?: string }>(eventName, values);
    if (!result.ok) authError.textContent = result.error || 'Request failed.';
  } catch (_) {
    authError.textContent = 'The interface could not reach the game client.';
  } finally {
    submitting = false;
    form.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
  }
}

loginForm.addEventListener('submit', (event) => { event.preventDefault(); void submitAuth(loginForm, 'authLogin'); });
registerForm.addEventListener('submit', (event) => { event.preventDefault(); void submitAuth(registerForm, 'authRegister'); });

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
  if (event.key === 'Escape') { event.preventDefault(); chatInput.value = ''; void post('chatClose'); return; }
  if (event.key === 'ArrowUp' && history.length) {
    event.preventDefault(); historyIndex = Math.max(0, historyIndex - 1); chatInput.value = history[historyIndex] || '';
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault(); historyIndex = Math.min(history.length, historyIndex + 1); chatInput.value = history[historyIndex] || '';
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
  if (data.action === 'show' && data.panel === 'auth') {
    auth.classList.remove('hidden'); setAuthMode('login');
    requestAnimationFrame(() => requestAnimationFrame(() => { void post('authRendered'); }));
  } else if (data.action === 'hide' && data.panel === 'auth') {
    auth.classList.add('hidden');
  } else if (data.action === 'show' && data.panel === 'chat') {
    chat.classList.remove('hidden'); chat.classList.add('open'); requestAnimationFrame(() => chatInput.focus());
  } else if (data.action === 'hide' && data.panel === 'chat') {
    chat.classList.remove('open');
  } else if (data.action === 'chatMessage') {
    addChatMessage((data.data || {}) as ChatMessage); chat.classList.remove('hidden');
  } else if (data.action === 'chatClear') {
    chatMessages.replaceChildren();
  } else if (data.action === 'notify') {
    notify(data.data || {});
  } else if (data.action === 'cinematicScene') {
    const payload = data.data || {};
    const cinematic = byId('cinematic'); cinematic.classList.remove('hidden');
    byId('cinematic-kicker').textContent = String(payload.kicker || 'LOS SANTOS');
    byId('cinematic-title').textContent = String(payload.title || '');
    byId('cinematic-description').textContent = String(payload.description || '');
    const bar = byId('cinematic-progress-bar'); bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = `progress ${Math.max(250, Number(payload.duration) || 4000)}ms linear forwards`;
  } else if (data.action === 'hide' && data.panel === 'cinematic') {
    byId('cinematic').classList.add('hidden');
  }
});

void post('ready');
