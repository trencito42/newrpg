# PANEL_FEATURE_MAP.md — FiveM RPG Systems to Web Panel Feature Map

This document establishes the authoritative mapping between all gameplay systems discovered in `trencito42/newrpg` (workspace `htdocs/rpg.blipmade.com`) and their exposure, read/write permissions, and representation within the official companion web panel.

---

## 1. Domain Ownership & Architectural Principles

1. **FiveM is Single Source of Truth for Gameplay State:**
   In-memory player objects, active sessions, cash, bank, inventory, duty status, positions, and active vehicle instances are owned strictly by FiveM resources (`sunset_core`, `sunset_factions`, `sunset_vehicles`, etc.).
2. **Web Panel Ownership:**
   The panel exclusively owns web identity sessions, link tokens, community polls, support tickets, player complaints, unban requests, panel preferences, and web audit logs.
3. **Safe Reads vs. Safe Writes:**
   - **Reads:** Direct, index-backed SQL queries against game tables are safe when isolated to approved fields, non-sensitive columns, and correct tenant boundaries.
   - **Writes:** Direct SQL writes to gameplay state while a player may be online are strictly prohibited (would cause cache desynchronization or get overwritten on next autosave). Privileged gameplay actions must pass through an authenticated runtime bridge or be constrained to offline-safe procedures.
4. **Bi-lingual Foundation:**
   Every feature, column label, state badge, and notification supports **English (en)** and **Romanian (ro)**.

---

## 2. Discovered Systems Feature Matrix

