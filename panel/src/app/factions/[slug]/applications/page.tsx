import { notFound } from "next/navigation";
import { getCurrentSession, getRequestLanguage } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { CANONICAL_FACTIONS, getFactionColor, getFactionLabel } from "@/lib/factions";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import Link from "next/link";
import { RowDataPacket } from "mysql2";
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

interface ApplicationRow extends RowDataPacket {
  id: number;
  account_id: number;
  character_id: number;
  status: "submitted" | "under_review" | "accepted" | "rejected" | "withdrawn";
  snapshot_json: string | null;
  created_at: string;
  updated_at: string;
  applicant_username: string;
  pro_count: number;
  contra_count: number;
  comments_count: number;
}

export default async function FactionApplicationsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const factionConfig = CANONICAL_FACTIONS[slug.toLowerCase()];
  if (!factionConfig) {
    notFound();
  }

  const { tab = "pending" } = await searchParams;
  const session = await getCurrentSession();
  const locale = await getRequestLanguage();
  const factionName = getFactionLabel(slug);
  const factionColor = getFactionColor(slug) || "#3b82f6";

  // Check application settings
  const settings = await dbQuerySingle<RowDataPacket>(
    `SELECT applications_open, min_level, min_hours, max_warnings 
     FROM panel_org_application_settings 
     WHERE org_type = 'faction' AND org_id = ? LIMIT 1`,
    [slug]
  );

  let statusFilter = "a.status IN ('submitted', 'under_review')";
  if (tab === "accepted") statusFilter = "a.status = 'accepted'";
  else if (tab === "rejected") statusFilter = "a.status = 'rejected'";
  else if (tab === "withdrawn") statusFilter = "a.status = 'withdrawn'";
  else if (tab === "all") statusFilter = "1=1";

  const applications = await dbQuery<ApplicationRow>(
    `SELECT 
       a.id, a.account_id, a.character_id, a.status, a.snapshot_json, a.created_at, a.updated_at,
       acc.username AS applicant_username,
       (SELECT COUNT(*) FROM panel_org_application_votes v WHERE v.application_id = a.id AND v.vote = 'pro') AS pro_count,
       (SELECT COUNT(*) FROM panel_org_application_votes v WHERE v.application_id = a.id AND v.vote = 'contra') AS contra_count,
       (SELECT COUNT(*) FROM panel_org_application_comments c WHERE c.application_id = a.id) AS comments_count
     FROM panel_org_applications a
     JOIN accounts acc ON acc.id = a.account_id
     WHERE a.org_type = 'faction' AND a.org_id = ? AND ${statusFilter}
     ORDER BY a.id DESC
     LIMIT 100`,
    [slug]
  );

  // Batch resolve identities
  const usernames = applications.map((a: ApplicationRow) => a.applicant_username);
  const identitiesMap = await resolvePlayerIdentities(usernames);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" />
            {locale === "ro" ? "Acceptată" : "Accepted"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-950/60 text-red-400 border border-red-800/40">
            <XCircle className="w-3 h-3" />
            {locale === "ro" ? "Respinsă" : "Rejected"}
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <Clock className="w-3 h-3" />
            {locale === "ro" ? "În Revizuire" : "Under Review"}
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-100 text-[#B4AFA4] border border-surface-border">
            <MinusCircle className="w-3 h-3" />
            {locale === "ro" ? "Retrasă" : "Withdrawn"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-950/60 text-blue-400 border border-blue-800/40">
            <HelpCircle className="w-3 h-3" />
            {locale === "ro" ? "Trimisă" : "Submitted"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-border gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/factions/${slug}`}
            className="p-1.5 bg-[#101012] hover:bg-[#1A191B] border border-surface-border rounded text-[#B4AFA4] hover:text-[#F2EFE8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight flex items-center gap-2">
              <span style={{ color: factionColor }}>{factionName}</span>
              <span className="text-[#8F8B83] font-normal">—</span>
              <span>{locale === "ro" ? "Aplicații" : "Applications"}</span>
            </h1>
            <p className="text-xs text-[#8F8B83]">
              {locale === "ro"
                ? "Discuții și proces de recrutare deschis pentru această facțiune."
                : "Recruitment threads and advisory member voting for this faction."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {settings?.applications_open ? (
            <Link
              href={`/factions/${slug}#apply`}
              className="px-3 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-bold rounded text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {locale === "ro" ? "Aplică la Facțiune" : "Apply to Faction"}
            </Link>
          ) : (
            <span className="px-3 py-1.5 bg-surface-100 border border-surface-border rounded text-xs text-[#8F8B83] font-medium">
              {locale === "ro" ? "Recrutări Închise" : "Applications Closed"}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border text-xs">
        <Link
          href={`/factions/${slug}/applications?tab=pending`}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "pending"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {locale === "ro" ? "În Așteptare" : "Pending"}
        </Link>
        <Link
          href={`/factions/${slug}/applications?tab=accepted`}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "accepted"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {locale === "ro" ? "Acceptate" : "Accepted"}
        </Link>
        <Link
          href={`/factions/${slug}/applications?tab=rejected`}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "rejected"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {locale === "ro" ? "Respinse" : "Rejected"}
        </Link>
        <Link
          href={`/factions/${slug}/applications?tab=withdrawn`}
          className={cn(
            "px-3 py-2 border-b-2 font-medium transition-colors",
            tab === "withdrawn"
              ? "border-brand text-brand"
              : "border-transparent text-[#8F8B83] hover:text-[#B4AFA4]"
          )}
        >
          {locale === "ro" ? "Retrase" : "Withdrawn"}
        </Link>
      </div>

      {/* Table / List */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">{locale === "ro" ? "Aplicant" : "Applicant"}</th>
                <th className="px-3 py-2.5 text-center">{locale === "ro" ? "Nivel" : "Level"}</th>
                <th className="px-3 py-2.5 text-center">{locale === "ro" ? "Ore" : "Hours"}</th>
                <th className="px-3 py-2.5 text-center">PRO</th>
                <th className="px-3 py-2.5 text-center">CONTRA</th>
                <th className="px-3 py-2.5 text-center">{locale === "ro" ? "Răspunsuri" : "Replies"}</th>
                <th className="px-3 py-2.5">{locale === "ro" ? "Status" : "Status"}</th>
                <th className="px-3 py-2.5 text-right">{locale === "ro" ? "Data Trimiterii" : "Date"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-[#8F8B83]">
                    {locale === "ro" ? "Nicio aplicație găsită." : "No applications found."}
                  </td>
                </tr>
              ) : (
                applications.map((app: ApplicationRow) => {
                  let snap: any = {};
                  try {
                    if (app.snapshot_json) snap = JSON.parse(app.snapshot_json);
                  } catch {
                    snap = {};
                  }

                  const identity = identitiesMap.get(app.applicant_username?.toLowerCase());

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-[#131315] transition-colors group cursor-pointer"
                    >
                      <td className="px-3 py-2.5 font-mono text-[#8F8B83]">
                        <Link
                          href={`/factions/${slug}/applications/${app.id}`}
                          className="font-bold text-[#F2EFE8] hover:underline"
                        >
                          #{app.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        {identity ? (
                          <PlayerIdentity {...identity} size="sm" />
                        ) : (
                          <span className="font-semibold text-[#F2EFE8]">{app.applicant_username}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-[#E1DCCF]">
                        {snap.level || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-[#E1DCCF]">
                        {snap.hours || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-emerald-400">
                        {app.pro_count}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-red-400">
                        {app.contra_count}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-[#B4AFA4]">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-[#8F8B83]" />
                          {app.comments_count}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{getStatusBadge(app.status)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[11px] text-[#8F8B83]">
                        {formatDate(app.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
