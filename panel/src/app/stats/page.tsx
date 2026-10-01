import { query, queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

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
      c.name, 
      c.level, 
      c.cash, 
      c.bank, 
      (c.cash + c.bank) as total_wealth,
      f.name as faction_name
    FROM characters c
    LEFT JOIN factions f ON c.faction_id = f.id
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {lang === "ro" ? "Statistici & Economie Server" : "Server Statistics & Economy"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ro"
            ? "Transparență completă asupra economiei, activității civile și clasamentelor RPG oficiale."
            : "Complete transparency into server economy, civilian activity, and official RPG leaderboards."}
        </p>
      </div>

      {/* Global Economy Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label={lang === "ro" ? "Conturi Înregistrate" : "Total Accounts"}
          value={counts?.total_accounts || 0}
        />
        <StatCard
          label={lang === "ro" ? "Personaje Create" : "Characters"}
          value={counts?.total_characters || 0}
        />
        <StatCard
          label={lang === "ro" ? "Bani în Bancă" : "Total Bank"}
          value={formatMoney(counts?.total_bank || 0)}
        />
        <StatCard
          label={lang === "ro" ? "Bani Cash Circulație" : "Circulating Cash"}
          value={formatMoney(counts?.total_cash || 0)}
        />
        <StatCard
          label={lang === "ro" ? "Vehicule Înmatriculate" : "Registered Cars"}
          value={counts?.total_vehicles || 0}
        />
        <StatCard
          label={lang === "ro" ? "Proprietăți / Case" : "Properties"}
          value={counts?.total_properties || 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Top 10 Richest Players */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {lang === "ro" ? "Top 10 Cei Mai Bogați Jucători" : "Top 10 Wealthiest Players"}
            </h2>
            <Badge variant="accent">Forbes RPG</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground text-[10px] uppercase font-semibold text-left">
                  <th className="pb-2 pl-2">#</th>
                  <th className="pb-2">{lang === "ro" ? "Nume Jucător" : "Player"}</th>
                  <th className="pb-2">{lang === "ro" ? "Nivel" : "Level"}</th>
                  <th className="pb-2">{lang === "ro" ? "Facțiune" : "Faction"}</th>
                  <th className="pb-2 text-right pr-2">{lang === "ro" ? "Avere Totală" : "Net Worth"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {richest.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 pl-2 font-mono font-bold text-muted-foreground">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                    </td>
                    <td className="py-2.5 font-semibold">
                      <Link href={`/players/${p.id}`} className="text-foreground hover:text-accent">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2.5 text-muted-foreground font-mono">{p.level}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {p.faction_name || <span className="text-muted-foreground/50">-</span>}
                    </td>
                    <td className="py-2.5 text-right pr-2 font-mono font-bold text-emerald-400">
                      {formatMoney(p.total_wealth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right: Civilian Job Metrics & Vehicles */}
        <div className="space-y-6">
          {/* Job Performance */}
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground mb-3">
              {lang === "ro" ? "Economia Joburilor Civile" : "Civilian Job Economy"}
            </h2>

            {jobStats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {lang === "ro" ? "Nu există date de progres joburi." : "No civilian job progress recorded yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {jobStats.map((j) => (
                  <div key={j.job_id} className="p-3 rounded bg-muted/20 border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-foreground capitalize">
                        {j.job_id.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {formatMoney(j.earned_total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>
                        {j.workers} {lang === "ro" ? "muncitori activi" : "registered workers"}
                      </span>
                      <span>•</span>
                      <span>
                        {j.tasks_done.toLocaleString()} {lang === "ro" ? "sarcini finalizate" : "tasks completed"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Popular Vehicle Fleet */}
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground mb-3">
              {lang === "ro" ? "Cele Mai Populare Vehicule" : "Most Popular Vehicle Models"}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {vehicleStats.map((v) => (
                <div key={v.model} className="p-2.5 rounded bg-muted/20 border border-border/30 text-center">
                  <span className="text-xs font-bold text-foreground uppercase block font-mono">
                    {v.model}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {v.count} {lang === "ro" ? "deținute" : "owned"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Fishing Tournament Hall of Fame */}
      {fishingPodium.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {lang === "ro" ? "Turneul de Pescuit - Podium Istoric" : "Fishing Tournament - Hall of Fame"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lang === "ro"
                  ? "Cei mai iscusiți pescari ai serverului și cele mai impresionante capturi."
                  : "Top anglers of the server and their most impressive catches."}
              </p>
            </div>
            <span className="text-lg">🎣</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {fishingPodium.slice(0, 3).map((f) => (
              <div
                key={`${f.tournament_id}-${f.rank}`}
                className={`p-4 rounded-lg border text-center relative overflow-hidden ${
                  f.rank === 1
                    ? "bg-amber-500/10 border-amber-500/30"
                    : f.rank === 2
                    ? "bg-slate-300/10 border-slate-300/30"
                    : "bg-amber-700/10 border-amber-700/30"
                }`}
              >
                <div className="text-2xl mb-1">{f.rank === 1 ? "🥇" : f.rank === 2 ? "🥈" : "🥉"}</div>
                <span className="font-bold text-sm text-foreground block">{f.display_name}</span>
                <span className="text-[10px] uppercase font-mono text-muted-foreground block mt-0.5">
                  {f.tournament_id}
                </span>

                <div className="mt-3 pt-3 border-t border-border/30 text-xs space-y-1 text-muted-foreground">
                  <div>
                    {lang === "ro" ? "Capturi: " : "Catches: "}
                    <strong className="text-foreground font-mono">{f.fish_count}</strong>
                  </div>
                  <div>
                    {lang === "ro" ? "Cel mai mare: " : "Biggest: "}
                    <strong className="text-foreground font-mono">
                      {(f.biggest_fish_weight_10 / 10).toFixed(1)} kg ({f.biggest_fish_item || "Pește"})
                    </strong>
                  </div>
                  <div className="text-emerald-400 font-mono font-bold pt-1">
                    +{formatMoney(f.reward_cash)}
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
