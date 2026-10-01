# PANEL_ARCHITECTURE.md — System Architecture & Data Ownership

This document defines the architectural blueprints, component topology, runtime bridges, data access patterns, and ownership boundaries for the official FiveM RPG companion web panel.

---

## 1. System Topology & Technology Stack

```
   [ Web Browser / Mobile User ]
                 │ (HTTPS)
                 ▼
       [ Cloudflare / Reverse Proxy ]
                 │
                 ▼
     [ Next.js App Router (Node.js 22) ]
     ├── React Server Components (Default)
     ├── Client Components (Interactive islands only)
     ├── Tailwind CSS (Restrained, responsive design system)
     ├── Zod (Boundary validation)
     ├── Session Manager (Opaque secure cookies)
     ├── Scrypt Native Verifier (1:1 with sunset_auth)
     └── Data Access Layer (Typed parameterized SQL)
           │                        │
           ▼                        ▼
    [ MySQL / MariaDB ]     [ FiveM Runtime Server ]
    ├── Game Tables (Read)   ├── `sunset_core` (In-memory player state)
    └── Panel Tables (R/W)   ├── `sunset_auth` (In-game quick login)
                             └── `sunset_panel_bridge` (Privileged bridge)
```

### Core Technologies
- **Framework:** Next.js 15+ (App Router), React 19.
- **Rendering Model:** Server Components by default. Streaming Suspense boundaries with matching skeletons. Client components strictly where interaction (stateful forms, countdowns, tabs) is mandatory.
- **Language:** TypeScript in strict mode (`noImplicitAny`, `strictNullChecks`).
- **Styling:** Vanilla CSS + Tailwind CSS tokens. Mobile-first design system with zero horizontal scroll from 320px up to 4K displays.
- **Data Access:** Parameterized SQL queries using connection pooling (`mysql2/promise`), strongly typed DTOs, and deterministic pagination.
- **Caching:** Short-lived stale-while-revalidate for public statistics, precomputed metric snapshots (`panel_stat_snapshots`), and private cache isolation.

---

## 2. Data Ownership Matrix

The FiveM server and Web Panel share the MariaDB instance, but **their write authority is strictly partitioned**:

| Domain | FiveM Server Authority | Panel Web Application Authority | Safety Rule |
|---|---|---|---|
| **Accounts** (`accounts`) | Creates rows on registration; updates passwords & language in-game. | Reads account status; safely updates language and web-initiated password changes (via scrypt). | **Safe:** Account credentials can be updated when verified; invalidates all existing active web sessions. |
| **Characters** (`characters`) | **Exclusive runtime authority** for cash, bank, position, appearance, job, level, XP, respect points, metadata, death state. | **Strictly Read-Only**. Direct web writes are strictly forbidden. | **CRITICAL:** If character is online, `sunset_core` memory cache would overwrite any web UPDATE on next autosave. |
| **Vehicles & Garage** (`vehicles`) | **Exclusive runtime authority** for stored status, engine health, fuel, location, modifications. | **Strictly Read-Only**. Direct web writes are strictly forbidden. | Prevents spawning duplicate entities or desynchronizing vehicle net-IDs. |
| **Properties & Rentals** (`properties`, `property_rentals`) | In-game lock states, rent payday transactions, interior coordination. | **Strictly Read-Only** in v1. | Prevents eviction or double-purchase races while landlord is in-game. |
| **Factions & Leadership** (`faction_*`) | Duty toggles, in-game invites, ranks, radios, armory. | Reads rosters, statistics, MOTD, warnings. Resignations handled via panel queue. | Prevents granting faction perks to active in-game players without dispatch sync. |
| **Sanctions & Bans** (`bans`, `admin_sanctions`) | In-game bans, kicks, warnings, jail sentences. | Reads public sanctions. Staff area can log web-sanctions and review unban requests. | Unbans execute through transactional DB queries verified against active licenses. |
| **Web Sessions** (`panel_web_sessions`) | None. | **Exclusive Owner**. | Manages active logins, IP metadata, user-agent, last seen, revocation. |
| **Account Link Tokens** (`panel_link_tokens`) | Generates or validates in-game one-time link codes. | Generates and redeems one-time login / migration codes. | Single-use, cryptographically secure (32 bytes), 5-minute TTL. |
| **Community Polls** (`panel_polls`, `panel_poll_options`, `panel_poll_votes`) | None. | **Exclusive Owner**. | Guaranteed single-vote per account enforced by `UNIQUE(poll_id, account_id)`. |
| **Support Helpdesk** (`panel_support_tickets`, `panel_ticket_messages`) | None (game `tickets` is traffic fines). | **Exclusive Owner**. | Full ticketing lifecycle, departments, priorities, staff assignment. |
| **Player Complaints** (`panel_complaints`, `panel_complaint_messages`) | None. | **Exclusive Owner**. | Multi-party complaint discussion with staff resolution workflow. |
| **Unban Appeals** (`panel_unban_requests`) | None. | **Exclusive Owner**. | Ban appeal system tied to `bans` records. |
| **Web Audit Log** (`panel_audit_log`) | None. | **Exclusive Owner**. | Immutable log of every staff web action. |

