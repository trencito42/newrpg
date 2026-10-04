import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { ArrowLeft, Settings, CheckCircle, XCircle } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { CANONICAL_FACTIONS, getFactionColor } from "@/lib/factions";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";

interface MemberRow extends RowDataPacket {
  id: number;
  username: string;
  job_grade: number;
  level: number;
  joined_at: string | null;
  last_played: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
}

interface LeaderRow extends RowDataPacket {
  leader_name: string;
  character_id: number;
  assigned_at: string;
  clan_tag: string | null;
  clan_tag_color: string | null;
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
  const session = await getCurrentSession();
  const factionColor = getFactionColor(slug) || "#F2EFE8";

  const [members, leader, appSettings] = await Promise.all([
    dbQuery<MemberRow>(
      `SELECT c.id, a.username, ${factionGradeSql()} AS job_grade, c.level, c.last_played,
              fm.joined_at,
              cl.tag as clan_tag,
              cl.tag_color as clan_tag_color,
              cl.tag_style as clan_tag_style
       FROM accounts a
       JOIN players p ON p.account_id = a.id
       JOIN characters c ON c.player_id = p.id
       JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id = ?
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE ${factionIdSql()} = fm.faction_id
       ORDER BY job_grade DESC, c.level DESC, a.id ASC`,
      [slug]
    ),
    dbQuerySingle<LeaderRow>(
      `SELECT fl.character_id, fl.assigned_at, a.username AS leader_name,
              cl.tag as clan_tag,
              cl.tag_color as clan_tag_color,
              cl.tag_style as clan_tag_style
       FROM faction_leaders fl
       JOIN characters c ON c.id = fl.character_id
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id COLLATE utf8mb4_unicode_ci = fl.faction_id COLLATE utf8mb4_unicode_ci
       WHERE fl.faction_id = ?
         AND ${factionIdSql()} = fm.faction_id
       LIMIT 1`,
      [slug]
    ),
    dbQuerySingle<RowDataPacket>(
      `SELECT applications_open FROM panel_org_application_settings WHERE org_type = 'faction' AND org_id = ? LIMIT 1`,
      [slug]
    ),
  ]);

  const appsOpen = Boolean(appSettings?.applications_open);

  // Check if session user has Leader / Sub-Leader rank
  let canManage = false;
  if (session) {
    if (session.adminLevel >= 3) {
      canManage = true;
    } else {
      const myMember = members.find((m) => m.username.toLowerCase() === session.username.toLowerCase());
      if (myMember && (Number(myMember.job_grade) >= 6 || (leader && leader.leader_name.toLowerCase() === session.username.toLowerCase()))) {
        canManage = true;
      }
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top back & header */}
      <div className="p-4 sm:p-6 bg-[#0E0E10] rounded-xl space-y-4">
        <Link
          href="/factions"
          className="inline-flex items-center space-x-1.5 text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t(locale, "factions.title")}</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: factionColor }}
              />
              <h1
                className="text-xl sm:text-2xl font-bold tracking-tight"
                style={{ color: factionColor }}
              >
                {faction.label}
              </h1>
              <span className="text-xs text-[#8F8B83] font-medium uppercase tracking-wider">
                {t(locale, faction.factionTypeKey)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#99958E] mt-1.5 max-w-2xl leading-relaxed">
              {t(locale, faction.descriptionKey)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canManage && (
              <Link
                href={`/factions/${slug}/manage`}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#18181B] hover:bg-[#202024] text-[#F2EFE8] font-medium rounded-lg text-xs transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-[#B4AFA4]" />
                <span>{t(locale, "copy.app_factions_slug_page.faction_panel")}</span>
              </Link>
            )}

            {appsOpen && (
              <Link
                href={`/factions/${slug}/apply`}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors"
              >
                {t(locale, "copy.app_factions_slug_page.apply_to_faction")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3.5 bg-[#0E0E10] rounded-xl">
          <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "clans.leader")}</span>
          <div className="mt-1.5">
            {leader ? (
              <PlayerIdentity
                username={leader.leader_name}
                factionId={slug}
                clanTag={leader.clan_tag}
                clanColor={leader.clan_tag_color}
                clanTagStyle={leader.clan_tag_style}
                size="sm"
              />
            ) : (
              <span className="text-[#8F8B83] italic">{t(locale, "interface.vacant")}</span>
            )}
          </div>
        </div>

        <div className="p-3.5 bg-[#0E0E10] rounded-xl">
          <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "interface.type")}</span>
          <span className="font-semibold text-[#F2EFE8] mt-1.5 block capitalize text-sm">
            {faction.type}
          </span>
        </div>

        <div className="p-3.5 bg-[#0E0E10] rounded-xl">
          <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "interface.active_members")}</span>
          <span className="font-mono font-bold text-[#F2EFE8] mt-1.5 block text-base">
            {members.length}
          </span>
        </div>

        <div className="p-3.5 bg-[#0E0E10] rounded-xl">
          <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "applications.title")}</span>
          <span className="font-semibold text-xs mt-1.5 block">
            {appsOpen ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> {t(locale, "interface.open")}
              </span>
            ) : (
              <span className="text-[#8F8B83] flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> {t(locale, "interface.closed")}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Roster Table */}
      <div className="rounded-xl bg-[#0E0E10] overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-[#121214]">
          <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
            {t(locale, "copy.app_factions_slug_page.faction_roster")} ({members.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#101012] text-[#8F8B83] font-semibold text-[11px]">
                <th className="px-3.5 py-2.5">#</th>
                <th className="px-3.5 py-2.5">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</th>
                <th className="px-3.5 py-2.5">{t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")}</th>
                <th className="px-3.5 py-2.5 text-center">{t(locale, "common.level")}</th>
                <th className="px-3.5 py-2.5 text-right">{t(locale, "account.session_last_active")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {t(locale, "interface.no_members_in_this_faction")}
                  </td>
                </tr>
              ) : (
                members.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3.5 py-2.5 font-mono text-[#8F8B83] text-[11px]">{idx + 1}</td>
                    <td className="px-3.5 py-2.5">
                      <PlayerIdentity
                        username={m.username}
                        factionId={slug}
                        clanTag={m.clan_tag}
                        clanColor={m.clan_tag_color}
                        clanTagStyle={m.clan_tag_style}
                        size="sm"
                      />
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-medium text-[#F2EFE8]">
                      {t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")} {m.job_grade}
                      {m.job_grade >= 7 && <span className="ml-1.5 text-[10px] text-amber-400 font-bold">{t(locale, "interface.leader")}</span>}
                      {m.job_grade === 6 && <span className="ml-1.5 text-[10px] text-blue-400 font-bold">{t(locale, "interface.co_leader")}</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono text-[#F2EFE8]">{m.level}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-[#8F8B83] text-[11px]">
                      {m.last_played ? formatDate(m.last_played, locale) : "Never"}
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
