import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Users, Flag, Shield, CheckCircle, XCircle } from "lucide-react";
import { factionIdSql } from "@/lib/faction-sql";
import { t } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.clans_title"),
    description: t(locale, "seo.clans_description"),
    path: "/clans",
  });
}


interface ClanRow extends RowDataPacket {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  tag_color: string;
  owner_username: string;
  owner_faction_id: string | null;
  member_count: number;
  max_members: number;
  turfs_count: number;
  applications_open: number;
}

export default async function ClansPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const locale = await getViewerLocale();
  const { search = "" } = await searchParams;

  let sql = `
    SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      acc.username as owner_username,
      ${factionIdSql("ch")} as owner_faction_id,
      (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) as member_count,
      c.max_members,
      (SELECT COUNT(*) FROM turfs t WHERE t.owner_clan_id = c.id) as turfs_count,
      COALESCE(s.applications_open, 0) as applications_open
    FROM clans c
    JOIN characters ch ON ch.id = c.owner_character_id
    JOIN players p ON p.id = ch.player_id
    JOIN accounts acc ON acc.id = p.account_id
    LEFT JOIN panel_org_application_settings s ON s.org_type = 'clan' AND s.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci
  `;

  const params: unknown[] = [];
  if (search.trim()) {
    sql += ` WHERE c.name LIKE ? OR c.tag LIKE ? OR acc.username LIKE ?`;
    params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
  }

  sql += ` ORDER BY turfs_count DESC, member_count DESC, c.id ASC LIMIT 50`;

  const clans = await dbQuery<ClanRow>(sql, params);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">
            {t(locale, "clans.title")}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "copy.app_clans_page.player_created_organizations_controlled_territories_and_recruitment_applica")}
          </p>
        </div>

        {/* Search */}
        <form method="GET" className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder={t(locale, "copy.app_clans_page.search_clan_or_tag")}
            className="w-full min-w-0 px-3 py-2 sm:py-1.5 bg-[#0E0E10] rounded-lg text-xs text-[#F2EFE8] placeholder:text-[#5A5852] focus:outline-none focus:ring-1 focus:ring-[#D7B558]"
          />
          <button
            type="submit"
            className="px-3.5 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 bg-[#18181B] hover:bg-[#222226] rounded-lg text-xs text-[#F2EFE8] font-medium transition-colors"
          >
            {t(locale, "common.search")}
          </button>
        </form>
      </div>

      {/* Clans Table */}
      <div className="rounded-xl bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#121214] text-[#8F8B83] font-semibold text-[11px]">
                <th className="px-3.5 py-2.5">{t(locale, "interface.tag")} {t(locale, "copy.app_clans_page.name")}</th>
                <th className="px-3.5 py-2.5">{t(locale, "clans.leader")}</th>
                <th className="px-3.5 py-2.5 text-center">{t(locale, "clans.members")}</th>
                <th className="px-3.5 py-2.5 text-center">{t(locale, "copy.app_clans_id_page.turfs")}</th>
                <th className="px-3.5 py-2.5 text-center">{t(locale, "applications.title")}</th>
                <th className="px-3.5 py-2.5 text-right">{t(locale, "common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {clans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {t(locale, "copy.app_clans_page.no_clans_found")}
                  </td>
                </tr>
              ) : (
                clans.map((clan) => (
                  <tr key={clan.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          style={{ color: clan.tag_color || "#f59e0b" }}
                          className="font-mono font-bold text-sm tracking-tight"
                        >
                          [{clan.tag}]
                        </span>
                        <Link
                          href={`/clans/${clan.id}`}
                          className="font-semibold text-[#F2EFE8] hover:underline"
                        >
                          {clan.name}
                        </Link>
                      </div>
                      {clan.description && (
                        <p className="text-[11px] text-[#8F8B83] truncate max-w-xs mt-0.5">
                          {clan.description}
                        </p>
                      )}
                    </td>

                    <td className="px-3.5 py-3">
                      <PlayerIdentity
                        username={clan.owner_username}
                        factionId={clan.owner_faction_id}
                        clanTag={clan.tag}
                        clanColor={clan.tag_color}
                        clanTagStyle={clan.tag_style}
                        size="sm"
                      />
                    </td>

                    <td className="px-3.5 py-3 text-center font-mono text-[#F2EFE8]">
                      {clan.member_count} / {clan.max_members}
                    </td>

                    <td className="px-3.5 py-3 text-center font-mono">
                      {clan.turfs_count > 0 ? (
                        <span className="text-amber-400 font-semibold">{clan.turfs_count}</span>
                      ) : (
                        <span className="text-[#8F8B83]">0</span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-center">
                      {clan.applications_open ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">
                          <CheckCircle className="w-3 h-3" />
                          {t(locale, "copy.app_clans_id_page.open")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.04] text-[#8F8B83] rounded text-[10px] font-medium">
                          <XCircle className="w-3 h-3" />
                          {t(locale, "copy.app_clans_id_page.closed")}
                        </span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {clan.applications_open === 1 && (
                          <Link
                            href={`/clans/${clan.id}/apply`}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors"
                          >
                            {t(locale, "copy.app_clans_page.apply")}
                          </Link>
                        )}
                        <Link
                          href={`/clans/${clan.id}`}
                          className="px-2.5 py-1 bg-[#18181B] hover:bg-[#202024] text-[#F2EFE8] font-medium rounded-lg text-xs transition-colors"
                        >
                          {t(locale, "copy.app_clans_page.view")}
                        </Link>
                      </div>
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
