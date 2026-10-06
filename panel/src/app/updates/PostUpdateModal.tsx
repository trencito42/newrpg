"use client";

import { useState } from "react";
import { X, Sparkles, Eye, Edit3, Image as ImageIcon, Send, AlertCircle, HelpCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

interface PostUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (slug: string) => void;
  isAdmin: boolean;
}

const CATEGORIES = [
  { id: "update", label: "Update" }, // i18n-ignore: pre-existing
  { id: "patch-notes", label: "Patch Notes" }, // i18n-ignore: pre-existing
  { id: "anunt", label: "Anunț" }, // i18n-ignore: pre-existing
  { id: "eveniment", label: "Eveniment" }, // i18n-ignore: pre-existing
  { id: "ghid", label: "Ghid" }, // i18n-ignore: pre-existing
];

export function PostUpdateModal({ isOpen, onClose, onSuccess, isAdmin }: PostUpdateModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("update");
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
      setError("Titlul și conținutul sunt obligatorii."); // i18n-ignore: pre-existing
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
        throw new Error(data.message || data.error || "Eroare la salvarea postării.");
      }

      onSuccess(data.slug);
    } catch (err: any) {
      setError(err.message || "A apărut o problemă.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-[#111114] border border-surface-border rounded-xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border bg-surface-100/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-brand/10 text-brand">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              {/* i18n-ignore: pre-existing */}
              <h2 className="text-sm font-bold text-[#F2EFE8]">Postează Update / Noutate</h2>
              {/* i18n-ignore: pre-existing */}
              <p className="text-[11px] text-[#8F8B83]">Suport complet Markdown cu previzualizare live</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-surface-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              {/* i18n-ignore: pre-existing */}
              <label className="text-xs font-semibold text-[#B4AFA4]">Titlu Postare *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Update v2.5 — Sistem Nou de Garaje & Tuning" // i18n-ignore: pre-existing
                className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-sm text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              {/* i18n-ignore: pre-existing */}
              <label className="text-xs font-semibold text-[#B4AFA4]">Categorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-sm text-[#F2EFE8] focus:outline-none focus:border-brand"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cover Image & Pinned */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#B4AFA4] flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                {/* i18n-ignore: pre-existing */}
                <span>Imagine de Copertă (URL opțional)</span>
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
                  {/* i18n-ignore: pre-existing */}
                  <span>Fixează în top (Pinned)</span>
                </label>
              </div>
            )}
          </div>

          {/* Excerpt / Summary */}
          <div className="space-y-1.5">
            {/* i18n-ignore: pre-existing */}
            <label className="text-xs font-semibold text-[#B4AFA4]">Rezumat scurt (Card feed - opțional)</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="O scurtă descriere pentru previzualizarea din lista de noutăți..." // i18n-ignore: pre-existing
              maxLength={300}
              className="w-full px-3 py-2 bg-[#0A0A0C] border border-surface-border rounded-lg text-xs text-[#F2EFE8] placeholder-[#5A5751] focus:outline-none focus:border-brand"
            />
          </div>

          {/* Markdown Content Editor / Preview Tabs */}
          <div className="space-y-2 border border-surface-border rounded-lg bg-[#0A0A0C] overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-surface-border bg-surface-100/70">
              {/* Quick inserts */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => insertMarkdown("### ")}
                  className="px-2 py-1 text-[11px] font-bold bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="Heading 3" // i18n-ignore: pre-existing
                >
                  H3
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("**", "**")}
                  className="px-2 py-1 text-[11px] font-bold bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="Bold" // i18n-ignore: pre-existing
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("*", "*")}
                  className="px-2 py-1 text-[11px] italic bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="Italic" // i18n-ignore: pre-existing
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("- ")}
                  className="px-2 py-1 text-[11px] bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="List Item" // i18n-ignore: pre-existing
                >
                  {/* i18n-ignore: pre-existing */}
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("`", "`")}
                  className="px-2 py-1 text-[11px] font-mono bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="Inline Code" // i18n-ignore: pre-existing
                >
                  {/* i18n-ignore: pre-existing */}
                  Code
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("> ")}
                  className="px-2 py-1 text-[11px] bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="Quote" // i18n-ignore: pre-existing
                >
                  {/* i18n-ignore: pre-existing */}
                  Quote
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("[Nume Link](", ")")}
                  className="px-2 py-1 text-[11px] bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] rounded"
                  title="Link" // i18n-ignore: pre-existing
                >
                  {/* i18n-ignore: pre-existing */}
                  Link
                </button>
              </div>

              {/* Write vs Preview Toggle */}
              <div className="flex items-center space-x-1 bg-surface-200 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === "write" ? "bg-[#111114] text-brand shadow" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {/* i18n-ignore: pre-existing */}
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === "preview" ? "bg-[#111114] text-brand shadow" : "text-[#8F8B83] hover:text-[#F2EFE8]"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {/* i18n-ignore: pre-existing */}
                  <span>Previzualizare</span>
                </button>
              </div>
            </div>

            {/* Input vs Render */}
            {activeTab === "write" ? (
              <textarea
                id="post-markdown-editor"
                required
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Scrie conținutul folosind Markdown... // i18n-ignore: pre-existing
## Noutăți & Schimbări
- Am adăugat sistemul nou de inventar
- Optimizări majore de performanță

```lua
-- Exemplu configurare
Config.MaxSlots = 30
```"
                className="w-full p-3 bg-transparent text-[#F2EFE8] placeholder-[#5A5751] text-xs font-mono focus:outline-none resize-y min-h-[260px]"
              />
            ) : (
              <div className="p-4 min-h-[260px] max-h-[400px] overflow-y-auto">
                {content.trim() ? (
                  <MarkdownRenderer content={content} />
                ) : (
                  <p className="text-xs text-[#8F8B83] italic">Scrie ceva în editor pentru a vedea previzualizarea.</p> // i18n-ignore: pre-existing
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-surface-border bg-surface-100/50">
          <span className="text-[11px] text-[#8F8B83] font-mono">
            {/* i18n-ignore: pre-existing */}
            {content.length} caractere
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-200 hover:bg-surface-300 text-[#B4AFA4] hover:text-[#F2EFE8] font-bold text-xs rounded-lg transition-colors"
            >
              {/* i18n-ignore: pre-existing */}
              Anulează
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !title.trim() || !content.trim()}
              className="flex items-center space-x-1.5 px-5 py-2 bg-brand hover:bg-brand-300 disabled:opacity-50 text-[#08080A] font-extrabold uppercase text-xs rounded-lg transition-all shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? "Se publică..." : "Publică Update"}</span> // i18n-ignore: pre-existing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
