import { query, queryOne, dbQuery } from "@/lib/db";
import { t, formatCurrency, formatNumber, formatDate } from "@/lib/i18n";
import { getViewerLocale } from "@/lib/auth";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { getFactionLabel, getFactionColor } from "@/lib/factions";
import { vehicleDisplayName } from "@/lib/vehicle-names";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { factionIdSql } from "@/lib/faction-sql";
import { RowDataPacket } from "mysql2";
import {
  TrendingUp,
  Users,
  Coins,
  Shield,
  Car,
  Home,
  Briefcase,
  Award,
  Crown,
  Flame,
  Flag,
  Activity,
  Heart
} from "lucide-react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Server statistics", description: "Live RACKET RPG server, economy, player, faction and clan statistics.", path: "/stats" });

export const dynamic = "force-dynamic";

interface RichPlayerRecord extends RowDataPacket {
  id: number;
  name: string;
  level: number;
  cash: number;
  bank: number;
  total_wealth: number;
  job: string | null;
  skin: string | null;
}

interface LevelLeaderRecord extends RowDataPacket {
  id: number;
  name: string;
  level: number;
  hours: number;
  respect_points: number;
  job: string | null;
  skin: string | null;
}

interface VehicleCollectorRecord extends RowDataPacket {
  id: number;
  name: string;
  vehicle_count: number;
  job: string | null;
}

interface JobStatRecord extends RowDataPacket {
  job_id: string;
  workers: number;
  tasks_done: number;
  earned_total: number;
}

interface VehicleModelStat extends RowDataPacket {
  model: string;
  catalog_label: string | null;
  count: number;
}

interface ClanLeaderboardRecord extends RowDataPacket {
  id: number;
  name: string;
  tag: string;
  tag_color: string;
  member_count: number;
  turfs_count: number;
}

