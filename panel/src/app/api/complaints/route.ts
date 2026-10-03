import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, execute } from "@/lib/db";
import { z } from "zod";
import { isSameOriginWrite } from "@/lib/request-security";

const complaintSchema = z.object({
  accusedName: z.string().trim().min(2).max(64),
  category: z.enum([
    "deathmatch",
    "powergaming",
    "metagaming",
    "insults",
    "cheating",
    "bug_abuse",
    "scamming",
    "faction_abuse",
    "other",
  ]),
  title: z.string().trim().min(3).max(191),
  evidenceText: z.string().trim().min(3).max(5000),
});

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = complaintSchema.safeParse(body);
    if (!result.success) {
      const errMessages = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      return NextResponse.json(
        { error: `Invalid complaint data: ${errMessages}`, details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { accusedName, category, title, evidenceText } = result.data;

    // Verify accused character exists in characters table using firstname, lastname or account username
    const accusedChar = await queryOne<{ id: number; firstname: string; lastname: string }>(
      `SELECT c.id, c.firstname, c.lastname FROM characters c
       JOIN players p ON p.id = c.player_id
       JOIN accounts a ON a.id = p.account_id
       WHERE LOWER(c.firstname) = LOWER(?)
          OR LOWER(CONCAT(c.firstname, '_', COALESCE(c.lastname, ''))) = LOWER(?)
          OR LOWER(CONCAT(c.firstname, ' ', COALESCE(c.lastname, ''))) = LOWER(?)
          OR LOWER(a.username) = LOWER(?)
       ORDER BY c.id ASC
       LIMIT 1`,
      [accusedName, accusedName, accusedName, accusedName]
    );

    if (!accusedChar) {
      return NextResponse.json(
        { error: `Player character '${accusedName}' was not found on the server.` },
        { status: 404 }
      );
    }

    const accusedFullName = `${accusedChar.firstname} ${accusedChar.lastname || ""}`.trim();

    // Rate limiting: check recent complaints created by this account in the last 10 minutes
    const recent = await queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM panel_complaints WHERE accuser_account_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)",
      [user.accountId]
    );

    if (recent && recent.count >= 3) {
      return NextResponse.json(
        { error: "Rate limit exceeded. You can only file 3 complaints every 10 minutes." },
        { status: 429 }
      );
    }

    // Insert complaint
    const insertRes = await execute(
      `INSERT INTO panel_complaints 
       (accuser_account_id, accuser_character_id, accused_character_id, accused_name, category, title, evidence_text, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user.accountId,
        user.selectedCharacterId || null,
        accusedChar.id,
        accusedFullName,
        category,
        title,
        evidenceText,
      ]
    );

    // Notify accused player
    const accusedAcc = await queryOne<{ account_id: number }>(
      "SELECT p.account_id FROM players p JOIN characters c ON c.player_id = p.id WHERE c.id = ? LIMIT 1",
      [accusedChar.id]
    );

    if (accusedAcc && accusedAcc.account_id && accusedAcc.account_id !== user.accountId) {
      await execute(
        `INSERT INTO panel_notifications (account_id, type, title_en, title_ro, message_en, message_ro, link_url)
         VALUES (?, 'complaint_created', ?, ?, ?, ?, ?)`,
        [
          accusedAcc.account_id,
          "New Complaint Filed",
          "Reclamație nouă împotriva ta",
          `A complaint (${category}) was opened against you: "${title.slice(0, 100)}"`,
          `A fost deschisă o reclamație (${category}) împotriva ta: "${title.slice(0, 100)}"`,
          "/support/complaints",
        ]
      );
    }

    return NextResponse.json({
      success: true,
      complaintId: insertRes.insertId,
      message: "Complaint registered successfully and queued for staff review.",
    });
  } catch (error: any) {
    console.error("Error creating complaint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
