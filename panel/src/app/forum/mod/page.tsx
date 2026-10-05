import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import type { Forum } from "@/lib/forum-types";
import { getForumAccessMap } from "@/lib/forum-permissions";
import { playerIdentityKey, resolvePlayerIdentitiesByRefs } from "@/lib/player-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { ResolveReportButton } from "@/components/forum/ResolveReportButton";
import { ForumAdminPanel } from "@/components/forum/ForumAdminPanel";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ title: "Forum moderation", path: "/forum/mod", noIndex: true });

interface ReportRow extends RowDataPacket {
  id: number;
  reporter_username: string;
  reporter_account_id: number;
  topic_id: number;
  post_id: number | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  topic_title: string;
  forum_name: string;
  post_excerpt: string | null;
  reported_username: string | null;
  reported_account_id: number | null;
}

interface ModlogRow extends RowDataPacket {
  id: number;
  actor_username: string;
  actor_account_id: number;
  action: string;
  target_type: string;
  target_id: number;
  reason: string | null;
  created_at: string;
}

export default async function ModPage() {
  const session = await getCurrentSession();

  if (!session) redirect("/account/login");
  const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
  if (!isMod) redirect("/forum");

  const forums = await dbQuery<RowDataPacket & Forum>("SELECT * FROM panel_forums");
  const accessMap = await getForumAccessMap(session, forums);
  const moderatedIds = forums.filter((forum) => accessMap.get(Number(forum.id))?.canModerate).map((forum) => Number(forum.id));
  if (!moderatedIds.length) redirect("/forum");
  const forumFilter = moderatedIds.map(() => "?").join(",");

  const openReports = await dbQuery<ReportRow>(
    `SELECT r.*, t.title AS topic_title, f.name AS forum_name,
            SUBSTRING(p.content, 1, 200) AS post_excerpt,
            p.author_username AS reported_username, p.account_id AS reported_account_id
     FROM panel_forum_reports r
     JOIN panel_forum_topics t ON t.id = r.topic_id
     JOIN panel_forums f ON f.id = t.forum_id
     LEFT JOIN panel_forum_posts p ON p.id = r.post_id
     WHERE r.status = 'open' AND t.forum_id IN (${forumFilter})
     ORDER BY r.created_at DESC
     LIMIT 50`, moderatedIds
  );

  const recentLogs = session.adminLevel >= 1 ? await dbQuery<ModlogRow>(
    `SELECT id, actor_username, action, target_type, target_id, reason, created_at
     FROM panel_forum_modlog
     ORDER BY created_at DESC
     LIMIT 50`
  ) : [];

  interface CountRow extends RowDataPacket { total: number }
  const openReportsCount = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total FROM panel_forum_reports r JOIN panel_forum_topics t ON t.id = r.topic_id
     WHERE r.status = 'open' AND t.forum_id IN (${forumFilter})`, moderatedIds
  );

  const identities = await resolvePlayerIdentitiesByRefs([
    ...openReports.map((report) => ({ accountId: Number(report.reporter_account_id), username: report.reporter_username })),
    ...openReports.filter((report) => report.reported_account_id && report.reported_username).map((report) => ({ accountId: Number(report.reported_account_id), username: report.reported_username! })),
    ...recentLogs.map((log) => ({ accountId: Number(log.actor_account_id), username: log.actor_username })),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {/* i18n-ignore: english-only */}
          <Link href="/forum" className="hover:text-foreground transition-colors">Forum</Link>
          <span>/</span>
          <span className="text-foreground">{"Moderation"}</span>
        </div>
        <h1 className="text-xl font-extrabold text-foreground uppercase tracking-tight">
          {"Moderation Panel"}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-2xl font-extrabold text-brand">{openReportsCount?.total ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {"Open reports"}
          </div>
        </div>
      </div>

      {/* Open Reports */}
      <div>
        <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-3">
          {"Open Reports"}
        </h2>
        {openReports.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {"No open reports"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {openReports.map((report, idx) => (
              <div
                key={report.id}
                className={`p-4 bg-card hover:bg-surface-200 transition-colors ${idx > 0 ? "border-t border-border" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-red-400 uppercase">{report.reason.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {"Reported by"}{" "}
                        <PlayerIdentity {...identities.get(playerIdentityKey(report.reporter_account_id))} username={identities.get(playerIdentityKey(report.reporter_account_id))?.username ?? report.reporter_username} size="sm" />
                      </span>
                    </div>
                    <Link
                      href={`/forum/topic/${report.topic_id}/${encodeURIComponent("topic")}${report.post_id ? `?postId=${report.post_id}` : ""}`}
                      className="text-sm font-semibold text-foreground hover:text-brand transition-colors"
                    >
                      {report.topic_title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">{report.forum_name}</div>
                    {report.post_excerpt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: report.post_excerpt.replace(/<[^>]+>/g, " ").slice(0, 150) }}
                      />
                    )}
                    {report.details && (
                      <p className="text-xs text-muted-foreground/80 mt-1 italic">"{report.details}"</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <ResolveReportButton reportId={report.id} action="resolve" />
                    <ResolveReportButton reportId={report.id} action="dismiss" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Mod Actions */}
      <div>
        <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-3">
          {"Recent Actions"}
        </h2>
        {recentLogs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {"No actions"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {recentLogs.map((log, idx) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 px-4 py-2.5 bg-card ${idx > 0 ? "border-t border-border" : ""}`}
              >
                <PlayerIdentity {...identities.get(playerIdentityKey(log.actor_account_id))} username={identities.get(playerIdentityKey(log.actor_account_id))?.username ?? log.actor_username} size="sm" />
                <span className="text-xs text-foreground">{log.action.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{log.target_type} #{log.target_id}</span>
                {log.reason && (
                  <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                    "{log.reason}"
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                  {new Date(log.created_at).toLocaleDateString("en-US", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {session.adminLevel >= 1 && <ForumAdminPanel />}
    </div>
  );
}
