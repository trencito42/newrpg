import Link from "next/link";
import { LogIn } from "lucide-react";
import { t, Locale } from "@/lib/i18n";
import { ViewerSessionDTO } from "@/lib/types";
import { GlobalSearch } from "./GlobalSearch";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";

interface HeaderProps {
  locale: Locale;
  session: ViewerSessionDTO | null;
  identity: ResolvedPlayerIdentity | null;
}

export async function Header({ locale, session, identity }: HeaderProps) {
  return (
    <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-background border-b border-surface-border sticky top-0 z-30">
      <div className="flex items-center space-x-3 flex-1 max-w-sm">
        <GlobalSearch placeholder={t(locale, "common.search_placeholder")} />
      </div>

      <div className="flex items-center space-x-3">
        <LanguageToggle currentLocale={locale} />

        {session ? (
          <div className="flex items-center space-x-2.5 pl-2 border-l border-surface-border">
            <NotificationBell locale={locale} />
            <Link
              href={`/players/${encodeURIComponent(session.username)}`}
              className="flex items-center space-x-2 text-xs text-[#F2EFE8] hover:text-[#F2EFE8] transition-colors"
            >
              <div className="w-6 h-6 rounded bg-surface-200 border border-surface-border flex items-center justify-center text-[#F2EFE8] font-bold text-xs">
                {session.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-xs hidden xl:inline">
                <PlayerIdentity {...(identity || { username: session.username })} size="sm" clickable={false} />
              </span>
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center space-x-1 px-3 py-1.5 bg-brand hover:bg-brand-300 text-[#08080A] font-extrabold uppercase tracking-[0.05em] rounded-sm text-[11px] transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t(locale, "nav.login")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
