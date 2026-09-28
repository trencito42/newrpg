import { post } from './bridge';

export function initErrorReporter(): void {
  window.addEventListener('error', (event) => {
    const errorInfo = {
      type: 'uncaught_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack || null,
      timestamp: Date.now(),
    };
    console.error('[NUI Error]', errorInfo);
    void post('nuiError', errorInfo).catch(() => {});
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorInfo = {
      type: 'unhandled_rejection',
      message: typeof reason === 'object' && reason !== null ? (reason as Error).message || String(reason) : String(reason),
      stack: typeof reason === 'object' && reason !== null ? (reason as Error).stack || null : null,
      timestamp: Date.now(),
    };
    console.error('[NUI Unhandled Rejection]', errorInfo);
    void post('nuiError', errorInfo).catch(() => {});
  });
}
