# Domain Ownership

| Domain | Owner | Persistent Tables / Authority |
|---|---|---|
| Identity and Base Profile | `rpg_core` | `accounts`, `players`, `account_identifiers` |
| Live Registry & Lifecycle | `rpg_core` | In-memory player registry, lifecycle states, `sessions` |
| Base Level & XP Stats | `rpg_core` | `players.level`, `players.xp` |
| Economy & Currency | `rpg_economy` | `players.money`, `players.respect_points` |
| Factions | `rpg_factions` | `factions`, `players.faction_id`, `players.faction_leader` |
| Housing | `rpg_housing` | `houses` |
| Server Vehicles | `rpg_vehicles` | `server_vehicles`, server-created entity lifecycle |
| Auth UI & Session Client | `rpg_auth` | Client authentication flow |
| NUI & Central Focus | `rpg_ui` | Sole owner of NUI focus; notification & screen presentation |
| Chat Presentation | `rpg_chat` | Rate-limited player chat presentation |
| Spawn & Onboarding Flow | `rpg_spawn` | Onboarding scenes, server-issued single-use spawn entitlement tokens |
| Staff Tools & Sanctions | `rpg_admin` | `sanctions`, `sanction_identifiers`, `admin_actions`, `player_reports`, `newbie_questions` |
| Schema Migrations | `scripts/migrate.sh` | `schema_migrations` |

### Rules

1. **One domain owns every persistent table**: Modules never write directly into another domain's database tables.
2. **Canonical Service APIs**: Privileged admin commands invoke domain export APIs (`exports.rpg_economy`, `exports.rpg_factions`, `exports.rpg_housing`, `exports.rpg_vehicles`) rather than embedding raw SQL queries.
3. **Acyclic Dependency Flow**: Dependencies flow strictly downward from Core -> Framework -> Domain Modules -> Admin -> Chat.
4. **Server Authoritative State**: Client submits intent only; server validates permissions, states, and coordinates.
5. **No DB-Query-Per-Message Loops**: Broadcast systems (like faction leader chat `/lc` and global mute checks) utilize fast in-memory caches.
