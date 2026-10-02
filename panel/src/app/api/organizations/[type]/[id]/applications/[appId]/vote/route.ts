import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuery, dbQuerySingle, dbExecute } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";
import { getFactionAccess } from "@/lib/faction-access";

interface Context {
  params: Promise<{ type: string; id: string; appId: string }>;
}

const voteSchema = z.object({
  vote: z.enum(["pro", "contra", "neutral"]),
  comment: z.string().trim().max(255).optional(),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId, appId: appIdStr } = await params;
  const appId = Number(appIdStr);
  if (!Number.isSafeInteger(appId) || appId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const votes = await dbQuery<RowDataPacket>(
    `SELECT id, application_id, org_type, org_id, voter_account_id, voter_character_id, voter_username, vote, comment, created_at, updated_at
     FROM panel_org_application_votes
     WHERE application_id = ? AND org_type = ? AND org_id = ?
     ORDER BY updated_at DESC`,
    [appId, type, orgId]
  );

  let pro = 0;
  let contra = 0;
  let neutral = 0;

  for (const v of votes) {
    if (v.vote === "pro") pro++;
    else if (v.vote === "contra") contra++;
    else if (v.vote === "neutral") neutral++;
  }

  return NextResponse.json({
    summary: { pro, contra, neutral, total: votes.length },
    votes,
  });
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId, appId: appIdStr } = await params;
  const appId = Number(appIdStr);
  if (!Number.isSafeInteger(appId) || appId < 1) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const { vote, comment } = parsed.data;

  // 1. Fetch application details
  const app = await dbQuerySingle<RowDataPacket>(
    `SELECT id, org_type, org_id, account_id, character_id, status 
     FROM panel_org_applications 
     WHERE id = ? AND org_type = ? AND org_id = ? LIMIT 1`,
    [appId, type, orgId]
  );

  if (!app) {
    return NextResponse.json({ error: "application_not_found" }, { status: 404 });
  }

  // 2. Prevent applicant from voting on their own application
  if (app.account_id === session.accountId) {
    return NextResponse.json(
      { error: "cannot_vote_on_own_application", message: "You cannot vote on your own application." },
      { status: 403 }
    );
  }

  // 3. Check application status: must be pending (submitted or under_review)
  if (app.status !== "submitted" && app.status !== "under_review") {
    return NextResponse.json(
      { error: "voting_closed", message: "Voting is closed for finalized applications." },
      { status: 400 }
    );
  }

  // 4. Check membership in THAT EXACT FACTION OR CLAN
  let isMember = false;
  let characterId: number | null = session.selectedCharacterId || null;

  if (type === "faction") {
    const memberRow = await getFactionAccess(session.accountId, orgId);

    if (memberRow) {
      isMember = true;
      characterId = memberRow.id;
    }
  } else if (type === "clan") {
    const clanRow = await dbQuerySingle<RowDataPacket>(
      `SELECT cm.character_id 
       FROM clan_members cm 
       JOIN characters c ON c.id = cm.character_id 
       JOIN players p ON p.id = c.player_id 
       WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
      [session.accountId, orgId]
    );

    if (clanRow) {
      isMember = true;
      characterId = clanRow.character_id;
    }
  }

  // If not a verified member of this exact organization, reject vote!
  if (!isMember) {
    return NextResponse.json(
      {
        error: "forbidden_not_member",
        message: type === "faction"
          ? "Only active members of this faction may vote."
          : "Only active members of this clan may vote.",
      },
      { status: 403 }
    );
  }

  // 5. Upsert unique vote: (application_id, voter_account_id)
  await dbExecute(
    `INSERT INTO panel_org_application_votes 
      (application_id, org_type, org_id, voter_account_id, voter_character_id, voter_username, vote, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       vote = VALUES(vote),
       comment = VALUES(comment),
       updated_at = NOW()`,
    [
      appId,
      type,
      orgId,
      session.accountId,
      characterId,
      session.username,
      vote,
      comment || null,
    ]
  );

  // Return new summary
  const summaryRows = await dbQuery<RowDataPacket>(
    `SELECT vote, COUNT(*) as count 
     FROM panel_org_application_votes 
     WHERE application_id = ? 
     GROUP BY vote`,
    [appId]
  );

  let pro = 0;
  let contra = 0;
  let neutral = 0;
  for (const r of summaryRows) {
    if (r.vote === "pro") pro = Number(r.count);
    if (r.vote === "contra") contra = Number(r.count);
    if (r.vote === "neutral") neutral = Number(r.count);
  }

  return NextResponse.json({
    success: true,
    userVote: vote,
    summary: { pro, contra, neutral, total: pro + contra + neutral },
  });
}
