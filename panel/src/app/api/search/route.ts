import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { factionIdSql } from "@/lib/faction-sql";
import { CANONICAL_FACTIONS } from "@/lib/factions";

interface SearchPlayerRow extends RowDataPacket {
  id: number;
  username: string;
  firstname: string | null;
  lastname: string | null;
  metadata: string | Record<string, any> | null;
  level: number;
  job: string;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

interface SearchClanRow extends RowDataPacket {
  id: number;
  name: string;
  tag: string;
  tag_color: string | null;
}

interface SearchUpdateRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  category: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;

  try {
    const [players, clans, updates] = await Promise.all([
      dbQuery<SearchPlayerRow>(
        `SELECT c.id, a.username, c.firstname, c.lastname, c.metadata, c.level, ${factionIdSql()} AS job,
                cl.tag AS clan_tag, cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style
         FROM accounts a
         JOIN players p ON p.account_id = a.id
         JOIN characters c ON c.player_id = p.id
         LEFT JOIN clan_members cm ON cm.character_id = c.id
         LEFT JOIN clans cl ON cl.id = cm.clan_id
         WHERE a.username LIKE ? OR c.firstname LIKE ? OR c.lastname LIKE ?
         ORDER BY (a.username LIKE ?) DESC, c.level DESC
         LIMIT 12`,
        [pattern, pattern, pattern, `${q}%`]
      ),
      dbQuery<SearchClanRow>(
        "SELECT id, name, tag, tag_color FROM clans WHERE name LIKE ? OR tag LIKE ? LIMIT 4",
        [pattern, pattern]
      ),
      dbQuery<SearchUpdateRow>(
        "SELECT id, slug, title, category FROM panel_updates WHERE title LIKE ? OR summary LIKE ? LIMIT 4",
        [pattern, pattern]
      ),
    ]);

    // Match factions locally
    const matchingFactions = Object.entries(CANONICAL_FACTIONS)
      .filter(([id, f]) => id.toLowerCase().includes(q.toLowerCase()) || f.label.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 3)
      .map(([id, f]) => ({
        type: "faction" as const,
        id,
        href: `/factions/${id}`,
        title: f.label,
        subtitle: f.type === "legal" ? "Departament / Facțiune Pașnică" : "Organizație / Mafie",
      }));

    const playerResults = players.map((r) => {
      let skin: string | null = null;
      if (r.metadata) {
        try {
          const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
          if (meta && meta.skin) skin = String(meta.skin);
        } catch {}
      }
      const charName = r.firstname ? `${r.firstname} ${r.lastname || ""}`.trim() : null;

      return {
        type: "player" as const,
        id: r.id,
        slug: r.username,
        name: r.username,
        characterName: charName,
        skin,
        href: `/players/${encodeURIComponent(r.username)}`,
        level: Number(r.level) || 1,
        job: r.job || "Civil",
        clanTag: r.clan_tag,
        clanColor: r.clan_tag_color,
        clanTagStyle: r.clan_tag_style,
      };
    });

    const clanResults = clans.map((c) => ({
      type: "clan" as const,
      id: c.id,
      href: `/clans/${c.id}`,
      title: `[${c.tag}] ${c.name}`,
      subtitle: `Clan Oficial #${c.id}`,
      color: c.tag_color || "#F59E0B",
    }));

    const updateResults = updates.map((u) => ({
      type: "update" as const,
      id: u.id,
      href: `/updates/${encodeURIComponent(u.slug)}`,
      title: u.title,
      subtitle: `Noutate • ${u.category.toUpperCase()}`,
    }));

    return NextResponse.json({
      results: playerResults,
      factions: matchingFactions,
      clans: clanResults,
      updates: updateResults,
      allResults: [
        ...playerResults,
        ...matchingFactions,
        ...clanResults,
        ...updateResults,
      ],
    });
  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json({ results: [] });
  }
}
