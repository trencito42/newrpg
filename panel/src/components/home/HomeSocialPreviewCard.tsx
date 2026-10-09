import Link from "next/link";
import { Heart, MessageCircle, ImageIcon } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import { SocialPedAvatar } from "@/components/social/SocialPedAvatar";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { socialRelativeTime } from "@/components/social/social-time";
import { horizontalCardSlideClass } from "@/components/ui/HorizontalCardScroller";
import { cn } from "@/lib/utils";

const CARD_SLIDE =
  `${horizontalCardSlideClass} shrink-0 snap-start w-[min(280px,calc(100vw-2*var(--panel-gutter)-var(--racket-hscroll-peek)))] sm:w-[min(300px,calc(33.333%-0.75rem))] lg:w-[min(320px,calc(33.333%-0.85rem))]`;

export function HomeSocialPreviewCard({
  post,
  locale,
}: {
  post: FeedPost;
  locale: Locale;
}) {
  const authorName = `${post.firstname || ""} ${post.lastname || ""}`.trim();
  const postHref = `/feed#post-${post.id}`;
  const hasMedia = Boolean(post.media_url);
  const hasBody = Boolean(post.body?.trim());
  const likes = Number(post.likes_count) || 0;
  const comments = Number(post.comments_count) || 0;
  const thumbSrc = post.thumbnail_url ?? post.media_url;

  return (
    <Link
      href={postHref}
      data-social-preview-card
      className={cn(
        CARD_SLIDE,
        "group flex flex-col h-[240px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0E0E10]",
        "hover:border-[rgba(255,255,255,0.14)] hover:bg-[#101012] transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B558]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0C]",
        "overflow-hidden p-3"
      )}
    >
      <div className="flex items-start gap-2 min-w-0 mb-2">
        <SocialPedAvatar skin={post.author_skin} name={authorName} size="sm" />
        <div className="flex-1 min-w-0">
          <PlayerIdentity
            username={authorName}
            factionId={post.faction_id}
            clanTag={post.clan_tag}
            clanColor={post.clan_color}
            clanTagStyle={post.clan_tag_style}
            size="sm"
            clickable={false}
            showClanTag
            className="truncate max-w-full"
          />
          <time className="text-[10px] text-[#8F8B83] mt-0.5 block" dateTime={post.created_at}>
            {socialRelativeTime(post.created_at)}
          </time>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-2.5">
        <div className="flex-1 min-w-0 min-h-0">
          {hasBody ? (
            <p className="text-xs text-[#D4CFC8] leading-relaxed line-clamp-5 whitespace-pre-wrap break-words">
              {post.body}
            </p>
          ) : hasMedia ? (
            <p className="text-xs text-[#8F8B83] flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
              {t(locale, "community.shared_photo")}
            </p>
          ) : (
            <p className="text-xs text-[#8F8B83] line-clamp-2">{t(locale, "community.view_post")}</p>
          )}
        </div>
        {hasMedia && thumbSrc ? (
          <div
            className="w-[72px] h-[72px] shrink-0 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.25)] overflow-hidden flex items-center justify-center"
          >
            <img
              src={thumbSrc}
              alt=""
              className="max-w-full max-h-full w-auto h-auto object-contain"
              loading="lazy"
              draggable={false}
            />
          </div>
        ) : null}
      </div>

      <div
        className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-4 text-[11px] text-[#8F8B83]"
        aria-hidden
      >
        <span className="inline-flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" strokeWidth={2} />
          {likes}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
          {comments}
        </span>
      </div>
    </Link>
  );
}
