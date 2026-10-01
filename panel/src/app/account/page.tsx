import { redirect } from "next/navigation";
import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { t, formatDate, formatNumber } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { User, Shield, KeyRound, Monitor, Smartphone, Globe, LogOut, CheckCircle2 } from "lucide-react";
import { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";

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
            (token_hash = SHA2(?, 256)) AS is_current
     FROM panel_web_sessions
     WHERE account_id = ? AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY last_active_at DESC
     LIMIT 10`,
    [session.sessionToken, session.accountId]
  );

  // Server Action to update language
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

  // Server Action to revoke other sessions
  async function revokeOtherSessions() {
    "use server";
    const curSession = await getCurrentSession();
    if (!curSession) return;

    await dbExecute(
      `UPDATE panel_web_sessions 
       SET revoked_at = NOW() 
       WHERE account_id = ? AND token_hash != SHA2(?, 256) AND revoked_at IS NULL`,
      [curSession.accountId, curSession.sessionToken]
    );

    revalidatePath("/account");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {t(locale, "account.title")}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {t(locale, "account.subtitle")}
        </p>
      </div>

      {/* Account Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <User className="w-4 h-4 text-brand" />
                <span>{t(locale, "account.details")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block mb-1">
                    {t(locale, "account.username")}
                  </span>
                  <span className="font-bold text-white text-sm font-mono">
                    {session.username}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block mb-1">
                    {t(locale, "account.email")}
                  </span>
                  <span className="font-mono text-gray-200">
                    {session.email || "No email linked"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block mb-1">
                    {t(locale, "account.admin_level")}
                  </span>
                  <Badge variant={session.adminLevel > 0 ? "warning" : "default"}>
                    {session.adminLevel > 0 ? `Level ${session.adminLevel}` : "None"}
                  </Badge>
                </div>

                <div>
                  <span className="text-gray-400 block mb-1">
                    {t(locale, "account.helper_level")}
                  </span>
                  <Badge variant={session.helperLevel > 0 ? "info" : "default"}>
                    {session.helperLevel > 0 ? `Level ${session.helperLevel}` : "None"}
                  </Badge>
                </div>
              </div>

              {/* Language Preference Form */}
              <div className="pt-4 border-t border-surface-border">
                <form action={updateLanguage} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-300 font-medium">
                      {t(locale, "account.language")}:
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      name="language"
                      defaultValue={session.language}
                      className="text-xs bg-surface-100 border border-surface-border rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-brand"
                    >
                      <option value="en">English (EN)</option>
                      <option value="ro">Română (RO)</option>
                    </select>
                    <Button type="submit" size="sm" variant="secondary">
                      {t(locale, "common.save")}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Associated Characters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{t(locale, "account.characters")}</span>
                <span className="text-xs text-gray-400 font-normal">
                  {characters.length} Registered
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {characters.map((char) => (
                  <div
                    key={char.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-colors ${
                      char.id === session.selectedCharacterId
                        ? "bg-brand/5 border-brand/40 text-white"
                        : "bg-surface-100 border-surface-border text-gray-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-surface-50 border border-surface-border flex items-center justify-center font-bold text-brand">
                        {char.firstname.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          {char.firstname} {char.lastname || ""}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {char.job} • Level {char.level}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {char.id === session.selectedCharacterId ? (
                        <Badge variant="brand">Active Character</Badge>
                      ) : (
                        <form action="/api/auth/switch-character" method="POST">
                          <input type="hidden" name="characterId" value={char.id} />
                          <Button size="sm" variant="outline" type="submit">
                            Select
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Active Sessions & Security */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {t(locale, "account.active_sessions")}
                </CardTitle>
                <form action={revokeOtherSessions}>
                  <Button size="sm" variant="destructive" type="submit">
                    Revoke Others
                  </Button>
                </form>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-2.5 rounded-lg bg-surface-100 border border-surface-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-gray-300">
                        {sess.ip_address || "127.0.0.1"}
                      </span>
                      {sess.is_current ? (
                        <Badge variant="success">Current</Badge>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-mono">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {sess.user_agent || "Browser Session"}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      Last seen: {formatDate(sess.last_active_at, locale)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
