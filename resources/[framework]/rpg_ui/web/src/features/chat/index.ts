import './chat.css';
import { post } from '../../core/bridge';

export interface ChatMessage {
  message?: string;
  kind?: 'normal' | 'system' | 'info' | 'success' | 'warning' | 'error' | 'admin' | 'helper' | 'private' | string;
}

export class ChatFeature {
  private element: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;
  private input: HTMLInputElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private history: string[] = [];
  private historyIndex = -1;

  mount(parent: HTMLElement): void {
    if (this.element) return;

    const root = document.createElement('section');
    root.id = 'chat';
    root.className = 'chat-root hidden';
    root.setAttribute('aria-label', 'Game chat');

    root.innerHTML = `
      <div id="chat-messages" class="chat-messages"></div>
      <form id="chat-form" class="chat-form" autocomplete="off">
        <span class="chat-prompt">❯</span>
        <input id="chat-input" type="text" maxlength="280" placeholder="Type a message or /command..." />
      </form>
    `;

    parent.appendChild(root);
    this.element = root;
    this.form = root.querySelector('#chat-form') as HTMLFormElement;
    this.input = root.querySelector('#chat-input') as HTMLInputElement;
    this.messagesContainer = root.querySelector('#chat-messages') as HTMLElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.form || !this.input) return;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = this.input?.value.trim() || '';
      if (value) {
        if (this.history.at(-1) !== value) this.history.push(value);
        if (this.history.length > 50) this.history.shift();
        this.historyIndex = this.history.length;
        void post('chatSubmit', { value }).catch(() => {});
      } else {
        void post('chatClose').catch(() => {});
      }
      if (this.input) this.input.value = '';
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.input) this.input.value = '';
        void post('chatClose').catch(() => {});
        return;
      }
      if (e.key === 'ArrowUp' && this.history.length) {
        e.preventDefault();
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        if (this.input) this.input.value = this.history[this.historyIndex] || '';
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        if (this.input) this.input.value = this.history[this.historyIndex] || '';
      }
    });
  }

  show(): void {
    if (!this.element && document.body) {
      this.mount(document.body);
    }
    this.element?.classList.remove('hidden');
    this.element?.classList.add('open');
    requestAnimationFrame(() => {
      this.input?.focus();
    });
  }

  hide(): void {
    this.element?.classList.remove('open');
  }

  addMessage(data: ChatMessage): void {
    if (!this.element && document.body) {
      this.mount(document.body);
    }
    this.element?.classList.remove('hidden');

    if (!this.messagesContainer) return;
    const row = document.createElement('div');
    const kind = String(data.kind || 'normal').replace(/[^a-z-]/gi, '');
    row.className = `chat-line ${kind}`;
    row.textContent = String(data.message || '');
    this.messagesContainer.appendChild(row);

    while (this.messagesContainer.children.length > 100) {
      this.messagesContainer.firstElementChild?.remove();
    }
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  clear(): void {
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
  }

  unmount(): void {
    this.element?.remove();
    this.element = null;
    this.form = null;
    this.input = null;
    this.messagesContainer = null;
  }
}
