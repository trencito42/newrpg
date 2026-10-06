import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuerySingle, dbQuery } from "@/lib/db";
import { canAccessForum } from "@/lib/forum-permissions";
import { forumAuthorKey, resolveForumAuthorIdentities } from "@/lib/forum-author-identity";
import { buildMetadata } from "@/lib/seo/metadata";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Forum, ForumTopic, ForumPostItem, ForumPoll } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { PostCard } from "@/components/forum/PostCard";
import { TopicActionsMenu } from "@/components/forum/TopicActionsMenu";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { PollDisplay } from "@/components/forum/PollDisplay";
import { PostHashScroll } from "@/components/forum/PostHashScroll";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface ForumRow extends RowDataPacket, Forum {}

interface TopicRow extends RowDataPacket {
  id: number;
  forum_id: number;
  account_id: number;
  author_username: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  view_count: number;
  reply_count: number;
  last_post_id: number | null;
  last_post_at: string | null;
  last_post_account_id: number | null;
  last_post_username: string | null;
  has_poll: number;
  template_data: Record<string, unknown> | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
}

interface PostRow extends RowDataPacket {
  id: number;
  topic_id: number;
  forum_id: number;
  account_id: number;
  author_character_id: number | null;
  author_username: string;
  content: string;
  is_first_post: number;
  edited_at: string | null;
  edited_by_account_id: number | null;
  edit_reason: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_account_id: number | null;
  delete_reason: string | null;
  author_admin_level: number;
  author_helper_level: number;
  author_post_count: number;
  author_joined_at: string;
  deleted_by_username: string | null;
  edited_by_username: string | null;
}

interface PageProps {
  params: Promise<{ id: string; slug: string }>;
  searchParams: Promise<{ page?: string; postId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: idStr, slug } = await params;
  const topicId = parseInt(idStr, 10);
  if (!Number.isFinite(topicId)) {
    return buildMetadata({ title: "Forum", noIndex: true }); // i18n-ignore: english-only seo
  }

  const session = await getCurrentSession();
  const topic = await dbQuerySingle<TopicRow>(
    `SELECT id, title, slug, forum_id, deleted_at FROM panel_forum_topics WHERE id = ? LIMIT 1`,
    [topicId]
  );
  if (!topic || topic.deleted_at) {
    return buildMetadata({ title: "Forum", noIndex: true }); // i18n-ignore: english-only seo
  }

  const forum = await dbQuerySingle<ForumRow>(`SELECT * FROM panel_forums WHERE id = ? LIMIT 1`, [
    topic.forum_id,
  ]);
  if (!forum) {
    return buildMetadata({ title: "Forum", noIndex: true }); // i18n-ignore: english-only seo
  }
  const accessible = await canAccessForum(session, forum);
  if (!accessible) {
    return buildMetadata({ title: "Forum", noIndex: true }); // i18n-ignore: english-only seo
  }

  return buildMetadata({
    title: topic.title,
    description: `${forum.name} — discussion on ${topic.title}`,
    path: `/forum/topic/${topic.id}/${topic.slug || slug}`,
    type: "article",
  });
}

