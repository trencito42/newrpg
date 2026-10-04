# Final gamemode audit

Date: 2026-10-04. Base: `44756f73`. Fixes: `f5e1b7c4`, `c37c6dba`, `18666274`.

## FINAL VERDICT

**READY WITH LIVE VERIFICATION**

The launch blockers found in current code (auth-bucket escape, dead faction join, marketplace item cancel/buy inventory loss) are fixed and covered by `scripts/test-launch-invariants.js`. This pass did not run a FiveM server. Do not treat that as a live playtest.

## P0

| ID | Status | Summary |
| --- | --- | --- |
| FG-001 | fixed | `sunset:sessions:resetRoutingBucket` set bucket 0 for any client not in a gameplay session, including auth bucket 9999. |
| FG-002 | fixed | `sunset_quests` exported `CanAccess` / `CanAccessCharacter` with no functions, so every faction invite and accept failed. |
| FG-003 | fixed | Item-market cancel called `returnEscrow` before the local existed, so cancel errored and the item stayed escrowed. |
| FG-004 | fixed | Item buy/cancel/expire wrote `character_inventory` and never reloaded the online inventory cache. |

## P1

| ID | Status | Summary |
| --- | --- | --- |
| FG-005 | fixed | Market property buy ignored per-house `minimum_level`. |
| FG-006 | fixed | Market vehicle buy ignored the driver-license gate used by the dealership. |
| FG-007 | fixed | Panel `faction_set_member` let a leader add a character who fails `faction.apply`. Admin level 3+ remains the staff bypass. |
| FG-008 | fixed | `/intervene` did not check clan `status == 'active'`. |
| FG-009 | fixed | Clan invite accept counted members, then inserted. Two accepts could exceed `max_members`. |
| FG-010 | fixed | Client spawn continued after a missing prepare-spawn ack and marked gameplay. |
| FG-011 | fixed | `hunt_range_challenge` did not reconcile an already-owned hunting license. |
| FG-012 | fixed | Phone contact edit posted `phoneEditContact`, which has no NUI receiver. |
| FG-013 | fixed | NPC property sale ignored an active market listing. |
| FG-014 | fixed | Admin polygon save treated `ComputePolygonCenter`'s two numbers as one vector. |
| FG-015 | open | Listing an item calls `RemoveItem`, then `INSERT`. A crash between them drops the item with no listing. |
| FG-016 | open | Shop debits Racket Credits, then delivers. A crash while status is `processing` is not reconciled on start. Soft delivery failure still refunds. |
| FG-017 | open | Trade cancel/disconnect does not wait out `trade.busy`, so a settlement already in a transaction can still commit. |
| FG-018 | open | 24/7 purchase debits cash/bank, then `AddItem`, and refunds only if `AddItem` returns. A crash between them loses the payment. |

## P2

| ID | Status | Summary |
| --- | --- | --- |
| FG-019 | fixed | M menu level price fell back to $2,500. Live `LevelPriceBase` is 1000. |
| FG-020 | fixed | Ban text shown to players said `[Sunset RPG]`. |
| FG-021 | open | Two concurrent market lists can both pass `NOT EXISTS` until a unique active-asset key exists. Buy is still ownership-guarded. |
| FG-022 | open | Market item insert does not use inventory weight/slot rules. The row is real; it can exceed capacity. |
| FG-023 | open | `npm run i18n:check` reports 359 violations, including missing Romanian quest strings and duplicate phone UI keys. |
| FG-024 | open | Always-on client `Wait(0)` polls remain in phone, scoreboard, inventory quickslots, and HUD. |
| FG-025 | open | Grace-status clans can still accept members. Attack and intervene now require `active`. |

## P3

Player-facing NUI titles still include older "Sunset …" labels in generated i18n (`Sunset Missions`, `Sunset Robbery`, and similar). Internal resource names stay `sunset_*` on purpose.

## Domain notes

**Login.** Connect sets bucket 9999 in `sunset:server:playerLoaded`. Only `prepareSpawn` with a single-use permit moves the player to 0. Session cleanup can no longer do that. A rejected handshake no longer fires `characterSpawned`.

**Identity.** Public nickname is `characters.firstname` with empty `lastname`. Shop rename and admin `/fnc` both call `Sunset.RenameCharacter`. Account username is not renamed.

**Money.** `DebitMoneyInTransaction` / `CreditMoneyInTransaction` guard `column >= amount`. Marketplace buy of money, listing status, and asset transfer is one transaction. Direct `UPDATE characters SET cash` remains in fisherman bonus, dice, lottery, panel set-cash, and trade cash. Those paths are not the canonical helper.

**Quests.** All 24 active objective types found in `chains.lua` have a server `sunset:quest:progress` emitter. Claim uses a compare-and-set on `status = 'complete'`.

**Levels.** Next level costs `level * 4` RP and `level * $1000`. Cumulative 1→10 is 180 RP and $45,000. Cumulative 1→15 is 420 RP and $105,000. A completed civilian shift grants 2 RP. Payday grants 1 RP per qualifying hour.

