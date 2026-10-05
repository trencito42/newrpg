import { dbQuery } from "./db";
import { CANONICAL_FACTIONS, getFactionColor } from "./factions";
import { RowDataPacket } from "mysql2";
import { factionIdSql } from "./faction-sql";

export interface ResolvedPlayerIdentity {
  username: string;
  characterName?: string | null;
  skin?: string | null;
  factionId: string | null;
  factionColor: string | null;
  factionLabel?: string | null;
  factionGrade?: number | null;
  clanId: number | null;
  clanTag: string | null;
  clanColor: string | null;
  clanTagStyle?: string | null;
  clanName?: string | null;
}

interface IdentityDbRow extends RowDataPacket {
  username: string;
  firstname: string | null;
  lastname: string | null;
  metadata: string | Record<string, any> | null;
  job: string | null;
  clan_id: number | null;
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
      a.username,
      c.firstname,
      c.lastname,
      c.metadata,
      ${factionIdSql()} AS job,
      cl.id as clan_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
    FROM accounts a
    LEFT JOIN players p ON p.account_id = a.id
    LEFT JOIN characters c ON c.id = (
      SELECT c2.id FROM characters c2
      WHERE c2.player_id = p.id
      ORDER BY c2.id DESC
      LIMIT 1
    )
    LEFT JOIN clan_members cm ON cm.character_id = c.id
    LEFT JOIN clans cl ON cl.id = cm.clan_id
    WHERE a.username IN (${placeholders})
  `;

  try {
    const rows = await dbQuery<IdentityDbRow>(query, uniqueNames);
    for (const row of rows) {
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

      result.set(row.username.toLowerCase(), {
        username: row.username,
        characterName,
        skin,
        factionId,
        factionColor,
        clanId: row.clan_id ? Number(row.clan_id) : null,
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
