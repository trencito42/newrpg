// i18n-ignore-file: english-only seo and staff forum UI
import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { CANONICAL_FACTIONS, getFactionColor } from "@/lib/factions";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { factionIdSql } from "@/lib/faction-sql";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Factions", description: "Explore RACKET RPG factions, members, leaders and applications.", path: "/factions" });

interface FactionMemberCountRow extends RowDataPacket {
  job: string;
  member_count: number;
}

interface FactionLeaderRow extends RowDataPacket {
  faction_id: string;
  character_id: number;
  leader_name: string;
}

export default async function FactionsPage() {
  const locale = await getViewerLocale();

  const [memberCounts, leaders] = await Promise.all([
    dbQuery<FactionMemberCountRow>(
      `SELECT fm.faction_id AS job, COUNT(*) AS member_count
       FROM faction_membership fm
       JOIN characters c ON c.id = fm.character_id
       WHERE fm.faction_id IN (?) AND ${factionIdSql()} = fm.faction_id
       GROUP BY fm.faction_id`,
      [Object.keys(CANONICAL_FACTIONS)]
    ),
    dbQuery<FactionLeaderRow>(
      `SELECT fl.faction_id, fl.character_id,
              a.username AS leader_name
       FROM faction_leaders fl
       JOIN characters c ON c.id = fl.character_id
       JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id COLLATE utf8mb4_unicode_ci = fl.faction_id COLLATE utf8mb4_unicode_ci
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       WHERE ${factionIdSql()} = fm.faction_id`
    ),
  ]);

  const countMap = new Map<string, number>();
  memberCounts.forEach((r) => countMap.set(r.job, Number(r.member_count) || 0));

  const leaderMap = new Map<string, { character_id: number; leader_name: string }>();
  leaders.forEach((r) => leaderMap.set(r.faction_id, { character_id: r.character_id, leader_name: r.leader_name }));
  const identities = await resolvePlayerIdentities(leaders.map((r) => r.leader_name));

  const factionList = Object.values(CANONICAL_FACTIONS).map((f) => ({
    ...f,
    memberCount: countMap.get(f.id) || 0,
    leader: leaderMap.get(f.id) || null,
  }));

  return (
    <div className="space-y-4">
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "factions.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {factionList.map((f) => {
          const factionColor = getFactionColor(f.id) || "#F2EFE8";
          return (
            <Link
              key={f.id}
              href={`/factions/${f.id}`}
              className="p-4 bg-[#0E0E10] hover:bg-[#141417] rounded-xl transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: factionColor }}
                    />
                    <span
                      className="font-bold text-sm"
                      style={{ color: factionColor }}
                    >
                      {f.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8F8B83] font-medium uppercase tracking-wider">
                    {t(locale, f.factionTypeKey)}
                  </span>
                </div>

                <p className="text-xs text-[#99958E] mt-2 line-clamp-2 leading-relaxed">
                  {t(locale, f.descriptionKey)}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs text-[#8F8B83]">
                <span>
                  {t(locale, "copy.app_clans_id_page.leader")}{" "}
                  {f.leader ? (
                    <PlayerIdentity {...identities.get(f.leader.leader_name.toLowerCase())!} factionId={f.id} clickable={false} />
                  ) : (
                    <span className="text-[#8F8B83] italic">{t(locale, "interface.vacant")}</span>
                  )}
                </span>
                <span className="font-mono text-[#B4AFA4] text-xs">
                  {f.memberCount} {t(locale, "interface.members")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
