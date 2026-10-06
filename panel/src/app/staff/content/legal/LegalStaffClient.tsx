"use client";

import { useCallback, useEffect, useState } from "react";
import { ForumEditor } from "@/components/forum/ForumEditor";
import { t, type Locale } from "@/lib/i18n";

const PAGE_KEYS = ["terms", "privacy", "refund", "cookies"] as const;
type PageKey = (typeof PAGE_KEYS)[number];

type LegalPage = {
  page_key: PageKey;
  title_en: string;
  title_ro: string;
  content_en: string;
  content_ro: string;
  status: "draft" | "published";
  version: number;
  effective_at: string | null;
};

export function LegalStaffClient({ locale }: { locale: Locale }) {
  const [activeKey, setActiveKey] = useState<PageKey>("terms");
  const [langTab, setLangTab] = useState<"en" | "ro">("en");
  const [page, setPage] = useState<LegalPage | null>(null);
  const [status, setStatus] = useState("");

  const loadPage = useCallback(async (key: PageKey) => {
    const res = await fetch(`/api/staff/cms/legal/${key}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setPage(data.page);
    }
  }, []);

  useEffect(() => {
    void loadPage(activeKey);
  }, [activeKey, loadPage]);

  const saveDraft = async () => {
    if (!page) return;
    setStatus(t(locale, "cmsUi.saving"));
    const res = await fetch(`/api/staff/cms/legal/${activeKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title_en: page.title_en,
        title_ro: page.title_ro,
        content_en: page.content_en,
        content_ro: page.content_ro,
        effective_at: page.effective_at,
      }),
    });
    setStatus(res.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    if (res.ok) {
      const data = await res.json();
      setPage(data.page);
    }
  };

  const publish = async () => {
    if (!page) return;
    if (!window.confirm(t(locale, "cmsUi.confirm_publish"))) return;
    setStatus(t(locale, "cmsUi.publishing"));
    const res = await fetch(`/api/staff/cms/legal/${activeKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effective_at: page.effective_at }),
    });
    setStatus(res.ok ? t(locale, "cmsUi.published") : t(locale, "cmsUi.save_failed"));
    if (res.ok) {
      const data = await res.json();
      setPage(data.page);
    }
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_legal_title")}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAGE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveKey(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
              activeKey === key ? "bg-brand text-[#08080A]" : "bg-surface-200 text-[#F2EFE8]"
            }`}
          >
            {t(locale, `cmsUi.legal_key_${key}`)}
          </button>
        ))}
      </div>

      {page ? (
        <div className="rounded-xl border border-surface-border bg-surface-100 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <span className="text-[#8F8B83]">
              {t(locale, "cmsUi.status_label")}: {page.status} · {t(locale, "cmsUi.version_prefix")}{page.version}
            </span>
            <div className="flex gap-2">
              {(["en", "ro"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLangTab(tab)}
                  className={`px-2 py-1 rounded uppercase font-bold ${langTab === tab ? "bg-brand text-[#08080A]" : "bg-surface-200"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            {t(locale, "cmsUi.field_title")}
            <input
              value={langTab === "en" ? page.title_en : page.title_ro}
              onChange={(e) =>
                setPage((p) =>
                  p
                    ? langTab === "en"
                      ? { ...p, title_en: e.target.value }
                      : { ...p, title_ro: e.target.value }
                    : p
                )
              }
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5"
            />
          </label>
          <label className="block">
            {t(locale, "cmsUi.field_effective_date")}
            <input
              type="date"
              value={page.effective_at || ""}
              onChange={(e) => setPage((p) => (p ? { ...p, effective_at: e.target.value || null } : p))}
              className="mt-1 rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5"
            />
          </label>
          <div>
            <span className="text-[#8F8B83]">{t(locale, "cmsUi.field_content")}</span>
            <ForumEditor
              locale={locale}
              value={langTab === "en" ? page.content_en : page.content_ro}
              onChange={(v) =>
                setPage((p) =>
                  p ? (langTab === "en" ? { ...p, content_en: v } : { ...p, content_ro: v }) : p
                )
              }
            />
          </div>
          <div className="flex gap-2 items-center">
            <button type="button" onClick={() => void saveDraft()} className="rounded-lg bg-surface-200 px-3 py-2 font-bold text-[#F2EFE8]">
              {t(locale, "cmsUi.save_draft")}
            </button>
            <button type="button" onClick={() => void publish()} className="rounded-lg bg-brand px-3 py-2 font-bold text-[#08080A]">
              {t(locale, "cmsUi.publish")}
            </button>
            <span className="text-[#8F8B83]">{status}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[#8F8B83]">{t(locale, "cmsUi.loading")}</p>
      )}
    </div>
  );
}
