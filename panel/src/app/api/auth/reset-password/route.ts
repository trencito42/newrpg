import { getViewerLocale } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { dbQuerySingle, dbExecute } from "@/lib/db";
import { hashTokenSha256, hashScryptPassword } from "@/lib/crypto";
import { RowDataPacket } from "mysql2";
import { t } from "@/lib/i18n";


interface ResetRow extends RowDataPacket {
  reset_id: number;
  account_id: number;
  username: string;
}

export async function POST(request: NextRequest) {
  const locale = await getViewerLocale();
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "").trim();
    const confirmPassword = String(body.confirmPassword || "").trim();

    if (!token) {
      return NextResponse.json(
        { error: t(locale, "interface.the_reset_token_is_missing_or_invalid") },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: t(locale, "interface.the_new_password_must_contain_at_least_6_characters") },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: t(locale, "auth.reset_error_mismatch") },
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
        { error: t(locale, "interface.the_reset_link_is_invalid_or_expired_valid_for_30_minutes_request_a_new_one") },
        { status: 400 }
      );
    }

    const newHash = hashScryptPassword(password);
    if (!newHash) {
      return NextResponse.json(
        { error: t(locale, "interface.could_not_securely_encrypt_your_password") },
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
      message: t(locale, "interface.password_reset_successfully_you_can_now_log_in_with_your_new_password"),
    });
  } catch (error) {
    console.error("[reset-password] API error:", error);
    return NextResponse.json(
      { error: t(locale, "interface.could_not_save_your_new_password") },
      { status: 500 }
    );
  }
}
