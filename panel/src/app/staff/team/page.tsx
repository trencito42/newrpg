import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { StaffTeamClient } from "./StaffTeamClient";
import { factionIdSql } from "@/lib/faction-sql";

export default async function StaffTeamPage() {
  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  const staff = await dbQuery<RowDataPacket>(
    `SELECT 
      a.id as account_id,
      a.username,
      a.admin_level,
      a.helper_level,
      a.created_at,
      c.id as character_id,
      c.level,
      c.last_played,
      ${factionIdSql()} as faction_id,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
     FROM accounts a
     LEFT JOIN players p ON p.account_id = a.id
     LEFT JOIN characters c ON c.player_id = p.id
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     WHERE a.admin_level > 0 OR a.helper_level > 0
     ORDER BY a.admin_level DESC, a.helper_level DESC, a.username ASC`
  );

  return (
    <StaffTeamClient
      staff={staff}
      sessionAdminLevel={session.adminLevel}
      currentAccountId={session.accountId}
      locale={locale}
    />
  );
}
