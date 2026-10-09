import Link from "next/link";
import { panelBrand } from "@/lib/brand";
import { t, type Locale } from "@/lib/i18n";

export function PanelSiteFooter({ locale }: { locale: Locale }) {
  const legalLinks = [
    { href: "/terms", labelKey: "footer.terms" },
    { href: "/privacy", labelKey: "footer.privacy" },
    { href: "/refund", labelKey: "footer.refund" },
    { href: "/cookies", labelKey: "footer.cookies" },
  ] as const;

  return (
    <footer className="border-t border-[rgba(255,255,255,0.06)] py-4 px-2 text-center text-[11px] leading-relaxed text-[#8F8B83]">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-2">
        {legalLinks.map((link) => (
          <Link key={link.href} href={link.href} className="text-[#A5A196] hover:text-[#F2EFE8] transition-colors">
            {t(locale, link.labelKey)}
          </Link>
        ))}
      </nav>
      <p className="text-[#A5A196]">
        {t(locale, "interface.panel_footer_version", { version: panelBrand.panelVersion })}
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p className="mt-0.5 opacity-80">{t(locale, "interface.panel_footer_stable")}</p>
      )}
    </footer>
  );
}
