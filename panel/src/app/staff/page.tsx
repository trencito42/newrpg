import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { PlayerName } from "@/components/ui/PlayerName";
import { getFactionLabel } from "@/lib/factions";

interface StaffRow extends RowDataPacket {
  id: number;
  username: string;
  admin_level: number;
  helper_level: number;
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

  const [admins, helpers, leaders] = await Promise.all([
    dbQuery<StaffRow>(
      `SELECT id, username, admin_level, helper_level, created_at
       FROM accounts
       WHERE admin_level > 0
       ORDER BY admin_level DESC, id ASC`
    ),
    dbQuery<StaffRow>(
      `SELECT id, username, admin_level, helper_level, created_at
       FROM accounts
       WHERE helper_level > 0 AND admin_level = 0
       ORDER BY helper_level DESC, id ASC`
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
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {t(locale, "staff.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Administrators */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs">
            <span className="font-semibold text-[#f1f1f1]">{t(locale, "staff.admins")}</span>
            <span className="font-mono text-[#6f6f74]">{admins.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs text-[#a5a5a8]">
            {admins.map((a) => (
              <div key={a.id} className="p-2.5 px-3 flex items-center justify-between">
                <span className="font-semibold text-[#f1f1f1]">{a.username}</span>
                <span className="font-mono text-[11px] text-[#6f6f74]">{getAdminTitle(a.admin_level)}</span>
              </div>
            ))}
            {admins.length === 0 && (
              <div className="p-4 text-center text-[#6f6f74]">No administrators.</div>
            )}
          </div>
        </div>

        {/* Helpers */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs">
            <span className="font-semibold text-[#f1f1f1]">{t(locale, "staff.helpers")}</span>
            <span className="font-mono text-[#6f6f74]">{helpers.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs text-[#a5a5a8]">
            {helpers.map((h) => (
              <div key={h.id} className="p-2.5 px-3 flex items-center justify-between">
                <span className="font-semibold text-[#f1f1f1]">{h.username}</span>
                <span className="font-mono text-[11px] text-[#6f6f74]">{getHelperTitle(h.helper_level)}</span>
              </div>
            ))}
            {helpers.length === 0 && (
              <div className="p-4 text-center text-[#6f6f74]">No helpers.</div>
            )}
          </div>
        </div>

        {/* Faction Leaders */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs">
            <span className="font-semibold text-[#f1f1f1]">{t(locale, "staff.leaders")}</span>
            <span className="font-mono text-[#6f6f74]">{leaders.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs text-[#a5a5a8]">
            {leaders.map((l) => (
              <div key={l.faction_id} className="p-2.5 px-3 flex items-center justify-between">
                <PlayerName name={l.leader_name} factionId={l.faction_id} />
                <span className="text-[11px] text-[#6f6f74] font-medium">{getFactionLabel(l.faction_id)}</span>
              </div>
            ))}
            {leaders.length === 0 && (
              <div className="p-4 text-center text-[#6f6f74]">No faction leaders.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
