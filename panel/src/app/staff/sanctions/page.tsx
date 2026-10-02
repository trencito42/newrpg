import { formatDate } from "@/lib/i18n";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { factionIdSql } from "@/lib/faction-sql";
import { AlertOctagon, Filter } from "lucide-react";

interface Props {
  searchParams: Promise<{ action?: string; search?: string }>;
}

export default async function StaffSanctionsPage({ searchParams }: Props) {
  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || (session.adminLevel < 1 && session.helperLevel < 1)) {
    redirect("/staff/dashboard");
  }

  const { action = "", search = "" } = await searchParams;

  let whereClauses: string[] = [];
  const params: unknown[] = [];

  if (action.trim()) {
    whereClauses.push("s.action = ?");
    params.push(action.trim());
  }

  if (search.trim()) {
    whereClauses.push("(s.target_name LIKE ? OR s.admin_name LIKE ? OR s.reason LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sanctions = await dbQuery<RowDataPacket>(
    `SELECT 
      s.id, s.action, s.target_account_id, s.target_character_id, s.target_name, s.target_license,
      s.admin_account_id, s.admin_name, s.reason, s.duration_min, s.created_at,
      COALESCE(a.username, s.target_name) as clean_target_username,
      COALESCE(adm_acc.username, s.admin_name) as clean_admin_username,
      cl.tag as clan_tag, cl.tag_color as clan_tag_color, cl.tag_style as clan_tag_style,
      adm_cl.tag as admin_clan_tag, adm_cl.tag_color as admin_clan_tag_color, adm_cl.tag_style as admin_clan_tag_style,
      ${factionIdSql()} as faction_id,
      ${factionIdSql("adm_c")} as admin_faction_id
     FROM admin_sanctions s
     LEFT JOIN accounts a ON a.id = s.target_account_id
     LEFT JOIN players p ON p.account_id = a.id
     LEFT JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     LEFT JOIN accounts adm_acc ON adm_acc.id = s.admin_account_id
     LEFT JOIN players adm_p ON adm_p.account_id = adm_acc.id
     LEFT JOIN characters adm_c ON adm_c.player_id = adm_p.id
     LEFT JOIN clan_members adm_cm ON adm_cm.character_id = adm_c.id
     LEFT JOIN clans adm_cl ON adm_cl.id = adm_cm.clan_id
     ${whereSql}
     ORDER BY s.id DESC LIMIT 50`,
    params
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {locale === "ro" ? "Jurnal Sancțiuni Staff" : "Staff Sanctions Log"}
          </h1>
          <p className="text-xs text-[#6f6f74] mt-0.5">
            {locale === "ro"
              ? "Toate avertismentele, ban-urile, mute-urile și pedepsele aplicate de moderatori"
              : "Complete moderation sanction history across warns, bans, mutes, and jails"}
          </p>
        </div>

        {/* Filter Form */}
        <form method="GET" className="flex items-center gap-2">
          <select
            name="action"
            defaultValue={action}
            className="px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
          >
            <option value="">Toate tipurile</option>
            <option value="warn">Warn</option>
            <option value="ban">Ban</option>
            <option value="mute">Mute</option>
            <option value="jail">Jail</option>
            <option value="unban">Unban</option>
          </select>
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Caută țintă / admin..."
            className="px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#202023] hover:bg-[#28282c] border border-surface-border rounded text-xs text-[#f1f1f1]"
          >
            Filtrează
          </button>
        </form>
      </div>

      {/* Sanctions Table */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Acțiune</th>
                <th className="px-3 py-2">Jucător Sancționat</th>
                <th className="px-3 py-2">Moderator / Admin</th>
                <th className="px-3 py-2">Motiv & Durată</th>
                <th className="px-3 py-2 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {sanctions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                    Nicio sancțiune găsită
                  </td>
                </tr>
              ) : (
                sanctions.map((s) => (
                  <tr key={s.id} className="hover:bg-[#151517] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#6f6f74]">#{s.id}</td>
                    <td className="px-3 py-2.5 font-mono font-bold uppercase text-[11px]">
                      {s.action === "ban" && <span className="text-red-400">BAN</span>}
                      {s.action === "warn" && <span className="text-amber-400">WARN</span>}
                      {s.action === "mute" && <span className="text-blue-400">MUTE</span>}
                      {s.action === "jail" && <span className="text-purple-400">JAIL</span>}
                      {s.action === "unban" && <span className="text-emerald-400">UNBAN</span>}
                      {s.action === "unjail" && <span className="text-emerald-400">UNJAIL</span>}
                      {s.action === "unmute" && <span className="text-emerald-400">UNMUTE</span>}
                    </td>

                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={s.clean_target_username || s.target_name}
                        factionId={s.faction_id}
                        clanTag={s.clan_tag}
                        clanColor={s.clan_tag_color}
                        clanTagStyle={s.clan_tag_style}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5">
                      <PlayerIdentity
                        username={s.clean_admin_username || s.admin_name}
                        factionId={s.admin_faction_id}
                        clanTag={s.admin_clan_tag}
                        clanColor={s.admin_clan_tag_color}
                        clanTagStyle={s.admin_clan_tag_style}
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="text-[#f1f1f1] block max-w-sm truncate">{s.reason}</span>
                      {s.duration_min && (
                        <span className="text-[10px] text-[#6f6f74] font-mono">
                          Durată: {s.duration_min} min
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono text-[#6f6f74]">
                      {formatDate(s.created_at, locale)}
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
