import { panelBrand } from "@/lib/brand";
import { t, type Locale } from "@/lib/i18n";

export function PanelSiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-[rgba(255,255,255,0.06)] py-4 px-2 text-center text-[11px] leading-relaxed text-[#8F8B83]">
      <p className="text-[#A5A196]">
        {t(locale, "interface.panel_footer_version", { version: panelBrand.panelVersion })}
      </p>
      <p className="mt-0.5 opacity-80">{t(locale, "interface.panel_footer_stable")}</p>
    </footer>
  );
}
