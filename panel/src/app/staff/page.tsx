import Link from "next/link";
import { getViewerLocale } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { t, formatDate } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Shield, Award, Users, User } from "lucide-react";
import { RowDataPacket } from "mysql2";

interface StaffRow extends RowDataPacket {
  id: number;
  username: string;
  admin_level: number;
  helper_level: number;
  created_at: string;
}

interface LeaderRow extends RowDataPacket {
  faction_id: string;
  character_id: number;
  leader_name: string;
  assigned_at: string;
}

export default async function StaffPage() {
  const locale = await getViewerLocale();

  // Load admins
  const admins = await dbQuery<StaffRow>(
    `SELECT id, username, admin_level, helper_level, created_at
     FROM accounts
     WHERE admin_level > 0
     ORDER BY admin_level DESC, id ASC`
  );

  // Load helpers
  const helpers = await dbQuery<StaffRow>(
    `SELECT id, username, admin_level, helper_level, created_at
     FROM accounts
     WHERE helper_level > 0 AND admin_level = 0
     ORDER BY helper_level DESC, id ASC`
  );

  // Load faction leaders
  const leaders = await dbQuery<LeaderRow>(
    `SELECT fl.faction_id, fl.character_id, fl.assigned_at,
            CONCAT(c.firstname, ' ', COALESCE(c.lastname, '')) AS leader_name
     FROM faction_leaders fl
     JOIN characters c ON c.id = fl.character_id
     ORDER BY fl.faction_id ASC`
  );

  const getAdminTitle = (level: number) => {
    switch (level) {
      case 6:
        return "Executive / Owner";
      case 5:
        return "Head Admin";
      case 4:
        return "Senior Admin";
      case 3:
        return "Lead Admin";
      case 2:
        return "Administrator";
      case 1:
        return "Junior Admin";
      default:
        return `Admin Level ${level}`;
    }
  };

  const getHelperTitle = (level: number) => {
    switch (level) {
      case 3:
        return "Senior Helper";
      case 2:
        return "Advanced Helper";
      case 1:
        return "Community Helper";
      default:
        return `Helper Level ${level}`;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {t(locale, "staff.title")}
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          {t(locale, "staff.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Administrators Column */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-brand" />
              <CardTitle className="text-base">{t(locale, "staff.admins")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {admins.length > 0 ? (
                admins.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-surface-border text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center font-bold text-brand text-xs">
                        {a.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-white text-sm block">
                          {a.username}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {getAdminTitle(a.admin_level)}
                        </span>
                      </div>
                    </div>

                    <Badge variant="warning" className="font-mono">
                      Admin Lv.{a.admin_level}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 py-3 text-center">
                  No administrators registered.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Helpers & Leaders Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-sky-400" />
                <CardTitle className="text-base">{t(locale, "staff.helpers")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {helpers.length > 0 ? (
                  helpers.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-surface-border text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-bold text-sky-400 text-xs">
                          {h.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white text-sm block">
                            {h.username}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {getHelperTitle(h.helper_level)}
                          </span>
                        </div>
                      </div>

                      <Badge variant="info" className="font-mono">
                        Helper Lv.{h.helper_level}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    No community helpers active.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Faction Leaders */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-400" />
                <CardTitle className="text-base">{t(locale, "staff.leaders")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaders.length > 0 ? (
                  leaders.map((l) => (
                    <div
                      key={l.faction_id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-100 border border-surface-border text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white uppercase font-mono text-[11px]">
                          [{l.faction_id}]
                        </span>
                        <Link
                          href={`/players/${l.character_id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {l.leader_name}
                        </Link>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {formatDate(l.assigned_at, locale, false)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 py-2 text-center">
                    No leaders currently recorded.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
