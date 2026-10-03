import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import { Flag, Users, Shield, Map, CheckCircle, XCircle, Settings, Award } from "lucide-react";
import { t } from "@/lib/i18n";


interface Context {
  params: Promise<{ id: string }>;
}

const CLAN_RANKS = [
  "None",
  "Recruit",
  "Member",
  "Veteran",
  "Senior",
  "Officer",
  "Co-Leader",
  "Leader",
];

export default async function ClanDetailPage({ params }: Context) {
  const { id: idStr } = await params;
  const clanId = Number(idStr);
  if (!Number.isSafeInteger(clanId) || clanId < 1) notFound();

  const locale = await getViewerLocale();
  const session = await getCurrentSession();

  const clan = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      c.owner_character_id, c.motd, c.max_members, c.created_at, c.rank_labels,
      acc.username as owner_username, ${factionIdSql("ch")} as owner_faction_id,
      (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) as member_count,
      (SELECT COUNT(*) FROM turfs t WHERE t.owner_clan_id = c.id) as turfs_count,
      COALESCE(s.applications_open, 0) as applications_open,
      s.min_level, s.min_hours, s.max_warnings
     FROM clans c
     JOIN characters ch ON ch.id = c.owner_character_id
     JOIN players p ON p.id = ch.player_id
     JOIN accounts acc ON acc.id = p.account_id
     LEFT JOIN panel_org_application_settings s ON s.org_type = 'clan' AND s.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci
     WHERE c.id = ? LIMIT 1`,
    [clanId]
  );

  if (!clan) notFound();

  // Fetch members
  const members = await dbQuery<RowDataPacket>(
    `SELECT 
      c.id as character_id,
      a.id as account_id,
      a.username,
      cm.rank,
      cm.warns,
      cm.joined_at,
      c.level,
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      c.paydays_received as hours,
      c.last_played,
      (cl.owner_character_id = c.id) as is_owner,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
     FROM clan_members cm
     JOIN characters c ON c.id = cm.character_id
     JOIN players p ON p.id = c.player_id
     JOIN accounts a ON a.id = p.account_id
     JOIN clans cl ON cl.id = cm.clan_id
     WHERE cm.clan_id = ?
     ORDER BY (cl.owner_character_id = c.id) DESC, cm.rank DESC, cm.joined_at ASC`,
    [clanId]
  );

  // Controlled turfs
  const turfs = await dbQuery<RowDataPacket>(
    `SELECT id, name, radius, payout, respect_payout FROM turfs WHERE owner_clan_id = ?`,
    [clanId]
  );

  // Check if current user is member / leader of this clan
  let userRank = 0;
  let canManage = false;
  if (session) {
    if (session.adminLevel >= 4) {
      canManage = true;
    }
    const myMember = members.find((m) => m.account_id === session.accountId);
    if (myMember) {
      userRank = Number(myMember.rank) || 1;
      if (myMember.is_owner || userRank >= 6) {
        canManage = true;
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Clan Header */}
      <div className="border border-surface-border rounded bg-[#0E0E10] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              style={{ color: clan.tag_color || "#f59e0b" }}
              className="font-mono font-bold text-2xl tracking-tight"
            >
              [{clan.tag}]
            </span>
            <div>
              <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
                {clan.name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[#8F8B83] mt-0.5">
                <span>{t(locale, "copy.app_clans_id_page.leader")}</span>
                <PlayerIdentity
                  username={clan.owner_username}
                  factionId={clan.owner_faction_id}
                  clanTag={clan.tag}
                  clanColor={clan.tag_color}
                  clanTagStyle={clan.tag_style}
                  size="sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Link
                href={`/clans/${clan.id}/manage`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border text-[#F2EFE8] font-medium rounded text-xs transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-[#B4AFA4]" />
                <span>{t(locale, "copy.app_clans_id_page.clan_panel")}</span>
              </Link>
            )}

            {clan.applications_open === 1 && !userRank && (
              <Link
                href={`/clans/${clan.id}/apply`}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] font-medium rounded text-xs transition-colors"
              >
                {t(locale, "copy.app_clans_id_page.apply_to_clan")}
              </Link>
            )}
          </div>
        </div>

        {/* MOTD / Description */}
        {(clan.motd || clan.description) && (
          <div className="mt-3 pt-3 border-t border-surface-border text-xs text-[#B4AFA4]">
            {clan.motd && (
              <p className="font-mono text-amber-300/90 mb-1">
                <span className="font-bold text-[#8F8B83]">MOTD:</span> {clan.motd}
              </p>
            )}
            {clan.description && <p className="text-[#99958E]">{clan.description}</p>}
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-surface-border text-xs">
          <div className="p-2 bg-[#101012] border border-surface-border rounded">
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "clans.members")}</span>
            <span className="font-mono font-bold text-[#F2EFE8] text-sm mt-0.5 block">
              {clan.member_count} / {clan.max_members}
            </span>
          </div>

          <div className="p-2 bg-[#101012] border border-surface-border rounded">
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "copy.app_clans_id_page.turfs")}</span>
            <span className="font-mono font-bold text-amber-400 text-sm mt-0.5 block">
              {clan.turfs_count}
            </span>
          </div>

          <div className="p-2 bg-[#101012] border border-surface-border rounded">
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "applications.title")}</span>
            <span className="font-bold text-sm mt-0.5 block">
              {clan.applications_open ? (
                <span className="text-emerald-400">{t(locale, "copy.app_clans_id_page.open")}</span>
              ) : (
                <span className="text-[#8F8B83]">{t(locale, "copy.app_clans_id_page.closed")}</span>
              )}
            </span>
          </div>

          <div className="p-2 bg-[#101012] border border-surface-border rounded">
            <span className="text-[11px] text-[#8F8B83] block">{t(locale, "copy.app_clans_id_page.created_at")}</span>
            <span className="font-mono text-[#B4AFA4] text-xs mt-1 block">
              {new Date(clan.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Roster & Turfs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Members Roster (2 cols) */}
        <div className="lg:col-span-2 border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
          <div className="p-3 border-b border-surface-border flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "copy.app_clans_id_page.clan_members")} ({members.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</th>
                  <th className="px-3 py-2">{t(locale, "copy.app_clans_id_page.clan_rank")}</th>
                  <th className="px-3 py-2 text-center">{t(locale, "common.level")}</th>
                  <th className="px-3 py-2 text-center">{t(locale, "players.hours_played")}</th>
                  <th className="px-3 py-2 text-center">{t(locale, "copy.app_clans_id_manage_clanmanageclient.warns")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {members.map((m, idx) => (
                  <tr key={m.character_id} className="hover:bg-[#131315] transition-colors">
                    <td className="px-3 py-2 font-mono text-[#8F8B83] text-[11px]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <PlayerIdentity
                        username={m.username}
                        factionId={m.faction_id}
                        clanTag={clan.tag}
                        clanColor={clan.tag_color}
                        clanTagStyle={clan.tag_style}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-[#F2EFE8]">
                        {CLAN_RANKS[m.rank] || `Rank ${m.rank}`}
                      </span>
                      {m.is_owner ? (
                        <span className="ml-1.5 text-[10px] text-amber-400 font-mono font-bold">
                          {t(locale, "interface.owner")}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">{m.level}</td>
                    <td className="px-3 py-2 text-center font-mono">{m.hours}h</td>
                    <td className="px-3 py-2 text-center font-mono">
                      {m.warns > 0 ? (
                        <span className="text-red-400 font-bold">{m.warns}/3</span>
                      ) : (
                        <span className="text-[#8F8B83]">0/3</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Controlled Turfs */}
        <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <h2 className="text-xs font-bold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "clans.turfs")} ({turfs.length})
            </h2>
          </div>

          <div className="p-3">
            {turfs.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8F8B83]">
                {t(locale, "copy.app_clans_id_page.this_clan_controls_no_territories")}
              </div>
            ) : (
              <div className="space-y-2">
                {turfs.map((turf) => (
                  <div
                    key={turf.id}
                    className="p-2.5 bg-[#101012] border border-surface-border rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#F2EFE8] block">{turf.name}</span>
                      <span className="text-[11px] text-[#8F8B83] font-mono">{turf.zone}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-800/40 rounded text-[10px] font-mono">
                      {t(locale, "interface.territory")} #{turf.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
