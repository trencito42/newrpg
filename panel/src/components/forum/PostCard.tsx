"use client";

import { useState } from "react";
import Link from "next/link";
import { ForumMarkdownRenderer } from "./ForumMarkdownRenderer";
import { PostReportModal } from "./PostReportModal";
import { ForumAuthorPane } from "./ForumAuthorPane";
import { PostCardActions } from "./PostCardActions";
import { Clock } from "lucide-react";
import type { ForumPostItem } from "@/lib/forum-types";
import type { ResolvedPlayerIdentity } from "@/lib/player-identity";
import { formatForumClock } from "@/lib/forum-time";

interface PostCardProps {
  post: ForumPostItem;
  authorIdentity: ResolvedPlayerIdentity;
  isMod: boolean;
  currentAccountId: number;
  locale: "en" | "ro";
  topicId: number;
  topicSlug: string;
}

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function PostCard({ post, authorIdentity, isMod, currentAccountId, locale, topicId, topicSlug }: PostCardProps) {
  const [showReport, setShowReport] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [localContent, setLocalContent] = useState(post.content);
  const [localDeleted, setLocalDeleted] = useState(!!post.deleted_at);

  const isOwner = currentAccountId === post.account_id && currentAccountId > 0;
  const canEdit =
    isMod ||
    (isOwner && !post.deleted_at && Date.now() - new Date(post.created_at).getTime() < EDIT_WINDOW_MS);
  const canDelete = isMod || (isOwner && !post.deleted_at);
  const canRestore = isMod && localDeleted;
  const canReport = currentAccountId > 0 && !isOwner;

  const handleDelete = async () => {
    const reason = isMod ? prompt("Delete reason:") ?? undefined : undefined;
    if (!confirm("Are you sure?")) return; // i18n-ignore: english-only
    setDeleting(true);
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) setLocalDeleted(true);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/forum/posts/${post.id}/restore`, { method: "POST" });
      if (res.ok) setLocalDeleted(false);
    } finally {
      setRestoring(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, reason: editReason || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalContent(editContent);
        setEditing(false);
      } else {
        setEditError(data.error ?? "error");
      }
    } catch {
      setEditError("network_error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const startEdit = () => {
    const div = typeof document !== "undefined" ? document.createElement("div") : null;
    if (div) {
      div.innerHTML = localContent;
      setEditContent(div.textContent ?? localContent);
    } else {
      setEditContent(localContent);
    }
    setEditing(true);
  };

  const permalinkPath = `/forum/topic/${topicId}/${topicSlug}#post-${post.id}`;
  const permalink =
    typeof window !== "undefined" ? `${window.location.origin}${permalinkPath}` : permalinkPath;
  const createdIso = post.created_at;

  const copyLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(permalink).catch(() => {});
    }
  };

  const authorPaneProps = {
    identity: authorIdentity,
    postCount: post.author_post_count ?? 0,
    joinedAt: post.author_joined_at,
    adminLevel: post.author_admin_level ?? 0,
    helperLevel: post.author_helper_level ?? 0,
    locale,
  };

  const actionProps = {
    canEdit,
    canDelete,
    canRestore,
    canReport,
    deleting,
    restoring,
    onCopyLink: copyLink,
    onEdit: startEdit,
    onDelete: handleDelete,
    onRestore: handleRestore,
    onReport: () => setShowReport(true),
  };

  return (
    <article
      id={`post-${post.id}`}
      className={`flex flex-col sm:flex-row gap-0 rounded-xl border border-border overflow-hidden ${localDeleted ? "opacity-60" : ""}`}
    >
      <ForumAuthorPane {...authorPaneProps} variant="mobile" />

      <ForumAuthorPane {...authorPaneProps} variant="desktop" />

      <div className="flex-1 min-w-0 bg-card flex flex-col">
        {/* Desktop post meta header */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 border-b border-border bg-surface-200/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <Link href={permalinkPath} className="hover:text-brand transition-colors truncate">
              <time dateTime={createdIso}>{formatForumClock(post.created_at_unix ?? post.created_at, locale)}</time>
            </Link>
            {post.edited_at ? (
              <span className="italic truncate">
                · {"edited by"} {post.edited_by_username ?? post.author_username}
                {post.edit_reason && ` · "${post.edit_reason}"`}
              </span>
            ) : null}
          </div>
          <PostCardActions layout="desktop" {...actionProps} />
        </div>

        <div className="px-4 py-3 max-sm:px-4 max-sm:py-3.5 flex-1 min-w-0">
          {localDeleted ? (
            <div className="text-sm max-sm:text-sm text-muted-foreground italic">
              {isMod ? (
                <span>
                  {"Deleted by"}{" "}
                  {post.deleted_by_username ?? "unknown"} // i18n-ignore: english-only
                  {post.delete_reason && ` · ${"Reason"}: ${post.delete_reason}`}
                </span>
              ) : (
                <span>{"[post deleted]"}</span>
              )}
            </div>
          ) : editing ? (
            <form onSubmit={handleEditSubmit} className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-surface-200 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-brand resize-y font-mono"
              />
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder={"Edit reason (optional)..."} // i18n-ignore: english-only
                className="w-full px-3 py-1.5 bg-surface-200 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand"
              />
              {editError && <p className="text-xs text-red-400">{editError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-3 py-1.5 bg-brand text-[#08080A] text-xs font-bold uppercase rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {editSubmitting
                    ? ("Saving...") // i18n-ignore: english-only
                    : ("Save")} // i18n-ignore: english-only
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 bg-surface-200 text-foreground text-xs font-bold uppercase rounded-lg hover:bg-surface-300 transition-colors"
                >
                  {"Cancel"}
                </button>
              </div>
            </form>
          ) : (
            <ForumMarkdownRenderer content={localContent} />
          )}
        </div>

        {/* Mobile footer: timestamp + actions */}
        <footer className="max-sm:flex sm:hidden items-center justify-between gap-2 px-4 py-2.5 border-t border-border/60 bg-surface-200/25 min-h-[48px]">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
              <Link href={permalinkPath} className="hover:text-brand transition-colors truncate">
                <time dateTime={createdIso} className="text-sm text-foreground/90 font-medium">
                  {formatForumClock(post.created_at_unix ?? post.created_at, locale)}
                </time>
              </Link>
            </div>
            {post.edited_at ? (
              <p className="text-[11px] leading-snug text-muted-foreground truncate pl-5">
                {"edited by"} {post.edited_by_username ?? post.author_username}
              </p>
            ) : null}
          </div>
          <PostCardActions layout="mobile" {...actionProps} />
        </footer>
      </div>

      {showReport ? (
        <PostReportModal postId={post.id} locale={locale} onClose={() => setShowReport(false)} />
      ) : null}
    </article>
  );
}
