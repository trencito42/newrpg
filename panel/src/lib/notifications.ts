import { dbQuery } from "./db";

export interface CreateNotificationParams {
  accountId: number;
  type: string;
  titleEn: string;
  titleRo: string;
  messageEn: string;
  messageRo: string;
  linkUrl?: string | null;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await dbQuery(
      `INSERT INTO panel_notifications (account_id, type, title_en, title_ro, message_en, message_ro, link_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.accountId,
        params.type,
        params.titleEn.slice(0, 128),
        params.titleRo.slice(0, 128),
        params.messageEn.slice(0, 255),
        params.messageRo.slice(0, 255),
        params.linkUrl || null,
      ]
    );
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
