import Link from "next/link";
import {
  Users,
  Shield,
  Map,
  Car,
  Home as HomeIcon,
  Vote,
  Radio,
  ExternalLink,
  ChevronRight,
  Flame,
  Award,
} from "lucide-react";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { getServerStatus, getAggregatedServerStats } from "@/lib/bridge";
import { t, formatNumber, formatCurrency, formatDate } from "@/lib/i18n";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { PollCountdown } from "@/components/polls/PollCountdown";

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

interface SanctionRow extends RowDataPacket {
  id: number;
  action: "warn" | "kick" | "tempban" | "ban" | "unban" | "jail";
  target_name: string;
  admin_name: string;
  reason: string;
  duration_min: number | null;
  created_at: string;
}

export default async function HomePage() {
  const [locale, session, serverStatus, stats] = await Promise.all([
    getViewerLocale(),
    getCurrentSession(),
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

  // Load recent real server sanctions
  const recentSanctions = await dbQuery<SanctionRow>(
    `SELECT id, action, target_name, admin_name, reason, duration_min, created_at
     FROM admin_sanctions
     ORDER BY id DESC
     LIMIT 6`
  );

  const sanctionBadgeVariant = (action: string) => {
    switch (action) {
      case "ban":
      case "tempban":
        return "danger";
      case "warn":
        return "warning";
      case "kick":
        return "amber";
      case "jail":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Card */}
      <div className="relative rounded-2xl bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200 border border-surface-border p-6 sm:p-8 overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-brand/5 blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <Badge variant="brand" className="mb-1">
            {t(locale, "home.badge")}
          </Badge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            {t(locale, "home.title")}
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            {t(locale, "home.subtitle")}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-50 border border-surface-border text-xs font-mono text-gray-300">
              <Radio className="w-3.5 h-3.5 text-brand animate-pulse" />
              <span>{process.env.NEXT_PUBLIC_SERVER_IP || "play.blipmade.com:30120"}</span>
            </div>
            <a
              href={process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/sunset"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-border hover:bg-surface-borderLight text-xs font-medium text-gray-200 transition-colors"
            >
              <span>{t(locale, "home.join_discord")}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Real Server Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title={t(locale, "home.players_online")}
          value={`${serverStatus.playerCount} / ${serverStatus.maxPlayers}`}
          subtext={serverStatus.online ? t(locale, "common.online") : t(locale, "common.offline")}
          icon={Users}
          variant="emerald"
        />
        <StatCard
          title={t(locale, "home.registered_accounts")}
          value={formatNumber(stats.totalAccounts, locale)}
          subtext={`${formatNumber(stats.totalCharacters, locale)} Characters`}
          icon={Award}
          variant="brand"
        />
        <StatCard
          title={t(locale, "home.active_factions")}
          value="10"
          subtext="Law, EMS & Syndicates"
          icon={Shield}
          variant="sky"
        />
        <StatCard
          title={t(locale, "home.controlled_turfs")}
          value={`${stats.controlledTurfs} / 18`}
          subtext="Clan Territories"
          icon={Map}
          variant="amber"
        />
      </div>

      {/* Featured Poll & Server Economy Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Featured Poll (2 cols) */}
        <div className="lg:col-span-2">
          {featuredPoll ? (
            <Card className="h-full flex flex-col justify-between">
              <div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="brand">{t(locale, "home.featured_poll")}</Badge>
                    <PollCountdown targetDate={featuredPoll.ends_at} locale={locale} />
                  </div>
                  <CardTitle className="mt-2 text-lg">
                    {locale === "ro" ? featuredPoll.title_ro : featuredPoll.title_en}
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-1">
                    {locale === "ro"
                      ? featuredPoll.description_ro
                      : featuredPoll.description_en}
                  </p>
                </CardHeader>

                <CardContent className="space-y-3">
                  {pollOptions.map((opt) => {
                    const total = featuredPoll.total_votes || 1;
                    const pct = Math.round((opt.votes_count / total) * 100);
                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-gray-200">
                            {locale === "ro" ? opt.label_ro : opt.label_en}
                          </span>
                          <span className="font-mono text-gray-400">
                            {opt.votes_count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-surface-100 rounded-full h-2 border border-surface-border overflow-hidden">
                          <div
                            className="bg-brand h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </div>

              <div className="pt-4 mt-4 border-t border-surface-border flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono">
                  {t(locale, "polls.total_votes", { count: featuredPoll.total_votes })}
                </span>
                <Link
                  href={`/polls/${featuredPoll.id}`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brand hover:bg-brand-600 text-gray-950 font-bold rounded-lg text-xs transition-colors"
                >
                  <Vote className="w-3.5 h-3.5" />
                  <span>{t(locale, "home.vote_now")}</span>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center p-8 text-center text-gray-400 text-sm">
              <div>
                <Vote className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p>No active featured polls at this moment.</p>
              </div>
            </Card>
          )}
        </div>

        {/* Server Highlights & Economy (1 col) */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Economy & Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-1 border-b border-surface-border/50 text-xs">
                <span className="text-gray-400">Total Money in Play</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(stats.totalEconomyMoney)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-surface-border/50 text-xs">
                <span className="text-gray-400">Registered Vehicles</span>
                <span className="font-mono font-semibold text-gray-200">
                  {formatNumber(stats.totalVehicles, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-surface-border/50 text-xs">
                <span className="text-gray-400">Purchasable Properties</span>
                <span className="font-mono font-semibold text-gray-200">
                  {formatNumber(stats.totalProperties, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-gray-400">Registered Clans</span>
                <span className="font-mono font-semibold text-gray-200">
                  {formatNumber(stats.totalClans, locale)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link
                href="/factions"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 text-xs text-gray-300 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-brand" />
                  <span>View 10 Faction Rosters</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </Link>
              <Link
                href="/turfs"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 text-xs text-gray-300 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Map className="w-4 h-4 text-amber-400" />
                  <span>Interactive Turf Map</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </Link>
              <Link
                href="/staff"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 text-xs text-gray-300 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-sky-400" />
                  <span>Admins & Helpers Hierarchy</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Sanctions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t(locale, "home.recent_sanctions")}</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time server disciplinary log from sunset_admin.
              </p>
            </div>
            <Link
              href="/players"
              className="text-xs text-brand hover:underline font-medium"
            >
              {t(locale, "common.view_all")}
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
                <tr>
                  <th className="pb-2.5">Player</th>
                  <th className="pb-2.5">Action</th>
                  <th className="pb-2.5">Reason</th>
                  <th className="pb-2.5">Staff</th>
                  <th className="pb-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-gray-300">
                {recentSanctions.length > 0 ? (
                  recentSanctions.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-100/50 transition-colors">
                      <td className="py-2.5 font-medium text-white">{s.target_name}</td>
                      <td className="py-2.5">
                        <Badge variant={sanctionBadgeVariant(s.action) as any}>
                          {s.action.toUpperCase()}
                          {s.duration_min ? ` (${s.duration_min}m)` : ""}
                        </Badge>
                      </td>
                      <td className="py-2.5 max-w-xs truncate text-gray-400">{s.reason}</td>
                      <td className="py-2.5 font-mono text-gray-300">{s.admin_name}</td>
                      <td className="py-2.5 text-right font-mono text-gray-400">
                        {formatDate(s.created_at, locale)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">
                      No recent sanctions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
