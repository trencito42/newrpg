import type { MetadataRoute } from "next";
import type { RowDataPacket } from "mysql2";
import { dbQuery } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { getForumAccessMap } from "@/lib/forum-permissions";
import type { Forum } from "@/lib/forum-types";

export const dynamic = "force-dynamic";

interface SlugRow extends RowDataPacket { slug: string; updated_at: string | null; created_at: string }
interface ClanRow extends RowDataPacket { id: number; created_at: string }
interface PlayerRow extends RowDataPacket { username: string; last_seen: string | null; created_at: string }
interface TopicRow extends RowDataPacket { id: number; slug: string; forum_id: number; last_post_at: string | null; created_at: string }
interface PollRow extends RowDataPacket { id: number; ends_at: string; starts_at: string }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [updates, clans, players, forums, topics, polls] = await Promise.all([
    dbQuery<SlugRow>("SELECT slug, updated_at, created_at FROM panel_updates ORDER BY created_at DESC LIMIT 5000"),
    dbQuery<ClanRow>("SELECT id, created_at FROM clans ORDER BY id DESC LIMIT 5000"),
    dbQuery<PlayerRow>("SELECT a.username, MAX(p.last_seen) AS last_seen, a.created_at FROM accounts a LEFT JOIN players p ON p.account_id = a.id GROUP BY a.id, a.username, a.created_at ORDER BY a.id DESC LIMIT 5000"),
    dbQuery<RowDataPacket & Forum>("SELECT * FROM panel_forums WHERE is_visible = 1"),
    dbQuery<TopicRow>("SELECT id, slug, forum_id, last_post_at, created_at FROM panel_forum_topics WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 5000"),
    dbQuery<PollRow>("SELECT id, starts_at, ends_at FROM panel_polls WHERE status <> 'archived' ORDER BY id DESC LIMIT 1000"),
  ]);
  const access = await getForumAccessMap(null, forums);
  const publicForums = forums.filter((forum) => access.get(forum.id)?.canView);
  const publicIds = new Set(publicForums.map((forum) => forum.id));
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/updates"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/players"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/factions"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/clans"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/forum"), lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/polls"), lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl("/rules"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/stats"), lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: absoluteUrl("/turfs"), lastModified: now, changeFrequency: "daily", priority: 0.5 },
    ...updates.map((row) => ({ url: absoluteUrl(`/updates/${encodeURIComponent(row.slug)}`), lastModified: new Date(row.updated_at || row.created_at), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...Object.keys(CANONICAL_FACTIONS).map((slug) => ({ url: absoluteUrl(`/factions/${slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...clans.map((row) => ({ url: absoluteUrl(`/clans/${row.id}`), lastModified: new Date(row.created_at), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...players.map((row) => ({ url: absoluteUrl(`/players/${encodeURIComponent(row.username)}`), lastModified: new Date(row.last_seen || row.created_at), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...publicForums.map((forum) => ({ url: absoluteUrl(`/forum/${forum.slug}`), lastModified: new Date(forum.last_post_at || forum.created_at), changeFrequency: "daily" as const, priority: 0.6 })),
    ...topics.filter((topic) => publicIds.has(topic.forum_id)).map((topic) => ({ url: absoluteUrl(`/forum/topic/${topic.id}/${topic.slug}`), lastModified: new Date(topic.last_post_at || topic.created_at), changeFrequency: "daily" as const, priority: 0.5 })),
    ...polls.map((poll) => ({ url: absoluteUrl(`/polls/${poll.id}`), lastModified: new Date(poll.ends_at || poll.starts_at), changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
