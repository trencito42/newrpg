import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import { ArrowLeft, Settings, CheckCircle, XCircle } from "lucide-react";
import { t, formatDate } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { getOrgProfile } from "@/lib/org-profile";
import { canManageOrganization } from "@/lib/org-management-permissions";
import {
  getActiveApplicationQuestions,
  getOrgApplicationSettings,
  getViewerOrgApplication,
} from "@/lib/org-applications-public";
import { OrganizationHero } from "@/components/organizations/OrganizationHero";
import { OrganizationTabs } from "@/components/organizations/OrganizationTabs";
import { OrganizationApplicationsPanel } from "@/components/organizations/OrganizationApplicationsPanel";
import { OrganizationRulesPanel } from "@/components/organizations/OrganizationRulesPanel";
import { parseClanTab } from "@/lib/org-tabs";

interface Context {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { id } = await params;
  const clanId = Number(id);
  if (!Number.isSafeInteger(clanId) || clanId < 1) notFound();
  const clan = await dbQuerySingle<RowDataPacket>(
    `SELECT c.name, c.tag, c.description,
            (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count
     FROM clans c WHERE c.id = ? LIMIT 1`,
    [clanId]
  );
  if (!clan) notFound();
  const profile = await getOrgProfile("clan", String(clanId));
  const meta = buildMetadata({
    title: `[${clan.tag}] ${clan.name}`,
    description: clan.description || `${clan.member_count} members in the RACKET RPG clan ${clan.name}.`,
    path: `/clans/${clanId}`,
  });
  if (profile?.cover_image) {
    return { ...meta, openGraph: { ...meta.openGraph, images: [{ url: profile.cover_image }] } };
  }
  return meta;
}

function ClanCoverFallback({ tag, color }: { tag: string; color: string }) {
  return (
    <div className="absolute inset-0 bg-[#0E0E10]">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="font-mono text-6xl sm:text-8xl font-black opacity-[0.06]" style={{ color }}>
          [{tag}]
        </span>
      </div>
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundColor: color }} />
    </div>
  );
}

