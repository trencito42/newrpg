import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { z } from "zod";
import { dbQuerySingle } from "@/lib/db";
import { verifyScryptPassword, isModernScrypt } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
import { RowDataPacket } from "mysql2";
import { isSameOriginWrite } from "@/lib/request-security";

const loginSchema = z.object({
  // Matches sunset_auth/server/main.lua: 3–20 ASCII letters, digits or underscore.
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/),
  password: z.string().min(1).max(128),
});

const DUMMY_HASH = "$scrypt$32768$8$1$cGFuZWwtZHVtbXktc2FsdA==$cxsPVM9j9cWRkBJ7VNH0yNOm/yxSx0euUYdBlCUJuFY=";
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const attempts = new Map<string, { count: number; startedAt: number; lockedUntil: number }>();

interface AccountAuthRow extends RowDataPacket {
  id: number;
  password_hash: string;
}

function trustedClientIp(req: NextRequest): string | null {
  // Only use a header overwritten by the configured same-VPS reverse proxy.
  // Never accept arbitrary X-Forwarded-For values supplied by browsers.
  if (process.env.PANEL_TRUST_PROXY !== "1") return null;
  const ip = req.headers.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : null;
}

function isRateLimited(keys: string[], now: number): boolean {
  return keys.some((key) => {
    const value = attempts.get(key);
    return !!value && value.lockedUntil > now;
  });
}

function recordFailure(keys: string[], now: number): void {
  if (attempts.size > 1000) {
    for (const [key, value] of attempts) {
      if (value.lockedUntil <= now && now - value.startedAt > WINDOW_MS) attempts.delete(key);
    }
    while (attempts.size > 1000) attempts.delete(attempts.keys().next().value!);
  }
  for (const key of keys) {
    const previous = attempts.get(key);
    const fresh = !previous || now - previous.startedAt > WINDOW_MS;
    const count = fresh ? 1 : previous.count + 1;
    attempts.set(key, {
      count,
      startedAt: fresh ? now : previous.startedAt,
      lockedUntil: count >= (key === "global" ? 100 : key.startsWith("ip:") ? 20 : MAX_FAILURES) ? now + WINDOW_MS : 0,
    });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const username = parsed.data.username;
  const keys = ["global", `user:${username.toLowerCase()}`];
  const ip = trustedClientIp(req);
  if (ip) keys.push(`ip:${ip}`);
  const now = Date.now();
  if (isRateLimited(keys, now)) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  try {
    const account = await dbQuerySingle<AccountAuthRow>(
      "SELECT id, password_hash FROM accounts WHERE username = ? LIMIT 1",
      [username]
    );
    // The dummy hash keeps the expensive verification path identical for unknown users.
    const encoded = account && isModernScrypt(account.password_hash)
      ? account.password_hash : DUMMY_HASH;
    const valid = await verifyScryptPassword(parsed.data.password, encoded);
    if (!account || !isModernScrypt(account.password_hash) || !valid) {
      recordFailure(keys, now);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // A success clears this user/IP, not the global abuse budget.
    for (const key of keys) if (key !== "global") attempts.delete(key);
    await createSession(account.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
