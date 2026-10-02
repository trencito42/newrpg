import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { Users, Flag, Shield, CheckCircle, XCircle } from "lucide-react";
import { factionIdSql } from "@/lib/faction-sql";

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {locale === "ro" ? "Clanuri" : "Clans"}
          </h1>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {locale === "ro"
              ? "Organizații create de jucători, teritorii controlate și aplicații de recrutare"
              : "Player-created organizations, controlled territories, and recruitment applications"}
          </p>
        </div>

        {/* Search */}
        <form method="GET" className="flex items-center gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder={locale === "ro" ? "Caută clan sau tag..." : "Search clan or tag..."}
            className="px-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] focus:outline-none focus:border-[#B4AFA4]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#211D18] hover:bg-[#302A1E] border border-surface-border rounded text-xs text-[#F2EFE8] font-medium transition-colors"
          >
            {locale === "ro" ? "Caută" : "Search"}
          </button>
        </form>
      </div>

      {/* Clans Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2">Tag & {locale === "ro" ? "Nume" : "Name"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Lider" : "Leader"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Membri" : "Members"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Teritorii" : "Turfs"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Aplicații" : "Applications"}</th>
                <th className="px-3 py-2 text-right">{locale === "ro" ? "Acțiuni" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {clans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {locale === "ro" ? "Nu a fost găsit niciun clan" : "No clans found"}
                  </td>
                </tr>
              ) : (
                clans.map((clan) => (
                  <tr key={clan.id} className="hover:bg-[#131315] transition-colors">
                    <td className="px-3 py-2.5">
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

                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={clan.owner_username}
                        factionId={clan.owner_faction_id}
                        clanTag={clan.tag}
                        clanColor={clan.tag_color}
                        clanTagStyle={clan.tag_style}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono">
                      {clan.member_count} / {clan.max_members}
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono">
                      {clan.turfs_count > 0 ? (
                        <span className="text-amber-400 font-semibold">{clan.turfs_count}</span>
                      ) : (
                        <span className="text-[#8F8B83]">0</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {clan.applications_open ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[10px] font-medium">
                          <CheckCircle className="w-3 h-3" />
                          {locale === "ro" ? "DESCHISE" : "OPEN"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-100 text-[#8F8B83] border border-surface-border rounded text-[10px] font-medium">
                          <XCircle className="w-3 h-3" />
                          {locale === "ro" ? "ÎNCHISE" : "CLOSED"}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {clan.applications_open === 1 && (
                          <Link
                            href={`/clans/${clan.id}/apply`}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-[#F2EFE8] font-medium rounded text-xs transition-colors"
                          >
                            {locale === "ro" ? "Aplică" : "Apply"}
                          </Link>
                        )}
                        <Link
                          href={`/clans/${clan.id}`}
                          className="px-2.5 py-1 bg-[#1A191B] hover:bg-[#27231B] border border-surface-border text-[#F2EFE8] font-medium rounded text-xs transition-colors"
                        >
                          {locale === "ro" ? "Detalii" : "View"}
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
