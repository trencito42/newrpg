# Vehicle physics corrective pass (post 05f82d7 review)

Automated evidence (2026-10-07):

- `node scripts/generate-addon-profiles.js --check` — 259 profiles, no drift
- `node scripts/audit-vehicle-physics.js` — invariants + runtime sanitize regressions
- `node scripts/validate-vehicle-dynamics.js` — 29/29 PASS
- `node scripts/check-lua-syntax.js` — 486 OK

## Task status

| Task | Status | Notes |
|------|--------|-------|
| 1 Motorcycle mass | **PASS** (automated) | `massLimitsForProfile` + `runtime-sanitize.js` mirror; `validate_profiles.lua` Resolve bati mass |
| 2 Tuning after dynamics restart | **UNVERIFIED** (in-game) | `baselineRestored` always; tuning loop guard `_internalBaselineRestore`; model baseline cache cleared on dynamics start |
| 3 Nitrous / engine multipliers | **PASS** (code + audit) | Restore `state.calculated` multipliers; canonical baseline uses 0.0 power per ECU model |
| 4 hycadetail identity | **PASS** (automated) | `performance_sedan_awd` in catalog; regenerated `profiles_addon.lua` |
| 5 Benchmark | **UNVERIFIED** (in-game) | `client/benchmark.lua` gated by `Config.Debug`; no live FiveM timings captured |
| 6 Regression tests | **PASS** (automated) | Expanded `audit-vehicle-physics.js` + `validate-vehicle-dynamics.js` |

In-game QA still required: resource restart with tuned ECU, nitrous cycle, admin boost then NOS off, benchmark repeatability.
