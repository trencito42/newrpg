# Production Readiness Report (static pass)

Everything below is STATIC verification. Nothing was run on a FiveM server or client.
Sign-off requires the live-test items listed in each linked report.

## Static check state (combined tree)
| Check | Result |
|---|---|
| check-lua-syntax | 419/419 OK |
| check-lua-forward-refs | 0 in sunset_*, 4 in third-party ox_lib/ox_inventory |
| check-db-writes | 0 NEW violations (known debt: sunset_vehicles -> character_inventory) |
| check-nui-bridge | all posted callbacks registered |
| check-nui-modules | pass |
| check-locales | Lua EN/RO 2300/2300, NUI 2033/2033, 0 missing/dup/placeholder problems |
| check-locale-usage | pass (23 RO strings flagged for overflow) |
| check-manifests (new) | 74 manifests, 887 refs, 0 missing |
| node --check on all web JS | 0 failures |

## Reports by domain
- Jobs lifecycle/exploits: JOBS_AUDIT.md (~70 found, ~65 fixed)
- Job UI + design tokens: JOB_UI_SYSTEM.md (tokens.css, job-hud.css/js, 6 jobs migrated)
- Security: SECURITY_AUDIT_2.md, PERMISSION_MATRIX_AUDIT.md (491 entry points enumerated, ~190 read in full, 33 weak/vulnerable found, 31 fixed)
- DB/server: SERVER_PERF_AUDIT.md, ../SQL_PERFORMANCE_AUDIT.md (migration sql/64-retention-indexes.sql)
- Client perf / entities: CLIENT_PERF_ENTITY_AUDIT.md
- NUI / startup / login: NUI_STARTUP_LOGIN_REPORT.md
- Localization: LOCALIZATION_REPORT.md
- Cleanup: CLEANUP_REPORT.md (23 files, 183 assets, ~10.2 MB removed; dev gating via SUNSET_DEV)
- Earlier stability pass: ../STABILITY_AUDIT.md

## Known open items (NOT production-ready until decided)
1. Slots outcomes are computed client-side; payout only clamped (needs server RNG).
2. ~700 notify/callback-error literals still hardcoded (migration script blocked pending approval); scanner 389 findings.
3. ~300 of 491 security entry points were triaged, not read in full.
4. Mission stages remain client-driven; fishing tournament scores are memory-only.
5. sunset_vehicles still writes character_inventory (needs cross-resource transaction API).
6. Detention / inventory dropSync `-1` broadcasts and anticheat loop at 200 players need a load test.
7. resources/[framework] (46 MB, untracked, unreferenced) not deleted - owner action.
8. Romanian register inconsistent (formal Lua vs informal NUI) - owner decision.
9. Gameplay/balance flags (not changed): solo race pays $500/5 min, taxi vehicle list, differing fish sell prices.

## Live test gate
Each linked report has a specific checklist. Minimum smoke set before deploy:
login -> spawn -> M menu -> /properties -> one Courier route (destroy van mid-route, verify no reward) ->
one Trucker route -> casino blackjack/roulette bet -> death/respawn -> restart sunset_jobs and sunset_ui while
a job is active (no stuck focus/HUD card/entities) -> EN/RO switch -> 1280x720 and 3440x1440 overflow check.
> **HISTORICAL — DO NOT USE AS CURRENT IMPLEMENTATION SPEC.** This report predates the 2026-10-03 hardening pass. Use `PRELAUNCH_AUDIT_2026-10-03.md` for launch decisions.
