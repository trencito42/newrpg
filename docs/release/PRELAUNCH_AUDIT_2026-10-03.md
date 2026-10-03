# Racket RPG final pre-launch audit — 2026-10-03

## Decision

**NOT READY for an uncontrolled public launch.** All confirmed repository defects addressed by this pass have code fixes and static regression coverage. A live FiveM server, OneSync runtime and production-like database were unavailable, so authentication migration, multiplayer concurrency, restart recovery and load behavior remain launch blockers.

## Scope and canonical evidence

- [Resource matrix](RESOURCE_MATRIX_2026-10-03.md): all 72 `sunset_*` resources (including the new `sunset_shop`), with production/dev/retired status and runtime-test column.
- [Item economy matrix](ITEM_ECONOMY_MATRIX.md): 90 catalog items with detected sources, sinks, recipes and orphan review.
- [Release gate](RELEASE_GATE.md): launch blockers and required runtime evidence.
- [Identity model](../architecture/AUTH_IDENTITY.md), [domain ownership](../architecture/DOMAIN_OWNERSHIP.md) and [invariants](../architecture/INVARIANTS.md).

Old final/economy audits now carry a historical banner and are not implementation specifications.

## Confirmed fixes

### P0 identity and authority

- Authentication now owns characters through `account_id`; the FiveM license is connection metadata. Migration 76, an identity audit query and a regression script protect the model.
- Hacking, robbery, drug actions, carjack lockpicking/sales, crafting and mission escape bonuses use server-created state, timing, position/entity checks and one-shot settlement.
- Carjack profession progress now goes through `sunset_jobs`, the canonical owner.

### Progression and connected gameplay

- `sunset_quests` supplies a canonical `CanAccess` gate. Faction entry requires level 10 and `life_reach_level10` in invitations, acceptance and panel workflows. Admin level 3+ is the explicit panel bypass.
- Garbage provides plastic, cloth or metal scrap; valid carjack sales may provide gunpowder; chemicals remain sold by 24/7 shops. These inputs connect to recipes.
- EMS crafting outputs a usable field medkit. The duplicate `driver_license` inventory item was removed; `sunset_licenses` remains authoritative.
- Contact mission completion advances quests and the weekly Racket Pass contract mission. Business purchase advances quests and the Racket Pass entrepreneur mission.
- `sunset_needs` is disabled because hunger/thirst/stress lacked persistent HUD feedback. Consumables remain usable.

### Casino, brand and production tooling

- `sunset_casino` is the hub/cashier/bar owner only. Dedicated blackjack, roulette, slots and lucky-wheel resources are the sole game callback owners and use shared RNG.
- Visible production branding is Racket RPG, Racket Credits (`RC`), Racket Pass and Racket Shield. Legacy internal API/database names remain for compatibility and are documented as internal.
- Thumbnail generation and its unsafe child-process permission are dev-only. `sunset_police_handling` is retired in favor of `sunset_vehicle_dynamics` and is not ensured.

## Faction and organization depth

Police/Sheriff/FIB share the police duty, permissions, detention, wanted and dispatch stack, with organization-specific ranks/configuration. EMS and LSFD use the emergency duty/dispatch surface; LSSI owns license examination; Taxi has its dedicated civilian job loop; CNN supplies advertisements/news workflow. Illegal factions share membership, chat, storage and permission-controlled crafting. These paths are connected technically but still require faction-by-faction live roleplay acceptance tests.

### Clan lifecycle — IMPLEMENTED (static + interpreter-tested; runtime untested)

Clan creation costs 500 Racket Credits (now debited with the core guarded `SpendBlazePoints` and refunded with `AddBlazePoints`, replacing a stale balance-snapshot restore). Clans carry `expires_at` and an `active → grace → expired` status (migration 76 + 60 s ticker).

- **Legacy expiry fix (`sql/77-clan-lifecycle-fix.sql`)**: migration 76 backfilled `created_at + 30 days`, so older clans were born expired. Migration 77 grants every NULL/lapsed clan `GREATEST(IFNULL(expires_at, NOW()), NOW() + INTERVAL 30 DAY)` and status `active`; a valid future expiry is never shortened. Because `docker/fivem/entrypoint.sh` re-imports every migration on each start, the repair is one-shot via a `schema_data_fixes` marker row.
- **Atomic renewal and slot upgrades**: the clan panel actions (`extendLifetime`, `upgradeSlots`) run under per-player `ClansRenewLocks` / `ClansSlotLocks`; cash payments are debited first, the mutation is a guarded single `UPDATE` inside `pcall` (`status IN ('active','grace')`, `max_members < target`), and any failure refunds in full. Racket Credit payments are routed to `sunset_shop` so price, `TrySpendRacketCredits`, refunds and the `shop_orders` ledger have a single owner.
- **Racket Shop clan products**: name (entitlement), tag, color, 15/20/25 member capacity and 7/30/90-day renewal. `sunset_clans/server/shop_ops.lua` re-verifies character, membership, leader rank and lifecycle status at the moment of mutation. Expired clans cannot be renewed (staff restore only); clans in grace are restored from `NOW()`.
- Tag and color changes are no longer free in clan settings; they are Racket Shop products (the settings form shows them read-only).

### Racket Shop — IMPLEMENTED (static + interpreter-tested; runtime untested)

New resource `sunset_shop` (`/shop`, M menu → Racket Shop). One registry, `sunset_shop/shared/products.lua`, owns every price and reward; handlers never read a client price or amount. Settlement (`server/settlement.lua`): product lookup → request-id validation → per-player cooldown + lock → idempotency on `shop_orders.request_id` (UNIQUE) → handler preflight → order `pending` → guarded RC debit → `processing` → delivery in `pcall` → `completed`, or full refund → `refunded` (`failed` + critical log + audit row if the refund itself fails). Every RC debit/refund and every entitlement use is written to `shop_audit_log`. Products: character name change (entitlement → rename via new core export `RenameCharacter`), clan products above, and cash packs (100/250/500 RC → $25,000/$70,000/$150,000 bank through `AddMoney`). Vehicle and quality-of-life categories are intentionally empty: vanity plates are already a cash product in `sunset_tuning`.

