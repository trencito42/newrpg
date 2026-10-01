import Link from "next/link";
import {
  Users,
  Shield,
  Map,
  Radio,
  ExternalLink,
  Vote,
} from "lucide-react";
import { getViewerLocale } from "@/lib/auth";
import { getServerStatus, getAggregatedServerStats } from "@/lib/bridge";
import { t, formatNumber, formatCurrency, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { panelBrand } from "@/lib/brand";
import { PlayerName } from "@/components/ui/PlayerName";
import { isFaction } from "@/lib/factions";

interface PollRow extends RowDataPacket {
  id: number;
  title_en: string;
  title_ro: string;
  description_en: string | null;
  description_ro: string | null;
  ends_at: string;
  total_votes: number;
}

interface PollOptRow extends RowDataPacket {
  id: number;
  label_en: string;
  label_ro: string;
  votes_count: number;
}

interface RecentSanctionRow extends RowDataPacket {
  id: number;
  action: string;
  admin_name: string;
  target_name: string;
  target_job: string | null;
  reason: string;
  duration_min: number | null;
  created_at: string;
}

export default async function HomePage() {
  const [locale, serverStatus, stats] = await Promise.all([
    getViewerLocale(),
    getServerStatus(),
    getAggregatedServerStats(),
  ]);

  // Load featured active poll
  const featuredPoll = await dbQuerySingle<PollRow>(
    `SELECT p.*, (SELECT COUNT(*) FROM panel_poll_votes WHERE poll_id = p.id) AS total_votes
     FROM panel_polls p
     WHERE p.status = 'active' AND p.ends_at > NOW()
     ORDER BY p.id DESC
     LIMIT 1`
  );

  let pollOptions: PollOptRow[] = [];
  if (featuredPoll) {
    pollOptions = await dbQuery<PollOptRow>(
      `SELECT id, label_en, label_ro, votes_count
       FROM panel_poll_options
       WHERE poll_id = ?
       ORDER BY sort_order ASC`,
      [featuredPoll.id]
    );
  }

  // Load recent sanctions
  const recentSanctions = await dbQuery<RecentSanctionRow>(
    `SELECT s.id, s.action, s.reason, s.duration_min, s.created_at,
            a.username AS admin_name,
            CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS target_name,
            c.job AS target_job
     FROM admin_sanctions s
     JOIN accounts a ON a.id = s.admin_account_id
     LEFT JOIN characters c ON c.id = s.target_character_id
     ORDER BY s.id DESC
     LIMIT 8`
  );

  return (
    <div className="space-y-5">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {panelBrand.name}
          </h1>
          <div className="flex items-center space-x-1.5 text-xs text-[#6f6f74]">
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus.online ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-[#a5a5a8]">
              {serverStatus.online ? t(locale, "common.online") : t(locale, "common.offline")}
            </span>
            <span>•</span>
            <span className="font-mono text-[#f1f1f1]">
              {serverStatus.playerCount} / {serverStatus.maxPlayers}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {panelBrand.connectAddress && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-surface-100 border border-surface-border font-mono text-[#a5a5a8]">
              <Radio className="w-3 h-3 text-[#6f6f74]" />
              <span>{panelBrand.connectAddress}</span>
            </div>
          )}
          {panelBrand.discordUrl && (
            <a
              href={panelBrand.discordUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-100 hover:bg-surface-200 border border-surface-border text-[#f1f1f1] transition-colors"
            >
              <span>{t(locale, "home.join_discord")}</span>
              <ExternalLink className="w-3 h-3 text-[#6f6f74]" />
            </a>
          )}
        </div>
      </div>

      {/* Flat Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">
            {t(locale, "home.players_online")}
          </span>
          <span className="text-lg font-bold text-[#f1f1f1] font-mono mt-0.5 block">
            {serverStatus.playerCount} <span className="text-xs text-[#6f6f74] font-normal">/ {serverStatus.maxPlayers}</span>
          </span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">
            {t(locale, "home.registered_accounts")}
          </span>
          <span className="text-lg font-bold text-[#f1f1f1] font-mono mt-0.5 block">
            {formatNumber(stats.totalAccounts, locale)}
          </span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">
            {t(locale, "home.active_factions")}
          </span>
          <span className="text-lg font-bold text-[#f1f1f1] font-mono mt-0.5 block">
            10
          </span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">
            {t(locale, "home.controlled_turfs")}
          </span>
          <span className="text-lg font-bold text-[#f1f1f1] font-mono mt-0.5 block">
            {stats.controlledTurfs} <span className="text-xs text-[#6f6f74] font-normal">/ 18</span>
          </span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Poll (if active) + Recent Sanctions */}
        <div className={featuredPoll ? "lg:col-span-2 space-y-5" : "lg:col-span-2 space-y-5"}>
          {featuredPoll && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#f1f1f1]">
                    {locale === "ro" ? "Sondaj" : "Current Poll"}
                  </span>
                  <PollCountdown targetDate={featuredPoll.ends_at} locale={locale} />
                </div>
                <CardTitle className="mt-1 text-sm">
                  {locale === "ro" ? featuredPoll.title_ro : featuredPoll.title_en}
                </CardTitle>
                {featuredPoll.description_en && (
                  <p className="text-xs text-[#8a8a90] mt-0.5">
                    {locale === "ro" ? featuredPoll.description_ro : featuredPoll.description_en}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-2.5">
                {pollOptions.map((opt) => {
                  const total = featuredPoll.total_votes || 1;
                  const pct = Math.round((opt.votes_count / total) * 100);
                  return (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a5a5a8]">
                          {locale === "ro" ? opt.label_ro : opt.label_en}
                        </span>
                        <span className="font-mono text-[#6f6f74]">
                          {opt.votes_count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface-200 rounded h-1.5 overflow-hidden">
                        <div
                          className="bg-[#6f6f74] h-full rounded transition-[width] duration-150"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                  <span className="text-xs text-[#6f6f74] font-mono">
                    {t(locale, "polls.total_votes", { count: featuredPoll.total_votes })}
                  </span>
                  <Link
                    href={`/polls/${featuredPoll.id}`}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-semibold rounded text-xs transition-colors"
                  >
                    <Vote className="w-3 h-3" />
                    <span>{t(locale, "home.vote_now")}</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Sanctions Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
                {t(locale, "home.recent_sanctions")}
              </h2>
            </div>

            {recentSanctions.length > 0 ? (
              <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                    <tr>
                      <th className="py-2 px-3">Player</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3">Staff</th>
                      <th className="py-2 px-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                    {recentSanctions.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-200/40">
                        <td className="py-2 px-3">
                          {s.target_name ? (
                            <PlayerName name={s.target_name} factionId={s.target_job} />
                          ) : (
                            <span className="text-[#6f6f74]">Account</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="capitalize font-medium text-[#f1f1f1]">{s.action}</span>
                          {s.duration_min ? ` (${s.duration_min}m)` : ""}
                        </td>
                        <td className="py-2 px-3 max-w-[200px] truncate text-[#6f6f74]">
                          {s.reason}
                        </td>
                        <td className="py-2 px-3 text-[#6f6f74]">
                          {s.admin_name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-[#6f6f74]">
                          {formatDate(s.created_at, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#6f6f74] p-3 border border-surface-border rounded bg-surface-100">
                No recent sanctions.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Server Economy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              Economy
            </h2>
          </div>

          <div className="border border-surface-border rounded bg-surface-100 p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
              <span className="text-[#8a8a90]">Money in circulation</span>
              <span className="font-mono font-semibold text-[#f1f1f1]">
                {formatCurrency(stats.totalEconomyMoney)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
              <span className="text-[#8a8a90]">Vehicles</span>
              <span className="font-mono text-[#a5a5a8]">
                {formatNumber(stats.totalVehicles, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
              <span className="text-[#8a8a90]">Properties</span>
              <span className="font-mono text-[#a5a5a8]">
                {formatNumber(stats.totalProperties, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[#8a8a90]">Clans</span>
              <span className="font-mono text-[#a5a5a8]">
                {formatNumber(stats.totalClans, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
