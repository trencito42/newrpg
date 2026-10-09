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
import { OrganizationFactionLogsPanel } from "@/components/organizations/OrganizationFactionLogsPanel";
import { parseFactionTab } from "@/lib/org-tabs";
import { getFactionAccess } from "@/lib/faction-access";

interface MemberRow extends RowDataPacket {
  id: number;
  username: string;
  job_grade: number;
  level: number;
  joined_at: string | null;
  last_played: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

interface LeaderRow extends RowDataPacket {
  leader_name: string;
  character_id: number;
  assigned_at: string;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
}

interface GradeLabelRow extends RowDataPacket {
  grade: number;
  label: string;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const faction = CANONICAL_FACTIONS[slug];
  if (!faction) notFound();
  const profile = await getOrgProfile("faction", slug);
  const meta = buildMetadata({
    title: faction.label,
    description: `Members, applications, statistics and information for the RACKET RPG ${faction.label}.`,
    path: `/factions/${encodeURIComponent(slug)}`,
  });
  if (profile?.cover_image) {
    return { ...meta, openGraph: { ...meta.openGraph, images: [{ url: profile.cover_image }] } };
  }
  return meta;
}

function FactionCoverFallback({ slug, color }: { slug: string; color: string }) {
  const tint =
    slug === "police"
      ? "from-[#0a1628]/90"
      : slug === "medic"
        ? "from-[#1a0a0a]/90"
        : slug === "sheriff"
          ? "from-[#1c1810]/90"
          : "from-[#0E0E10]";
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${tint} to-[#121214]`}>
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundColor: color }} />
    </div>
  );
}

