import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { getForumAccessMap } from "@/lib/forum-permissions";
import type { Forum } from "@/lib/forum-types";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface ForumRow extends RowDataPacket, Forum {}

interface SearchResultRow extends RowDataPacket {
  id: number;
  topic_id: number;
  topic_title: string;
  topic_slug: string;
  forum_id: number;
  forum_name: string;
  author_username: string;
  content_excerpt: string;
  created_at: string;
  score: number;
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const forumId = url.searchParams.get("forumId") ? parseInt(url.searchParams.get("forumId")!, 10) : null;
  const authorUsername = url.searchParams.get("authorUsername")?.trim() ?? null;
  const dateFrom = url.searchParams.get("dateFrom") ?? null;
  const dateTo = url.searchParams.get("dateTo") ?? null;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  if (q.length < 2) {
    return NextResponse.json({ error: "query_too_short" }, { status: 400 });
  }

  try {
    // Get forums the user can access
    const allForums = await dbQuery<ForumRow>(
      `SELECT * FROM panel_forums WHERE is_visible = 1 ORDER BY sort_order ASC`
    );

    const accessMap = await getForumAccessMap(session, allForums);
    const accessibleForumIds = allForums.filter((forum) => accessMap.get(forum.id)?.canView).map((forum) => forum.id);

    if (accessibleForumIds.length === 0) {
      return NextResponse.json({ results: [], total: 0, page, totalPages: 0 });
    }

    // If a specific forum is requested, check access
    let targetForumIds = accessibleForumIds;
    if (forumId && Number.isFinite(forumId)) {
      if (!accessibleForumIds.includes(forumId)) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      targetForumIds = [forumId];
    }

    const forumPlaceholders = targetForumIds.map(() => "?").join(",");

    const params: unknown[] = [q, ...targetForumIds];
    let extraWhere = "";

    if (authorUsername) {
      extraWhere += " AND p.author_username = ?";
      params.push(authorUsername);
    }
    if (dateFrom) {
      extraWhere += " AND p.created_at >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      extraWhere += " AND p.created_at <= ?";
      params.push(dateTo);
    }

    params.push(PAGE_SIZE, offset);

    const results = await dbQuery<SearchResultRow>(
      `SELECT p.id, p.topic_id, t.title AS topic_title, t.slug AS topic_slug,
              p.forum_id, f.name AS forum_name,
              p.author_username,
              SUBSTRING(p.content, 1, 400) AS content_excerpt,
              p.created_at,
              MATCH(p.content) AGAINST(? IN BOOLEAN MODE) AS score
       FROM panel_forum_posts p
       JOIN panel_forum_topics t ON t.id = p.topic_id
       JOIN panel_forums f ON f.id = p.forum_id
       WHERE MATCH(p.content) AGAINST(? IN BOOLEAN MODE)
         AND p.forum_id IN (${forumPlaceholders})
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL
         ${extraWhere}
       ORDER BY score DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [q, q, ...targetForumIds, ...(authorUsername ? [authorUsername] : []), ...(dateFrom ? [dateFrom] : []), ...(dateTo ? [dateTo] : []), PAGE_SIZE, offset]
    );

    interface CountRow extends RowDataPacket { total: number }
    const countRow = await dbQuerySingle<CountRow>(
      `SELECT COUNT(*) AS total
       FROM panel_forum_posts p
       JOIN panel_forum_topics t ON t.id = p.topic_id
       WHERE MATCH(p.content) AGAINST(? IN BOOLEAN MODE)
         AND p.forum_id IN (${forumPlaceholders})
         AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL
         ${authorUsername ? "AND p.author_username = ?" : ""}
         ${dateFrom ? "AND p.created_at >= ?" : ""}
         ${dateTo ? "AND p.created_at <= ?" : ""}`,
      [q, ...targetForumIds, ...(authorUsername ? [authorUsername] : []), ...(dateFrom ? [dateFrom] : []), ...(dateTo ? [dateTo] : [])]
    );

    const total = countRow?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return NextResponse.json({ results, total, page, totalPages });
  } catch (err) {
    console.error("[forum/search] GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
