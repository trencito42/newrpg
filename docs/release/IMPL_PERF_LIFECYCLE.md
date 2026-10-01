# Implementation: 200-player perf, restart safety, startup readiness

Nothing here was measured (no live server). Every number is an ESTIMATE; "REQUIRES LIVE TEST" items are listed at the end.
Static checks after the edits: lua-syntax 428/428, forward-refs 0 in sunset_* (4 pre-existing in ox_lib), nui-bridge OK (205), manifests 0 missing, locales OK, `scripts/test-lifecycle.js` OK.

## 1. Server loops

### Anticheat (sunset_anticheat/server/detectors.lua, client/sampler.lua)
| | Before | After (estimate) |
|---|---|---|
| Scheduling | one 1 Hz burst over all players | 100 ms ticker, per-player `nextAt`, ~10 % of roster per tick, 3 ms soft wall-time budget, round-robin cursor |
| Entity reads per player-visit | GetPlayerPed x4, GetEntityCoords, GetVehiclePedIsIn x3 | 1 ped + 1 coords + 1 vehicle read (`snap`), shared by speed/teleport/fly |
| `sunset_core:GetCharacter` export | per player per second | cached 15 s (3 s while no character) |
| Idle / loading | sampled every second | no ped or no character: skipped, re-polled 3 s, baseline dropped; still >= 5 samples: 2 s interval, any movement returns to 1 s |
| health_check | global every 5th tick burst | per-player 5 s timer |
| heartbeat-silence | per player per second | per player per 5 s (threshold is 30 s) |
| Work per second at 200 players | ~800+ native/export calls in ONE frame | ~600-800/s spread flat (~60-80 per 100 ms tick); idle/loading players cost ~half. Estimate. |

Detection quality: thresholds, sustain counts, cooldowns, margin (1.35), 150 m teleport, 3.0 m/s fly x5, +50 HP/armour are UNCHANGED. Speed uses real elapsed time between samples (more accurate than the old constant 1.0 s). Documented trade-off: a stationary player's first moving sample can arrive up to 2 s late (one extra second), teleport/speed still compare against the previous sample so a jump is caught on the next visit.
**Bug found and fixed:** the client sampler never sent `vehClass`, so `speed_check` could never run (class unknown -> resync every sample). `GetVehicleClass` now rides the tick. Mode is still `log_only`; expect speed ticks to start appearing, tune before enforcing.

### Other 1 Hz-ish per-player loops
| Loop | Finding | Action |
|---|---|---|
| sunset_core/server/security.lua (5 s integrity scan: banned weapon + teleport) | burst of N players every 5 s | staggered across ~4.5 s (`stepMs = 4500/N`), per-player dt window 1-6 s preserved |
| sunset_needs | already staggered (60 s / N) | verified |
| sunset_player autosave | already staggered | verified |
| sunset_economy payday | queued 2 per 500 ms | verified |
| sunset_economy playtime | 60 s, in-memory | verified |
| sunset_economy world clock | `-1` serverTime every 10 s (+ weather `-1` every 10 s) | clock kept (world minute advances each tick); weather now heartbeat every 60 s, immediate on change |
| scoreboard / hud server | event driven, scoreboard cached 2.5 s | verified, no loop |
| factions wanted decay (10 s) | iterates WantedOnline only, DB write throttled 60 s | verified |
| sessions deadlines, jobs, casino | owned elsewhere | not touched |

### `TriggerClientEvent(..., -1)` classification (resources I may edit)
| Site | Class | Action |
|---|---|---|
| businesses x5 `businessesChanged` | WASTE: only client consumer cached a list nothing read; every change made every client run `sunset:getBusinesses` (1 query each) | server broadcasts removed, client listener kept as no-op (sunset_inventory/trade.lua still emits it) |
| economy `serverTime` (10 s) | needs everyone (world clock) | kept |
| economy `serverWeather` | needs everyone, but unchanged state | 60 s heartbeat, instant on change |
| economy lottery chat x2 | needs everyone, rare | kept |
| properties `propertyDelta`/`propertiesVersion` | needs everyone (zones/blips), delta payload | kept |
| properties `propertiesChanged` x3 (admin rent cmds) | rare admin | kept |
| world `glueApply/Remove` | relevant to nearby players; networked vehicle state, rare | kept (REQUIRES LIVE TEST for a proximity filter) |
| hud `hudDefaultUpdated` x2 | admin layout push, rare | kept |
| chat `chat:clear`, admin sanction broadcast, admintools sampler/sweep | admin/rare | kept |
| dispatch/help `chat:addSuggestion` | boot only | kept |
| detention -1 | security-G2 | skipped |
| dropSync, trade, vehicles cleanupOwnedVehicles (5) | inventory/vehicles owners | skipped; vehicles `cleanupOwnedVehicles -1` with a plate list is a candidate for owner-targeted routing |
| blackjack 30, roulette 4, luckywheel, turfs 10, fishing_tournament 4, robbery 2, fire, jobs route_store | owners | skipped |

## 2. NUI send spam
| Sender | Before | After |
|---|---|---|
| sunset_hud `updateVehicleGauges` (30 Hz sampler) | sent every tick | only when speed (1 km/h), rpm (0.01), gear, engine, NOS state changed; 1 s keepalive; reset when leaving vehicle. Steady cruise/idle ~30 -> ~1 msg/s (estimate) |
| sunset_hud `updateHud` (2 Hz) | hash missed name/job/payday/heading/waypoint/time/voice (stale fields) | hash widened (adds ~1 send per heading octant/game minute) |
| sunset_menu `menuUpdate` (1 Hz while open) | unconditional | JSON compare, send on change |
| sunset_interactions player prompt | up to ~60 Hz position pushes | 30 Hz cap (+existing 0.15 % screen threshold) |
| sunset_ui `Send` | none | central duplicate drop for updateHud/updateVoice/updateVehicleGauges/menuUpdate (5 s keepalive, cache reset on showHud/hide/show/transition/pauseState) |
| voice, pause state, nametags (native draw), JobHud | already change-gated / native | verified |
Nothing sends per frame outside `Wait(0)` loops that are exempt/allowlisted in the lifecycle test.

