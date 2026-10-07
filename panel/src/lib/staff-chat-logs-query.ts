import { dbQuery, dbQuerySingle } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import {
  CHAT_LOGS_PAGE_SIZE,
  privateChannelSqlValues,
  type ChatLogChannelType,
} from "@/lib/staff-chat-logs";

export type ChatLogRow = {
  id: number;
  character_id: number;
  account_id: number | null;
  player_name_snapshot: string;
  message: string;
  channel_type: string;
  faction_id: string | null;
  clan_id: number | null;
  target_character_id: number | null;
  target_name_snapshot: string | null;
  status: "sent" | "blocked";
  metadata: unknown;
  created_at: Date | string;
  pm_direction?: "sent" | "received";
};

type ChatLogDbRow = ChatLogRow & RowDataPacket;

export type ChatLogListFilters = {
  page?: number;
  characterId?: number;
  accountId?: number;
  text?: string;
  channel?: string;
  factionId?: string;
  clanId?: number;
  targetCharacterId?: number;
  dateFrom?: string;
  dateTo?: string;
  includePrivate?: boolean;
  playerScopeCharacterId?: number;
};

function parseMetadata(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function buildWhere(filters: ChatLogListFilters, includePrivate: boolean) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (!includePrivate) {
    const priv = privateChannelSqlValues();
    where.push("channel_type NOT IN (" + priv.map(() => "?").join(", ") + ")");
    params.push(...priv);
  }

  if (filters.playerScopeCharacterId) {
    const cid = filters.playerScopeCharacterId;
    where.push("(character_id = ? OR target_character_id = ?)");
    params.push(cid, cid);
  } else if (filters.characterId) {
    where.push("character_id = ?");
    params.push(filters.characterId);
  }

  if (filters.accountId) {
    where.push("account_id = ?");
    params.push(filters.accountId);
  }

  if (filters.channel) {
    where.push("channel_type = ?");
    params.push(filters.channel);
  }

  if (filters.factionId) {
    where.push("faction_id = ?");
    params.push(filters.factionId);
  }

  if (filters.clanId) {
    where.push("clan_id = ?");
    params.push(filters.clanId);
  }

  if (filters.targetCharacterId) {
    where.push("target_character_id = ?");
    params.push(filters.targetCharacterId);
  }

  if (filters.dateFrom) {
    where.push("created_at >= ?");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    where.push("created_at <= ?");
    params.push(filters.dateTo);
  }

  const text = (filters.text || "").trim();
  if (text.length >= 3) {
    const tokens = text
      .replace(/[^a-zA-Z0-9\s@._-]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const booleanParts: string[] = [];
    for (const w of tokens) {
      booleanParts.push(w.startsWith("-") ? w : "+" + w + "*");
    }
    const booleanQuery = booleanParts.join(" ");
    if (booleanQuery) {
      where.push("MATCH(message) AGAINST (? IN BOOLEAN MODE)");
      params.push(booleanQuery);
    }
  } else if (text.length > 0) {
    where.push("message LIKE ?");
    const escaped = text.replace(/[%_\\]/g, (ch) => "\\" + ch);
    params.push("%" + escaped + "%");
  }

  return { whereSql: where.join(" AND "), params };
}

export async function listChatLogs(filters: ChatLogListFilters, includePrivate: boolean) {
  const page = Math.max(1, filters.page || 1);
  const offset = (page - 1) * CHAT_LOGS_PAGE_SIZE;
  const { whereSql, params } = buildWhere(filters, includePrivate);

  const scopeCharId = filters.playerScopeCharacterId;

  const listSql =
    "SELECT id, character_id, account_id, player_name_snapshot, message, channel_type," +
    " faction_id, clan_id, target_character_id, target_name_snapshot, status, metadata, created_at" +
    " FROM chat_logs WHERE " +
    whereSql +
    " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";

  const rows = await dbQuery<ChatLogDbRow>(listSql, [
    ...params,
    CHAT_LOGS_PAGE_SIZE,
    offset,
  ]);

  const totalRow = await dbQuerySingle<RowDataPacket>(
    "SELECT COUNT(*) AS total FROM chat_logs WHERE " + whereSql,
    params
  );

  const items = rows.map((row) => {
    const item: ChatLogRow = {
      ...row,
      id: Number(row.id),
      character_id: Number(row.character_id),
      account_id: row.account_id != null ? Number(row.account_id) : null,
      clan_id: row.clan_id != null ? Number(row.clan_id) : null,
      target_character_id:
        row.target_character_id != null ? Number(row.target_character_id) : null,
      metadata: parseMetadata(row.metadata),
    };
    if (scopeCharId && item.channel_type === "pm") {
      item.pm_direction =
        item.character_id === scopeCharId
          ? "sent"
          : item.target_character_id === scopeCharId
            ? "received"
            : undefined;
    }
    return item;
  });

  return {
    items,
    page,
    pageSize: CHAT_LOGS_PAGE_SIZE,
    total: Number(totalRow?.total || 0),
  };
}

export async function getChatLogContext(logId: number, includePrivate: boolean) {
  const anchor = await dbQuerySingle<ChatLogDbRow>(
    `SELECT id, character_id, account_id, player_name_snapshot, message, channel_type,
            faction_id, clan_id, target_character_id, target_name_snapshot, status, metadata, created_at
     FROM chat_logs WHERE id = ? LIMIT 1`,
    [logId]
  );
  if (!anchor) return null;

  if (!includePrivate && privateChannelSqlValues().includes(anchor.channel_type)) {
    return { forbidden: true as const };
  }

  const createdAt = anchor.created_at;

  const before = await dbQuery<ChatLogDbRow>(
    `SELECT id, character_id, account_id, player_name_snapshot, message, channel_type,
            faction_id, clan_id, target_character_id, target_name_snapshot, status, metadata, created_at
     FROM chat_logs
     WHERE character_id = ? AND channel_type = ? AND (created_at < ? OR (created_at = ? AND id < ?))
     ORDER BY created_at DESC, id DESC
     LIMIT 10`,
    [anchor.character_id, anchor.channel_type, createdAt, createdAt, anchor.id]
  );

  const after = await dbQuery<ChatLogDbRow>(
    `SELECT id, character_id, account_id, player_name_snapshot, message, channel_type,
            faction_id, clan_id, target_character_id, target_name_snapshot, status, metadata, created_at
     FROM chat_logs
     WHERE character_id = ? AND channel_type = ? AND (created_at > ? OR (created_at = ? AND id > ?))
     ORDER BY created_at ASC, id ASC
     LIMIT 10`,
    [anchor.character_id, anchor.channel_type, createdAt, createdAt, anchor.id]
  );

  const mapRow = (row: ChatLogDbRow): ChatLogRow => ({
    ...row,
    id: Number(row.id),
    character_id: Number(row.character_id),
    metadata: parseMetadata(row.metadata),
  });

  return {
    selected: mapRow(anchor),
    before: before.reverse().map(mapRow),
    after: after.map(mapRow),
  };
}

export function isAllowedChannelFilter(channel: string): channel is ChatLogChannelType {
  return /^[a-z0-9_]+$/.test(channel) && channel.length <= 32;
}
