import type { MetadataRoute } from "next";
import { dbQuery } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo/metadata";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface SlugRow extends RowDataPacket {
  slug: string;
  updated_at: string | null;
}

interface TopicRow extends RowDataPacket {
  id: number;
  slug: string;
  last_post_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: getSiteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: getSiteUrl("/forum"), changeFrequency: "hourly", priority: 0.9 },
    { url: getSiteUrl("/wiki"), changeFrequency: "daily", priority: 0.75 },
    { url: getSiteUrl("/rules"), changeFrequency: "weekly", priority: 0.65 },
    { url: getSiteUrl("/terms"), changeFrequency: "monthly", priority: 0.4 },
    { url: getSiteUrl("/privacy"), changeFrequency: "monthly", priority: 0.4 },
    { url: getSiteUrl("/refund"), changeFrequency: "monthly", priority: 0.4 },
    { url: getSiteUrl("/cookies"), changeFrequency: "monthly", priority: 0.4 },
    { url: getSiteUrl("/players"), changeFrequency: "daily", priority: 0.7 },
    { url: getSiteUrl("/factions"), changeFrequency: "weekly", priority: 0.6 },
    { url: getSiteUrl("/clans"), changeFrequency: "weekly", priority: 0.6 },
  ];

  let forumRoutes: MetadataRoute.Sitemap = [];
  let topicRoutes: MetadataRoute.Sitemap = [];
  let wikiRoutes: MetadataRoute.Sitemap = [];

  try {
    const forums = await dbQuery<SlugRow>(
      `SELECT slug, last_post_at AS updated_at FROM panel_forums
       WHERE is_visible = 1 AND access_type = 'public'`
    );
    forumRoutes = forums.map((f) => ({
      url: getSiteUrl(`/forum/${f.slug}`),
      lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
      changeFrequency: "hourly",
      priority: 0.8,
    }));

    const topics = await dbQuery<TopicRow>(
      `SELECT t.id, t.slug, t.last_post_at
       FROM panel_forum_topics t
       INNER JOIN panel_forums f ON f.id = t.forum_id
       WHERE t.deleted_at IS NULL AND f.is_visible = 1 AND f.access_type = 'public'`
    );
    topicRoutes = topics.map((t) => ({
      url: getSiteUrl(`/forum/topic/${t.id}/${t.slug}`),
      lastModified: t.last_post_at ? new Date(t.last_post_at) : undefined,
      changeFrequency: "daily",
      priority: 0.6,
    }));
    const wikiArticles = await dbQuery<SlugRow>(
      `SELECT slug, updated_at FROM panel_wiki_articles WHERE status = 'published'`
    );
    wikiRoutes = wikiArticles.map((a) => ({
      url: getSiteUrl(`/wiki/${a.slug}`),
      lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.55,
    }));
  } catch {
    /* DB unavailable during build — static routes only */
  }

  return [...staticRoutes, ...forumRoutes, ...topicRoutes, ...wikiRoutes];
}
