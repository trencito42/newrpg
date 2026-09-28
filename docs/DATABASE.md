# Database

The framework connects to the existing CloudPanel MariaDB configured by `MYSQL_HOST`; Compose does not create a second database. The migrator and FXServer use host networking because the CloudPanel user is reachable through the VPS address while Docker bridge-to-host traffic is filtered. All timestamps use UTC and `utf8mb4_unicode_ci`.

## Tables

- `accounts`: normalized unique username/email, scrypt hash, status, separate admin/helper levels, login metadata.
- `players`: exactly one row per account, base model/state/stats, money/RP, and provisional faction linkage.
- `account_identifiers`: observed Cfx identifiers for security/audit; never the login identity.
- `sessions`: immutable history plus one nullable generated key enforcing one active session per account.
- `sanctions`: warning/kick/account-ban/IP-ban/chat-mute history and expiry/revocation state.
- `sanction_identifiers`: identifier snapshots supporting pre-login ban enforcement.
- `admin_actions`: canonical immutable staff audit.
- `player_reports`, `newbie_questions`: persistent support queues with atomic handler ownership.
- `factions`, `houses`, `server_vehicles`: minimal persisted foundations required by staff commands.
- `schema_migrations`: migration filename and SHA-256.

## Migrations

Files are ordered `NNN_name.sql`. `scripts/migrate.sh` takes a database advisory lock, validates the checksum of every applied file, rejects edited history, and applies only pending files. Never edit an applied migration; add the next number.

Run an isolated real-MariaDB test with:

```bash
bash scripts/test-database.sh
```

The script checks fresh application, second-run safety, username/email uniqueness, one active session, and FK behavior without touching the deployment database.

## Mutation policy

- Bind all values with `?` placeholders.
- Use conditional updates or transactions for invariants.
- Update cache only after DB success.
- Do not report success when a query fails.
- Never let DB downtime create fake/default persistent state.
