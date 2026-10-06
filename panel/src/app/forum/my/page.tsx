"use client";
import { t, type Locale } from "@/lib/i18n";

import { useState, useEffect } from "react";
import { useViewerLocale } from "@/components/LocaleProvider";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type Tab = "topics" | "posts" | "bookmarks" | "subscriptions";

interface BaseItem {
  id: number;
  topic_id?: number;
  title?: string;
  slug?: string;
  forum_name?: string;
  created_at?: string;
  bookmarked_at?: string;
  subscribed_at?: string;
  reply_count?: number;
  last_post_at?: string | null;
}

export default function MyForumPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as Tab) ?? "topics";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const locale = useViewerLocale();
  const [items, setItems] = useState<BaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/forum/my?tab=${tab}&page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => setError(t(locale, "forumUi.error_network")))
      .finally(() => setLoading(false));
  }, [tab, page]);

  const setTab = (t: Tab) => {
    router.push(`/forum/my?tab=${t}`);
  };

  const TABS: { key: Tab; labelKey: "forumUi.tab_my_topics" | "forumUi.tab_my_posts" | "forumUi.tab_bookmarks" | "forumUi.tab_subscriptions" }[] = [
    { key: "topics", labelKey: "forumUi.tab_my_topics" },
    { key: "posts", labelKey: "forumUi.tab_my_posts" },
    { key: "bookmarks", labelKey: "forumUi.tab_bookmarks" },
    { key: "subscriptions", labelKey: "forumUi.tab_subscriptions" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link href="/forum" className="hover:text-foreground transition-colors">{t(locale, "forumUi.title")}</Link>
          <span>/</span>
          <span className="text-foreground">{t(locale, "forumUi.my_activity_title")}</span>
        </div>
        <h1 className="text-xl font-extrabold text-foreground uppercase tracking-tight">
          {t(locale, "forumUi.my_activity_title")}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors -mb-px border-b-2 ${
              tab === tabItem.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(locale, tabItem.labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-surface-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t(locale, "forumUi.nothing_to_show")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const topicId = item.topic_id ?? item.id;
            const topicSlug = item.slug ?? "";
            const forumName = item.forum_name ?? "";

            return (
              <div key={item.id} className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-surface-200 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/forum/topic/${topicId}/${topicSlug}`}
                      className="text-sm font-semibold text-foreground hover:text-brand transition-colors truncate block"
                    >
                      {item.title ?? `Post #${item.id}`}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{forumName}</span>
                      {item.reply_count !== undefined && (
                        <>
                          <span>·</span>
                          <span>{item.reply_count} {t(locale, "forumUi.replies")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(item.bookmarked_at ?? item.subscribed_at ?? item.created_at ?? "").toLocaleDateString(
                      "en-US"
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 justify-center">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => router.push(`/forum/my?tab=${tab}&page=${p}`)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  p === page ? "bg-brand text-[#08080A] font-bold" : "bg-surface-200 hover:bg-surface-300 text-foreground"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
