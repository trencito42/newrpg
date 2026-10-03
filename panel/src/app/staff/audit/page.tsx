import { t, formatDate } from "@/lib/i18n";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { History, Shield, Filter, Search, Ban, AlertTriangle, Coins, Briefcase, UserCheck } from "lucide-react";
import { formatAuditDetails } from "@/lib/audit-details";
import { resolvePlayerIdentities } from "@/lib/player-identity";

interface Props {
  searchParams: Promise<{ search?: string; category?: string }>;
}

export default async function StaffAuditPage({ searchParams }: Props) {
  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  const { search = "", category = "all" } = await searchParams;

  let whereClauses: string[] = [];
  const params: unknown[] = [];

  if (search.trim()) {
    whereClauses.push("(pal.action LIKE ? OR actor_acc.username LIKE ? OR target_acc.username LIKE ? OR pal.reason LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (category === "moderation") {
    whereClauses.push("(pal.action LIKE '%ban%' OR pal.action LIKE '%warn%' OR pal.action LIKE '%mute%' OR pal.action LIKE '%jail%' OR pal.action LIKE '%kick%')");
  } else if (category === "economy") {
    whereClauses.push("(pal.action LIKE '%cash%' OR pal.action LIKE '%bank%' OR pal.action LIKE '%money%' OR pal.action LIKE '%item%')");
  } else if (category === "factions") {
    whereClauses.push("(pal.action LIKE '%faction%' OR pal.action LIKE '%clan%')");
  } else if (category === "staff") {
    whereClauses.push("(pal.action LIKE '%staff%' OR pal.action LIKE '%admin%' OR pal.action LIKE '%helper%' OR pal.action LIKE '%role%')");
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const logs = await dbQuery<RowDataPacket>(
    `SELECT 
      pal.id, pal.actor_account_id, pal.actor_character_id, pal.action,
      pal.target_entity, pal.target_id, pal.reason, pal.details, pal.created_at,
      actor_acc.username as actor_username,
      target_acc.username as target_username
     FROM panel_audit_log pal
     LEFT JOIN accounts actor_acc ON actor_acc.id = pal.actor_account_id
     LEFT JOIN accounts target_acc ON target_acc.id = pal.target_id
     ${whereSql}
     ORDER BY pal.id DESC LIMIT 80`,
    params
  );

  const identities = await resolvePlayerIdentities(
    logs.flatMap((l) => [l.actor_username, l.target_username].filter(Boolean))
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#D7B558]" />
            <h1 className="text-lg font-bold text-[#F2EFE8] tracking-tight">
              {t(locale, "copy.app_staff_audit_page.administrative_audit_activity_log")}
            </h1>
          </div>
          <p className="text-xs text-[#8F8B83] mt-0.5">
            {t(locale, "copy.app_staff_audit_page.real_time_monitoring_of_all_staff_domain_actions_server_executions_and_play")}
          </p>
        </div>

        {/* Search */}
        <form method="GET" className="flex items-center gap-2">
          <input type="hidden" name="category" value={category} />
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8F8B83] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder={t(locale, "copy.app_staff_audit_page.search_admin_player_or_action")}
              className="pl-8 pr-2.5 py-1.5 bg-[#101012] border border-surface-border rounded text-xs text-[#F2EFE8] w-60 focus:border-[#D7B558] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#211D18] hover:bg-[#302A1E] border border-surface-border rounded text-xs text-[#F2EFE8]"
          >
            {t(locale, "copy.app_staff_audit_page.filter")}
          </button>
        </form>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Link
          href={`/staff/audit?category=all${search ? `&search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1 rounded-full border transition-colors ${
            category === "all"
              ? "bg-[#D7B558] text-[#08080A] font-bold border-[#D7B558]"
              : "bg-[#101012] text-[#8F8B83] border-surface-border hover:text-[#F2EFE8]"
          }`}
        >
          {t(locale, "copy.app_staff_audit_page.all_actions")}
        </Link>
        <Link
          href={`/staff/audit?category=moderation${search ? `&search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
            category === "moderation"
              ? "bg-red-500 text-white font-bold border-red-500"
              : "bg-[#101012] text-[#8F8B83] border-surface-border hover:text-[#F2EFE8]"
          }`}
        >
          <Ban className="w-3 h-3" />
          <span>{t(locale, "copy.app_staff_audit_page.moderation_sanctions")}</span>
        </Link>
        <Link
          href={`/staff/audit?category=economy${search ? `&search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
            category === "economy"
              ? "bg-emerald-500 text-white font-bold border-emerald-500"
              : "bg-[#101012] text-[#8F8B83] border-surface-border hover:text-[#F2EFE8]"
          }`}
        >
          <Coins className="w-3 h-3" />
          <span>{t(locale, "copy.app_staff_audit_page.economy_inventory")}</span>
        </Link>
        <Link
          href={`/staff/audit?category=factions${search ? `&search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
            category === "factions"
              ? "bg-sky-500 text-white font-bold border-sky-500"
              : "bg-[#101012] text-[#8F8B83] border-surface-border hover:text-[#F2EFE8]"
          }`}
        >
          <Briefcase className="w-3 h-3" />
          <span>{t(locale, "copy.app_staff_audit_page.factions_clans")}</span>
        </Link>
        <Link
          href={`/staff/audit?category=staff${search ? `&search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
            category === "staff"
              ? "bg-amber-500 text-[#08080A] font-bold border-amber-500"
              : "bg-[#101012] text-[#8F8B83] border-surface-border hover:text-[#F2EFE8]"
          }`}
        >
          <UserCheck className="w-3 h-3" />
          <span>{t(locale, "copy.app_staff_audit_page.staff_roles")}</span>
        </Link>
      </div>

      {/* Audit Table */}
      <div className="border border-surface-border rounded bg-[#0E0E10] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-[#101012] text-[#8F8B83] font-semibold">
                <th className="px-3.5 py-2.5">ID</th>
                <th className="px-3.5 py-2.5">{t(locale, "copy.app_staff_audit_page.staff_actor")}</th>
                <th className="px-3.5 py-2.5">{t(locale, "copy.app_staff_audit_page.executed_action")}</th>
                <th className="px-3.5 py-2.5">{t(locale, "copy.app_staff_audit_page.target_player")}</th>
                <th className="px-3.5 py-2.5">{t(locale, "copy.app_staff_audit_page.reason_parameters")}</th>
                <th className="px-3.5 py-2.5 text-right">{t(locale, "copy.app_staff_audit_page.timestamp")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-[#8F8B83]">
                    {t(locale, "copy.app_staff_audit_page.no_audit_records_found")}
                  </td>
                </tr>
              ) : (
                logs.map((l) => {
                  const act = String(l.action || "");
                  const isBan = act.includes("ban");
                  const isWarn = act.includes("warn");
                  const isMute = act.includes("mute");
                  const isJail = act.includes("jail");
                  const isKick = act.includes("kick");
                  const isStaff = act.includes("staff") || act.includes("admin") || act.includes("helper");
                  const isEco = act.includes("cash") || act.includes("bank") || act.includes("money") || act.includes("item");

                  return (
                    <tr key={l.id} className="hover:bg-[#131315] transition-colors">
                      <td className="px-3.5 py-3 font-mono text-[#8F8B83] text-[11px]">#{l.id}</td>
                      <td className="px-3.5 py-3">
                        {l.actor_username ? (
                          <Link href={`/staff/players/${encodeURIComponent(l.actor_username)}`} className="hover:underline">
                            <PlayerIdentity {...identities.get(l.actor_username.toLowerCase())!} size="sm" />
                          </Link>
                        ) : (
                          <span className="text-[#8F8B83] font-mono font-semibold">{t(locale, "interface.system_admbot")}</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block ${
                            isBan
                              ? "bg-red-950 text-red-300 border border-red-500/30"
                              : isWarn
                              ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                              : isMute || isJail
                              ? "bg-purple-950 text-purple-300 border border-purple-500/30"
                              : isKick
                              ? "bg-orange-950 text-orange-300 border border-orange-500/30"
                              : isStaff
                              ? "bg-[#D7B558]/20 text-[#D7B558] border border-[#D7B558]/40"
                              : isEco
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                              : "bg-[#1A1A1D] text-[#F2EFE8] border border-surface-border"
                          }`}
                        >
                          {l.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        {l.target_username ? (
                          <Link href={`/staff/players/${encodeURIComponent(l.target_username)}`} className="hover:underline">
                            <PlayerIdentity {...identities.get(l.target_username.toLowerCase())!} size="sm" />
                          </Link>
                        ) : l.target_id ? (
                          <span className="font-mono text-[#8F8B83]">{t(locale, "interface.account")}{l.target_id}</span>
                        ) : (
                          <span className="text-[#8F8B83]">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="text-[#F2EFE8] font-medium block max-w-md truncate">
                          {l.reason || "—"}
                        </span>
                        {l.details && (
                          <span className="text-[10px] text-[#8F8B83] font-mono block max-w-md truncate">
                            {formatAuditDetails(l.details)}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-[#8F8B83] text-[11px] shrink-0">
                        {formatDate(l.created_at, locale)}
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
