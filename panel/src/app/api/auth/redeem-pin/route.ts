import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { RowDataPacket } from "mysql2";

const pinSchema = z.object({
  code: z.string().min(4).max(16),
});

interface TokenRow extends RowDataPacket {
  id: number;
  account_id: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = pinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const { code } = parsed.data;

    // Look for unredeemed, unexpired token matching code
    const tokenRecord = await dbQuerySingle<TokenRow>(
      `SELECT id, account_id 
       FROM panel_link_tokens 
       WHERE code = ? AND redeemed_at IS NULL AND expires_at > NOW() 
       LIMIT 1`,
      [code.trim()]
    );

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "invalid_pin", message: "PIN is invalid or has expired." },
        { status: 401 }
      );
    }

    // Mark as redeemed immediately (single-use invariant)
    await dbExecute(
      "UPDATE panel_link_tokens SET redeemed_at = NOW() WHERE id = ?",
      [tokenRecord.id]
    );

    // Create web session
    await createSession(tokenRecord.account_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
