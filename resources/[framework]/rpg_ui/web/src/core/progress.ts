import { post } from './bridge';

export interface ProgressPayload {
  duration: number; // in milliseconds
  label?: string;
  id?: string;
  allowCancel?: boolean;
}

export class ProgressManager {
  private container: HTMLElement;
  private activeId: string | null = null;
  private timer: number | null = null;

  constructor() {
    let el = document.getElementById('progress-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'progress-root';
      el.className = 'progress-root hidden';
      document.body.appendChild(el);
    }
    this.container = el;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeId) {
        this.cancel();
      }
    });
  }

  start(payload: ProgressPayload): void {
    this.stop();
    const id = payload.id || `prog_${Date.now()}`;
    this.activeId = id;
    const duration = Math.max(100, Number(payload.duration) || 3000);
    const label = payload.label || 'In progress...';

    this.container.innerHTML = `
      <div class="progress-card">
        <div class="progress-info">
          <span class="progress-label">${escapeHtml(label)}</span>
          ${payload.allowCancel ? '<span class="progress-cancel-hint">[ESC] Cancel</span>' : ''}
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="animation: progressFill ${duration}ms linear forwards;"></div>
        </div>
      </div>
    `;
    this.container.classList.remove('hidden');

    this.timer = window.setTimeout(() => {
      this.complete();
    }, duration);
  }

  cancel(): void {
    if (!this.activeId) return;
    const id = this.activeId;
    this.stop();
    void post('progressCancel', { id }).catch(() => {});
  }

  complete(): void {
    if (!this.activeId) return;
    const id = this.activeId;
    this.stop();
    void post('progressComplete', { id }).catch(() => {});
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.activeId = null;
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}
