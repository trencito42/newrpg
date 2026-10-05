"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquare, Rss } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import type { FeedPost } from "@/lib/social-feed";
import type { HomeForumActivityItem } from "@/lib/home-forum-activity";
import { SocialComposer } from "@/components/social/SocialComposer";
import { SocialFeedList } from "@/components/social/SocialFeedList";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { socialRelativeTime } from "@/components/social/social-time";

type MobileTab = "feed" | "forum";

export function HomeCommunityHub({
  locale,
  feedPosts,
  forumItems,
  isLoggedIn,
  viewerCharId,
}: {
  locale: Locale;
  feedPosts: FeedPost[];
  forumItems: HomeForumActivityItem[];
  isLoggedIn: boolean;
  viewerCharId: number | null;
}) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("feed");
  const [posts, setPosts] = useState(feedPosts);

  const forumList = (
    <ul className="space-y-0 divide-y divide-[rgba(255,255,255,0.06)]">
      {forumItems.length === 0 ? (
        <li className="text-sm text-[#8F8B83] py-6 text-center">{t(locale, "community.no_forum_activity")}</li>
      ) : (
        forumItems.map((item) => (
          <li key={item.postId}>
            <Link
              href={item.href}
              className="block py-3.5 hover:bg-[rgba(255,255,255,0.02)] -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide text-[#D7B558] font-semibold truncate">
                  {item.forumName}
                </span>
                <span className="text-[11px] text-[#8F8B83] shrink-0">{socialRelativeTime(item.createdAt)}</span>
              </div>
              <p className="text-sm font-semibold text-[#F2EFE8] line-clamp-2 leading-snug">{item.topicTitle}</p>
              {item.authorIdentity ? (
                <div className="mt-1.5">
                  <PlayerIdentity
                    username={item.authorIdentity.username}
                    factionId={item.authorIdentity.factionId}
                    factionColor={item.authorIdentity.factionColor}
                    clanTag={item.authorIdentity.clanTag}
                    clanColor={item.authorIdentity.clanColor}
                    clanTagStyle={item.authorIdentity.clanTagStyle}
                    size="sm"
                  />
                </div>
              ) : (
                <p className="text-xs text-[#8F8B83] mt-1">{item.authorUsername}</p>
              )}
              <p className="text-xs text-[#99958E] mt-1.5 line-clamp-2">{item.excerpt}</p>
              <p className="text-[11px] text-[#8F8B83] mt-1.5">
                {item.isFirstPost ? t(locale, "community.started_topic") : t(locale, "community.replied")}
                {item.replyCount > 0 ? ` · ${item.replyCount} ${t(locale, "community.replies")}` : ""}
              </p>
            </Link>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rss className="w-4 h-4 text-[#D7B558]" />
          <h2 className="text-sm font-bold text-[#F2EFE8] uppercase tracking-wider">
            {t(locale, "community.section_title")}
          </h2>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] md:hidden">
        {(["feed", "forum"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`flex-1 min-h-[44px] text-xs font-semibold rounded-md transition-colors ${
              mobileTab === id ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83]"
            }`}
          >
            {id === "feed" ? t(locale, "nav.feed") : t(locale, "nav.forum")}
          </button>
        ))}
      </div>

      {/* Desktop two-column */}
      <div className="hidden md:grid md:grid-cols-3 gap-5 rounded-xl bg-[#0E0E10] p-4 lg:p-5">
        <div className="md:col-span-2 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider">
              {t(locale, "nav.feed")}
            </span>
            <Link
              href="/feed"
              className="text-xs text-[#D7B558] hover:text-[#E3C572] font-semibold flex items-center gap-1"
            >
              {t(locale, "community.view_all_feed")}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {isLoggedIn && <SocialComposer locale={locale} variant="compact" />}
          <SocialFeedList
            locale={locale}
            posts={posts}
            viewerCharId={viewerCharId}
            isLoggedIn={isLoggedIn}
            variant="compact"
            showLoadMore={false}
            onPostsChange={setPosts}
          />
        </div>
        <div className="min-w-0 border-l border-[rgba(255,255,255,0.06)] pl-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#8F8B83] uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              {t(locale, "nav.forum")}
            </span>
            <Link
              href="/forum"
              className="text-xs text-[#D7B558] hover:text-[#E3C572] font-semibold flex items-center gap-1"
            >
              {t(locale, "community.view_all_forum")}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {forumList}
        </div>
      </div>

      {/* Mobile single stream */}
      <div className="md:hidden rounded-xl bg-[#0E0E10] p-4">
        {mobileTab === "feed" ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#8F8B83] uppercase">{t(locale, "nav.feed")}</span>
              <Link href="/feed" className="text-xs text-[#D7B558] font-semibold flex items-center gap-0.5">
                {t(locale, "community.view_all_feed")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {isLoggedIn && <SocialComposer locale={locale} variant="compact" />}
            <SocialFeedList
              locale={locale}
              posts={posts}
              viewerCharId={viewerCharId}
              isLoggedIn={isLoggedIn}
              variant="compact"
              showLoadMore={false}
              onPostsChange={setPosts}
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#8F8B83] uppercase">{t(locale, "nav.forum")}</span>
              <Link href="/forum" className="text-xs text-[#D7B558] font-semibold flex items-center gap-0.5">
                {t(locale, "community.view_all_forum")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {forumList}
          </>
        )}
      </div>
    </section>
  );
}
