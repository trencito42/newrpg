import Link from "next/link";
import { Bug, LifeBuoy, MessageSquare, Newspaper, Rss } from "lucide-react";
import { Locale, t } from "@/lib/i18n";

const LINKS = [
  { href: "/forum", icon: MessageSquare, labelKey: "home.quick_links.forum" },
  { href: "/feed", icon: Rss, labelKey: "home.quick_links.feed" },
  { href: "/updates", icon: Newspaper, labelKey: "home.quick_links.updates" },
  { href: "/support/tickets", icon: LifeBuoy, labelKey: "home.quick_links.support" },
  { href: "/support/tickets?type=bug", icon: Bug, labelKey: "home.quick_links.report_bug" },
] as const;

export function HomeQuickLinks({ locale }: { locale: Locale }) {
  return (
    <nav
      aria-label={t(locale, "home.quick_links.aria")}
      className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm"
    >
      {LINKS.map((link, i) => {
        const Icon = link.icon;
        return (
          <span key={link.href} className="inline-flex items-center">
            {i > 0 ? (
              <span className="text-[#3D3A36] mx-1.5 select-none" aria-hidden>
                ·
              </span>
            ) : null}
            <Link
              href={link.href}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[#A5A196] hover:text-[#D7B558] hover:bg-[rgba(215,181,88,0.06)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/40"
            >
              <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="font-medium">{t(locale, link.labelKey)}</span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