## Economy findings

Static configuration shows bounded legal rewards (examples: garbage $504 per full route, courier $540 per six-package run, truck routes $650–$900 before manual-docking multiplier, mechanic $160 per repair, taxi $75 base plus $35/km with caps). Contact missions pay $4,200–$8,000 but enforce minimum durations and 30–40 minute cooldowns. Drug and robbery value is server-generated and subject to quantity, negotiation, fence factors, demand and cooldowns.

No defensible dollars-per-hour conclusion is possible without route time, player concurrency, failure rate and sink telemetry. Business income comes from real player sales rather than a passive timer. **Business ownership is now capped at `MaxOwnedPerCharacter = 2`**, enforced in `buyBusiness` (pre-check + in-transaction re-check), the `TransferOwnership` export (guarded single `UPDATE`) and player trades (pre-flight + in-transaction re-check); admin `clearOwner` never assigns ownership and is unaffected. **`standard_tank` is resolved**: it is kept and connected to the diver job — the standard gear tier (diver rank 2) now grants `standard_tank` instead of `scuba_gear`, contracts accept it and shift end removes it. Other flagged orphans in the item matrix still require live/manual verification before catalog promises are made.

## Verification executed in this pass

The following checks passed on the release worktree:

```bash
node scripts/check-lua-syntax.js
node scripts/check-nui-bridge.js
node scripts/check-nui-modules.js
node scripts/check-nui-assets.js
node scripts/check-db-writes.js
node scripts/test-auth-identity.js
node scripts/test-critical-authority.js
node scripts/test-prelaunch-invariants.js
node scripts/test-casino-authority.js
node scripts/test-missions-authority.js
node scripts/test-jobs-authority.js
node scripts/test-inventory-api.js
node scripts/test-lifecycle.js
node scripts/test-nui-smoke.js
npm run i18n:check
npm run i18n:test
npm --prefix panel test
npm --prefix panel run build
```

Panel tests passed 44/44 and the production build completed. The NUI smoke suite passed 12/12. The strict i18n gate passed with Lua EN/RO 4,875/4,875, NUI 3,018/3,018, panel 1,218/1,218 and loadscreen 17/17.

Three repository checks remain non-green and are release inputs rather than hidden exceptions:

- `check-lua-forward-refs.js` reports three heuristic findings in vendored `ox_lib`; no `sunset_*` Lua syntax failure exists.
- `check-manifests.js` reports the unbuilt external `screenshot-basic` placeholder and the externally provisioned `pma-voice`/`bob74_ipl` resources. Production provisioning must install their complete artifacts.
- `check-nui-focus.js` rejects direct natives in seven dedicated NUI resources. Each has a local focus adapter and stop cleanup, but the checker does not model that ownership pattern. These flows still need live escape/restart testing.

`test-threads-permissions.js` also passed against the configured database when run with `NODE_PATH=panel/node_modules`; it created and removed its temporary records. This report makes no FiveM runtime claim.

## Verification executed in the final pass (Racket Shop / clans / business cap)

```bash
node scripts/check-lua-syntax.js          # 469/469 OK
node scripts/check-nui-bridge.js          # OK, all posted NUI callbacks registered
node scripts/check-nui-modules.js         # OK
node scripts/check-nui-assets.js          # OK
node scripts/check-db-writes.js           # 0 new cross-domain writes (shop tables registered to sunset_shop)
node scripts/test-shop.js                 # 134/134
node scripts/test-prelaunch-invariants.js # OK (faction gate check re-pointed to progression_gates.lua)
npm run i18n:check                        # FAILS: 291 findings, all pre-existing (panel pages, quest chains, carjack/dealership keys); 0 introduced by this pass
npm --prefix panel run build              # FAILS at its i18n:check pre-step for the same pre-existing findings; panel code untouched
```

`scripts/test-shop.js` executes the real Lua modules (shop registry, validation, settlement engine, handlers and `sunset_clans/server/shop_ops.lua`) through a small luaparse-based interpreter (`scripts/lib/mini-lua.js`) with in-memory database/currency mocks. It proves settlement logic, not oxmysql, FiveM export marshalling or NUI rendering: **no FiveM runtime test of the shop has been executed.**

## Required staging sequence

1. Clone the production database, run `scripts/account-identity-audit.sql`, reconcile rows and apply all migrations through 79 (77 clan expiry repair, 78/79 shop tables). Re-run the container once more and confirm migration 77 does not extend clans a second time.
2. Test two accounts on one license, duplicate-login eviction, reconnect and legacy account/player combinations.
3. Confirm OneSync in txAdmin; exercise damage, explosions, position/entity checks and routing buckets.
4. Execute the gameplay regression matrix with at least two clients, including disconnect and resource restart during each valuable session.
5. Test inventory-full and concurrent settlement paths for crafting, missions, casino, businesses, clans and criminal loops.
6. Measure DB latency, server tick and client frame time at 2, 10, 25 and 48 players.
7. Racket Shop runtime: buy every product with two clients; double-click confirm; disconnect mid-purchase; stop `sunset_clans` and confirm clan purchases refund; verify `shop_orders`/`shop_audit_log` rows, name change propagation (chat, scoreboard, clan roster) and focus release on ESC/death/resource restart.
8. Review economy telemetry (including RC → bank pack volume) and adjust business cap or rewards from observed completion times.
