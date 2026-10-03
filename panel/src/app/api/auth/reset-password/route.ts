import { NextRequest, NextResponse } from "next/server";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { hashTokenSha256, hashScryptPassword } from "@/lib/crypto";
import { RowDataPacket } from "mysql2";

interface ResetRow extends RowDataPacket {
  reset_id: number;
  account_id: number;
  username: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "").trim();
    const confirmPassword = String(body.confirmPassword || "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Token-ul de resetare lipsește sau este invalid." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Parola nouă trebuie să aibă minim 6 caractere." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Parola nouă și confirmarea nu coincid." },
        { status: 400 }
      );
    }

    const tokenHash = hashTokenSha256(token);

    const resetRecord = await dbQuerySingle<ResetRow>(
      `SELECT r.id AS reset_id, r.account_id, a.username 
       FROM account_password_resets r
       JOIN accounts a ON a.id = r.account_id
       WHERE r.token_hash = ? 
         AND r.used_at IS NULL 
         AND r.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Linkul de resetare este invalid sau a expirat (valabilitate 30 min). Te rugăm să soliciți altul." },
        { status: 400 }
      );
    }

    const newHash = hashScryptPassword(password);
    if (!newHash) {
      return NextResponse.json(
        { error: "Eroare la criptarea securizată a parolei." },
        { status: 500 }
      );
    }

    // 1. Update account password
    await dbExecute(
      `UPDATE accounts SET password_hash = ?, password_salt = '' WHERE id = ?`,
      [newHash, resetRecord.account_id]
    );

    // 2. Mark reset token as used
    await dbExecute(
      `UPDATE account_password_resets SET used_at = NOW() WHERE id = ?`,
      [resetRecord.reset_id]
    );

    // 3. Invalidate previous web sessions & quick tokens for security
    await dbExecute(
      `UPDATE panel_web_sessions SET revoked_at = NOW() WHERE account_id = ?`,
      [resetRecord.account_id]
    );
    await dbExecute(
      `DELETE FROM auth_quick_tokens WHERE account_id = ?`,
      [resetRecord.account_id]
    );

    return NextResponse.json({
      ok: true,
      message: "Parola a fost resetată cu succes! Te poți conecta acum cu noua parolă.",
    });
  } catch (error) {
    console.error("[reset-password] API error:", error);
    return NextResponse.json(
      { error: "A apărut o eroare la salvarea noii parole." },
      { status: 500 }
    );
  }
}
