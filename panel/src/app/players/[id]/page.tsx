import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getViewerLocale, isStaff } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate, formatNumber, formatCurrency } from "@/lib/i18n";
import { RowDataPacket } from "mysql2";
import { PlayerActions } from "@/components/staff/PlayerActions";
import { PlayerName } from "@/components/ui/PlayerName";
import { PlayerIdentity } from "@/components/ui/PlayerIdentity";
import { getFactionLabel, isFaction } from "@/lib/factions";
import { GTAImage } from "@/components/ui/GTAImage";
import { getVehiclePreviewUrl, getPedAvatarUrl } from "@/lib/gta-assets";
import { vehicleDisplayName } from "@/lib/vehicle-names";

interface CharacterProfileRow extends RowDataPacket {
  id: number;
  player_id: number;
  account_id: number;
  firstname: string;
  lastname: string;
  level: number;
  xp: number;
  respect_points: number;
  paydays_received: number;
  job: string;
  job_grade: number;
  phone_number: string | null;
  home_property_id: number | null;
  avatar: string | null;
  gender: number;
  nationality: string;
  metadata: string | Record<string, any> | null;
  registered_at: string;
  last_played: string | null;
  account_username: string;
}

interface MarriageRow extends RowDataPacket {
  partner_id: number;
  partner_username: string;
  married_at: string;
}

interface SkillRow extends RowDataPacket {
  job_id: string;
  level: number;
  xp: number;
  completed_tasks: number;
}

interface LicenseRow extends RowDataPacket {
  type: "driver" | "weapon" | "boat" | "pilot" | "hunting";
  issued_at: string;
  issued_at_payday: number;
  expires_at_payday: number | null;
}

