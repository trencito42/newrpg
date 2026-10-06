import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getCurrentSessionTokenHash, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { PlayerName } from "@/components/ui/PlayerName";
import { factionIdSql } from "@/lib/faction-sql";

interface CharRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
  level: number;
  job: string;
  faction_id: string | null;
  clan_tag: string | null;
  clan_tag_color: string | null;
  clan_tag_style: string | null;
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
    `SELECT c.id, c.firstname, c.lastname, c.level, c.job, ${factionIdSql()} AS faction_id,
            cl.tag AS clan_tag, cl.tag_color AS clan_tag_color, cl.tag_style AS clan_tag_style,
            c.cash, c.bank, c.last_played
     FROM characters c
     JOIN players p ON p.id = c.player_id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
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
    <div className="space-y-4 w-full">
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">
          {t(locale, "account.title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account Details */}
        <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs">
          <h2 className="text-xs font-semibold text-[#F2EFE8] uppercase tracking-wider">
            {t(locale, "account.details")}
          </h2>

          <div className="space-y-2 text-[#B4AFA4]">
            <div className="flex items-center justify-between">
              <span className="text-[#8F8B83]">{t(locale, "account.username")}</span>
              <span className="font-semibold text-[#F2EFE8]">{session.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8F8B83]">{t(locale, "account.email")}</span>
              <span className="text-[#F2EFE8]">{session.email || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8F8B83]">{t(locale, "account.admin_level")}</span>
              <span className="font-mono text-[#F2EFE8]">{session.adminLevel > 0 ? t(locale, "interface.level_number", { level: session.adminLevel }) : t(locale, "common.none")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8F8B83]">{t(locale, "account.helper_level")}</span>
              <span className="font-mono text-[#F2EFE8]">{session.helperLevel > 0 ? t(locale, "interface.level_number", { level: session.helperLevel }) : t(locale, "common.none")}</span>
            </div>
          </div>

        </div>

        {/* Player Profile Summary */}
        <div className="border border-surface-border rounded bg-surface-100 p-3.5 space-y-3 text-xs flex flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[#F2EFE8] uppercase tracking-wider">
              {t(locale, "nav.profile")}
            </h2>
            {characters.length > 0 ? (
              <div className="space-y-2 text-[#B4AFA4]">
                <div className="flex items-center justify-between">
                  <span className="text-[#8F8B83]">{t(locale, "copy.app_clans_id_manage_clanmanageclient.player")}</span>
                  <PlayerName name={session.username} factionId={characters[0].faction_id}
                    clanTag={characters[0].clan_tag} clanColor={characters[0].clan_tag_color}
                    clanTagStyle={characters[0].clan_tag_style} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8F8B83]">{t(locale, "common.level")}</span>
                  <span className="font-mono text-[#F2EFE8]">{characters[0].level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8F8B83]">{t(locale, "interface.job")}</span>
                  <span className="capitalize text-[#F2EFE8]">{characters[0].job?.replace(/_/g, " ") || "-"}</span>
                </div>
              </div>
            ) : (
              <p className="text-[#8F8B83]">{t(locale, "interface.no_character_profile_linked")}</p>
            )}
          </div>

          <div className="pt-2 border-t border-surface-border/60">
            <Link
              href={`/players/${encodeURIComponent(session.username)}`}
              className="inline-flex items-center justify-center w-full px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-[#F2EFE8] font-semibold rounded text-xs transition-colors"
            >
              {t(locale, "interface.view_public_profile")}</Link>
          </div>
        </div>

        {characters.length > 1 && (
          <div className="md:col-span-2 space-y-2 text-xs">
            <h2 className="font-semibold text-[#F2EFE8]">{t(locale, "account.characters")}</h2>
            <div className="divide-y divide-surface-border">
              {characters.map((character) => {
                const name = `${character.firstname} ${character.lastname || ""}`.trim();
                const selected = character.id === session.selectedCharacterId;
                return (
                  <div key={character.id} className="flex items-center justify-between py-2 gap-3">
                    <span className="text-[#F2EFE8]">{name} <span className="text-[#99958E]">· {t(locale, "common.level")} {character.level}</span></span>
                    {selected ? (
                      <span className="text-[#99958E]">{t(locale, "common.active")}</span>
                    ) : (
                      <form action="/api/auth/switch-character" method="post">
                        <input type="hidden" name="characterId" value={character.id} />
                        <button type="submit" aria-label={`${t(locale, "copy.app_account_page.select")} ${name}`} className="text-[#F2EFE8] underline-offset-2 hover:underline">
                          {t(locale, "copy.app_account_page.select")}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        <div className="md:col-span-2 border border-surface-border rounded bg-surface-100 overflow-hidden">
          <div className="p-2.5 px-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-[#F2EFE8]">
            <span>{t(locale, "account.active_sessions")}</span>
            <form action={revokeOtherSessions}>
              <Button size="sm" variant="destructive" type="submit">
                {t(locale, "interface.log_out_other_sessions")}</Button>
            </form>
          </div>

          <div className="divide-y divide-surface-border/50 text-xs">
            {sessions.map((sess) => (
              <div key={sess.id} className="p-2.5 px-3 flex items-center justify-between text-[#B4AFA4]">
                <div>
                  <span className="font-mono text-[#F2EFE8]">{sess.ip_address || "127.0.0.1"}</span>
                  <span className="text-[11px] text-[#8F8B83] ml-2 truncate max-w-xs inline-block align-bottom">{sess.user_agent}</span>
                </div>
                <div className="text-right">
                  {sess.is_current ? (
                    <span className="text-emerald-400 font-medium text-[11px]">{t(locale, "interface.current")}</span>
                  ) : (
                    <span className="text-[#8F8B83] font-mono text-[11px]">{formatDate(sess.last_active_at, locale)}</span>
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
