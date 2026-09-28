import './hud.css';

export interface HudData {
  serverId?: number;
  cash?: number;
  level?: number;
}

export class HudFeature {
  private element: HTMLElement | null = null;
  private idValEl: HTMLElement | null = null;
  private cashValEl: HTMLElement | null = null;
  private levelValEl: HTMLElement | null = null;

  mount(parent: HTMLElement): void {
    if (this.element) return;

    const root = document.createElement('section');
    root.id = 'hud';
    root.className = 'hud-root hidden';
    root.setAttribute('aria-label', 'Player HUD');

    root.innerHTML = `
      <div class="hud-card">
        <div class="hud-item">
          <span class="hud-label">ID</span>
          <span id="hud-id" class="hud-value id">--</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">LVL</span>
          <span id="hud-level" class="hud-value">1</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">CASH</span>
          <span id="hud-cash" class="hud-value money">$0</span>
        </div>
      </div>
    `;

    parent.appendChild(root);
    this.element = root;
    this.idValEl = root.querySelector('#hud-id');
    this.cashValEl = root.querySelector('#hud-cash');
    this.levelValEl = root.querySelector('#hud-level');
  }

  update(data: HudData): void {
    if (!this.element && document.body) {
      this.mount(document.body);
    }
    if (data.serverId !== undefined && this.idValEl) {
      this.idValEl.textContent = String(data.serverId);
    }
    if (data.cash !== undefined && this.cashValEl) {
      this.cashValEl.textContent = `$${Number(data.cash).toLocaleString()}`;
    }
    if (data.level !== undefined && this.levelValEl) {
      this.levelValEl.textContent = String(data.level);
    }
  }

  show(): void {
    if (!this.element && document.body) {
      this.mount(document.body);
    }
    this.element?.classList.remove('hidden');
  }

  hide(): void {
    this.element?.classList.add('hidden');
  }

  unmount(): void {
    this.element?.remove();
    this.element = null;
    this.idValEl = null;
    this.cashValEl = null;
    this.levelValEl = null;
  }
}
