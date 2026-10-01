import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import UnbanForm from "./UnbanForm";

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
    // Check if account has an active ban record
    // Look up license from user's account or character
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

    // Also fetch any unban requests filed by this account
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
      {/* Header */}
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {lang === "ro" ? "Cereri Debanare" : "Unban Appeals"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ro"
            ? "Dacă consideri că ai fost sancționat incorect sau dorești o a doua șansă, depune o cerere de debanare oficială."
            : "If you believe your ban was issued unjustly or wish to appeal for a second chance, submit an official appeal."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form or Active Ban Status */}
        <div className="lg:col-span-1 space-y-4">
          {activeBan && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">
                {lang === "ro" ? "Sancțiune Activă Înregistrată" : "Active Ban Detected"}
              </span>
              <div className="text-xs space-y-1 mt-2">
                <p>
                  <strong className="text-foreground">{lang === "ro" ? "Motiv:" : "Reason:"}</strong>{" "}
                  {activeBan.reason}
                </p>
                <p>
                  <strong className="text-foreground">{lang === "ro" ? "Admin:" : "Admin:"}</strong>{" "}
                  {activeBan.banned_by}
                </p>
                <p>
                  <strong className="text-foreground">{lang === "ro" ? "Expiră la:" : "Expires:"}</strong>{" "}
                  {activeBan.expires_at
                    ? new Date(activeBan.expires_at).toLocaleString(lang === "ro" ? "ro-RO" : "en-US")
                    : lang === "ro"
                    ? "Permanent"
                    : "Permanent"}
                </p>
              </div>
            </div>
          )}

          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground mb-1">
              {lang === "ro" ? "Formular Cerere Debanare" : "Submit Appeal"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "ro"
                ? "Fii sincer și oferă explicații mature. Atitudinea arogantă duce la respingerea irevocabilă a cererii."
                : "Be honest and mature in your response. Hostility leads to instant and permanent dismissal."}
            </p>

            {user ? (
              <UnbanForm lang={lang} banId={activeBan?.id} />
            ) : (
              <div className="text-center py-6 border border-dashed border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  {lang === "ro"
                    ? "Trebuie să fii autentificat pe contul tău pentru a depune o cerere."
                    : "You must be logged into your account to submit an appeal."}
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
        </div>

        {/* Right Column: Past or Current Requests */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {lang === "ro" ? "Cererile Tale de Debanare" : "Your Unban Appeals"}
          </h2>

          {!user ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="text-sm">
                {lang === "ro"
                  ? "Autentifică-te pentru a vedea istoricul cererilor tale."
                  : "Log in to view your appeal history."}
              </p>
            </Card>
          ) : userRequests.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="text-sm">
                {lang === "ro"
                  ? "Nu ai nicio cerere de debanare înregistrată."
                  : "You have not submitted any unban appeals."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {userRequests.map((req) => (
                <Card key={req.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-accent">#{req.id}</span>
                    <div>{getStatusBadge(req.status)}</div>
                  </div>

                  <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded border border-border/40">
                    <span className="block text-[10px] uppercase font-semibold text-muted-foreground/70 mb-1">
                      {lang === "ro" ? "Argumentația Ta:" : "Your Appeal Argument:"}
                    </span>
                    <p className="text-foreground whitespace-pre-wrap">{req.reason}</p>
                  </div>

                  {req.staff_response && (
                    <div className="text-xs bg-card p-3 rounded border border-border/60">
                      <span className="block text-[10px] uppercase font-bold text-accent mb-1">
                        {lang === "ro" ? "Răspuns Oficial Staff:" : "Official Staff Verdict:"}
                      </span>
                      <p className="text-foreground">{req.staff_response}</p>
                      {req.handled_at && (
                        <span className="block text-[10px] text-muted-foreground mt-2">
                          {new Date(req.handled_at).toLocaleString(lang === "ro" ? "ro-RO" : "en-US")}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground font-mono">
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
