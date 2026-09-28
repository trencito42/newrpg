# MVP Scope

### Included in Foundation:

- Username/password registration and login (10-128 char password policy, random salt scrypt).
- One account = one player, automatic profile, sex/model mapping.
- Private OneSync routing bucket isolation (`10000 + src`) with strict lockdown and population disabled during authentication and onboarding.
- Server-authoritative single-use spawn entitlement tokens (`initial_spawn`, `login_spawn`, `death_respawn`, `admin_respawn`).
- Authoritative position persistence (GetEntityCoords & GetEntityHeading updating player position table).
- Staggered periodic autosaves across the autosave interval.
- Central NUI focus exclusivity with visual recovery separated from gameplay protection.
- Minimal decoupled domain services providing clean boundaries for existing admin commands:
  - `rpg_economy`: Authoritative money & respect points mutation/query APIs.
  - `rpg_factions`: Minimal faction leader management with fast in-memory cache.
  - `rpg_housing`: Minimal house creation service.
  - `rpg_vehicles`: Server vehicle creation with orphan mode and occupant-safe respawn.
- Staff hierarchy (Admin Level 0-6, Helper Level 0-3), sanctions (warning 3-strike lifecycle with automatic ban consumption, kick, ban, ip_ban, mute, newbie_mute), DB audit trail.
- Fast cached mute checks and zero-DB-query faction leader chat.
- Structured logs, RPC engine with in-flight duplicate guards, and immutable migrations runner.

### Explicitly Excluded (Future Modules):
- Items/inventory, player jobs, owned vehicle garages/dealerships, businesses, mobile phone, crime/cops gameplay loops, casino, crafting, clans/turfs, character multi-slots, and appearance customization.
