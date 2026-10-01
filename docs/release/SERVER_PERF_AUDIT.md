# Server performance audit - 2026-10-01

Scope: `resources/[sunset]` server code, `sql/`. Baseline: c02b116 + docs/SQL_PERFORMANCE_AUDIT.md.
Checks after edits: lua-syntax 414/414 OK; forward-refs only third-party (ox_lib, ox_inventory) issues; db-writes 2 pre-existing violations in sunset_skins (not touched by this pass).

## Counts
| Metric | Count |
|---|---|
| `MySQL.*` call sites (query/single/scalar/insert/update/prepare/rawExecute) | 582 |
| `TriggerClientEvent(..., -1)` sites | 106 (30 blackjack table sync, 9 turfs, 9 admin cmds, 7 detention, 5 vehicles, 5 properties, 5 businesses, rest <=4) |
| `GetPlayers()` loops server-side | 120 sites (all O(players); no O(players^2) found in hot paths) |
| Files with per-src maps but no playerDropped | 0 (roulette/slots checked, both handle it) |
| Unbounded log-like tables with no retention before | 8 -> 0 (phone_messages deliberately excluded) |

## Changes (before -> after)
| # | Item | Location | Before | After | Class |
|---|---|---|---|---|---|
| 1 | warTick broadcast | sunset_turfs/server/main.lua (war ticker thread, ~line 411-476) | -1 every 1 s, payload incl. participants map | participants 1 Hz, -1 every 5th tick | FIXED |
| 2 | phone getPhoneData | sunset_phone/server/main.lua ~137 | `WHERE sender=? OR receiver=? ORDER BY id DESC LIMIT 60` (index-merge/filesort) | UNION of two indexed LIMIT 60 branches, joined by id | FIXED |
| 3 | AvatarCache growth | sunset_phone/server/main.lua:64 | never pruned | prune thread 10 min / 30 min age | FIXED |
| 4 | businessesChanged | sunset_businesses/client/main.lua:16 | immediate refetch on all clients | debounce + 0.25-3.25 s jitter | FIXED |
| 5 | sessions readiness | sunset_taxi/server/main.lua:26, sunset_robbery/server/sessions.lua:28, sunset_licenses/server/main.lua:23 | fixed `Wait(1200/1500)` then give up | poll GetResourceState <=60 s | FIXED |
| 6 | Retention x8 tables | tail of core/money_log.lua, anticheat/strikes.lua, admin/commands.lua, clans/main.lua, robbery/adapter.lua, factions/core.lua, dealership/main.lua | none | batched delete every 6 h | FIXED |
| 7 | Indexes | sql/64-retention-indexes.sql | missing | 8 `CREATE INDEX IF NOT EXISTS` | FIXED |

## Verified, no change
- Money/inventory: atomic UPDATE patterns in core/player.lua:228,270,292, inventory/trade.lua:480-485; transactions used at 18 sites. VERIFIED.
- Scoreboard already cached 2.5 s; economy payday already queued/batched; playtime flush batched (CASE WHEN). VERIFIED.
- Anticheat economy scan uses id cursor LIMIT 200. VERIFIED.
- faction roster joins faction_membership (prior pass). VERIFIED.
- Properties delta/generation protocol replaced propertiesChanged herd (c02b116). VERIFIED.

## Left as-is (documented)
- `sunset_admin/server/actions.lua:443` `/dvall` loads all vehicle plates (rare admin command; safe normalization matters more). PARTIALLY VERIFIED.
- detention sync -1 (7 sites + police.lua:349): consumers apply to remote peds; targeting by proximity needs client review. REQUIRES LOAD TEST.
- chat:addSuggestion -1 in dispatch/help at start only. VERIFIED (boot-only).
- sunset_jobs `RegisterActivity` still uses fixed Wait(1000) (jobs owned by another agent).
- phone_messages retention: product/privacy decision.
- Duplicate indexes (`idx_vehicles_char_plate` vs FK `character_id`; `idx_phone_messages_sender_id` vs `_sender`; `idx_status` vs `idx_impound_status_at` prefix) left; dropping is a separate migration.
- sunset_skins writes `characters.metadata` directly (2 check-db-writes violations, other domain).

## Scalability estimate (conceptual)
- 10 players: no concern.
- 50: 1 Hz anticheat loop ~200 native checks/s, scoreboard cached; fine.
- 100: -1 broadcasts (detention, drop sync, business changes) and wars become dominant; businesses herd now jittered; turf tick cut ~5x for bystanders.
- 200: DB pool (oxmysql default ~10 conn) and per-tick GetPlayers loops (120 sites) need load test; inventory dropSync -1 and detention sync -1 are the main remaining broadcast risks. REQUIRES LOAD TEST.