export default async function ServerStatsPage() {
  const locale = await getViewerLocale();

  const [
    counts,
    richest,
    topLevels,
    topCollectors,
    jobStats,
    vehicleStats,
    topClans,
  ] = await Promise.all([
    queryOne<{
      total_accounts: number;
      total_characters: number;
      total_cash: number;
      total_bank: number;
      total_vehicles: number;
      total_properties: number;
      total_marriages: number;
      total_clans: number;
    }>(`
      SELECT 
        (SELECT COUNT(*) FROM accounts) as total_accounts,
        (SELECT COUNT(*) FROM characters WHERE firstname NOT IN ('anticheat')) as total_characters,
        (SELECT COALESCE(SUM(cash), 0) FROM characters WHERE firstname NOT IN ('anticheat')) as total_cash,
        (SELECT COALESCE(SUM(bank), 0) FROM characters WHERE firstname NOT IN ('anticheat')) as total_bank,
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM properties) as total_properties,
        (SELECT COUNT(*) FROM marriages WHERE status = 'active') as total_marriages,
        (SELECT COUNT(*) FROM clans) as total_clans
    `),
    query<RichPlayerRecord>(`
      SELECT 
        c.id, 
        a.username as name, 
        c.level, 
        c.cash, 
        c.bank, 
        (c.cash + c.bank) as total_wealth,
        ${factionIdSql()} AS job,
        JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.skin')) as skin
      FROM characters c
      JOIN players p ON p.id = c.player_id
      JOIN accounts a ON a.id = p.account_id
      WHERE a.username NOT IN ('anticheat')
      ORDER BY total_wealth DESC
      LIMIT 10
    `),
    query<LevelLeaderRecord>(`
      SELECT 
        c.id, 
        a.username as name, 
        c.level, 
        c.paydays_received as hours,
        c.respect_points,
        ${factionIdSql()} AS job,
        JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.skin')) as skin
      FROM characters c
      JOIN players p ON p.id = c.player_id
      JOIN accounts a ON a.id = p.account_id
      WHERE a.username NOT IN ('anticheat')
      ORDER BY c.level DESC, c.paydays_received DESC
      LIMIT 10
    `),
    query<VehicleCollectorRecord>(`
      SELECT 
        c.id, 
        a.username as name,
        COUNT(v.id) as vehicle_count,
        ${factionIdSql()} AS job
      FROM characters c
      JOIN players p ON p.id = c.player_id
      JOIN accounts a ON a.id = p.account_id
      JOIN vehicles v ON v.character_id = c.id
      WHERE a.username NOT IN ('anticheat')
      GROUP BY c.id, a.username
      ORDER BY vehicle_count DESC
      LIMIT 5
    `),
    query<JobStatRecord>(`
      SELECT 
        job_id, 
        COUNT(*) as workers, 
        COALESCE(SUM(completed_tasks), 0) as tasks_done, 
        COALESCE(SUM(total_earned), 0) as earned_total
      FROM job_progress
      GROUP BY job_id
      ORDER BY tasks_done DESC, earned_total DESC
    `),
    query<VehicleModelStat>(`
      SELECT v.model, dv.label AS catalog_label, COUNT(*) as count
      FROM vehicles v
      LEFT JOIN dealership_vehicles dv ON LOWER(dv.model) = LOWER(v.model)
      GROUP BY v.model, dv.label
      ORDER BY count DESC
      LIMIT 8
    `),
    query<ClanLeaderboardRecord>(`
      SELECT c.id, c.name, c.tag, c.tag_color,
             (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as member_count,
             (SELECT COUNT(*) FROM turfs WHERE owner_clan_id = c.id) as turfs_count
      FROM clans c
      ORDER BY turfs_count DESC, member_count DESC
      LIMIT 5
    `),
  ]);

  const allNames = [
    ...richest.map((p) => p.name),
    ...topLevels.map((p) => p.name),
    ...topCollectors.map((p) => p.name),
  ];
  const identities = await resolvePlayerIdentities(allNames);
  const totalEconomy = (counts?.total_cash || 0) + (counts?.total_bank || 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "players.statistics")}
        </h1>
        <p className="text-xs text-[#8F8B83] mt-0.5">
          {t(locale, "copy.app_stats_page.real_time_aggregates_leaderboards_and_economic_indicators_for_the_entire_se")}
        </p>
      </div>

      {/* Aggregate Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3.5 sm:p-4 bg-[#0E0E10] rounded-xl">
          <div className="flex items-center justify-between">
            {/* i18n-ignore: pre-existing */}
            <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider font-medium">Economy Total</span>
            <Coins className="w-4 h-4 text-[#D7B558]" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-[#F2EFE8] font-mono mt-1 block truncate">
            {formatCurrency(totalEconomy)}
          </span>
          {/* i18n-ignore: pre-existing */}
          <span className="text-[10px] text-[#8F8B83] block mt-0.5">Cash: {formatCurrency(counts?.total_cash || 0)}</span>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#0E0E10] rounded-xl">
          <div className="flex items-center justify-between">
            {/* i18n-ignore: pre-existing */}
            <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider font-medium">Citizens</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-[#F2EFE8] font-mono mt-1 block">
            {formatNumber(counts?.total_characters || 0, locale)}
          </span>
          {/* i18n-ignore: pre-existing */}
          <span className="text-[10px] text-[#8F8B83] block mt-0.5">{counts?.total_accounts || 0} Registered Accounts</span>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#0E0E10] rounded-xl">
          <div className="flex items-center justify-between">
            {/* i18n-ignore: pre-existing */}
            <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider font-medium">Registered Vehicles</span>
            <Car className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-[#F2EFE8] font-mono mt-1 block">
            {formatNumber(counts?.total_vehicles || 0, locale)}
          </span>
          {/* i18n-ignore: pre-existing */}
          <span className="text-[10px] text-[#8F8B83] block mt-0.5">Across all citizens</span>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#0E0E10] rounded-xl">
          <div className="flex items-center justify-between">
            {/* i18n-ignore: pre-existing */}
            <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider font-medium">Properties Owned</span>
            <Home className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-[#F2EFE8] font-mono mt-1 block">
            {formatNumber(counts?.total_properties || 0, locale)}
          </span>
          {/* i18n-ignore: pre-existing */}
          <span className="text-[10px] text-[#8F8B83] block mt-0.5">{counts?.total_clans || 0} Active Clans</span>
        </div>
      </div>

      {/* Main Leaderboard Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Top 10 Wealthiest Citizens */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 sm:p-4 bg-[#121214] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#D7B558]" />
              <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
                {t(locale, "copy.app_stats_page.top_10_wealthiest_players")}
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#101012] text-[#8F8B83] font-semibold text-[11px]">
                  <th className="px-3.5 py-2 w-8">#</th>
                  {/* i18n-ignore: pre-existing */}
                  <th className="px-3.5 py-2">Player</th>
                  {/* i18n-ignore: pre-existing */}
                  <th className="px-3.5 py-2 text-center">Level</th>
                  {/* i18n-ignore: pre-existing */}
                  <th className="px-3.5 py-2 text-right">Net Worth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {richest.map((p, idx) => {
                  const ident = identities.get(p.name.toLowerCase());
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-2.5 font-mono text-[#8F8B83] text-[11px]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-md bg-[#18181B] overflow-hidden shrink-0 flex items-center justify-center">
                            <GTAImage
                              src={getPedAvatarUrl(p.skin || ident?.skin)}
                              alt={p.name}
                              fallbackText={p.name.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                          <PlayerIdentity {...ident!} username={p.name} factionId={p.job} size="sm" />
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-[#F2EFE8]">{p.level}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-emerald-400 font-semibold">
                        {formatCurrency(p.total_wealth)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Most Experienced (Highest Level) */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 sm:p-4 bg-[#121214] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
                {/* i18n-ignore: pre-existing */}
                Top Experience & Hours
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#101012] text-[#8F8B83] font-semibold text-[11px]">
                  <th className="px-3.5 py-2 w-8">#</th>
                  {/* i18n-ignore: pre-existing */}
                  <th className="px-3.5 py-2">Player</th>
                  {/* i18n-ignore: pre-existing */}
                  <th className="px-3.5 py-2 text-center">Level</th>
                  {/* i18n-ignore: pre-existing */}
                  <th className="px-3.5 py-2 text-right">Hours Played</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {topLevels.map((p, idx) => {
                  const ident = identities.get(p.name.toLowerCase());
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-2.5 font-mono text-[#8F8B83] text-[11px]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-md bg-[#18181B] overflow-hidden shrink-0 flex items-center justify-center">
                            <GTAImage
                              src={getPedAvatarUrl(p.skin || ident?.skin)}
                              alt={p.name}
                              fallbackText={p.name.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                          <PlayerIdentity {...ident!} username={p.name} factionId={p.job} size="sm" />
                        </div>
                      </td>
                      {/* i18n-ignore: pre-existing */}
                      <td className="px-3.5 py-2.5 text-center font-mono text-[#F2EFE8] font-bold">Lvl {p.level}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#B4AFA4]">
                        {/* i18n-ignore: pre-existing */}
                        {Math.floor(p.hours || 0)} hrs
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Secondary Grids: Clans, Jobs & Vehicles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Dominant Clans */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#121214] flex items-center gap-2">
            <Flag className="w-4 h-4 text-amber-400" />
            {/* i18n-ignore: pre-existing */}
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">Top Clans</h2>
          </div>
          <div className="divide-y divide-white/[0.04] p-2 text-xs">
            {topClans.map((clan, idx) => (
              <Link
                key={clan.id}
                href={`/clans/${clan.id}`}
                className="p-2.5 flex items-center justify-between hover:bg-white/[0.02] rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-[#8F8B83]">{idx + 1}</span>
                  <span style={{ color: clan.tag_color || "#f59e0b" }} className="font-mono font-bold">
                    [{clan.tag}]
                  </span>
                  <span className="text-[#F2EFE8] font-medium truncate">{clan.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8F8B83] font-mono shrink-0">
                  {/* i18n-ignore: pre-existing */}
                  <span className="text-amber-400 font-semibold">{clan.turfs_count} turfs</span>
                  <span>•</span>
                  {/* i18n-ignore: pre-existing */}
                  <span>{clan.member_count} mem</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Civilian Job Activity */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#121214] flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            {/* i18n-ignore: pre-existing */}
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">Job Progress</h2>
          </div>
          <div className="divide-y divide-white/[0.04] p-2 text-xs">
            {jobStats.map((j) => (
              <div key={j.job_id} className="p-2.5 flex items-center justify-between text-[#B4AFA4]">
                <div>
                  <span className="font-semibold text-[#F2EFE8] capitalize block">{j.job_id.replace(/_/g, " ")}</span>
                  {/* i18n-ignore: pre-existing */}
                  <span className="text-[#8F8B83] text-[11px] font-mono">{j.workers} active workers</span>
                </div>
                <div className="text-right font-mono text-[11px]">
                  {/* i18n-ignore: pre-existing */}
                  <span className="text-[#F2EFE8] font-semibold block">{formatNumber(j.tasks_done, locale)} tasks</span>
                  <span className="text-emerald-400">{formatCurrency(j.earned_total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Vehicles */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#121214] flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-400" />
            {/* i18n-ignore: pre-existing */}
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">Popular Vehicles</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {vehicleStats.map((v) => (
              <div key={v.model} className="p-2.5 bg-[#121214] rounded-lg text-center">
                <span className="text-xs font-semibold text-[#F2EFE8] block truncate">
                  {vehicleDisplayName(v.model, v.catalog_label)}
                </span>
                {/* i18n-ignore: pre-existing */}
                <span className="text-[11px] text-[#8F8B83] font-mono block mt-0.5">{v.count} registered</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
