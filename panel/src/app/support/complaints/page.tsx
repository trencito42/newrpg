import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import Link from "next/link";
import ComplaintForm from "./ComplaintForm";
import { PlayerName } from "@/components/ui/PlayerName";

interface ComplaintRecord {
  id: number;
  accuser_account_id: number;
  accused_name: string;
  category: string;
  title: string;
  evidence_text: string;
  status: "pending" | "under_review" | "action_taken" | "dismissed";
  verdict: string | null;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const user = await getCurrentUser();
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  const complaints = await query<ComplaintRecord>(
    `SELECT id, accuser_account_id, accused_name, category, title, evidence_text, status, verdict, created_at
     FROM panel_complaints
     ORDER BY id DESC
     LIMIT 50`
  );

  const getStatusText = (status: string) => {
    switch (status) {
      case "action_taken":
        return <span className="text-emerald-400 font-medium">Action Taken</span>;
      case "dismissed":
        return <span className="text-red-400 font-medium">Dismissed</span>;
      case "under_review":
        return <span className="text-amber-400 font-medium">Under Review</span>;
      default:
        return <span className="text-[#6f6f74] font-medium">Pending</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {lang === "ro" ? "Reclamații" : "Complaints"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Column */}
        <div className="lg:col-span-1 space-y-3">
          <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              {lang === "ro" ? "Reclamație Nouă" : "File Complaint"}
            </h2>

            {user ? (
              <ComplaintForm lang={lang} />
            ) : (
              <div className="text-center py-4 text-[#6f6f74]">
                <p className="mb-2">Log in to file a complaint.</p>
                <Link
                  href="/login"
                  className="inline-flex px-3 py-1 bg-[#f1f1f1] text-[#0b0b0c] font-semibold rounded text-xs"
                >
                  Log In
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Complaints List */}
        <div className="lg:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-[#f1f1f1]">
            <span>{lang === "ro" ? "Reclamații Recente" : "Recent Complaints"}</span>
            <span className="font-mono text-[#6f6f74]">{complaints.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {complaints.map((c) => (
              <div key={c.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[#6f6f74]">#{c.id}</span>
                    <span className="font-semibold text-[#f1f1f1]">{c.title}</span>
                  </div>
                  <div>{getStatusText(c.status)}</div>
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-[#6f6f74]">
                  <span>Accused: <PlayerName name={c.accused_name} /></span>
                  <span>•</span>
                  <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
                  <span>•</span>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>

                <p className="text-[#a5a5a8] text-xs line-clamp-2">
                  {c.evidence_text}
                </p>

                {c.verdict && (
                  <div className="p-2 bg-surface-200 rounded border border-surface-border text-[11px] text-[#f1f1f1]">
                    <span className="text-[#6f6f74] font-medium block">Verdict:</span>
                    <p>{c.verdict}</p>
                  </div>
                )}
              </div>
            ))}

            {complaints.length === 0 && (
              <div className="p-6 text-center text-[#6f6f74]">
                {lang === "ro" ? "Nicio reclamație." : "No complaints."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
