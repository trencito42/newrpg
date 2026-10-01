import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import ComplaintForm from "./ComplaintForm";
import { ShieldAlert, AlertTriangle, FileText, CheckCircle2, Clock, Scale, AlertCircle } from "lucide-react";

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "action_taken":
        return <Badge variant="success">{lang === "ro" ? "Sancționat" : "Action Taken"}</Badge>;
      case "dismissed":
        return <Badge variant="danger">{lang === "ro" ? "Respins" : "Dismissed"}</Badge>;
      case "under_review":
        return <Badge variant="warning">{lang === "ro" ? "În Verificare" : "Under Review"}</Badge>;
      default:
        return <Badge variant="default">{lang === "ro" ? "În Așteptare" : "Pending"}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    const map: Record<string, { ro: string; en: string }> = {
      deathmatch: { ro: "Deathmatch (DM)", en: "Deathmatch (DM)" },
      powergaming: { ro: "Powergaming (PG)", en: "Powergaming (PG)" },
      metagaming: { ro: "Metagaming (MG)", en: "Metagaming (MG)" },
      insults: { ro: "Limbaj vulgar / Jigniri", en: "Insults / Verbal Abuse" },
      cheating: { ro: "Coduri / Hack-uri", en: "Cheats / Hacks" },
      faction_abuse: { ro: "Abuz Funcție Facțiune", en: "Faction Abuse" },
      other: { ro: "Altă încălcare", en: "Other Rulebreak" },
    };
    return map[category]?.[lang] || category;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500/15 via-surface-200 to-surface-200 border border-red-500/30 p-6 sm:p-8 shadow-xl">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-red-400 text-xs font-bold uppercase tracking-widest mb-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>{lang === "ro" ? "Departament Reclamații" : "Complaints Department"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {lang === "ro" ? "Reclamații Jucători" : "Player Complaints"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">
              {lang === "ro"
                ? "Reclamă încălcările de regulament împotriva altor jucători pe baza dovezilor clare. Echipa administrativă analizează fiecare caz."
                : "Report rule violations and misconduct against other players backed by clear evidence. Staff reviews all cases objectively."}
            </p>
          </div>
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 items-center justify-center text-red-400 font-black text-xl shadow-inner">
            <Scale className="w-7 h-7" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Complaint Form (if logged in) */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 border-surface-border bg-surface-200 shadow-lg">
            <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-surface-border/60">
              <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  {lang === "ro" ? "Depune o Reclamație" : "File a Complaint"}
                </h2>
                <span className="text-[10px] text-gray-400 block">
                  {lang === "ro" ? "Raportează un jucător" : "Report a rulebreaker"}
                </span>
              </div>
            </div>

            {user ? (
              <ComplaintForm lang={lang} />
            ) : (
              <div className="text-center py-6 border border-dashed border-surface-border rounded-xl p-4 bg-surface-100/50">
                <AlertTriangle className="w-6 h-6 text-brand mx-auto mb-2" />
                <p className="text-xs text-gray-300 mb-3">
                  {lang === "ro"
                    ? "Trebuie să fii autentificat pentru a depune o reclamație."
                    : "You must be logged in to file a complaint."}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-lg bg-brand text-gray-950 hover:bg-brand-600 transition-colors"
                >
                  {dict.auth.login}
                </Link>
              </div>
            )}
          </Card>

          {/* Guidelines Card */}
          <Card className="p-5 bg-surface-200 border-surface-border shadow-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand mb-3 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{lang === "ro" ? "Ghid Reclamații" : "Complaint Guidelines"}</span>
            </h3>
            <ul className="text-xs text-gray-400 space-y-2.5 list-disc list-inside leading-relaxed">
              <li>
                {lang === "ro"
                  ? "Dovezile mai vechi de 24h nu sunt luate în considerare."
                  : "Evidence older than 24 hours is considered invalid."}
              </li>
              <li>
                {lang === "ro"
                  ? "Videoclipurile nu trebuie să fie editate sau tăiate din context."
                  : "Videos must not be edited or cropped out of context."}
              </li>
              <li>
                {lang === "ro"
                  ? "Limbajul vulgar în textul reclamației atrage respingerea automată."
                  : "Offensive language in the appeal results in instant dismissal."}
              </li>
            </ul>
          </Card>
        </div>

        {/* Right Column: Complaints List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === "ro" ? "Reclamații Recente" : "Recent Complaints"}
            </h2>
            <span className="text-xs text-gray-400 font-mono bg-surface-100 px-2 py-0.5 rounded border border-surface-border">
              {complaints.length} {lang === "ro" ? "înregistrări" : "records"}
            </span>
          </div>

          {complaints.length === 0 ? (
            <Card className="p-12 text-center text-gray-400 border-surface-border bg-surface-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-gray-200">
                {lang === "ro" ? "Nicio reclamație activă." : "No player complaints found."}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {lang === "ro" ? "Comunitatea joacă conform regulamentului." : "The community is abiding by server rules."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {complaints.map((c) => (
                <Card key={c.id} className="p-4 bg-surface-200 border-surface-border hover:border-brand/40 transition-colors shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/25">
                        #{c.id}
                      </span>
                      <span className="text-sm font-bold text-white">{c.title}</span>
                    </div>
                    <div>{getStatusBadge(c.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-300 py-2.5 border-y border-surface-border/60 my-2 bg-surface-100/40 px-3 rounded-lg">
                    <div>
                      <span className="block text-[10px] text-gray-500 uppercase font-semibold">
                        {lang === "ro" ? "Reclamat" : "Accused"}
                      </span>
                      <span className="font-bold text-brand">{c.accused_name}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 uppercase font-semibold">
                        {lang === "ro" ? "Categorie" : "Category"}
                      </span>
                      <span className="text-gray-300">{getCategoryLabel(c.category)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 uppercase font-semibold">
                        {lang === "ro" ? "Dată" : "Date"}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {new Date(c.created_at).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US")}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 line-clamp-2 mt-2 leading-relaxed">
                    {c.evidence_text}
                  </p>

                  {c.verdict && (
                    <div className="mt-3 p-3 rounded-lg bg-surface-100 border border-brand/30 text-xs">
                      <span className="font-bold text-brand block mb-1">
                        {lang === "ro" ? "Verdict Staff Oficial:" : "Official Staff Verdict:"}
                      </span>
                      <p className="text-gray-200">{c.verdict}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
