import { NextRequest, NextResponse } from "next/server";
import { isSameOriginWrite } from "@/lib/request-security";
import { getViewerLocale, getCurrentUser } from "@/lib/auth";
import { queryOne, execute } from "@/lib/db";
import { z } from "zod";
import { t } from "@/lib/i18n";


const unbanSchema = z.object({
  reason: z.string().trim().min(20).max(5000),
  banId: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  const locale = await getViewerLocale();
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: t(locale, "interface.log_in_to_your_account_to_submit_an_appeal") }, { status: 401 });
    }

    const body = await req.json();
    const result = unbanSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: t(locale, "interface.provide_a_detailed_explanation_of_at_least_20_characters"), details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { reason, banId } = result.data;
    if (banId) {
      const ownedBan = await queryOne<{ id: number }>(
        `SELECT b.id FROM bans b JOIN players p ON p.license = b.license
         WHERE b.id = ? AND p.account_id = ? AND (b.expires_at IS NULL OR b.expires_at > NOW())
         LIMIT 1`,
        [banId, user.accountId]
      );
      if (!ownedBan) return NextResponse.json({ error: "invalid_ban" }, { status: 403 });
    }

    // Check if there is already a pending unban appeal for this account
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM panel_unban_requests WHERE account_id = ? AND status = 'pending' LIMIT 1",
      [user.accountId]
    );

    if (existing) {
      return NextResponse.json(
        { error: t(locale, "interface.you_already_have_an_appeal_under_review_wait_for_the_staff_s_verdict") },
        { status: 400 }
      );
    }

    const insertRes = await execute(
      `INSERT INTO panel_unban_requests 
       (account_id, character_id, ban_id, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user.accountId, user.selectedCharacterId || null, banId || null, reason]
    );

    return NextResponse.json({
      success: true,
      requestId: insertRes.insertId,
      message: t(locale, "interface.your_unban_appeal_has_been_submitted"),
    });
  } catch (error: any) {
    console.error("Error creating unban request:", error);
    return NextResponse.json({ error: t(locale, "interface.an_internal_error_occurred_try_again_later") }, { status: 500 });
  }
}
