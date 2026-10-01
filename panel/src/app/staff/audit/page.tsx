import { formatDate } from "@/lib/i18n";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { History } from "lucide-react";

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export default async function StaffAuditPage({ searchParams }: Props) {
  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  const { search = "" } = await searchParams;

  let whereClause = "";
  const params: unknown[] = [];

  if (search.trim()) {
    whereClause = "WHERE pal.action LIKE ? OR actor_acc.username LIKE ? OR target_acc.username LIKE ? OR pal.reason LIKE ?";
    params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
  }

  const logs = await dbQuery<RowDataPacket>(
    `SELECT 
      pal.id, pal.actor_account_id, pal.actor_character_id, pal.action,
      pal.target_entity, pal.target_id, pal.reason, pal.details, pal.created_at,
      actor_acc.username as actor_username,
      target_acc.username as target_username
     FROM panel_audit_log pal
     LEFT JOIN accounts actor_acc ON actor_acc.id = pal.actor_account_id
     LEFT JOIN accounts target_acc ON target_acc.id = pal.target_id
     ${whereClause}
     ORDER BY pal.id DESC LIMIT 60`,
    params
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
            {locale === "ro" ? "Audit Log Administrativ" : "Administrative Audit Log"}
          </h1>
          <p className="text-xs text-[#6f6f74] mt-0.5">
            {locale === "ro"
              ? "Jurnal detaliat al tuturor acțiunilor web și comenzilor de securitate executate"
              : "Detailed log of all web panel actions and executed domain commands"}
          </p>
        </div>

        {/* Search */}
        <form method="GET" className="flex items-center gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder={locale === "ro" ? "Caută în audit log..." : "Search audit logs..."}
            className="px-2.5 py-1.5 bg-[#141416] border border-surface-border rounded text-xs text-[#f1f1f1]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#202023] hover:bg-[#28282c] border border-surface-border rounded text-xs text-[#f1f1f1]"
          >
            {locale === "ro" ? "Caută" : "Search"}
          </button>
        </form>
      </div>

      {/* Audit Table */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{locale === "ro" ? "Actor Staff" : "Staff Actor"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Acțiune" : "Action"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Țintă" : "Target"}</th>
                <th className="px-3 py-2">{locale === "ro" ? "Motiv / Detalii" : "Reason / Details"}</th>
                <th className="px-3 py-2 text-right">{locale === "ro" ? "Data & Ora" : "Timestamp"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
                    {locale === "ro" ? "Nicio înregistrare în audit log" : "No audit records found"}
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#151517] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#6f6f74]">#{l.id}</td>
                    <td className="px-3 py-2.5">
                      {l.actor_username ? (
                        <PlayerIdentity username={l.actor_username} size="sm" />
                      ) : (
                        <span className="text-[#6f6f74]">SYSTEM</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[#f1f1f1]">
                      {l.action}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.target_username ? (
                        <PlayerIdentity username={l.target_username} size="sm" />
                      ) : l.target_id ? (
                        <span className="font-mono text-[#6f6f74]">ID #{l.target_id}</span>
                      ) : (
                        <span className="text-[#6f6f74]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[#f1f1f1] block max-w-sm truncate">{l.reason || "—"}</span>
                      {l.details && (
                        <span className="text-[10px] text-[#6f6f74] font-mono block max-w-sm truncate">
                          {l.details}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#6f6f74]">
                      {formatDate(l.created_at, locale)}
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