## 3. Restart safety (what `restart X` now does)
| Resource | Stop | Start / re-init |
|---|---|---|
| sunset_ui | releases focus (existing); NEW: `onClientResourceStop` janitor releases focus owned by `legacy`/resource-named owner of any stopping sunset_* resource | NUI `bootEpoch` -> local event `sunset:ui:ready` (page (re)loaded); dedupe cache reset |
| sunset_hud | NEW: `hideHud`, `DisplayRadar(true)` | re-sends HUD on `sunset:ui:ready`; start path polls `IsPlayerReady` (bounded) instead of Wait(1000) |
| sunset_chat | NEW: releases chat focus/state | `sunset:ui:ready` -> chat state reset + suggestions resync |
| sunset_core | NEW (client): `Sunset.Ready=false`, forceCloseAll, undo black screen. Server already saved characters. | Restarting core drops all server sessions; the client boot pipeline re-runs = clean re-login (no half-state). Documented, not auto-recovered |
| sunset_spawn | NEW: stop load-scene/focus, unfreeze/visible/uninvincible, fade in | existing resume-if-spawned |
| sunset_death | NEW: stop scene/focus, controls, fade in, close 112 panel | NEW: `active` flag re-armed from core character (death loop was dead after restart) |
| sunset_properties | NEW server: walks players out of interiors (bucket 0 + exit teleport) ; client: radar + panel focus | NEW: refetch properties; `sunset:properties:requestRefresh` |
| sunset_world | blips/hints (existing) | NEW: asks properties for zones again |
| sunset_phone | NEW: phone anim + focus released | gated on `IsPlayerReady` |
| sunset_menu | NEW: releases cursor if open | gated on `IsPlayerReady` |
| sunset_inventory / sunset_vehicles client | owned by other agents, NOT edited. Inventory props/stop handler existed from the prior pass; vehicles speedometer relies on hud + this `sunset:ui:ready` | owners should listen to `sunset:ui:ready` |
Note: threads/handlers of a stopped resource are destroyed by FiveM, so duplicates cannot appear on restart; the work is state recovery and releasing global engine state.

## 4. Startup/login readiness
- New client export `exports.sunset_core:IsPlayerReady()` (account ready AND character loaded AND spawn flow finished). Gates: phone open, M menu open; used by hud/phone avatar/factions loadout instead of blind `Wait(1000/2000/2500)`.
- Not gated (owners): inventory open, jobs UI. Recommended: `if not exports.sunset_core:IsPlayerReady() then return end`.
- LSIA default spawn fallback already logs every skipped tier with the reason (previous pass, `[SPAWN] ... DEFAULT spawn`); re-verified present.
- Remaining blind waits are allowlisted in `scripts/lifecycle-allowlist.json` with reasons.

## 5. Entity cleanup sweep
Done as a static guard rather than a re-audit: `scripts/test-lifecycle.js` check A flags any resource creating cameras/blips/peds/vehicles/objects/fx/focus without an `onResourceStop`+`GetCurrentResourceName()` handler. After this pass the 10 focus-only resources (auth, businesses, characters, clans, crafting, documents, economy, emotes, impound, marriage) are covered by the central janitor and allowlisted; no resource creating entities/cams/blips lacks a handler. Per-entity paths for complete/cancel/drop/death/timeout were NOT re-read for allowed resources beyond the prior audit (PARTIALLY VERIFIED).

## 6. Test guard
`node scripts/test-lifecycle.js` — A stop cleanup, B fast loops sending NUI without change detection, C blind `Wait(N)` before cross-resource exports. Allowlist: `scripts/lifecycle-allowlist.json` (reason required, stale entries reported). Add to the pre-commit list in AGENTS.md.

## 7. Residual live tests (REQUIRES LIVE TEST)
1. `resmon` with 100+ bots (or `scripts/benchmark-load.js`): sunset_anticheat server ms/tick; expect flat ~<0.5 ms per 100 ms tick. Compare `profiler record 300`.
2. Speed detection: drive a sports car legitimately across the map in log_only; confirm no speed ticks; then use admin vehicle boost and confirm a tick appears (newly live).
3. `restart sunset_ui` while on foot, then in a car: HUD, gauges, chat suggestions return within ~1 s; cursor free; open M, phone afterwards.
4. `restart sunset_hud / sunset_chat (chat open) / sunset_phone (open) / sunset_menu (open) / sunset_death (while downed) / sunset_spawn (during spawn fade) / sunset_world / sunset_properties (inside a house)`: no stuck cursor, black screen, frozen/invisible ped; death loop still works after death restart (`/die`); house exit lands at the entrance.
5. `restart sunset_core` as a connected player: expect re-login flow, no stuck focus.
6. Open the vehicle `updateVehicleGauges` in NUI DevTools: idle in car -> ~1 msg/s, accelerating -> bursts only; `/nuistats` payload table.
7. Businesses: buy/transfer a business with 2 clients, confirm no `sunset:getBusinesses` callbacks fire (server log) and blips/shops still work.
8. Pre-login: press M and phone key on the login/spawn screen: nothing opens.
9. Weather: set `/weather` as admin, a client joining 30 s later receives it within 60 s (known 10 s -> 60 s trade-off; consider a join sync).
10. Security scan (core): teleport 400 m with admin off, confirm the webhook/log still fires within ~5 s.