interface BalanceRow extends RowDataPacket { cash: number; bank: number }
interface VehicleRow extends RowDataPacket {
  id: number;
  model: string;
  catalog_label: string | null;
  plate: string;
  stored: number;
  insurance_level: number;
  destroyed: number;
  preview_url: string | null;
}
interface PropertyRow extends RowDataPacket { id: number; label: string; interior: string; description: string | null }

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id).trim();
  const isNumeric = /^\d+$/.test(decoded);
  const numericId = isNumeric ? Number(decoded) : 0;

  const [session, locale] = await Promise.all([
    getCurrentSession(),
    getViewerLocale(),
  ]);

  const char = await dbQuerySingle<
    CharacterProfileRow & {
      clan_id: number | null;
      clan_name: string | null;
      clan_tag: string | null;
      clan_tag_color: string | null;
      clan_tag_style: string | null;
      clan_rank: number | null;
      is_clan_owner: number | null;
      is_faction_leader: number | null;
      admin_level: number;
      helper_level: number;
      avatar_url: string | null;
      featured_vehicle_id: number | null;
      is_online: number;
    }
  >(
    `SELECT 
       c.id, c.player_id, p.account_id, c.firstname, c.lastname,
       c.level, c.xp, c.respect_points, c.paydays_received,
       c.job, c.job_grade, c.phone_number,
       c.home_property_id, c.avatar, c.gender, c.nationality, c.metadata,
       c.created_at AS registered_at, c.last_played,
       a.username AS account_username,
       a.admin_level,
       a.helper_level,
       cl.id AS clan_id,
       cl.name AS clan_name,
       cl.tag AS clan_tag,
       cl.tag_color AS clan_tag_color,
       cl.tag_style AS clan_tag_style,
       cm.rank AS clan_rank,
       (cl.owner_character_id = c.id) AS is_clan_owner,
       fl.id AS is_faction_leader,
       pm.avatar_url,
       pref.featured_vehicle_id,
       (p.last_seen > NOW() - INTERVAL 3 MINUTE OR c.last_played > NOW() - INTERVAL 3 MINUTE) AS is_online
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
     LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = c.job
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     LEFT JOIN panel_player_media pm ON pm.account_id = a.id
     LEFT JOIN panel_preferences pref ON pref.account_id = a.id
     WHERE LOWER(a.username) = LOWER(?)
        OR (? > 0 AND c.id = ?)
        OR LOWER(c.firstname) = LOWER(?)
     LIMIT 1`,
    [
      decoded,
      numericId,
      numericId,
      decoded,
    ]
  );

  if (!char) {
    notFound();
  }

  // Canonical route uses accounts.username: /players/{username}
  if (isNumeric || decoded.toLowerCase() !== char.account_username.toLowerCase()) {
    redirect(`/players/${encodeURIComponent(char.account_username)}`);
  }

  const characterId = char.id;
  const isOwner = session?.accountId === char.account_id;
  const staffMember = isStaff(session);
  const canViewFinancials = isOwner || staffMember;

  const [
    balance,
    vehicles,
    properties,
    marriage,
    skills,
    licenses,
    sanctionCountRow,
  ] = await Promise.all([
    canViewFinancials
      ? dbQuerySingle<BalanceRow>("SELECT cash, bank FROM characters WHERE id = ?", [characterId])
      : null,
    dbQuery<VehicleRow>(
      `SELECT v.id, v.model, dv.label AS catalog_label, v.plate, v.stored, v.insurance_level, v.destroyed, vm.preview_url
       FROM vehicles v
       LEFT JOIN dealership_vehicles dv ON LOWER(dv.model) = LOWER(v.model)
       LEFT JOIN panel_vehicle_media vm ON vm.vehicle_id = v.id
       WHERE v.character_id = ?
       ORDER BY (v.id = ?) DESC, v.id DESC LIMIT 50`,
      [characterId, char.featured_vehicle_id || 0]
    ),
    dbQuery<PropertyRow>(
      "SELECT id, label, interior, description FROM properties WHERE owner_character_id = ? ORDER BY id DESC LIMIT 50",
      [characterId]
    ),
    dbQuerySingle<MarriageRow>(
      `SELECT m.married_at,
              CASE WHEN m.partner1_id = ? THEN m.partner2_id ELSE m.partner1_id END AS partner_id,
              pa_acc.username AS partner_username
       FROM marriages m
       JOIN characters c ON c.id = (CASE WHEN m.partner1_id = ? THEN m.partner2_id ELSE m.partner1_id END)
       JOIN players pa_p ON pa_p.id = c.player_id
       JOIN accounts pa_acc ON pa_acc.id = pa_p.account_id
       WHERE (m.partner1_id = ? OR m.partner2_id = ?) AND m.status = 'active'
       LIMIT 1`,
      [characterId, characterId, characterId, characterId]
    ),
    dbQuery<SkillRow>(
      "SELECT job_id, level, xp, completed_tasks FROM job_progress WHERE character_id = ?",
      [characterId]
    ),
    dbQuery<LicenseRow>(
      "SELECT license_type AS type, issued_at, issued_at_payday, expires_at_payday FROM character_licenses WHERE character_id = ?",
      [characterId]
    ),
    dbQuerySingle<{ count: number } & RowDataPacket>(
      `SELECT COUNT(*) AS count FROM admin_sanctions
       WHERE action = 'warn' AND (target_character_id = ? OR target_account_id = ?)`,
      [characterId, char.account_id]
    ),
  ]);

  const hasFaction = isFaction(char.job);
  const factionLabel = hasFaction ? getFactionLabel(char.job) : null;
  const warningsCount = sanctionCountRow?.count || 0;
  const featuredVehicle = vehicles.find((v) => v.id === char.featured_vehicle_id) || vehicles[0] || null;

  // Derive role badges
  const roleBadges: { label: string; color: string; tooltip: string; href?: string }[] = [];
  if (char.admin_level > 0) {
    roleBadges.push({
      label: `ADMIN ${char.admin_level}`,
      color: "#ef4444",
      tooltip: `Server Administrator · Level ${char.admin_level}`,
    });
  }
  if (char.helper_level > 0) {
    roleBadges.push({
      label: `HELPER ${char.helper_level}`,
      color: "#3b82f6",
      tooltip: `Server Helper · Level ${char.helper_level}`,
    });
  }
  if (char.is_faction_leader || char.job_grade >= 7) {
    roleBadges.push({
      label: "FACTION LEADER",
      color: "#10b981",
      tooltip: `Leader of ${factionLabel || "Faction"}`,
      href: `/factions/${char.job}`,
    });
  } else if (char.job_grade === 6) {
    roleBadges.push({
      label: "SUB-LEADER",
      color: "#10b981",
      tooltip: `Sub-Leader of ${factionLabel || "Faction"}`,
      href: `/factions/${char.job}`,
    });
  }
  if (char.is_clan_owner || (char.clan_rank && char.clan_rank >= 7)) {
    roleBadges.push({
      label: "CLAN OWNER",
      color: char.clan_tag_color || "#f59e0b",
      tooltip: `Owner of [${char.clan_tag}] ${char.clan_name || "Clan"}`,
      href: char.clan_id ? `/clans/${char.clan_id}` : undefined,
    });
  } else if (char.clan_rank === 6) {
    roleBadges.push({
      label: "CLAN CO-LEADER",
      color: char.clan_tag_color || "#f59e0b",
      tooltip: `Co-Leader of [${char.clan_tag}] ${char.clan_name || "Clan"}`,
      href: char.clan_id ? `/clans/${char.clan_id}` : undefined,
    });
  }

  let characterSkin: string | null = null;
  if (char.metadata) {
    try {
      const parsedMeta = typeof char.metadata === "string" ? JSON.parse(char.metadata) : char.metadata;
      if (parsedMeta && parsedMeta.skin) {
        characterSkin = String(parsedMeta.skin);
      }
    } catch {}
  }

  return (
    <div className="space-y-5">
      {/* Staff Actions if Admin */}
      {session && session.adminLevel >= 1 && session.accountId !== char.account_id && (
        <PlayerActions accountId={char.account_id} characterId={char.id} adminLevel={session.adminLevel} locale={locale} />
      )}

      {/* Main Profile Header Card */}
      <div className="p-4 sm:p-5 bg-[#101011] border border-surface-border rounded">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Avatar + Identity + Metadata */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded bg-[#18181b] border border-surface-border shrink-0 overflow-hidden flex items-center justify-center shadow-md">
              <GTAImage
                src={getPedAvatarUrl(char.gender, char.avatar_url || char.avatar, characterSkin)}
                alt={char.account_username}
                fallbackText="GTA Skin"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  <PlayerIdentity
                    username={char.account_username}
                    factionId={char.job}
                    clanTag={char.clan_tag}
                    clanColor={char.clan_tag_color}
                    clanTagStyle={char.clan_tag_style}
                    clickable={false}
                    size="lg"
                  />
                </h1>

                {/* Online Indicator */}
                {Boolean(char.is_online) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Online
                  </span>
                ) : (
                  <span className="text-xs text-[#6f6f74] font-mono">
                    {char.last_played ? `Last seen: ${formatDate(char.last_played, locale)}` : "Offline"}
                  </span>
                )}
              </div>

              {/* Role Badges */}
              {roleBadges.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {roleBadges.map((b, idx) => (
                    b.href ? (
                      <Link
                        key={idx}
                        href={b.href}
                        title={b.tooltip}
                        style={{ borderColor: `${b.color}40`, color: b.color }}
                        className="px-2 py-0.5 bg-[#18181b] border rounded text-[10px] font-mono font-bold tracking-tight uppercase hover:opacity-80 transition-opacity"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <span
                        key={idx}
                        title={b.tooltip}
                        style={{ borderColor: `${b.color}40`, color: b.color }}
                        className="px-2 py-0.5 bg-[#18181b] border rounded text-[10px] font-mono font-bold tracking-tight uppercase"
                      >
                        {b.label}
                      </span>
                    )
                  ))}
                </div>
              )}

              {/* Sub-identity: Faction & Clan details */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a8a90] pt-1">
                {hasFaction ? (
                  <span>
                    Faction:{" "}
                    <Link href={`/factions/${char.job}`} className="text-[#f1f1f1] font-medium hover:underline">
                      {factionLabel}
                    </Link>{" "}
                    <span className="text-[#6f6f74]">(Rank {char.job_grade})</span>
                  </span>
                ) : (
                  <span>
                    Job: <span className="text-[#a5a5a8] capitalize">{char.job ? char.job.replace(/_/g, " ") : "Civilian"}</span>
                  </span>
                )}

                {char.clan_id && char.clan_tag && (
                  <>
                    <span>•</span>
                    <span>
                      Clan:{" "}
                      <Link href={`/clans/${char.clan_id}`} style={{ color: char.clan_tag_color || "#f59e0b" }} className="font-semibold hover:underline">
                        [{char.clan_tag}] {char.clan_name}
                      </Link>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Featured Vehicle Preview */}
          {featuredVehicle && (
            <div className="flex items-center gap-3 p-2.5 bg-[#141416] border border-surface-border rounded lg:max-w-xs w-full">
              <div className="w-20 h-14 bg-[#1b1b1e] rounded overflow-hidden shrink-0 flex items-center justify-center border border-surface-border">
                <GTAImage
                  src={getVehiclePreviewUrl(featuredVehicle.model, featuredVehicle.preview_url)}
                  alt={vehicleDisplayName(featuredVehicle.model, featuredVehicle.catalog_label)}
                  fallbackText="GTA V"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <div className="min-w-0 text-xs">
                <span className="text-[10px] text-[#6f6f74] uppercase tracking-wider block font-semibold">Featured Vehicle</span>
                <span className="font-bold text-[#f1f1f1] truncate block">{vehicleDisplayName(featuredVehicle.model, featuredVehicle.catalog_label)}</span>
                <span className="font-mono text-[11px] text-[#8a8a90] block">{featuredVehicle.plate}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[#6f6f74] block font-medium">Level</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{char.level}</span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[#6f6f74] block font-medium">Played Time</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{Math.floor(char.paydays_received || 0)} hours</span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[#6f6f74] block font-medium">Respect Points</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{formatNumber(char.respect_points, locale)} RP</span>
        </div>

        <div className="p-3 bg-[#101011] border border-surface-border rounded">
          <span className="text-[#6f6f74] block font-medium">Warnings</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{warningsCount} / 3</span>
        </div>
      </div>

      {/* Money (Only shown if character owner or staff) */}
      {balance && (
        <div>
          <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider mb-2">
            Money
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-surface-100 border border-surface-border rounded flex items-center justify-between">
              <span className="text-xs text-[#8a8a90]">Cash</span>
              <span className="font-mono text-sm font-semibold text-[#f1f1f1]">{formatCurrency(balance.cash)}</span>
            </div>
            <div className="p-3 bg-surface-100 border border-surface-border rounded flex items-center justify-between">
              <span className="text-xs text-[#8a8a90]">Bank</span>
              <span className="font-mono text-sm font-semibold text-[#f1f1f1]">{formatCurrency(balance.bank)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Sections: Vehicles, Properties, Jobs, Licenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Vehicles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              Vehicles ({vehicles.length})
            </h2>
          </div>

          {vehicles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {vehicles.map((v) => (
                <div key={v.id} className="p-2.5 bg-[#101011] border border-surface-border rounded flex gap-3 items-center">
                  <div className="w-16 h-12 bg-[#18181b] rounded overflow-hidden shrink-0 border border-surface-border flex items-center justify-center">
                    <GTAImage
                      src={getVehiclePreviewUrl(v.model, v.preview_url)}
                      alt={vehicleDisplayName(v.model, v.catalog_label)}
                      fallbackText="GTA V"
                      className="w-full h-full object-contain p-0.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#f1f1f1] truncate">{vehicleDisplayName(v.model, v.catalog_label)}</span>
                      {v.destroyed ? (
                        <span className="text-[10px] text-red-400 font-mono">Destroyed</span>
                      ) : v.stored ? (
                        <span className="text-[10px] text-[#6f6f74] font-mono">Garage</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#8a8a90] mt-0.5 font-mono">
                      <span>{v.plate}</span>
                      <span>•</span>
                      <span>Ins. Lvl {v.insurance_level || 1}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6f6f74] p-3 border border-surface-border rounded bg-[#101011]">
              No vehicles registered.
            </p>
          )}
        </div>

        {/* Properties */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              Properties ({properties.length})
            </h2>
          </div>

          {properties.length > 0 ? (
            <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                  <tr>
                    <th className="py-2 px-3">Property</th>
                    <th className="py-2 px-3 text-right">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                  {properties.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-medium text-[#f1f1f1]">{p.label}</td>
                      <td className="py-2 px-3 text-right text-[#6f6f74] capitalize">{p.interior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#6f6f74] p-3 border border-surface-border rounded bg-surface-100">
              No properties.
            </p>
          )}
        </div>

        {/* Job Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              Job Progress
            </h2>
          </div>

          {skills.length > 0 ? (
            <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                  <tr>
                    <th className="py-2 px-3">Job</th>
                    <th className="py-2 px-3">Level</th>
                    <th className="py-2 px-3 text-right">Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                  {skills.map((s) => (
                    <tr key={s.job_id}>
                      <td className="py-2 px-3 font-medium text-[#f1f1f1] capitalize">{s.job_id.replace(/_/g, " ")}</td>
                      <td className="py-2 px-3 font-mono text-[#f1f1f1]">Level {s.level}</td>
                      <td className="py-2 px-3 text-right font-mono text-[#6f6f74]">{s.completed_tasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#6f6f74] p-3 border border-surface-border rounded bg-surface-100">
              No job progress yet.
            </p>
          )}
        </div>

        {/* Licenses */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[#f1f1f1] uppercase tracking-wider">
              Licenses
            </h2>
          </div>

          {licenses.length > 0 ? (
            <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                  <tr>
                    <th className="py-2 px-3">License</th>
                    <th className="py-2 px-3 text-right">Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                  {licenses.map((l) => (
                    <tr key={l.type}>
                      <td className="py-2 px-3 font-medium text-[#f1f1f1] capitalize">{l.type} License</td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-[#6f6f74]">{formatDate(l.issued_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#6f6f74] p-3 border border-surface-border rounded bg-surface-100">
              No licenses held.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
