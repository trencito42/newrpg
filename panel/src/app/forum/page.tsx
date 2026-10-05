import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { canAccessForum } from "@/lib/forum-permissions";
import { forumAuthorKey, resolveForumAuthorIdentities } from "@/lib/forum-author-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import type { Forum, ForumCategory, ForumCategoryWithForums } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { MessageSquare, Lock, Megaphone, Newspaper, BookOpen, MessageCircle, Camera, Lightbulb, HelpCircle, Bug, Flag, Shield, Heart, Users, Car, Building2, Home, Package } from "lucide-react";

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
interface ForumRow extends RowDataPacket, Forum {}

export default async function ForumIndexPage() {
  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);

  const categories = await dbQuery<CategoryRow>(
    `SELECT * FROM panel_forum_categories WHERE is_visible = 1 ORDER BY sort_order ASC`
  );

  const forums = await dbQuery<ForumRow>(
    `SELECT * FROM panel_forums ORDER BY sort_order ASC`
  );

  const accessChecks = await Promise.all(
    forums.map(async (f) => ({
      forum: f,
      canAccess: await canAccessForum(session, f),
    }))
  );

  const accessibleForums = accessChecks
    .filter((x) => x.canAccess)
    .map((x) => ({
      ...x.forum,
      is_locked: Boolean(x.forum.is_locked),
      is_visible: Boolean(x.forum.is_visible),
    }));

  const categoryList: ForumCategoryWithForums[] = categories
    .map((cat) => ({
      ...cat,
      is_visible: Boolean(cat.is_visible),
      forums: accessibleForums.filter(
        (f) => f.category_id === cat.id && f.parent_forum_id === null
      ),
    }))
    .filter((cat) => cat.forums.length > 0);

  const lastTopicIds = accessibleForums
    .map((f) => f.last_topic_id)
    .filter((id): id is number => typeof id === "number" && id > 0);
  let topicSlugById = new Map<number, string>();
  if (lastTopicIds.length > 0) {
    const placeholders = lastTopicIds.map(() => "?").join(",");
    interface SlugRow extends RowDataPacket {
      id: number;
      slug: string;
    }
    const slugRows = await dbQuery<SlugRow>(
      `SELECT id, slug FROM panel_forum_topics WHERE id IN (${placeholders})`,
      lastTopicIds
    );
    topicSlugById = new Map(slugRows.map((r) => [r.id, r.slug]));
  }

  const lastPosterRefs = accessibleForums
    .filter((f) => f.last_post_account_id && f.last_post_username)
    .map((f) => ({
      accountId: f.last_post_account_id!,
      characterId: null,
      username: f.last_post_username!,
    }));
  const lastPosterMap = await resolveForumAuthorIdentities(lastPosterRefs);

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
                    {forum.last_post_at && forum.last_topic_id ? (
                      <>
                        <Link
                          href={`/forum/topic/${forum.last_topic_id}/${topicSlugById.get(forum.last_topic_id!) || "topic"}`}
                          className="text-foreground truncate max-w-[120px] hover:text-brand transition-colors"
                        >
                          {forum.last_topic_title}
                        </Link>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {forum.last_post_username && forum.last_post_account_id ? (
                            <PlayerIdentity
                              {...(lastPosterMap.get(
                                forumAuthorKey({
                                  accountId: forum.last_post_account_id,
                                  characterId: null,
                                  username: forum.last_post_username,
                                })
                              ) || {
                                username: forum.last_post_username,
                                factionId: null,
                                factionColor: null,
                                clanId: null,
                                clanTag: null,
                                clanColor: null,
                              })}
                              size="sm"
                            />
                          ) : null}
                          <span>·</span>
                          <span>{formatLastPost(forum, locale)}</span>
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
          <button
            onClick={undefined}
            className="hover:text-foreground transition-colors cursor-default"
          >
            {"Mark all as read"}
          </button>
        )}
      </div>
    </div>
  );
}
