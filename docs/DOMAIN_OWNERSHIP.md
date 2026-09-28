# Domain ownership

| Domain | Owner | Persistent tables/state |
|---|---|---|
| Identity and base profile | `rpg_core` | `accounts`, `players`, `account_identifiers` |
| Live player/session registry | `rpg_core` | registry, lifecycle, `sessions` |
| Base level/XP/playtime stats | `rpg_core` | columns on `players` |
| Auth UI/protocol | `rpg_auth` | none; calls core identity API |
| NUI/focus/notifications | `rpg_ui` | one focus owner; no tables |
| Chat/command input | `rpg_chat` | rate/history presentation; no tables |
| Spawn/onboarding | `rpg_spawn` | configured scenes/spawn; tutorial mutation through core API |
| Staff/sanctions/audit | `rpg_admin` | `sanctions`, `sanction_identifiers`, `admin_actions`; transient duty/freeze/spectate/back |
| Migrations | deployment runner | `schema_migrations` |

Rules:

1. One domain owns every persistent value.
2. Modules never write another module's tables. The deliberate exception is an atomic staff-level transaction: `rpg_admin` updates the core-owned account level and its own audit row together, then asks core to refresh cache.
3. Core contains no gameplay implementation.
4. The client is never authoritative.
5. Hard dependencies are acyclic.
6. Runtime resources do not create or alter schema.
7. Every command returns feedback.
8. Important staff mutations are DB-audited.
9. Parameters are bound and multi-row invariants are transactional.
10. Extensions use exports and documented internal events, never implementation files.

