# Native GTA handling donor migration

## Architecture

- **Addon vehicles** use a real GTA V `handlingId` in `vehicles.meta` (donor reference).
- **`sunset_vehicle_dynamics`** keeps identity/tuning metadata (`handlingMode = native_donor`) but **does not** overwrite `CHandlingData` floats for those models.
- **`sunset_tuning`** captures baseline from the **live entity** via `GetCanonicalBaseline` (reads natives on the vehicle after donor handling is applied).
- **Vanilla catalog vehicles** (65) remain on the canonical generated profile path for server-managed balance.

## Pilot vehicles (drive-test first)

| Model | Donor | Role |
|-------|-------|------|
| `tolrrmansory` | `WINDSOR2` | Enus Windsor Drop — luxury convertible |
| `tolap2` | `EMERUS` | Progen Emerus — low RWD hyper |

## Revert (per model)

1. Set `<handlingId>MODELNAME</handlingId>` back in the pack `vehicles.meta`.
2. Remove or adjust the row in `scripts/vehicle-physics/handling-donors.js` `EXPLICIT_DONORS` if present.
3. Regenerate: `node scripts/apply-handling-donor-meta.js`, `npm run discover:vehicles`, `npm run generate:vehicles`.

## Full fleet

- **179** addon models mapped in `docs/vehicles/HANDLING_DONOR_MAP.csv`.
- Uncertain donors marked `needs_drive_test` in CSV — verify cornering, braking, bumps, rollover in FiveM.
- If a vehicle still rolls on a stable Rockstar donor, inspect YFT collision, wheel bones, and suspension geometry before changing handling numbers.

## In-game test procedure (`tolrrmansory`, `tolap2`)

1. Spawn stock (no ECU), empty public road — 60–90 km/h sweeping corners, lane changes, medium braking from 80 km/h.
2. Repeat over bumps / curbs (suspension travel, no spontaneous roll).
3. Install mid ECU tune, restart `ensure sunset_vehicle_dynamics` — confirm tune returns without power stacking.
4. Nitrous on/off if equipped — engine multipliers return to tuned baseline.
5. Compare feel to donor vanilla (`/car emerus` / `windsor2`) — addon should be in the same ballpark (mass/aero differ).

**Do not mark rollover fixed without completing the above in FiveM.**

## Tooling

```bash
node scripts/apply-handling-donor-meta.js   # patch vehicles.meta + CSV
npm run discover:vehicles
npm run generate:vehicles
npm run audit:vehicles
```
