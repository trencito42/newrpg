import { dbQuery } from "./db";
import { factionIdSql } from "./faction-sql";
import { CANONICAL_FACTIONS, getFactionColor, getFactionLabel } from "./factions";
import type { ResolvedPlayerIdentity } from "./player-identity";
import type { RowDataPacket } from "mysql2";

export type ForumAuthorRef = {
  accountId: number;
  characterId: number | null;
  username: string;
};

export function forumAuthorKey(ref: ForumAuthorRef): string {
  if (ref.characterId && ref.characterId > 0) return `c:${ref.characterId}`;
  return `a:${ref.accountId}:${ref.username.toLowerCase()}`;
}

interface IdentityCharRow extends RowDataPacket {
  character_id: number;
  account_id?: number;
  username: string;
  firstname: string | null;
  lastname: string | null;
  metadata: string | Record<string, unknown> | null;
  job: string | null;
  clan_id: number | null;
  clan_name: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
  faction_grade: number | null;
}

function rowToIdentity(row: IdentityCharRow): ResolvedPlayerIdentity {
  const factionId =
    row.job && CANONICAL_FACTIONS[row.job.toLowerCase()] ? row.job.toLowerCase() : null;
  let skin: string | null = null;
  if (row.metadata) {
    try {
      const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      if (meta && typeof meta === "object" && "skin" in meta && meta.skin) {
        skin = String(meta.skin);
      }
    } catch {
      /* ignore */
    }
  }
  const characterName = row.firstname
    ? `${row.firstname} ${row.lastname || ""}`.trim()
    : null;
  return {
    username: row.username,
    characterName,
    skin,
    factionId,
    factionColor: getFactionColor(factionId),
    clanId: row.clan_id ? Number(row.clan_id) : null,
    clanTag: row.clan_tag || null,
    clanColor: row.clan_tag_color || "#f59e0b",
    clanTagStyle: row.clan_tag_style || "brackets",
    factionLabel: factionId ? getFactionLabel(factionId) : null,
    clanName: row.clan_name || null,
    factionGrade: row.faction_grade != null ? Number(row.faction_grade) : null,
  };
}

/** Batch-resolve forum authors by stored character id (preferred) or account fallback. */
export async function resolveForumAuthorIdentities(
  refs: ForumAuthorRef[]
): Promise<Map<string, ResolvedPlayerIdentity>> {
  const out = new Map<string, ResolvedPlayerIdentity>();
  const unique = new Map<string, ForumAuthorRef>();
  for (const ref of refs) {
    if (!ref.username) continue;
    unique.set(forumAuthorKey(ref), ref);
  }
  if (unique.size === 0) return out;

  const charIds = Array.from(unique.values())
    .map((r) => r.characterId)
    .filter((id): id is number => typeof id === "number" && id > 0);

  if (charIds.length > 0) {
    const placeholders = charIds.map(() => "?").join(",");
    const rows = await dbQuery<IdentityCharRow>(
      `SELECT c.id AS character_id, a.username, c.firstname, c.lastname, c.metadata,
              ${factionIdSql()} AS job,
              fm.grade AS faction_grade,
              cl.id AS clan_id, cl.name AS clan_name, cl.tag AS clan_tag,
              cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style
       FROM characters c
       INNER JOIN players p ON p.id = c.player_id
       INNER JOIN accounts a ON a.id = p.account_id
       LEFT JOIN faction_membership fm ON fm.character_id = c.id
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE c.id IN (${placeholders})`,
      charIds
    );
    const byChar = new Map<number, IdentityCharRow>();
    for (const row of rows) byChar.set(Number(row.character_id), row);

    for (const [key, ref] of unique) {
      if (ref.characterId && byChar.has(ref.characterId)) {
        out.set(key, rowToIdentity(byChar.get(ref.characterId)!));
      }
    }
  }

  const missingAccounts = Array.from(unique.values()).filter(
    (ref) => !out.has(forumAuthorKey(ref))
  );
  if (missingAccounts.length > 0) {
    const accountIds = Array.from(new Set(missingAccounts.map((r) => r.accountId)));
    const placeholders = accountIds.map(() => "?").join(",");
    const rows = await dbQuery<IdentityCharRow>(
      `SELECT c.id AS character_id, a.id AS account_id, a.username, c.firstname, c.lastname, c.metadata,
              ${factionIdSql()} AS job,
              fm.grade AS faction_grade,
              cl.id AS clan_id, cl.name AS clan_name, cl.tag AS clan_tag,
              cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style
       FROM accounts a
       INNER JOIN players p ON p.account_id = a.id
       INNER JOIN characters c ON c.id = (
         SELECT c2.id FROM characters c2
         WHERE c2.player_id = p.id
         ORDER BY c2.id DESC
         LIMIT 1
       )
       LEFT JOIN faction_membership fm ON fm.character_id = c.id
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE a.id IN (${placeholders})`,
      accountIds
    );
    const byAccount = new Map<number, IdentityCharRow>();
    for (const row of rows) {
      const aid = Number(row.account_id);
      if (aid) byAccount.set(aid, row);
    }
    for (const ref of missingAccounts) {
      const row = byAccount.get(ref.accountId);
      out.set(
        forumAuthorKey(ref),
        row
          ? rowToIdentity(row)
          : {
              username: ref.username,
              factionId: null,
              factionColor: null,
              clanId: null,
              clanTag: null,
              clanColor: null,
            }
      );
    }
  }

  return out;
}
