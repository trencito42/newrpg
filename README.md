# Blipmade RPG Framework MVP

A custom, modular, hardened FiveM RPG framework foundation based on OneSync.

## Core Flow

`connect (private routing bucket) -> login/register -> onboarding cinematic -> server-authorized spawn -> active in public bucket 0 -> chat / commands / admin / persistence`

The server owns identity, lifecycle, permissions, spawn entitlement, session history, and persistent statistics. Clients submit intent only.

## Key Hardened Architecture Principles

- **OneSync Foundation**: Explicitly requires and configures OneSync (`set onesync on`, `setr sv_stateBagStrictMode true`).
- **Auth/Onboarding Isolation**: Connecting players are isolated in a private routing bucket (`10000 + src`) with population disabled and strict entity lockdown until server spawn activation.
- **Server Spawn Authority**: Clients cannot trigger spawns without a valid single-use server spawn entitlement token.
- **Position Persistence**: Authoritative ped coordinates and heading update the registry before database writes, guarding against (0,0,0) overwrite.
- **Central NUI Focus**: `rpg_ui` exclusively manages NUI focus. `/fixscreen` resets visual state but preserves gameplay protection if the client is not server-side active.
- **Acyclic DAG & Decoupled Domains**: Minimal domain services (`rpg_economy`, `rpg_factions`, `rpg_housing`, `rpg_vehicles`) handle domain state, leaving `rpg_core` focused on infrastructure and `rpg_admin` consuming clean APIs.
- **High-Performance In-Memory Caches**: Zero database queries per message for `/lc` faction leader chat and global chat mute checks.
- **Warning Lifecycle**: 3/3 warnings trigger automatic ban and mark contributing warnings as resolved/consumed so future unbans do not immediately trigger another ban on strike 1.

## Quick Start

1. Set `FIVEM_LICENSE_KEY` and database credentials in `.env`.
2. Run `docker compose up -d --build` from this directory.
3. Inspect `docker compose ps` and `docker compose logs --tail=200 fxserver migrate`.
4. Connect with FiveM to `<server-ip>:30120`.
5. Register, then run `rpg_setowner <username>` in the FXServer console once.

## Automated Validation

```bash
bash scripts/validate.sh
bash scripts/test-database.sh
```
