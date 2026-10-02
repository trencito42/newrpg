import Link from "next/link";
import { Radio, ExternalLink, Vote } from "lucide-react";
import { getViewerLocale } from "@/lib/auth";
import { getServerStatus, getAggregatedServerStats } from "@/lib/bridge";
import { t, formatNumber, formatCurrency } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { PollCountdown } from "@/components/polls/PollCountdown";
import { panelBrand } from "@/lib/brand";

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

  return (
    <div className="space-y-5">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {panelBrand.name}
          </h1>
          <div className="flex items-center space-x-1.5 text-xs text-[#8F8B83]">
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus.online ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-[#B4AFA4]">
              {serverStatus.online ? t(locale, "common.online") : t(locale, "common.offline")}
            </span>
            <span>•</span>
            <span className="font-mono text-[#F2EFE8]">
              {serverStatus.playerCount} / {serverStatus.maxPlayers}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {panelBrand.connectAddress && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-surface-100 border border-surface-border font-mono text-[#B4AFA4]">
              <Radio className="w-3 h-3 text-[#8F8B83]" />
              <span>{panelBrand.connectAddress}</span>
            </div>
          )}
          {panelBrand.discordUrl && (
            <a
              href={panelBrand.discordUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-100 hover:bg-surface-200 border border-surface-border text-[#F2EFE8] transition-colors"
            >
              <span>{t(locale, "home.join_discord")}</span>
              <ExternalLink className="w-3 h-3 text-[#8F8B83]" />
            </a>
          )}
        </div>
      </div>

      {/* Server counts, without fabricated totals or decorative cards. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
        <div>
          <span className="text-xs text-[#8F8B83] block font-medium">
            {t(locale, "home.players_online")}
          </span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">
            {serverStatus.playerCount} <span className="text-xs text-[#8F8B83] font-normal">/ {serverStatus.maxPlayers}</span>
          </span>
        </div>

        <div>
          <span className="text-xs text-[#8F8B83] block font-medium">
            {t(locale, "home.registered_accounts")}
          </span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">
            {formatNumber(stats.totalAccounts, locale)}
          </span>
        </div>

        <div>
          <span className="text-xs text-[#8F8B83] block font-medium">
            {locale === "ro" ? "Personaje" : "Characters"}
          </span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">
            {formatNumber(stats.totalCharacters, locale)}
          </span>
        </div>

        <div>
          <span className="text-xs text-[#8F8B83] block font-medium">
            {t(locale, "home.controlled_turfs")}
          </span>
          <span className="text-lg font-bold text-[#F2EFE8] font-mono mt-0.5 block">
            {stats.controlledTurfs}
          </span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {featuredPoll && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F2EFE8]">
                    {locale === "ro" ? "Sondaj" : "Current Poll"}
                  </span>
                  <PollCountdown targetDate={featuredPoll.ends_at} locale={locale} />
                </div>
                <CardTitle className="mt-1 text-sm">
                  {locale === "ro" ? featuredPoll.title_ro : featuredPoll.title_en}
                </CardTitle>
                {featuredPoll.description_en && (
                  <p className="text-xs text-[#99958E] mt-0.5">
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
                        <span className="text-[#B4AFA4]">
                          {locale === "ro" ? opt.label_ro : opt.label_en}
                        </span>
                        <span className="font-mono text-[#8F8B83]">
                          {opt.votes_count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface-200 rounded h-1.5 overflow-hidden">
                        <div
                          className="bg-[#8F8B83] h-full rounded transition-[width] duration-150"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                  <span className="text-xs text-[#8F8B83] font-mono">
                    {t(locale, "polls.total_votes", { count: featuredPoll.total_votes })}
                  </span>
                  <Link
                    href={`/polls/${featuredPoll.id}`}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-semibold rounded text-xs transition-colors"
                  >
                    <Vote className="w-3 h-3" />
                    <span>{t(locale, "home.vote_now")}</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column: Server Economy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[#F2EFE8] uppercase tracking-wider">
              Economy
            </h2>
          </div>

          <div className="border border-surface-border rounded bg-surface-100 p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
              <span className="text-[#99958E]">Money in circulation</span>
              <span className="font-mono font-semibold text-[#F2EFE8]">
                {formatCurrency(stats.totalEconomyMoney)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
              <span className="text-[#99958E]">Vehicles</span>
              <span className="font-mono text-[#B4AFA4]">
                {formatNumber(stats.totalVehicles, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-surface-border/50">
              <span className="text-[#99958E]">Properties</span>
              <span className="font-mono text-[#B4AFA4]">
                {formatNumber(stats.totalProperties, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[#99958E]">Clans</span>
              <span className="font-mono text-[#B4AFA4]">
                {formatNumber(stats.totalClans, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
