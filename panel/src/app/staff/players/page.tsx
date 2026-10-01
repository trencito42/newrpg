import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Users, Search, Shield, AlertTriangle } from "lucide-react";

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function StaffPlayersPage({ searchParams }: Props) {
  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || (session.adminLevel < 1 && session.helperLevel < 1)) {
    redirect("/staff/dashboard");
  }

  const { search = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  let whereClause = "";
  const params: unknown[] = [];

  if (search.trim()) {
    whereClause = "WHERE a.username LIKE ?";
    params.push(`%${search.trim()}%`);
  }

  const sql = `
    SELECT 
      a.id as account_id,
      a.username,
      a.admin_level,
      a.helper_level,
      a.created_at,
      c.id as character_id,
      c.level,
      c.paydays_received as hours,
      c.job as faction_id,
      c.job_grade as faction_rank,
      c.last_played,
      cl.id as clan_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cm.rank as clan_rank,
      (SELECT COUNT(*) FROM admin_sanctions s WHERE s.target_account_id = a.id AND s.action = 'warn' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as active_warns,
      (SELECT COUNT(*) FROM bans b JOIN players pl ON pl.license = b.license WHERE pl.account_id = a.id AND (b.expires_at IS NULL OR b.expires_at > NOW())) as is_banned
    FROM accounts a
    LEFT JOIN players p ON p.account_id = a.id
    LEFT JOIN characters c ON c.player_id = p.id
    LEFT JOIN clan_members cm ON cm.character_id = c.id
    LEFT JOIN clans cl ON cl.id = cm.clan_id
    ${whereClause}
    ORDER BY a.admin_level DESC, a.helper_level DESC, c.level DESC, a.id ASC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  const players = await dbQuery<RowDataPacket>(sql, params);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {locale === "ro" ? "Management Jucători" : "Player Management"}
          </h1>
          <p className="text-xs text-[#6f6f74] mt-0.5">
            {locale === "ro"
              ? "Căutare după username canonic, verificare conturi și aplicare sancțiuni"
              : "Search by canonical username, account oversight, and moderation"}
          </p>
        </div>

        {/* Search */}
        <form method="GET" className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6f6f74]" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder={locale === "ro" ? "Caută username..." : "Search username..."}
              className="pl-8 pr-3 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1] focus:outline-none focus:border-[#a5a5a8]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#202023] hover:bg-[#28282c] border border-surface-border rounded text-xs text-[#f1f1f1] font-medium transition-colors"
          >
            {locale === "ro" ? "Caută" : "Search"}
          </button>
        </form>
      </div>

      {/* Players Table */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{locale === "ro" ? "Identitate Jucător" : "Player Identity"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Nivel / Ore" : "Level / Hours"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Facțiune / Clan" : "Faction / Clan"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Rol Staff" : "Staff Role"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Status Moderare" : "Status"}</th>
                <th className="px-3 py-2 text-right">{locale === "ro" ? "Acțiuni" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {players.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                    {locale === "ro" ? "Niciun jucător găsit" : "No players found"}
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.account_id} className="hover:bg-[#151517] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#6f6f74]">#{p.account_id}</td>
                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={p.username}
                        factionId={p.faction_id}
                        clanTag={p.clan_tag}
                        clanColor={p.clan_tag_color}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono">
                      <span className="text-[#f1f1f1] font-semibold">Lvl {p.level || 1}</span>
                      <span className="text-[#6f6f74] ml-1.5 text-[11px]">({p.hours || 0}h)</span>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="text-[11px]">
                        {p.faction_id && p.faction_id !== "unemployed" ? (
                          <span className="text-[#f1f1f1] font-medium block">
                            {p.faction_id} (R{p.faction_rank})
                          </span>
                        ) : (
                          <span className="text-[#6f6f74] block">Civilian</span>
                        )}
                        {p.clan_tag && (
                          <span className="text-[10px] text-[#88888c] block">
                            Clan: [{p.clan_tag}]
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      {p.admin_level > 0 ? (
                        <span className="px-1.5 py-0.5 bg-red-950/40 text-red-400 border border-red-800/40 rounded text-[10px] font-mono font-bold">
                          Admin {p.admin_level}
                        </span>
                      ) : p.helper_level > 0 ? (
                        <span className="px-1.5 py-0.5 bg-blue-950/40 text-blue-400 border border-blue-800/40 rounded text-[10px] font-mono font-bold">
                          Helper {p.helper_level}
                        </span>
                      ) : (
                        <span className="text-[#6f6f74] text-[11px]">Player</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {p.is_banned > 0 ? (
                        <span className="px-2 py-0.5 bg-red-900/60 text-white rounded text-[10px] font-bold font-mono">
                          BANNED
                        </span>
                      ) : p.active_warns > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-800/40 rounded text-[10px] font-mono">
                          {p.active_warns}/3 Warns
                        </span>
                      ) : (
                        <span className="text-emerald-500 text-[11px]">Curat</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/staff/players/${encodeURIComponent(p.username)}`}
                        className="px-2.5 py-1 bg-[#1a1a1c] hover:bg-[#222225] border border-surface-border rounded text-xs text-[#f1f1f1] font-medium transition-colors"
                      >
                        {locale === "ro" ? "Gestionează" : "Manage"}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
