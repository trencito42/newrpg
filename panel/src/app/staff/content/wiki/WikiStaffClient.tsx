"use client";

import { useCallback, useEffect, useState } from "react";
import { ForumEditor } from "@/components/forum/ForumEditor";
import { t, type Locale } from "@/lib/i18n";

type Category = {
  id: number;
  slug: string;
  name_en: string;
  name_ro: string;
  sort_order: number;
  is_visible: boolean;
  article_count: number;
};

type ArticleListItem = {
  id: number;
  category_id: number;
  slug: string;
  title_en: string;
  title_ro: string;
  status: "draft" | "published";
  is_featured: boolean;
  updated_at: string;
};

type ArticleDetail = ArticleListItem & {
  summary_en: string | null;
  summary_ro: string | null;
  content_en: string;
  content_ro: string;
  sort_order: number;
};

const emptyArticle = (categoryId: number): Partial<ArticleDetail> => ({
  category_id: categoryId,
  slug: "",
  title_en: "",
  title_ro: "",
  summary_en: "",
  summary_ro: "",
  content_en: "",
  content_ro: "",
  status: "draft",
  is_featured: false,
  sort_order: 0,
});

export function WikiStaffClient({ locale }: { locale: Locale }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Partial<ArticleDetail>>({});
  const [status, setStatus] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [langTab, setLangTab] = useState<"en" | "ro">("en");

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/staff/cms/wiki/categories", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories || []);
    }
  }, []);

  const loadArticles = useCallback(async () => {
    const qs = filterStatus ? `?status=${filterStatus}` : "";
    const res = await fetch(`/api/staff/cms/wiki/articles${qs}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setArticles(data.articles || []);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadCategories();
    void loadArticles();
  }, [loadCategories, loadArticles]);

  const openArticle = async (id: number | "new") => {
    setSelectedId(id);
    if (id === "new") {
      setDraft(emptyArticle(categories[0]?.id ?? 0));
      return;
    }
    const res = await fetch(`/api/staff/cms/wiki/articles/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setDraft(data.article);
    }
  };

  const saveArticle = async () => {
    setStatus(t(locale, "cmsUi.saving"));
    const isNew = selectedId === "new";
    const url = isNew ? "/api/staff/cms/wiki/articles" : `/api/staff/cms/wiki/articles/${selectedId}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setStatus(res.ok ? t(locale, "cmsUi.saved") : t(locale, "cmsUi.save_failed"));
    if (res.ok) {
      await loadArticles();
      if (isNew) {
        const data = await res.json();
        setSelectedId(data.id);
      }
    }
  };

  const deleteArticle = async () => {
    if (selectedId === "new" || selectedId === null) return;
    if (!window.confirm(t(locale, "cmsUi.confirm_delete"))) return;
    await fetch(`/api/staff/cms/wiki/articles/${selectedId}`, { method: "DELETE" });
    setSelectedId(null);
    await loadArticles();
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-surface-border">
        <h1 className="text-lg font-bold text-[#F2EFE8]">{t(locale, "cmsUi.staff_wiki_title")}</h1>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5 text-xs"
        >
          <option value="">{t(locale, "cmsUi.filter_all_status")}</option>
          <option value="draft">{t(locale, "cmsUi.status_draft")}</option>
          <option value="published">{t(locale, "cmsUi.status_published")}</option>
        </select>
        <button
          type="button"
          onClick={() => void openArticle("new")}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-[#08080A]"
        >
          {t(locale, "cmsUi.new_article")}
        </button>
        <span className="text-xs text-[#8F8B83]">{status}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="rounded-xl border border-surface-border bg-surface-100 divide-y divide-surface-border/50 text-xs max-h-[480px] overflow-y-auto">
          {articles.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => void openArticle(a.id)}
                className={`w-full text-left px-3 py-2 hover:bg-surface-200 ${selectedId === a.id ? "bg-brand/10" : ""}`}
              >
                <div className="font-semibold text-[#F2EFE8] truncate">{a.title_en}</div>
                <div className="text-[10px] text-[#8F8B83]">{a.status} · {a.slug}</div>
              </button>
            </li>
          ))}
        </ul>

        {selectedId !== null ? (
          <div className="rounded-xl border border-surface-border bg-surface-100 p-4 space-y-3 text-xs">
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
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                {t(locale, "cmsUi.field_slug")}
                <input
                  value={draft.slug || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5"
                />
              </label>
              <label className="block">
                {t(locale, "cmsUi.field_category")}
                <select
                  value={draft.category_id ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, category_id: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_en}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              {t(locale, "cmsUi.field_title")}
              <input
                value={langTab === "en" ? draft.title_en || "" : draft.title_ro || ""}
                onChange={(e) =>
                  setDraft((d) =>
                    langTab === "en" ? { ...d, title_en: e.target.value } : { ...d, title_ro: e.target.value }
                  )
                }
                className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5"
              />
            </label>
            <label className="block">
              {t(locale, "cmsUi.field_summary")}
              <input
                value={langTab === "en" ? draft.summary_en || "" : draft.summary_ro || ""}
                onChange={(e) =>
                  setDraft((d) =>
                    langTab === "en" ? { ...d, summary_en: e.target.value } : { ...d, summary_ro: e.target.value }
                  )
                }
                className="mt-1 w-full rounded-lg border border-surface-border bg-surface-200 px-2 py-1.5"
              />
            </label>
            <div>
              <span className="text-[#8F8B83]">{t(locale, "cmsUi.field_content")}</span>
              <ForumEditor
                locale={locale}
                value={langTab === "en" ? draft.content_en || "" : draft.content_ro || ""}
                onChange={(v) =>
                  setDraft((d) =>
                    langTab === "en" ? { ...d, content_en: v } : { ...d, content_ro: v }
                  )
                }
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={Boolean(draft.is_featured)}
                  onChange={(e) => setDraft((d) => ({ ...d, is_featured: e.target.checked }))}
                />
                {t(locale, "cmsUi.field_featured")}
              </label>
              <select
                value={draft.status || "draft"}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as "draft" | "published" }))}
                className="rounded-lg border border-surface-border bg-surface-200 px-2 py-1"
              >
                <option value="draft">{t(locale, "cmsUi.status_draft")}</option>
                <option value="published">{t(locale, "cmsUi.status_published")}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void saveArticle()} className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-[#08080A]">
                {t(locale, "cmsUi.save")}
              </button>
              {selectedId !== "new" ? (
                <button type="button" onClick={() => void deleteArticle()} className="rounded-lg border border-red-800/50 px-3 py-2 text-xs text-red-400">
                  {t(locale, "cmsUi.delete")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#8F8B83]">{t(locale, "cmsUi.select_article_hint")}</p>
        )}
      </div>
    </div>
  );
}