export default async function ClanDetailPage({ params, searchParams }: Context) {
  const { id: idStr } = await params;
  const { tab: tabRaw } = await searchParams;
  const clanId = Number(idStr);
  if (!Number.isSafeInteger(clanId) || clanId < 1) notFound();

  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  const basePath = `/clans/${clanId}`;
  const tab = parseClanTab(tabRaw);

  const clan = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      c.owner_character_id, c.motd, c.max_members, c.created_at, c.rank_labels,
      acc.username as owner_username, ${factionIdSql("ch")} as owner_faction_id,
      (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) as member_count,
      (SELECT COUNT(*) FROM turfs t WHERE t.owner_clan_id = c.id) as turfs_count
     FROM clans c
     JOIN characters ch ON ch.id = c.owner_character_id
     JOIN players p ON p.id = ch.player_id
     JOIN accounts acc ON acc.id = p.account_id
     WHERE c.id = ? LIMIT 1`,
    [clanId]
  );

  if (!clan) notFound();

  const orgId = String(clanId);

  const [members, turfs, appSettings, profile, viewerApp, questions, canManage] = await Promise.all([
    dbQuery<RowDataPacket>(
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
    ),
    dbQuery<RowDataPacket>(
      `SELECT id, name, radius, payout, respect_payout FROM turfs WHERE owner_clan_id = ? ORDER BY name ASC`,
      [clanId]
    ),
    getOrgApplicationSettings("clan", orgId),
    getOrgProfile("clan", orgId),
    getViewerOrgApplication("clan", orgId, session?.accountId ?? null),
    getActiveApplicationQuestions("clan", orgId),
    canManageOrganization(session, "clan", orgId),
  ]);

  let userRank = 0;
  if (session) {
    const myMember = members.find((m) => m.account_id === session.accountId);
    if (myMember) userRank = Number(myMember.rank) || 0;
  }

  const tagColor = clan.tag_color || "#f59e0b";
  const descriptionOverride =
    locale === "ro" ? profile?.description_ro || null : profile?.description_en || null;
  const description = descriptionOverride || clan.description;
  const rulesMarkdown = (locale === "ro" ? profile?.rules_ro : profile?.rules_en) ?? null;

  const pendingApp =
    viewerApp && (viewerApp.status === "submitted" || viewerApp.status === "under_review");
  const showApply = appSettings.applications_open && userRank === 0 && !pendingApp;

  const tabs = [
    { id: "overview", label: t(locale, "orgUi.tab_overview") },
    { id: "members", label: t(locale, "orgUi.tab_members") },
    { id: "applications", label: t(locale, "applications.title") },
    { id: "rules", label: t(locale, "orgUi.tab_rules") },
    { id: "turfs", label: t(locale, "copy.app_clans_id_page.turfs") },
  ];

  const statsRow = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
      <div className="p-3.5 bg-[#0E0E10] rounded-xl">
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block">{t(locale, "clans.members")}</span>
        <span className="font-mono font-bold text-[#F2EFE8] text-base mt-1 block">
          {clan.member_count} / {clan.max_members}
        </span>
      </div>
      <div className="p-3.5 bg-[#0E0E10] rounded-xl">
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block">{t(locale, "copy.app_clans_id_page.turfs")}</span>
        <span className="font-mono font-bold text-amber-400 text-base mt-1 block">{clan.turfs_count}</span>
      </div>
      <div className="p-3.5 bg-[#0E0E10] rounded-xl">
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block">{t(locale, "applications.title")}</span>
        <span className="mt-1 block text-sm font-semibold">
          {appSettings.applications_open ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {t(locale, "copy.app_clans_id_page.open")}
            </span>
          ) : (
            <span className="text-[#8F8B83] flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> {t(locale, "copy.app_clans_id_page.closed")}
            </span>
          )}
        </span>
      </div>
      <div className="p-3.5 bg-[#0E0E10] rounded-xl">
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block">{t(locale, "copy.app_clans_id_page.created_at")}</span>
        <span className="font-mono text-[#B4AFA4] text-xs mt-1 block">
          {formatDate(clan.created_at, locale)}
        </span>
      </div>
    </div>
  );

  const membersTable = (
    <div className="rounded-xl bg-[#0E0E10] overflow-hidden">
      <div className="responsive-table-wrapper">
        <table className="w-full text-left text-xs min-w-[520px]">
          <thead>
            <tr className="bg-[#101012] text-[#8F8B83] font-semibold">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</th>
              <th className="px-3 py-2">{t(locale, "copy.app_clans_id_page.clan_rank")}</th>
              <th className="px-3 py-2 text-center">{t(locale, "common.level")}</th>
              <th className="px-3 py-2 text-center">{t(locale, "players.hours_played")}</th>
              <th className="px-3 py-2 text-center">{t(locale, "copy.app_clans_id_manage_clanmanageclient.warns")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {members.map((m, idx) => (
              <tr key={m.character_id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-mono text-[#8F8B83]">{idx + 1}</td>
                <td className="px-3 py-2 min-w-0">
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
                  <span className="font-medium text-[#F2EFE8]">{CLAN_RANKS[m.rank] || `Rank ${m.rank}`}</span>
                  {m.is_owner ? (
                    <span className="ml-1.5 text-[10px] text-amber-400 font-mono font-bold">{t(locale, "interface.owner")}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-center font-mono">{m.level}</td>
                <td className="px-3 py-2 text-center font-mono">{m.hours}h</td>
                <td className="px-3 py-2 text-center font-mono">
                  {m.warns > 0 ? <span className="text-red-400 font-bold">{m.warns}/3</span> : <span className="text-[#8F8B83]">0/3</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const turfsPanel = (
    <div className="rounded-xl bg-[#0E0E10] p-4 space-y-3 text-xs">
      <p className="text-[#8F8B83]">
        {t(locale, "orgUi.turfs_total", { count: turfs.length })}
      </p>
      {turfs.length === 0 ? (
        <p className="text-[#8F8B83] py-4">{t(locale, "copy.app_clans_id_page.this_clan_controls_no_territories")}</p>
      ) : (
        <div className="space-y-2">
          {turfs.map((turf) => (
            <div key={turf.id} className="p-3 bg-[#121214] rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-semibold text-[#F2EFE8]">{turf.name}</span>
              <div className="flex flex-wrap gap-3 font-mono text-[10px] text-[#8F8B83]">
                <span>${Number(turf.payout || 0).toLocaleString()}</span>
                <span>+{turf.respect_payout ?? 0} RP</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 w-full">
      <Link
        href="/clans"
        className="inline-flex items-center gap-1.5 text-xs text-[#8F8B83] hover:text-[#F2EFE8]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t(locale, "clans.title")}</span>
      </Link>

      <OrganizationHero
        coverUrl={profile?.cover_image ?? null}
        coverAlt={clan.name}
        fallback={<ClanCoverFallback tag={clan.tag} color={tagColor} />}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ color: tagColor }} className="font-mono font-bold text-2xl tracking-tight">
                [{clan.tag}]
              </span>
              <h1 className="text-xl font-bold text-[#F2EFE8]">{clan.name}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#8F8B83] mt-2">
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
            {clan.motd && (
              <p className="font-mono text-amber-300/90 text-xs mt-2">
                <span className="font-bold text-[#8F8B83]">MOTD:</span> {clan.motd}
              </p>
            )}
            {description && <p className="text-xs text-[#99958E] mt-2 max-w-2xl leading-relaxed">{description}</p>}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {canManage && (
              <Link
                href={`${basePath}/manage`}
                className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-[#1A191B] hover:bg-[#27231B] text-[#F2EFE8] font-medium rounded-lg text-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{t(locale, "copy.app_clans_id_page.clan_panel")}</span>
              </Link>
            )}
            {showApply && (
              <Link
                href={`${basePath}/apply`}
                className="px-3 py-2.5 min-h-[44px] flex items-center bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs"
              >
                {t(locale, "copy.app_clans_id_page.apply_to_clan")}
              </Link>
            )}
          </div>
        </div>
      </OrganizationHero>

      <OrganizationTabs basePath={basePath} tabs={tabs} activeTab={tab} accentColor={tagColor} locale={locale} />

      {tab === "overview" && statsRow}
      {tab === "members" && membersTable}
      {tab === "applications" && (
        <div className="rounded-xl bg-[#0E0E10] p-4 sm:p-5">
          <OrganizationApplicationsPanel
            locale={locale}
            orgType="clan"
            orgPath={basePath}
            applyPath={`${basePath}/apply`}
            settings={appSettings}
            viewerApplication={viewerApp ? { id: viewerApp.id, status: viewerApp.status } : null}
            questions={questions.map((q) => ({
              id: Number(q.id),
              label_en: String(q.label_en),
              label_ro: String(q.label_ro),
            }))}
            showApplyCta={showApply}
          />
        </div>
      )}
      {tab === "rules" && (
        <OrganizationRulesPanel locale={locale} rulesMarkdown={rulesMarkdown} orgKind="clan" />
      )}
      {tab === "turfs" && turfsPanel}
    </div>
  );
}
