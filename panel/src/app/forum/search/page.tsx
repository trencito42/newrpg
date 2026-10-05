import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { getForumAccessMap } from "@/lib/forum-permissions";
import type { Forum } from "@/lib/forum-types";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs, type ResolvedPlayerIdentity } from "@/lib/player-identity";
import { buildMetadata } from "@/lib/seo";
import type { RowDataPacket } from "mysql2";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ title: "Forum search", path: "/forum/search", noIndex: true });

interface ForumRow extends RowDataPacket {
  id: number;
  access_type: string;
  access_target: string | null;
  is_visible: number;
  is_locked: number;
  category_id: number;
  parent_forum_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sort_order: number;
  topic_count: number;
  post_count: number;
  last_topic_id: number | null;
  last_topic_title: string | null;
  last_post_at: string | null;
  last_post_account_id: number | null;
  last_post_username: string | null;
  topic_template: string | null;
  created_at: string;
}

interface SearchResult {
  id: number;
  topic_id: number;
  topic_title: string;
  topic_slug: string;
  forum_id: number;
  forum_name: string;
  account_id: number;
  author_character_id: number | null;
  author_username: string;
  content_excerpt: string;
  created_at: string;
}

interface SearchResultRow extends RowDataPacket, SearchResult {}
interface CountRow extends RowDataPacket { total: number }

