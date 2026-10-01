import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { CANONICAL_FACTIONS, getFactionColor } from "@/lib/factions";
import { PlayerName } from "@/components/ui/PlayerName";

interface FactionMemberCountRow extends RowDataPacket {
  job: string;
  member_count: number;
}

interface FactionLeaderRow extends RowDataPacket {
  faction_id: string;
  character_id: number;
  leader_name: string;
}

export default async function FactionsPage() {
  const locale = await getViewerLocale();

  const [memberCounts, leaders] = await Promise.all([
    dbQuery<FactionMemberCountRow>(
      `SELECT job, COUNT(*) AS member_count
       FROM characters
       WHERE job IN (?)
       GROUP BY job`,
      [Object.keys(CANONICAL_FACTIONS)]
    ),
    dbQuery<FactionLeaderRow>(
      `SELECT fl.faction_id, fl.character_id,
              CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS leader_name
       FROM faction_leaders fl
       JOIN characters c ON c.id = fl.character_id`
    ),
  ]);

  const countMap = new Map<string, number>();
  memberCounts.forEach((r) => countMap.set(r.job, Number(r.member_count) || 0));

  const leaderMap = new Map<string, { character_id: number; leader_name: string }>();
  leaders.forEach((r) => leaderMap.set(r.faction_id, { character_id: r.character_id, leader_name: r.leader_name }));

  const factionList = Object.values(CANONICAL_FACTIONS).map((f) => ({
    ...f,
    memberCount: countMap.get(f.id) || 0,
    leader: leaderMap.get(f.id) || null,
  }));

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {t(locale, "factions.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {factionList.map((f) => {
          const factionColor = getFactionColor(f.id) || "#f1f1f1";
          return (
            <Link
              key={f.id}
              href={`/factions/${f.id}`}
              className="p-3.5 bg-surface-100 hover:bg-surface-200 border border-surface-border rounded transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: factionColor }}
                    />
                    <span
                      className="font-bold text-sm"
                      style={{ color: factionColor }}
                    >
                      {f.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6f6f74] font-medium">
                    {f.factionType}
                  </span>
                </div>

                <p className="text-xs text-[#8a8a90] mt-1.5 line-clamp-2">
                  {f.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-surface-border/60 flex items-center justify-between text-xs text-[#6f6f74]">
                <span>
                  Leader:{" "}
                  {f.leader ? (
                    <span className="text-[#f1f1f1] font-medium">{f.leader.leader_name}</span>
                  ) : (
                    <span className="text-[#6f6f74] italic">Vacant</span>
                  )}
                </span>
                <span className="font-mono text-[#a5a5a8]">
                  {f.memberCount} members
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
