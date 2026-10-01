import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import ComplaintForm from "./ComplaintForm";

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
        return <Badge variant="neutral">{lang === "ro" ? "În Așteptare" : "Pending"}</Badge>;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {lang === "ro" ? "Reclamații Jucători" : "Player Complaints"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "ro"
              ? "Reclamă încălcările de regulament împotriva altor jucători pe baza dovezilor clare."
              : "Report rule violations and misconduct against other players backed by clear evidence."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Complaint Form (if logged in) */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground mb-1">
              {lang === "ro" ? "Depune o Reclamație" : "File a Complaint"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "ro"
                ? "Asigură-te că deții dovezi video sau capturi foto clare (imgur, youtube). Reclamațiile false sunt sancționate."
                : "Ensure you provide clear video or screenshot evidence. False reports are subject to server punishment."}
            </p>

            {user ? (
              <ComplaintForm lang={lang} />
            ) : (
              <div className="text-center py-6 border border-dashed border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  {lang === "ro"
                    ? "Trebuie să fii autentificat pentru a depune o reclamație."
                    : "You must be logged in to file a complaint."}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                >
                  {dict.auth.login}
                </Link>
              </div>
            )}
          </Card>

          {/* Guidelines Card */}
          <Card className="p-5 bg-card/60 border-border/40">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {lang === "ro" ? "Ghid Reclamații" : "Complaint Guidelines"}
            </h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {lang === "ro" ? "Reclamații Recente" : "Recent Complaints"}
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {complaints.length} {lang === "ro" ? "înregistrări" : "records"}
            </span>
          </div>

          {complaints.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="text-sm">
                {lang === "ro" ? "Nu există reclamații înregistrate." : "No player complaints found."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {complaints.map((c) => (
                <Card key={c.id} className="p-4 hover:border-accent/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-accent">#{c.id}</span>
                      <span className="text-xs font-semibold text-foreground">{c.title}</span>
                    </div>
                    <div>{getStatusBadge(c.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground py-2 border-y border-border/30 my-2">
                    <div>
                      <span className="block text-[10px] text-muted-foreground/70 uppercase">
                        {lang === "ro" ? "Reclamat" : "Accused"}
                      </span>
                      <span className="font-semibold text-foreground">{c.accused_name}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground/70 uppercase">
                        {lang === "ro" ? "Categorie" : "Category"}
                      </span>
                      <span>{getCategoryLabel(c.category)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground/70 uppercase">
                        {lang === "ro" ? "Dată" : "Date"}
                      </span>
                      <span>{new Date(c.created_at).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US")}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {c.evidence_text}
                  </p>

                  {c.verdict && (
                    <div className="mt-3 p-2.5 rounded bg-muted/30 border border-border/50 text-xs">
                      <span className="font-bold text-foreground block mb-0.5">
                        {lang === "ro" ? "Verdict Staff:" : "Staff Verdict:"}
                      </span>
                      <p className="text-muted-foreground">{c.verdict}</p>
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