const PAGE_SIZE = 20;

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    forumId?: string;
    authorUsername?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const locale = await getViewerLocale();
  const session = await getCurrentSession();

  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  let results: SearchResult[] = [];
  let total = 0;
  let totalPages = 0;
  let errorMsg: string | null = null;
  let identities = new Map<string, ResolvedPlayerIdentity>();

  if (q.length >= 2) {
    const allForums = await dbQuery<ForumRow>(
      `SELECT * FROM panel_forums WHERE is_visible = 1`
    );

    const forums = allForums.map((f) => ({
      ...f,
      access_type: f.access_type as Forum["access_type"],
      inherit_category_permissions: Boolean(f.inherit_category_permissions),
      is_locked: Boolean(f.is_locked),
      is_visible: Boolean(f.is_visible),
    })) as Forum[];
    const accessMap = await getForumAccessMap(session, forums);
    const accessibleIds = forums.filter((forum) => accessMap.get(forum.id)?.canView).map((forum) => forum.id);
    const requestedForumId = sp.forumId ? Number(sp.forumId) : null;
    if (requestedForumId && !accessibleIds.includes(requestedForumId)) notFound();

    if (accessibleIds.length > 0) {
      const forumPlaceholders = accessibleIds.map(() => "?").join(",");

      const extraWhere: string[] = [];
      const extraParams: unknown[] = [];

      if (sp.authorUsername?.trim()) {
        extraWhere.push("p.author_username = ?");
        extraParams.push(sp.authorUsername.trim());
      }
      if (sp.dateFrom) {
        extraWhere.push("p.created_at >= ?");
        extraParams.push(sp.dateFrom);
      }
      if (sp.dateTo) {
        extraWhere.push("p.created_at <= ?");
        extraParams.push(sp.dateTo);
      }

      if (sp.forumId) {
        const fid = parseInt(sp.forumId, 10);
        if (Number.isFinite(fid) && accessibleIds.includes(fid)) {
          extraWhere.push(`p.forum_id = ?`);
          extraParams.push(fid);
        }
      }

      const whereClause = extraWhere.length > 0 ? `AND ${extraWhere.join(" AND ")}` : "";

      try {
        const rows = await dbQuery<SearchResultRow>(
          `SELECT p.id, p.topic_id, t.title AS topic_title, t.slug AS topic_slug,
                  p.forum_id, f.name AS forum_name, p.account_id, p.author_character_id, p.author_username,
                  SUBSTRING(p.content, 1, 400) AS content_excerpt, p.created_at
           FROM panel_forum_posts p
           JOIN panel_forum_topics t ON t.id = p.topic_id
           JOIN panel_forums f ON f.id = p.forum_id
           WHERE MATCH(p.content) AGAINST(? IN BOOLEAN MODE)
             AND p.forum_id IN (${forumPlaceholders})
             AND p.deleted_at IS NULL
             AND t.deleted_at IS NULL
             ${whereClause}
           ORDER BY MATCH(p.content) AGAINST(? IN BOOLEAN MODE) DESC, p.created_at DESC
           LIMIT ? OFFSET ?`,
          [q, ...accessibleIds, ...extraParams, q, PAGE_SIZE, offset]
        );

        const countRow = await dbQuerySingle<CountRow>(
          `SELECT COUNT(*) AS total
           FROM panel_forum_posts p
           JOIN panel_forum_topics t ON t.id = p.topic_id
           WHERE MATCH(p.content) AGAINST(? IN BOOLEAN MODE)
             AND p.forum_id IN (${forumPlaceholders})
             AND p.deleted_at IS NULL
             AND t.deleted_at IS NULL
             ${whereClause}`,
          [q, ...accessibleIds, ...extraParams]
        );

        results = rows;
        identities = await resolvePlayerIdentitiesByRefs(rows.map((row) => ({
          accountId: Number(row.account_id), characterId: row.author_character_id, username: row.author_username,
        })));
        total = countRow?.total ?? 0;
        totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      } catch {
        errorMsg = "Search error";
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link href="/forum" className="hover:text-foreground transition-colors">
            {"Forum"}
          </Link>
          <span>/</span>
          <span className="text-foreground">{"Search"}</span>
        </div>
        <h1 className="text-xl font-extrabold text-foreground uppercase tracking-tight">
          {"Forum Search"}
        </h1>
      </div>

      {/* Search form */}
      <form method="GET" className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={"Search forum..."} // i18n-ignore: english-only
            className="flex-1 px-3 py-2 bg-surface-200 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand hover:bg-brand-300 text-[#08080A] text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors"
          >
            {"Search"}
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            name="authorUsername"
            defaultValue={sp.authorUsername ?? ""}
            placeholder={"Author..."} // i18n-ignore: english-only
            className="px-3 py-1.5 bg-surface-200 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand transition-colors"
          />
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.dateFrom ?? ""}
            className="px-3 py-1.5 bg-surface-200 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand transition-colors"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.dateTo ?? ""}
            className="px-3 py-1.5 bg-surface-200 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </form>

      {/* Results */}
      {q.length >= 2 && (
        <div>
          {errorMsg ? (
            <p className="text-sm text-red-400">{errorMsg}</p>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {"No results found"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {total} {"results"}
              </p>
              <div className="space-y-2">
                {results.map((result) => {
                  const identity = identities.get(playerIdentityKey(result.account_id, result.author_character_id));
                  return (
                  <div key={result.id} className="rounded-lg border border-border bg-card p-4 hover:bg-surface-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/forum/topic/${result.topic_id}/${result.topic_slug}?postId=${result.id}`}
                          className="text-sm font-semibold text-foreground hover:text-brand transition-colors"
                        >
                          {result.topic_title}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{result.forum_name}</span>
                          <span>·</span>
                          <PlayerIdentity
                            username={identity?.username ?? result.author_username}
                            factionId={identity?.factionId}
                            factionColor={identity?.factionColor}
                            clanTag={identity?.clanTag}
                            clanColor={identity?.clanColor}
                            clanTagStyle={identity?.clanTagStyle}
                            size="sm"
                          />
                        </div>
                      </div>
                      <time dateTime={result.created_at} className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(result.created_at).toLocaleDateString("en-US")}
                      </time>
                    </div>
                    <p
                      className="text-xs text-muted-foreground mt-2 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: result.content_excerpt.replace(/<[^>]+>/g, " ").slice(0, 200) }}
                    />
                  </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1 pt-4 justify-center">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    const params = new URLSearchParams();
                    if (q) params.set("q", q);
                    if (sp.authorUsername) params.set("authorUsername", sp.authorUsername);
                    if (sp.dateFrom) params.set("dateFrom", sp.dateFrom);
                    if (sp.dateTo) params.set("dateTo", sp.dateTo);
                    if (sp.forumId) params.set("forumId", sp.forumId);
                    params.set("page", String(p));
                    return (
                      <Link
                        key={p}
                        href={`/forum/search?${params.toString()}`}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${p === page ? "bg-brand text-[#08080A] font-bold" : "bg-surface-200 hover:bg-surface-300 text-foreground"}`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
