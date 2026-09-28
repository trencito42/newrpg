import './style.css';
import { initBridge } from './core/bridge';
import { initErrorReporter } from './core/errors';
import { App } from './app';

function bootstrap(): void {
  initBridge();
  initErrorReporter();
  const app = new App();
  app.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
