# Architecture

## Dependency direction

```text
oxmysql -> rpg_core -> rpg_ui -> rpg_auth
                     -> rpg_spawn -> rpg_admin -> rpg_chat
```

`rpg_core` owns infrastructure and the small base profile: authoritative registry, identity, lifecycle, RPC, command authorization, base stats/currency, session finalization, and logs. Staff support and provisional world administration live in `rpg_admin` until full gameplay resources replace those boundaries.

Resources register stable callbacks and commands through exports. Server-internal lifecycle broadcasts use `AddEventHandler`/`TriggerEvent`, not network events. Network events exist only where a client must send intent or receive presentation instructions.

## Player lifecycle

```text
connected -> authenticating -> authenticated -> onboarding -> spawning -> active
                                      |              ^          |
                                      +--------------+----------+
any state -> disconnecting
```

Transitions are checked server-side. Login/onboarding uses a private OneSync routing bucket with strict entity lockdown and population disabled. The server changes the player to bucket 0 only after profile/tutorial eligibility is established.

## Authoritative registry

The registry is indexed separately by server source and account ID. Public snapshots are copies; modules cannot mutate internal tables. Account ID is never confused with the ephemeral source ID. Only small flags such as active state, staff duty, sleep, and tracking immunity use state bags.

## Session invariants

- One generated-column unique key permits at most one open DB session per account.
- A process-local account lock serializes simultaneous login attempts.
- Duplicate login persists and closes the old session before it removes memory or drops the old client.
- `playerDropped` finalization is idempotent and clears every source-indexed cache.
- Resource start closes DB sessions left open by a prior crash/restart.
- Periodic saves add playtime atomically rather than overwriting totals from stale cache.

## RPC

One request/response bus supplies unique IDs, client timeout cleanup, missing-callback errors, exception isolation, global and per-RPC windows, authentication gates, metrics, and standardized responses. Broadcast state changes use events instead.

## Command contract

All player-facing commands are registered in `rpg_core`. Definitions include name, aliases, description, usage, separate admin/helper requirements, argument policy, console policy, audit policy, resource owner, and handler. Unknown, denied, invalid, missing-player, exception, and domain rejection paths always return feedback.

## UI and focus

`rpg_ui` is the only resource that calls `SetNuiFocus`. Focus has exactly one owner (`auth`, `chat`, or future modal). NUI renders all untrusted text with `textContent`; no chat/admin value is inserted as HTML.

## Extension rule

A future full gameplay module should take ownership of its tables and server state through a new migration and explicit API boundary. It may call documented core exports and register callbacks/commands, but must not import implementation files or introduce a reverse/circular dependency.
