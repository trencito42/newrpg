import { t, getDictionary } from "@/lib/i18n";
import { getViewerLocale } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { fetchPublicRulesSections } from "@/lib/cms/rules";
import { getLocaleFallbackRules } from "@/lib/cms/rules-fallback";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getViewerLocale();
  return buildMetadata({
    title: t(locale, "seo.rules_title"),
    description: t(locale, "seo.rules_description"),
    path: "/rules",
  });
}

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const lang = await getViewerLocale();
  getDictionary(lang);

  const fromDb = await fetchPublicRulesSections(lang);
  const sections = fromDb ?? getLocaleFallbackRules(lang);

  return (
    <div className="space-y-4 w-full">
      <div className="pb-2">
        <h1 className="text-xl font-bold text-[#F2EFE8] tracking-tight">{t(lang, "nav.rules")}</h1>
        <p className="mt-1 text-xs text-[#99958E]">{t(lang, "seo.rules_description")}</p>
      </div>

      <div className="space-y-3 max-w-3xl">
        {sections.map((sec) => (
          <section key={sec.id} className="rounded-xl bg-[#0E0E10] p-4">
            <h2 className="text-sm font-bold text-[#F2EFE8] mb-3">{sec.title}</h2>
            <ul className="space-y-0">
              {sec.rules.map((r, idx) => (
                <li
                  key={r.num}
                  className={cn(
                    "py-3 text-xs",
                    idx > 0 && "border-t border-white/[0.04]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-[11px] text-[#8F8B83] shrink-0 pt-0.5">{r.num}</span>
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-semibold text-[#F2EFE8]">{r.name}</h3>
                      <p className="text-[#99958E] leading-relaxed">{r.desc}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
