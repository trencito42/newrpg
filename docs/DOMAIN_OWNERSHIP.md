# Domain ownership

| Domain | Owner | Persistent tables/state |
|---|---|---|
| Identity and base profile | `rpg_core` | `accounts`, `players`, `account_identifiers` |
| Live player/session registry | `rpg_core` | registry, lifecycle, `sessions` |
| Base level/XP/money/RP/playtime stats | `rpg_core` | columns on `players` |
| Auth UI/protocol | `rpg_auth` | none; calls core identity API |
| NUI/focus/notifications | `rpg_ui` | one focus owner; no tables |
| Chat/command input | `rpg_chat` | rate/history presentation; no tables |
| Spawn/onboarding | `rpg_spawn` | configured scenes/spawn; tutorial mutation through core API |
| Staff/support/audit | `rpg_admin` | `sanctions`, `sanction_identifiers`, `admin_actions`, `player_reports`, `newbie_questions` |
| Provisional world administration | `rpg_admin` | `factions`, `houses`, `server_vehicles`; transient entities/marks/duty/freeze/spectate |
| Migrations | deployment runner | `schema_migrations` |

Rules:

1. One domain owns every persistent value.
2. Modules normally never write another module's tables. Deliberate staff exceptions are audited admin/helper, leader, money/RP, and stat mutations; core refreshes affected live cache.
3. Core contains identity and base persistent values; full gameplay domains remain separate future resources.
4. The client is never authoritative.
5. Hard dependencies are acyclic.
6. Runtime resources do not create or alter schema.
7. Every command returns feedback.
8. Important staff mutations are DB-audited.
9. Parameters are bound and multi-row invariants are transactional.
10. Extensions use exports and documented internal events, never implementation files.
