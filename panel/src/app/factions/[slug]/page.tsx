import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { ArrowLeft, Settings, CheckCircle, XCircle } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { CANONICAL_FACTIONS, getFactionColor } from "@/lib/factions";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";

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
  const factionColor = getFactionColor(slug) || "#f1f1f1";

  const [members, leader, appSettings] = await Promise.all([
    dbQuery<MemberRow>(
      `SELECT c.id, a.username, c.job_grade, c.level, c.last_played,
              fm.joined_at,
              cl.tag as clan_tag,
              cl.tag_color as clan_tag_color,
              cl.tag_style as clan_tag_style
       FROM accounts a
       JOIN players p ON p.account_id = a.id
       JOIN characters c ON c.player_id = p.id
       LEFT JOIN faction_membership fm ON fm.character_id = c.id
       LEFT JOIN clan_members cm ON cm.character_id = c.id
       LEFT JOIN clans cl ON cl.id = cm.clan_id
       WHERE c.job = ?
       ORDER BY c.job_grade DESC, c.level DESC, a.id ASC`,
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
       WHERE fl.faction_id = ?
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

          <div className="flex items-center gap-2">
            {canManage && (
              <Link
                href={`/factions/${slug}/manage`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1c] hover:bg-[#222225] border border-surface-border text-[#f1f1f1] font-medium rounded text-xs transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-[#a5a5a8]" />
                <span>{locale === "ro" ? "Panou Lider" : "Faction Panel"}</span>
              </Link>
            )}

            {appsOpen && (
              <Link
                href={`/factions/${slug}/apply`}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition-colors"
              >
                {locale === "ro" ? "Aplică în facțiune" : "Apply to Faction"}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Leader</span>
          <div className="mt-1">
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
              <span className="text-[#6f6f74] italic">Vacant</span>
            )}
          </div>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Type</span>
          <span className="font-semibold text-[#f1f1f1] mt-1 block capitalize">
            {faction.type}
          </span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Active Members</span>
          <span className="font-mono font-bold text-[#f1f1f1] mt-1 block">
            {members.length}
          </span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Applications</span>
          <span className="font-bold text-xs mt-1 block">
            {appsOpen ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> OPEN
              </span>
            ) : (
              <span className="text-[#6f6f74] flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> CLOSED
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Roster Table */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
        <div className="p-3 border-b border-surface-border">
          <h2 className="text-xs font-bold text-[#f1f1f1] uppercase tracking-wider">
            {locale === "ro" ? "Membri Activi" : "Faction Roster"} ({members.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{locale === "ro" ? "Jucător" : "Player"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Rang" : "Rank"}</th>
                <th className="px-3 py-2 text-center">{locale === "ro" ? "Nivel" : "Level"}</th>
                <th className="px-3 py-2 text-right">{locale === "ro" ? "Ultima Activitate" : "Last Active"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                    No members in this faction
                  </td>
                </tr>
              ) : (
                members.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-[#151517] transition-colors">
                    <td className="px-3 py-2 font-mono text-[#6f6f74] text-[11px]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <PlayerIdentity
                        username={m.username}
                        factionId={slug}
                        clanTag={m.clan_tag}
                        clanColor={m.clan_tag_color}
                        clanTagStyle={m.clan_tag_style}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-[#f1f1f1]">
                      Rank {m.job_grade}
                      {m.job_grade >= 7 && <span className="ml-1.5 text-[10px] text-amber-400 font-bold">[LEADER]</span>}
                      {m.job_grade === 6 && <span className="ml-1.5 text-[10px] text-blue-400 font-bold">[CO-LEADER]</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">{m.level}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#6f6f74]">
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
