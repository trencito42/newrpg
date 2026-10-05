import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatNumber, formatDate } from "@/lib/i18n";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { getFactionLabel, isFaction } from "@/lib/factions";
import { factionIdSql } from "@/lib/faction-sql";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Players", description: "Browse public RACKET RPG player profiles, characters and achievements.", path: "/players" });

interface PlayerListRow extends RowDataPacket {
  id: number;
  username: string;
  level: number;
  respect_points: number;
  paydays_received: number;
  job: string;
  faction_id: string | null;
  last_played: string | null;
  metadata: string | Record<string, any> | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export default async function PlayersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const locale = await getViewerLocale();

  const q = params.q?.trim() || "";
  const page = Math.max(1, Number(params.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  let whereClause = "";
  const queryParams: any[] = [];

  if (q.length > 0) {
    whereClause = "WHERE a.username LIKE ?";
    const pattern = `%${q}%`;
    queryParams.push(pattern);
  }

  // Count total matching
  const countRow = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total 
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
     ${whereClause}`,
    queryParams
  );
  const totalCount = countRow?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Fetch paginated players with clan information
  const players = await dbQuery<PlayerListRow>(
    `SELECT 
       a.username, c.id, c.level, c.respect_points, c.paydays_received, c.job,
       c.metadata,
       ${factionIdSql()} AS faction_id, c.last_played,
       cl.tag as clan_tag, cl.tag_color as clan_tag_color, cl.tag_style as clan_tag_style
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     ${whereClause}
     ORDER BY c.level DESC, c.respect_points DESC, a.id ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  return (
    <div className="space-y-4">
      {/* Top Search & Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "players.directory_title")}
          </h1>
        </div>

        <form method="GET" className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#8F8B83] pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t(locale, "players.search_hint")}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-100 border border-surface-border rounded text-[#F2EFE8] placeholder-[#8F8B83] focus:outline-none focus:border-surface-borderLight transition-colors"
          />
        </form>
      </div>

      {/* Players Table */}
      <div className="rounded-xl bg-surface-100 overflow-hidden">
        <div className="p-2.5 px-3 flex items-center justify-between text-xs text-[#99958E]">
          <span>{t(locale, "players.found_count", { count: totalCount })}</span>
          <span className="font-mono text-[#8F8B83]">
            {t(locale, "common.page")} {page} {t(locale, "common.of")} {totalPages || 1}
          </span>
        </div>

        <div className="responsive-table-wrapper">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-semibold text-[#8F8B83] bg-surface-200/50">
              <tr>
                <th className="py-2.5 px-3">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</th>
                <th className="py-2.5 px-3">{t(locale, "common.level")}</th>
                <th className="py-2.5 px-3">{t(locale, "players.faction")}</th>
                <th className="py-2.5 px-3">{t(locale, "interface.job")}</th>
                <th className="py-2.5 px-3">{t(locale, "players.hours_played")}</th>
                <th className="py-2.5 px-3 text-right">{t(locale, "interface.last_seen")}</th>
              </tr>
            </thead>
            <tbody className="text-[#B4AFA4]">
              {players.length > 0 ? (
                players.map((p) => {
                  const hasFaction = isFaction(p.faction_id);
                  const factionLabel = hasFaction ? getFactionLabel(p.faction_id) : "-";
                  const civilianJob = p.job;

                  let skin: string | null = null;
                  if (p.metadata) {
                    try {
                      const meta = typeof p.metadata === "string" ? JSON.parse(p.metadata) : p.metadata;
                      if (meta && meta.skin) skin = String(meta.skin);
                    } catch {}
                  }

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-surface-200/40 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-surface-200 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                            <GTAImage
                              src={getPedAvatarUrl(skin)}
                              alt={p.username}
                              fallbackText={p.username.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                          <PlayerIdentity
                            username={p.username}
                            factionId={p.faction_id}
                            clanTag={p.clan_tag}
                            clanColor={p.clan_tag_color}
                            clanTagStyle={p.clan_tag_style}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-[#F2EFE8]">
                        {p.level}
                      </td>
                      <td className="py-2.5 px-3">
                        {hasFaction ? (
                          <span className="font-medium text-[#F2EFE8]">
                            {factionLabel}
                          </span>
                        ) : (
                          <span className="text-[#8F8B83]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="capitalize">{civilianJob}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {p.paydays_received}h
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#8F8B83]">
                        {p.last_played ? formatDate(p.last_played, locale) : t(locale, "interface.never")}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-[#8F8B83]"
                  >
                    {t(locale, "players.no_players_found")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-2.5 px-3 border-t border-surface-border flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1">
              {page > 1 ? (
                <Link
                  href={`/players?q=${encodeURIComponent(q)}&page=${page - 1}`}
                  className="p-1 px-2 border border-surface-border rounded bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] flex items-center space-x-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t(locale, "common.previous")}</span>
                </Link>
              ) : (
                <span className="p-1 px-2 border border-surface-border/40 rounded text-[#8F8B83] flex items-center space-x-1 cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t(locale, "common.previous")}</span>
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={`/players?q=${encodeURIComponent(q)}&page=${page + 1}`}
                  className="p-1 px-2 border border-surface-border rounded bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] flex items-center space-x-1 transition-colors"
                >
                  <span>{t(locale, "common.next")}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="p-1 px-2 border border-surface-border/40 rounded text-[#8F8B83] flex items-center space-x-1 cursor-not-allowed">
                  <span>{t(locale, "common.next")}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
