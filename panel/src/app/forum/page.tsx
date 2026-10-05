import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { getForumAccessMap } from "@/lib/forum-permissions";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs } from "@/lib/player-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { MarkAllReadButton } from "@/components/forum/MarkAllReadButton";
import type { Forum, ForumCategory, ForumCategoryWithForums } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { MessageSquare, Lock, Megaphone, Newspaper, BookOpen, MessageCircle, Camera, Lightbulb, HelpCircle, Bug, Flag, Shield, Heart, Users, Car, Building2, Home, Package } from "lucide-react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: "Forum", description: "RACKET RPG community discussions, server news and public guides.", path: "/forum" });

export const dynamic = "force-dynamic";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Megaphone, Newspaper, BookOpen, MessageCircle, Camera, Lightbulb,
  HelpCircle, Bug, Flag, Shield, Heart, Users, Car, Building2, Home, Package, Lock,
};

function ForumIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? MessageSquare;
  return <Icon className={className} />;
}

function formatLastPost(forum: Forum, locale: "en" | "ro") {
  if (!forum.last_post_at) return null;
  const date = new Date(forum.last_post_at);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return locale === "ro" ? `acum ${m} min` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return locale === "ro" ? `acum ${h}h` : `${h}h ago`;
  }
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

interface CategoryRow extends RowDataPacket, ForumCategory {}
interface ForumRow extends RowDataPacket, Forum { last_topic_slug: string | null }

export default async function ForumIndexPage() {
  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);

  const categories = await dbQuery<CategoryRow>(
    `SELECT * FROM panel_forum_categories WHERE is_visible = 1 ORDER BY sort_order ASC`
  );

  const forums = await dbQuery<ForumRow>(
    `SELECT f.*, t.slug AS last_topic_slug
     FROM panel_forums f LEFT JOIN panel_forum_topics t ON t.id = f.last_topic_id
     ORDER BY f.sort_order ASC`
  );

  const accessMap = await getForumAccessMap(session, forums);
  const accessibleForums = forums
    .filter((forum) => accessMap.get(forum.id)?.canView)
    .map((forum) => ({
      ...forum,
      is_locked: Boolean(forum.is_locked),
      is_visible: Boolean(forum.is_visible),
    }));

  const identities = await resolvePlayerIdentitiesByRefs(accessibleForums.flatMap((forum) =>
    forum.last_post_account_id && forum.last_post_username
      ? [{ accountId: forum.last_post_account_id, characterId: forum.last_post_character_id, username: forum.last_post_username }]
      : []
  ));
  const lastTopicSlugs = new Map(accessibleForums.map((forum) => [forum.id, forum.last_topic_slug]));

  const categoryList: ForumCategoryWithForums[] = categories.map((cat) => ({
    ...cat,
    is_visible: Boolean(cat.is_visible),
    forums: accessibleForums.filter(
      (f) => f.category_id === cat.id && f.parent_forum_id === null
    ),
  })).filter((category) => category.forums.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight uppercase">
            {"Forum"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {"RACKET RPG Community"}
          </p>
        </div>
        {session && (
          <Link
            href="/forum/my"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {"My activity"}
          </Link>
        )}
      </div>

      {categoryList.map((cat) => (
        <div key={cat.id}>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand">
              {locale === "ro" ? cat.name_ro : cat.name_en}
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          {cat.forums.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-2">
              {"No forums available"}
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              {cat.forums.map((forum, idx) => (
                <div
                  key={forum.id}
                  className={`flex items-center gap-4 px-4 py-3 bg-card hover:bg-surface-200 transition-colors ${idx > 0 ? "border-t border-border" : ""}`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-300 flex items-center justify-center">
                    <ForumIcon name={forum.icon} className="w-5 h-5 text-brand" />
                  </div>

                  {/* Forum info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/forum/${forum.slug}`}
                        className="font-bold text-sm text-foreground hover:text-brand transition-colors"
                      >
                        {forum.name}
                      </Link>
                      {forum.is_locked && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    {forum.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {forum.description}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground flex-shrink-0">
                    <div className="text-center">
                      <div className="font-semibold text-foreground">{forum.topic_count.toLocaleString()}</div>
                      <div>{"topics"}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-foreground">{forum.post_count.toLocaleString()}</div>
                      <div>{"posts"}</div>
                    </div>
                  </div>

                  {/* Last post */}
                  <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground flex-shrink-0 min-w-[120px]">
                    {forum.last_post_at ? (
                      <>
                        {forum.last_topic_id && <Link href={`/forum/topic/${forum.last_topic_id}/${lastTopicSlugs.get(forum.id) || "topic"}${forum.last_post_id ? `?postId=${forum.last_post_id}#post-${forum.last_post_id}` : ""}`} className="text-foreground hover:text-brand truncate max-w-[120px]">{forum.last_topic_title}</Link>}
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {forum.last_post_account_id && forum.last_post_username && (() => {
                            const identity = identities.get(playerIdentityKey(forum.last_post_account_id!, forum.last_post_character_id));
                            return <PlayerIdentity username={identity?.username ?? forum.last_post_username!} factionId={identity?.factionId} factionColor={identity?.factionColor} clanTag={identity?.clanTag} clanColor={identity?.clanColor} clanTagStyle={identity?.clanTagStyle} size="sm" />;
                          })()}
                          <span>·</span>
                          <Link href={`/forum/topic/${forum.last_topic_id}/${lastTopicSlugs.get(forum.id) || "topic"}${forum.last_post_id ? `?postId=${forum.last_post_id}#post-${forum.last_post_id}` : ""}`} className="hover:text-foreground">
                            <time dateTime={new Date(forum.last_post_at).toISOString()}>{formatLastPost(forum, locale)}</time>
                          </Link>
                        </span>
                      </>
                    ) : (
                      <span>{"No posts"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
        <Link href="/forum/search" className="hover:text-foreground transition-colors">
          {"Search forum"}
        </Link>
        {session && (
          <MarkAllReadButton />
        )}
      </div>
    </div>
  );
}