| System Name | Responsible Resource | Database Tables | Authoritative Owner | Web Read | Web Write | Account / Character Relationship | Required Permission | Localization Notes | Panel Page Deserved | Missing Backend Capability / Bridge Needs |
|---|---|---|---|---|---|---|---|---|---|---|
| **Account & Identity** | `sunset_auth`, `sunset_core` | `accounts`, `auth_quick_tokens` | `sunset_auth` (auth/scrypt), `sunset_core` (session) | Safe (redacted: no raw hash/salt) | Safe for panel-owned credentials (passwords via scrypt, email, language) | Root entity (1 Account -> 0..N Characters) | `account.read.self`, `account.manage.self`, `admin.view` | `accounts.language` ('en'/'ro') stores user choice | `/account`, `/login`, `/security` | None. Native scrypt Node.js verification matches `sunset_auth/server/password.js`. |
| **Character Progression** | `sunset_core` | `characters`, `players` | `sunset_core` (in-memory + DB autosave) | Safe (public: level, RP, job; private: cash/bank) | UNSAFE directly from web. Must be read-only in v1. | 1 Account -> 1 Player -> 0..N Characters | Public: `player.read.public`. Self: `character.read.self`. Staff: `staff.character.read` | Job labels, nationality, status badges | `/players/[id]`, `/characters`, `/my-character` | Needs FiveM bridge if stat mutations are ever allowed from web. |
| **Civilian Jobs** | `sunset_jobs`, `sunset_core` | `job_progress` | `sunset_jobs` | Safe | Read-only | Character-specific (`character_id`, `job_id`) | Public: `player.read.public`. Self: `character.read.self` | Job labels & ranks translated | In Player Profile & `/jobs` directory | None. Full career stats (`xp`, `level`, `completed_tasks`, `total_earned`) exist in DB. |
| **Factions & Law Enforcement** | `sunset_factions`, `sunset_core` | `faction_membership`, `faction_leaders`, `faction_warnings`, `faction_motd`, `faction_punish`, `faction_resignations`, `faction_audit_log` | `sunset_factions` | Safe | Read-only in v1; resignations can be panel-owned | Character-specific (`characters.job`, `faction_membership.character_id`) | Public: `faction.read.public`. Leader: `faction.manage`. Staff: `staff.faction.admin` | All 10 factions, grade titles, MOTD | `/factions`, `/factions/[slug]`, `/my-character/faction` | In-game duty state is transient in memory. Roster and leadership history are in DB. |
| **Clans & Gangs** | `sunset_clans` | `clans`, `clan_members`, `clan_invites`, `clan_audit_log` | `sunset_clans` | Safe | Read-only in v1 | Character-specific (`clans.owner_character_id`, `clan_members.character_id`) | Public: `clan.read.public`. Member: `clan.read.self` | Tag colors, styles, ranks | In Player Profile & `/clans`, `/turfs` | None. Roster, MOTD, rank labels in DB. |
| **Turf Wars** | `sunset_turfs` | `turfs`, `turf_points`, `turf_connections` | `sunset_turfs` | Safe | Read-only | Clan-owned (`turfs.owner_clan_id`) | Public: `turfs.read.public` | Territory names, status | `/turfs` (Interactive SVG/Leaflet turf map) | Active war timers are in memory; ownership, payout, polygon coordinates are persisted in DB. |
| **Personal Vehicles** | `sunset_vehicles` | `vehicles` | `sunset_vehicles` | Safe (parse props JSON for visual attributes) | UNSAFE directly from web. Read-only. | Character-owned (`vehicles.character_id`) | Self: `vehicle.read.self`. Staff: `staff.vehicle.read` | Model names, garage labels, insurance states | `/my-character/vehicles`, Player Profile (summary) | Direct position / stored toggle cannot be changed while server runs without runtime despawn bridge. |
| **Vehicle Impound** | `sunset_impound` | `impounded_vehicles` | `sunset_impound` | Safe | Read-only in v1 | Character & Vehicle bound | Self: `vehicle.read.self`. Staff: `staff.impound.manage` | Impound reasons, statuses ('impounded', 'released', 'sold') | In Vehicles tab & Staff sanctions | None. Full history with fees and timestamps exists. |
| **Properties & Housing** | `sunset_properties` | `properties`, `property_rentals` | `sunset_properties` | Safe | Read-only in v1 | Character-owned (`owner_character_id`) or rented (`property_rentals`) | Public: `property.read.public`. Self: `property.read.self` | Interior types, rental states | `/properties`, `/my-character/properties`, Player Profile | None. Locations, prices, rental tiers are in DB. |
| **Player Businesses** | `sunset_businesses` | `player_businesses` | `sunset_businesses` | Safe | Read-only in v1 | Character-owned (`owner_character_id`) | Public: `business.read.public`. Self: `business.read.self` | Business type, catalog names | `/businesses`, Player Profile | Balance withdrawal occurs in-game. |
| **Staff & Administration** | `sunset_admin`, `sunset_core` | `accounts`, `admins`, `helpers`, `account_permissions` | `sunset_admin` | Safe | Only web permissions / panel audit writable | Account bound (`admin_level`, `helper_level`) | Public: `staff.read.public`. Staff: `staff.dashboard.access` | Level titles (Helper 1-3, Admin 1-6) | `/staff`, `/staff/dashboard` | None. Role hierarchy strictly mirrors server config. |
| **Admin Sanctions & Bans** | `sunset_admin` | `admin_sanctions`, `bans`, `ban_tokens`, `admin_action_log` | `sunset_admin` | Safe (public: player name, action, reason, date; private: token/IP) | Panel can manage unban requests; actual unban via bridge or panel-managed DB write | Target account/character | Public: `sanctions.read.public`. Staff: `staff.sanction.read/manage` | Sanction action types ('warn', 'kick', 'tempban', 'ban', 'jail') | `/sanctions`, Player Profile, Staff Area | None. Rich history in `admin_sanctions` and `bans`. |
| **Character Licenses** | `sunset_licenses` | `character_licenses`, `lssi_exam_reports` | `sunset_licenses` | Safe | Read-only | Character-specific (`character_licenses.character_id`) | Self: `license.read.self`. Public: in profile | License types (driver, weapon, boat, pilot, hunting) | In Player Profile & `/my-character/licenses` | Payday-based expiry calculation matches `expires_at_payday`. |
| **Missions & Contracts** | `sunset_missions` | `sunset_mission_reputation`, `sunset_mission_history`, `sunset_mission_cooldowns` | `sunset_missions` | Safe | Read-only | Character-specific | Self: `mission.read.self`. Public: reputation summary | Contact names, mission codes | In Player Profile & `/my-character/missions` | None. Full completed history and reputation are stored. |
| **Fishing Tournament** | `sunset_fishing_tournament` | `fishing_tournament_history`, `fishing_tournament_rewards` | `sunset_fishing_tournament` | Safe | Read-only | Character-specific | Public: `stats.fishing.read` | Item names, rank podiums | In `/stats/fishing` & Player Profile | None. Historic leaderboards and biggest catches in DB. |
| **Marriage / Partners** | `sunset_marriage` | `marriages` | `sunset_marriage` | Safe | Read-only | Character pair (`partner1_id`, `partner2_id`) | Public: in profile if active | Marriage status ('active', 'divorced') | In Player Profile | None. Clean relationship model in DB. |
| **CNN Advertisements** | `sunset_cnn` | `cnn_ads`, `cnn_ad_mutes` | `sunset_cnn` | Safe | Read-only | Character-specific | Public: `ads.read.public`. Self: `ads.read.self` | Statuses ('pending', 'approved', 'published') | `/ads`, `/my-character/ads` | None. Complete text, price paid, reviewer logs in DB. |
| **Economy Ledger & Payday** | `sunset_core`, `sunset_economy` | `money_transactions`, `payday_runs`, `societies` | `sunset_core` | Safe (private to character owner and staff) | Read-only | Character-specific (`money_transactions.character_id`) | Self: `banking.read.self`. Staff: `staff.audit.money` | Transaction reasons, categories | `/my-character/banking`, Staff Audit | None. Atomic ledger with `balance_after` exists in DB. |
| **Community Polls** | *New Panel System* | `panel_polls`, `panel_poll_options`, `panel_poll_votes` | Panel Backend | Safe | Safe (transactional vote submission) | Account-bound (1 Vote per Account) | Public: `poll.read.public`. Authenticated: `poll.vote`. Staff: `poll.manage` | Poll titles, options, countdown | `/polls`, `/polls/[id]`, Homepage featured | Added via panel migration with strict DB uniqueness invariant. |
| **Support Helpdesk** | *New Panel System* | `panel_support_tickets`, `panel_ticket_messages` | Panel Backend | Safe | Safe (create/reply tickets) | Account & Character bound | Self: `ticket.manage.self`. Staff: `ticket.manage.staff` | Department names, priorities, statuses | `/support/tickets`, `/staff/tickets` | Completely separate from in-game traffic citations table (`tickets`). |
| **Player Complaints** | *New Panel System* | `panel_complaints`, `panel_complaint_messages` | Panel Backend | Safe (sanitized user content) | Safe (create/reply complaints) | Accused & Accuser accounts | Self/Accused: `complaint.read`. Staff: `complaint.manage` | Reason types, verdict statuses | `/support/complaints`, `/staff/complaints` | Added via panel migration. |
| **Unban Appeals** | *New Panel System* | `panel_unban_requests` | Panel Backend | Safe | Safe (submit appeal) | Banned account/license bound | Self: `appeal.submit`. Staff: `appeal.manage` | Appeal statuses ('pending', 'accepted', 'rejected') | `/support/unban`, `/staff/unbans` | Added via panel migration. |
| **Server Live Heartbeat** | `sunset_core` + Panel Bridge | In-memory / HTTP bridge / snapshot table | FiveM Engine | Safe | Read-only | Global Server Metric | Public: `server.status.read` | Online count, server uptime, uptime status | Header status badge, Homepage stats | Read from FiveM internal query or periodic snapshot cache. |