**Clans / turfs.** Base cap 25, then 50, then 75. Lifetime options 7/30/90 days. Expired clans are not renewed by the shop tests. Intervention now matches the attack status check.

**Not live-tested.** Registration, intro, first quest, rental spawn, faction invite, market item round-trip, death, and resource restart.

## Answers

1. Registration and spawn are implemented and the auth bucket hole is closed. **REQUIRES LIVE FIVEM TEST.**
2. Intro plus `/quests` is the first-five-minutes path. Copy is in the quest chain. Live comprehension was not tested.
3. Mandatory objectives have emitters. The hunting-license soft-lock is reconciled. A full story run was not played.
4. Level 10 is 180 RP. At 2 RP per shift that is about 90 shifts, inside a long session of starter jobs, not a payday-only grind. **GOOD** if shifts are the intended RP source. Payday alone is **TOO SLOW**.
5. Level 15 adds 240 RP and $60,000. Reasonable as an end of the civilian arc. **REQUIRES LIVE FIVEM TEST** for actual hours.
6. Courier ($540 a typical run) pays more than garbage. Fisherman depends on fish prices. None of the starter jobs were rebalanced; the gap is large but not a single infinite faucet.
7. Courier is the strongest early cash job in config. Trucker routes pay $650–$900 and can out-earn it per completion once the player has a license and travel time is included. No job was changed.
8. No new money-duplication path was found in marketplace settlement or shop idempotency tests. Crash windows FG-016 and FG-018 can lose money, not print it. **STATICALLY VERIFIED** for the guarded helpers. Live double-spend was not run.
9. Item duplication was not found in the market transaction. The drop pickup crash window (add then clear) can duplicate. **Not fully closed.**
10. Market vehicle transfer requires `stored = 1` and the seller id in the same transaction. Rental does not insert a `vehicles` row. A double garage recover of `stored = 0` is still a race. **REQUIRES LIVE FIVEM TEST.**
11. Item cancel is fixed for the nil-function bug. The list-then-crash window FG-015 can still lose an item. Buy of a missing asset rolls back.
12. Shop tests show a failed delivery refunds RC. A process kill after debit and before refund does not. **FG-016 remains.**
13. Shop tests show an invalid or duplicate nickname does not consume the rename entitlement. **UNIT TESTED** in `scripts/test-shop.js`.
14. In-game faction join no longer fails closed, and the panel leader path no longer skips the gate. Admin level 3+ can still set a faction. Other gates sampled (dealership, property, clan, turf) call `sunset_core:CanAccess`.
15. Factions share one join gate now. Each faction's duty, vehicles, and missions were not replayed live.
16. Clan capacity and turf intervene are fixed in code. Polygon editor center math is fixed. Live war restart was not run.
17. Hunting license reconcile is in. Animal placement and combat were not live-tested.
18. Criminal emitters exist (`lockpick_practiced`, `carjack_sold`, `robbery_completed`). Gameplay loops were not live-tested.
19. Casino authority tests exist in the repo and were not re-run this pass. No positive-EV change was made.
20. Property market buy now checks `minimum_level`. Business cap tests in `test-shop.js` passed. Live enter/exit was not run.
21. Phone bank transfer uses `TransferMoney`. Contact edit is wired. Call state was read, not live-tested.
22. Shop focus release is covered by shop tests. A full NUI close sweep was not executed in a browser.
23. New keys added here exist in EN and RO. The strict i18n gate still fails with 359 prior violations.
24. Scoreboard caches for 2.5s. Phone `getPhoneData` still sends recent messages, calls, and transactions on open. `Wait(0)` input polls remain. These are the 100-player risks called out, not a benchmark.
25. Streamed addon packs and villa/casino maps were not binary-audited this pass. Prior DXGI risk is unchanged.
26. Resource restart during an open transaction is not proven. Shop and market do not have a startup reconciler for in-flight rows.
27. Disconnect during a committed market transaction keeps the commit. Disconnect during item list (FG-015) or shop processing (FG-016) can lose the asset or the credits.
28. No new migration was added. Existing runner is idempotent via `schema_migrations`. This pass did not apply them to a database.
29. Clean install was not executed here.
30. `sunset_needs` is commented out. `ox_inventory` is commented out because `sunset_inventory` is the inventory. Dev resources are behind `#@dev`. `sunset_police_handling` is not ensured. Fire, marriage, and events are ensured; this pass did not prove each one is content-complete.
31. `phoneEditContact` was a dead post and is removed. `check-nui-bridge.js` reports 48 registered callbacks with no `sunset_ui` caller; many belong to other NUI pages.
32. Rename payload tests still expect `{ nickname }`. No new legacy first/last payload was introduced.
33. `config/server.cfg.template` is the production ensure list. `docker/fivem/default-server.cfg` is the stock FXServer sample and is not the generated config.
34. `.github/workflows/static-checks.yml` runs Lua syntax, launch invariants, NUI bridge, shop settlement, and progression tests. It does not run the failing full i18n gate.
35. I would not open the server to the public until a live smoke covers login, first quest, one job payout, market item cancel, and a faction invite. After that smoke, yes.
