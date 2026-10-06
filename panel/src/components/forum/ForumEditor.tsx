"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState, useRef, useCallback } from "react";
import {
  Bold, Italic, Underline, Heading2, Code, Code2, Quote,
  List, ListOrdered, Link2, Image, Eye, Edit3,
} from "lucide-react";

interface ForumEditorProps {
  value: string;
  onChange: (value: string) => void;
  locale?: "en" | "ro";
  placeholder?: string;
  minHeight?: number;
}

type Tab = "write" | "preview";

const MAX_LENGTH = 50000;

function insertWrap(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder?: string
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder || "";
  return (
    textarea.value.slice(0, start) +
    before +
    selected +
    after +
    textarea.value.slice(end)
  );
}

function insertLinePrefix(textarea: HTMLTextAreaElement, prefix: string): string {
  const start = textarea.selectionStart;
  const lineStart = textarea.value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = textarea.value.indexOf("\n", start);
  const end = lineEnd === -1 ? textarea.value.length : lineEnd;
  const line = textarea.value.slice(lineStart, end);
  const newLine = line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line;
  return textarea.value.slice(0, lineStart) + newLine + textarea.value.slice(end);
}

export function ForumEditor({
  value,
  onChange,
  locale = "en",
  placeholder,
  minHeight = 200,
}: ForumEditorProps) {
  const [tab, setTab] = useState<Tab>("write");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormatting = useCallback(
    (action: string) => {
      const ta = textareaRef.current;
      if (!ta) return;

      let newValue = value;

      switch (action) {
        case "bold":
          newValue = insertWrap(ta, "**", "**", "bold text");
          break;
        case "italic":
          newValue = insertWrap(ta, "_", "_", "italic text");
          break;
        case "underline":
          newValue = insertWrap(ta, "<u>", "</u>", "underlined text");
          break;
        case "h2":
          newValue = insertLinePrefix(ta, "## ");
          break;
        case "code":
          newValue = insertWrap(ta, "`", "`", "code");
          break;
        case "codeblock":
          newValue = insertWrap(ta, "\n```\n", "\n```\n", "code block");
          break;
        case "quote":
          newValue = insertLinePrefix(ta, "> ");
          break;
        case "list":
          newValue = insertLinePrefix(ta, "- ");
          break;
        case "ordered":
          newValue = insertLinePrefix(ta, "1. ");
          break;
        case "link": {
          const url = prompt("Link URL:");
          if (url) {
            const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || "text";
            newValue =
              ta.value.slice(0, ta.selectionStart) +
              `[${sel}](${url})` +
              ta.value.slice(ta.selectionEnd);
          }
          break;
        }
        case "image": {
          const url = prompt("Image URL:");
          if (url) {
            const alt = ta.value.slice(ta.selectionStart, ta.selectionEnd) || "image";
            newValue =
              ta.value.slice(0, ta.selectionStart) +
              `![${alt}](${url})` +
              ta.value.slice(ta.selectionEnd);
          }
          break;
        }
        case "spoiler":
          newValue = insertWrap(ta, "<details><summary>Spoiler</summary>\n\n", "\n\n</details>", "content");
          break;
      }

      onChange(newValue);
      ta.focus();
    },
    [value, onChange, locale]
  );

  const handleTabSwitch = async (nextTab: Tab) => {
    if (nextTab === "preview" && tab !== "preview") {
      setLoadingPreview(true);
      try {
        // Use marked client-side for preview
        const { marked } = await import("marked");
        const sanitizeHtml = (await import("sanitize-html")).default;
        const { FORUM_SANITIZE_OPTIONS } = await import("@/lib/forum-markdown");
        const raw = await marked.parse(value, { gfm: true, breaks: true });
        setPreviewHtml(sanitizeHtml(raw, FORUM_SANITIZE_OPTIONS));
      } catch {
        setPreviewHtml(`<p>${t(locale, "forumUi.preview_unavailable")}</p>`);
      } finally {
        setLoadingPreview(false);
      }
    }
    setTab(nextTab);
  };

  const tools = [
    { id: "bold", icon: Bold, titleKey: "forumUi.editor_bold" },
    { id: "italic", icon: Italic, titleKey: "forumUi.editor_italic" },
    { id: "underline", icon: Underline, titleKey: "forumUi.editor_underline" },
    { id: "h2", icon: Heading2, titleKey: "forumUi.editor_heading" },
    { id: "code", icon: Code, titleKey: "forumUi.editor_inline_code" },
    { id: "codeblock", icon: Code2, titleKey: "forumUi.editor_code_block" },
    { id: "quote", icon: Quote, titleKey: "forumUi.editor_quote" },
    { id: "list", icon: List, titleKey: "forumUi.editor_unordered_list" },
    { id: "ordered", icon: ListOrdered, titleKey: "forumUi.editor_ordered_list" },
    { id: "link", icon: Link2, titleKey: "forumUi.editor_link" },
    { id: "image", icon: Image, titleKey: "forumUi.editor_image" },
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-200">
        <div className="flex items-center gap-0.5 flex-wrap">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={t(locale, tool.titleKey as "forumUi.editor_bold")}
              onClick={() => applyFormatting(tool.id)}
              className="p-1.5 rounded hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors"
            >
              <tool.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleTabSwitch("write")}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${tab === "write" ? "bg-brand text-[#08080A] font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Edit3 className="w-3 h-3" />
            {t(locale, "forumUi.write")}
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("preview")}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${tab === "preview" ? "bg-brand text-[#08080A] font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Eye className="w-3 h-3" />
            {t(locale, "forumUi.preview")}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={MAX_LENGTH}
          placeholder={placeholder ?? ("Write your content...")}
          style={{ minHeight }}
          className="w-full px-4 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-y font-mono leading-relaxed"
        />
      ) : (
        <div style={{ minHeight }} className="px-4 py-3">
          {loadingPreview ? (
            <div className="text-xs text-muted-foreground animate-pulse">
              {t(locale, "forumUi.loading_preview")}
            </div>
          ) : previewHtml ? (
            <div
              className="prose prose-sm max-w-none prose-invert prose-p:text-foreground prose-a:text-brand prose-code:bg-surface-300 prose-pre:bg-surface-300"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {t(locale, "forumUi.nothing_to_preview")}
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end px-3 py-1.5 border-t border-border bg-surface-200">
        <span className={`text-xs ${value.length > MAX_LENGTH * 0.9 ? "text-yellow-400" : "text-muted-foreground"}`}>
          {value.length.toLocaleString()}/{MAX_LENGTH.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
