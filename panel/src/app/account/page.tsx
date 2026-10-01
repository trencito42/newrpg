import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getCurrentSessionTokenHash, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { PlayerName } from "@/components/ui/PlayerName";

interface CharRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
  level: number;
  job: string;
  cash: number;
  bank: number;
  last_played: string | null;
}

interface SessionRow extends RowDataPacket {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_active_at: string;
  is_current: boolean;
}

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  const currentTokenHash = await getCurrentSessionTokenHash();
  if (!currentTokenHash) redirect("/login");

  const locale = await getViewerLocale();

  // Load account characters
  const characters = await dbQuery<CharRow>(
    `SELECT c.id, c.firstname, c.lastname, c.level, c.job, c.cash, c.bank, c.last_played
     FROM characters c
     JOIN players p ON p.id = c.player_id
     WHERE p.account_id = ?
     ORDER BY c.level DESC, c.slot ASC`,
    [session.accountId]
  );

  // Load active sessions
  const sessions = await dbQuery<SessionRow>(
    `SELECT id, ip_address, user_agent, created_at, last_active_at,
            (token_hash = ?) AS is_current
     FROM panel_web_sessions
     WHERE account_id = ? AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY last_active_at DESC
     LIMIT 10`,
    [currentTokenHash, session.accountId]
  );

  async function updateLanguage(formData: FormData) {
    "use server";
    const newLang = formData.get("language") as string;
    if (newLang !== "en" && newLang !== "ro") return;

    const curSession = await getCurrentSession();
    if (!curSession) return;

    await dbExecute("UPDATE accounts SET language = ? WHERE id = ?", [
      newLang,
      curSession.accountId,
    ]);

    revalidatePath("/account");
  }

  async function revokeOtherSessions() {
    "use server";
    const curSession = await getCurrentSession();
    if (!curSession) return;
    const curTokenHash = await getCurrentSessionTokenHash();
    if (!curTokenHash) return;

    await dbExecute(
      `UPDATE panel_web_sessions 
       SET revoked_at = NOW() 
       WHERE account_id = ? AND token_hash != ? AND revoked_at IS NULL`,
      [curSession.accountId, curTokenHash]
    );

    revalidatePath("/account");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#f1f1f1] tracking-tight">
          {t(locale, "account.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account Details */}
        <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs">
          <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
            {t(locale, "account.details")}
          </h2>

          <div className="space-y-2 text-[#a5a5a8]">
            <div className="flex items-center justify-between">
              <span className="text-[#6f6f74]">{t(locale, "account.username")}</span>
              <span className="font-semibold text-[#f1f1f1]">{session.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6f6f74]">{t(locale, "account.email")}</span>
              <span className="text-[#f1f1f1]">{session.email || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6f6f74]">{t(locale, "account.admin_level")}</span>
              <span className="font-mono text-[#f1f1f1]">{session.adminLevel > 0 ? `Level ${session.adminLevel}` : "None"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6f6f74]">{t(locale, "account.helper_level")}</span>
              <span className="font-mono text-[#f1f1f1]">{session.helperLevel > 0 ? `Level ${session.helperLevel}` : "None"}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-surface-border/60">
            <form action={updateLanguage} className="flex items-center justify-between">
              <span className="text-[#6f6f74]">{t(locale, "account.language")}</span>
              <div className="flex items-center space-x-1.5">
                <select
                  name="language"
                  defaultValue={session.language}
                  className="text-xs bg-surface-200 border border-surface-border rounded px-2 py-1 text-[#f1f1f1] focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="ro">Română</option>
                </select>
                <Button type="submit" size="sm" variant="secondary">
                  {t(locale, "common.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Player Profile Summary */}
        <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs flex flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              {t(locale, "nav.profile")}
            </h2>
            {characters.length > 0 ? (
              <div className="space-y-2 text-[#a5a5a8]">
                <div className="flex items-center justify-between">
                  <span className="text-[#6f6f74]">Player</span>
                  <PlayerName name={session.username} factionId={characters[0].job} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6f6f74]">Level</span>
                  <span className="font-mono text-[#f1f1f1]">{characters[0].level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6f6f74]">Job</span>
                  <span className="capitalize text-[#f1f1f1]">{characters[0].job?.replace(/_/g, " ") || "-"}</span>
                </div>
              </div>
            ) : (
              <p className="text-[#6f6f74]">No character profile linked.</p>
            )}
          </div>

          <div className="pt-2 border-t border-surface-border/60">
            <Link
              href={`/players/${encodeURIComponent(session.username)}`}
              className="inline-flex items-center justify-center w-full px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#f1f1f1] font-semibold rounded text-xs transition-colors"
            >
              View Public Profile
            </Link>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="md:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-[#f1f1f1]">
            <span>{t(locale, "account.active_sessions")}</span>
            <form action={revokeOtherSessions}>
              <Button size="sm" variant="destructive" type="submit">
                Logout Others
              </Button>
            </form>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {sessions.map((sess) => (
              <div key={sess.id} className="p-2.5 px-3 flex items-center justify-between text-[#a5a5a8]">
                <div>
                  <span className="font-mono text-[#f1f1f1]">{sess.ip_address || "127.0.0.1"}</span>
                  <span className="text-[11px] text-[#6f6f74] ml-2 truncate max-w-xs inline-block align-bottom">{sess.user_agent}</span>
                </div>
                <div className="text-right">
                  {sess.is_current ? (
                    <span className="text-emerald-400 font-medium text-[11px]">Current</span>
                  ) : (
                    <span className="text-[#6f6f74] font-mono text-[11px]">{formatDate(sess.last_active_at, locale)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
