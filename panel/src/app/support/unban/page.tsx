import { getCurrentUser, getRequestLanguage } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { t, getDictionary } from "@/lib/i18n";
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
  const locale = lang;
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
        return <span className="text-emerald-400 font-medium">{t(locale, "interface.accepted")}</span>;
      case "rejected":
        return <span className="text-red-400 font-medium">{t(locale, "interface.rejected")}</span>;
      default:
        return <span className="text-amber-400 font-medium">{t(locale, "common.pending")}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
          {t(lang, "copy.app_staff_dashboard_page.unban_appeals")}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Column */}
        <div className="lg:col-span-1 space-y-3">
          {activeBan && (
            <div className="p-3 bg-red-950/20 border border-red-900/40 text-xs rounded space-y-1">
              <span className="font-semibold text-red-400 block">{t(locale, "interface.active_ban")}</span>
              <p className="text-[#F2EFE8]"><span className="text-[#8F8B83]">{t(locale, "interface.reason")}</span> {activeBan.reason}</p>
              <p className="text-[#8F8B83]">{t(locale, "interface.by_2")} {activeBan.banned_by}</p>
              <p className="text-[#8F8B83]">
                {t(locale, "interface.expires_2")} {activeBan.expires_at ? new Date(activeBan.expires_at).toLocaleDateString() : t(locale, "interface.permanent")}
              </p>
            </div>
          )}

          <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs">
            <h2 className="text-xs font-semibold text-[#F2EFE8] uppercase tracking-wider">
              {t(lang, "copy.app_support_unban_page.submit_appeal")}
            </h2>

            {user ? (
              <UnbanForm lang={lang} banId={activeBan?.id} />
            ) : (
              <div className="text-center py-4 text-[#8F8B83]">
                <p className="mb-2">{t(locale, "interface.log_in_to_submit_an_unban_appeal")}</p>
                <Link
                  href="/login"
                  className="inline-flex px-3 py-1 bg-[#D7B558] text-[#08080A] font-semibold rounded text-xs"
                >
                  {t(locale, "interface.log_in")}</Link>
              </div>
            )}
          </div>
        </div>

        {/* Requests List */}
        <div className="lg:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-[#F2EFE8]">
            <span>{t(lang, "copy.app_support_unban_page.your_appeals")}</span>
            <span className="font-mono text-[#8F8B83]">{userRequests.length}</span>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {userRequests.map((req) => (
              <div key={req.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#8F8B83]">#{req.id}</span>
                  <div>{getStatusText(req.status)}</div>
                </div>

                <div className="p-2.5 bg-surface-200 rounded border border-surface-border text-xs text-[#F2EFE8]">
                  <p className="whitespace-pre-wrap">{req.reason}</p>
                </div>

                {req.staff_response && (
                  <div className="p-2.5 bg-surface-200 rounded border border-surface-border text-xs text-[#F2EFE8]">
                    <span className="text-[#8F8B83] font-medium block">{t(locale, "interface.verdict")}</span>
                    <p>{req.staff_response}</p>
                  </div>
                )}

                <div className="text-[11px] text-[#8F8B83] font-mono">
                  {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}

            {userRequests.length === 0 && (
              <div className="p-6 text-center text-[#8F8B83]">
                {t(lang, "copy.app_staff_dashboard_page.no_unban_appeals")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
