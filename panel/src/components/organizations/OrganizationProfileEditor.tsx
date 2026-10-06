"use client";

import { useState } from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { t, type Locale } from "@/lib/i18n";

type ProfileState = {
  coverImage: string;
  descriptionEn: string;
  descriptionRo: string;
  rulesEn: string;
  rulesRo: string;
};

export function OrganizationProfileEditor({
  locale,
  orgType,
  orgId,
  initial,
}: {
  locale: Locale;
  orgType: "faction" | "clan";
  orgId: string;
  initial: ProfileState;
}) {
  const [form, setForm] = useState<ProfileState>(initial);
  const [previewLang, setPreviewLang] = useState<"en" | "ro">("en");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setStatus(t(locale, "cmsUi.saving"));
    try {
      const res = await fetch(`/api/organizations/${orgType}/${encodeURIComponent(orgId)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverImage: form.coverImage.trim() || null,
          descriptionEn: form.descriptionEn.trim() || null,
          descriptionRo: form.descriptionRo.trim() || null,
          rulesEn: form.rulesEn.trim() || null,
          rulesRo: form.rulesRo.trim() || null,
        }),
      });
      setStatus(res.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const rulesPreview = previewLang === "en" ? form.rulesEn : form.rulesRo;

  return (
    <div className="space-y-4 text-xs max-w-3xl">
      <h2 className="text-sm font-bold text-[#F2EFE8]">{t(locale, "orgUi.profile_editor_title")}</h2>

      <label className="block space-y-1">
        <span className="text-[#8F8B83] font-bold uppercase tracking-wider text-[10px]">
          {t(locale, "orgUi.cover_url")}
        </span>
        <input
          value={form.coverImage}
          onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
          placeholder={t(locale, "orgUi.cover_url_placeholder")}
          className="w-full rounded-lg border border-surface-border bg-surface-200 px-3 py-2"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[#8F8B83] font-bold uppercase tracking-wider text-[10px]">
          {t(locale, "orgUi.description_en")}
        </span>
        <textarea
          value={form.descriptionEn}
          onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-surface-border bg-surface-200 px-3 py-2"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[#8F8B83] font-bold uppercase tracking-wider text-[10px]">
          {t(locale, "orgUi.description_ro")}
        </span>
        <textarea
          value={form.descriptionRo}
          onChange={(e) => setForm((f) => ({ ...f, descriptionRo: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-surface-border bg-surface-200 px-3 py-2"
        />
      </label>

      <div className="space-y-2">
        <div className="flex gap-2">
          {(["en", "ro"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setPreviewLang(lang)}
              className={`px-2 py-1 rounded uppercase font-bold ${previewLang === lang ? "bg-brand text-[#08080A]" : "bg-surface-200"}`}
            >
              {lang}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-[#8F8B83] font-bold uppercase tracking-wider text-[10px]">
            {t(locale, "orgUi.rules_markdown")} ({previewLang})
          </span>
          <textarea
            value={previewLang === "en" ? form.rulesEn : form.rulesRo}
            onChange={(e) =>
              setForm((f) =>
                previewLang === "en" ? { ...f, rulesEn: e.target.value } : { ...f, rulesRo: e.target.value }
              )
            }
            rows={10}
            className="w-full rounded-lg border border-surface-border bg-surface-200 px-3 py-2 font-mono text-[11px]"
          />
        </label>
        {rulesPreview.trim() ? (
          <div className="rounded-lg border border-surface-border bg-[#0A0A0C] p-3">
            <p className="text-[10px] text-[#8F8B83] mb-2 uppercase tracking-wider">{t(locale, "orgUi.preview")}</p>
            <MarkdownRenderer content={rulesPreview} />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand px-4 py-2.5 min-h-[44px] font-bold text-[#08080A] disabled:opacity-50"
        >
          {t(locale, "cmsUi.save")}
        </button>
        <span className="text-[#8F8B83]" role="status">{status}</span>
      </div>
    </div>
  );
}
