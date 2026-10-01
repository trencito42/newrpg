import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { StaffClansClient } from "./StaffClansClient";

export default async function StaffClansPage() {
  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session || session.adminLevel < 1) {
    redirect("/staff/dashboard");
  }

  const clans = await dbQuery<RowDataPacket>(
    `SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      c.owner_character_id, c.max_members, c.created_at,
      acc.username as owner_username,
      (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) as member_count,
      (SELECT COUNT(*) FROM turfs t WHERE t.owner_clan_id = c.id) as turfs_count,
      (SELECT COALESCE(SUM(warns), 0) FROM clan_members cm WHERE cm.clan_id = c.id) as total_warns,
      COALESCE(s.applications_open, 0) as applications_open,
      (SELECT COUNT(*) FROM panel_org_applications a WHERE a.org_type = 'clan' AND a.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci AND a.status IN ('submitted', 'under_review')) as pending_applications
     FROM clans c
     JOIN characters ch ON ch.id = c.owner_character_id
     JOIN players p ON p.id = ch.player_id
     JOIN accounts acc ON acc.id = p.account_id
     LEFT JOIN panel_org_application_settings s ON s.org_type = 'clan' AND s.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci
     ORDER BY c.id ASC`
  );

  return (
    <StaffClansClient
      clans={clans}
      canManageClans={session.adminLevel >= 4}
      canDissolveClans={session.adminLevel >= 5}
      locale={locale}
    />
  );
}
