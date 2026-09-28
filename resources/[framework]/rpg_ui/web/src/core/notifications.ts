export interface NotificationPayload {
  message?: string;
  kind?: 'info' | 'success' | 'warning' | 'error' | 'admin' | 'helper' | string;
  duration?: number;
}

export class NotificationManager {
  private container: HTMLElement;

  constructor() {
    let el = document.getElementById('notifications');
    if (!el) {
      el = document.createElement('aside');
      el.id = 'notifications';
      el.className = 'notifications';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    this.container = el;
  }

  notify(payload: NotificationPayload): void {
    const item = document.createElement('div');
    const kind = String(payload.kind || 'info').replace(/[^a-z-]/gi, '');
    item.className = `notice ${kind}`;
    item.textContent = String(payload.message || '');
    this.container.appendChild(item);

    const duration = Math.max(1000, Number(payload.duration) || 4500);
    window.setTimeout(() => item.classList.add('leaving'), duration);
    window.setTimeout(() => item.remove(), duration + 350);
  }
}
