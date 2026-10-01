import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { CANONICAL_FACTIONS, getFactionColor } from "@/lib/factions";
import { PlayerName } from "@/components/ui/PlayerName";

interface MemberRow extends RowDataPacket {
  id: number;
  username: string;
  job_grade: number;
  level: number;
  joined_at: string | null;
  last_played: string | null;
}

interface LeaderRow extends RowDataPacket {
  leader_name: string;
  character_id: number;
  assigned_at: string;
}

export default async function FactionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const faction = CANONICAL_FACTIONS[slug];
  if (!faction) {
    notFound();
  }

  const locale = await getViewerLocale();
  const factionColor = getFactionColor(slug) || "#f1f1f1";

  const [members, leader] = await Promise.all([
    dbQuery<MemberRow>(
      `SELECT c.id, a.username, c.job_grade, c.level, c.last_played,
              fm.joined_at
       FROM accounts a
       JOIN players p ON p.account_id = a.id
       JOIN characters c ON c.player_id = p.id
       LEFT JOIN faction_membership fm ON fm.character_id = c.id
       WHERE c.job = ?
       ORDER BY c.job_grade DESC, c.level DESC, a.id ASC`,
      [slug]
    ),
    dbQuerySingle<LeaderRow>(
      `SELECT fl.character_id, fl.assigned_at, a.username AS leader_name
       FROM faction_leaders fl
       JOIN characters c ON c.id = fl.character_id
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       WHERE fl.faction_id = ?
       LIMIT 1`,
      [slug]
    ),
  ]);

  return (
    <div className="space-y-4">
      {/* Top back & title */}
      <div>
        <Link
          href="/factions"
          className="inline-flex items-center space-x-1 text-xs text-[#6f6f74] hover:text-[#f1f1f1] transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Factions</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
          <div>
            <div className="flex items-center space-x-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: factionColor }}
              />
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ color: factionColor }}
              >
                {faction.label}
              </h1>
              <span className="text-xs text-[#6f6f74] font-medium">
                {faction.factionType}
              </span>
            </div>
            <p className="text-xs text-[#8a8a90] mt-1">
              {faction.description}
            </p>
          </div>

          <span className="font-mono text-xs text-[#a5a5a8] bg-surface-100 border border-surface-border px-2.5 py-1 rounded w-fit">
            {members.length} members
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leadership column */}
        <div className="md:col-span-1 border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs">
          <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
            Leadership
          </h2>
          {leader ? (
            <div>
              <span className="text-[#6f6f74] block mb-1">Leader</span>
              <PlayerName
                name={leader.leader_name}
                factionId={slug}
                className="text-sm font-bold block"
              />
              <span className="text-[11px] text-[#6f6f74] font-mono block mt-0.5">
                Assigned: {formatDate(leader.assigned_at, locale, false)}
              </span>
            </div>
          ) : (
            <p className="text-[#6f6f74] text-xs">
              Leadership is vacant.
            </p>
          )}
        </div>

        {/* Member Roster */}
        <div className="md:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs text-[#8a8a90]">
            <span className="font-semibold text-[#f1f1f1]">Roster</span>
            <span className="font-mono text-[#6f6f74]">{members.length} members</span>
          </div>

          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                <tr>
                  <th className="py-2 px-3">Member</th>
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">Level</th>
                  <th className="py-2 px-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                {members.length > 0 ? (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-200/40 transition-colors">
                      <td className="py-2 px-3">
                        <PlayerName name={m.username} factionId={slug} href={`/players/${encodeURIComponent(m.username)}`} />
                      </td>
                        <td className="py-2 px-3 font-mono text-[#f1f1f1]">
                          Grade {m.job_grade}
                        </td>
                        <td className="py-2 px-3 font-mono text-[#6f6f74]">
                          Lvl {m.level}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] text-[#6f6f74]">
                          {m.joined_at ? formatDate(m.joined_at, locale, false) : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#6f6f74]">
                      No members enrolled in this faction.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
