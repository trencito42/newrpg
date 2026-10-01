import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  ShieldAlert,
  Radio,
  LifeBuoy,
  FileText,
  UserX,
  History,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";

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
      <div className="p-8 text-center max-w-md mx-auto mt-16 space-y-4 bg-surface-200 border border-red-500/30 rounded-2xl shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-white">
          {lang === "ro" ? "Acces Restricționat Staff" : "Staff Access Restricted"}
        </h1>
        <p className="text-xs text-gray-400 leading-relaxed">
          {lang === "ro"
            ? "Această zonă este rezervată exclusiv administratorilor și helperilor oficiali ai serverului. Tentativa de acces neautorizat a fost înregistrată în jurnalul de audit."
            : "This administrative area is restricted to official server administrators and helpers. Unauthorized access attempts are audited."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-lg bg-brand text-gray-950 hover:bg-brand-600 transition-colors"
        >
          {lang === "ro" ? "Înapoi la Panou" : "Return to Panel"}
        </Link>
      </div>
    );
  }

  // 1. Fetch moderation queues
  const openTickets = await query<OpenTicketRecord>(
    `SELECT t.id, t.subject AS title, t.department AS category, COALESCE(NULLIF(CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')), ' '), 'Account') as creator_name, t.created_at
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
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-surface-200 to-surface-200 border border-amber-500/30 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-brand text-xs font-bold uppercase tracking-widest mb-1.5">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{lang === "ro" ? "Dispecerat Administrativ" : "Administrative Operations"}</span>
            </div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {lang === "ro" ? "Centru de Moderare Staff" : "Staff Moderation Center"}
              </h1>
              <Badge variant="brand" className="font-mono text-xs font-bold">
                {user.adminLevel > 0 ? `Admin Lvl ${user.adminLevel}` : `Helper Lvl ${user.helperLevel}`}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
              {lang === "ro"
                ? "Gestionarea rapoartelor cetățenilor, deciziilor pe reclamații, apelurilor de debanare și auditul activității administrative."
                : "Active moderation of support tickets, player complaints, unban requests, and real-time sanction logs."}
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-surface-100/80 border border-surface-border px-3 py-1.5 rounded-xl text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-gray-200">Staff Active</span>
          </div>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={lang === "ro" ? "Tichete Suport Deschise" : "Open Helpdesk Tickets"}
          value={openTickets.length}
          icon={LifeBuoy}
          variant="amber"
        />
        <StatCard
          title={lang === "ro" ? "Reclamații În Așteptare" : "Pending Complaints"}
          value={pendingComplaints.length}
          icon={FileText}
          variant="rose"
        />
        <StatCard
          title={lang === "ro" ? "Cereri Debanare Active" : "Pending Unban Appeals"}
          value={pendingUnbans.length}
          icon={UserX}
          variant="sky"
        />
      </div>

      {/* Moderation Queues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Tickets Queue */}
        <Card className="p-5 bg-surface-200 border-surface-border shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
            <div className="flex items-center space-x-2">
              <LifeBuoy className="w-4 h-4 text-brand" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-white">
                {lang === "ro" ? "Tichete Suport" : "Tickets Awaiting Staff"}
              </h2>
            </div>
            <Badge variant="brand" className="font-mono text-[10px]">{openTickets.length}</Badge>
          </div>

          {openTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1 opacity-70" />
              <p className="text-xs">
                {lang === "ro" ? "Toate tichetele au primit răspuns." : "No open tickets pending."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {openTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/support/tickets/${t.id}`}
                  className="block p-3 rounded-xl bg-surface-100/70 hover:bg-surface-100 border border-surface-border hover:border-brand/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-brand font-mono">#{t.id}</span>
                    <span className="text-[10px] text-gray-400">{t.creator_name}</span>
                  </div>
                  <p className="text-xs font-semibold text-white truncate">{t.title}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Complaints Queue */}
        <Card className="p-5 bg-surface-200 border-surface-border shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-rose-400" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-white">
                {lang === "ro" ? "Reclamații Jucători" : "Complaints to Review"}
              </h2>
            </div>
            <Badge variant="warning" className="font-mono text-[10px]">{pendingComplaints.length}</Badge>
          </div>

          {pendingComplaints.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1 opacity-70" />
              <p className="text-xs">
                {lang === "ro" ? "Nicio reclamație în așteptare." : "No pending player complaints."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingComplaints.map((c) => (
                <Link
                  key={c.id}
                  href="/support/complaints"
                  className="block p-3 rounded-xl bg-surface-100/70 hover:bg-surface-100 border border-surface-border hover:border-rose-500/40 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">vs {c.accused_name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.category}</Badge>
                  </div>
                  <p className="text-xs text-gray-300 truncate">{c.title}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Unban Queue */}
        <Card className="p-5 bg-surface-200 border-surface-border shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
            <div className="flex items-center space-x-2">
              <UserX className="w-4 h-4 text-sky-400" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-white">
                {lang === "ro" ? "Cereri Debanare" : "Unban Appeals"}
              </h2>
            </div>
            <Badge variant="danger" className="font-mono text-[10px]">{pendingUnbans.length}</Badge>
          </div>

          {pendingUnbans.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1 opacity-70" />
              <p className="text-xs">
                {lang === "ro" ? "Nu există cereri de debanare." : "No pending unban appeals."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingUnbans.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-surface-100/70 border border-surface-border space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-brand font-bold">Account #{u.account_id}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{u.reason}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Game Sanctions & Web Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Sanctions Log */}
        <Card className="p-5 bg-surface-200 border-surface-border shadow-lg">
          <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-surface-border/60">
            <History className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === "ro" ? "Ultimele Sancțiuni In-Game" : "Recent In-Game Sanctions"}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border/60 text-[10px] uppercase font-bold text-gray-400 text-left">
                  <th className="pb-2.5">{lang === "ro" ? "Acțiune" : "Action"}</th>
                  <th className="pb-2.5">{lang === "ro" ? "Jucător" : "Target"}</th>
                  <th className="pb-2.5">{lang === "ro" ? "Admin" : "Admin"}</th>
                  <th className="pb-2.5">{lang === "ro" ? "Motiv" : "Reason"}</th>
                  <th className="pb-2.5 text-right">{lang === "ro" ? "Dată" : "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {recentSanctions.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-100/50 transition-colors">
                    <td className="py-2.5">
                      <span className="font-mono font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-surface-100 border border-surface-border text-brand">
                        {s.action}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-white">{s.target_name}</td>
                    <td className="py-2.5 text-gray-300 font-mono">{s.admin_name}</td>
                    <td className="py-2.5 text-gray-400 max-w-[130px] truncate">{s.reason}</td>
                    <td className="py-2.5 text-right text-[10px] text-gray-500 font-mono">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Panel Web Audit Log */}
        <Card className="p-5 bg-surface-200 border-surface-border shadow-lg">
          <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-surface-border/60">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === "ro" ? "Jurnal Audit Web (Panel)" : "Panel Web Audit Log"}
            </h2>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">
              {lang === "ro" ? "Nu există acțiuni web înregistrate în audit." : "No web audit actions logged yet."}
            </p>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-surface-100/60 border border-surface-border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-brand uppercase text-[11px]">{a.action}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-gray-300 text-[11px]">
                    Actor: <span className="font-mono font-bold text-white">Acc #{a.actor_account_id}</span> | Target:{" "}
                    <span className="font-bold text-white">{a.target_entity} #{a.target_id || "-"}</span>
                  </div>
                  {a.reason && <p className="text-[11px] text-gray-400 italic">"{a.reason}"</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
