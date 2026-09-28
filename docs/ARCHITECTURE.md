# Architecture

## Dependency Direction (Acyclic DAG)

```text
oxmysql -> bob74_ipl -> rpg_core -> rpg_ui -> rpg_auth -> rpg_spawn
                                                          |
                      +-------------------+---------------+-------------------+
                      |                   |               |                   |
                      v                   v               v                   v
                 rpg_economy         rpg_factions    rpg_housing         rpg_vehicles
                      |                   |               |                   |
                      +-------------------+---------------+-------------------+
                                                  |
                                                  v
                                              rpg_admin
                                                  |
                                                  v
                                              rpg_chat
```

`rpg_core` owns infrastructure and the base player lifecycle profile: authoritative registry, identity, lifecycle state machine, RPC engine, command authorization, base level/XP stats, session finalization, and logging.

Domain operations are decoupled into minimal canonical domain services:
- `rpg_economy`: Authoritative money and respect points mutation/query APIs.
- `rpg_factions`: Authoritative faction leadership management and in-memory leader state cache.
- `rpg_housing`: Authoritative house creation and query services.
- `rpg_vehicles`: Server-created vehicles, entity orphan modes, occupancy verification, and safe respawn loops.
- `rpg_admin`: Staff permissions, duty toggles, sanctions, support tickets/questions, spectator/teleport management, consuming domain APIs without owning gameplay tables directly.

## Player Lifecycle & Private Routing Context

```text
connected (private bucket) -> authenticating -> authenticated -> onboarding -> spawning -> active (bucket 0)
                                                                    |              ^          |
                                                                    +--------------+----------+
any state -> disconnecting
```

- When a player connects, `rpg_core` isolates the client in a private routing bucket (`10000 + src`) with population disabled (`SetRoutingBucketPopulationEnabled(bucket, false)`) and strict entity lockdown (`SetRoutingBucketEntityLockdownMode(bucket, 'strict')`).
- Unauthenticated and onboarding players do not exist in the public world (bucket 0), cannot see or interact with active players, and onboarding cinematic camera movements do not replicate entity coordinates into the public instance.
- Moving to public routing bucket 0 occurs strictly upon server-authorized `spawn.activate`.

## Spawn Entitlement Authority

- Spawning requires a server-issued, single-use, time-limited entitlement token.
- Entitlement reasons: `initial_spawn`, `login_spawn`, `death_respawn`, `admin_respawn`.
- A client in `active` state cannot arbitrarily invoke `spawn.prepare` without a valid server entitlement.
- `spawn.prepare(token)` validates the entitlement, transitions state to `spawning`, and supplies verified coordinates.
- `spawn.activate(token)` consumes the entitlement token, transitions state to `active`, and moves the player to routing bucket 0.

## Authoritative Registry & Persistence

- The player registry is indexed separately by server source and account ID.
- Public snapshots are copies; external resources cannot mutate internal tables directly.
- Position persistence authoritative fix: Authoritative ped coordinates and heading from `GetEntityCoords` and `GetEntityHeading` update `player.position` before persistence to the database, guarding against (0,0,0) overwrite during streaming transit.
- Periodic saves are staggered across the autosave window to prevent synchronous database spikes.

## RPC Engine & In-Flight Guards

- Unique request IDs with client-side timeout cleanup and server-side exception isolation.
- Per-source in-flight operation protection prevents concurrent duplicate mutation invocations (e.g. rapid double login/register or double spawn activation).
- Standardized response envelope `{ ok: boolean, data?: any, error?: string, code?: string }`.

## UI & Focus Exclusivity

- `rpg_ui` exclusively manages `SetNuiFocus` and `SetNuiFocusKeepInput`.
- Focus has strict ownership exclusivity (`AcquireFocus(owner)`, `ReleaseFocus(owner)`, `ForceResetFocus(reason)`).
- `/fixscreen` resets visual state (NUI focus, blur, cameras, timecycles) but preserves gameplay protection (freeze, invulnerability, visibility, input disabling) if the client is not server-side `active`.
