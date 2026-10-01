import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatNumber, formatDate } from "@/lib/i18n";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { getFactionLabel, isFaction } from "@/lib/factions";

interface PlayerListRow extends RowDataPacket {
  id: number;
  username: string;
  level: number;
  respect_points: number;
  paydays_received: number;
  job: string;
  last_played: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
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
       a.username, c.id, c.level, c.respect_points, c.paydays_received, c.job, c.last_played,
       cl.tag as clan_tag, cl.tag_color as clan_tag_color
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {t(locale, "players.directory_title")}
          </h1>
        </div>

        <form method="GET" className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#6f6f74] pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t(locale, "players.search_hint")}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-100 border border-surface-border rounded text-[#f1f1f1] placeholder-[#6f6f74] focus:outline-none focus:border-surface-borderLight transition-colors"
          />
        </form>
      </div>

      {/* Players Table */}
      <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
        <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs text-[#8a8a90]">
          <span>{t(locale, "players.found_count", { count: totalCount })}</span>
          <span className="font-mono text-[#6f6f74]">
            {t(locale, "common.page")} {page} {t(locale, "common.of")} {totalPages || 1}
          </span>
        </div>

        <div className="responsive-table-wrapper">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
              <tr>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3">Level</th>
                <th className="py-2.5 px-3">Faction</th>
                <th className="py-2.5 px-3">Job</th>
                <th className="py-2.5 px-3">Hours</th>
                <th className="py-2.5 px-3 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
              {players.length > 0 ? (
                players.map((p) => {
                  const hasFaction = isFaction(p.job);
                  const factionLabel = hasFaction ? getFactionLabel(p.job) : "-";
                  const civilianJob = hasFaction ? "-" : p.job;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-surface-200/40 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <PlayerIdentity
                          username={p.username}
                          factionId={hasFaction ? p.job : null}
                          clanTag={p.clan_tag}
                          clanColor={p.clan_tag_color}
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-[#f1f1f1]">
                        {p.level}
                      </td>
                      <td className="py-2.5 px-3">
                        {hasFaction ? (
                          <span className="font-medium text-[#f1f1f1]">
                            {factionLabel}
                          </span>
                        ) : (
                          <span className="text-[#6f6f74]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="capitalize">{civilianJob}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {p.paydays_received}h
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#6f6f74]">
                        {p.last_played ? formatDate(p.last_played, locale) : "Never"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-[#6f6f74]"
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
                  className="p-1 px-2 border border-surface-border rounded bg-surface-200 hover:bg-surface-300 text-[#f1f1f1] flex items-center space-x-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t(locale, "common.previous")}</span>
                </Link>
              ) : (
                <span className="p-1 px-2 border border-surface-border/40 rounded text-[#6f6f74] flex items-center space-x-1 cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t(locale, "common.previous")}</span>
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={`/players?q=${encodeURIComponent(q)}&page=${page + 1}`}
                  className="p-1 px-2 border border-surface-border rounded bg-surface-200 hover:bg-surface-300 text-[#f1f1f1] flex items-center space-x-1 transition-colors"
                >
                  <span>{t(locale, "common.next")}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="p-1 px-2 border border-surface-border/40 rounded text-[#6f6f74] flex items-center space-x-1 cursor-not-allowed">
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
