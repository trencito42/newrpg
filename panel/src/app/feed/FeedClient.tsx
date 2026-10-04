"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, ImagePlus, Trash2, Send, ChevronDown, X } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import { FeedPost } from "./page";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { LikersTooltip } from "@/components/ui/LikersTooltip";
import { getPedAvatarUrl } from "@/lib/gta-assets";

interface FeedClientProps {
  locale: Locale;
  initialGlobal: FeedPost[];
  initialContacts: FeedPost[];
  nextGlobalCursor: number | null;
  nextContactsCursor: number | null;
  isLoggedIn: boolean;
  viewerCharId: number | null;
  viewerCharName: string | null;
}

function relTime(raw: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(raw).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(raw).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function PedAvatar({ skin, name }: { skin: string | null; name: string }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = (() => {
    const parts = name.trim().split(" ");
    return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  })();

  if (!imgErr) {
    return (
      <div className="w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] overflow-hidden flex-shrink-0">
        <img
          src={getPedAvatarUrl(skin)}
          alt={name}
          className="w-full h-full object-cover object-top"
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-[rgba(215,181,88,0.15)] text-[#d7b558] flex items-center justify-center text-xs font-bold flex-shrink-0 select-none">
      {initials}
    </div>
  );
}

function CommentAvatar({ skin, name }: { skin: string | null; name: string }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = ((name[0] ?? "?")).toUpperCase();
  if (!imgErr) {
    return (
      <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] overflow-hidden flex-shrink-0">
        <img src={getPedAvatarUrl(skin)} alt="" className="w-full h-full object-cover object-top" onError={() => setImgErr(true)} />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-md bg-[rgba(215,181,88,0.1)] text-[#d7b558] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

interface PostCardProps {
  post: FeedPost;
  viewerCharId: number | null;
  isLoggedIn: boolean;
  locale: Locale;
  onDeleted: (id: number) => void;
}

function PostCard({ post, viewerCharId, isLoggedIn, locale, onDeleted }: PostCardProps) {
  const [likes, setLikes] = useState(Number(post.likes_count));
  const [liked, setLiked] = useState(!!Number(post.liked_by_viewer));
  const [commentCount, setCommentCount] = useState(Number(post.comments_count));
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [imageFull, setImageFull] = useState(false);

  const isOwn = viewerCharId !== null && Number(post.character_id) === viewerCharId;
  const authorName = `${post.firstname || ""} ${post.lastname || ""}`.trim();

  const toggleLike = async () => {
    if (!isLoggedIn) return;
    const action = liked ? "unlike" : "like";
    setLiked(!liked);
    setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setLikes(data.likesCount);
        setLiked(data.likedByViewer);
      } else {
        setLiked(liked);
        setLikes((n) => (liked ? n + 1 : Math.max(0, n - 1)));
      }
    } catch {
      setLiked(liked);
      setLikes((n) => (liked ? n + 1 : Math.max(0, n - 1)));
    }
  };

  const loadComments = async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && comments.length === 0) loadComments();
  };

  const sendComment = async () => {
    if (!commentText.trim() || !isLoggedIn) return;
    const body = commentText.trim();
    setCommentText("");
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) setComments((prev) => [...prev, data.comment]);
        setCommentCount(data.commentsCount ?? commentCount + 1);
      }
    } catch {}
  };

  const deletePost = async () => {
    if (!confirm(t(locale, "feed.delete_confirm"))) return;
    try {
      const res = await fetch(`/api/feed/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(post.id);
    } catch {}
  };

  return (
    <article id={`post-${post.id}`} className="py-4 border-b border-[rgba(255,255,255,0.07)]">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <PedAvatar skin={post.author_skin} name={authorName} />
        <div className="flex-1 min-w-0">
          <PlayerIdentity
            username={authorName}
            factionId={post.faction_id}
            clanTag={post.clan_tag}
            clanColor={post.clan_color}
            clanTagStyle={post.clan_tag_style}
            href={`/players/${encodeURIComponent(authorName.trim().replace(/\s+/g, "_"))}`}
            size="sm"
          />
          <span className="text-[#8F8B83] ml-2 inline-block">
            <Link
              href={`/feed#post-${post.id}`}
              className="text-[11px] text-[#8F8B83] hover:text-[#D4CFC8] transition-colors"
            >
              {relTime(post.created_at)}
            </Link>
          </span>
          {post.updated_at && post.updated_at !== post.created_at && (
            <span className="text-[10px] text-[#8F8B83] ml-1 opacity-60">{t(locale, "feed.edited")}</span>
          )}
        </div>
        {isOwn && (
          <button
            onClick={deletePost}
            className="text-[#8F8B83] hover:text-red-400 transition-colors p-1"
            title={t(locale, "feed.delete_title")}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      {post.body && (
        <p className="text-sm text-[#D4CFC8] leading-relaxed mb-3 whitespace-pre-wrap break-words">
          {post.body}
        </p>
      )}

      {/* Photo */}
      {post.media_url && (
        <>
          <img
            src={post.media_url}
            alt=""
            onClick={() => setImageFull(true)}
            className="w-full max-h-[400px] object-cover rounded-lg mb-3 cursor-pointer"
          />
          {imageFull && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
              onClick={() => setImageFull(false)}
            >
              <img src={post.media_url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5">
        <LikersTooltip
          count={likes}
          fetchUrl={`/api/feed/posts/${post.id}/likers`}
          disabled={!isLoggedIn}
        >
          <button
            onClick={toggleLike}
            disabled={!isLoggedIn}
            className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-red-400" : "text-[#8F8B83] hover:text-[#D4CFC8]"} disabled:opacity-50`}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} />
            <span>{likes}</span>
          </button>
        </LikersTooltip>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors"
        >
          <MessageCircle size={15} />
          <span>{commentCount}</span>
        </button>
      </div>

      {/* Comments */}
      {expanded && (
        <div className="mt-4 pl-3 border-l border-[rgba(255,255,255,0.07)]">
          {loadingComments && <p className="text-xs text-[#8F8B83]">{t(locale, "feed.loading_comments")}</p>}
          {comments.map((c) => (
            <div
              key={c.id}
              className={`flex gap-2 mb-3 ${c.parent_comment_id ? "ml-6" : ""}`}
            >
              <CommentAvatar skin={null} name={`${c.firstname ?? "?"}${c.lastname ?? ""}`} />
              <div className="flex-1">
                <span className="text-xs font-semibold text-[#D4CFC8]">
                  {c.firstname} {c.lastname}
                </span>
                <span className="text-[10px] text-[#8F8B83] ml-1">{relTime(c.created_at)}</span>
                <p className="text-xs text-[#B4AFA4] mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </div>
          ))}

          {isLoggedIn && (
            <div className="flex gap-2 mt-3">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendComment())}
                placeholder={t(locale, "feed.add_comment_placeholder")}
                maxLength={400}
                className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-full px-3 py-1.5 text-xs text-[#F2EFE8] placeholder-[#8F8B83] outline-none focus:border-[rgba(215,181,88,0.4)]"
              />
              <button
                onClick={sendComment}
                className="text-[#d7b558] hover:text-[#e9ca6f] transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

interface GalleryPhoto {
  media_id: number;
  url: string;
  thumbnail_url: string | null;
}

function GalleryPicker({
  locale,
  onSelect,
  onClose,
}: {
  locale: Locale;
  onSelect: (photo: GalleryPhoto) => void;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (photos !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feed/gallery");
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      } else {
        setPhotos([]);
      }
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  if (photos === null && !loading) load();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0e0e10] border border-[rgba(255,255,255,0.1)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <span className="text-sm font-bold text-[#F2EFE8]">{t(locale, "feed.choose_gallery")}</span>
          <button onClick={onClose} className="text-[#8F8B83] hover:text-[#D4CFC8]">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-3 flex-1">
          {loading && (
            <p className="text-xs text-[#8F8B83] text-center py-8">{t(locale, "feed.loading_gallery")}</p>
          )}
          {photos !== null && photos.length === 0 && (
            <p className="text-xs text-[#8F8B83] text-center py-8">
              {t(locale, "feed.no_gallery_photos")}
            </p>
          )}
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) => (
                <button
                  key={p.media_id}
                  onClick={() => onSelect(p)}
                  className="aspect-square overflow-hidden rounded-lg bg-[rgba(255,255,255,0.04)] hover:ring-2 hover:ring-[#d7b558] transition-all"
                >
                  <img
                    src={p.thumbnail_url ?? p.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({ locale, viewerCharName, onPosted }: { locale: Locale; viewerCharName: string | null; onPosted: (p: FeedPost) => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);

  const reset = () => {
    setOpen(false);
    setBody("");
    setSelectedPhoto(null);
    setShowPicker(false);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text && !selectedPhoto) return;
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text || null,
          media_id: selectedPhoto?.media_id ?? null,
        }),
      });
      if (res.ok) {
        reset();
        window.location.reload();
      }
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#8F8B83] transition-colors mb-6"
      >
        {t(locale, "feed.whats_happening")}
      </button>
    );
  }

  return (
    <>
      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 mb-6">
        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t(locale, "feed.whats_happening")}
          maxLength={500}
          rows={3}
          className="w-full bg-transparent text-sm text-[#F2EFE8] placeholder-[#8F8B83] outline-none resize-none"
        />

        {selectedPhoto && (
          <div className="relative mt-2 w-fit">
            <img
              src={selectedPhoto.thumbnail_url ?? selectedPhoto.url}
              alt=""
              className="h-24 w-auto rounded-lg object-cover border border-[rgba(255,255,255,0.12)]"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a1e] border border-[rgba(255,255,255,0.2)] rounded-full flex items-center justify-center text-[#8F8B83] hover:text-[#F2EFE8]"
            >
              <X size={11} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-xs text-[#8F8B83] hover:text-[#d7b558] transition-colors"
            title={t(locale, "feed.add_photo_title")}
          >
            <ImagePlus size={15} />
            {selectedPhoto ? t(locale, "feed.change_photo") : t(locale, "feed.add_photo")}
          </button>

          <div className="flex gap-2 items-center">
            <span className="text-xs text-[#8F8B83]">{body.length}/500</span>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors"
            >
              {t(locale, "feed.cancel")}
            </button>
            <button
              onClick={submit}
              disabled={(!body.trim() && !selectedPhoto) || sending}
              className="px-4 py-1.5 text-xs bg-[#d7b558] text-black font-semibold rounded-lg disabled:opacity-40 hover:bg-[#e9ca6f] transition-colors"
            >
              {sending ? t(locale, "feed.posting") : t(locale, "feed.post")}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <GalleryPicker
          locale={locale}
          onSelect={(p) => {
            setSelectedPhoto(p);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

export function FeedClient({
  locale,
  initialGlobal,
  initialContacts,
  nextGlobalCursor,
  nextContactsCursor,
  isLoggedIn,
  viewerCharId,
  viewerCharName,
}: FeedClientProps) {
  const defaultTab = initialContacts.length > 0 ? "contacts" : "global";
  const [tab, setTab] = useState<"contacts" | "global">(defaultTab);
  const [globalPosts, setGlobalPosts] = useState(initialGlobal);
  const [contactsPosts, setContactsPosts] = useState(initialContacts);
  const [globalCursor, setGlobalCursor] = useState(nextGlobalCursor);
  const [contactsCursor, setContactsCursor] = useState(nextContactsCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const posts = tab === "contacts" ? contactsPosts : globalPosts;
  const cursor = tab === "contacts" ? contactsCursor : globalCursor;

  const handleDeleted = (id: number) => {
    setGlobalPosts((p) => p.filter((x) => x.id !== id));
    setContactsPosts((p) => p.filter((x) => x.id !== id));
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = `/api/feed/posts?feed=${tab}&before_id=${cursor}&limit=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const newPosts: FeedPost[] = data.posts || [];
        const next = data.nextCursor;
        if (tab === "global") {
          setGlobalPosts((p) => [...p, ...newPosts]);
          setGlobalCursor(next);
        } else {
          setContactsPosts((p) => [...p, ...newPosts]);
          setContactsCursor(next);
        }
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[rgba(255,255,255,0.04)] rounded-lg p-1 w-fit">
        {(["contacts", "global"] as const).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${tab === tabId ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83] hover:text-[#D4CFC8]"}`}
          >
            {tabId === "contacts" ? t(locale, "feed.tab_contacts") : t(locale, "feed.tab_global")}
          </button>
        ))}
      </div>

      {/* Composer */}
      {isLoggedIn && (
        <Composer locale={locale} viewerCharName={viewerCharName} onPosted={() => {}} />
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <p className="text-sm text-[#8F8B83] text-center py-12">
          {tab === "contacts" ? t(locale, "feed.no_posts_contacts") : t(locale, "feed.no_posts_global")}
        </p>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            viewerCharId={viewerCharId}
            isLoggedIn={isLoggedIn}
            locale={locale}
            onDeleted={handleDeleted}
          />
        ))
      )}

      {cursor && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 mx-auto text-xs text-[#8F8B83] hover:text-[#D4CFC8] disabled:opacity-40 transition-colors"
          >
            <ChevronDown size={14} />
            {loadingMore ? t(locale, "feed.loading") : t(locale, "feed.load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
