import { t, formatDate } from "@/lib/i18n";
import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import { PlayerAdminManage } from "./PlayerAdminManage";
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Clock,
  Car,
  Home,
  Briefcase,
  History,
  Coins,
  CreditCard,
  Mail,
  User,
  Package,
  Award,
  FileText,
  Key,
  Ban,
  VolumeX,
  AlertOctagon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { formatAuditDetails } from "@/lib/audit-details";
import { resolvePlayerIdentities } from "@/lib/player-identity";

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

  // 1. Fetch target account & primary character details
  const player = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      a.id as account_id,
      a.username,
      a.email,
      a.admin_level,
      a.helper_level,
      COALESCE(a.is_author, 0) as is_author,
      a.premium_points,
      a.language,
      a.created_at as account_created_at,
      c.id as character_id,
      c.firstname,
      c.lastname,
      c.level,
      c.cash,
      c.bank,
      c.paydays_received as hours,
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      c.last_played,
      c.phone_number,
      c.gender,
      cl.id as clan_id,
      cl.name as clan_name,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style,
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

  // Fetch custom badges
  const badges = await dbQuery<{
    id: number;
    badge_key: string;
    title: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    bg_color: string | null;
  } & RowDataPacket>(
    "SELECT id, badge_key, title, description, icon, color, bg_color FROM account_badges WHERE account_id = ? ORDER BY id ASC",
    [player.account_id]
  );

  // 2. Fetch active bans
  const bans = await dbQuery<RowDataPacket>(
    `SELECT id, reason, banned_by, expires_at, created_at
     FROM bans
     WHERE license = ? OR license = ?
     ORDER BY id DESC LIMIT 10`,
    [player.license || "", `account:${player.account_id}`]
  );

  // 3. Fetch sanctions (warns, bans, mutes, jails, kicks)
  const sanctions = await dbQuery<RowDataPacket>(
    `SELECT id, action, target_name, admin_name, reason, duration_min, created_at
     FROM admin_sanctions
     WHERE target_account_id = ? OR LOWER(target_name) = LOWER(?)
     ORDER BY id DESC LIMIT 30`,
    [player.account_id, player.username]
  );

  // 4. Fetch faction punishment & warnings
  const factionPunish = await dbQuerySingle<RowDataPacket>(
    `SELECT fp, reason, updated_at as created_at FROM faction_punish WHERE character_id = ? LIMIT 1`,
    [player.character_id || 0]
  );
  const factionWarnings = await dbQuery<RowDataPacket>(
    `SELECT id, faction_id, reason, issued_by, created_at FROM faction_warnings WHERE character_id = ? ORDER BY id DESC LIMIT 10`,
    [player.character_id || 0]
  );

  // 5. Fetch inventory items
  const inventoryItems = await dbQuery<RowDataPacket>(
    `SELECT id, item, count, slot, metadata FROM character_inventory WHERE character_id = ? ORDER BY slot ASC, id ASC LIMIT 50`,
    [player.character_id || 0]
  );

  // 6. Fetch vehicles
  const vehicles = await dbQuery<RowDataPacket>(
    `SELECT v.id, v.model, v.plate, v.stored, v.insurance_level, CASE WHEN iv.status = 'impounded' THEN 1 ELSE 0 END as impounded 
     FROM vehicles v 
     LEFT JOIN impounded_vehicles iv ON iv.vehicle_id = v.id AND iv.status = 'impounded' 
     WHERE v.character_id = ? 
     ORDER BY v.id DESC LIMIT 20`,
    [player.character_id || 0]
  );

  // 7. Fetch properties
  const properties = await dbQuery<RowDataPacket>(
    `SELECT id, label as name, interior as type, price, locked FROM properties WHERE owner_character_id = ? ORDER BY id DESC LIMIT 20`,
    [player.character_id || 0]
  );

  // 8. Fetch businesses
  const businesses = await dbQuery<RowDataPacket>(
    `SELECT id, shop_key, business_type, label, price, balance, enabled FROM player_businesses WHERE owner_character_id = ? ORDER BY id DESC LIMIT 20`,
    [player.character_id || 0]
  );

  // 9. Fetch licenses
  const licenses = await dbQuery<RowDataPacket>(
    `SELECT license_type, issued_at FROM character_licenses WHERE character_id = ?`,
    [player.character_id || 0]
  );

  // 10. Fetch full audit logs involving this account
  const auditLogs = await dbQuery<RowDataPacket>(
    `SELECT pal.id, pal.actor_account_id, pal.action, pal.target_entity, pal.target_id, pal.reason, pal.details, pal.created_at,
            a_actor.username as actor_username
     FROM panel_audit_log pal
     LEFT JOIN accounts a_actor ON a_actor.id = pal.actor_account_id
     WHERE pal.target_id = ? OR pal.actor_account_id = ?
     ORDER BY pal.id DESC LIMIT 25`,
    [player.account_id, player.account_id]
  );

  // 11. Check online status
  const runtimeSnapshot = await dbQuerySingle<RowDataPacket>(
    `SELECT p.id FROM players p WHERE p.account_id = ? AND p.last_seen > NOW() - INTERVAL 5 MINUTE LIMIT 1`,
    [player.account_id]
  );
  const isOnline = Boolean(runtimeSnapshot);

  const sanctionIdentities = await resolvePlayerIdentities(
    sanctions.map((s) => s.admin_name).concat(auditLogs.map((a) => a.actor_username)).filter(Boolean)
  );

  const activeWarns = sanctions.filter((s) => s.action === "warn").length;
  const isBanned = bans.length > 0;
  const factionName = player.faction_id ? (CANONICAL_FACTIONS[player.faction_id]?.label || player.faction_id) : "Civil";

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href="/staff/players"
            className="p-1.5 text-[#8F8B83] hover:text-[#F2EFE8] hover:bg-[#131315] rounded transition-colors"
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
                clanTagStyle={player.clan_tag_style}
                size="lg"
              />
              <span className="text-xs font-mono text-[#8F8B83]">
                {t(locale, "interface.account_2")}{player.account_id})
              </span>
              {isOnline ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
                  {t(locale, "interface.online_2")}</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1A1A1D] text-[#8F8B83] border border-surface-border">
                  {t(locale, "interface.offline")}</span>
              )}
            </div>
            <p className="text-[11px] text-[#8F8B83] mt-0.5">
              {locale === "ro"
                ? `Profil complet & control administrativ pentru ${player.username}`
                : `Comprehensive profile & staff administrative controls for ${player.username}`}
            </p>
          </div>
        </div>

        {/* Global Action Button */}
        <PlayerAdminManage
          player={player}
          sessionAdminLevel={session.adminLevel}
          sessionHelperLevel={session.helperLevel}
          locale={locale}
          sanctionsList={sanctions}
          badges={badges}
        />
      </div>

      {/* Banner Alerts if Banned or High Warns */}
      {isBanned && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded flex items-center gap-3 text-red-300 text-xs">
          <Ban className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <span className="font-bold block text-red-200">
              {t(locale, "copy.app_staff_players_username_page.player_has_an_active_ban")}
            </span>
            <span className="text-[11px]">
              {bans[0]?.reason} {t(locale, "interface.expires")} {formatDate(bans[0]?.expires_at, locale)}
            </span>
          </div>
        </div>
      )}

      {/* Grid: Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Account Info */}
        <div className="p-3.5 bg-[#0E0E10] border border-surface-border rounded space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[#8F8B83] font-semibold text-[11px] uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-[#D7B558]" />
            <span>{t(locale, "account.details")}</span>
          </div>
          <div className="space-y-1.5 pt-1 text-[#F2EFE8]">
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.email")}</span>
              <span className="font-mono">{player.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.staff_rank")}</span>
              <span className="font-bold text-[#D7B558]">
                {player.admin_level > 0
                  ? t(locale, "staffPlayerUi.admin_level", { level: player.admin_level })
                  : player.helper_level > 0
                    ? t(locale, "staffPlayerUi.helper_level", { level: player.helper_level })
                    : t(locale, "staffPlayerUi.role_player")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.premium_points")}</span>
              <span className="font-mono text-amber-400 font-bold">{player.premium_points || 0} RC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.registered")}</span>
              <span className="font-mono text-[11px] text-[#8F8B83]">{formatDate(player.account_created_at, locale)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Economy & Hours */}
        <div className="p-3.5 bg-[#0E0E10] border border-surface-border rounded space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[#8F8B83] font-semibold text-[11px] uppercase tracking-wider">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t(locale, "copy.app_staff_players_username_page.economy_playtime")}</span>
          </div>
          <div className="space-y-1.5 pt-1 text-[#F2EFE8]">
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.cash_2")}</span>
              <span className="font-mono font-bold text-emerald-400">${Number(player.cash || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.bank_2")}</span>
              <span className="font-mono font-bold text-emerald-300">${Number(player.bank || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.level_hours")}</span>
              <span className="font-mono">{t(locale, "interface.lvl")} {player.level || 1} • {player.hours || 0} {t(locale, "players.hours_played")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.phone")}</span>
              <span className="font-mono">{player.phone_number || t(locale, "staffPlayerUi.no_phone")}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Faction & Clan */}
        <div className="p-3.5 bg-[#0E0E10] border border-surface-border rounded space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[#8F8B83] font-semibold text-[11px] uppercase tracking-wider">
            <Briefcase className="w-3.5 h-3.5 text-sky-400" />
            <span>{t(locale, "copy.app_staff_players_username_page.faction_clan")}</span>
          </div>
          <div className="space-y-1.5 pt-1 text-[#F2EFE8]">
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.faction")}</span>
              <span className="font-semibold text-sky-300 truncate max-w-[140px]">
                {factionName} {player.faction_rank ? `(Rank ${player.faction_rank})` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.fp_penalty")}</span>
              <span className={factionPunish?.fp ? "font-bold text-red-400" : "text-[#8F8B83]"}>
                {factionPunish?.fp ? `${factionPunish.fp} FP` : "0 FP"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.clan")}</span>
              <span className="font-semibold text-purple-300">
                {player.clan_name
                  ? t(locale, "staffPlayerUi.clan_rank", {
                      tag: player.clan_tag || "",
                      name: player.clan_name,
                      rank: player.clan_rank || 0,
                    })
                  : t(locale, "staffPlayerUi.no_clan")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.clan_warnings")}</span>
              <span className="font-mono">{player.clan_warns || 0}/3</span>
            </div>
          </div>
        </div>

        {/* Card 4: Status & Sanctions Summary */}
        <div className="p-3.5 bg-[#0E0E10] border border-surface-border rounded space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[#8F8B83] font-semibold text-[11px] uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span>{t(locale, "copy.app_staff_players_username_page.sanctions_record")}</span>
          </div>
          <div className="space-y-1.5 pt-1 text-[#F2EFE8]">
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.active_warnings")}</span>
              <span className={activeWarns >= 2 ? "font-bold text-red-400" : "font-mono"}>
                {activeWarns}/3 {activeWarns >= 3 ? t(locale, "staffPlayerUi.warns_auto_ban") : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.total_sanctions")}</span>
              <span className="font-mono">{sanctions.length} {t(locale, "interface.records")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.licenses")}</span>
              <span className="font-mono text-[11px]">
                {licenses.length > 0 ? licenses.map((l) => l.license_type).join(", ") : t(locale, "staffPlayerUi.no_licenses")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8F8B83]">{t(locale, "interface.vehicles_houses")}</span>
              <span className="font-mono">{vehicles.length} {t(locale, "interface.vehicles_3")} {properties.length} {t(locale, "players.properties_owned")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Detail Panels: Grid 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (2 Cols): Inventory, Assets, Sanctions History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Inventory Viewer */}
          <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F2EFE8]">
                <Package className="w-4 h-4 text-[#D7B558]" />
                <span>{t(locale, "copy.app_staff_players_username_page.player_inventory")}</span>
                <span className="text-[10px] text-[#8F8B83]">({inventoryItems.length} {t(locale, "interface.items")}</span>
              </div>
            </div>
            {inventoryItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8F8B83]">
                {t(locale, "copy.app_staff_players_username_page.inventory_is_empty")}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {inventoryItems.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-2 bg-[#131315] border border-surface-border rounded flex flex-col justify-between text-xs"
                  >
                    <div className="font-mono font-semibold text-[#F2EFE8] truncate">
                      {inv.item}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#8F8B83] mt-1 pt-1 border-t border-surface-border/50">
                      <span>{t(locale, "interface.slot")}{inv.slot}</span>
                      <span className="font-bold text-amber-400">x{inv.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vehicles Owned */}
          <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F2EFE8]">
                <Car className="w-4 h-4 text-emerald-400" />
                <span>{t(locale, "copy.app_staff_players_username_page.vehicles_owned")}</span>
                <span className="text-[10px] text-[#8F8B83]">({vehicles.length})</span>
              </div>
            </div>
            {vehicles.length === 0 ? (
              <div className="text-center py-4 text-xs text-[#8F8B83]">
                {t(locale, "copy.app_staff_players_username_page.player_owns_no_vehicles")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 bg-[#131315] border border-surface-border rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#F2EFE8]">{v.model}</div>
                      <div className="text-[11px] font-mono text-[#8F8B83]">{t(locale, "interface.plate")} {v.plate}</div>
                    </div>
                    <div className="text-right">
                      <span className={v.stored ? "text-emerald-400 text-[11px] font-semibold block" : "text-amber-400 text-[11px] font-semibold block"}>
                        {v.stored ? t(locale, "staffPlayerUi.vehicle_in_garage") : t(locale, "staffPlayerUi.vehicle_on_street")}
                      </span>
                      {v.impounded ? (
                        <span className="text-red-400 text-[10px] font-bold">{t(locale, "interface.impounded_2")}</span>
                      ) : (
                        <span className="text-[10px] text-[#8F8B83]">{t(locale, "interface.insurance_level")} {v.insurance_level || 1}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Properties & Businesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Properties */}
            <div className="border border-surface-border rounded bg-[#0E0E10] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F2EFE8] pb-1.5 border-b border-surface-border">
                <Home className="w-3.5 h-3.5 text-blue-400" />
                <span>{t(locale, "copy.app_staff_players_username_page.properties")} ({properties.length})</span>
              </div>
              {properties.length === 0 ? (
                <div className="text-center py-3 text-xs text-[#8F8B83]">{t(locale, "interface.no_houses_owned")}</div>
              ) : (
                <div className="space-y-1.5">
                  {properties.map((p) => (
                    <div key={p.id} className="p-2 bg-[#131315] border border-surface-border rounded flex justify-between text-xs">
                      <span className="font-medium text-[#F2EFE8]">{p.name || `Proprietate #${p.id}`}</span>
                      <span className="text-emerald-400 font-mono">${Number(p.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Businesses */}
            <div className="border border-surface-border rounded bg-[#0E0E10] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F2EFE8] pb-1.5 border-b border-surface-border">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>{t(locale, "copy.app_staff_players_username_page.businesses")} ({businesses.length})</span>
              </div>
              {businesses.length === 0 ? (
                <div className="text-center py-3 text-xs text-[#8F8B83]">{t(locale, "interface.no_businesses_owned")}</div>
              ) : (
                <div className="space-y-1.5">
                  {businesses.map((b) => (
                    <div key={b.id} className="p-2 bg-[#131315] border border-surface-border rounded flex justify-between text-xs">
                      <div>
                        <span className="font-medium text-[#F2EFE8] block">{b.label}</span>
                        <span className="text-[10px] text-[#8F8B83]">{b.business_type}</span>
                      </div>
                      <span className="text-emerald-400 font-mono font-bold">${Number(b.balance || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sanctions History */}
          <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F2EFE8]">
                <Shield className="w-4 h-4 text-red-400" />
                <span>{t(locale, "copy.app_staff_players_username_page.sanctions_history")}</span>
                <span className="text-[10px] text-[#8F8B83]">({sanctions.length})</span>
              </div>
            </div>
            {sanctions.length === 0 ? (
              <div className="text-center py-4 text-xs text-[#8F8B83]">
                {t(locale, "copy.app_staff_players_username_page.clean_record_no_sanctions_found")}
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {sanctions.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            s.action === "ban"
                              ? "bg-red-950 text-red-300 border border-red-500/30"
                              : s.action === "warn"
                              ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                              : s.action === "kick"
                              ? "bg-orange-950 text-orange-300 border border-orange-500/30"
                              : "bg-blue-950 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {s.action.toUpperCase()}
                        </span>
                        <span className="text-[#F2EFE8] font-medium">{s.reason}</span>
                      </div>
                      <div className="text-[11px] text-[#8F8B83]">
                        {t(locale, "interface.granted_by")} <span className="text-[#F2EFE8]">{s.admin_name}</span>
                        {s.duration_min ? ` • ${s.duration_min} min` : ""}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#8F8B83] shrink-0">
                      {formatDate(s.created_at, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Live Audit Trail & Quick Actions */}
        <div className="space-y-4">
          {/* Audit Trail for this player */}
          <div className="border border-surface-border rounded bg-[#0E0E10] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F2EFE8]">
                <History className="w-4 h-4 text-[#D7B558]" />
                <span>{t(locale, "copy.app_staff_players_username_page.user_audit_log")}</span>
              </div>
            </div>
            {auditLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8F8B83]">
                {t(locale, "copy.app_staff_players_username_page.no_audit_records_found")}
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.map((a) => (
                  <div key={a.id} className="p-2 bg-[#131315] border border-surface-border rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#D7B558] text-[11px]">{a.action}</span>
                      <span className="text-[10px] font-mono text-[#8F8B83]">{formatDate(a.created_at, locale)}</span>
                    </div>
                    <div className="text-[#8F8B83] text-[11px]">
                      {t(locale, "interface.by_2")} <span className="text-[#F2EFE8] font-semibold">{a.actor_username || t(locale, "staffPlayerUi.system_actor")}</span>
                    </div>
                    {a.reason && <div className="text-[#F2EFE8] text-[11px]">{a.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
