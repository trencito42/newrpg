# Vehicle dynamics report

This repository uses a generated canonical vehicle-physics catalog. The maintained inputs are `scripts/vehicle-physics/catalog.js` and the vehicle metadata under `resources/`; generated Lua profiles must not be edited by hand.

| Inventory | Profiles |
| --- | ---: |
| Vanilla/configured road vehicles | 65 |
| Addon civilian vehicles | 147 |
| Emergency/faction vehicles | 47 |
| Total | 259 |
| Identity explicitly left uncertain | 15 |

The complete per-model audit, including drivetrain, archetype, tier, target speed, mass, traction, rollover controls, source metadata and confidence, is in [`docs/vehicles/VEHICLE_PHYSICS_AUDIT.md`](vehicles/VEHICLE_PHYSICS_AUDIT.md) and [`docs/vehicles/VEHICLE_PHYSICS_AUDIT.csv`](vehicles/VEHICLE_PHYSICS_AUDIT.csv).

## Runtime pipeline

`sunset_vehicle_dynamics` applies the canonical stock baseline once per entity. `sunset_tuning` captures that immutable handling baseline, restores it before each calculation, then layers hardware and ECU changes on top. Removing a tune restores the canonical baseline and the vehicle's own hardware state.

Run `npm run audit:vehicles` after changing metadata or catalog rules. Use `/vehphysics` and `/reapplyhandling` as a level-2 administrator for live diagnosis; developer-only `/handlingtest` remains behind `Config.Debug`.
