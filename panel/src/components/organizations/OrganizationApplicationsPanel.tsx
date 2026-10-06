import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import type { OrgApplicationSettingsPublic } from "@/lib/org-applications-public";

type Question = { id: number; label_en: string; label_ro: string };

export function OrganizationApplicationsPanel({
  locale,
  orgType,
  orgPath,
  applyPath,
  settings,
  viewerApplication,
  questions,
  showApplyCta,
}: {
  locale: Locale;
  orgType: "faction" | "clan";
  orgPath: string;
  applyPath: string;
  settings: OrgApplicationSettingsPublic;
  viewerApplication: { id: number; status: string } | null;
  questions: Question[];
  showApplyCta: boolean;
}) {
  const applicationThreadPath =
    viewerApplication &&
    `${orgPath}/applications/${viewerApplication.id}`;

  const statusLabel = (status: string) => {
    const key = `orgUi.app_status_${status}` as const;
    const translated = t(locale, key);
    return translated !== key ? translated : status;
  };

  return (
    <div className="space-y-5 text-xs">
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#8F8B83]">
          {t(locale, "orgUi.applications_status")}
        </h2>
        <p className="mt-2 text-sm font-semibold text-[#F2EFE8]">
          {settings.applications_open
            ? t(locale, "orgUi.applications_open")
            : t(locale, "orgUi.applications_closed")}
        </p>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8F8B83] mb-2">
          {t(locale, "orgUi.requirements")}
        </h3>
        <div className="flex flex-wrap gap-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#B4AFA4]">
          <span className="rounded-md bg-[#121214] px-2 py-1">
            {t(locale, "orgUi.level_badge", { level: settings.effective_min_level })}
          </span>
          {settings.min_hours > 0 ? (
            <span className="rounded-md bg-[#121214] px-2 py-1">
              {t(locale, "orgUi.hours_badge", { hours: settings.min_hours })}
            </span>
          ) : null}
          <span className="rounded-md bg-[#121214] px-2 py-1">
            {t(locale, "orgUi.warns_badge", { count: settings.max_warnings })}
          </span>
          {settings.cooldown_hours > 0 ? (
            <span className="rounded-md bg-[#121214] px-2 py-1 text-[#8F8B83] normal-case font-medium">
              {t(locale, "orgUi.cooldown_hint", { hours: settings.cooldown_hours })}
            </span>
          ) : null}
        </div>
        {orgType === "faction" ? (
          <p className="mt-2 text-[11px] text-[#8F8B83] leading-relaxed">{t(locale, "orgUi.faction_progression_note")}</p>
        ) : null}
      </div>

      {viewerApplication ? (
        <div className="rounded-xl bg-[#121214] p-4 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-[#8F8B83] font-bold">
            {t(locale, "orgUi.your_application")}
          </p>
          <p className="text-sm font-semibold text-[#F2EFE8]">{statusLabel(viewerApplication.status)}</p>
          {applicationThreadPath ? (
            <Link href={applicationThreadPath} className="inline-block mt-2 text-brand font-bold hover:underline">
              {t(locale, "orgUi.view_application")}
            </Link>
          ) : null}
        </div>
      ) : showApplyCta && settings.applications_open ? (
        <Link
          href={applyPath}
          className="inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors"
        >
          {orgType === "faction" ? t(locale, "copy.app_factions_slug_page.apply_to_faction") : t(locale, "copy.app_clans_id_page.apply_to_clan")}
        </Link>
      ) : null}

      {questions.length > 0 ? (
        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8F8B83]">
            {t(locale, "orgUi.questions_preview_title", { count: questions.length })}
          </p>
          <ul className="mt-2 space-y-1.5 text-[#B4AFA4]">
            {questions.slice(0, 8).map((q) => (
              <li key={q.id} className="flex gap-2">
                <span className="text-[#8F8B83]">•</span>
                <span>{locale === "ro" ? q.label_ro : q.label_en}</span>
              </li>
            ))}
          </ul>
          {questions.length > 8 ? (
            <p className="mt-2 text-[10px] text-[#8F8B83]">{t(locale, "orgUi.questions_more", { count: questions.length - 8 })}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
