import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  // Server-side strict authorization check: Admin > 0 or Helper > 0
  if (!user || (user.adminLevel === 0 && user.helperLevel === 0)) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto mt-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 text-xl font-bold">
          !
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {lang === "ro" ? "Acces Restricționat Staff" : "Staff Access Restricted"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {lang === "ro"
            ? "Această zonă este rezervată exclusiv administratorilor și helperilor oficiali ai serverului. Acțiunea a fost înregistrată."
            : "This administrative area is restricted to official server administrators and helpers. Access attempts are audited."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-md bg-accent text-accent-foreground"
        >
          {lang === "ro" ? "Înapoi la Panou" : "Return to Panel"}
        </Link>
      </div>
    );
  }

  // 1. Fetch moderation queues
  const openTickets = await query<OpenTicketRecord>(
    `SELECT t.id, t.title, t.category, COALESCE(c.name, 'Account') as creator_name, t.created_at
     FROM panel_support_tickets t
     LEFT JOIN characters c ON t.character_id = c.id
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
     LIMIT 12`
  );

  // 3. Fetch panel audit log
  const auditLogs = await query<PanelAuditRecord>(
    `SELECT id, actor_account_id, action, target_entity, target_id, reason, created_at
     FROM panel_audit_log
     ORDER BY id DESC
     LIMIT 12`
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {lang === "ro" ? "Centru de Moderare Staff" : "Staff Moderation Center"}
            </h1>
            <Badge variant="accent">
              {user.adminLevel > 0 ? `Admin Lvl ${user.adminLevel}` : `Helper Lvl ${user.helperLevel}`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {lang === "ro"
              ? "Gestionarea rapoartelor, apelurilor de debanare, reclamațiilor și jurnalele administrative de audit."
              : "Management of helpdesk tickets, unban appeals, player complaints, and administrative audit logs."}
          </p>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={lang === "ro" ? "Tichete Suport Deschise" : "Open Helpdesk Tickets"}
          value={openTickets.length}
        />
        <StatCard
          label={lang === "ro" ? "Reclamații În Așteptare" : "Pending Complaints"}
          value={pendingComplaints.length}
        />
        <StatCard
          label={lang === "ro" ? "Cereri Debanare Active" : "Pending Unban Appeals"}
          value={pendingUnbans.length}
        />
      </div>

      {/* Moderation Queues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Tickets Queue */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground">
              {lang === "ro" ? "Tichete Necesită Răspuns" : "Tickets Awaiting Staff"}
            </h2>
            <Badge variant="neutral">{openTickets.length}</Badge>
          </div>

          {openTickets.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {lang === "ro" ? "Toate tichetele au primit răspuns." : "No open tickets pending."}
            </p>
          ) : (
            <div className="space-y-2">
              {openTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/support/tickets/${t.id}`}
                  className="block p-2.5 rounded bg-muted/20 hover:bg-muted/40 border border-border/30 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-accent font-mono">#{t.id}</span>
                    <span className="text-[10px] text-muted-foreground">{t.creator_name}</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Complaints Queue */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground">
              {lang === "ro" ? "Reclamații de Analizat" : "Complaints to Review"}
            </h2>
            <Badge variant="warning">{pendingComplaints.length}</Badge>
          </div>

          {pendingComplaints.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {lang === "ro" ? "Nicio reclamație în așteptare." : "No pending player complaints."}
            </p>
          ) : (
            <div className="space-y-2">
              {pendingComplaints.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded bg-muted/20 border border-border/30 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">vs {c.accused_name}</span>
                    <Badge variant="neutral">{c.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.title}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Unban Queue */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground">
              {lang === "ro" ? "Cereri Debanare" : "Unban Appeals"}
            </h2>
            <Badge variant="danger">{pendingUnbans.length}</Badge>
          </div>

          {pendingUnbans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {lang === "ro" ? "Nu există cereri active de debanare." : "No pending unban appeals."}
            </p>
          ) : (
            <div className="space-y-2">
              {pendingUnbans.map((u) => (
                <div
                  key={u.id}
                  className="p-2.5 rounded bg-muted/20 border border-border/30 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-accent font-bold">Account #{u.account_id}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{u.reason}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Game Sanctions & Web Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Sanctions Log */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">
            {lang === "ro" ? "Ultimele Sancțiuni In-Game" : "Recent In-Game Sanctions"}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-[10px] uppercase font-semibold text-muted-foreground text-left">
                  <th className="pb-2">{lang === "ro" ? "Acțiune" : "Action"}</th>
                  <th className="pb-2">{lang === "ro" ? "Jucător" : "Target"}</th>
                  <th className="pb-2">{lang === "ro" ? "Admin" : "Admin"}</th>
                  <th className="pb-2">{lang === "ro" ? "Motiv" : "Reason"}</th>
                  <th className="pb-2 text-right">{lang === "ro" ? "Dată" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {recentSanctions.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/10">
                    <td className="py-2">
                      <span className="font-mono font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-muted">
                        {s.action}
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-foreground">{s.target_name}</td>
                    <td className="py-2 text-muted-foreground">{s.admin_name}</td>
                    <td className="py-2 text-muted-foreground max-w-[140px] truncate">{s.reason}</td>
                    <td className="py-2 text-right text-[10px] text-muted-foreground font-mono">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Panel Web Audit Log */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">
            {lang === "ro" ? "Jurnal Audit Web (Panel)" : "Panel Web Audit Log"}
          </h2>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {lang === "ro" ? "Nu există acțiuni web înregistrate în audit." : "No web audit actions logged yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((a) => (
                <div key={a.id} className="p-2.5 rounded bg-muted/20 border border-border/30 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-accent uppercase text-[11px]">{a.action}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Actor: <span className="font-mono font-semibold text-foreground">Acc #{a.actor_account_id}</span> | Target:{" "}
                    <span className="font-semibold text-foreground">{a.target_entity} #{a.target_id || "-"}</span>
                  </div>
                  {a.reason && <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{a.reason}"</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
