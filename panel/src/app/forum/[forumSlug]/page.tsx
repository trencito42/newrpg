import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuerySingle, dbQuery } from "@/lib/db";
import { getForumPermissions } from "@/lib/forum-permissions";
import { notFound } from "next/navigation";
import type { Forum, ForumTopicListItem } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { Lock, Pin, Megaphone, Globe, MessageSquare, Eye, Clock, PenLine } from "lucide-react";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs } from "@/lib/player-identity";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getForumBySlug } from "@/lib/forum-data";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface ForumRow extends RowDataPacket, Forum {}
interface TopicRow extends RowDataPacket {
  id: number;
  forum_id: number;
  account_id: number;
  author_character_id: number | null;
  author_username: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  view_count: number;
  reply_count: number;
  last_post_at: string | null;
  last_post_username: string | null;
  last_post_account_id: number | null;
  last_post_character_id: number | null;
  last_post_id: number | null;
  has_poll: number;
  created_at: string;
  deleted_at: string | null;
  last_read_post_id: number | null;
  first_unread_post_id: number | null;
}

function TopicTypeIcon({ type, status }: { type: string; status: string }) {
  if (status === "locked") return <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
  if (type === "global") return <Globe className="w-3.5 h-3.5 text-brand flex-shrink-0" />;
  if (type === "announcement") return <Megaphone className="w-3.5 h-3.5 text-brand flex-shrink-0" />;
  if (type === "pinned") return <Pin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
  return <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
}

