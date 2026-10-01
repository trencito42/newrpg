import { notFound } from "next/navigation";
import { getCurrentSession, getRequestLanguage } from "@/lib/auth";
import { dbQuery, dbQuerySingle } from "@/lib/db";
import { resolvePlayerIdentities } from "@/lib/player-identity";
import { ApplicationThreadClient } from "@/components/applications/ApplicationThreadClient";
import { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; applicationId: string }>;
}

export default async function ClanApplicationDetailPage({ params }: Props) {
  const { id, applicationId } = await params;
  const clanId = Number(id);
  const appId = Number(applicationId);
  if (!Number.isSafeInteger(clanId) || clanId < 1 || !Number.isSafeInteger(appId) || appId < 1) {
    notFound();
  }

  const session = await getCurrentSession();
  const locale = await getRequestLanguage();

  const clan = await dbQuerySingle<RowDataPacket>(
    `SELECT id, name, tag, tag_color, tag_style, owner_character_id FROM clans WHERE id = ? LIMIT 1`,
    [clanId]
  );

  if (!clan) {
    notFound();
  }

  // 1. Fetch application
  const app = await dbQuerySingle<RowDataPacket>(
    `SELECT 
       a.id, a.org_type, a.org_id, a.account_id, a.character_id, a.status,
       a.review_reason, a.reviewed_by_account_id, a.reviewed_at, a.snapshot_json,
       a.created_at, a.updated_at,
       acc.username AS applicant_username,
       c.level AS applicant_level,
       c.paydays_received AS applicant_hours,
       c.job AS applicant_faction
     FROM panel_org_applications a
     JOIN accounts acc ON acc.id = a.account_id
     LEFT JOIN characters c ON c.id = a.character_id
     WHERE a.id = ? AND a.org_type = 'clan' AND a.org_id = ?
     LIMIT 1`,
    [appId, String(clanId)]
  );

  if (!app) {
    notFound();
  }

  // Parse snapshot
  let snap: any = {};
  try {
    if (app.snapshot_json) snap = JSON.parse(app.snapshot_json);
  } catch {
    snap = {};
  }

  // 2. Fetch Answers with Question labels
  const answers = await dbQuery<RowDataPacket>(
    `SELECT 
       ans.id, ans.question_id, ans.answer_text,
       q.label_en, q.label_ro, q.question_type, q.sort_order
     FROM panel_org_application_answers ans
     JOIN panel_org_application_questions q ON q.id = ans.question_id
     WHERE ans.application_id = ?
     ORDER BY q.sort_order ASC, ans.id ASC`,
    [appId]
  );

  // 3. Fetch Votes
  const votes = await dbQuery<RowDataPacket>(
    `SELECT 
       v.id, v.voter_account_id, v.voter_character_id, v.voter_username,
       v.vote, v.comment, v.created_at, v.updated_at
     FROM panel_org_application_votes v
     WHERE v.application_id = ?
     ORDER BY v.created_at ASC`,
    [appId]
  );

  // 4. Fetch Comments
  const comments = await dbQuery<RowDataPacket>(
    `SELECT 
       c.id, c.sender_account_id, c.sender_character_id, c.sender_username,
       c.role_badge, c.message, c.created_at
     FROM panel_org_application_comments c
     WHERE c.application_id = ?
     ORDER BY c.created_at ASC, c.id ASC`,
    [appId]
  );

  // 5. Batch resolve PlayerIdentities
  const names = new Set<string>();
  if (app.applicant_username) names.add(app.applicant_username);
  for (const v of votes) if (v.voter_username) names.add(v.voter_username);
  for (const c of comments) if (c.sender_username) names.add(c.sender_username);

  const identitiesMap = await resolvePlayerIdentities(Array.from(names));
  const identitiesObj = Object.fromEntries(identitiesMap);

  // 6. Calculate viewer permissions
  let isMember = false;
  let isLeader = false;
  let isSubLeader = false;
  let isApplicant = Boolean(session && session.accountId === app.account_id);
  let isStaff = Boolean(session && (session.adminLevel >= 1 || session.helperLevel >= 1));

  let currentVote: "pro" | "contra" | "neutral" | null = null;

  if (session) {
    const clanRow = await dbQuerySingle<RowDataPacket>(
      `SELECT cm.rank, c.owner_character_id, ch.id as char_id
       FROM clan_members cm 
       JOIN characters ch ON ch.id = cm.character_id 
       JOIN players p ON p.id = ch.player_id 
       JOIN clans c ON c.id = cm.clan_id
       WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
      [session.accountId, clanId]
    );

    if (clanRow) {
      isMember = true;
      if (Number(clanRow.rank) >= 6 || Number(clanRow.owner_character_id) === Number(clanRow.char_id)) {
        isLeader = true;
      } else if (Number(clanRow.rank) >= 5) {
        isSubLeader = true;
      }
    }

    const userVoteRow = votes.find((v) => v.voter_account_id === session.accountId);
    if (userVoteRow) {
      currentVote = userVoteRow.vote;
    }
  }

  const isPending = app.status === "submitted" || app.status === "under_review";
  const canVote = Boolean(session && isMember && !isApplicant && isPending);
  const canComment = Boolean(session && (isMember || isApplicant || isStaff));
  const canManage = Boolean(session && (isLeader || isSubLeader || session.adminLevel >= 3));

  return (
    <ApplicationThreadClient
      orgType="clan"
      orgId={String(clanId)}
      orgName={`[${clan.tag}] ${clan.name}`}
      orgColor={clan.tag_color || "#f59e0b"}
      application={{
        id: app.id,
        org_type: "clan",
        org_id: String(clanId),
        account_id: app.account_id,
        character_id: app.character_id,
        status: app.status,
        review_reason: app.review_reason,
        reviewed_by_account_id: app.reviewed_by_account_id,
        reviewed_at: app.reviewed_at,
        snapshot_json: app.snapshot_json,
        created_at: app.created_at,
        updated_at: app.updated_at,
        applicant_username: app.applicant_username,
        applicant_level: snap.level || app.applicant_level,
        applicant_hours: snap.hours || app.applicant_hours,
        applicant_faction: snap.job || app.applicant_faction,
        applicant_warnings: snap.warnings || 0,
      }}
      questions={answers as any}
      initialVotes={votes as any}
      initialComments={comments as any}
      identities={identitiesObj}
      viewer={{
        isLoggedIn: Boolean(session),
        isApplicant,
        isMember,
        isLeader,
        isSubLeader,
        isStaff,
        canVote,
        canComment,
        canManage,
        currentVote,
      }}
      locale={locale}
    />
  );
}
