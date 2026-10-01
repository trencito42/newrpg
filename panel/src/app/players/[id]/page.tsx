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
interface VehicleRow extends RowDataPacket { id: number; model: string; plate: string; stored: number; insurance_level: number; destroyed: number }
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

   const char = await dbQuerySingle<CharacterProfileRow & { clan_tag: string | null; clan_tag_color: string | null; clan_tag_style: string | null }>(
    `SELECT 
       c.id, c.player_id, p.account_id, c.firstname, c.lastname,
       c.level, c.xp, c.respect_points, c.paydays_received,
       c.job, c.job_grade, c.phone_number,
       c.home_property_id, c.avatar, c.gender, c.nationality,
       c.created_at AS registered_at, c.last_played,
       a.username AS account_username,
       cl.tag AS clan_tag,
       cl.tag_color AS clan_tag_color,
       cl.tag_style AS clan_tag_style
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
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
      "SELECT id, model, plate, stored, insurance_level, destroyed FROM vehicles WHERE character_id = ? ORDER BY id DESC LIMIT 50",
      [characterId]
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

  return (
    <div className="space-y-5">
      {/* Staff Actions if Admin */}
      {session && session.adminLevel >= 1 && session.accountId !== char.account_id && (
        <PlayerActions accountId={char.account_id} characterId={char.id} adminLevel={session.adminLevel} locale={locale} />
      )}

      {/* Header: Player Name, Level, Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div>
          <div className="flex items-center space-x-3">
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
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-200 text-[#f1f1f1] border border-surface-border">
              Level {char.level}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-[#6f6f74] mt-1">
            {factionLabel && (
              <>
                <span className="text-[#a5a5a8] font-medium">{factionLabel}</span>
                <span>•</span>
              </>
            )}
            {!hasFaction && char.job && (
              <>
                <span className="capitalize text-[#a5a5a8]">{char.job.replace(/_/g, " ")}</span>
                <span>•</span>
              </>
            )}
            <span>Last seen: {char.last_played ? formatDate(char.last_played, locale) : "Never"}</span>
          </div>
        </div>

        {marriage && (
          <div className="text-xs text-[#8a8a90]">
            Married to <PlayerName name={marriage.partner_username} />
          </div>
        )}
      </div>

      {/* Overview Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Level</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{char.level}</span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Respect</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{formatNumber(char.respect_points, locale)}</span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Hours</span>
          <span className="text-base font-bold text-[#f1f1f1] font-mono mt-0.5 block">{Math.floor(char.paydays_received || 0)}h</span>
        </div>

        <div className="p-3 bg-surface-100 border border-surface-border rounded">
          <span className="text-xs text-[#6f6f74] block font-medium">Warnings</span>
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
            <div className="border border-surface-border rounded bg-surface-100 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] font-semibold text-[#6f6f74] border-b border-surface-border bg-surface-200/50">
                  <tr>
                    <th className="py-2 px-3">Model</th>
                    <th className="py-2 px-3">Plate</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50 text-[#a5a5a8]">
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2 px-3 font-medium text-[#f1f1f1] capitalize">{v.model}</td>
                      <td className="py-2 px-3 font-mono text-[#6f6f74]">{v.plate}</td>
                      <td className="py-2 px-3 text-right">
                        {v.destroyed ? (
                          <span className="text-red-400">Destroyed</span>
                        ) : v.stored ? (
                          <span className="text-[#6f6f74]">Garage</span>
                        ) : (
                          <span className="text-emerald-400">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#6f6f74] p-3 border border-surface-border rounded bg-surface-100">
              No vehicles.
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
