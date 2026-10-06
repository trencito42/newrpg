import { getCurrentSession, getViewerLocale } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface ReportRow extends RowDataPacket {
  id: number;
  reporter_username: string;
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
}

interface ModlogRow extends RowDataPacket {
  id: number;
  actor_username: string;
  action: string;
  target_type: string;
  target_id: number;
  reason: string | null;
  created_at: string;
}

export default async function ModPage() {
  const [session, locale] = await Promise.all([getCurrentSession(), getViewerLocale()]);

  if (!session) redirect("/login");
  const isMod = session.adminLevel >= 1 || session.helperLevel >= 1;
  if (!isMod) redirect("/forum");

  const openReports = await dbQuery<ReportRow>(
    `SELECT r.*, t.title AS topic_title, f.name AS forum_name,
            SUBSTRING(p.content, 1, 200) AS post_excerpt,
            p.author_username AS reported_username
     FROM panel_forum_reports r
     JOIN panel_forum_topics t ON t.id = r.topic_id
     JOIN panel_forums f ON f.id = t.forum_id
     LEFT JOIN panel_forum_posts p ON p.id = r.post_id
     WHERE r.status = 'open'
     ORDER BY r.created_at DESC
     LIMIT 50`
  );

  const recentLogs = await dbQuery<ModlogRow>(
    `SELECT id, actor_username, action, target_type, target_id, reason, created_at
     FROM panel_forum_modlog
     ORDER BY created_at DESC
     LIMIT 50`
  );

  interface CountRow extends RowDataPacket { total: number }
  const openReportsCount = await dbQuerySingle<CountRow>(
    `SELECT COUNT(*) AS total FROM panel_forum_reports WHERE status = 'open'`
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {/* i18n-ignore: english-only */}
          <Link href="/forum" className="hover:text-foreground transition-colors">Forum</Link>
          <span>/</span>
          <span className="text-foreground">{t(locale, "forumUi.moderation")}</span>
        </div>
        <h1 className="text-xl font-extrabold text-foreground uppercase tracking-tight">
          {t(locale, "forumUi.moderation_panel")}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-2xl font-extrabold text-brand">{openReportsCount?.total ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {t(locale, "forumUi.open_reports")}
          </div>
        </div>
      </div>

      {/* Open Reports */}
      <div>
        <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-3">
          {t(locale, "forumUi.open_reports_title")}
        </h2>
        {openReports.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t(locale, "forumUi.no_open_reports")}
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
                        {t(locale, "forumUi.reported_by")} {report.reporter_username}
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
                    <ResolveReportButton reportId={report.id} action="resolve" locale={locale} />
                    <ResolveReportButton reportId={report.id} action="dismiss" locale={locale} />
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
          {t(locale, "forumUi.recent_actions")}
        </h2>
        {recentLogs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t(locale, "forumUi.no_actions")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {recentLogs.map((log, idx) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 px-4 py-2.5 bg-card ${idx > 0 ? "border-t border-border" : ""}`}
              >
                <span className="text-xs font-bold text-brand">{log.actor_username}</span>
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
    </div>
  );
}

function ResolveReportButton({ reportId, action, locale }: { reportId: number; action: "resolve" | "dismiss"; locale: "en" | "ro" }) {
  return (
    <form action={`/api/forum/mod/reports/${reportId}`} method="POST">
      <input type="hidden" name="_method" value="PATCH" />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className={`px-2 py-1 text-xs rounded font-bold uppercase transition-colors ${
          action === "resolve"
            ? "bg-green-700/20 hover:bg-green-700/40 text-green-400"
            : "bg-surface-300 hover:bg-surface-200 text-muted-foreground"
        }`}
        onClick={async (e) => {
          e.preventDefault();
          await fetch(`/api/forum/mod/reports/${reportId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          window.location.reload();
        }}
      >
        {action === "resolve"
          ? ("Resolve")
          : ("Dismiss")}
      </button>
    </form>
  );
}
