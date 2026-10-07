import type { PlayerManagementTarget } from "./types";

/** Map DB row / partial profile fields into drawer target shape. */
export function normalizePlayerManagementTarget(
  raw: Record<string, unknown> | PlayerManagementTarget,
  overrides?: Partial<PlayerManagementTarget>
): PlayerManagementTarget {
  const row = raw as Record<string, unknown>;
  return {
    account_id: Number(row.account_id),
    character_id: Number(row.character_id),
    username: String(row.username),
    email: (row.email as string) ?? null,
    level: Number(row.level) || 1,
    hours: Number(row.hours ?? row.paydays_received) || 0,
    cash: Number(row.cash) || 0,
    bank: Number(row.bank) || 0,
    premium_points: Number(row.premium_points) || 0,
    faction_id: (row.faction_id as string) ?? null,
    faction_rank: Number(row.faction_rank ?? row.job_grade) || 0,
    clan_id: row.clan_id != null ? Number(row.clan_id) : null,
    clan_rank: Number(row.clan_rank) || 0,
    clan_tag: (row.clan_tag as string) ?? null,
    clan_tag_color: (row.clan_tag_color as string) ?? null,
    clan_tag_style: (row.clan_tag_style as string) ?? null,
    is_author: Number(row.is_author) || 0,
    is_online: Boolean(row.is_online),
    last_played: (row.last_played as string) ?? null,
    avatar_skin: (row.avatar_skin as string) ?? null,
    ...overrides,
  };
}
