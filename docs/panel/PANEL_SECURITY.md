# PANEL_SECURITY.md — Threat Model, Security Controls & Audit Standards

This document establishes the threat model, mitigation controls, cryptographic requirements, and server-side authorization architecture for the FiveM companion web panel.

---

## 1. Threat Model & Mitigations

| Threat Vector | Attack Scenario | Mitigation in Web Panel | Verification / Test Case |
|---|---|---|---|
| **Credential Stuffing / Brute Force** | Automated dictionary attacks against `/api/auth/login` | 1. Sliding window rate limiter (max 5 failed attempts per IP per 5 minutes with exponential lockout).<br>2. Global IP rate limiting.<br>3. Timing-safe password comparisons.<br>4. Generic error messages (`auth.invalid_credentials`). | Unit & integration tests simulating rapid consecutive failed logins. |
| **Legacy Password Downgrade** | Exploiting obsolete unhashed/plaintext legacy password hashes on the web interface | The web verifier **strictly enforces `$scrypt$` hashes**. Any account with legacy hash formats is rejected on the web and directed to log in in-game or use a single-use `/webpin` code. | Test authenticating with legacy database rows confirms refusal with migration prompt. |
| **Session Fixation / Theft** | Stolen cookie or pre-generated session ID injected into client | 1. Session ID rotated immediately upon successful login.<br>2. Cookie flags: `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`.<br>3. Session secret stored hashed (`SHA-256`) in database.<br>4. User-Agent and IP subnet tracked on each request. | Test verifying session ID rotates upon authentication and after logout. |
| **Insecure Direct Object Reference (IDOR)** | Attacker changes `/players/122` or character payload ID to `123` to access or modify private data | 1. Server-side session resolution: `accountId` and `selectedCharacterId` are read exclusively from the verified server session, never from client input.<br>2. Ownership queries always include `WHERE account_id = ?` or `WHERE character_id IN (SELECT id FROM characters WHERE player_id = (SELECT id FROM players WHERE account_id = ?))`.<br>3. Public profile routes `/players/[id]` explicitly strip private fields (cash, bank, email, transactions, tokens). | Automated regression tests verifying user A cannot read user B's banking/vehicles/tickets. |
| **Cross-Site Request Forgery (CSRF)** | Malicious third-party website submits form to change password or vote | 1. Next.js Server Actions validate the `Host` and `Origin` headers.<br>2. Cookies configured with `SameSite=Lax`.<br>3. Custom anti-CSRF token validated on mutation endpoints. | Cross-origin POST request test verifying rejection. |
| **Cross-Site Scripting (XSS)** | Attacker puts `<script>alert(1)</script>` in support tickets, complaints, or clan MOTD | 1. React JSX automatic text escaping.<br>2. Strict HTML sanitization on any rich user-generated markdown.<br>3. Content Security Policy headers preventing unauthorized script execution.<br>4. No `dangerouslySetInnerHTML` on unvetted content. | Inputting script payloads in tickets/complaints renders as escaped text. |
| **SQL Injection** | Attacker injects `' OR 1=1 --` into player search or filter params | 1. Zero string concatenation in SQL queries.<br>2. 100% parameterized queries via prepared statements.<br>3. Input parameters strictly validated against Zod schemas prior to query execution. | Automated fuzzing tests with SQL injection payloads on search and filters. |
| **Vote Manipulation / Race Conditions** | Attacker sends parallel voting requests to vote multiple times in community polls | 1. Database-level unique constraint: `UNIQUE KEY (poll_id, account_id)`.<br>2. Voting logic executes within an ACID transaction (`START TRANSACTION` ... `COMMIT`).<br>3. Server-side eligibility validation (account age, playtime, level). | Parallel concurrent vote test verifying only one vote persists. |
| **Privilege Escalation** | Regular user crafts request to staff moderation endpoints | 1. RBAC checked server-side on every API route and server action.<br>2. Helper levels (1-3) and Admin levels (1-6) loaded from database and re-verified on every privileged request.<br>3. Client-provided roles or permissions are ignored. | Non-admin session calling staff endpoints receives `403 Forbidden`. |
| **Sensitive Data Exposure** | Database dumps or JSON responses containing IP addresses, discord IDs, or password hashes | 1. Strict DTO (Data Transfer Object) projection. No `SELECT *` serialized directly to React components.<br>2. Sensitive columns (`password_hash`, `password_salt`, `ip`, `token_hash`) are explicitly omitted. | Snapshot test verifying serialized player and account models contain zero secrets. |

---

## 2. Password Cryptography Specification

Modern account passwords in `trencito42/newrpg` are created and verified using the Node.js native `crypto.scryptSync` API in `resources/[sunset]/sunset_auth/server/password.js`.

The web panel implements the identical cryptographic routine:
- **Format:** `$scrypt$<N>$<r>$<p>$<salt_base64>$<derived_base64>`
- **Cost Parameters:** `N = 32768`, `r = 8`, `p = 1`, `maxmem = 67108864` (64 MB), `keyLength = 32 bytes`.
- **Comparison:** `crypto.timingSafeEqual` between derived key and stored key.
- **Random Token Generation:** `crypto.randomBytes(32).toString('base64url')` for link tokens and session IDs.

---

## 3. Server-Side Permission Matrix (RBAC)

Permissions are evaluated dynamically on the server:

```typescript
export interface UserSession {
  accountId: number;
  username: string;
  adminLevel: number;   // 0-6
  helperLevel: number;  // 0-3
  selectedCharacterId?: number;
  permissions: string[]; // From account_permissions
}
```

### Permission Gates
- **`account.self`**: Granted if `session.accountId === targetAccountId`.
- **`character.self`**: Granted if `targetCharacter.accountId === session.accountId`.
- **`helper.access`**: `session.helperLevel >= 1 || session.adminLevel >= 1`.
- **`admin.moderator`**: `session.adminLevel >= 2`.
- **`admin.full`**: `session.adminLevel >= 3`.
- **`admin.owner`**: `session.adminLevel >= 5`.
- **`sanction.view`**: Public for basic info; `session.helperLevel >= 1 || session.adminLevel >= 1` for staff details.
- **`unban.manage`**: `session.adminLevel >= 3`.
- **`poll.manage`**: `session.adminLevel >= 4`.

---

## 4. Security Headers Configuration

All responses from the web panel include the following security headers:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 5. Audit Trail Standards

Every privileged staff action executed on the panel writes an immutable record to `panel_audit_log`:

- **`actor_account_id`**: Authenticated staff account.
- **`actor_character_id`**: Active character ID (if selected).
- **`action`**: e.g., `ticket.close`, `unban.approve`, `poll.create`, `sanction.create`.
- **`target_entity`**: e.g., `account`, `character`, `poll`, `ticket`.
- **`target_id`**: Primary key of the affected entity.
- **`reason`**: Mandatory human-readable explanation.
- **`before_after`**: JSON diff of state transitions (passwords and secrets omitted).
- **`ip_address`**: Client IP address.
- **`created_at`**: UTC timestamp.
