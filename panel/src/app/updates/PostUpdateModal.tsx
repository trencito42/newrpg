"use client";

import { useState } from "react";
import { X, Sparkles, Eye, Edit3, Image as ImageIcon, Send, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useViewerLocale } from "@/components/LocaleProvider";
import { t, translateApiError } from "@/lib/i18n";

interface PostUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (slug: string) => void;
  isAdmin: boolean;
}

const CATEGORY_IDS = ["update", "patch-notes", "anunt", "eveniment", "ghid"] as const;

const CATEGORY_LABEL_KEYS: Record<(typeof CATEGORY_IDS)[number], string> = {
  update: "updateUi.category_update",
  "patch-notes": "updateUi.category_patch_notes",
  anunt: "updateUi.category_announcement",
  eveniment: "updateUi.category_event",
  ghid: "updateUi.category_guide",
};

export function PostUpdateModal({ isOpen, onClose, onSuccess, isAdmin }: PostUpdateModalProps) {
  const locale = useViewerLocale();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("update");
  const [coverImage, setCoverImage] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("post-markdown-editor") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end) || "text";
    const replacement = `${prefix}${selected}${suffix}`;
    const nextVal = text.substring(0, start) + replacement + text.substring(end);
    setContent(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError(t(locale, "updateUi.title_required"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          cover_image: coverImage.trim() || null,
          summary: summary.trim() || null,
          content,
          is_pinned: isPinned,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(locale, String(data.error || "")));
      }

      onSuccess(data.slug);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(message || t(locale, "updateUi.save_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-[#111114] border border-surface-border rounded-xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border bg-surface-100/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-brand/10 text-brand">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F2EFE8]">{t(locale, "updateUi.modal_title")}</h2>
              <p className="text-[11px] text-[#8F8B83]">{t(locale, "updateUi.modal_subtitle_markdown")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-surface-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#B4AFA4]">{t(locale, "updateUi.field_title")} *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(locale, "updateUi.title_placeholder")}
                className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-sm text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#B4AFA4]">{t(locale, "updateUi.field_category")}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-sm text-[#F2EFE8] focus:outline-none focus:border-brand"
              >
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(locale, CATEGORY_LABEL_KEYS[id])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#B4AFA4] flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{t(locale, "updateUi.cover_image_label")}</span>
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:border-brand font-mono"
              />
            </div>
            {isAdmin && (
              <div className="flex items-center space-x-2 pt-6">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-[#D8D4CA]">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-border text-brand focus:ring-0 bg-[#0A0A0C]"
                  />
                  <span>{t(locale, "updateUi.pin_label")}</span>
                </label>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#B4AFA4]">{t(locale, "updateUi.field_summary")}</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t(locale, "updateUi.summary_placeholder")}
              maxLength={300}
              className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:border-brand"
            />
          </div>

          <div className="space-y-2 border border-surface-border rounded-lg bg-[#0A0A0C] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-surface-border bg-surface-100/70">
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => insertMarkdown("### ")}
                  className="px-2 py-1 text-[11px] font-bold bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_h3")}
                >
                  H3
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("**", "**")}
                  className="px-2 py-1 text-[11px] font-bold bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("*", "*")}
                  className="px-2 py-1 text-[11px] italic bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("- ")}
                  className="px-2 py-1 text-[11px] bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_list")}
                >
                  {t(locale, "updateUi.toolbar_list_text")}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("`", "`")}
                  className="px-2 py-1 text-[11px] font-mono bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_code")}
                >
                  {t(locale, "updateUi.toolbar_code_text")}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("> ")}
                  className="px-2 py-1 text-[11px] bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_quote")}
                >
                  {t(locale, "updateUi.toolbar_quote_text")}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("[", "](url)")}
                  className="px-2 py-1 text-[11px] bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title={t(locale, "updateUi.toolbar_link")}
                >
                  {t(locale, "updateUi.toolbar_link_text")}
                </button>
              </div>

              <div className="flex items-center space-x-1 bg-surface-200 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === "write" ? "bg-[#111114] text-brand shadow" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t(locale, "forumUi.write")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === "preview" ? "bg-[#111114] text-brand shadow" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t(locale, "forumUi.preview")}</span>
                </button>
              </div>
            </div>

            {activeTab === "write" ? (
              <textarea
                id="post-markdown-editor"
                required
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t(locale, "updateUi.content_placeholder")}
                className="w-full p-3 bg-transparent text-[#F2EFE8] placeholder-[#5A5751] text-xs font-mono focus:outline-none resize-y min-h-[260px]"
              />
            ) : (
              <div className="p-4 min-h-[260px] max-h-[400px] overflow-y-auto">
                {content.trim() ? (
                  <MarkdownRenderer content={content} />
                ) : (
                  <p className="text-xs text-[#8F8B83] italic">{t(locale, "updateUi.preview_empty")}</p>
                )}
              </div>
            )}
          </div>
        </form>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-surface-border bg-surface-100/50">
          <span className="text-[11px] text-[#8F8B83] font-mono">
            {t(locale, "updateUi.char_count", { count: content.length })}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] font-bold text-xs rounded-lg transition-colors"
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !title.trim() || !content.trim()}
              className="flex items-center space-x-1.5 px-5 py-2 bg-brand hover:bg-brand-300 disabled:opacity-50 text-[#08080A] font-extrabold uppercase text-xs rounded-lg transition-all shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? t(locale, "updateUi.publishing") : t(locale, "updateUi.publish")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
