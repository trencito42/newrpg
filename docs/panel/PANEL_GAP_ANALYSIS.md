# Panel gaps and release blockers

This file lists functionality that the current code does **not** prove complete.

1. The staff action queue and FiveM consumer are implemented in source but have not been exercised on the live FXServer. Ban/mute/warn require the target online; offline unban and faction changes use the existing game domain functions. Offline ban/warn/mute support is not implemented. Actions abandoned during a crash are marked `execution_unknown_after_restart`, not silently replayed.
2. A disposable MariaDB 11.4 instance accepted the full `01`–`67` migration chain; 106 panel SQL statements prepared without schema errors, and 8 DB integrity checks passed, including concurrent duplicate voting. Ten seeded Playwright flows exercise anonymous/public pages, login/logout, session revocation, character switching, poll voting, support-ticket creation, staff-action queue submission and IDOR denial. These prove the web/database path, not actual FiveM execution.
3. `sql/65-panel-schema.sql` still contains a historic demo poll and a hardcoded `USE` line because deployed migration checksums must not be silently rewritten. The runner filters the database switch, and v66 deletes the demo poll only when it has no votes. An already-voted demo poll requires operator review.
4. The localization audit still flags likely player-facing strings across the FiveM resources. The audit has false positives but is not a certification that every player-visible string is translated.
5. The current panel process and FiveM resource need an orderly restart after deploying this code. A successful `next build` in the worktree does not prove the live process loaded the new code.

No fictitious HTTP bridge, payment system, web marketplace or benchmark is part of the implemented architecture.
