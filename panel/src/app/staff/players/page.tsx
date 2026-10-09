import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import { Users, Search, Shield, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n";


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
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      c.last_played,
      cl.id as clan_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style,
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
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "staff.player_management")}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "copy.app_staff_players_page.search_by_canonical_username_account_oversight_and_moderation")}
          </p>
        </div>

        {/* Search */}
        <form method="GET" className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full min-w-0 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8F8B83]" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder={t(locale, "copy.app_staff_players_page.search_username")}
              className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#B4AFA4]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 bg-[#211D18] hover:bg-[#302A1E] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
          >
            {t(locale, "common.search")}
          </button>
        </form>
      </div>

      {/* Players Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{t(locale, "copy.app_staff_players_page.player_identity")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "copy.app_staff_players_page.level_hours")}</th>
                <th className="px-3 py-2">{t(locale, "copy.app_staff_players_page.faction_clan")}</th>
                <th className="px-3 py-2">{t(locale, "copy.app_staff_players_page.staff_role")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "copy.app_staff_players_page.status")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {players.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {t(locale, "copy.app_staff_players_page.no_players_found")}
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.account_id} className="hover:bg-[#131315] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#8F8B83]">#{p.account_id}</td>
                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={p.username}
                        factionId={p.faction_id}
                        clanTag={p.clan_tag}
                        clanColor={p.clan_tag_color}
                        clanTagStyle={p.clan_tag_style}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono">
                      <span className="text-[#F2EFE8] font-semibold">{t(locale, "interface.lvl")} {p.level || 1}</span>
                      <span className="text-[#8F8B83] ml-1.5 text-[11px]">({p.hours || 0}{t(locale, "interface.h")})</span>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="text-[11px]">
                        {p.faction_id && p.faction_id !== "unemployed" ? (
                          <span className="text-[#F2EFE8] font-medium block">
                            {p.faction_id} {t(locale, "interface.r")}{p.faction_rank})
                          </span>
                        ) : (
                          <span className="text-[#8F8B83] block">{t(locale, "interface.civilian")}</span>
                        )}
                        {p.clan_tag && (
                          <span className="text-[10px] text-[#99958E] block">
                            {t(locale, "interface.clan_2")}{p.clan_tag}]
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
                        <span className="text-[#8F8B83] text-[11px]">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {p.is_banned > 0 ? (
                        <span className="px-2 py-0.5 bg-red-900/60 text-[#F2EFE8] rounded text-[10px] font-bold font-mono">
                          {t(locale, "interface.banned")}</span>
                      ) : p.active_warns > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-800/40 rounded text-[10px] font-mono">
                          {p.active_warns}{t(locale, "interface.3_warnings")}</span>
                      ) : (
                        <span className="text-emerald-500 text-[11px]">{t(locale, "interface.clean")}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/staff/players/${encodeURIComponent(p.username)}`}
                        className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
                      >
                        {t(locale, "copy.app_clans_id_manage_clanmanageclient.manage")}
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
