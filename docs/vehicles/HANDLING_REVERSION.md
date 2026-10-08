# Vehicle handling reversion (2026-03)

## Policy

- **Vanilla GTA vehicles:** Rockstar handling only; no server runtime overrides.
- **Addon vehicles:** Pack `handling.meta` + `vehicles.meta` `handlingId` matching pack `<handlingName>` (no GTA donor substitution).
- **`sunset_vehicle_dynamics`:** Not started from `server.cfg.template`. Client apply/lifecycle are no-ops.
- **`sunset_police_handling`:** Retired; not ensured (would override LEO `handling.meta`).
- **`sunset_tuning`:** Stock vehicles do not write handling floats. ECU changes apply only when a non-stock tune is installed; removing a tune restores captured baseline floats for that session.

## Tooling

| Script | Purpose |
|--------|---------|
| `node scripts/restore-pack-handling-ids.js` | Set `handlingId` = pack `handlingName` where defined |
| `npm run audit:vehicles` | Discovery check + pack handling IDs + reversion guards + Lua syntax |

Obsolete donor pipeline (`apply-handling-donor-meta.js`, `audit-handling-donors.js`, `generate-addon-profiles.js`) is **not** part of `audit:vehicles`.

## Inventory

After restore, see `docs/vehicles/PACK_HANDLING_ID_INVENTORY.json` for per-model `handlingId` and models without a pack `handlingName`.

## Pack-specific handling names

Some models use a `handlingName` that differs from `modelName` (e.g. **sugoix** → **sugoimug** via sibling `data/sugoix/handling.meta`). Resolution uses sibling `handling.meta` first, then resource-wide `handlingName` matching `modelName`.

## In-game verification (required)

Automated checks do **not** replace road tests:

1. Spawn vanilla supercar — `/handlinginfo` (debug) shows live = meta only; no post-enter handling drift.
2. **tolap2** / **tolrrmansory** — pack handling (not T20/WINDSOR); respawn from garage after deploy.
3. Install ECU tune — performance changes; remove tune — returns to pack baseline without stacking.
4. Untuned vehicle — no silent ECU handling writes after enter/idle.
