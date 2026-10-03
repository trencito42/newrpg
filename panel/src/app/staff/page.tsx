import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { PlayerName } from "@/components/ui/PlayerName";
import { getFactionLabel } from "@/lib/factions";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { Shield, HandHeart, Feather, Award } from "lucide-react";

interface StaffRow extends RowDataPacket {
  id: number;
  username: string;
  admin_level: number;
  helper_level: number;
  is_author: number;
  created_at: string;
}

interface LeaderRow extends RowDataPacket {
  faction_id: string;
  character_id: number;
  leader_name: string;
  assigned_at: string;
}

export default async function StaffPage() {
  const locale = await getViewerLocale();

  const [admins, helpers, authors, leaders] = await Promise.all([
    dbQuery<StaffRow>(
      `SELECT id, username, admin_level, helper_level, COALESCE(is_author, 0) as is_author, created_at
       FROM accounts
       WHERE admin_level > 0
       ORDER BY admin_level DESC, id ASC`
    ),
    dbQuery<StaffRow>(
      `SELECT id, username, admin_level, helper_level, COALESCE(is_author, 0) as is_author, created_at
       FROM accounts
       WHERE helper_level > 0
       ORDER BY helper_level DESC, id ASC`
    ),
    dbQuery<StaffRow>(
      `SELECT id, username, admin_level, helper_level, COALESCE(is_author, 0) as is_author, created_at
       FROM accounts
       WHERE is_author > 0
       ORDER BY id ASC`
    ),
    dbQuery<LeaderRow>(
      `SELECT fl.faction_id, fl.character_id, fl.assigned_at, a.username AS leader_name
       FROM faction_leaders fl
       JOIN characters c ON c.id = fl.character_id
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       ORDER BY fl.faction_id ASC`
    ),
  ]);

  const allNames = [
    ...admins.map((a) => a.username),
    ...helpers.map((h) => h.username),
    ...authors.map((au) => au.username),
    ...leaders.map((l) => l.leader_name),
  ];
  const identities = await resolvePlayerIdentities(allNames);

  const getAdminTitle = (level: number) => {
    switch (level) {
      case 6:
        return "Admin 6 (Owner)";
      case 5:
        return "Admin 5 (Head Admin)";
      case 4:
        return "Admin 4 (Senior Admin)";
      case 3:
        return "Admin 3 (Lead Admin)";
      case 2:
        return "Admin 2 (Admin)";
      case 1:
        return "Admin 1 (Junior Admin)";
      default:
        return `Admin ${level}`;
    }
  };

  const getHelperTitle = (level: number) => {
    switch (level) {
      case 3:
        return "Helper 3 (Senior)";
      case 2:
        return "Helper 2 (Advanced)";
      case 1:
        return "Helper 1";
      default:
        return `Helper ${level}`;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "staff.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Administrators */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#121214] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="font-bold text-[#F2EFE8]">{t(locale, "staff.admins")}</span>
            </div>
            <span className="font-mono text-xs text-[#8F8B83] px-2 py-0.5 rounded bg-white/[0.04]">{admins.length}</span>
          </div>

          <div className="divide-y divide-white/[0.04] text-xs text-[#B4AFA4] p-1">
            {admins.map((a) => (
              <div key={a.id} className="p-2.5 px-3 flex items-center justify-between hover:bg-white/[0.02] rounded-lg transition-colors">
                <PlayerIdentity {...identities.get(a.username.toLowerCase())!} size="sm" />
                <span className="font-mono text-[11px] text-red-400 font-medium">{getAdminTitle(a.admin_level)}</span>
              </div>
            ))}
            {admins.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{t(locale, "interface.no_administrators")}</div>
            )}
          </div>
        </div>

        {/* Helpers */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#121214] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HandHeart className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-[#F2EFE8]">{t(locale, "staff.helpers")}</span>
            </div>
            <span className="font-mono text-xs text-[#8F8B83] px-2 py-0.5 rounded bg-white/[0.04]">{helpers.length}</span>
          </div>

          <div className="divide-y divide-white/[0.04] text-xs text-[#B4AFA4] p-1">
            {helpers.map((h) => (
              <div key={h.id} className="p-2.5 px-3 flex items-center justify-between hover:bg-white/[0.02] rounded-lg transition-colors">
                <PlayerIdentity {...identities.get(h.username.toLowerCase())!} size="sm" />
                <span className="font-mono text-[11px] text-sky-400 font-medium">{getHelperTitle(h.helper_level)}</span>
              </div>
            ))}
            {helpers.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{t(locale, "interface.no_helpers")}</div>
            )}
          </div>
        </div>

        {/* Faction Leaders */}
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#121214] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#D7B558]" />
              <span className="font-bold text-[#F2EFE8]">{t(locale, "staff.leaders")}</span>
            </div>
            <span className="font-mono text-xs text-[#8F8B83] px-2 py-0.5 rounded bg-white/[0.04]">{leaders.length}</span>
          </div>

          <div className="divide-y divide-white/[0.04] text-xs text-[#B4AFA4] p-1">
            {leaders.map((l) => (
              <div key={l.faction_id} className="p-2.5 px-3 flex items-center justify-between hover:bg-white/[0.02] rounded-lg transition-colors">
                <PlayerName
                  name={l.leader_name}
                  factionId={l.faction_id}
                  clanTag={identities.get(l.leader_name.toLowerCase())?.clanTag}
                  clanColor={identities.get(l.leader_name.toLowerCase())?.clanColor}
                  clanTagStyle={identities.get(l.leader_name.toLowerCase())?.clanTagStyle}
                />
                <span className="text-[11px] text-[#8F8B83] font-medium">{getFactionLabel(l.faction_id)}</span>
              </div>
            ))}
            {leaders.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{t(locale, "interface.no_faction_leaders")}</div>
            )}
          </div>
        </div>
      </div>

      {/* Official Authors / Content Creators */}
      {authors.length > 0 && (
        <div className="rounded-xl bg-[#0E0E10] overflow-hidden">
          <div className="p-3.5 bg-[#121214] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Feather className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-[#F2EFE8]">{t(locale, "interface.official_authors_creators")}</span>
            </div>
            <span className="font-mono text-xs text-[#8F8B83] px-2 py-0.5 rounded bg-white/[0.04]">{authors.length}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3">
            {authors.map((au) => (
              <div key={au.id} className="p-3 bg-[#121214] rounded-lg flex items-center justify-between">
                <PlayerIdentity {...identities.get(au.username.toLowerCase())!} size="sm" />
                <span className="text-[11px] text-purple-400 font-medium px-2 py-0.5 bg-purple-500/10 rounded">
                  {t(locale, "interface.author")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
