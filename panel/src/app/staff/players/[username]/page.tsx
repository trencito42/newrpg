import { formatDate } from "@/lib/i18n";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { PlayerAdminManage } from "./PlayerAdminManage";
import { ArrowLeft, Shield, AlertTriangle, Clock, Car, Home, Award, History, FileText } from "lucide-react";
import { CANONICAL_FACTIONS } from "@/lib/factions";

interface Context {
  params: Promise<{ username: string }>;
}

export default async function StaffPlayerDetailPage({ params }: Context) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername).replace(/_/g, " ");

  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || (session.adminLevel < 1 && session.helperLevel < 1)) {
    redirect("/staff/dashboard");
  }

  // Fetch target account & character details (case-insensitive safe match)
  const player = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      a.id as account_id,
      a.username,
      a.email,
      a.admin_level,
      a.helper_level,
      a.premium_points,
      a.language,
      a.created_at as account_created_at,
      c.id as character_id,
      c.level,
      c.cash,
      c.bank,
      c.paydays_received as hours,
      c.job as faction_id,
      c.job_grade as faction_rank,
      c.last_played,
      c.phone_number,
      c.gender,
      cl.id as clan_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cm.rank as clan_rank,
      cm.warns as clan_warns,
      p.license
     FROM accounts a
     LEFT JOIN players p ON p.account_id = a.id
     LEFT JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     WHERE LOWER(a.username) = LOWER(?) LIMIT 1`,
    [username]
  );

  if (!player) notFound();

  // Fetch active bans
  const bans = await dbQuery<RowDataPacket>(
    `SELECT id, reason, banned_by, expires_at, created_at
     FROM bans
     WHERE license = ?
     ORDER BY id DESC LIMIT 5`,
    [player.license || ""]
  );

  // Fetch recent sanctions
  const sanctions = await dbQuery<RowDataPacket>(
    `SELECT id, action, admin_name, reason, duration_min, created_at
     FROM admin_sanctions
     WHERE target_account_id = ?
     ORDER BY id DESC LIMIT 20`,
    [player.account_id]
  );

  // Fetch vehicles
  const vehicles = await dbQuery<RowDataPacket>(
    `SELECT id, model, plate, stored, insurance_points FROM vehicles WHERE character_id = ? LIMIT 20`,
    [player.character_id || 0]
  );

  // Fetch properties
  const properties = await dbQuery<RowDataPacket>(
    `SELECT id, label as name, interior as type, price, locked FROM properties WHERE owner_character_id = ? LIMIT 20`,
    [player.character_id || 0]
  );

  // Fetch audit log
  const auditLogs = await dbQuery<RowDataPacket>(
    `SELECT id, action, target_entity, target_id, reason, details, created_at
     FROM panel_audit_log
     WHERE target_id = ? OR actor_account_id = ?
     ORDER BY id DESC LIMIT 15`,
    [player.account_id, player.account_id]
  );

  const activeWarns = sanctions.filter((s) => s.action === "warn").length;
  const isBanned = bans.length > 0;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href="/staff/players"
            className="p-1.5 text-[#6f6f74] hover:text-[#f1f1f1] hover:bg-[#151517] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <PlayerIdentity
                username={player.username}
                factionId={player.faction_id}
                clanTag={player.clan_tag}
                clanColor={player.clan_tag_color}
                size="lg"
              />
              <span className="text-xs font-mono text-[#6f6f74]">
                (Account #{player.account_id})
              </span>
            </div>
            <p className="text-[11px] text-[#6f6f74] mt-0.5">
              {locale === "ro" ? "Panou Administrare Jucător" : "Staff Player Administration View"}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <PlayerAdminManage
          player={player}
          sessionAdminLevel={session.adminLevel}
          sessionHelperLevel={session.helperLevel}
          locale={locale}
        />
      </div>

      {/* Moderation Alert Banner if Banned or Warned */}
      {(isBanned || activeWarns > 0) && (
        <div className="p-3 bg-red-950/30 border border-red-800/40 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isBanned ? (
                <strong>CONT BLOCAT / BANNED: {bans[0]?.reason} (de către {bans[0]?.banned_by})</strong>
              ) : (
                <span>Avertismente active: {activeWarns}/3 warnings</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Progression</span>
          <span className="font-bold text-[#f1f1f1] mt-1 block">
            Level {player.level || 1} <span className="font-mono text-[#6f6f74]">({player.hours || 0} ore)</span>
          </span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Faction</span>
          <span className="font-semibold text-[#f1f1f1] mt-1 block">
            {player.faction_id && player.faction_id !== "unemployed" ? (
              `${player.faction_id} (Rank ${player.faction_rank})`
            ) : (
              <span className="text-[#6f6f74]">Civilian</span>
            )}
          </span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Clan</span>
          <span className="font-semibold text-[#f1f1f1] mt-1 block">
            {player.clan_tag ? (
              <span>[{player.clan_tag}] (Rank {player.clan_rank})</span>
            ) : (
              <span className="text-[#6f6f74]">No Clan</span>
            )}
          </span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[11px] text-[#6f6f74] block">Staff Role</span>
          <span className="font-semibold text-[#f1f1f1] mt-1 block">
            {player.admin_level > 0 ? (
              <span className="text-red-400 font-bold">Admin Level {player.admin_level}</span>
            ) : player.helper_level > 0 ? (
              <span className="text-blue-400 font-bold">Helper Level {player.helper_level}</span>
            ) : (
              <span className="text-[#6f6f74]">Player</span>
            )}
          </span>
        </div>
      </div>

      {/* Sanctions & Audit History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sanctions History */}
        <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
          <div className="p-3 border-b border-surface-border flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#f1f1f1] uppercase tracking-wider">
              {locale === "ro" ? "Istoric Sancțiuni" : "Sanctions History"} ({sanctions.length})
            </h2>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                  <th className="px-3 py-2">Acțiune</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Motiv</th>
                  <th className="px-3 py-2 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {sanctions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-[#6f6f74]">
                      Nicio sancțiune înregistrată
                    </td>
                  </tr>
                ) : (
                  sanctions.map((s) => (
                    <tr key={s.id} className="hover:bg-[#151517]">
                      <td className="px-3 py-2 font-mono font-bold uppercase text-[11px]">
                        {s.action === "ban" && <span className="text-red-400">BAN</span>}
                        {s.action === "warn" && <span className="text-amber-400">WARN</span>}
                        {s.action === "mute" && <span className="text-blue-400">MUTE</span>}
                        {s.action === "jail" && <span className="text-purple-400">JAIL</span>}
                        {s.action === "unban" && <span className="text-emerald-400">UNBAN</span>}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#f1f1f1]">{s.admin_name}</td>
                      <td className="px-3 py-2 text-[#a5a5a8] max-w-xs truncate">{s.reason}</td>
                      <td className="px-3 py-2 text-right font-mono text-[#6f6f74]">
                        {formatDate(s.created_at, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel Audit Log */}
        <div className="border border-surface-border rounded bg-[#101011] overflow-hidden">
          <div className="p-3 border-b border-surface-border">
            <h2 className="text-xs font-bold text-[#f1f1f1] uppercase tracking-wider">
              {locale === "ro" ? "Audit Log Cont" : "Account Audit"}
            </h2>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-[#141416] text-[#6f6f74] font-semibold">
                  <th className="px-3 py-2">Acțiune</th>
                  <th className="px-3 py-2">Motiv / Detalii</th>
                  <th className="px-3 py-2 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-xs text-[#6f6f74]">
                      Nicio înregistrare de audit
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#151517]">
                      <td className="px-3 py-2 font-mono text-[#f1f1f1]">{log.action}</td>
                      <td className="px-3 py-2 text-[#a5a5a8] max-w-xs truncate font-mono text-[11px]">
                        {log.reason || log.details || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[#6f6f74]">
                        {new Date(log.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
