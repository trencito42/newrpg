// ============================================================
// forum-markdown.ts — Safe server-side markdown rendering
// ============================================================

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Shared sanitize-html options used both server-side and client-side. */
export const FORUM_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s",
    "h2", "h3", "h4",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "img", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title"],
    code: ["class"],
    pre: ["class"],
  },
  allowedSchemes: ["https", "http"],
  disallowedTagsMode: "discard",
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
  },
};

/**
 * Server-side safe rendering.
 * Parses markdown with GFM + line breaks, then sanitises with explicit allowlist.
 */
export function renderForumContent(markdown: string): string {
  const rawHtml = marked.parse(markdown, { gfm: true, breaks: true }) as string;
  return sanitizeHtml(rawHtml, FORUM_SANITIZE_OPTIONS);
}

/** Generate a URL-friendly slug from a topic title. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 220);
}

/** Extract @mentions from raw markdown content. */
export function extractMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_]{1,32})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/**
 * Replace @username occurrences in sanitised HTML with linked spans.
 * Only links usernames that exist in the validated set.
 */
export function processMentions(html: string, validUsernames: Set<string>): string {
  return html.replace(/@([a-zA-Z0-9_]{1,32})/g, (match, username: string) => {
    if (validUsernames.has(username.toLowerCase())) {
      return `<a href="/players/${encodeURIComponent(username)}" class="text-brand hover:underline font-medium" rel="noopener noreferrer">@${username}</a>`;
    }
    return match;
  });
}
