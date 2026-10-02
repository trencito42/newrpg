import { getCurrentSession, getRequestLanguage } from "@/lib/auth";
import { redirect } from "next/navigation";
import { dbQuery } from "@/lib/db";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import Link from "next/link";
import ComplaintForm from "./ComplaintForm";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { RowDataPacket } from "mysql2";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplaintRow extends RowDataPacket {
  id: number;
  accuser_username: string;
  accused_name: string;
  category: string;
  title: string;
  status: "pending" | "under_review" | "action_taken" | "dismissed";
  reply_count: number;
  created_at: string;
  last_reply_at: string | null;
}

export const dynamic = "force-dynamic";

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; new?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const lang = await getRequestLanguage();
  const { filter = "all", new: showNew } = await searchParams;

  const conditions: string[] = [];
  const queryParams: number[] = [];
  if (session.adminLevel < 1 && session.helperLevel < 1) {
    conditions.push("(c.accuser_account_id = ? OR p_accused.account_id = ?)");
    queryParams.push(session.accountId, session.accountId);
  }
  if (filter === "pending") {
    conditions.push("c.status = 'pending'");
  } else if (filter === "under_review") {
    conditions.push("c.status = 'under_review'");
  } else if (filter === "resolved") {
    conditions.push("c.status IN ('action_taken', 'dismissed')");
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const complaints = await dbQuery<ComplaintRow>(
    `SELECT 
       c.id, c.category, c.title, c.status, c.created_at, c.updated_at,
       acc_user.username AS accuser_username,
       c.accused_name,
       (SELECT COUNT(*) FROM panel_complaint_messages m WHERE m.complaint_id = c.id) AS reply_count,
       (SELECT MAX(created_at) FROM panel_complaint_messages m WHERE m.complaint_id = c.id) AS last_reply_at
     FROM panel_complaints c
     LEFT JOIN accounts acc_user ON acc_user.id = c.accuser_account_id
     LEFT JOIN characters accused_char ON accused_char.id = c.accused_character_id
     LEFT JOIN players p_accused ON p_accused.id = accused_char.player_id
     ${whereSql}
     ORDER BY c.id DESC
     LIMIT 100`,
    queryParams
  );

  // Batch resolve identities
  const names = new Set<string>();
  for (const c of complaints) {
    if (c.accuser_username) names.add(c.accuser_username);
    if (c.accused_name) names.add(c.accused_name);
  }
  const identitiesMap = await resolvePlayerIdentities(Array.from(names));

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "action_taken":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" />
            {lang === "ro" ? "Rezolvată" : "Action Taken"}
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-950/60 text-red-400 border border-red-800/40">
            <XCircle className="w-3 h-3" />
            {lang === "ro" ? "Respinsă" : "Dismissed"}
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <Clock className="w-3 h-3" />
            {lang === "ro" ? "În Revizuire" : "Under Review"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-100 text-[#B4AFA4] border border-surface-border">
            <HelpCircle className="w-3 h-3" />
            {lang === "ro" ? "În Așteptare" : "Pending"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-border gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#F2EFE8]" />
            {lang === "ro" ? "Reclamații Jucători" : "Player Complaints"}
          </h1>
          <p className="text-xs text-[#8F8B83]">
            {lang === "ro"
              ? "Raportează încălcările regulamentului serverului sau urmărește reclamațiile active."
              : "Report rule violations or follow active complaint threads."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <Link
              href={showNew ? "/support/complaints" : "/support/complaints?new=1"}
              className="px-3 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {showNew
                ? (lang === "ro" ? "Ascunde Formular" : "Hide Form")
                : (lang === "ro" ? "Reclamație Nouă" : "New Complaint")}
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 bg-[#101012] hover:bg-[#1A191B] text-[#F2EFE8] border border-surface-border font-semibold rounded text-xs"
            >
              {lang === "ro" ? "Autentifică-te pentru a reclama" : "Log in to file complaint"}
            </Link>
          )}
        </div>
      </div>

      {/* Complaint Filing Form (Collapsible / Active if ?new=1) */}
      {showNew && session && (
        <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#F2EFE8] flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-400" />
            {lang === "ro" ? "Depune o Reclamație Nouă" : "File a New Complaint"}
          </h2>
          <ComplaintForm lang={lang} />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border text-xs">
        <Link
          href="/support/complaints"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "all"
              ? "border-[#F2EFE8] text-[#F2EFE8]"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {lang === "ro" ? "Toate" : "All"}
        </Link>
        <Link
          href="/support/complaints?filter=pending"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "pending"
              ? "border-[#F2EFE8] text-[#F2EFE8]"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {lang === "ro" ? "În Așteptare" : "Pending"}
        </Link>
        <Link
          href="/support/complaints?filter=under_review"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "under_review"
              ? "border-[#F2EFE8] text-[#F2EFE8]"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {lang === "ro" ? "În Revizuire" : "Under Review"}
        </Link>
        <Link
          href="/support/complaints?filter=resolved"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "resolved"
              ? "border-[#F2EFE8] text-[#F2EFE8]"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {lang === "ro" ? "Rezolvate" : "Resolved"}
        </Link>
      </div>

      {/* Dense Complaints Thread Index */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">{lang === "ro" ? "Reclamat" : "Reported"}</th>
                <th className="px-3 py-2.5">{lang === "ro" ? "Reclamant" : "Reporter"}</th>
                <th className="px-3 py-2.5">{lang === "ro" ? "Motiv / Titlu" : "Reason / Title"}</th>
                <th className="px-3 py-2.5">{lang === "ro" ? "Status" : "Status"}</th>
                <th className="px-3 py-2.5 text-center">{lang === "ro" ? "Răspunsuri" : "Replies"}</th>
                <th className="px-3 py-2.5">{lang === "ro" ? "Data Creării" : "Created"}</th>
                <th className="px-3 py-2.5">{lang === "ro" ? "Ultimul Răspuns" : "Last Reply"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {lang === "ro" ? "Nicio reclamație găsită." : "No complaints found."}
                  </td>
                </tr>
              ) : (
                complaints.map((c) => {
                  const reportedIdentity = identitiesMap.get(c.accused_name?.toLowerCase());
                  const reporterIdentity = identitiesMap.get(c.accuser_username?.toLowerCase());

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#131315] transition-colors group cursor-pointer"
                    >
                      <td className="px-3 py-2.5 font-mono text-[#8F8B83]">
                        <Link
                          href={`/support/complaints/${c.id}`}
                          className="font-bold text-[#F2EFE8] hover:underline"
                        >
                          #{c.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        {reportedIdentity ? (
                          <PlayerIdentity {...reportedIdentity} size="sm" />
                        ) : (
                          <span className="font-semibold text-[#F2EFE8]">{c.accused_name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {reporterIdentity ? (
                          <PlayerIdentity {...reporterIdentity} size="sm" />
                        ) : (
                          <span className="text-[#B4AFA4]">{c.accuser_username}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/support/complaints/${c.id}`}
                          className="block hover:underline"
                        >
                          <span className="font-semibold text-[#F2EFE8] block max-w-xs truncate">
                            {c.title}
                          </span>
                          <span className="text-[11px] text-[#8F8B83] uppercase font-mono">
                            {c.category.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{getStatusBadge(c.status)}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-[#B4AFA4]">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-[#8F8B83]" />
                          {c.reply_count}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#8F8B83]">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#8F8B83]">
                        {formatDate(c.last_reply_at || c.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
