import { NextRequest, NextResponse } from "next/server";
import { dbQuerySingle } from "@/lib/db";
import { CANONICAL_FACTIONS, getFactionColor, getFactionLabel } from "@/lib/factions";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { RowDataPacket } from "mysql2";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";

const CLAN_RANKS: Record<number, string> = {
  1: "Recruit",
  2: "Member",
  3: "Veteran",
  4: "Senior",
  5: "Officer",
  6: "Co-Leader",
  7: "Leader",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const cleanUsername = decodeURIComponent(username).trim();

    if (!cleanUsername) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const player = await dbQuerySingle<RowDataPacket>(
      `SELECT 
        a.id as account_id,
        a.username,
        a.admin_level,
        a.helper_level,
        c.id as character_id,
        c.level,
        c.metadata,
        c.paydays_received as hours,
        ${factionIdSql()} as faction_id,
        ${factionGradeSql()} as faction_rank,
        c.last_played,
        fl.id as is_faction_leader,
        cl.id as clan_id,
        cl.name as clan_name,
        cl.tag as clan_tag,
        cl.tag_color as clan_tag_color,
        cl.tag_style as clan_tag_style,
        cm.rank as clan_rank,
        (cl.owner_character_id = c.id) as is_clan_owner,
        (p.last_seen > NOW() - INTERVAL 3 MINUTE OR c.last_played > NOW() - INTERVAL 3 MINUTE) as is_online
       FROM accounts a
       JOIN players p ON p.account_id = a.id
       JOIN characters c ON c.player_id = p.id
       LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ${factionIdSql()}
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE LOWER(a.username) = LOWER(?) LIMIT 1`,
      [cleanUsername]
    );

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Resolve derived role badges
    const roles: { label: string; type: "admin" | "helper" | "faction" | "clan"; color?: string }[] = [];

    if (player.admin_level > 0) {
      roles.push({
        label: `ADMIN ${player.admin_level}`,
        type: "admin",
        color: "#ef4444",
      });
    }

    if (player.helper_level > 0) {
      roles.push({
        label: `HELPER ${player.helper_level}`,
        type: "helper",
        color: "#3b82f6",
      });
    }

    if (player.is_faction_leader || player.faction_rank >= 7) {
      roles.push({
        label: "FACTION LEADER",
        type: "faction",
        color: getFactionColor(player.faction_id) || "#10b981",
      });
    } else if (player.faction_rank === 6) {
      roles.push({
        label: "CO-LEADER",
        type: "faction",
        color: getFactionColor(player.faction_id) || "#10b981",
      });
    }

    if (player.is_clan_owner || player.clan_rank === 7) {
      roles.push({
        label: "CLAN OWNER",
        type: "clan",
        color: player.clan_tag_color || "#f59e0b",
      });
    } else if (player.clan_rank === 6) {
      roles.push({
        label: "CLAN CO-LEADER",
        type: "clan",
        color: player.clan_tag_color || "#f59e0b",
      });
    }

    const hasFaction = Boolean(player.faction_id && CANONICAL_FACTIONS[player.faction_id]);
    const factionData = hasFaction
      ? {
          id: player.faction_id,
          name: getFactionLabel(player.faction_id),
          color: getFactionColor(player.faction_id),
          rank: player.faction_rank || 1,
        }
      : null;

    const hasClan = Boolean(player.clan_id && player.clan_tag);
    const clanData = hasClan
      ? {
          id: player.clan_id,
          name: player.clan_name,
          tag: player.clan_tag,
          color: player.clan_tag_color || "#f59e0b",
          tagStyle: player.clan_tag_style || "brackets",
          rank: player.clan_rank || 1,
          rankName: CLAN_RANKS[player.clan_rank] || `Rank ${player.clan_rank}`,
        }
      : null;

    let characterSkin: string | null = null;
    if (player.metadata) {
      try {
        const parsed = typeof player.metadata === "string" ? JSON.parse(player.metadata) : player.metadata;
        if (parsed && parsed.skin) characterSkin = String(parsed.skin);
      } catch {}
    }

    const preview = {
      username: player.username,
      avatarUrl: getPedAvatarUrl(characterSkin),
      online: Boolean(player.is_online),
      lastSeen: player.last_played,
      level: player.level || 1,
      playtimeHours: Math.floor(player.hours || 0),
      job: player.faction_id || "Unemployed",
      faction: factionData,
      clan: clanData,
      roles: roles.slice(0, 3), // Maximum 3 primary badges for hover card
    };

    const response = NextResponse.json(preview);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("Player preview error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
