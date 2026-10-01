# Client Performance + Entity/World Lifecycle Audit

Scope: client Lua under `resources/[sunset]/` (123 client files). Excluded (owned by another agent): sunset_jobs, sunset_taxi, sunset_fishingshop, sunset_fishing_tournament, sunset_racing, sunset_quests, sunset_missions client code, and sunset_ui/web. Builds on `docs/STABILITY_AUDIT.md` and `docs/WORLD_STREAMING_ARCHITECTURE.md` (not redone).

Method: static only (grep + a small loop-structure parser). **No resmon numbers were measured; all CPU figures below are estimates and REQUIRE LIVE FIVEM TEST.**

## 1. Loop inventory (counts)

| Metric | Count |
|---|---|
| Client files scanned | 123 |
| `CreateThread` / `Citizen.CreateThread` lines | 353 |
| `SetTimeout` calls | 26 |
| `while ... do` loops parsed | 255 |
| - stream/fade/scene wait loops (bounded after this pass) | 74 |
| - adaptive (Wait(0) only in active branch, else 100-1500 ms) | 51 |
| - non-zero waits only | 99 |
| - always `Wait(0)` (all justified, see below) | 23 |
| - no Wait (string/table helpers, not frame loops) | 8 |
| `Wait(0)` occurrences | 102 |

Result: the code base was already largely adaptive. Most `Wait(0)` loops are gated by distance/state and sleep 200-1000 ms otherwise.

### Always-Wait(0) loops (23) - classification

| Location | Class | Action |
|---|---|---|
| sunset_hud/client/world.lua:107 (density) | Necessary (`*ThisFrame` natives) | FIXED: non-frame natives (SetGarbageTrucks, SetCreateRandomCops*, DistantCopCarSirens, DisablePlayerVehicleRewards, wanted clear) moved to a 1 s sub-cadence; PlayerId() cached |
| sunset_core/client/boot_debug.lua:144 (hitch watchdog) | Necessary per frame, self-terminating (15 s after GAMEPLAY) | FIXED: `GetBootState` export no longer called every frame (only until GAMEPLAY seen / on a hitch) |
| sunset_phone/client/main.lua:165 (P key) | Necessary (DisableControlAction) | Kept |
| sunset_scoreboard/client/main.lua:41 (Z key) | Necessary (control poll), yields 100 ms when paused/NUI | Kept |
| sunset_inventory/client/quickslots.lua:155 (X key) | Necessary (control poll), 100 ms when paused/NUI | Kept |
| sunset_world/client/glue.lua:52 | One-shot, exits when detached | Kept |
| sunset_admin veh_gizmo / admintools profiler / devtools gizmo, world_probe | Active-only tools (exit when inactive) | Kept |
| sunset_licenses/client/tests.lua:583/737/880 | Active only while a practical test runs | Kept |
| sunset_roulette/client.lua:165,255,287 | Active only while seated | Kept |
| sunset_blackjack/client.lua:583 (commented-out block), 1441/1462/1466 | Active only in table leave flow | Kept |
| sunset_blackjack/client.lua:247 (render thread) | Unnecessary Wait(0) while nobody seated | FIXED: 250 ms idle, Wait(0) only when a draw flag / atTable / debug is set |
| sunset_appearance 87/95, auth 124/135, core/main 43/44/153, tuning dyno 178, exhaust_ptfx 145, factions police 1350 | Bounded (deadline/boot) | Kept |

### Adaptive loops with fixes

| Location | Class before | Action |
|---|---|---|
| sunset_carjack/client/main.lua:103 | Per-frame `GetGamePool('CVehicle')` scan whenever a vehicle was within lockpick range (sleep=0) | FIXED: scan at 250 ms when near a vehicle, 100 ms near NPC; G-key thread (already Wait(0) only when active) still polls per frame |
| sunset_hud/client/main.lua:624 (nametags) | `HasEntityClearLosToEntity` raycast per nearby player per frame | FIXED: LOS cached per 200 ms metadata refresh |
| sunset_tuning/client/main.lua:411 (Harmony shop) | Rebuilt shop lookup loop + `Wait(0)` every iteration | FIXED: lookup hoisted; Wait(0) only when in interact range with a vehicle; 1000 ms when >30 m away |
| sunset_hud/client/world.lua:140 cleanup scan | GetGamePool CVehicle+CPed every 2.5 s | Kept (already throttled) |

Other `GetGamePool` users (admin debug, inspector, route_creator, dealership preview cleanup, tuning apply, glue, vehicles, robbery, casino discovery) run on command/event or at >=2.5 s; none per-frame after the carjack fix. VERIFIED.

### Estimated resmon impact (ESTIMATES, REQUIRES LIVE FIVEM TEST)

| Offender | Idle | Near | Active |
|---|---|---|---|
| carjack proximity (before) | ~0.02 ms | 0.15-0.4 ms per frame while within 4 m of any vehicle (pool scan per frame) | n/a |
| carjack proximity (after) | ~0.02 ms | ~0.02-0.05 ms | n/a |
| blackjack render thread (before/after) | ~0.01 ms always on / ~0.00 ms | 0.02-0.05 ms | unchanged |
| hud density loop | ~0.03 ms -> ~0.02 ms | same | same |
| hud nametags per nearby player | LOS raycast per frame -> per 200 ms | | |

## 2. Entity / camera / streaming lifecycle

### Fixes made

