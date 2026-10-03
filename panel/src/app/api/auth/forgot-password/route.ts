import { NextRequest, NextResponse } from "next/server";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { generateRandomToken, hashTokenSha256 } from "@/lib/crypto";
import { sendPasswordResetEmail } from "@/lib/mail";
import { RowDataPacket } from "mysql2";

interface AccountRow extends RowDataPacket {
  id: number;
  username: string;
  email: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim();

    if (!identifier) {
      return NextResponse.json(
        { error: "Te rugăm să introduci numele de utilizator sau emailul." },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const account = await dbQuerySingle<AccountRow>(
      `SELECT id, username, email FROM accounts 
       WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) 
       LIMIT 1`,
      [identifier, identifier]
    );

    if (account && account.email && account.email.includes("@")) {
      const rawToken = generateRandomToken(32);
      const tokenHash = hashTokenSha256(rawToken);

      await dbExecute(
        `INSERT INTO account_password_resets 
         (account_id, token_hash, email, ip_address, expires_at) 
         VALUES (?, ?, ?, ?, NOW() + INTERVAL 30 MINUTE)`,
        [account.id, tokenHash, account.email, clientIp]
      );

      const origin =
        process.env.PANEL_PUBLIC_ORIGIN ||
        `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host") || request.headers.get("host") || "rpg.racket.cat"}`;
      const resetUrl = `${origin.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;

      // Send email asynchronously
      sendPasswordResetEmail({
        to: account.email,
        username: account.username,
        resetUrl,
        ipAddress: clientIp,
      }).catch((err) => {
        console.error("[forgot-password] Email send failed:", err);
      });
    }

    // Always return success message to prevent user enumeration
    return NextResponse.json({
      ok: true,
      message:
        "Dacă datele introduse corespund unui cont activ, a fost trimis un email cu linkul de resetare pe adresa asociată.",
    });
  } catch (error) {
    console.error("[forgot-password] API error:", error);
    return NextResponse.json(
      { error: "A apărut o eroare la procesarea solicitării." },
      { status: 500 }
    );
  }
}
