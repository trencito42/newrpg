import { cookies, headers } from "next/headers";
import { cache } from "react";
import { dbQuery, dbQuerySingle, dbExecute } from "./db";
import { generateRandomToken, hashTokenSha256 } from "./crypto";
import { UserSession } from "./types";
import { RowDataPacket } from "mysql2";
import { SESSION_COOKIE_NAME, LOCALE_COOKIE_NAME, SESSION_DURATION_DAYS } from "./constants";

export { SESSION_COOKIE_NAME, LOCALE_COOKIE_NAME, SESSION_DURATION_DAYS };

interface SessionDbRow extends RowDataPacket {
  session_id: number;
  account_id: number;
  username: string;
  email: string | null;
  language: string;
  admin_level: number;
  helper_level: number;
  is_author: number;
  selected_character_id: number | null;
  firstname: string | null;
  lastname: string | null;
  expires_at: string;
  last_active_at: Date | string;
  revoked_at: string | null;
}

/**
 * Retrieves the current authenticated user session from the secure cookie.
 * Validates against panel_web_sessions and joins accounts + active character.
 */
export const getCurrentSession = cache(async (): Promise<UserSession | null> => {
  const tokenHash = await getCurrentSessionTokenHash();
  if (!tokenHash) return null;

  const row = await dbQuerySingle<SessionDbRow>(
    `SELECT 
       s.id AS session_id,
       s.account_id,
       a.username,
       a.email,
       a.language,
       a.admin_level,
       a.helper_level,
       COALESCE(a.is_author, 0) AS is_author,
       s.selected_character_id,
       c.firstname,
       c.lastname,
       s.expires_at,
       s.last_active_at,
       s.revoked_at
     FROM panel_web_sessions s
     JOIN accounts a ON a.id = s.account_id
     LEFT JOIN characters c ON c.id = s.selected_character_id
     WHERE s.token_hash = ? 
       AND s.revoked_at IS NULL 
       AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (!row) {
    return null;
  }

  // If no character was explicitly selected, auto-select their first/main character
  let selectedCharId = row.selected_character_id;
  let selectedCharName = row.firstname
    ? `${row.firstname} ${row.lastname || ""}`.trim()
    : null;

  if (!selectedCharId) {
    interface FirstCharRow extends RowDataPacket {
      id: number;
      firstname: string;
      lastname: string;
    }
    const firstChar = await dbQuerySingle<FirstCharRow>(
      `SELECT c.id, c.firstname, c.lastname 
       FROM characters c
       JOIN players p ON p.id = c.player_id
       WHERE p.account_id = ?
       ORDER BY c.level DESC, c.slot ASC
       LIMIT 1`,
      [row.account_id]
    );

    if (firstChar) {
      selectedCharId = firstChar.id;
      selectedCharName = `${firstChar.firstname} ${firstChar.lastname || ""}`.trim();
      // Silently update session with default character
      await dbExecute(
        "UPDATE panel_web_sessions SET selected_character_id = ? WHERE id = ?",
        [selectedCharId, row.session_id]
      );
    }
  }

  // Read once per server request and persist activity at most once per ten minutes.
  if (Date.now() - new Date(row.last_active_at).getTime() >= 10 * 60 * 1000) {
    await dbExecute("UPDATE panel_web_sessions SET last_active_at = NOW() WHERE id = ? AND last_active_at < NOW() - INTERVAL 10 MINUTE", [row.session_id]);
  }

  const lang = row.language === "ro" ? "ro" : "en";

  return {
    accountId: row.account_id,
    username: row.username,
    email: row.email,
    language: lang,
    adminLevel: Number(row.admin_level) || 0,
    helperLevel: Number(row.helper_level) || 0,
    isAuthor: Boolean(row.is_author),
    selectedCharacterId: selectedCharId ? Number(selectedCharId) : null,
    selectedCharacterName: selectedCharName,
  };
});

/** Hashes the HttpOnly cookie server-side; never return its raw value in a session DTO. */
export async function getCurrentSessionTokenHash(): Promise<string | null> {
  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return rawToken && rawToken.length >= 32 ? hashTokenSha256(rawToken) : null;
}

/**
 * Creates a new authenticated web session for the account.
 */
export async function createSession(accountId: number): Promise<void> {
  const rawToken = generateRandomToken(32);
  const tokenHash = hashTokenSha256(rawToken);

  const headerList = await headers();
  const userAgent = headerList.get("user-agent")?.substring(0, 255) || "Unknown";
  // Only use a proxy-provided address when the deployment explicitly trusts
  // its loopback reverse proxy to overwrite X-Real-IP.
  const ipAddress = process.env.PANEL_TRUST_PROXY === "1"
    ? (headerList.get("x-real-ip")?.substring(0, 45) || null)
    : null;

  // Check user's main character for default selection
  interface MainCharRow extends RowDataPacket {
    id: number;
  }
  const mainChar = await dbQuerySingle<MainCharRow>(
    `SELECT c.id 
     FROM characters c
     JOIN players p ON p.id = c.player_id
     WHERE p.account_id = ?
     ORDER BY c.level DESC, c.slot ASC
     LIMIT 1`,
    [accountId]
  );

  const defaultCharId = mainChar ? mainChar.id : null;

  await dbExecute(
    `INSERT INTO panel_web_sessions 
       (account_id, token_hash, selected_character_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [accountId, tokenHash, defaultCharId, ipAddress, userAgent, SESSION_DURATION_DAYS]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });

}

/**
 * Revokes the current session and clears the cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashTokenSha256(rawToken);
    await dbExecute(
      "UPDATE panel_web_sessions SET revoked_at = NOW() WHERE token_hash = ?",
      [tokenHash]
    );
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Changes active selected character for the current session.
 * Verifies character ownership before applying change.
 */
export async function switchSelectedCharacter(
  characterId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Not logged in" };

  interface OwnershipRow extends RowDataPacket {
    id: number;
  }
  const verified = await dbQuerySingle<OwnershipRow>(
    `SELECT c.id 
     FROM characters c
     JOIN players p ON p.id = c.player_id
     WHERE c.id = ? AND p.account_id = ?
     LIMIT 1`,
    [characterId, session.accountId]
  );

  if (!verified) {
    return { success: false, error: "Character does not belong to this account" };
  }

  const tokenHash = await getCurrentSessionTokenHash();
  if (!tokenHash) return { success: false, error: "Not logged in" };
  await dbExecute(
    "UPDATE panel_web_sessions SET selected_character_id = ? WHERE token_hash = ?",
    [characterId, tokenHash]
  );

  return { success: true };
}

/**
 * Returns current viewer locale ('en' or 'ro'), resolved from:
 * 1. Authenticated user preference
 * 2. Cookie override
 * 3. Default: 'en'
 */
export async function getViewerLocale(): Promise<"en" | "ro"> {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLang === "ro" || cookieLang === "en") {
    return cookieLang;
  }

  const session = await getCurrentSession();
  if (session && (session.language === "ro" || session.language === "en")) {
    return session.language;
  }

  return "en";
}

/**
 * Server-side RBAC authorization check.
 */
export function isStaff(session: UserSession | null): boolean {
  if (!session) return false;
  return session.adminLevel >= 1 || session.helperLevel >= 1;
}

export function isAdmin(session: UserSession | null, minLevel = 1): boolean {
  if (!session) return false;
  return session.adminLevel >= minLevel;
}

export function isHelper(session: UserSession | null, minLevel = 1): boolean {
  if (!session) return false;
  return session.helperLevel >= minLevel || session.adminLevel >= 1;
}

export const getCurrentUser = getCurrentSession;
export const getRequestLanguage = getViewerLocale;