---

## 3. FiveM Runtime Bridge Architecture

For operations where FiveM state must be inspected or influenced (e.g., checking real-time online status or executing safe staff actions), the system utilizes:

1. **Lightweight Internal HTTP Bridge (`sunset_panel_bridge`):**
   - FiveM resource listening on `127.0.0.1:30121` (or local unix socket / loopback port).
   - Authenticated with a cryptographically strong bearer secret: `PANEL_BRIDGE_TOKEN`.
   - Never exposed to the public Internet; bound to localhost only.
   - Provides endpoints:
     - `GET /api/status`: Active player count, server uptime, resource states.
     - `GET /api/players/online`: List of active server IDs, ping, and character IDs.
     - `POST /api/player/kick`: Privileged kick with reason and audit trail.
     - `POST /api/broadcast`: Server-wide announcement.
2. **Fallback Database Polling / Snapshot Layer:**
   - If FiveM is restarting or unreachable, the web panel gracefully degrades to cached snapshots in `panel_stat_snapshots`.
   - The panel never hangs, throws 500 errors, or fakes numbers when FiveM is offline.

---

## 4. Database User & Credential Separation

In production, two separate database accounts are recommended:

1. `panel_runtime`:
   - `SELECT` on: `accounts`, `players`, `characters`, `vehicles`, `impounded_vehicles`, `properties`, `property_rentals`, `player_businesses`, `job_progress`, `faction_*`, `clans`, `clan_*`, `turfs`, `turf_*`, `admins`, `helpers`, `bans`, `admin_sanctions`, `admin_action_log`, `character_licenses`, `sunset_mission_*`, `fishing_tournament_*`, `marriages`, `cnn_ads`, `money_transactions`, `payday_runs`, `tickets`.
   - `SELECT, INSERT, UPDATE, DELETE` on: `panel_web_sessions`, `panel_link_tokens`, `panel_polls`, `panel_poll_options`, `panel_poll_votes`, `panel_support_tickets`, `panel_ticket_messages`, `panel_complaints`, `panel_complaint_messages`, `panel_unban_requests`, `panel_audit_log`, `panel_stat_snapshots`, `panel_preferences`.
   - `UPDATE (password_hash, password_salt, email, language)` on `accounts`.
2. `panel_migrator`:
   - Dedicated schema management user for applying additive migrations.
   - Never used by the runtime web process.

---

## 5. Authentication & Session Strategy

- **Password Verification:** Exact compatibility with `sunset_auth/server/password.js`. Computes `crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 67108864 })` and performs constant-time comparison `crypto.timingSafeEqual`.
- **Legacy Account Migration:** Old plaintext/salt passwords are **rejected** by the web login form to prevent web brute force attacks. Legacy players must either log in once in FiveM (which automatically upgrades their hash to modern scrypt) or redeem a one-time in-game `/webpin` code.
- **Session Tokens:** 256-bit cryptographically random tokens stored hashed (`SHA-256`) in `panel_web_sessions`. Plaintext token exists only in the client's `HttpOnly`, `SameSite=Lax`, `Secure` cookie.
- **Session Lifecycle:**
  - Token rotated on login, character switch, and privilege changes.
  - Revocable per-session or globally ("Logout all other sessions").
  - 14-day inactivity sliding expiration.
