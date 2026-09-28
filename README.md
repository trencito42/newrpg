# Blipmade RPG Framework MVP

A custom, modular FiveM foundation for one account = one persistent player. It intentionally contains no economy, inventory, jobs, factions, housing, vehicles, missions, phone, clans, crime, or other gameplay systems.

## MVP flow

`connect -> login/register -> profile -> first-login cinematic -> LSIA -> chat/commands`

The server owns identity, lifecycle, permissions, tutorial completion, session history, statistics, sanctions, and spawn entitlement. Clients submit intent only.

## Quick start

1. Set `FIVEM_LICENSE_KEY` in `.env`.
2. Ensure the `blipmade-rpg` user can access Docker (see `docs/RUNBOOK.md`).
3. Run `docker compose up -d --build` from this directory.
4. Inspect `docker compose ps` and `docker compose logs --tail=200 fxserver migrate database`.
5. Connect with FiveM to `<server-ip>:30120`.
6. Register, then run `rpg_setowner <username>` in the FXServer console once.

## Validation

```bash
bash scripts/validate.sh
bash scripts/test-database.sh
```

The first command checks Lua syntax, JavaScript logic, command/RPC behavior, NUI TypeScript/build, manifests, Compose, migration ordering, secret patterns, SQL patterns, and core boundaries. The second starts an isolated local MariaDB, applies all migrations twice, and tests foreign keys and unique constraints.

See `docs/MVP_SCOPE.md`, `docs/ARCHITECTURE.md`, and `docs/RUNBOOK.md` before extending the framework.

