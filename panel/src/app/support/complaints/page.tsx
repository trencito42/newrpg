import { getCurrentSession, getRequestLanguage } from "@/lib/auth";
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
  const lang = await getRequestLanguage();
  const { filter = "all", new: showNew } = await searchParams;

  let statusFilterSql = "";
  if (filter === "pending") {
    statusFilterSql = "WHERE c.status = 'pending'";
  } else if (filter === "under_review") {
    statusFilterSql = "WHERE c.status = 'under_review'";
  } else if (filter === "resolved") {
    statusFilterSql = "WHERE c.status IN ('action_taken', 'dismissed')";
  }

  const complaints = await dbQuery<ComplaintRow>(
    `SELECT 
       c.id, c.category, c.title, c.status, c.created_at, c.updated_at,
       acc_user.username AS accuser_username,
       c.accused_name,
       (SELECT COUNT(*) FROM panel_complaint_messages m WHERE m.complaint_id = c.id) AS reply_count,
       (SELECT MAX(created_at) FROM panel_complaint_messages m WHERE m.complaint_id = c.id) AS last_reply_at
     FROM panel_complaints c
     LEFT JOIN accounts acc_user ON acc_user.id = c.accuser_account_id
     ${statusFilterSql}
     ORDER BY c.id DESC
     LIMIT 100`
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-neutral-900 text-[#a5a5a8] border border-surface-border">
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
          <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#f1f1f1]" />
            {lang === "ro" ? "Reclamații Jucători" : "Player Complaints"}
          </h1>
          <p className="text-xs text-[#6f6f74]">
            {lang === "ro"
              ? "Raportează încălcările regulamentului serverului sau urmărește reclamațiile active."
              : "Report rule violations or follow active complaint threads."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <Link
              href={showNew ? "/support/complaints" : "/support/complaints?new=1"}
              className="px-3 py-1.5 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-bold rounded text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {showNew
                ? (lang === "ro" ? "Ascunde Formular" : "Hide Form")
                : (lang === "ro" ? "Reclamație Nouă" : "New Complaint")}
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 bg-[#141416] hover:bg-[#1a1a1d] text-[#f1f1f1] border border-surface-border font-semibold rounded text-xs"
            >
              {lang === "ro" ? "Autentifică-te pentru a reclama" : "Log in to file complaint"}
            </Link>
          )}
        </div>
      </div>

      {/* Complaint Filing Form (Collapsible / Active if ?new=1) */}
      {showNew && session && (
        <div className="border border-surface-border rounded bg-[#101011] p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#f1f1f1] flex items-center gap-1.5">
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
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {lang === "ro" ? "Toate" : "All"}
        </Link>
        <Link
          href="/support/complaints?filter=pending"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "pending"
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {lang === "ro" ? "În Așteptare" : "Pending"}
        </Link>
        <Link
          href="/support/complaints?filter=under_review"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "under_review"
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {lang === "ro" ? "În Revizuire" : "Under Review"}
        </Link>
        <Link
          href="/support/complaints?filter=resolved"
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            filter === "resolved"
              ? "border-[#f1f1f1] text-[#f1f1f1]"
              : "border-transparent text-[#6f6f74] hover:text-[#a5a5a8]"
          )}
        >
          {lang === "ro" ? "Rezolvate" : "Resolved"}
        </Link>
      </div>

      {/* Dense Complaints Thread Index */}
      <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
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
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#6f6f74]">
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
                      className="hover:bg-[#151517] transition-colors group cursor-pointer"
                    >
                      <td className="px-3 py-2.5 font-mono text-[#6f6f74]">
                        <Link
                          href={`/support/complaints/${c.id}`}
                          className="font-bold text-[#f1f1f1] hover:underline"
                        >
                          #{c.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        {reportedIdentity ? (
                          <PlayerIdentity {...reportedIdentity} size="sm" />
                        ) : (
                          <span className="font-semibold text-[#f1f1f1]">{c.accused_name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {reporterIdentity ? (
                          <PlayerIdentity {...reporterIdentity} size="sm" />
                        ) : (
                          <span className="text-[#a5a5a8]">{c.accuser_username}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/support/complaints/${c.id}`}
                          className="block hover:underline"
                        >
                          <span className="font-semibold text-[#f1f1f1] block max-w-xs truncate">
                            {c.title}
                          </span>
                          <span className="text-[11px] text-[#6f6f74] uppercase font-mono">
                            {c.category.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{getStatusBadge(c.status)}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-[#a5a5a8]">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-[#6f6f74]" />
                          {c.reply_count}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#6f6f74]">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#6f6f74]">
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