function formatTime(date: string | null, locale: "en" | "ro") {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

interface PageProps {
  params: Promise<{ forumSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { forumSlug } = await params;
  const forum = await getForumBySlug(forumSlug);
  if (!forum) notFound();
  const [session, publicPermissions] = await Promise.all([getCurrentSession(), getForumPermissions(null, forum)]);
  const viewerPermissions = session ? await getForumPermissions(session, forum) : publicPermissions;
  if (!viewerPermissions.canView) notFound();
  if (!publicPermissions.canView) return buildMetadata({ title: "Private forum", description: "Private RACKET RPG forum.", path: `/forum/${forum.slug}`, noIndex: true });
  return buildMetadata({ title: forum.name, description: forum.description || `${forum.name} discussions on RACKET RPG.`, path: `/forum/${forum.slug}` });
}

export default async function ForumPage({ params, searchParams }: PageProps) {
  const { forumSlug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);

  const forum = await getForumBySlug(forumSlug) as ForumRow | null;

  if (!forum) notFound();

  const permissions = await getForumPermissions(session, forum);
  if (!permissions.canView) notFound();

  const isMod = permissions.canModerate;
  const accountId = session?.accountId ?? 0;

  const topics = await dbQuery<TopicRow>(
    `SELECT t.*, tr.last_read_post_id,
            CASE WHEN ? > 0 THEN (
              SELECT MIN(up.id) FROM panel_forum_posts up
              WHERE up.topic_id = t.id AND up.deleted_at IS NULL AND up.id > COALESCE(tr.last_read_post_id, 0)
            ) ELSE NULL END AS first_unread_post_id
     FROM panel_forum_topics t
     LEFT JOIN panel_forum_topic_reads tr ON tr.topic_id = t.id AND tr.account_id = ?
     WHERE t.forum_id = ?
       AND (t.deleted_at IS NULL ${isMod ? "OR t.deleted_at IS NOT NULL" : ""})
     ORDER BY FIELD(t.type,'global','announcement','pinned','normal'), t.last_post_at DESC
     LIMIT ? OFFSET ?`,
    [accountId, accountId, forum.id, PAGE_SIZE, offset]
  );

  interface CountRow extends RowDataPacket { total: number }
  const countRow = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total FROM panel_forum_topics
     WHERE forum_id = ? AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
    [forum.id]
  );
  const totalTopics = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTopics / PAGE_SIZE));

  const identities = await resolvePlayerIdentitiesByRefs(topics.flatMap((topic) => [
    { accountId: topic.account_id, characterId: topic.author_character_id, username: topic.author_username },
    ...(topic.last_post_account_id && topic.last_post_username
      ? [{ accountId: topic.last_post_account_id, characterId: topic.last_post_character_id, username: topic.last_post_username }]
      : []),
  ]));

  const canCreate = permissions.canCreateTopic;

  return (
    <div className="space-y-4">
      {/* Forum header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/forum" className="hover:text-foreground transition-colors">
              {"Forum"}
            </Link>
            <span>/</span>
            <span className="text-foreground">{forum.name}</span>
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight uppercase">
            {forum.name}
          </h1>
          {forum.description && (
            <p className="text-sm text-muted-foreground mt-1">{forum.description}</p>
          )}
        </div>
        {canCreate && (
          <Link
            href={`/forum/new-topic/${forum.id}`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-300 text-[#08080A] text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            {"New Topic"}
          </Link>
        )}
      </div>

      {/* Topic list */}
      {topics.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {"No topics yet"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {topics.map((topic, idx) => {
            const isUnread =
              accountId > 0 &&
              topic.last_post_id != null &&
              (topic.last_read_post_id ?? 0) < (topic.last_post_id ?? 0);

            return (
              <div
                key={topic.id}
                className={`flex items-center gap-3 px-4 py-3 bg-card hover:bg-surface-200 transition-colors ${idx > 0 ? "border-t border-border" : ""} ${topic.deleted_at ? "opacity-50" : ""}`}
              >
                <TopicTypeIcon type={topic.type} status={topic.status} />

                {/* Unread dot */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isUnread ? "bg-brand" : "bg-transparent"}`} />

                {/* Title area */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={isUnread && topic.first_unread_post_id
                      ? `/forum/topic/${topic.id}/${topic.slug}?postId=${topic.first_unread_post_id}#post-${topic.first_unread_post_id}`
                      : `/forum/topic/${topic.id}/${topic.slug}`}
                    className="text-sm font-semibold text-foreground hover:text-brand transition-colors truncate block"
                  >
                    {topic.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {(() => {
                      const identity = identities.get(playerIdentityKey(topic.account_id, topic.author_character_id));
                      return <PlayerIdentity username={identity?.username ?? topic.author_username} factionId={identity?.factionId} factionColor={identity?.factionColor} clanTag={identity?.clanTag} clanColor={identity?.clanColor} clanTagStyle={identity?.clanTagStyle} size="sm" />;
                    })()}
                    <span>·</span>
                    <span>{formatTime(topic.created_at, locale)}</span>
                    {topic.deleted_at && (
                      <span className="text-red-400">{"[deleted]"}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{topic.reply_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{topic.view_count}</span>
                  </div>
                </div>

                {/* Last post */}
                <div className="hidden md:flex flex-col items-end text-xs text-muted-foreground flex-shrink-0 min-w-[80px]">
                  {topic.last_post_at && (
                    <>
                      {topic.last_post_account_id && topic.last_post_username && (() => {
                        const identity = identities.get(playerIdentityKey(topic.last_post_account_id!, topic.last_post_character_id));
                        return <PlayerIdentity username={identity?.username ?? topic.last_post_username!} factionId={identity?.factionId} factionColor={identity?.factionColor} clanTag={identity?.clanTag} clanColor={identity?.clanColor} clanTagStyle={identity?.clanTagStyle} size="sm" />;
                      })()}
                      <Link href={`/forum/topic/${topic.id}/${topic.slug}?postId=${topic.last_post_id}#post-${topic.last_post_id}`} className="flex items-center gap-1 hover:text-foreground">
                        <Clock className="w-2.5 h-2.5" />
                        <time dateTime={new Date(topic.last_post_at).toISOString()}>{formatTime(topic.last_post_at, locale)}</time>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          {page > 1 && (
            <Link
              href={`/forum/${forumSlug}?page=${page - 1}`}
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-200 hover:bg-surface-300 text-foreground transition-colors"
            >
              {"Prev"}
            </Link>
          )}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <Link
                key={p}
                href={`/forum/${forumSlug}?page=${p}`}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${p === page ? "bg-brand text-[#08080A] font-bold" : "bg-surface-200 hover:bg-surface-300 text-foreground"}`}
              >
                {p}
              </Link>
            );
          })}
          {page < totalPages && (
            <Link
              href={`/forum/${forumSlug}?page=${page + 1}`}
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-200 hover:bg-surface-300 text-foreground transition-colors"
            >
              {"Next"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
