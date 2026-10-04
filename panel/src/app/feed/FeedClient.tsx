"use client";

import { useState, useRef } from "react";
import { Heart, MessageCircle, Image, Trash2, Send, ChevronDown } from "lucide-react";
import { Locale } from "@/lib/i18n";
import { FeedPost } from "./page";

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

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
  return (
    <div className="w-9 h-9 rounded-full bg-[rgba(215,181,88,0.15)] text-[#d7b558] flex items-center justify-center text-xs font-bold flex-shrink-0 select-none">
      {initials.toUpperCase()}
    </div>
  );
}

interface PostCardProps {
  post: FeedPost;
  viewerCharId: number | null;
  isLoggedIn: boolean;
  onDeleted: (id: number) => void;
}

function PostCard({ post, viewerCharId, isLoggedIn, onDeleted }: PostCardProps) {
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
        setComments((prev) => [...prev, data.comment]);
        setCommentCount(data.commentsCount);
      }
    } catch {}
  };

  const deletePost = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/feed/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(post.id);
    } catch {}
  };

  return (
    <article className="py-4 border-b border-[rgba(255,255,255,0.07)]">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={authorName} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[#F2EFE8]">{authorName}</span>
          <span className="text-[11px] text-[#8F8B83] ml-2">{relTime(post.created_at)}</span>
          {post.updated_at && post.updated_at !== post.created_at && (
            <span className="text-[10px] text-[#8F8B83] ml-1 opacity-60">· edited</span>
          )}
        </div>
        {isOwn && (
          <button
            onClick={deletePost}
            className="text-[#8F8B83] hover:text-red-400 transition-colors p-1"
            title="Delete post"
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
        <button
          onClick={toggleLike}
          disabled={!isLoggedIn}
          className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-red-400" : "text-[#8F8B83] hover:text-[#D4CFC8]"} disabled:opacity-50`}
        >
          <Heart size={15} fill={liked ? "currentColor" : "none"} />
          <span>{likes}</span>
        </button>

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
          {loadingComments && <p className="text-xs text-[#8F8B83]">Loading...</p>}
          {comments.map((c) => (
            <div
              key={c.id}
              className={`flex gap-2 mb-3 ${c.parent_comment_id ? "ml-6" : ""}`}
            >
              <div className="w-6 h-6 rounded-full bg-[rgba(215,181,88,0.1)] text-[#d7b558] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                {((c.firstname?.[0] ?? "?") + (c.lastname?.[0] ?? "")).toUpperCase()}
              </div>
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
                placeholder="Add a comment..."
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

function Composer({ viewerCharName, onPosted }: { viewerCharName: string | null; onPosted: (p: FeedPost) => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setBody("");
        setOpen(false);
        // Reload feed from top
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
        What&apos;s happening?
      </button>
    );
  }

  return (
    <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 mb-6">
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What's happening?"
        maxLength={500}
        rows={3}
        className="w-full bg-transparent text-sm text-[#F2EFE8] placeholder-[#8F8B83] outline-none resize-none"
      />
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
        <span className="text-xs text-[#8F8B83]">{body.length}/500</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setOpen(false); setBody(""); }}
            className="px-3 py-1.5 text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!body.trim() || sending}
            className="px-4 py-1.5 text-xs bg-[#d7b558] text-black font-semibold rounded-lg disabled:opacity-40 hover:bg-[#e9ca6f] transition-colors"
          >
            {sending ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
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
        {(["contacts", "global"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${tab === t ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83] hover:text-[#D4CFC8]"}`}
          >
            {t === "contacts" ? "Contacts" : "Global"}
          </button>
        ))}
      </div>

      {/* Composer */}
      {isLoggedIn && (
        <Composer viewerCharName={viewerCharName} onPosted={() => {}} />
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <p className="text-sm text-[#8F8B83] text-center py-12">
          {tab === "contacts" ? "No posts from your contacts yet." : "No posts yet."}
        </p>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            viewerCharId={viewerCharId}
            isLoggedIn={isLoggedIn}
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
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
