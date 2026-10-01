import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession, getViewerLocale, isStaff } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { t, formatDate, formatNumber, formatCurrency } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  User,
  Shield,
  Briefcase,
  Heart,
  Car,
  Home as HomeIcon,
  Phone,
  Calendar,
  Award,
  Clock,
  Target,
  FileCheck,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { RowDataPacket } from "mysql2";

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
  cash: number;
  bank: number;
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
  firstname: string;
  lastname: string;
  married_at: string;
}

interface SkillRow extends RowDataPacket {
  job_id: string;
  level: number;
  xp: number;
  completed_tasks: number;
  total_earned: number;
}

interface LicenseRow extends RowDataPacket {
  type: "driver" | "weapon" | "boat" | "pilot" | "hunting";
  issued_at: string;
  issued_at_payday: number;
  expires_at_payday: number | null;
}

interface ReputationRow extends RowDataPacket {
  contact: string;
  reputation: number;
  missions_completed: number;
}

interface SanctionRow extends RowDataPacket {
  id: number;
  action: string;
  admin_name: string;
  reason: string;
  duration_min: number | null;
  created_at: string;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const characterId = Number(id);
  if (!characterId || isNaN(characterId)) {
    notFound();
  }

  const [session, locale] = await Promise.all([
    getCurrentSession(),
    getViewerLocale(),
  ]);

  // Query character record
  const char = await dbQuerySingle<CharacterProfileRow>(
    `SELECT 
       c.id, c.player_id, p.account_id, c.firstname, c.lastname,
       c.level, c.xp, c.respect_points, c.paydays_received,
       c.job, c.job_grade, c.phone_number, c.cash, c.bank,
       c.home_property_id, c.avatar, c.gender, c.nationality,
       c.created_at AS registered_at, c.last_played,
       a.username AS account_username
     FROM characters c
     JOIN players p ON p.id = c.player_id
     JOIN accounts a ON a.id = p.account_id
     WHERE c.id = ?
     LIMIT 1`,
    [characterId]
  );

  if (!char) {
    notFound();
  }

  // PRIVACY BOUNDARY ENFORCEMENT AT DATA ACCESS LAYER:
  // Only account owner or staff can see sensitive financial balances
  const isOwner = session?.accountId === char.account_id;
  const staffMember = isStaff(session);
  const canViewFinancials = isOwner || staffMember;

  // Parallel fetch auxiliary records
  const [
    vehicleCountRow,
    propertyCountRow,
    marriage,
    skills,
    licenses,
    reputation,
    sanctions,
  ] = await Promise.all([
    dbQuerySingle<{ count: number } & RowDataPacket>(
      "SELECT COUNT(*) AS count FROM vehicles WHERE character_id = ?",
      [characterId]
    ),
    dbQuerySingle<{ count: number } & RowDataPacket>(
      "SELECT COUNT(*) AS count FROM properties WHERE owner_character_id = ?",
      [characterId]
    ),
    dbQuerySingle<MarriageRow>(
      `SELECT m.married_at,
              CASE WHEN m.partner1_id = ? THEN m.partner2_id ELSE m.partner1_id END AS partner_id,
              c.firstname, c.lastname
       FROM marriages m
       JOIN characters c ON c.id = (CASE WHEN m.partner1_id = ? THEN m.partner2_id ELSE m.partner1_id END)
       WHERE (m.partner1_id = ? OR m.partner2_id = ?) AND m.status = 'active'
       LIMIT 1`,
      [characterId, characterId, characterId, characterId]
    ),
    dbQuery<SkillRow>(
      "SELECT job_id, level, xp, completed_tasks, total_earned FROM job_progress WHERE character_id = ?",
      [characterId]
    ),
    dbQuery<LicenseRow>(
      "SELECT type, issued_at, issued_at_payday, expires_at_payday FROM character_licenses WHERE character_id = ?",
      [characterId]
    ),
    dbQuery<ReputationRow>(
      "SELECT contact, reputation, missions_completed FROM sunset_mission_reputation WHERE character_id = ?",
      [characterId]
    ),
    dbQuery<SanctionRow>(
      `SELECT id, action, admin_name, reason, duration_min, created_at 
       FROM admin_sanctions 
       WHERE target_character_id = ? OR target_account_id = ?
       ORDER BY id DESC LIMIT 5`,
      [characterId, char.account_id]
    ),
  ]);

