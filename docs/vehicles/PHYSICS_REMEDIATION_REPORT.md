# Vehicle handling remediation report

Generated after pipeline fixes, catalog identity corrections, and profile regeneration (`node scripts/generate-addon-profiles.js`).

## 1. Root causes

| Issue | Cause |
|-------|--------|
| Custom cars felt slow | `FAMILY_RULES` matched substrings like `sedan` → `hycsedan` became **warm/civilian** tier (`fInitialDriveForce` ~0.30) despite addon `handling.meta` ~0.45. |
| Runtime ≠ configured handling | `nInitialDriveGears` written via `SetVehicleHandlingInt` but **high gear native** and **top-speed modifier** not reset/synced after baseline apply. |
| Tuning drift after restart | Per-model baseline cache in `sunset_tuning` not cleared when `sunset_vehicle_dynamics` restarted. |
| Stacking risk | Mitigated already: tuning calls `restoreBaselineHandling` before `Compute`; dynamics `vehicleDynamics:applied` only fires when `force=false`. |

## 2. Pipeline (authoritative order)

1. **Canonical stock** — `sunset_vehicle_dynamics` profile (`Resolve` → `ApplyHandling` → `FinalizeBaselineNatives`).
2. **Hardware** — `sunset_tuning` `SetVehicleMod` / turbo from entity state.
3. **ECU** — `TuneCalculator.Compute` on restored baseline.
4. **Temporary** — nitrous / admin boosts (existing resources; must not mutate cached model baseline).

`FinalizeBaselineNatives`: `SetVehicleHighGear`, `ModifyVehicleTopSpeed(0)`, engine multipliers reset, turbo pressure cleared.

## 3. Files modified

- `resources/[sunset]/sunset_vehicle_dynamics/client/apply.lua` — transmission/top-speed sync
- `resources/[sunset]/sunset_vehicle_dynamics/client/lifecycle.lua` — reapply on resource start
- `resources/[sunset]/sunset_vehicle_dynamics/client/diagnostics.lua` — high gear readout, `/vehbenchmark` alias
- `resources/[sunset]/sunset_vehicle_dynamics/shared/config.lua` — drive force sanitize max
- `resources/[sunset]/sunset_tuning/client/baseline.lua` — clear model baseline cache on dynamics restart
- `scripts/vehicle-physics/catalog.js` — explicit showcase identities; narrower sedan regex
- `scripts/generate-addon-profiles.js` — source-aware power calibration; EV single gear
- `scripts/audit-vehicle-physics.js` — regression tests for pipeline + key models
- Regenerated: `profiles_*.lua`, `classes.lua`, `vehicle_inventory.json`, audit CSV/MD

## 4. Identity / classification fixes (examples)

| Model | Before (typical) | After |
|-------|------------------|-------|
| `hycsedan` | warm sedan_awd, force ~0.30 | `performance_sedan`, force **0.42**, 8 gears |
| `dubmono` | civilian SUV tier | `performance_suv`, force **0.42** |
| `neonvenm` | generic sport / multi-gear | `sport_high` **EV**, **1** gear |
| `hweevil` | warm hatch ~0.30 | warm + source blend **~0.41** |
| `xlsstr` / `sen5tour` | warm sedan | `performance_sedan` + source calibration **~0.51** force |

259 explicit profiles (179 addon discovered = 100% covered).

## 5. Runtime validation (in-game, not fabricated)

| Command | Who | Purpose |
|---------|-----|---------|
| `/vehphysics` | Admin L2 | Canon vs live handling dump |
| `/reapplyhandling` | Admin L2 | Force baseline + restore persisted ECU |
| `/handlingtest` or `/vehbenchmark` | `Config.Debug` | 0–100 km/h + 100–0 braking (client) |

**Steps:** spawn problem car → `/vehphysics` (compare Drive Force / Gears / high gear) → full-throttle straight → `/reapplyhandling` → repeat after `ensure sunset_vehicle_dynamics` + re-enter vehicle.

## 6. Automated tests (this repo)

```bash
node scripts/generate-addon-profiles.js --check   # no drift
node scripts/audit-vehicle-physics.js             # 259 profiles, invariants
node scripts/validate-vehicle-dynamics.js         # 27 checks
node scripts/check-lua-syntax.js
```

All passed at time of report.

## 7. Not verified without live FiveM client

Measured 0–100 / vmax / rollover angles for every model; per-vehicle benchmark matrix; network ownership migration edge cases.

## 8. Deploy

Commit → `git push origin main` → `deploy.sh` (FiveM). Confirm no `Error parsing script` and boot log: `sunset_vehicle_dynamics` profile count **259**.
