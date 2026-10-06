import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ClanManageClient } from "./ClanManageClient";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { getOrgProfile } from "@/lib/org-profile";

interface Context {
  params: Promise<{ id: string }>;
}

export default async function ClanManagePage({ params }: Context) {
  const { id: idStr } = await params;
  const clanId = Number(idStr);
  if (!Number.isSafeInteger(clanId) || clanId < 1) notFound();

  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session) redirect(`/login?returnUrl=/clans/${clanId}/manage`);

  // Verify permissions
  let userRank = 0;
  let isLeader = session.adminLevel >= 4;
  let isCoLeader = session.adminLevel >= 4;

  const clan = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      c.id, c.name, c.tag, c.description, c.tag_color, c.tag_style,
      c.owner_character_id, c.motd, c.max_members, c.created_at, c.rank_labels,
      acc.username as owner_username,
      COALESCE(s.applications_open, 0) as applications_open,
      s.min_level, s.min_hours, s.max_warnings, s.cooldown_hours
     FROM clans c
     JOIN characters ch ON ch.id = c.owner_character_id
     JOIN players p ON p.id = ch.player_id
     JOIN accounts acc ON acc.id = p.account_id
     LEFT JOIN panel_org_application_settings s ON s.org_type = 'clan' AND s.org_id = CONVERT(c.id, CHAR) COLLATE utf8mb4_unicode_ci
     WHERE c.id = ? LIMIT 1`,
    [clanId]
  );

  if (!clan) notFound();

  if (session.adminLevel < 4) {
    const memberRow = await dbQuerySingle<RowDataPacket>(
      `SELECT cm.rank, (c.owner_character_id = ch.id) as is_owner
       FROM clan_members cm
       JOIN characters ch ON ch.id = cm.character_id
       JOIN players p ON p.id = ch.player_id
       JOIN clans c ON c.id = cm.clan_id
       WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
      [session.accountId, clanId]
    );

    if (!memberRow) redirect(`/clans/${clanId}`);
    userRank = Number(memberRow.rank) || 1;
    if (memberRow.is_owner || userRank >= 7) {
      isLeader = true;
      isCoLeader = true;
    } else if (userRank >= 6) {
      isCoLeader = true;
    } else if (userRank < 5) {
      // Ordinary members cannot access management panel
      redirect(`/clans/${clanId}`);
    }
  } else {
    isLeader = true;
    isCoLeader = true;
  }

  // Fetch applications
  const applications = await dbQuery<RowDataPacket>(
    `SELECT 
      a.id, a.org_type, a.org_id, a.account_id, a.character_id, a.status,
      a.review_reason, a.reviewed_by_account_id, a.reviewed_at, a.snapshot_json,
      a.created_at, a.updated_at,
      acc.username as applicant_username,
      rev.username as reviewer_username
     FROM panel_org_applications a
     JOIN accounts acc ON acc.id = a.account_id
     LEFT JOIN accounts rev ON rev.id = a.reviewed_by_account_id
     WHERE a.org_type = 'clan' AND a.org_id = ?
     ORDER BY FIELD(a.status, 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'archived'), a.created_at DESC`,
    [clanId]
  );

  // Fetch members
  const members = await dbQuery<RowDataPacket>(
    `SELECT 
      c.id as character_id,
      a.id as account_id,
      a.username,
      cm.rank,
      cm.warns,
      cm.joined_at,
      c.level,
      ${factionIdSql()} as faction_id,
      ${factionGradeSql()} as faction_rank,
      c.paydays_received as hours,
      c.last_played,
      (cl.owner_character_id = c.id) as is_owner,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style
     FROM clan_members cm
     JOIN characters c ON c.id = cm.character_id
     JOIN players p ON p.id = c.player_id
     JOIN accounts a ON a.id = p.account_id
     JOIN clans cl ON cl.id = cm.clan_id
     WHERE cm.clan_id = ?
     ORDER BY (cl.owner_character_id = c.id) DESC, cm.rank DESC, cm.joined_at ASC`,
    [clanId]
  );

  // Fetch questions
  const questions = await dbQuery<RowDataPacket>(
    `SELECT id, label_en, label_ro, question_type, required, sort_order, active
     FROM panel_org_application_questions
     WHERE org_type = 'clan' AND org_id = ? AND active = 1
     ORDER BY sort_order ASC, id ASC`,
    [clanId]
  );

  // Fetch audit log
  const auditLogs = await dbQuery<RowDataPacket>(
    `SELECT 
      cal.id, cal.clan_id, cal.actor_character_id, cal.action, cal.details, cal.created_at,
      actor_acc.username as actor_username
     FROM clan_audit_log cal
     LEFT JOIN characters ac ON ac.id = cal.actor_character_id
     LEFT JOIN players ap ON ap.id = ac.player_id
     LEFT JOIN accounts actor_acc ON actor_acc.id = ap.account_id
     WHERE cal.clan_id = ?
     ORDER BY cal.id DESC LIMIT 40`,
    [clanId]
  );
  const orgProfile = await getOrgProfile("clan", String(clanId));

  const identities = Object.fromEntries(await resolvePlayerIdentities([
    ...members.map((m) => m.username),
    ...applications.flatMap((a) => [a.applicant_username, a.reviewer_username]),
    ...auditLogs.map((log) => log.actor_username),
  ]));

  return (
    <ClanManageClient
      clan={clan}
      members={members}
      applications={applications}
      questions={questions}
      auditLogs={auditLogs}
      identities={identities}
      isLeader={isLeader}
      isCoLeader={isCoLeader}
      locale={locale}
      orgProfileInitial={{
        coverImage: orgProfile?.cover_image ?? "",
        descriptionEn: orgProfile?.description_en ?? "",
        descriptionRo: orgProfile?.description_ro ?? "",
        rulesEn: orgProfile?.rules_en ?? "",
        rulesRo: orgProfile?.rules_ro ?? "",
      }}
    />
  );
}
