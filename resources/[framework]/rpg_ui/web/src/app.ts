import { onMessage, post, type NuiMessage } from './core/bridge';
import { NotificationManager, type NotificationPayload } from './core/notifications';
import { ProgressManager, type ProgressPayload } from './core/progress';
import { AuthFeature } from './features/auth';
import { ChatFeature, type ChatMessage } from './features/chat';
import { CinematicFeature, type CinematicSceneData } from './features/cinematic';
import { HudFeature, type HudData } from './features/hud';

export class App {
  private notifications: NotificationManager;
  private progress: ProgressManager;

  private authFeature: AuthFeature | null = null;
  private chatFeature: ChatFeature | null = null;
  private cinematicFeature: CinematicFeature | null = null;
  private hudFeature: HudFeature | null = null;

  constructor() {
    this.notifications = new NotificationManager();
    this.progress = new ProgressManager();
  }

  init(): void {
    onMessage((msg) => this.handleMessage(msg));
    void post('ready').catch(() => {});
  }

  private getAuth(): AuthFeature {
    if (!this.authFeature) {
      this.authFeature = new AuthFeature();
      this.authFeature.mount(document.body);
    }
    return this.authFeature;
  }

  private getChat(): ChatFeature {
    if (!this.chatFeature) {
      this.chatFeature = new ChatFeature();
      this.chatFeature.mount(document.body);
    }
    return this.chatFeature;
  }

  private getCinematic(): CinematicFeature {
    if (!this.cinematicFeature) {
      this.cinematicFeature = new CinematicFeature();
      this.cinematicFeature.mount(document.body);
    }
    return this.cinematicFeature;
  }

  private getHud(): HudFeature {
    if (!this.hudFeature) {
      this.hudFeature = new HudFeature();
      this.hudFeature.mount(document.body);
    }
    return this.hudFeature;
  }

  private handleMessage(msg: NuiMessage): void {
    const action = msg.action;
    const panel = msg.panel;
    const data = (msg.data || {}) as Record<string, unknown>;

    switch (action) {
      case 'show':
        if (panel === 'auth') {
          this.getAuth().show();
        } else if (panel === 'chat') {
          this.getChat().show();
        } else if (panel === 'cinematic') {
          this.getCinematic().showScene(data as CinematicSceneData);
        } else if (panel === 'hud') {
          this.getHud().show();
        }
        break;

      case 'hide':
        if (panel === 'auth') {
          this.authFeature?.hide();
        } else if (panel === 'chat') {
          this.chatFeature?.hide();
        } else if (panel === 'cinematic') {
          this.cinematicFeature?.hide();
        } else if (panel === 'hud') {
          this.hudFeature?.hide();
        }
        break;

      case 'unmount':
        if (panel === 'auth') {
          this.authFeature?.unmount();
          this.authFeature = null;
        }
        break;

      case 'chatMessage':
        this.getChat().addMessage(data as ChatMessage);
        break;

      case 'chatClear':
        this.chatFeature?.clear();
        break;

      case 'notify':
        this.notifications.notify(data as NotificationPayload);
        break;

      case 'progress':
        this.progress.start(data as unknown as ProgressPayload);
        break;

      case 'progressCancel':
        this.progress.cancel();
        break;

      case 'cinematicScene':
        this.getCinematic().showScene(data as CinematicSceneData);
        break;

      case 'hudUpdate':
        this.getHud().update(data as unknown as HudData);
        break;

      case 'hideAll':
        this.authFeature?.hide();
        this.chatFeature?.hide();
        this.cinematicFeature?.hide();
        this.progress.stop();
        break;

      default:
        break;
    }
  }
}
