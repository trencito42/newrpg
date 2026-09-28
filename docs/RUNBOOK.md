# Runbook

## Configuration

`.env` is deployment-local and ignored. Required values are `FIVEM_LICENSE_KEY`, `FIVEM_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_ROOT_PASSWORD`.

## Start

```bash
cd /home/blipmade-rpg/htdocs/rpg.blipmade.com
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 migrate database fxserver
```

Expected: MariaDB healthy, migrator exits 0, FXServer remains running, and resources start `oxmysql -> bob74_ipl -> rpg_core -> rpg_ui -> rpg_auth -> rpg_spawn -> rpg_admin -> rpg_chat`.

## Stop/restart

Only manage this project:

```bash
docker compose stop
docker compose restart fxserver
docker compose down
```

Do not use global prune commands and do not remove the named MariaDB volume.

## Current VPS prerequisite

The current user cannot access `/var/run/docker.sock`. A root administrator must run:

```bash
sudo usermod -aG docker blipmade-rpg
```

Then end and recreate the `blipmade-rpg` login session (or reboot). Verify with `docker ps`. This does not stop or modify unrelated containers.

## Failure handling

- Missing Cfx key: entrypoint exits with the exact missing variable.
- DB unhealthy: Compose does not run migrations/FXServer.
- Migration mismatch: migrator exits before FXServer.
- DB loss while online: persistence reports failure; no default profile is fabricated.
- Core restart: open DB sessions are closed as `server_restart`; live cache is rebuilt only through login.

## Backups

Back up the named volume with an explicit `mariadb-dump` from this Compose project. Test restore into a separate database before relying on it. Never manipulate unrelated CloudPanel/Mailcow databases.

