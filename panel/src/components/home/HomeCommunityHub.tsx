"use client";

import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import type { HomeForumActivityItem } from "@/lib/home-forum-activity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { socialRelativeTime } from "@/components/social/social-time";
import { HomeSocialPostCarousel } from "./HomeSocialPostCarousel";

function ForumDiscussionCompact({
  locale,
  forumItems,
}: {
  locale: Locale;
  forumItems: HomeForumActivityItem[];
}) {
  if (forumItems.length === 0) return null;

  return (
    <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wide flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" aria-hidden />
          {t(locale, "community.latest_forum_discussions")}
        </h3>
        <Link
          href="/forum"
          className="text-xs text-[#D7B558] hover:text-[#E3C572] font-medium inline-flex items-center gap-0.5 transition-colors"
        >
          {t(locale, "community.view_all_forum")}
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>
      <ul className="divide-y divide-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0C]/40">
        {forumItems.slice(0, 4).map((item) => (
          <li key={item.postId}>
            <Link
              href={item.href}
              className="flex flex-col gap-0.5 py-2.5 px-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors group"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] font-medium text-[#D7B558] truncate">{item.forumName}</span>
                {item.replyCount > 0 ? (
                  <span className="text-[10px] text-[#8F8B83] shrink-0 font-mono">
                    {item.replyCount} {t(locale, "community.replies")}
                  </span>
                ) : null}
              </div>
              <p className="text-xs font-semibold text-[#F2EFE8] line-clamp-1 group-hover:text-[#D7B558] transition-colors">
                {item.topicTitle}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-[#8F8B83]">
                {item.authorIdentity ? (
                  <PlayerIdentity
                    username={item.authorIdentity.username}
                    factionId={item.authorIdentity.factionId}
                    factionColor={item.authorIdentity.factionColor}
                    clanTag={item.authorIdentity.clanTag}
                    clanColor={item.authorIdentity.clanColor}
                    clanTagStyle={item.authorIdentity.clanTagStyle}
                    size="sm"
                    clickable={false}
                  />
                ) : (
                  <span>{item.authorUsername}</span>
                )}
                <span aria-hidden>·</span>
                <span>{socialRelativeTime(item.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeCommunityHub({
  locale,
  feedPosts,
  forumItems,
  isLoggedIn,
  viewerCharId: _viewerCharId,
}: {
  locale: Locale;
  feedPosts: FeedPost[];
  forumItems: HomeForumActivityItem[];
  isLoggedIn: boolean;
  viewerCharId: number | null;
}) {
  const previewPosts = feedPosts.slice(0, 12);

  return (
    <section className="space-y-4" aria-labelledby="home-community-title">
      <h2
        id="home-community-title"
        className="text-xs font-semibold text-[#8F8B83] tracking-wide uppercase"
      >
        {t(locale, "community.section_title")}
      </h2>

      <HomeSocialPostCarousel locale={locale} posts={previewPosts} isLoggedIn={isLoggedIn} />

      <ForumDiscussionCompact locale={locale} forumItems={forumItems} />
    </section>
  );
}
