import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbQuerySingle } from "@/lib/db";
import { verifyScryptPassword, isModernScrypt } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
import { RowDataPacket } from "mysql2";

// In-memory rate limiting map for login brute-force protection
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

const loginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(1).max(128),
});

interface AccountAuthRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Check rate limit
  const now = Date.now();
  const attempt = failedLogins.get(ip);
  if (attempt && attempt.lockedUntil > now) {
    const remainingSec = Math.ceil((attempt.lockedUntil - now) / 1000);
    return NextResponse.json(
      {
        error: "too_many_attempts",
        remainingSec,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const { username, password } = parsed.data;

    const account = await dbQuerySingle<AccountAuthRow>(
      "SELECT id, username, password_hash, password_salt FROM accounts WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [username]
    );

    if (!account) {
      // Record failed attempt
      recordFailedLogin(ip);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // Modern scrypt security check:
    // DO NOT accept insecure legacy plaintext/equality fallback from the public web.
    if (!isModernScrypt(account.password_hash)) {
      return NextResponse.json(
        {
          error: "legacy_unsupported",
          message:
            "This account uses a legacy password format. Please log in to the FiveM server once or generate an in-game /webpin code to safely access the web panel.",
        },
        { status: 403 }
      );
    }

    // Verify scrypt hash timing-safely
    const isValid = verifyScryptPassword(password, account.password_hash);
    if (!isValid) {
      recordFailedLogin(ip);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // Success: clear failed counter and issue authenticated session
    failedLogins.delete(ip);
    await createSession(account.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function recordFailedLogin(ip: string) {
  const current = failedLogins.get(ip) || { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= 5) {
    // 5 failures -> 5 minute lockout
    current.lockedUntil = Date.now() + 5 * 60 * 1000;
  }
  failedLogins.set(ip, current);
}
