import './cinematic.css';

export interface CinematicSceneData {
  kicker?: string;
  title?: string;
  description?: string;
  duration?: number;
}

export class CinematicFeature {
  private element: HTMLElement | null = null;
  private kickerEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private descEl: HTMLElement | null = null;
  private barEl: HTMLElement | null = null;

  mount(parent: HTMLElement): void {
    if (this.element) return;

    const root = document.createElement('section');
    root.id = 'cinematic';
    root.className = 'cinematic-root hidden';
    root.setAttribute('aria-label', 'Cinematic onboarding');

    root.innerHTML = `
      <div class="cinematic-copy">
        <span id="cinematic-kicker" class="cinematic-kicker">LOS SANTOS</span>
        <h2 id="cinematic-title" class="cinematic-title">WELCOME</h2>
        <p id="cinematic-description" class="cinematic-description"></p>
      </div>
      <div class="cinematic-progress">
        <div id="cinematic-progress-bar" class="cinematic-progress-bar"></div>
      </div>
    `;

    parent.appendChild(root);
    this.element = root;
    this.kickerEl = root.querySelector('#cinematic-kicker');
    this.titleEl = root.querySelector('#cinematic-title');
    this.descEl = root.querySelector('#cinematic-description');
    this.barEl = root.querySelector('#cinematic-progress-bar');
  }

  showScene(data: CinematicSceneData): void {
    if (!this.element && document.body) {
      this.mount(document.body);
    }
    this.element?.classList.remove('hidden');

    if (this.kickerEl) this.kickerEl.textContent = String(data.kicker || 'LOS SANTOS');
    if (this.titleEl) this.titleEl.textContent = String(data.title || '');
    if (this.descEl) this.descEl.textContent = String(data.description || '');

    if (this.barEl) {
      const duration = Math.max(500, Number(data.duration) || 4000);
      this.barEl.style.animation = 'none';
      void this.barEl.offsetWidth; // force reflow
      this.barEl.style.animation = `cinematicFill ${duration}ms linear forwards`;
    }
  }

  hide(): void {
    this.element?.classList.add('hidden');
    if (this.barEl) this.barEl.style.animation = 'none';
  }

  unmount(): void {
    this.element?.remove();
    this.element = null;
    this.kickerEl = null;
    this.titleEl = null;
    this.descEl = null;
    this.barEl = null;
  }
}