export default async function TopicPage({ params, searchParams }: PageProps) {
  const { id: idStr, slug: urlSlug } = await params;
  const { page: pageParam, postId: postIdParam } = await searchParams;

  const topicId = parseInt(idStr, 10);
  if (!Number.isFinite(topicId)) notFound();

  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);
  const isMod = session && (session.adminLevel >= 1 || session.helperLevel >= 1);
  const accountId = session?.accountId ?? 0;

  const topic = await dbQuerySingle<TopicRow>(
    `SELECT * FROM panel_forum_topics WHERE id = ? LIMIT 1`,
    [topicId]
  );

  if (!topic) notFound();
  if (topic.deleted_at && !isMod) notFound();

  const forum = await dbQuerySingle<ForumRow>(
    `SELECT * FROM panel_forums WHERE id = ? LIMIT 1`,
    [topic.forum_id]
  );

  if (!forum) notFound();

  const accessible = await canAccessForum(session, forum);
  if (!accessible) {
    if (!session) redirect("/account/login");
    notFound();
  }

  if (urlSlug !== topic.slug) {
    const qs = pageParam ? `?page=${pageParam}` : "";
    redirect(`/forum/topic/${topicId}/${topic.slug}${qs}`);
  }

  // Resolve page from postId
  let page = Math.max(1, parseInt(pageParam ?? "1", 10));
  if (postIdParam) {
    const postId = parseInt(postIdParam, 10);
    if (Number.isFinite(postId)) {
      interface PosRow extends RowDataPacket { pos: number }
      const posRow = await dbQuerySingle<PosRow>(
        `SELECT COUNT(*) AS pos FROM panel_forum_posts
         WHERE topic_id = ? AND id <= ?
           AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
        [topicId, postId]
      );
      if (posRow) page = Math.ceil(posRow.pos / PAGE_SIZE);
    }
  }

  const offset = (page - 1) * PAGE_SIZE;

  const posts = await dbQuery<PostRow>(
    `SELECT p.*,
            a.admin_level AS author_admin_level,
            a.helper_level AS author_helper_level,
            (SELECT COUNT(*) FROM panel_forum_posts pp WHERE pp.account_id = p.account_id AND pp.deleted_at IS NULL) AS author_post_count,
            a.created_at AS author_joined_at,
            da.username AS deleted_by_username,
            ea.username AS edited_by_username
     FROM panel_forum_posts p
     JOIN accounts a ON a.id = p.account_id
     LEFT JOIN accounts da ON da.id = p.deleted_by_account_id
     LEFT JOIN accounts ea ON ea.id = p.edited_by_account_id
     WHERE p.topic_id = ?
       AND (p.deleted_at IS NULL ${isMod ? "OR p.deleted_at IS NOT NULL" : ""})
     ORDER BY p.created_at ASC
     LIMIT ? OFFSET ?`,
    [topicId, PAGE_SIZE, offset]
  );

  interface CountRow extends RowDataPacket { total: number }
  const countRow = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total FROM panel_forum_posts
     WHERE topic_id = ?
       AND (deleted_at IS NULL ${isMod ? "OR deleted_at IS NOT NULL" : ""})`,
    [topicId]
  );
  const totalPosts = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));

  // Mark as read
  if (session && posts.length > 0) {
    const lastPostId = posts[posts.length - 1].id;
    dbQuerySingle(
      `INSERT INTO panel_forum_topic_reads (account_id, topic_id, last_read_post_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_post_id = GREATEST(last_read_post_id, ?), read_at = NOW()`,
      [session.accountId, topicId, lastPostId, lastPostId]
    ).catch(() => {});
  }

  // Load poll
  let poll: ForumPoll | null = null;
  if (topic.has_poll) {
    interface PollRow extends RowDataPacket {
      id: number;
      topic_id: number;
      question: string;
      max_selections: number;
      allows_change: number;
      closes_at: string | null;
      created_at: string;
    }
    const pollData = await dbQuerySingle<PollRow>(
      `SELECT * FROM panel_forum_polls WHERE topic_id = ? LIMIT 1`,
      [topicId]
    );
    if (pollData) {
      interface OptionRow extends RowDataPacket {
        id: number; poll_id: number; label: string; sort_order: number; votes_count: number;
      }
      const options = await dbQuery<OptionRow>(
        `SELECT * FROM panel_forum_poll_options WHERE poll_id = ? ORDER BY sort_order ASC`,
        [pollData.id]
      );
      let userVoteOptionIds: number[] = [];
      if (session) {
        interface VoteRow extends RowDataPacket { option_id: number }
        const votes = await dbQuery<VoteRow>(
          `SELECT option_id FROM panel_forum_poll_votes WHERE poll_id = ? AND account_id = ?`,
          [pollData.id, session.accountId]
        );
        userVoteOptionIds = votes.map((v) => v.option_id);
      }
      poll = {
        ...pollData,
        allows_change: Boolean(pollData.allows_change),
        options,
        user_vote_option_ids: userVoteOptionIds,
        total_votes: options.reduce((s, o) => s + o.votes_count, 0),
      };
    }
  }

  const authorRefs = posts.map((p) => ({
    accountId: p.account_id,
    characterId: p.author_character_id,
    username: p.author_username,
  }));
  authorRefs.push({
    accountId: topic.account_id,
    characterId: (topic as TopicRow & { author_character_id?: number | null }).author_character_id ?? null,
    username: topic.author_username,
  });
  const identityMap = await resolveForumAuthorIdentities(authorRefs);

  const postItems: ForumPostItem[] = posts.map((p) => ({
    id: p.id,
    topic_id: p.topic_id,
    forum_id: p.forum_id,
    account_id: p.account_id,
    author_character_id: p.author_character_id,
    author_username: p.author_username,
    content: p.deleted_at && !isMod ? "" : p.content,
    is_first_post: Boolean(p.is_first_post),
    edited_at: p.edited_at,
    edited_by_account_id: p.edited_by_account_id,
    edit_reason: p.edit_reason,
    created_at: p.created_at,
    created_at_unix: (p as PostRow & { created_at_unix?: number | null }).created_at_unix ?? null,
    deleted_at: p.deleted_at,
    deleted_by_account_id: p.deleted_by_account_id,
    delete_reason: isMod ? p.delete_reason : null,
    author_admin_level: p.author_admin_level,
    author_helper_level: p.author_helper_level,
    author_post_count: p.author_post_count,
    author_joined_at: p.author_joined_at,
    deleted_by_username: isMod ? p.deleted_by_username : null,
    edited_by_username: p.edited_by_username,
  }));

  const userCanReply =
    session !== null &&
    accessible &&
    !forum.is_locked &&
    topic.status === "open" &&
    !topic.deleted_at;

  const topicForClient = {
    id: topic.id,
    forum_id: topic.forum_id,
    account_id: topic.account_id,
    title: topic.title,
    slug: topic.slug,
    type: topic.type,
    status: topic.status,
  };

  const forumSlug = forum.slug;

  return (
    <div className="space-y-4">
      <PostHashScroll />
      {/* Topic header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link href="/forum" className="hover:text-foreground transition-colors">
            {t(locale, "forumUi.title")}
          </Link>
          <span>/</span>
          <Link href={`/forum/${forumSlug}`} className="hover:text-foreground transition-colors">
            {forum.name}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{topic.title}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">{topic.title}</h1>
          {Boolean(isMod) ? (
            <TopicActionsMenu
              topic={topicForClient}
              locale={locale}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="inline-flex items-center gap-1">
            {t(locale, "forumUi.by")}
            <PlayerIdentity
              {...(identityMap.get(
                forumAuthorKey({
                  accountId: topic.account_id,
                  characterId:
                    (topic as TopicRow & { author_character_id?: number | null }).author_character_id ??
                    null,
                  username: topic.author_username,
                })
              ) || { username: topic.author_username, factionId: null, factionColor: null, clanId: null, clanTag: null, clanColor: null })}
              size="sm"
            />
          </span>
          <span>·</span>
          <span>{topic.reply_count} {t(locale, "forumUi.replies")}</span>
          <span>·</span>
          <span>{topic.view_count} {t(locale, "forumUi.views")}</span>
          {topic.status === "locked" && (
            <>
              <span>·</span>
              <span className="text-yellow-400">{t(locale, "forumUi.locked")}</span>
            </>
          )}
          {topic.deleted_at && Boolean(isMod) ? (
            <>
              <span>·</span>
              <span className="text-red-400">{t(locale, "forumUi.deleted")}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Poll */}
      {poll && session && (
        <PollDisplay poll={poll} topicId={topicId} locale={locale} />
      )}

      {/* Posts */}
      <div className="space-y-3">
        {postItems.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            authorIdentity={
              identityMap.get(
                forumAuthorKey({
                  accountId: post.account_id,
                  characterId: post.author_character_id ?? null,
                  username: post.author_username,
                })
              ) || {
                username: post.author_username,
                factionId: null,
                factionColor: null,
                clanId: null,
                clanTag: null,
                clanColor: null,
              }
            }
            isMod={Boolean(isMod)}
            currentAccountId={accountId}
            locale={locale}
            topicId={topicId}
            topicSlug={topic.slug}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          {page > 1 && (
            <Link
              href={`/forum/topic/${topicId}/${topic.slug}?page=${page - 1}`}
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
                href={`/forum/topic/${topicId}/${topic.slug}?page=${p}`}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${p === page ? "bg-brand text-[#08080A] font-bold" : "bg-surface-200 hover:bg-surface-300 text-foreground"}`}
              >
                {p}
              </Link>
            );
          })}
          {page < totalPages && (
            <Link
              href={`/forum/topic/${topicId}/${topic.slug}?page=${page + 1}`}
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-200 hover:bg-surface-300 text-foreground transition-colors"
            >
              {t(locale, "forumUi.next")}
            </Link>
          )}
        </div>
      )}

      {/* Reply form */}
      {userCanReply && (
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t(locale, "forumUi.reply")}
          </h3>
          <ReplyForm topicId={topicId} topicSlug={topic.slug} locale={locale} />
        </div>
      )}

      {!userCanReply && session && (topic.status === "locked" || forum.is_locked) && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {t(locale, "forumUi.topic_locked")}
          </p>
        </div>
      )}

      {!session && (
        <div className="pt-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            <Link href="/account/login" className="text-brand hover:underline">
              {t(locale, "forumUi.login")}
            </Link>
            {t(locale, "forumUi.login_to_reply")}
          </p>
        </div>
      )}
    </div>
  );
}
