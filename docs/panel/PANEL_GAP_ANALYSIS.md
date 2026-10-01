# Panel gaps and release blockers

This file lists functionality that the current code does **not** prove complete.

1. The staff page displays information but has no production-ready action queue or FiveM consumer. Ban, unban, mute, warn and faction management from the web remain unimplemented. These must reuse the actual game permission levels and canonical handlers, handle online/offline targets, return deterministic results and record audit events.
2. The panel has unit tests and a successful production build, but not a full Playwright journey or a disposable MariaDB test database exercising the migration chain. A production schema spot-check is not equivalent to an isolated integration suite.
3. `sql/65-panel-schema.sql` still contains a historic demo poll and a hardcoded `USE` line because deployed migration checksums must not be silently rewritten. The runner filters the database switch, and v66 deletes the demo poll only when it has no votes. An already-voted demo poll requires operator review.
4. The localization audit still flags likely player-facing strings across the FiveM resources. The audit has false positives but is not a certification that every player-visible string is translated.
5. The current panel process and FiveM resource need an orderly restart after deploying this code. A successful `next build` in the worktree does not prove the live process loaded the new code.

No fictitious HTTP bridge, payment system, web marketplace or benchmark is part of the implemented architecture.
