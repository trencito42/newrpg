# Vehicle physics workflow

The canonical source is `scripts/vehicle-physics/catalog.js`. It maps known models to a documented identity, physical archetype, performance tier and drivetrain. Family rules cover recognizable fictional derivatives; models that cannot be identified confidently stay marked `uncertain` and use a conservative class-based archetype.

Raw add-on handling is evidence for the audit, not the gameplay baseline. Many bundled packs reuse extreme values such as `fBrakeForce = 3` and `fTractionCurveMax = 3.9`, or encode an implausible drivetrain. The generator deliberately replaces those values with the canonical physical model.

## Generation pipeline

1. `npm run discover:vehicles` recursively scans every repository `vehicles.meta` and `handling.meta`, rejects duplicate identifiers and writes `scripts/discovered_addon_vehicles.json`.
2. `npm run generate:vehicles` resolves each vehicle through identity, archetype and tier, then writes all Lua profiles, the JSON inventory and the Markdown/CSV audit.
3. `npm run audit:vehicles` proves discovery and generated files are current, then checks full coverage, duplicates, drivetrain consistency, physical ranges, tier hierarchy, rollover controls, profile uniqueness, tuning integration and Lua syntax.

The generated Lua files start with `AUTO-GENERATED` and must not be edited directly. A manual change there will fail the drift check.

## Runtime order

```text
vehicle metadata
  -> sunset_vehicle_dynamics canonical stock baseline
  -> sunset_tuning entity hardware and ECU layer
  -> temporary gameplay effects
```

`sunset_vehicle_dynamics` applies once per entity instance. The tuning resource caches handling by model, but captures mods and turbo per entity. Every tune calculation restores the canonical handling first, so repeated application cannot compound. A dynamics restart or administrator reapply publishes an event that restores the persisted tune on top.

## Live verification

Level-2 administrators can run `/vehphysics` while seated in a vehicle to print identity, profile source, tier, drivetrain, mass, target/current speed and canonical-versus-live handling. `/reapplyhandling` reloads the canonical profile and then restores an active tune. With `Config.Debug = true`, developers can also use `/handlinginfo`, `/handlingreload` and `/handlingtest` for acceleration and braking measurements.

The generated audit catches structural and numeric regressions, but final launch sign-off still requires road tests for representative economy, sedan, muscle, supercar, SUV, off-road, commercial and emergency vehicles. Test stock and tuned states, repeated tune application, resource restart, high-speed lane changes, curb strikes, braking and rollover recovery.
