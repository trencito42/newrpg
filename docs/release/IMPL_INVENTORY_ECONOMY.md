# IMPL: Inventory API + Economy safety

## API contract (sunset_inventory/server/api.lua)
`exports.sunset_inventory:ApplyOperation(source, ops, opts)` -> `{ok, results, inverse, replayed?}` | `{ok=false, error, opIndex}`
- ops (1..16): `add{item,count,metadata?,slot?}`, `remove{item,count,rowId?}`, `set_metadata{item,rowId?,metadata,merge?,expect?}`.
- Counts must be whole numbers 1..100000 (NaN/inf/float/huge rejected, never floored). Metadata <= 2 KB, item names validated.
- One MySQL transaction, whole inventory locked `FOR UPDATE`, all-or-nothing; decrements guarded `count >= ?`; weight enforced on final state only when weight increases; weapon licence gate; trade-lock respected; per-character serialisation.
- `opts.opId`: idempotency (per character, 10 min, in-memory); `opts.characterId` with nil source = offline mode.
- `inverse` = ops that undo the call, for cross-domain compensation.
- Also: `RemoveStolenByRobbery`, `PurgeStolenLoot` (robbery).

## Call sites migrated
- sunset_vehicles: fillGasCan, useGasCanOnVehicle (API); refuelVehiclePartial (core `DebitMoneyInTransaction` + ledger). Ordering: one in-flight request/player; GRANT first, CHARGE/CONSUME second; failed second step reverts the grant (inverse / conditional fuel UPDATE); failed rollback logs loudly.
- sunset_robbery: fence sale (remove via API, then AddMoney, inverse on failure), offline loot removal, startup purge.
- sunset_properties/cnn: debits/credits via core `DebitMoneyInTransaction`/`CreditMoneyInTransaction`/`AddMoneyToCharacter` (new, with in-txn ledger).
- check-db-writes: removed known-debt entries for vehicles and robbery. Remaining: 19 in sunset_panel_bridge (clans tables, other owner), plus pre-existing known debt (admin, phone, interactions, clothing, carjack, properties home_property_id).
- Documented in-own-txn inventory writers kept: crafting, jobs/fisherman, core starter items (cannot join another resource's txn).

## Races fixed
- inventory main.lua: moveSlot swap/stack and ensureStarterItems ran bare `MySQL.*` inside startTransaction (no lock, no rollback) -> now on `query`.
- vehicles: claimVehicleInsurance double-charge (conditional `destroyed=1` restore + refund), renewInsurance refund on lost row, totaled event single-shot with SQL-computed penalty, TransferVehicleOwnership conditional on stored/undestroyed.
- impound: confiscate duplicate records (row-locked txn), auto-sell conditional claim.
- core: RemoveMoney no longer trusts stale cache pre-check; strict amount checks in txn helpers.
- Payday and trade re-read: locked rows, PK on payday_runs; no change needed. Dealership already atomic (stock+debit+insert+ledger).

## dropSync
trade.lua: radius (150) + routing-bucket recipients, per-player known-set, 2 s reconcile (late join, entering range, bucket change), removals to holders only; `inventoryRequestDrops` forces full resend. Client consumer unchanged (add/remove).

## Tests
`node scripts/test-inventory-api.js` (static guards). Syntax/forward-refs/locales/locale-usage clean.

## REQUIRES LIVE TEST
Gas can fill/use incl. rapid double-click; legacy gas can rows; cross-resource `query.await` passing in DebitMoneyInTransaction; impound double confiscate; insurance double-claim; drops visible on join, walking into range, interiors; slot swap under load; robbery fence sale.
