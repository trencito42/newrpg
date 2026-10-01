import Link from "next/link";
import { User, LogIn, ShieldAlert } from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { UserSession } from "@/lib/types";
import { GlobalSearch } from "./GlobalSearch";
import { LanguageToggle } from "./LanguageToggle";
import { CharacterSwitcher } from "./CharacterSwitcher";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface HeaderProps {
  locale: Locale;
  session: UserSession | null;
}

interface CharRow extends RowDataPacket {
  id: number;
  firstname: string;
  lastname: string;
  level: number;
}

export async function Header({ locale, session }: HeaderProps) {
  let userCharacters: Array<{ id: number; name: string; level: number }> = [];

  if (session) {
    const rows = await dbQuery<CharRow>(
      `SELECT c.id, c.firstname, c.lastname, c.level
       FROM characters c
       JOIN players p ON p.id = c.player_id
       WHERE p.account_id = ?
       ORDER BY c.level DESC, c.slot ASC`,
      [session.accountId]
    );

    userCharacters = rows.map((r) => ({
      id: r.id,
      name: `${r.firstname} ${r.lastname || ""}`.trim(),
      level: Number(r.level) || 1,
    }));
  }

  return (
    <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-surface-200/80 backdrop-blur-md border-b border-surface-border sticky top-0 z-30">
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <GlobalSearch placeholder={t(locale, "common.search_placeholder")} />
      </div>

      <div className="flex items-center space-x-3.5">
        <LanguageToggle currentLocale={locale} />

        {session ? (
          <div className="flex items-center space-x-3 pl-2 border-l border-surface-border">
            {userCharacters.length > 0 && (
              <CharacterSwitcher
                characters={userCharacters}
                selectedId={session.selectedCharacterId}
              />
            )}

            <Link
              href="/account"
              className="flex items-center space-x-2 pl-1 text-xs hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand font-bold text-xs">
                {session.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden xl:block">
                <span className="font-semibold text-gray-200 block leading-tight">
                  {session.username}
                </span>
                <span className="text-[10px] text-gray-400 block font-mono">
                  {session.adminLevel > 0
                    ? `Admin Lv.${session.adminLevel}`
                    : session.helperLevel > 0
                    ? `Helper Lv.${session.helperLevel}`
                    : "Citizen"}
                </span>
              </div>
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand hover:bg-brand-600 text-gray-950 font-bold rounded-lg text-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t(locale, "nav.login")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
