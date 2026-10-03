# Release gate — 2026-10-03

A production launch requires code checks and tests on a real FiveM server. Static evidence cannot prove entity state, reconnect behavior, OneSync event behavior or multiplayer races.

| Gate | Status | Evidence or required action |
|---|---|---|
| P0 account identity isolation | CODE PASS | Account ownership uses `account_id`; migration 76 removes license uniqueness/ownership coupling; run reconciliation and same-license/two-account tests on a DB clone. |
| Server-authoritative rewards | CODE PASS | Hacking, robbery, drugs, carjack, crafting and mission completion use server state/tokens; authority regression scripts pass. |
| EN/RO parity | STATIC FAIL (pre-existing) | Key parity is equal (Lua 4,952/4,952, NUI 3,124/3,124), but `npm run i18n:check` reports 291 pre-existing presentation findings (panel pages, quest chains, carjack/dealership keys). None are in files touched by the shop/clan pass. |
| Resource and item inventory | STATIC PASS | Current 72-resource and 90-item matrices generated from source; `standard_tank` resolved (connected to diver standard gear tier). |
| Clan lifecycle (expiry, grace, renewal, slots) | IMPLEMENTED — RUNTIME BLOCKED | Migration 77 one-shot expiry repair; per-player locks, debit-first, guarded UPDATE, refund on failure; `scripts/test-shop.js` (clan section). Needs live renewal/grace/expiry tick verification. |
| Racket Shop (`sunset_shop`) | IMPLEMENTED — RUNTIME BLOCKED | Single price registry, idempotent `shop_orders`, entitlements, audit log, refund-on-failure; `scripts/test-shop.js` 134/134. No FiveM client has opened the shop yet. |
| Business ownership cap | CODE PASS | `MaxOwnedPerCharacter = 2` enforced in purchase, transfer export and trades (in-transaction). |
| Lua/NUI/panel checks | PARTIAL | Lua syntax 469/469, NUI bridge/modules/assets, db-writes, prelaunch invariants and `test-shop.js` pass. `npm --prefix panel run build` stops at its i18n pre-step for the pre-existing findings above. |
| Complete deploy artifacts | BLOCKED | Install/build `screenshot-basic` and provision `pma-voice` plus `bob74_ipl`; current repository checker correctly reports them missing. |
| Dedicated NUI focus flows | RUNTIME BLOCKED | Local adapters have stop cleanup, but escape/restart behavior needs live confirmation. |
| Migrations on production-like clone | BLOCKED | Apply every migration through 79, verify checksums, rollback procedure, identity reconciliation and that migration 77 runs only once. |
| Authentication scenarios | BLOCKED | Test two accounts from one FiveM license, reconnect, duplicate login and legacy rows. |
| Gameplay regression | BLOCKED | Execute `docs/testing/REGRESSION_MATRIX.md` with real clients. |
| Restart/reconnect recovery | BLOCKED | Restart core, inventory, quests, crafting, casino games, jobs and mission resources during active sessions. |
| OneSync security | BLOCKED | Confirm OneSync in txAdmin and test damage/explosion/license enforcement. |
| Load and performance | BLOCKED | Record server/client frame time and DB latency at 2, 10, 25 and 48 players. |

## Verdict

**NOT READY for an uncontrolled public launch.** The confirmed code defects in scope are fixed and statically guarded. The remaining blockers require the target database and a running FiveM/OneSync environment; this repository session did not provide either. A staff-only staging session is appropriate after migrations pass on a clone.
