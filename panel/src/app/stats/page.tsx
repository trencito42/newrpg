import { query, queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  Users,
  UserCheck,
  Landmark,
  Banknote,
  Car,
  Home,
  Trophy,
  TrendingUp,
  Package,
  Trash2,
  Fish,
  Target,
  Truck,
  Wrench,
  Shield,
  Activity,
  Award,
  Briefcase,
} from "lucide-react";

interface RichPlayerRecord {
  id: number;
  name: string;
  level: number;
  cash: number;
  bank: number;
  total_wealth: number;
  faction_name: string | null;
}

interface JobStatRecord {
  job_id: string;
  workers: number;
  tasks_done: number;
  earned_total: number;
}

interface FishingPodiumRecord {
  tournament_id: string;
  rank: number;
  display_name: string;
  fish_count: number;
  biggest_fish_weight_10: number;
  biggest_fish_item: string | null;
  reward_cash: number;
}

interface VehicleModelStat {
  model: string;
  count: number;
}

export const dynamic = "force-dynamic";

export default async function ServerStatsPage() {
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  // 1. Core aggregates
  const counts = await queryOne<{
    total_accounts: number;
    total_characters: number;
    total_cash: number;
    total_bank: number;
    total_vehicles: number;
    total_properties: number;
  }>(`
    SELECT 
      (SELECT COUNT(*) FROM accounts) as total_accounts,
      (SELECT COUNT(*) FROM characters) as total_characters,
      (SELECT COALESCE(SUM(cash), 0) FROM characters) as total_cash,
      (SELECT COALESCE(SUM(bank), 0) FROM characters) as total_bank,
      (SELECT COUNT(*) FROM vehicles) as total_vehicles,
      (SELECT COUNT(*) FROM properties) as total_properties
  `);

  // 2. Top 10 Richest Leaderboard (public net worth ranking)
  const richest = await query<RichPlayerRecord>(`
    SELECT 
      c.id, 
      CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) as name, 
      c.level, 
      c.cash, 
      c.bank, 
      (c.cash + c.bank) as total_wealth,
      fm.faction_id as faction_name
    FROM characters c
    LEFT JOIN faction_membership fm ON c.id = fm.character_id
    ORDER BY total_wealth DESC
    LIMIT 10
  `);

  // 3. Civilian Job Distribution
  const jobStats = await query<JobStatRecord>(`
    SELECT 
      job_id, 
      COUNT(*) as workers, 
      COALESCE(SUM(completed_tasks), 0) as tasks_done, 
      COALESCE(SUM(total_earned), 0) as earned_total
    FROM job_progress
    GROUP BY job_id
    ORDER BY earned_total DESC
  `);

  // 4. Fishing Hall of Fame
  const fishingPodium = await query<FishingPodiumRecord>(`
    SELECT 
      tournament_id,
      \`rank\`,
      display_name,
      fish_count,
      biggest_fish_weight_10,
      biggest_fish_item,
      reward_cash
    FROM fishing_tournament_history
    WHERE \`rank\` <= 3
    ORDER BY id DESC
    LIMIT 9
  `);

  // 5. Popular vehicles
  const vehicleStats = await query<VehicleModelStat>(`
    SELECT model, COUNT(*) as count
    FROM vehicles
    GROUP BY model
    ORDER BY count DESC
    LIMIT 6
  `);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat(lang === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getJobIcon = (jobId: string) => {
    switch (jobId.toLowerCase()) {
      case "courier":
        return <Package className="w-4 h-4 text-sky-400" />;
      case "garbage":
        return <Trash2 className="w-4 h-4 text-emerald-400" />;
      case "hunter":
        return <Target className="w-4 h-4 text-amber-400" />;
      case "fisherman":
        return <Fish className="w-4 h-4 text-cyan-400" />;
      case "trucker":
        return <Truck className="w-4 h-4 text-purple-400" />;
      case "mechanic":
        return <Wrench className="w-4 h-4 text-orange-400" />;
      default:
        return <Activity className="w-4 h-4 text-brand" />;
    }
  };

  const getJobColor = (jobId: string) => {
    switch (jobId.toLowerCase()) {
      case "courier":
        return "bg-sky-500/10 border-sky-500/20";
      case "garbage":
        return "bg-emerald-500/10 border-emerald-500/20";
      case "hunter":
        return "bg-amber-500/10 border-amber-500/20";
      case "fisherman":
        return "bg-cyan-500/10 border-cyan-500/20";
      case "trucker":
        return "bg-purple-500/10 border-purple-500/20";
      case "mechanic":
        return "bg-orange-500/10 border-orange-500/20";
      default:
        return "bg-brand/10 border-brand/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-surface-200 to-surface-200 border border-amber-500/30 p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-brand text-xs font-bold uppercase tracking-widest mb-1.5">
              <TrendingUp className="w-4 h-4 text-brand" />
              <span>{lang === "ro" ? "Economie & Date Live" : "Economy & Live Data"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {lang === "ro" ? "Statistici & Economie Server" : "Server Statistics & Economy"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {lang === "ro"
                ? "Transparență completă asupra economiei, activității civile și clasamentelor RPG oficiale."
                : "Complete transparency into server economy, civilian activity, and official RPG leaderboards."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-surface-50 border border-surface-border text-xs font-bold text-gray-300 flex items-center space-x-2 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{lang === "ro" ? "Date Sincronizate" : "Realtime Synced"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Global Economy Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label={lang === "ro" ? "Conturi" : "Total Accounts"}
          value={counts?.total_accounts || 0}
          icon={Users}
          variant="brand"
          subtext={lang === "ro" ? "Înregistrate" : "Registered"}
        />
        <StatCard
          label={lang === "ro" ? "Personaje" : "Characters"}
          value={counts?.total_characters || 0}
          icon={UserCheck}
          variant="sky"
          subtext={lang === "ro" ? "Create" : "Created"}
        />
        <StatCard
          label={lang === "ro" ? "Bancă Totală" : "Total Bank"}
          value={formatMoney(counts?.total_bank || 0)}
          icon={Landmark}
          variant="emerald"
          subtext={lang === "ro" ? "Fonduri Seif" : "Vault Funds"}
        />
        <StatCard
          label={lang === "ro" ? "Cash Circulație" : "Circulating Cash"}
          value={formatMoney(counts?.total_cash || 0)}
          icon={Banknote}
          variant="amber"
          subtext={lang === "ro" ? "Numerar Jucători" : "Citizen Wallets"}
        />
        <StatCard
          label={lang === "ro" ? "Vehicule" : "Registered Cars"}
          value={counts?.total_vehicles || 0}
          icon={Car}
          variant="purple"
          subtext={lang === "ro" ? "Înmatriculate" : "Registered"}
        />
        <StatCard
          label={lang === "ro" ? "Proprietăți" : "Properties"}
          value={counts?.total_properties || 0}
          icon={Home}
          variant="indigo"
          subtext={lang === "ro" ? "Case / Afaceri" : "Houses & Real Estate"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Top 10 Richest Players */}
        <Card className="p-5 border-surface-border bg-surface-200 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                {lang === "ro" ? "Top 10 Cei Mai Bogați Jucători" : "Top 10 Wealthiest Players"}
              </h2>
            </div>
            <Badge variant="brand" className="font-mono text-[10px] tracking-wider uppercase">
              Forbes RPG
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border text-gray-400 text-[10px] uppercase font-bold text-left tracking-wider">
                  <th className="pb-3 pl-3 w-12">#</th>
                  <th className="pb-3">{lang === "ro" ? "Jucător" : "Player"}</th>
                  <th className="pb-3 text-center">{lang === "ro" ? "Nivel" : "Level"}</th>
                  <th className="pb-3">{lang === "ro" ? "Facțiune" : "Faction"}</th>
                  <th className="pb-3 text-right pr-3">{lang === "ro" ? "Avere Totală" : "Net Worth"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {richest.map((p, idx) => {
                  const slug = p.name.trim().replace(/\s+/g, "_");
                  const isTop1 = idx === 0;
                  const isTop2 = idx === 1;
                  const isTop3 = idx === 2;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors group ${
                        isTop1
                          ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-2 border-l-amber-400 hover:bg-amber-500/20"
                          : isTop2
                          ? "bg-gradient-to-r from-slate-300/10 via-slate-300/5 to-transparent border-l-2 border-l-slate-300 hover:bg-slate-300/15"
                          : isTop3
                          ? "bg-gradient-to-r from-amber-700/15 via-amber-700/5 to-transparent border-l-2 border-l-amber-600 hover:bg-amber-700/20"
                          : "hover:bg-surface-50"
                      }`}
                    >
                      <td className="py-3 pl-3 font-mono font-black">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs shadow-sm">
                            1
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 border border-slate-300/40 text-slate-200 text-xs shadow-sm">
                            2
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 border border-amber-700/40 text-amber-500 text-xs shadow-sm">
                            3
                          </span>
                        ) : (
                          <span className="text-gray-500 pl-1 text-xs">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/players/${encodeURIComponent(slug)}`}
                          className="flex items-center space-x-2 text-white group-hover:text-brand transition-colors font-bold"
                        >
                          <div className="w-7 h-7 rounded-lg bg-surface-50 border border-surface-border flex items-center justify-center text-[11px] font-black text-brand shrink-0">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-surface-100 border border-surface-border text-xs font-mono font-bold text-gray-300">
                          {p.level}
                        </span>
                      </td>
                      <td className="py-3">
                        {p.faction_name ? (
                          <Badge variant="info" className="capitalize text-[10px]">
                            {p.faction_name.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-gray-500 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right pr-3 font-mono font-black text-emerald-400 text-xs drop-shadow-[0_0_6px_rgba(52,211,153,0.25)]">
                        {formatMoney(p.total_wealth)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right: Civilian Job Metrics & Vehicles */}
        <div className="space-y-6">
          {/* Job Performance */}
          <Card className="p-5 border-surface-border bg-surface-200 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-brand" />
                <h2 className="text-base font-bold text-white tracking-tight">
                  {lang === "ro" ? "Economia Joburilor Civile" : "Civilian Job Economy"}
                </h2>
              </div>
              <span className="text-xs font-mono text-gray-400">
                {jobStats.length} {lang === "ro" ? "profesii active" : "active jobs"}
              </span>
            </div>

            {jobStats.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                {lang === "ro" ? "Nu există date de progres joburi." : "No civilian job progress recorded yet."}
              </p>
            ) : (
              <div className="space-y-2.5">
                {jobStats.map((j) => (
                  <div
                    key={j.job_id}
                    className="p-3.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-surface-border hover:border-surface-borderLight transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${getJobColor(
                          j.job_id
                        )}`}
                      >
                        {getJobIcon(j.job_id)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-white capitalize block truncate">
                          {j.job_id.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          <span>
                            {j.workers} {lang === "ro" ? "muncitori" : "workers"}
                          </span>
                          <span>•</span>
                          <span>
                            {j.tasks_done.toLocaleString()} {lang === "ro" ? "sarcini" : "tasks"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md inline-block">
                        {formatMoney(j.earned_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Popular Vehicle Fleet */}
          <Card className="p-5 border-surface-border bg-surface-200 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center space-x-2">
                <Car className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white tracking-tight">
                  {lang === "ro" ? "Cele Mai Populare Vehicule" : "Most Popular Vehicle Models"}
                </h2>
              </div>
              <Badge variant="brand" className="text-[10px]">
                Top Fleet
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {vehicleStats.map((v) => (
                <div
                  key={v.model}
                  className="p-3 rounded-xl bg-surface-100 hover:bg-surface-50 border border-surface-border hover:border-brand/40 transition-all text-center relative overflow-hidden group shadow-md"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-2 text-brand group-hover:scale-110 transition-transform">
                    <Car className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-white uppercase block font-mono tracking-wide truncate">
                    {v.model}
                  </span>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-300 bg-surface-50 border border-surface-border">
                    {v.count} {lang === "ro" ? "unități" : "owned"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Fishing Tournament Hall of Fame */}
      {fishingPodium.length > 0 && (
        <Card className="p-6 border-surface-border bg-surface-200 shadow-xl">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-surface-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                <Fish className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  {lang === "ro" ? "Turneul de Pescuit - Podium Istoric" : "Fishing Tournament - Hall of Fame"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lang === "ro"
                    ? "Cei mai iscusiți pescari ai serverului și cele mai impresionante capturi."
                    : "Top anglers of the server and their most impressive catches."}
                </p>
              </div>
            </div>
            <Award className="w-6 h-6 text-amber-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fishingPodium.slice(0, 3).map((f) => (
              <div
                key={`${f.tournament_id}-${f.rank}`}
                className={`p-5 rounded-xl border text-center relative overflow-hidden shadow-lg transition-all ${
                  f.rank === 1
                    ? "bg-gradient-to-b from-amber-500/15 to-surface-100 border-amber-500/35"
                    : f.rank === 2
                    ? "bg-gradient-to-b from-slate-300/15 to-surface-100 border-slate-300/35"
                    : "bg-gradient-to-b from-amber-700/15 to-surface-100 border-amber-700/35"
                }`}
              >
                <div className="text-3xl mb-2">
                  {f.rank === 1 ? "🥇" : f.rank === 2 ? "🥈" : "🥉"}
                </div>
                <span className="font-black text-sm text-white block truncate">{f.display_name}</span>
                <span className="text-[10px] uppercase font-mono text-gray-400 block mt-0.5">
                  {f.tournament_id}
                </span>

                <div className="mt-4 pt-3 border-t border-surface-border text-xs space-y-1.5 text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{lang === "ro" ? "Capturi: " : "Catches: "}</span>
                    <strong className="text-white font-mono">{f.fish_count}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{lang === "ro" ? "Record: " : "Biggest: "}</span>
                    <strong className="text-white font-mono">
                      {(f.biggest_fish_weight_10 / 10).toFixed(1)} kg ({f.biggest_fish_item || "Pește"})
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-surface-border/50 text-right">
                    <span className="text-emerald-400 font-mono font-black text-sm drop-shadow-sm">
                      +{formatMoney(f.reward_cash)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
