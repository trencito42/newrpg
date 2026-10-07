import { getViewerLocale, getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { redirect, notFound } from "next/navigation";
import { CANONICAL_FACTIONS } from "@/lib/factions";
import { FactionManageClient } from "./FactionManageClient";
import { factionGradeSql, factionIdSql } from "@/lib/faction-sql";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { getOrgProfile } from "@/lib/org-profile";

interface Context {
  params: Promise<{ slug: string }>;
}

export default async function FactionManagePage({ params }: Context) {
  const { slug } = await params;
  const faction = CANONICAL_FACTIONS[slug];
  if (!faction) notFound();

  const locale = await getViewerLocale();
  const session = await getCurrentSession();
  if (!session) redirect(`/login?returnUrl=/factions/${slug}/manage`);

  // Verify leader / subleader permissions
  let isLeader = session.adminLevel >= 4;
  let isSubLeader = session.adminLevel >= 3;

  if (session.adminLevel < 3) {
    const leaderRow = await dbQuerySingle<RowDataPacket>(
      `SELECT ${factionGradeSql()} AS job_grade, fl.id as is_leader
       FROM characters c
       JOIN players p ON p.id = c.player_id
       JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id = ?
       LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
       WHERE p.account_id = ? AND ${factionIdSql()} = fm.faction_id LIMIT 1`,
      [slug, slug, session.accountId]
    );

    if (!leaderRow) redirect(`/factions/${slug}`);
    const grade = Number(leaderRow.job_grade) || 0;
    if (Boolean(leaderRow.is_leader) || grade >= 7) {
      isLeader = true;
      isSubLeader = true;
    } else if (grade >= 6) {
      isSubLeader = true;
    } else {
      redirect(`/factions/${slug}`);
    }
  }

  // Fetch settings
  const settings = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      applications_open, min_level, min_hours, max_warnings, cooldown_hours,
      opened_at, closed_at
     FROM panel_org_application_settings
     WHERE org_type = 'faction' AND org_id = ? LIMIT 1`,
    [slug]
  );

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
     WHERE a.org_type = 'faction' AND a.org_id = ?
     ORDER BY FIELD(a.status, 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'archived'), a.created_at DESC`,
    [slug]
  );

  // Fetch members
  const members = await dbQuery<RowDataPacket>(
    `SELECT 
      c.id as character_id,
      a.id as account_id,
      a.username,
      ${factionGradeSql()} as rank,
      c.level,
      c.paydays_received as hours,
      c.last_played,
      fl.id as is_leader,
      cl.tag as clan_tag,
      cl.tag_color as clan_tag_color,
      cl.tag_style as clan_tag_style,
      (SELECT COUNT(*) FROM faction_warnings fw WHERE fw.character_id = c.id AND fw.faction_id = ?) as faction_warns,
      (SELECT COALESCE(fp, 0) FROM faction_punish fp WHERE fp.character_id = c.id LIMIT 1) as faction_fp
     FROM characters c
     JOIN faction_membership fm ON fm.character_id = c.id AND fm.faction_id = ?
     JOIN players p ON p.id = c.player_id
     JOIN accounts a ON a.id = p.account_id
     LEFT JOIN faction_leaders fl ON fl.character_id = c.id AND fl.faction_id = ?
     LEFT JOIN clan_members cm ON cm.character_id = c.id
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     WHERE ${factionIdSql()} = fm.faction_id
     ORDER BY (fl.id IS NOT NULL) DESC, rank DESC, c.level DESC`,
    [slug, slug, slug]
  );

  // Fetch resignation requests
  const resignations = await dbQuery<RowDataPacket>(
    `SELECT 
      fr.id, fr.faction_id, fr.character_id, fr.reason, fr.status,
      fr.created_at, fr.handled_at,
      acc.username as member_username,
      ${factionGradeSql()} as rank,
      c.level,
      handler.username as handled_by_username
     FROM faction_resignations fr
     JOIN characters c ON c.id = fr.character_id
     JOIN players p ON p.id = c.player_id
     JOIN accounts acc ON acc.id = p.account_id
     LEFT JOIN characters hc ON hc.id = fr.handled_by_character_id
     LEFT JOIN players hp ON hp.id = hc.player_id
     LEFT JOIN accounts handler ON handler.id = hp.account_id
     WHERE fr.faction_id = ?
     ORDER BY FIELD(fr.status, 'pending', 'accepted', 'accepted_fp', 'declined', 'expired'), fr.created_at DESC`,
    [slug]
  );

  // Fetch questions
  const questions = await dbQuery<RowDataPacket>(
    `SELECT id, label_en, label_ro, question_type, required, sort_order, active
     FROM panel_org_application_questions
     WHERE org_type = 'faction' AND org_id = ? AND active = 1
     ORDER BY sort_order ASC, id ASC`,
    [slug]
  );

  // Fetch audit log
  const auditLogs = await dbQuery<RowDataPacket>(
    `SELECT 
      fal.id, fal.faction_id, fal.actor_character_id, fal.event_type AS action, fal.metadata AS details, fal.created_at,
      actor_acc.username as actor_username,
      target_acc.username as target_username
     FROM faction_logs fal
     LEFT JOIN characters ac ON ac.id = fal.actor_character_id
     LEFT JOIN players ap ON ap.id = ac.player_id
     LEFT JOIN accounts actor_acc ON actor_acc.id = ap.account_id
     LEFT JOIN characters tc ON tc.id = fal.target_character_id
     LEFT JOIN players tp ON tp.id = tc.player_id
     LEFT JOIN accounts target_acc ON target_acc.id = tp.account_id
     WHERE fal.faction_id = ?
     ORDER BY fal.id DESC LIMIT 40`,
    [slug]
  );
  const orgProfile = await getOrgProfile("faction", slug);

  const identities = Object.fromEntries(await resolvePlayerIdentities([
    ...members.map((m) => m.username),
    ...applications.flatMap((a) => [a.applicant_username, a.reviewer_username]),
    ...resignations.map((r) => r.member_username),
    ...auditLogs.flatMap((log) => [log.actor_username, log.target_username]),
  ]));

  return (
    <FactionManageClient
      faction={faction}
      slug={slug}
      settings={settings || { applications_open: 0, min_level: 3, min_hours: 5, max_warnings: 2, cooldown_hours: 24 }}
      members={members}
      applications={applications}
      resignations={resignations}
      questions={questions}
      auditLogs={auditLogs}
      identities={identities}
      isLeader={isLeader}
      isSubLeader={isSubLeader}
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
