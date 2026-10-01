import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import UnbanForm from "./UnbanForm";
import { ShieldAlert, AlertTriangle, FileText, CheckCircle2, Clock, Scale } from "lucide-react";

interface UnbanRequestRecord {
  id: number;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  staff_response: string | null;
  created_at: string;
  handled_at: string | null;
}

interface ActiveBanRecord {
  id: number;
  reason: string;
  banned_by: string;
  expires_at: string | null;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function UnbanPage() {
  const user = await getCurrentUser();
  const lang = await getRequestLanguage();
  const dict = getDictionary(lang);

  let activeBan: ActiveBanRecord | null = null;
  let userRequests: UnbanRequestRecord[] = [];

  if (user) {
    const playerRecord = await queryOne<{ license: string }>(
      "SELECT license FROM players WHERE account_id = ? LIMIT 1",
      [user.accountId]
    );

    if (playerRecord?.license) {
      activeBan = await queryOne<ActiveBanRecord>(
        `SELECT id, reason, banned_by, expires_at, created_at
         FROM bans
         WHERE license = ? AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY id DESC LIMIT 1`,
        [playerRecord.license]
      );
    }

    userRequests = await query<UnbanRequestRecord>(
      `SELECT id, reason, status, staff_response, created_at, handled_at
       FROM panel_unban_requests
       WHERE account_id = ?
       ORDER BY id DESC`,
      [user.accountId]
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge variant="success">{lang === "ro" ? "Aprobat" : "Accepted"}</Badge>;
      case "rejected":
        return <Badge variant="danger">{lang === "ro" ? "Respins" : "Rejected"}</Badge>;
      default:
        return <Badge variant="warning">{lang === "ro" ? "În Așteptare" : "Pending"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500/15 via-surface-200 to-surface-200 border border-rose-500/30 p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-rose-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-widest mb-1.5">
              <Scale className="w-4 h-4" />
              <span>{lang === "ro" ? "Departament Apeluri & Sancțiuni" : "Appeals & Sanctions Office"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {lang === "ro" ? "Cereri Debanare" : "Unban Appeals"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {lang === "ro"
                ? "Dacă consideri că ai fost sancționat incorect sau dorești o a doua șansă, depune o cerere de debanare oficială."
                : "If you believe your ban was issued unjustly or wish to appeal for a second chance, submit an official appeal."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form or Active Ban Status */}
        <div className="lg:col-span-1 space-y-4">
          {activeBan && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/15 to-surface-100 border border-rose-500/40 text-rose-300 shadow-lg">
              <div className="flex items-center space-x-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                  {lang === "ro" ? "Sancțiune Activă Înregistrată" : "Active Ban Detected"}
                </span>
              </div>
              <div className="text-xs space-y-1.5 mt-2 bg-surface-200/80 p-3 rounded-lg border border-rose-500/20">
                <p>
                  <strong className="text-white">{lang === "ro" ? "Motiv: " : "Reason: "}</strong>
                  <span className="text-rose-200">{activeBan.reason}</span>
                </p>
                <p>
                  <strong className="text-white">{lang === "ro" ? "Admin: " : "Admin: "}</strong>
                  <span className="text-gray-300 font-mono">{activeBan.banned_by}</span>
                </p>
                <p>
                  <strong className="text-white">{lang === "ro" ? "Expiră: " : "Expires: "}</strong>
                  <span className="text-amber-400 font-mono">
                    {activeBan.expires_at
                      ? new Date(activeBan.expires_at).toLocaleString(lang === "ro" ? "ro-RO" : "en-US")
                      : lang === "ro"
                      ? "Permanent"
                      : "Permanent"}
                  </span>
                </p>
              </div>
            </div>
          )}

          <Card className="p-5 border-surface-border bg-surface-200 shadow-xl">
            <h2 className="text-base font-bold text-white mb-1">
              {lang === "ro" ? "Formular Cerere Debanare" : "Submit Appeal"}
            </h2>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              {lang === "ro"
                ? "Fii sincer și oferă explicații mature. Atitudinea arogantă duce la respingerea irevocabilă a cererii."
                : "Be honest and mature in your response. Hostility leads to instant and permanent dismissal."}
            </p>

            {user ? (
              <UnbanForm lang={lang} banId={activeBan?.id} />
            ) : (
              <div className="text-center py-6 border border-dashed border-surface-border rounded-xl p-4 bg-surface-100">
                <p className="text-xs text-gray-400 mb-3">
                  {lang === "ro"
                    ? "Trebuie să fii autentificat pe contul tău pentru a depune o cerere."
                    : "You must be logged into your account to submit an appeal."}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-lg bg-brand text-gray-950 hover:bg-brand-600 transition-colors shadow-md"
                >
                  {dict.auth.login}
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Past or Current Requests */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">
              {lang === "ro" ? "Cererile Tale de Debanare" : "Your Unban Appeals"}
            </h2>
            <span className="text-xs font-mono text-gray-400">
              {userRequests.length} {lang === "ro" ? "înregistrări" : "records"}
            </span>
          </div>

          {!user ? (
            <Card className="p-8 text-center text-gray-400 bg-surface-200 border-surface-border">
              <p className="text-sm">
                {lang === "ro"
                  ? "Autentifică-te pentru a vedea istoricul cererilor tale."
                  : "Log in to view your appeal history."}
              </p>
            </Card>
          ) : userRequests.length === 0 ? (
            <Card className="p-8 text-center text-gray-400 bg-surface-200 border-surface-border">
              <p className="text-sm">
                {lang === "ro"
                  ? "Nu ai nicio cerere de debanare înregistrată."
                  : "You have not submitted any unban appeals."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {userRequests.map((req) => (
                <Card key={req.id} className="p-5 space-y-3 bg-surface-200 border-surface-border shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border/50">
                    <span className="text-xs font-mono font-bold text-brand">#{req.id}</span>
                    <div>{getStatusBadge(req.status)}</div>
                  </div>

                  <div className="text-xs text-gray-300 bg-surface-100 p-3.5 rounded-lg border border-surface-border">
                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">
                      {lang === "ro" ? "Argumentația Ta:" : "Your Appeal Argument:"}
                    </span>
                    <p className="text-white whitespace-pre-wrap leading-relaxed">{req.reason}</p>
                  </div>

                  {req.staff_response && (
                    <div className="text-xs bg-surface-50 p-3.5 rounded-lg border border-brand/30">
                      <span className="block text-[10px] uppercase font-bold text-brand mb-1 tracking-wider">
                        {lang === "ro" ? "Răspuns Oficial Staff:" : "Official Staff Verdict:"}
                      </span>
                      <p className="text-white leading-relaxed">{req.staff_response}</p>
                      {req.handled_at && (
                        <span className="block text-[10px] text-gray-400 mt-2 font-mono">
                          {new Date(req.handled_at).toLocaleString(lang === "ro" ? "ro-RO" : "en-US")}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-500 font-mono pt-1">
                    {lang === "ro" ? "Depusă la: " : "Submitted on: "}
                    {new Date(req.created_at).toLocaleString(lang === "ro" ? "ro-RO" : "en-US")}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
