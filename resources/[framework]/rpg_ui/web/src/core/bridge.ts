export type NuiMessage = {
  action?: string;
  panel?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

const resourceName =
  typeof (window as unknown as { GetParentResourceName?: () => string }).GetParentResourceName === 'function'
    ? (window as unknown as { GetParentResourceName: () => string }).GetParentResourceName()
    : 'rpg_ui';

export async function post<T = { ok: boolean; error?: string }>(event: string, data: unknown = {}): Promise<T> {
  try {
    const response = await fetch(`https://${resourceName}/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    });
    return (await response.json()) as T;
  } catch (err) {
    console.warn(`[NUI Bridge] Failed to post to event "${event}":`, err);
    throw err;
  }
}

type MessageHandler = (message: NuiMessage) => void;
const messageHandlers: Set<MessageHandler> = new Set();

export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

export function initBridge(): void {
  window.addEventListener('message', (event: MessageEvent<NuiMessage>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    for (const handler of messageHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error('[NUI Bridge] Message handler exception:', err);
      }
    }
  });
}
