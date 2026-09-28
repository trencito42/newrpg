# Database Schema Dump on Push

Whenever a git push is requested:
1. Always run `bash scripts/dump-schema.sh` (or `mariadb-dump --no-data`) to generate a clean, structure-only `database/schema.sql` (no player data, no passwords, purely table definitions, constraints, indexes).
2. Stage `database/schema.sql` with `git add database/schema.sql`.
3. Include it in the commit before pushing.
