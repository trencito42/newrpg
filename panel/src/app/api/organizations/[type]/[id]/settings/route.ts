import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { dbQuerySingle } from "@/lib/db";
import { isSameOriginWrite } from "@/lib/request-security";
import { RowDataPacket } from "mysql2";
import { getFactionAccess } from "@/lib/faction-access";

interface Context {
  params: Promise<{ type: string; id: string }>;
}

const settingsSchema = z.object({
  applicationsOpen: z.boolean(),
  minLevel: z.number().int().min(1).max(100).optional(),
  minHours: z.number().int().min(0).max(1000).optional(),
  maxWarnings: z.number().int().min(0).max(10).optional(),
  cooldownHours: z.number().int().min(0).max(168).optional(),
});

export async function GET(req: NextRequest, { params }: Context) {
  const { type, id: orgId } = await params;
  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  const row = await dbQuerySingle<RowDataPacket>(
    `SELECT 
      applications_open, min_level, min_hours, max_warnings, cooldown_hours,
      opened_at, closed_at, updated_at
     FROM panel_org_application_settings
     WHERE org_type = ? AND org_id = ? LIMIT 1`,
    [type, orgId]
  );

  if (!row) {
    // Return default settings
    return NextResponse.json({
      settings: {
        applications_open: 0,
        min_level: 3,
        min_hours: 5,
        max_warnings: 2,
        cooldown_hours: 24,
        opened_at: null,
        closed_at: null,
      },
    });
  }

  return NextResponse.json({ settings: row });
}

export async function POST(req: NextRequest, { params }: Context) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { type, id: orgId } = await params;
  if (type !== "faction" && type !== "clan") {
    return NextResponse.json({ error: "invalid_org_type" }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Explicit rule: Only Leader (Rank 7) or high Admin can OPEN/CLOSE applications and modify settings!
  // Sub-leader (Rank 6) CANNOT modify settings or open/close applications.
  let isLeader = session.adminLevel >= 4;
  if (!isLeader) {
    if (type === "faction") {
      const leaderRow = await getFactionAccess(session.accountId, orgId);
      if (leaderRow && (Number(leaderRow.job_grade) >= 7 || Boolean(leaderRow.is_leader))) {
        isLeader = true;
      }
    } else if (type === "clan") {
      const clanRow = await dbQuerySingle<RowDataPacket>(
        `SELECT cm.rank, c.owner_character_id, ch.id as char_id
         FROM clan_members cm
         JOIN characters ch ON ch.id = cm.character_id
         JOIN players p ON p.id = ch.player_id
         JOIN clans c ON c.id = cm.clan_id
         WHERE p.account_id = ? AND cm.clan_id = ? LIMIT 1`,
        [session.accountId, orgId]
      );
      if (clanRow && (Number(clanRow.rank) >= 7 || Number(clanRow.owner_character_id) === Number(clanRow.char_id))) {
        isLeader = true;
      }
    }
  }

  if (!isLeader) {
    return NextResponse.json({ error: "forbidden_leader_only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", details: parsed.error.issues }, { status: 400 });
  }

  const { applicationsOpen, minLevel = 3, minHours = 5, maxWarnings = 2, cooldownHours = 24 } = parsed.data;

  const openVal = applicationsOpen ? 1 : 0;
  const openedBy = applicationsOpen ? session.accountId : null;
  const closedBy = !applicationsOpen ? session.accountId : null;

  await dbQuerySingle(
    `INSERT INTO panel_org_application_settings
      (org_type, org_id, applications_open, min_level, min_hours, max_warnings, cooldown_hours,
       opened_at, opened_by_account_id, closed_at, closed_by_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, IF(?, NOW(), NULL), ?, IF(? = 0, NOW(), NULL), ?)
     ON DUPLICATE KEY UPDATE
       applications_open = VALUES(applications_open),
       min_level = VALUES(min_level),
       min_hours = VALUES(min_hours),
       max_warnings = VALUES(max_warnings),
       cooldown_hours = VALUES(cooldown_hours),
       opened_at = IF(VALUES(applications_open) = 1 AND applications_open = 0, NOW(), opened_at),
       opened_by_account_id = IF(VALUES(applications_open) = 1 AND applications_open = 0, VALUES(opened_by_account_id), opened_by_account_id),
       closed_at = IF(VALUES(applications_open) = 0 AND applications_open = 1, NOW(), closed_at),
       closed_by_account_id = IF(VALUES(applications_open) = 0 AND applications_open = 1, VALUES(closed_by_account_id), closed_by_account_id)`,
    [
      type,
      orgId,
      openVal,
      minLevel,
      minHours,
      maxWarnings,
      cooldownHours,
      openVal,
      openedBy,
      openVal,
      closedBy,
    ]
  );

  return NextResponse.json({ success: true, applicationsOpen });
}
