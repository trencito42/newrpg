import type { UserSession } from "@/lib/types";

/** Permission keys (enforced server-side on every chat-log API route). */
export const PERM_VIEW_CHAT_LOGS = "admin.view_chat_logs";
export const PERM_VIEW_PRIVATE_CHAT_LOGS = "admin.view_private_chat_logs";

/** Channel types that exist in game handlers (do not invent). */
export const CHAT_LOG_CHANNEL_TYPES = [
  "say",
  "ooc",
  "me",
  "do",
  "shout",
  "whisper",
  "low",
  "b",
  "car_whisper",
  "phone_call",
  "f",
  "r",
  "d",
  "c",
  "gov",
  "megaphone",
  "ad",
  "pm",
  "staff_chat",
  "admin_chat",
  "leader_chat",
  "report",
  "newbie_q",
  "newbie_qa",
] as const;

export type ChatLogChannelType = (typeof CHAT_LOG_CHANNEL_TYPES)[number];

const PRIVATE_CHANNELS: ReadonlySet<string> = new Set([
  "whisper",
  "pm",
  "staff_chat",
  "admin_chat",
  "leader_chat",
  "report",
  "newbie_q",
  "phone_call",
]);

export function canViewChatLogs(session: UserSession | null): boolean {
  if (!session) return false;
  // admin.view_chat_logs: staff (helper 1+ or admin 1+)
  return session.adminLevel >= 1 || session.helperLevel >= 1;
}

export function canViewPrivateChatLogs(session: UserSession | null): boolean {
  if (!session) return false;
  // admin.view_private_chat_logs: admins only (PMs, whispers, staff channels, reports)
  return session.adminLevel >= 1;
}

export function isPrivateChatChannel(channelType: string): boolean {
  return PRIVATE_CHANNELS.has(channelType);
}

export function privateChannelSqlPlaceholder(): string {
  const list = [...PRIVATE_CHANNELS].map(() => "?").join(", ");
  return list;
}

export function privateChannelSqlValues(): string[] {
  return [...PRIVATE_CHANNELS];
}

export const CHAT_LOGS_PAGE_SIZE = 50;

export const CHAT_LOG_RETENTION_DAYS_DEFAULT = 90;
