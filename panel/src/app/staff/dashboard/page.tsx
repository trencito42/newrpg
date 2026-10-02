import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import Link from "next/link";
import { Lock } from "lucide-react";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { resolvePlayerIdentities } from "@/lib/player-identity";

interface OpenTicketRecord {
  id: number;
  title: string;
  category: string;
  creator_name: string;
  created_at: string;
}

interface PendingComplaintRecord {
  id: number;
  accused_name: string;
  category: string;
  title: string;
  created_at: string;
}

interface PendingUnbanRecord {
  id: number;
  account_id: number;
  reason: string;
  created_at: string;
}

interface AdminSanctionRecord {
  id: number;
  action: string;
  target_name: string;
  admin_name: string;
  reason: string;
  duration_min: number | null;
  created_at: string;
}

interface PanelAuditRecord {
  id: number;
  actor_account_id: number;
  actor_name: string | null;
  action: string;
  target_entity: string;
  target_id: number | null;
  reason: string | null;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function StaffDashboardPage() {
  const user = await getCurrentUser();
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  // Authorization check: Admin > 0 or Helper > 0
  if (!user || (user.adminLevel === 0 && user.helperLevel === 0)) {
    return (
      <div className="p-6 text-center max-w-sm mx-auto mt-12 space-y-3 bg-surface-100 border border-surface-border rounded">
        <div className="w-10 h-10 rounded bg-surface-200 border border-surface-border flex items-center justify-center mx-auto text-[#B4AFA4]">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-base font-bold text-[#F2EFE8]">
          {lang === "ro" ? "Acces Restricționat" : "Access Restricted"}
        </h1>
        <p className="text-xs text-[#8F8B83]">
          {lang === "ro" ? "Această pagină este rezervată membrilor staff." : "This page is reserved for staff members."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded bg-[#D7B558] text-[#08080A] hover:bg-[#E3C572] transition-colors"
        >
          {lang === "ro" ? "Înapoi" : "Return"}
        </Link>
      </div>
    );
  }

  // 1. Fetch moderation queues
  const openTickets = await query<OpenTicketRecord>(
    `SELECT t.id, t.subject AS title, t.department AS category, COALESCE(a.username, 'Player') as creator_name, t.created_at
     FROM panel_support_tickets t
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.status = 'open'
     ORDER BY t.id ASC
     LIMIT 10`
  );

  const pendingComplaints = await query<PendingComplaintRecord>(
    `SELECT id, accused_name, category, title, created_at
     FROM panel_complaints
     WHERE status = 'pending'
     ORDER BY id ASC
     LIMIT 10`
  );

  const pendingUnbans = await query<PendingUnbanRecord>(
    `SELECT id, account_id, reason, created_at
     FROM panel_unban_requests
     WHERE status = 'pending'
     ORDER BY id ASC
     LIMIT 10`
  );

  // 2. Fetch recent in-game sanctions
  const recentSanctions = await query<AdminSanctionRecord>(
    `SELECT id, action, target_name, admin_name, reason, duration_min, created_at
     FROM admin_sanctions
     ORDER BY id DESC
     LIMIT 10`
  );

  // 3. Fetch panel audit log
  const auditLogs = await query<PanelAuditRecord>(
    `SELECT pal.id, pal.actor_account_id, actor.username AS actor_name, pal.action,
            pal.target_entity, pal.target_id, pal.reason, pal.created_at
     FROM panel_audit_log pal
     LEFT JOIN accounts actor ON actor.id = pal.actor_account_id
     ORDER BY pal.id DESC
     LIMIT 10`
  );
  const identities = await resolvePlayerIdentities([
    ...openTickets.map((t) => t.creator_name),
    ...pendingComplaints.map((c) => c.accused_name),
    ...recentSanctions.flatMap((s) => [s.target_name, s.admin_name]),
    ...auditLogs.map((a) => a.actor_name).filter((name): name is string => Boolean(name)),
  ]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
            {lang === "ro" ? "Panel Staff" : "Staff Panel"}
          </h1>
          <span className="font-mono text-xs text-[#B4AFA4] px-2 py-0.5 rounded bg-surface-200 border border-surface-border">
            {user.adminLevel > 0 ? `Admin ${user.adminLevel}` : `Helper ${user.helperLevel}`}
          </span>
        </div>
      </div>

      {/* Moderation Queues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tickets */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F2EFE8]">{lang === "ro" ? "Tichete Deschise" : "Open Tickets"}</span>
            <span className="font-mono text-[#8F8B83]">{openTickets.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {openTickets.map((t) => (
              <Link
                key={t.id}
                href={`/support/tickets/${t.id}`}
                className="p-2.5 px-3 block hover:bg-surface-200/50 transition-colors"
              >
                <div className="flex items-center justify-between text-[#8F8B83] text-[11px]">
                  <span>#{t.id} • <PlayerIdentity {...identities.get(t.creator_name.toLowerCase())!} size="sm" clickable={false} /></span>
                </div>
                <p className="font-medium text-[#F2EFE8] truncate mt-0.5">{t.title}</p>
              </Link>
            ))}
            {openTickets.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{lang === "ro" ? "Niciun tichet deschis." : "No open tickets."}</div>
            )}
          </div>
        </div>

        {/* Complaints */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F2EFE8]">{lang === "ro" ? "Reclamații" : "Complaints"}</span>
            <span className="font-mono text-[#8F8B83]">{pendingComplaints.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {pendingComplaints.map((c) => (
              <Link
                key={c.id}
                href="/support/complaints"
                className="p-2.5 px-3 block hover:bg-surface-200/50 transition-colors"
              >
                <div className="flex items-center justify-between text-[#8F8B83] text-[11px]">
                  <span>vs <PlayerIdentity {...identities.get(c.accused_name.toLowerCase())!} size="sm" clickable={false} /></span>
                  <span className="capitalize">{c.category}</span>
                </div>
                <p className="font-medium text-[#F2EFE8] truncate mt-0.5">{c.title}</p>
              </Link>
            ))}
            {pendingComplaints.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{lang === "ro" ? "Nicio reclamație." : "No complaints."}</div>
            )}
          </div>
        </div>

        {/* Unbans */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F2EFE8]">{lang === "ro" ? "Cereri Debanare" : "Unban Appeals"}</span>
            <span className="font-mono text-[#8F8B83]">{pendingUnbans.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {pendingUnbans.map((u) => (
              <div key={u.id} className="p-2.5 px-3">
                <span className="font-mono text-[#F2EFE8] text-[11px]">Account #{u.account_id}</span>
                <p className="text-[#B4AFA4] text-xs line-clamp-2 mt-0.5">{u.reason}</p>
              </div>
            ))}
            {pendingUnbans.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{lang === "ro" ? "Nicio cerere de debanare." : "No unban appeals."}</div>
            )}
          </div>
        </div>
      </div>

      {/* Sanctions & Web Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Game Sanctions */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#F2EFE8]">
            {lang === "ro" ? "Sancțiuni Recente" : "Recent Sanctions"}
          </div>

          <div className="responsive-table-wrapper">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-[#8F8B83] border-b border-surface-border bg-surface-200/50">
                <tr>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Target</th>
                  <th className="py-2 px-3">Admin</th>
                  <th className="py-2 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50 text-[#B4AFA4]">
                {recentSanctions.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-200/40">
                    <td className="py-2 px-3 font-medium text-[#F2EFE8] capitalize">{s.action}</td>
                    <td className="py-2 px-3 text-[#F2EFE8]"><PlayerIdentity {...identities.get(s.target_name.toLowerCase())!} size="sm" /></td>
                    <td className="py-2 px-3 text-[#8F8B83]"><PlayerIdentity {...identities.get(s.admin_name.toLowerCase())!} size="sm" /></td>
                    <td className="py-2 px-3 text-[#8F8B83] max-w-[160px] truncate">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Web Audit Log */}
        <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border text-xs font-semibold text-[#F2EFE8]">
            {lang === "ro" ? "Jurnal Audit Panel" : "Panel Audit Log"}
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {auditLogs.map((a) => (
              <div key={a.id} className="p-2.5 px-3 flex items-center justify-between text-[#B4AFA4]">
                <div>
                  <span className="font-semibold text-[#F2EFE8]">{a.action}</span>
                  <span className="text-[#8F8B83] ml-2">by {a.actor_name ? <PlayerIdentity {...identities.get(a.actor_name.toLowerCase())!} size="sm" clickable={false} /> : `Acc #${a.actor_account_id}`} on {a.target_entity} #{a.target_id || "-"}</span>
                  {a.reason && <p className="text-[11px] text-[#8F8B83] italic mt-0.5">"{a.reason}"</p>}
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="p-4 text-center text-[#8F8B83]">{lang === "ro" ? "Nicio acțiune în audit." : "No audit entries."}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
