import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "accepted":
        return <span className="text-emerald-400 font-medium">Accepted</span>;
      case "rejected":
        return <span className="text-red-400 font-medium">Rejected</span>;
      default:
        return <span className="text-amber-400 font-medium">Pending</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {lang === "ro" ? "Cereri Debanare" : "Unban Appeals"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Column */}
        <div className="lg:col-span-1 space-y-3">
          {activeBan && (
            <div className="p-3 bg-red-950/20 border border-red-900/40 text-xs rounded space-y-1">
              <span className="font-semibold text-red-400 block">Active Ban</span>
              <p className="text-[#f1f1f1]"><span className="text-[#6f6f74]">Reason:</span> {activeBan.reason}</p>
              <p className="text-[#6f6f74]">By: {activeBan.banned_by}</p>
              <p className="text-[#6f6f74]">
                Expires: {activeBan.expires_at ? new Date(activeBan.expires_at).toLocaleDateString() : "Permanent"}
              </p>
            </div>
          )}

          <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              {lang === "ro" ? "Depune Cerere" : "Submit Appeal"}
            </h2>

            {user ? (
              <UnbanForm lang={lang} banId={activeBan?.id} />
            ) : (
              <div className="text-center py-4 text-[#6f6f74]">
                <p className="mb-2">Log in to submit an unban appeal.</p>
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

        {/* Requests List */}
        <div className="lg:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-[#f1f1f1]">
            <span>{lang === "ro" ? "Cererile Tale" : "Your Appeals"}</span>
            <span className="font-mono text-[#6f6f74]">{userRequests.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {userRequests.map((req) => (
              <div key={req.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#6f6f74]">#{req.id}</span>
                  <div>{getStatusText(req.status)}</div>
                </div>

                <div className="p-2.5 bg-surface-200 rounded border border-surface-border text-xs text-[#f1f1f1]">
                  <p className="whitespace-pre-wrap">{req.reason}</p>
                </div>

                {req.staff_response && (
                  <div className="p-2.5 bg-surface-200 rounded border border-surface-border text-xs text-[#f1f1f1]">
                    <span className="text-[#6f6f74] font-medium block">Verdict:</span>
                    <p>{req.staff_response}</p>
                  </div>
                )}

                <div className="text-[11px] text-[#6f6f74] font-mono">
                  {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}

            {userRequests.length === 0 && (
              <div className="p-6 text-center text-[#6f6f74]">
                {lang === "ro" ? "Nicio cerere de debanare." : "No unban appeals."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
