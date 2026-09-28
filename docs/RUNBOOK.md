# Runbook

## Configuration

`.env` is deployment-local and ignored from version control. Required values are:
- `FIVEM_LICENSE_KEY`
- `FIVEM_PORT` (default: 30120)
- `MYSQL_HOST` (e.g. 127.0.0.1 or host IP)
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `SERVER_NAME`
- `MAX_CLIENTS`

## Start & Service Management

```bash
cd /home/blipmade-rpg/htdocs/rpg.blipmade.com
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 fxserver migrate
```

Expected output:
- `migrate` container runs all pending numbered migrations and exits 0.
- `fxserver` starts and loads resources in exact DAG order:
  `oxmysql -> bob74_ipl -> rpg_core -> rpg_ui -> rpg_auth -> rpg_spawn -> rpg_economy -> rpg_factions -> rpg_housing -> rpg_vehicles -> rpg_admin -> rpg_chat`.

## Stop / Restart

```bash
docker compose stop
docker compose restart fxserver
docker compose down
```

## Failure Handling

- **Missing Cfx Key / DB Env**: Entrypoint halts immediately with a clear missing variable code.
- **Database Unavailable**: Migrator exits before FXServer starts.
- **Migration Checksum Mismatch**: Migrator aborts if an already-applied migration file was modified.
- **Server Restart / Crash**: Open DB sessions are cleanly closed on startup with `server_restart` reason.

## Validation Suite

```bash
bash scripts/validate.sh
bash scripts/test-database.sh
```
