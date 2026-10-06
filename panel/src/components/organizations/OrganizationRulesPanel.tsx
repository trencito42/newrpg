import Link from "next/link";
import { MarkdownDocument } from "@/components/cms/MarkdownDocument";
import { t, type Locale } from "@/lib/i18n";

export function OrganizationRulesPanel({
  locale,
  rulesMarkdown,
  orgKind,
}: {
  locale: Locale;
  rulesMarkdown: string | null;
  orgKind: "faction" | "clan";
}) {
  const hasRules = Boolean(rulesMarkdown?.trim());

  return (
    <div className="space-y-4 text-xs">
      <p className="text-[#8F8B83] leading-relaxed">{t(locale, "orgUi.rules_intro")}</p>
      <Link href="/rules" className="text-brand font-bold hover:underline">
        {t(locale, "orgUi.server_rules_link")}
      </Link>

      {hasRules ? (
        <div className="rounded-xl bg-[#0E0E10] p-4 sm:p-5 max-w-3xl">
          <MarkdownDocument content={rulesMarkdown!} />
        </div>
      ) : (
        <div className="rounded-xl bg-[#0E0E10] p-5 max-w-xl text-[#8F8B83]">
          {orgKind === "faction" ? t(locale, "orgUi.rules_empty_faction") : t(locale, "orgUi.rules_empty_clan")}
        </div>
      )}
    </div>
  );
}
