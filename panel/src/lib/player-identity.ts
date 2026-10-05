import { dbQuery } from "./db";
import { CANONICAL_FACTIONS, getFactionColor } from "./factions";
import { RowDataPacket } from "mysql2";
import { factionIdSql } from "./faction-sql";

export interface ResolvedPlayerIdentity {
  accountId?: number;
  characterId?: number | null;
  username: string;
  characterName?: string | null;
  skin?: string | null;
  factionId: string | null;
  factionColor: string | null;
  factionRank?: number | null;
  clanId: number | null;
  clanName?: string | null;
  clanRank?: string | null;
  clanTag: string | null;
  clanColor: string | null;
  clanTagStyle?: string | null;
}

interface IdentityDbRow extends RowDataPacket {
  account_id: number;
  username: string;
  character_id: number | null;
  character_level: number | null;
  character_slot: number | null;
  firstname: string | null;
  lastname: string | null;
  metadata: string | Record<string, any> | null;
  job: string | null;
  faction_rank: number | null;
  clan_id: number | null;
  clan_name: string | null;
  clan_rank: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

/**
 * Batch resolve player identities for a list of usernames.
 * Avoids N+1 queries.
 */
export async function resolvePlayerIdentities(
  usernames: string[]
): Promise<Map<string, ResolvedPlayerIdentity>> {
  const result = new Map<string, ResolvedPlayerIdentity>();
  const uniqueNames = Array.from(new Set(usernames.filter(Boolean)));
  if (uniqueNames.length === 0) return result;

  const placeholders = uniqueNames.map(() => "?").join(",");
  const query = `
    SELECT 
      a.id AS account_id,
      a.username,
      c.id AS character_id,
      c.level AS character_level,
      c.slot AS character_slot,
      c.firstname,
      c.lastname,
      c.metadata,
      ${factionIdSql()} AS job,
      COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction_grade')) AS UNSIGNED), 0) AS faction_rank,
      cl.id as clan_id,
      cl.name as clan_name,
      cm.rank as clan_rank,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
    FROM accounts a
    LEFT JOIN players p ON p.account_id = a.id
    LEFT JOIN characters c ON c.player_id = p.id
    LEFT JOIN clan_members cm ON cm.character_id = c.id
    LEFT JOIN clans cl ON cl.id = cm.clan_id
    WHERE a.username IN (${placeholders})
    ORDER BY a.id ASC, c.level DESC, c.slot ASC, c.id ASC
  `;

  try {
    const rows = await dbQuery<IdentityDbRow>(query, uniqueNames);
    for (const row of rows) {
      const identityKey = row.username.toLowerCase();
      if (result.has(identityKey)) continue;
      const factionId = row.job && CANONICAL_FACTIONS[row.job.toLowerCase()] ? row.job.toLowerCase() : null;
      const factionColor = getFactionColor(factionId);

      let skin: string | null = null;
      if (row.metadata) {
        try {
          const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
          if (meta && meta.skin) skin = String(meta.skin);
        } catch {}
      }

      const characterName = row.firstname ? `${row.firstname} ${row.lastname || ""}`.trim() : null;

      result.set(identityKey, {
        accountId: row.account_id,
        characterId: row.character_id ? Number(row.character_id) : null,
        username: row.username,
        characterName,
        skin,
        factionId,
        factionColor,
        factionRank: row.faction_rank == null ? null : Number(row.faction_rank),
        clanId: row.clan_id ? Number(row.clan_id) : null,
        clanName: row.clan_name || null,
        clanRank: row.clan_rank || null,
        clanTag: row.clan_tag || null,
        clanColor: row.clan_tag_color || "#f59e0b",
        clanTagStyle: row.clan_tag_style || "brackets",
      });
    }
  } catch (err) {
    console.error("resolvePlayerIdentities error:", err);
  }

  // Ensure every requested username gets a default entry if not found in DB
  for (const name of uniqueNames) {
    const key = name.toLowerCase();
    if (!result.has(key)) {
      result.set(key, {
        username: name,
        factionId: null,
        factionColor: null,
        clanId: null,
        clanTag: null,
        clanColor: null,
      });
    }
  }

  return result;
}

export interface PlayerIdentityRef {
  accountId: number;
  characterId?: number | null;
  username: string;
}

export function playerIdentityKey(accountId: number, characterId?: number | null): string {
  return `${accountId}:${characterId ?? 0}`;
}

/**
 * Resolve identities for authored content. The stored character wins; legacy rows
 * without one use a deterministic highest-level/lowest-slot character fallback.
 */
export async function resolvePlayerIdentitiesByRefs(
  refs: PlayerIdentityRef[]
): Promise<Map<string, ResolvedPlayerIdentity>> {
  const result = new Map<string, ResolvedPlayerIdentity>();
  const validRefs = refs.filter((ref) => Number.isInteger(ref.accountId) && ref.accountId > 0);
  const accountIds = [...new Set(validRefs.map((ref) => ref.accountId))];
  if (accountIds.length === 0) return result;

  const rows = await dbQuery<IdentityDbRow>(
    `SELECT
       a.id AS account_id, a.username,
       c.id AS character_id, c.level AS character_level, c.slot AS character_slot,
       c.firstname, c.lastname, c.metadata,
       ${factionIdSql()} AS job,
       COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction_grade')) AS UNSIGNED), 0) AS faction_rank,
       cl.id AS clan_id, cl.name AS clan_name, cl.tag AS clan_tag,
       cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style,
       cm.rank AS clan_rank
     FROM accounts a
     LEFT JOIN players p ON p.account_id = a.id
     LEFT JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     WHERE a.id IN (${accountIds.map(() => "?").join(",")})
     ORDER BY a.id ASC, c.level DESC, c.slot ASC, c.id ASC`,
    accountIds
  );

  const byAccount = new Map<number, IdentityDbRow[]>();
  for (const row of rows) {
    const list = byAccount.get(Number(row.account_id)) ?? [];
    list.push(row);
    byAccount.set(Number(row.account_id), list);
  }

  for (const ref of validRefs) {
    const candidates = byAccount.get(ref.accountId) ?? [];
    const row = (ref.characterId
      ? candidates.find((candidate) => Number(candidate.character_id) === Number(ref.characterId))
      : undefined) ?? candidates[0];
    const key = playerIdentityKey(ref.accountId, ref.characterId);
    if (!row) {
      result.set(key, { username: ref.username, factionId: null, factionColor: null, clanId: null, clanTag: null, clanColor: null });
      continue;
    }

    let skin: string | null = null;
    try {
      const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      skin = metadata?.skin ? String(metadata.skin) : null;
    } catch {}
    const factionId = row.job && CANONICAL_FACTIONS[row.job.toLowerCase()] ? row.job.toLowerCase() : null;
    result.set(key, {
      accountId: Number(row.account_id),
      characterId: row.character_id ? Number(row.character_id) : null,
      username: row.username || ref.username,
      characterName: row.firstname ? `${row.firstname} ${row.lastname || ""}`.trim() : null,
      skin,
      factionId,
      factionColor: getFactionColor(factionId),
      factionRank: row.faction_rank == null ? null : Number(row.faction_rank),
      clanId: row.clan_id ? Number(row.clan_id) : null,
      clanName: row.clan_name || null,
      clanRank: row.clan_rank || null,
      clanTag: row.clan_tag || null,
      clanColor: row.clan_tag_color || null,
      clanTagStyle: row.clan_tag_style || null,
    });
  }
  return result;
}

/**
 * Resolves a single player identity by username.
 */
export async function resolvePlayerIdentity(
  username: string
): Promise<ResolvedPlayerIdentity> {
  const map = await resolvePlayerIdentities([username]);
  return (
    map.get(username.toLowerCase()) || {
      username,
      factionId: null,
      factionColor: null,
      clanId: null,
      clanTag: null,
      clanColor: null,
    }
  );
}
