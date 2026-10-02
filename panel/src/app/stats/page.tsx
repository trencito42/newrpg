import { query, queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/auth";
import Link from "next/link";
import { PlayerName } from "@/components/ui/PlayerName";
import { getFactionLabel } from "@/lib/factions";
import { vehicleDisplayName } from "@/lib/vehicle-names";

interface RichPlayerRecord {
  id: number;
  name: string;
  level: number;
  cash: number;
  bank: number;
  total_wealth: number;
  job: string | null;
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
  catalog_label: string | null;
  count: number;
}

export const dynamic = "force-dynamic";

export default async function ServerStatsPage() {
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  const [counts, richest, jobStats, fishingPodium, vehicleStats] = await Promise.all([
    queryOne<{
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
    `),
    query<RichPlayerRecord>(`
      SELECT 
        c.id, 
        a.username as name, 
        c.level, 
        c.cash, 
        c.bank, 
        (c.cash + c.bank) as total_wealth,
        c.job
      FROM characters c
      JOIN players p ON p.id = c.player_id
      JOIN accounts a ON a.id = p.account_id
      ORDER BY total_wealth DESC
      LIMIT 10
    `),
    query<JobStatRecord>(`
      SELECT 
        job_id, 
        COUNT(*) as workers, 
        COALESCE(SUM(completed_tasks), 0) as tasks_done, 
        COALESCE(SUM(total_earned), 0) as earned_total
      FROM job_progress
      GROUP BY job_id
      ORDER BY earned_total DESC
    `),
    query<FishingPodiumRecord>(`
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
      LIMIT 6
    `),
    query<VehicleModelStat>(`
      SELECT v.model, dv.label AS catalog_label, COUNT(*) as count
      FROM vehicles v
      LEFT JOIN dealership_vehicles dv ON LOWER(dv.model) = LOWER(v.model)
      GROUP BY v.model, dv.label
      ORDER BY count DESC
      LIMIT 6
    `),
  ]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat(lang === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {lang === "ro" ? "Statistici" : "Statistics"}
        </h1>
      </div>

      {/* Aggregates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Accounts</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{counts?.total_accounts || 0}</span>
        </div>
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Characters</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{counts?.total_characters || 0}</span>
        </div>
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Bank Total</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{formatMoney(counts?.total_bank || 0)}</span>
        </div>
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Cash Total</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{formatMoney(counts?.total_cash || 0)}</span>
        </div>
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Vehicles</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{counts?.total_vehicles || 0}</span>
        </div>
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Properties</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{counts?.total_properties || 0}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Wealthiest Players */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#f1f1f1]">
            {lang === "ro" ? "Top 10 Bogați" : "Top 10 Wealthiest Players"}
          </div>

          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                <tr>
                  <th className="py-2 px-3 w-8">#</th>
                  <th className="py-2 px-3">Player</th>
                  <th className="py-2 px-3">Level</th>
                  <th className="py-2 px-3 text-right">Wealth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                {richest.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-surface-200/40">
                    <td className="py-2 px-3 font-mono text-[#6f6f74]">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <PlayerName name={p.name} factionId={p.job} href={`/players/${encodeURIComponent(p.name)}`} />
                    </td>
                    <td className="py-2 px-3 font-mono text-[#f1f1f1]">{p.level}</td>
                    <td className="py-2 px-3 text-right font-mono text-[#f1f1f1]">
                      {formatMoney(p.total_wealth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job Economy & Vehicles */}
        <div className="space-y-4">
          {/* Job Progress */}
          <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
            <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#f1f1f1]">
              {lang === "ro" ? "Joburi Civile" : "Civilian Jobs"}
            </div>

            <div className="divide-y divide-surface-border/50 text-xs">
              {jobStats.map((j) => (
                <div key={j.job_id} className="p-2.5 px-3 flex items-center justify-between text-[#a5a5a8]">
                  <div>
                    <span className="font-semibold text-[#f1f1f1] capitalize">{j.job_id.replace(/_/g, " ")}</span>
                    <span className="text-[#6f6f74] text-[11px] ml-2">
                      {j.workers} workers • {j.tasks_done.toLocaleString()} tasks
                    </span>
                  </div>
                  <span className="font-mono text-[#f1f1f1]">{formatMoney(j.earned_total)}</span>
                </div>
              ))}
              {jobStats.length === 0 && (
                <div className="p-4 text-center text-[#6f6f74]">No job progress recorded.</div>
              )}
            </div>
          </div>

          {/* Popular Vehicles */}
          <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
            <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#f1f1f1]">
              {lang === "ro" ? "Modele Populare" : "Popular Vehicle Models"}
            </div>

            <div className="p-3 grid grid-cols-3 gap-2">
              {vehicleStats.map((v) => (
                <div key={v.model} className="p-2 bg-surface-200 border border-surface-border rounded text-center">
                  <span className="text-xs font-semibold text-[#f1f1f1] block truncate">{vehicleDisplayName(v.model, v.catalog_label)}</span>
                  <span className="text-[11px] text-[#6f6f74] block mt-0.5">{v.count} owned</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
