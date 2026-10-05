"use client";

import { useState } from "react";
import { ForumMarkdownRenderer } from "./ForumMarkdownRenderer";
import { PostReportModal } from "./PostReportModal";
import { Shield, Wrench, Edit3, Trash2, Flag, RotateCcw, Copy, Clock } from "lucide-react";
import type { ForumPostItem } from "@/lib/forum-types";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { GTAImage } from "@/components/ui/GTAImage";
import { getPedAvatarUrl } from "@/lib/gta-assets";
import { getFactionLabel } from "@/lib/factions";

interface PostCardProps {
  post: ForumPostItem;
  isMod: boolean;
  canEditOwn: boolean;
  canDeleteOwn: boolean;
  currentAccountId: number;
  currentCharacterId: number | null;
  locale: "en" | "ro";
  topicId: number;
  topicSlug: string;
}

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatDate(dateStr: string, locale: "en" | "ro") {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function joinedYear(dateStr: string) {
  return new Date(dateStr).getFullYear();
}

export function PostCard({ post, isMod, canEditOwn, canDeleteOwn, currentAccountId, currentCharacterId, locale, topicId, topicSlug }: PostCardProps) {
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

  const isOwner = currentAccountId === post.account_id && currentAccountId > 0 && (!post.author_character_id || post.author_character_id === currentCharacterId);
  const canEdit =
    isMod ||
    (canEditOwn && isOwner && !post.deleted_at && Date.now() - new Date(post.created_at).getTime() < EDIT_WINDOW_MS);
  const canDelete = isMod || (canDeleteOwn && isOwner && !post.deleted_at);
  const canRestore = isMod && localDeleted;

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
        setLocalContent(data.content);
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
    // Strip HTML tags for editing — post.content is HTML from server
    const div = typeof document !== "undefined" ? document.createElement("div") : null;
    if (div) {
      div.innerHTML = localContent;
      setEditContent(div.textContent ?? localContent);
    } else {
      setEditContent(localContent);
    }
    setEditing(true);
  };

  const permalink = `${typeof window !== "undefined" ? window.location.origin : ""}/forum/topic/${topicId}/${topicSlug}?postId=${post.id}#post-${post.id}`;
  const identity = post.author_identity;
  const profileHref = `/players/${encodeURIComponent(identity?.username ?? post.author_username)}`;

  return (
    <article
      id={`post-${post.id}`}
      className={`flex flex-col sm:flex-row gap-0 rounded-xl border border-border overflow-hidden ${localDeleted ? "opacity-60" : ""}`}
    >
      {/* Author column */}
      <div className="w-full sm:w-40 flex-shrink-0 bg-surface-200 p-4 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2">
        <Link href={profileHref} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-300 flex items-center justify-center flex-shrink-0 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" aria-label={`View ${identity?.username ?? post.author_username}'s profile`}>
          <GTAImage src={getPedAvatarUrl(identity?.skin)} alt={`${identity?.username ?? post.author_username} avatar`} className="w-full h-full object-cover object-top" />
        </Link>
        <div className="flex-1 sm:flex-none">
          <PlayerIdentity username={identity?.username ?? post.author_username} factionId={identity?.factionId} factionColor={identity?.factionColor} clanTag={identity?.clanTag} clanColor={identity?.clanColor} clanTagStyle={identity?.clanTagStyle} href={profileHref} size="sm" />
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {(post.author_admin_level ?? 0) >= 1 && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-bold">
                <Shield className="w-2.5 h-2.5" /> Admin {post.author_admin_level}
              </span>
            )}
            {(post.author_admin_level ?? 0) === 0 && (post.author_helper_level ?? 0) >= 1 && (
              <span className="flex items-center gap-0.5 text-[10px] text-blue-400 font-bold">
                <Wrench className="w-2.5 h-2.5" /> Helper {post.author_helper_level}
              </span>
            )}
          </div>
          {identity?.factionId && <div className="text-[10px] text-muted-foreground mt-1">{getFactionLabel(identity.factionId)}{identity.factionRank != null ? ` · Rank ${identity.factionRank}` : ""}</div>}
          {identity?.clanName && <div className="text-[10px] text-muted-foreground">{identity.clanName}{identity.clanRank ? ` · ${identity.clanRank}` : ""}</div>}
          <div className="text-[10px] text-muted-foreground mt-1">
            {post.author_post_count ?? 0} {"posts"}
          </div>
          {post.author_joined_at && (
            <div className="text-[10px] text-muted-foreground">
              {"Joined"} {joinedYear(post.author_joined_at)}
            </div>
          )}
        </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 bg-card flex flex-col">
        {/* Post header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-200/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <Link href={`/forum/topic/${topicId}/${topicSlug}?postId=${post.id}#post-${post.id}`} className="hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded-sm">
              <time dateTime={new Date(post.created_at).toISOString()}>{formatDate(post.created_at, locale)}</time>
            </Link>
            {post.edited_at && (
              <span className="inline-flex items-center gap-1 italic">
                · {"edited by"}{" "}
                <PlayerIdentity
                  username={post.edited_by_identity?.username ?? post.edited_by_username ?? post.author_username}
                  factionId={post.edited_by_identity?.factionId}
                  factionColor={post.edited_by_identity?.factionColor}
                  clanTag={post.edited_by_identity?.clanTag}
                  clanColor={post.edited_by_identity?.clanColor}
                  clanTagStyle={post.edited_by_identity?.clanTagStyle}
                  size="sm"
                />
                {post.edit_reason && ` · "${post.edit_reason}"`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (typeof navigator !== "undefined") {
                  navigator.clipboard.writeText(permalink).catch(() => {});
                }
              }}
              className="p-1 rounded hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors"
              title={"Copy link"} // i18n-ignore: english-only
            >
              <Copy className="w-3 h-3" />
            </button>
            {canEdit && (
              <button
                onClick={startEdit}
                className="p-1 rounded hover:bg-surface-300 text-muted-foreground hover:text-foreground transition-colors"
                title={"Edit"} // i18n-ignore: english-only
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
            {canDelete && !localDeleted && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1 rounded hover:bg-surface-300 text-muted-foreground hover:text-red-400 transition-colors"
                title={"Delete"} // i18n-ignore: english-only
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            {canRestore && (
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="p-1 rounded hover:bg-surface-300 text-muted-foreground hover:text-green-400 transition-colors"
                title={"Restore"} // i18n-ignore: english-only
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
            {currentAccountId > 0 && !isOwner && (
              <button
                onClick={() => setShowReport(true)}
                className="p-1 rounded hover:bg-surface-300 text-muted-foreground hover:text-yellow-400 transition-colors"
                title={"Report"} // i18n-ignore: english-only
              >
                <Flag className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Post body */}
        <div className="px-4 py-3 flex-1">
          {localDeleted ? (
            <div className="text-xs text-muted-foreground italic">
              {isMod ? (
                <span>
                  {"Deleted by"}{" "}
                  <PlayerIdentity
                    username={post.deleted_by_identity?.username ?? post.deleted_by_username ?? "unknown"}
                    factionId={post.deleted_by_identity?.factionId}
                    factionColor={post.deleted_by_identity?.factionColor}
                    clanTag={post.deleted_by_identity?.clanTag}
                    clanColor={post.deleted_by_identity?.clanColor}
                    clanTagStyle={post.deleted_by_identity?.clanTagStyle}
                    size="sm"
                  />
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
                    ? ("Saving...")
                    : ("Save")}
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
      </div>

      {/* Report modal */}
      {showReport && (
        <PostReportModal
          postId={post.id}
          locale={locale}
          onClose={() => setShowReport(false)}
        />
      )}
    </article>
  );
}