---

## 3. Account vs. Character Privacy Boundary

| Information | Public View (`/players/[id]`) | Account Owner (`/my-character/*`) | Staff View (`/staff/*`) |
|---|---|---|---|
| Username | Yes | Yes | Yes |
| First & Last Name | Yes | Yes | Yes |
| Level & Respect Points | Yes | Yes | Yes |
| Job & Grade | Yes | Yes | Yes |
| Faction & Rank | Yes | Yes | Yes |
| Clan & Tag | Yes | Yes | Yes |
| Playing Hours / Paydays | Yes | Yes | Yes |
| Public Sanction History (Warns, Bans) | Yes (without IP/Token) | Yes | Yes (full details, admin name, token hash) |
| Owned Vehicles (Model, Plate) | Summary count only | Full details, garage, insurance | Full details, garage, impound status |
| Properties Owned | Yes (house address/label) | Full details, rent status | Full details, tenants |
| Cash & Bank Balance | **Hidden** | **Visible** | **Visible** (staff permission) |
| Inventory & Contraband | **Hidden** | **Visible** (sanitized view) | **Visible** (staff permission) |
| Money Transaction History | **Hidden** | **Visible** | **Visible** |
| Account Email | **Hidden** | **Visible** (masked e.g. s***@xodo.ro) | **Visible** (admin level ≥ 4) |
| IP Address & Hardware Tokens | **Hidden** | **Hidden** | **Visible** (admin level ≥ 4) |
| Anticheat Flags & Strikes | **Hidden** | **Hidden** | **Visible** (staff only) |
