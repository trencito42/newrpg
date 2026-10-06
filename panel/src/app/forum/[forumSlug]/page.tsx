import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuerySingle, dbQuery } from "@/lib/db";
import { canAccessForum } from "@/lib/forum-permissions";
import { forumAuthorKey, resolveForumAuthorIdentities } from "@/lib/forum-author-identity";
import { buildMetadata } from "@/lib/seo/metadata";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Forum, ForumTopicListItem } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { MessageSquare, PenLine } from "lucide-react";
import { TopicListItem } from "@/components/forum/TopicListItem";
import { t } from "@/lib/i18n";

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
  last_post_id: number | null;
  last_post_account_id: number | null;
  has_poll: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
  template_data: Record<string, unknown> | null;
  last_read_post_id: number | null;
  first_unread_post_id: number | null;
}

interface PageProps {
  params: Promise<{ forumSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { forumSlug } = await params;
  const session = await getCurrentSession();
  const forum = await dbQuerySingle<ForumRow>(
    `SELECT * FROM panel_forums WHERE slug = ? LIMIT 1`,
    [forumSlug]
  );
  if (!forum) {
    return buildMetadata({ title: "Forum", noIndex: true }); // i18n-ignore: english-only seo
  }
  if (!(await canAccessForum(session, forum))) {
    return buildMetadata({ title: "Forum", noIndex: true }); // i18n-ignore: english-only seo
  }
  return buildMetadata({
    title: forum.name,
    description:
      forum.description || `Discussion in ${forum.name} on RACKET RPG.`, // i18n-ignore: english-only seo
    path: `/forum/${forum.slug}`,
  });
}

export default async function ForumPage({ params, searchParams }: PageProps) {
  const { forumSlug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);

  const forum = await dbQuerySingle<ForumRow>(
    `SELECT * FROM panel_forums WHERE slug = ? LIMIT 1`,
    [forumSlug]
  );

  if (!forum) notFound();

  const accessible = await canAccessForum(session, forum);
  if (!accessible) {
    if (!session) redirect("/login");
    notFound();
  }

  const isMod = session && (session.adminLevel >= 1 || session.helperLevel >= 1);
  const accountId = session?.accountId ?? 0;

  const topics = await dbQuery<TopicRow>(
    `SELECT t.*, tr.last_read_post_id,
            (SELECT MIN(p.id) FROM panel_forum_posts p
             WHERE p.topic_id = t.id AND p.deleted_at IS NULL
               AND p.id > COALESCE(tr.last_read_post_id, 0)) AS first_unread_post_id
     FROM panel_forum_topics t
     LEFT JOIN panel_forum_topic_reads tr ON tr.topic_id = t.id AND tr.account_id = ?
     WHERE t.forum_id = ?
       AND (t.deleted_at IS NULL ${isMod ? "OR t.deleted_at IS NOT NULL" : ""})
     ORDER BY FIELD(t.type,'global','announcement','pinned','normal'), t.last_post_at DESC
     LIMIT ? OFFSET ?`,
    [accountId, forum.id, PAGE_SIZE, offset]
  );

  const identityRefs = topics.flatMap((t) => {
    const refs = [
      {
        accountId: t.account_id,
        characterId: t.author_character_id,
        username: t.author_username,
      },
    ];
    if (t.last_post_username && t.last_post_account_id) {
      refs.push({
        accountId: t.last_post_account_id,
        characterId: null,
        username: t.last_post_username,
      });
    }
    return refs;
  });
  const identityMap = await resolveForumAuthorIdentities(identityRefs);

  interface CountRow extends RowDataPacket { total: number }
  const countRow = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total FROM panel_forum_topics
     WHERE forum_id = ? AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
    [forum.id]
  );
  const totalTopics = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTopics / PAGE_SIZE));

  const canCreate = session !== null && !forum.is_locked;

  return (
    <div className="space-y-4">
      {/* Forum header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/forum" className="hover:text-foreground transition-colors">
              {t(locale, "forumUi.title")}
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
            {t(locale, "forumUi.new_topic")}
          </Link>
        )}
      </div>

      {/* Topic list */}
      {topics.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t(locale, "forumUi.no_topics")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {topics.map((topic) => {
            const isUnread =
              accountId > 0 &&
              topic.last_post_id != null &&
              (topic.last_read_post_id ?? 0) < (topic.last_post_id ?? 0);
            return (
              <TopicListItem
                key={topic.id}
                topic={{
                  ...topic,
                  type: topic.type as ForumTopicListItem["type"],
                  status: topic.status as ForumTopicListItem["status"],
                  has_poll: Boolean(topic.has_poll),
                  is_unread: isUnread,
                  last_read_post_id: topic.last_read_post_id,
                  first_unread_post_id: topic.first_unread_post_id,
                }}
                locale={locale}
                firstUnreadPostId={topic.first_unread_post_id}
                authorIdentity={identityMap.get(
                  forumAuthorKey({
                    accountId: topic.account_id,
                    characterId: topic.author_character_id,
                    username: topic.author_username,
                  })
                )}
                lastPosterIdentity={
                  topic.last_post_account_id && topic.last_post_username
                    ? identityMap.get(
                        forumAuthorKey({
                          accountId: topic.last_post_account_id,
                          characterId: null,
                          username: topic.last_post_username,
                        })
                      )
                    : undefined
                }
              />
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
              {t(locale, "forumUi.prev")}
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
              {t(locale, "forumUi.next")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