| Resource / file | Problem | Fix |
|---|---|---|
| sunset_roulette/client.lua | `AddEventHandler('onResourceStop', deleteHighlights)` ran on EVERY resource stop (no name check) and cleared highlights of any player mid-game; two scripted cams created per sit were never `DestroyCam`'d; scripted cam stayed rendering on restart | Name-checked handler, `RenderScriptCams(false)` on stop, `DestroyCam` x2 after the cam loop |
| sunset_slots/client.lua | `onResourceStop` called `unsit()` before it was defined (nil global) -> error aborted all cleanup (chairs, cam, sync scene) | Forward-declared `unsitHook`, pcall'd, cleanup order fixed |
| sunset_blackjack/client.lua | 10 unbounded `repeat Wait(0) until Has*Loaded`; models never released | New `BJWaitUntil(check, timeoutMs=8000)`; `SetModelAsNoLongerNeeded` after 5 Create sites |
| sunset_core/client/world_stream.lua | `while not IsScreenFadedOut()` unbounded; no stop handler | 2 s bounded fade wait; `teleportInProgress` flag + stop handler (NewLoadSceneStop, ClearFocus, unfreeze) |
| sunset_world/client/elevators.lua:21, sunset_devtools/route_creator.lua:38 | unbounded fade waits | bounded (3 s) |
| sunset_hud/client/main.lua:322 | unbounded minimap scaleform wait could stall the HUD-hide loop forever | 10 s bound, loop continues |
| sunset_carjack, emotes, luckywheel (x3), skins, slots (x2), spawn, roulette checkObject | unbounded RequestModel/RequestAnimDict/entity waits | timeouts added (3-15 s) with safe abort |
| sunset_admin/client/main.lua + veh_gizmo.lua | No stop handler: godmode, noclip freeze/collision, freeze, spectate invisibility, gizmo-frozen vehicle left behind | New stop handlers restore all |
| sunset_appearance/client/main.lua | No stop handler: studio cam, focus, frozen collision-less ped, radar, NUI focus | New stop handler |
| sunset_ui/client + sunset_auth_ui/client | No stop handler: NUI focus/keep-input stuck on restart | New stop handlers release focus |
| sunset_casino/client/main.lua | No stop handler: blip, UI | New stop handler |
| sunset_inventory/client/props.lua | Held hotbar prop not deleted on stop | New stop handler |
| sunset_factions/client/police.lua | booking blips and fixed-radar blips never removed | tracked + removed on stop |
| sunset_turfs/client/main.lua | turf zone/war blips never removed on stop | `clearTurfBlips`/`clearWarPlayerBlips` on stop |
| sunset_world main.lua / stores_247.lua, sunset_dealership, sunset_tuning | static blips untracked | tracked + removed on stop |

### Already correct (VERIFIED by reading)
carjack (peds+blips), clothing (cam/focus/snapshot), dealership (preview veh/cam/HD area/test drive), events, dispatch, cnn, licenses, menu/phone (headshots), robbery (bag, fence, blips, doors), fire, factions (fleet, detention, tracking, radar vehicle), skins, devtools, tuning (cam, ptfx, nitrous), world (peds, tooltips), sessions, death/spawn (every `NewLoadSceneStart` paired with Stop+ClearFocus on all branches).

### Local vs networked entities
Not changed. Networked creates found (admin spawn, faction fleet, fire engines, dealership test drive, license tests/targets with `ObjToNet` + server registration, inventory held props, phone prop) all have server or other-client dependencies or must be visible to others. Local-only already used for peds/props in casino, world NPCs, carjack NPCs, dealership preview. No change was safe to make blind. PARTIALLY VERIFIED.

## 3. Resource-restart safety
- Threads and event handlers are torn down by FiveM on resource stop; duplication on restart is not possible for resource-local handlers (VERIFIED by semantics).
- Orphaned entities: all created peds/vehicles/objects in the scanned scope now have stop-handler deletion except intentionally persistent player vehicles (sunset_vehicles).
- Stuck focus/controls/freeze: covered above for admin, appearance, core teleport, ui, auth_ui, clothing, tuning, turfs, detention.
- Whether FiveM auto-removes script-created blips on stop: not verified; explicit removal was added for all tracked blips. REQUIRES LIVE FIVEM TEST (restart each resource twice, check blip/entity counts).

## 4. Remaining / not done
- `RemoveAnimDict` is rarely called repo-wide (only inventory); anim dicts are cheap, left as is.
- spawnedObjects in blackjack grows with dead handles (memory only, legacy script).
- Per-frame control polling for P / Z / X keys across phone, scoreboard, quickslots is kept: required for DisableControlAction.
- jobs/taxi/fishing*/racing/quests/missions client files were NOT scanned (other agent). Same classes (unbounded waits, missing stop handlers) should be checked there.
- Properties interior radar hide (DisplayRadar(false)) relies on the HUD thread to restore on restart.

## 5. Checks
- `node scripts/check-lua-syntax.js`: 414 files OK, 0 errors.
- `node scripts/check-lua-forward-refs.js`: 0 issues in sunset resources (5 pre-existing vendor issues in ox_lib/ox_inventory).
- `node scripts/check-nui-bridge.js`: all 205 posted NUI callbacks registered.

## 6. Status
| Item | Status |
|---|---|
| Loop inventory | VERIFIED (static) |
| Wasteful loop fixes (carjack, nametag LOS, blackjack render, hud density, tuning Harmony, boot watchdog) | FIXED |
| Unbounded stream/fade waits (all non-excluded files) | FIXED |
| Missing stop handlers (admin, appearance, ui, auth_ui, casino, inventory props, core) | FIXED |
| Blip cleanup | FIXED, REQUIRES LIVE FIVEM TEST |
| resmon numbers | REQUIRES LIVE FIVEM TEST |
| Networked -> local conversion | PARTIALLY VERIFIED (none changed) |
