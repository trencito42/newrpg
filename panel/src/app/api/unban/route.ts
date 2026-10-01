import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, execute } from "@/lib/db";
import { z } from "zod";

const unbanSchema = z.object({
  reason: z.string().trim().min(20).max(5000),
  banId: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. You must be logged into your account to submit an appeal." }, { status: 401 });
    }

    const body = await req.json();
    const result = unbanSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid appeal data. Please provide a detailed explanation of at least 20 characters.", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { reason, banId } = result.data;

    // Check if there is already a pending unban appeal for this account
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM panel_unban_requests WHERE account_id = ? AND status = 'pending' LIMIT 1",
      [user.accountId]
    );

    if (existing) {
      return NextResponse.json(
        { error: "You already have a pending unban request under review by staff. Please wait for an official verdict." },
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
      message: "Your unban appeal has been submitted successfully.",
    });
  } catch (error: any) {
    console.error("Error creating unban request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
