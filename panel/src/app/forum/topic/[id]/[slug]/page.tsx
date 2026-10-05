import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuerySingle, dbQuery, dbExecute } from "@/lib/db";
import { getForumPermissions } from "@/lib/forum-permissions";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import type { Forum, ForumTopic, ForumPostItem, ForumPoll } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { PostCard } from "@/components/forum/PostCard";
import { TopicActionsMenu } from "@/components/forum/TopicActionsMenu";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { PollDisplay } from "@/components/forum/PollDisplay";
import { getForumById, getForumTopicById } from "@/lib/forum-data";
import { buildMetadata, safeJsonLd, absoluteUrl } from "@/lib/seo";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs } from "@/lib/player-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { formatClanTag } from "@/lib/clan-tag";

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
  last_post_id: number | null;
  last_post_at: string | null;
  last_post_account_id: number | null;
  last_post_character_id: number | null;
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

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { id } = await params;
  const topicId = Number(id);
  if (!Number.isSafeInteger(topicId)) notFound();
  const topic = await getForumTopicById(topicId);
  if (!topic || topic.deleted_at) notFound();
  const forum = await getForumById(topic.forum_id);
  if (!forum) notFound();
  const [session, publicPermissions] = await Promise.all([
    getCurrentSession(),
    getForumPermissions(null, forum),
  ]);
  const viewerPermissions = session ? await getForumPermissions(session, forum) : publicPermissions;
  if (!viewerPermissions.canView) notFound();
  if (!publicPermissions.canView) return buildMetadata({ title: "Private forum", description: "Private RACKET RPG forum.", path: `/forum/topic/${topic.id}/${topic.slug}`, noIndex: true });
  const identities = await resolvePlayerIdentitiesByRefs([{ accountId: topic.account_id, characterId: topic.author_character_id, username: topic.author_username }]);
  const identity = identities.get(playerIdentityKey(topic.account_id, topic.author_character_id));
  const tag = identity?.clanTag ? formatClanTag(identity.clanTag, identity.clanTagStyle) : { prefix: "", suffix: "" };
  const authorLabel = `${tag.prefix}${identity?.username ?? topic.author_username}${tag.suffix}`;
  return buildMetadata({
    title: topic.title,
    description: `${forum.name} discussion by ${authorLabel} · ${topic.reply_count} replies.`,
    path: `/forum/topic/${topic.id}/${topic.slug}`,
    type: "article",
  });
}

export default async function TopicPage({ params, searchParams }: PageProps) {
  const { id: idStr, slug } = await params;
  const { page: pageParam, postId: postIdParam } = await searchParams;

  const topicId = parseInt(idStr, 10);
  if (!Number.isFinite(topicId)) notFound();

  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);
  const accountId = session?.accountId ?? 0;

  const topic = await getForumTopicById(topicId) as TopicRow | null;

  if (!topic) notFound();
  const forum = await getForumById(topic.forum_id) as ForumRow | null;

  if (!forum) notFound();

  const permissions = await getForumPermissions(session, forum);
  const isMod = permissions.canModerate;
  if (!permissions.canView || (topic.deleted_at && !isMod)) notFound();
  if (slug !== topic.slug) {
    const query = new URLSearchParams();
    if (pageParam) query.set("page", pageParam);
    if (postIdParam) query.set("postId", postIdParam);
    permanentRedirect(`/forum/topic/${topic.id}/${topic.slug}${query.size ? `?${query}` : ""}${postIdParam ? `#post-${encodeURIComponent(postIdParam)}` : ""}`);
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
    dbExecute(
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

  const identities = await resolvePlayerIdentitiesByRefs([
    { accountId: topic.account_id, characterId: topic.author_character_id, username: topic.author_username },
    ...posts.map((post) => ({ accountId: post.account_id, characterId: post.author_character_id, username: post.author_username })),
    ...posts.filter((post) => post.edited_by_account_id && post.edited_by_username).map((post) => ({ accountId: Number(post.edited_by_account_id), username: post.edited_by_username! })),
    ...posts.filter((post) => post.deleted_by_account_id && post.deleted_by_username).map((post) => ({ accountId: Number(post.deleted_by_account_id), username: post.deleted_by_username! })),
  ]);
  for (const post of postItems) {
    post.author_identity = identities.get(playerIdentityKey(post.account_id, post.author_character_id));
    post.edited_by_identity = post.edited_by_account_id ? identities.get(playerIdentityKey(post.edited_by_account_id)) : undefined;
    post.deleted_by_identity = post.deleted_by_account_id ? identities.get(playerIdentityKey(post.deleted_by_account_id)) : undefined;
  }

  const userCanReply =
    session !== null &&
    permissions.canReply &&
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
  const topicIdentity = identities.get(playerIdentityKey(topic.account_id, topic.author_character_id));
  const publicPermissions = await getForumPermissions(null, forum);
  const jsonLd = publicPermissions.canView ? {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: topic.title,
    datePublished: new Date(topic.created_at).toISOString(),
    dateModified: new Date(topic.last_post_at || topic.created_at).toISOString(),
    author: { "@type": "Person", name: topicIdentity?.username ?? topic.author_username, url: absoluteUrl(`/players/${encodeURIComponent(topicIdentity?.username ?? topic.author_username)}`) },
    url: absoluteUrl(`/forum/topic/${topic.id}/${topic.slug}`),
    commentCount: topic.reply_count,
  } : null;

  return (
    <div className="space-y-4">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />}
      {/* Topic header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link href="/forum" className="hover:text-foreground transition-colors">
            {"Forum"}
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
          {isMod && (
            <TopicActionsMenu
              topic={topicForClient}
              locale={locale}
            />
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="inline-flex items-center gap-1">{"by"} <PlayerIdentity username={topicIdentity?.username ?? topic.author_username} factionId={topicIdentity?.factionId} factionColor={topicIdentity?.factionColor} clanTag={topicIdentity?.clanTag} clanColor={topicIdentity?.clanColor} clanTagStyle={topicIdentity?.clanTagStyle} size="sm" /></span>
          <span>·</span>
          <span>{topic.reply_count} {"replies"}</span>
          <span>·</span>
          <span>{topic.view_count} {"views"}</span>
          {topic.status === "locked" && (
            <>
              <span>·</span>
              <span className="text-yellow-400">{"locked"}</span>
            </>
          )}
          {topic.deleted_at && isMod && (
            <>
              <span>·</span>
              <span className="text-red-400">{"deleted"}</span>
            </>
          )}
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
            isMod={Boolean(isMod)}
            canEditOwn={permissions.canEditOwn}
            canDeleteOwn={permissions.canDeleteOwn}
            currentAccountId={accountId}
            currentCharacterId={session?.selectedCharacterId ?? null}
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
              {"Prev"}
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
              {"Next"}
            </Link>
          )}
        </div>
      )}

      {/* Reply form */}
      {userCanReply && (
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-bold text-foreground mb-3">
            {"Reply"}
          </h3>
          <ReplyForm topicId={topicId} topicSlug={topic.slug} locale={locale} />
        </div>
      )}

      {!userCanReply && session && (topic.status === "locked" || forum.is_locked) && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {"This topic is locked."}
          </p>
        </div>
      )}

      {!session && (
        <div className="pt-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            <Link href="/account/login" className="text-brand hover:underline">
              {"Log in"}
            </Link>
            {" to reply"}
          </p>
        </div>
      )}
    </div>
  );
}
