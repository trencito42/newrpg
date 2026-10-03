# Release gate — 2026-10-03

A production launch requires code checks and tests on a real FiveM server. Static evidence cannot prove entity state, reconnect behavior, OneSync event behavior or multiplayer races.

| Gate | Status | Evidence or required action |
|---|---|---|
| P0 account identity isolation | CODE PASS | Account ownership uses `account_id`; migration 76 removes license uniqueness/ownership coupling; run reconciliation and same-license/two-account tests on a DB clone. |
| Server-authoritative rewards | CODE PASS | Hacking, robbery, drugs, carjack, crafting and mission completion use server state/tokens; authority regression scripts pass. |
| EN/RO parity | STATIC PASS | Strict locale gate reports equal keys across Lua, NUI, panel and loadscreen. |
| Resource and item inventory | STATIC PASS | Current 71-resource and 90-item matrices generated from source. |
| Lua/NUI/panel checks | STATIC PASS | Lua syntax 457/457, NUI bridge/modules/assets, authority/lifecycle suites, panel 44/44 and production build passed. |
| Complete deploy artifacts | BLOCKED | Install/build `screenshot-basic` and provision `pma-voice` plus `bob74_ipl`; current repository checker correctly reports them missing. |
| Dedicated NUI focus flows | RUNTIME BLOCKED | Local adapters have stop cleanup, but escape/restart behavior needs live confirmation. |
| Migrations on production-like clone | BLOCKED | Apply every migration through 76, verify checksums, rollback procedure and identity reconciliation. |
| Authentication scenarios | BLOCKED | Test two accounts from one FiveM license, reconnect, duplicate login and legacy rows. |
| Gameplay regression | BLOCKED | Execute `docs/testing/REGRESSION_MATRIX.md` with real clients. |
| Restart/reconnect recovery | BLOCKED | Restart core, inventory, quests, crafting, casino games, jobs and mission resources during active sessions. |
| OneSync security | BLOCKED | Confirm OneSync in txAdmin and test damage/explosion/license enforcement. |
| Load and performance | BLOCKED | Record server/client frame time and DB latency at 2, 10, 25 and 48 players. |

## Verdict

**NOT READY for an uncontrolled public launch.** The confirmed code defects in scope are fixed and statically guarded. The remaining blockers require the target database and a running FiveM/OneSync environment; this repository session did not provide either. A staff-only staging session is appropriate after migrations pass on a clone.