export default async function FactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: tabRaw } = await searchParams;
  const faction = CANONICAL_FACTIONS[slug];
  if (!faction) notFound();

  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  const factionColor = getFactionColor(slug) || "#F2EFE8";
  const basePath = `/factions/${slug}`;

  const [members, leader, appSettings, profile, gradeLabels, viewerApp, questions] = await Promise.all([
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
    getOrgApplicationSettings("faction", slug),
    getOrgProfile("faction", slug),
    dbQuery<GradeLabelRow>(
      `SELECT grade, label FROM faction_grade_labels WHERE faction_id = ? ORDER BY grade ASC`,
      [slug]
    ),
    getViewerOrgApplication("faction", slug, session?.accountId ?? null),
    getActiveApplicationQuestions("faction", slug),
  ]);

  const canManage = await canManageOrganization(session, "faction", slug);
  const viewerFactionAccess = session ? await getFactionAccess(session.accountId, slug) : null;
  const canViewLogs = Boolean(session && (session.adminLevel >= 3 || viewerFactionAccess));
  const descriptionOverride =
    locale === "ro" ? profile?.description_ro || null : profile?.description_en || null;
  const description = descriptionOverride || t(locale, faction.descriptionKey);
  const rulesMarkdown = (locale === "ro" ? profile?.rules_ro : profile?.rules_en) ?? null;
  const includeRanks = gradeLabels.length > 0;
  const gradeLabelByGrade = new Map(gradeLabels.map((g) => [g.grade, g.label]));
  const tab = parseFactionTab(tabRaw, includeRanks, canViewLogs);

  const isMember = session
    ? members.some((m) => m.username.toLowerCase() === session.username.toLowerCase())
    : false;
  const pendingApp =
    viewerApp && (viewerApp.status === "submitted" || viewerApp.status === "under_review");
  const showApply = appSettings.applications_open && !isMember && !pendingApp;

  const tabs = [
    { id: "overview", label: t(locale, "orgUi.tab_overview") },
    { id: "members", label: t(locale, "orgUi.tab_members") },
    { id: "applications", label: t(locale, "applications.title") },
    { id: "rules", label: t(locale, "orgUi.tab_rules") },
    ...(includeRanks ? [{ id: "ranks", label: t(locale, "orgUi.tab_ranks") }] : []),
    ...(canViewLogs ? [{ id: "logs", label: t(locale, "orgUi.tab_logs") }] : []),
  ];

  const statsRow = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mt-4">
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
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "interface.active_members")}</span>
        <span className="font-mono font-bold text-[#F2EFE8] mt-1.5 block text-base">{members.length}</span>
      </div>
      <div className="p-3.5 bg-[#0E0E10] rounded-xl">
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "interface.type")}</span>
        <span className="font-semibold text-[#F2EFE8] mt-1.5 block capitalize text-sm">{faction.type}</span>
      </div>
      <div className="p-3.5 bg-[#0E0E10] rounded-xl">
        <span className="text-[11px] text-[#8F8B83] uppercase tracking-wider block font-medium">{t(locale, "applications.title")}</span>
        <span className="font-semibold text-xs mt-1.5 block">
          {appSettings.applications_open ? (
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
  );

  const membersTable = (
    <div className="rounded-xl bg-[#0E0E10] overflow-hidden">
      <div className="responsive-table-wrapper">
        <table className="w-full text-left text-xs min-w-[480px]">
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
                <td colSpan={5} className="px-4 py-8 text-center text-[#8F8B83]">
                  {t(locale, "interface.no_members_in_this_faction")}
                </td>
              </tr>
            ) : (
              members.map((m, idx) => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-3.5 py-2.5 font-mono text-[#8F8B83]">{idx + 1}</td>
                  <td className="px-3.5 py-2.5 min-w-0">
                    <PlayerIdentity
                      username={m.username}
                      factionId={slug}
                      clanTag={m.clan_tag}
                      clanColor={m.clan_tag_color}
                      clanTagStyle={m.clan_tag_style}
                      size="sm"
                    />
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[#F2EFE8]">
                    {gradeLabelByGrade.get(m.job_grade) ??
                      `${t(locale, "copy.app_clans_id_manage_clanmanageclient.rank")} ${m.job_grade}`}
                    {(leader?.character_id === m.id || m.job_grade >= 7) && (
                      <span className="ml-1.5 text-[10px] text-amber-400 font-bold">{t(locale, "interface.leader")}</span>
                    )}
                    {leader?.character_id !== m.id && m.job_grade === 6 && (
                      <span className="ml-1.5 text-[10px] text-blue-400 font-bold">{t(locale, "interface.co_leader")}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono">{m.level}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-[#8F8B83]">
                    {m.last_played ? formatDate(m.last_played, locale) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      <Link
        href="/factions"
        className="inline-flex items-center space-x-1.5 text-xs text-[#8F8B83] hover:text-[#F2EFE8] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t(locale, "factions.title")}</span>
      </Link>

      <OrganizationHero
        coverUrl={profile?.cover_image ?? null}
        coverAlt={faction.label}
        fallback={<FactionCoverFallback slug={slug} color={factionColor} />}
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: factionColor }} />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F2EFE8]" style={{ color: factionColor }}>
                  {faction.label}
                </h1>
                <span className="text-[10px] text-[#B4AFA4] font-bold uppercase tracking-wider">
                  {t(locale, faction.factionTypeKey)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#99958E] mt-2 max-w-2xl leading-relaxed">{description}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {canManage && (
                <Link
                  href={`${basePath}/manage`}
                  className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-[#18181B] hover:bg-[#202024] text-[#F2EFE8] font-medium rounded-lg text-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{t(locale, "copy.app_factions_slug_page.faction_panel")}</span>
                </Link>
              )}
              {showApply && (
                <Link
                  href={`${basePath}/apply`}
                  className="px-3.5 py-2.5 min-h-[44px] flex items-center bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs"
                >
                  {t(locale, "copy.app_factions_slug_page.apply_to_faction")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </OrganizationHero>

      <OrganizationTabs basePath={basePath} tabs={tabs} activeTab={tab} accentColor={factionColor} locale={locale} />

      {tab === "overview" && statsRow}
      {tab === "members" && membersTable}
      {tab === "applications" && (
        <div className="rounded-xl bg-[#0E0E10] p-4 sm:p-5">
          <OrganizationApplicationsPanel
            locale={locale}
            orgType="faction"
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
        <OrganizationRulesPanel locale={locale} rulesMarkdown={rulesMarkdown} orgKind="faction" />
      )}
      {tab === "logs" && canViewLogs && (
        <div className="rounded-xl bg-[#0E0E10] p-4 sm:p-5">
          <OrganizationFactionLogsPanel locale={locale} factionSlug={slug} factionColor={factionColor} />
        </div>
      )}
      {tab === "ranks" && includeRanks && (
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden max-w-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#101012] text-[#8F8B83]">
                <th className="px-3 py-2 font-bold uppercase tracking-wider">{t(locale, "orgUi.rank_grade")}</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider">{t(locale, "orgUi.rank_name")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {gradeLabels.map((row) => (
                <tr key={row.grade}>
                  <td className="px-3 py-2 font-mono text-[#8F8B83]">{row.grade}</td>
                  <td className="px-3 py-2 text-[#F2EFE8] font-medium">{row.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