  const fullName = `${char.firstname} ${char.lastname || ""}`.trim();
  const vehiclesCount = vehicleCountRow?.count || 0;
  const propertiesCount = propertyCountRow?.count || 0;

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="rounded-2xl bg-surface-200 border border-surface-border p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border-2 border-brand/30 flex items-center justify-center text-brand font-black text-2xl shadow-inner flex-shrink-0">
              {char.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={char.avatar}
                  alt={fullName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                char.firstname.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {fullName}
                </h1>
                <Badge variant="brand" className="font-mono">
                  Level {char.level}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-1 flex items-center space-x-2">
                <span>Account: <strong className="text-gray-300 font-mono">{char.account_username}</strong></span>
                <span>•</span>
                <span className="capitalize">{char.nationality}</span>
                <span>•</span>
                <span>{char.gender === 1 ? "Female" : "Male"}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="px-3 py-1 font-mono">
              {formatNumber(char.respect_points, locale)} RP
            </Badge>
            <Badge variant="success" className="px-3 py-1 capitalize">
              {char.job}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Key RPG Stats & Progression */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progression Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Progression & Career</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-surface-100 rounded-lg border border-surface-border">
                  <span className="text-gray-400 block mb-1">Character Level</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {char.level}
                  </span>
                </div>
                <div className="p-3 bg-surface-100 rounded-lg border border-surface-border">
                  <span className="text-gray-400 block mb-1">Respect Points</span>
                  <span className="text-lg font-black text-brand font-mono">
                    {formatNumber(char.respect_points, locale)}
                  </span>
                </div>
                <div className="p-3 bg-surface-100 rounded-lg border border-surface-border">
                  <span className="text-gray-400 block mb-1">Paydays Received</span>
                  <span className="text-lg font-black text-white font-mono">
                    {formatNumber(char.paydays_received, locale)}
                  </span>
                </div>
                <div className="p-3 bg-surface-100 rounded-lg border border-surface-border">
                  <span className="text-gray-400 block mb-1">Playing Hours</span>
                  <span className="text-lg font-black text-gray-200 font-mono">
                    {Math.floor(char.paydays_received)}h
                  </span>
                </div>
              </div>

              {/* Private Financial Balances (Only for Owner or Staff) */}
              {canViewFinancials ? (
                <div className="mt-4 pt-4 border-t border-surface-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <span className="text-emerald-400 font-semibold block mb-1">
                      Cash on Hand (Private)
                    </span>
                    <span className="text-lg font-bold text-white font-mono">
                      {formatCurrency(char.cash)}
                    </span>
                  </div>
                  <div className="p-3 bg-sky-500/5 rounded-lg border border-sky-500/20">
                    <span className="text-sky-400 font-semibold block mb-1">
                      Bank Balance (Private)
                    </span>
                    <span className="text-lg font-bold text-white font-mono">
                      {formatCurrency(char.bank)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-surface-border flex items-center space-x-2 text-xs text-gray-500">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Financial balance is private to the character owner.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Skills Tiers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Job Skills & Experience</CardTitle>
            </CardHeader>
            <CardContent>
              {skills.length > 0 ? (
                <div className="space-y-3">
                  {skills.map((skill) => (
                    <div
                      key={skill.job_id}
                      className="p-3 rounded-lg bg-surface-100 border border-surface-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white capitalize block">
                          {skill.job_id}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formatNumber(skill.completed_tasks, locale)} tasks completed • Earned {formatCurrency(skill.total_earned)}
                        </span>
                      </div>
                      <div className="text-right">
                        <Badge variant="brand" className="font-mono">
                          Tier {skill.level}
                        </Badge>
                        <span className="text-[10px] text-gray-500 block font-mono mt-0.5">
                          {formatNumber(skill.xp, locale)} XP
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-2">
                  No civilian job skill progress recorded yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Public Sanctions History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Public Disciplinary Record</CardTitle>
            </CardHeader>
            <CardContent>
              {sanctions.length > 0 ? (
                <div className="responsive-table-wrapper">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border">
                      <tr>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Reason</th>
                        <th className="pb-2">Staff</th>
                        <th className="pb-2 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/50 text-gray-300">
                      {sanctions.map((s) => (
                        <tr key={s.id}>
                          <td className="py-2.5">
                            <Badge variant={s.action === "ban" ? "danger" : "warning"}>
                              {s.action.toUpperCase()}
                              {s.duration_min ? ` (${s.duration_min}m)` : ""}
                            </Badge>
                          </td>
                          <td className="py-2.5 max-w-xs truncate text-gray-400">
                            {s.reason}
                          </td>
                          <td className="py-2.5 font-mono text-gray-300">
                            {s.admin_name}
                          </td>
                          <td className="py-2.5 text-right font-mono text-gray-500">
                            {formatDate(s.created_at, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-2">
                  Clean disciplinary record. No active or past sanctions found.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Citizen Details & Assets */}
        <div className="space-y-6">
          {/* Identity & Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Civilian Registry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-surface-border/50">
                <span className="text-gray-400 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-500" />
                  <span>Phone Number</span>
                </span>
                <span className="font-mono font-semibold text-gray-200">
                  {char.phone_number || "Unregistered"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-surface-border/50">
                <span className="text-gray-400 flex items-center space-x-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Marital Status</span>
                </span>
                <span className="text-gray-200">
                  {marriage ? (
                    <Link
                      href={`/players/${marriage.partner_id}`}
                      className="text-brand hover:underline font-medium"
                    >
                      {marriage.firstname} {marriage.lastname || ""}
                    </Link>
                  ) : (
                    "Single"
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-surface-border/50">
                <span className="text-gray-400 flex items-center space-x-1.5">
                  <Car className="w-3.5 h-3.5 text-sky-400" />
                  <span>Vehicles Owned</span>
                </span>
                <span className="font-mono font-semibold text-white">
                  {vehiclesCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-surface-border/50">
                <span className="text-gray-400 flex items-center space-x-1.5">
                  <HomeIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Properties Owned</span>
                </span>
                <span className="font-mono font-semibold text-white">
                  {propertiesCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-gray-400 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>Citizen Since</span>
                </span>
                <span className="font-mono text-gray-400">
                  {formatDate(char.registered_at, locale, false)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Licenses Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Official Licenses</CardTitle>
            </CardHeader>
            <CardContent>
              {licenses.length > 0 ? (
                <div className="space-y-2">
                  {licenses.map((lic) => {
                    const isExpired =
                      lic.expires_at_payday !== null &&
                      lic.expires_at_payday <= char.paydays_received;
                    return (
                      <div
                        key={lic.type}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface-100 border border-surface-border text-xs"
                      >
                        <span className="font-medium text-gray-200 capitalize">
                          {lic.type} License
                        </span>
                        <Badge variant={isExpired ? "danger" : "success"}>
                          {isExpired ? "Expired" : "Valid"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-1">No licenses issued yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Mission Contacts & Reputation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contract Reputation</CardTitle>
            </CardHeader>
            <CardContent>
              {reputation.length > 0 ? (
                <div className="space-y-2">
                  {reputation.map((rep) => (
                    <div
                      key={rep.contact}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-100 border border-surface-border text-xs"
                    >
                      <span className="font-medium text-gray-200 capitalize">
                        {rep.contact}
                      </span>
                      <span className="font-mono text-amber-400 font-bold">
                        {rep.reputation} Rep ({rep.missions_completed} completed)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-1">No mission history yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
