import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatNumber, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Search, User, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { RowDataPacket } from "mysql2";

interface PlayerListRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
  level: number;
  respect_points: number;
  job: string;
  last_played: string | null;
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
  const limit = 15;
  const offset = (page - 1) * limit;

  let whereClause = "";
  const queryParams: any[] = [];

  if (q.length > 0) {
    whereClause = "WHERE c.firstname LIKE ? OR c.lastname LIKE ? OR CONCAT(c.firstname, ' ', c.lastname) LIKE ?";
    const pattern = `%${q}%`;
    queryParams.push(pattern, pattern, pattern);
  }

  // Count total matching
  const countRow = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total FROM characters c ${whereClause}`,
    queryParams
  );
  const totalCount = countRow?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Fetch paginated players
  const players = await dbQuery<PlayerListRow>(
    `SELECT c.id, c.firstname, c.lastname, c.level, c.respect_points, c.job, c.last_played
     FROM characters c
     ${whereClause}
     ORDER BY c.level DESC, c.respect_points DESC, c.id ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {t(locale, "players.directory_title")}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {t(locale, "players.directory_subtitle")}
          </p>
        </div>

        {/* Search input form */}
        <form method="GET" className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t(locale, "players.search_hint")}
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-100 border border-surface-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand"
          />
        </form>
      </div>

      {/* Players Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-300">
              {t(locale, "players.found_count", { count: totalCount })}
            </span>
            <span className="text-gray-500 font-mono">
              {t(locale, "common.page")} {page} {t(locale, "common.of")} {totalPages || 1}
            </span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
                <tr>
                  <th className="pb-3">Player / Citizen</th>
                  <th className="pb-3">Level</th>
                  <th className="pb-3">Respect Points</th>
                  <th className="pb-3">Career / Job</th>
                  <th className="pb-3 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-gray-300">
                {players.length > 0 ? (
                  players.map((p) => {
                    const fullName = `${p.firstname} ${p.lastname || ""}`.trim();
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-surface-100/50 transition-colors group cursor-pointer"
                      >
                        <td className="py-3">
                          <Link
                            href={`/players/${p.id}`}
                            className="flex items-center space-x-2.5 font-bold text-white group-hover:text-brand transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-surface-50 border border-surface-border flex items-center justify-center text-brand">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span>{fullName}</span>
                          </Link>
                        </td>
                        <td className="py-3 font-mono font-bold text-amber-400">
                          {p.level}
                        </td>
                        <td className="py-3 font-mono text-gray-400">
                          {formatNumber(p.respect_points, locale)} RP
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className="capitalize">
                            {p.job}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-mono text-gray-500">
                          {p.last_played ? formatDate(p.last_played, locale, false) : "Never"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      {t(locale, "players.no_results")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-surface-border text-xs">
              <Link
                href={`/players?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-surface-border ${
                  page <= 1
                    ? "opacity-40 pointer-events-none text-gray-600"
                    : "hover:bg-surface-100 text-gray-300"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t(locale, "common.prev")}</span>
              </Link>

              <span className="text-gray-400 font-mono">
                {page} / {totalPages}
              </span>

              <Link
                href={`/players?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-surface-border ${
                  page >= totalPages
                    ? "opacity-40 pointer-events-none text-gray-600"
                    : "hover:bg-surface-100 text-gray-300"
                }`}
              >
                <span>{t(locale, "common.next")}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
