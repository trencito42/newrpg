import { dbQuery } from "./db";
import { CANONICAL_FACTIONS, getFactionColor } from "./factions";
import { RowDataPacket } from "mysql2";

export interface ResolvedPlayerIdentity {
  username: string;
  factionId: string | null;
  factionColor: string | null;
  clanId: number | null;
  clanTag: string | null;
  clanColor: string | null;
  clanTagStyle?: string | null;
}

interface IdentityDbRow extends RowDataPacket {
  username: string;
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
      c.job,
      cl.id as clan_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
    FROM accounts a
    LEFT JOIN players p ON p.account_id = a.id
    LEFT JOIN characters c ON c.player_id = p.id
    LEFT JOIN clan_members cm ON cm.character_id = c.id
    LEFT JOIN clans cl ON cl.id = cm.clan_id
    WHERE a.username IN (${placeholders})
  `;

  try {
    const rows = await dbQuery<IdentityDbRow>(query, uniqueNames);
    for (const row of rows) {
      const factionId = row.job && CANONICAL_FACTIONS[row.job.toLowerCase()] ? row.job.toLowerCase() : null;
      const factionColor = getFactionColor(factionId);
      result.set(row.username.toLowerCase(), {
        username: row.username,
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
