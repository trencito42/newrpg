"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { LikersTooltip } from "@/components/ui/LikersTooltip";
import { SocialPedAvatar } from "./SocialPedAvatar";
import { socialRelativeTime } from "./social-time";
import { SocialComments } from "./SocialComments";

export type SocialPostVariant = "full" | "compact" | "profile";

export function SocialPostCard({
  post,
  viewerCharId,
  isLoggedIn,
  locale,
  variant = "full",
  onDeleted,
}: {
  post: FeedPost;
  viewerCharId: number | null;
  isLoggedIn: boolean;
  locale: Locale;
  variant?: SocialPostVariant;
  onDeleted?: (id: number) => void;
}) {
  const [likes, setLikes] = useState(Number(post.likes_count));
  const [liked, setLiked] = useState(!!Number(post.liked_by_viewer));
  const [commentCount, setCommentCount] = useState(Number(post.comments_count));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [imageFull, setImageFull] = useState(false);

  const isOwn = viewerCharId !== null && Number(post.character_id) === viewerCharId;
  const authorName = `${post.firstname || ""} ${post.lastname || ""}`.trim();
  const profileSlug = `/players/${encodeURIComponent(authorName.trim().replace(/\s+/g, "_"))}`;
  const postHref = `/feed#post-${post.id}`;

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

  const deletePost = async () => {
    if (!confirm(t(locale, "feed.delete_confirm"))) return;
    try {
      const res = await fetch(`/api/feed/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) onDeleted?.(post.id);
    } catch {
      /* ignore */
    }
  };

  const compact = variant === "compact" || variant === "profile";
  const mediaMaxH = variant === "compact" ? "max-h-[220px]" : "max-h-[400px]";

  const wrapperClass =
    variant === "profile"
      ? "py-3 border-b border-[rgba(255,255,255,0.07)] last:border-0"
      : "py-4 border-b border-[rgba(255,255,255,0.07)]";

  return (
    <article id={`post-${post.id}`} className={wrapperClass}>
      <div className="flex items-start gap-3 mb-2 sm:mb-3">
        <SocialPedAvatar skin={post.author_skin} name={authorName} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <PlayerIdentity
              username={authorName}
              factionId={post.faction_id}
              clanTag={post.clan_tag}
              clanColor={post.clan_color}
              clanTagStyle={post.clan_tag_style}
              href={profileSlug}
              size="sm"
            />
            <Link
              href={postHref}
              className="text-[11px] sm:text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors"
            >
              {socialRelativeTime(post.created_at)}
            </Link>
            {post.updated_at && post.updated_at !== post.created_at && (
              <span className="text-[10px] text-[#8F8B83] opacity-60">{t(locale, "feed.edited")}</span>
            )}
          </div>
        </div>
        {isOwn && variant === "full" && (
          <button
            type="button"
            onClick={deletePost}
            className="text-[#8F8B83] hover:text-red-400 transition-colors p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
            title={t(locale, "feed.delete_title")}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {post.body && (
        <p
          className={`text-sm text-[#D4CFC8] leading-relaxed mb-2 sm:mb-3 whitespace-pre-wrap break-words ${compact ? "line-clamp-4" : ""}`}
        >
          {post.body}
        </p>
      )}

      {post.media_url && (
        <>
          <img
            src={post.thumbnail_url ?? post.media_url}
            alt=""
            onClick={() => setImageFull(true)}
            className={`w-full ${mediaMaxH} object-cover rounded-lg mb-2 sm:mb-3 cursor-pointer`}
          />
          {imageFull && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setImageFull(false)}
              role="presentation"
            >
              <img src={post.media_url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-4 sm:gap-5">
        <LikersTooltip
          count={likes}
          fetchUrl={`/api/feed/posts/${post.id}/likers`}
          disabled={!isLoggedIn}
          locale={locale}
        >
          <button
            type="button"
            onClick={toggleLike}
            disabled={!isLoggedIn}
            className={`flex items-center gap-1.5 text-xs transition-colors min-h-[40px] px-1 ${liked ? "text-red-400" : "text-[#8F8B83] hover:text-[#D4CFC8]"} disabled:opacity-50`}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            <span>{likes}</span>
          </button>
        </LikersTooltip>

        <button
          type="button"
          onClick={() => setCommentsOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-[#8F8B83] hover:text-[#D4CFC8] transition-colors min-h-[40px] px-1"
        >
          <MessageCircle size={16} />
          <span>{commentCount}</span>
        </button>

        {variant === "profile" && (
          <Link href={postHref} className="ml-auto text-xs text-[#d7b558] hover:underline min-h-[40px] flex items-center">
            {t(locale, "community.view_post")}
          </Link>
        )}
      </div>

      {commentsOpen && (
        <SocialComments
          postId={post.id}
          locale={locale}
          isLoggedIn={isLoggedIn}
          commentCount={commentCount}
          onCommentCountChange={setCommentCount}
          defaultExpanded
        />
      )}
    </article>
  );
}
