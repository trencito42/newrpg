import Link from "next/link";
import { LogIn } from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { GlobalSearch } from "./GlobalSearch";
import { LanguageToggle } from "./LanguageToggle";
import { CharacterSwitcher } from "./CharacterSwitcher";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";

interface HeaderProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
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
    <header className="hidden lg:flex items-center justify-between px-6 py-2.5 bg-[#101011] border-b border-surface-border sticky top-0 z-30">
      <div className="flex items-center space-x-3 flex-1 max-w-sm">
        <GlobalSearch placeholder={t(locale, "common.search_placeholder")} />
      </div>

      <div className="flex items-center space-x-3">
        <LanguageToggle currentLocale={locale} />

        {session ? (
          <div className="flex items-center space-x-2.5 pl-2 border-l border-surface-border">
            {userCharacters.length > 0 && (
              <CharacterSwitcher
                characters={userCharacters}
                selectedId={session.selectedCharacterId}
              />
            )}

            <Link
              href="/account"
              className="flex items-center space-x-2 text-xs text-[#f1f1f1] hover:text-white transition-colors"
            >
              <div className="w-6 h-6 rounded bg-surface-200 border border-surface-border flex items-center justify-center text-[#f1f1f1] font-bold text-xs">
                {session.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-xs hidden xl:inline">
                {session.username}
              </span>
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center space-x-1 px-3 py-1 bg-[#f1f1f1] hover:bg-white text-[#0b0b0c] font-semibold rounded text-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t(locale, "nav.login")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
