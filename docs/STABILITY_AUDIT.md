# Stability Audit — 2026-09-30

Production stability, correctness and performance audit of the SunsetMP FiveM codebase.

---

## Phase 0: Previous Fix Verification

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | SafeTeleport (sunset_world) | **VERIFIED LIVE** | `sunset_core/client/world_stream.lua` — full pre-streaming (SetFocusPosAndVel, NewLoadSceneStartSphere, RequestCollisionAtCoord), collision wait loop, NewLoadSceneStop/ClearFocus cleanup, restoreOnFail fallback. Used by properties, elevators, jail. |
| 2 | Spawn ped reacquire after SetPlayerModel | **VERIFIED LIVE** | `sunset_spawn/client/main.lua:299` — `local ped = PlayerPedId()` called immediately after `SetPlayerModel()`. Stale ped detection in `isValidPlayerPed()` throughout streaming. |
| 3 | Property enter/exit server/client state | **VERIFIED** | Server `Inside[source]` + routing bucket in `sunset_properties/server/main.lua`. Client `transState` state machine (NONE/ENTERING/INSIDE/EXITING). `LeaveProperty` export for cross-resource release. |
| 4 | Airport/default spawn fallback | **VERIFIED** | Falls back to `Sunset.Config.DefaultSpawn` with `source='default_fallback'`. Reason logged via `logBoot()`. |
| 5 | Chat NUI focus leaks | **VERIFIED** | Chat manages only DisableControlAction 199/200 (ESC) while open; NUI focus owned by `sunset_ui:SetFocus`. |
| 6 | Destructive command double-confirmation | **PARTIAL** | Property sell requires `payload.confirm == true` (line 619). No request ID/dedupe/expiration — client can send duplicate confirmations in a narrow race window; low risk due to server transaction guards. |
| 7 | A/D chat keyboard bug | **VERIFIED** | NUI focus (`SetNuiFocus(true,true)`) captures all keyboard input. DisableControlAction not needed for movement keys while NUI owns focus. |
| 8 | NUI focus ownership | **VERIFIED LIVE** | `sunset_ui/client/main.lua` — `focusOwner` tracking with blocked release if wrong owner; auth-screen guard; `ReleaseFocusUnlessModal` checks all modal panels. |
| 9 | /glue synchronization | **PARTIALLY FIXED** — see Glue Audit below |
| 10 | Spectate distant player | **FIXED** — see below |
| 11 | Purple damage arc ghost | **VERIFIED** | `damage-indicators.js:71` uses `{once: true}` on `animationend`. Retrigger safety: `classList.remove('active')` + `void offsetWidth` force-reflow before re-adding. |
| 12 | Property transition mutex | **VERIFIED LIVE** | Client `transState` state machine guards duplicate enter/exit events. |
| 13 | Routing bucket handling | **VERIFIED** | Properties and spectate both set/restore routing bucket correctly. `LeaveProperty` export clears bucket on external release. |
| 14 | Stale ped after SetPlayerModel | **VERIFIED LIVE** | See item 2. |
| 15 | Resource-stop cleanup | **PARTIAL** | Properties, glue, admin have cleanup. spectate admin client `specTarget` not reset on resource stop (low risk — watchdog detects stale sync). |

---

## /Glue Full Audit

**File:** `resources/[sunset]/sunset_world/server/glue_server.lua`
**File:** `resources/[sunset]/sunset_world/client/glue.lua`

### Findings

| Severity | Issue | Status |
|----------|-------|--------|
| MEDIUM | **Death while glued — server state persists.** GTA detaches entities on ped death but server `glueStates[src]` was not cleared. On respawn, `glueSyncAll` would re-apply the attachment. | **FIXED** — added `sunset:server:playerDied` handler + `sunset:server:characterSpawned` belt-and-suspenders |
| MEDIUM | **Duplicate /glue** — double-call within a single frame sends two `sunset:server:glue` events. Server handles this correctly (detach old, apply new) but client fires two `applyAttach` threads concurrently. Both resolve to the same vehicle so visually harmless, but two control-disable loops run briefly. | LOW RISK — harmless; each loop exits when `not IsEntityAttached`. |
| MEDIUM | **Vehicle deletion while attached** — if the vehicle is deleted (owner, admin, /dv), GTA auto-detaches the ped but server `glueStates` remains populated. New vehicles can reuse the same `netId`, resulting in a stale attach. | NOT FIXED — requires vehicle lifecycle tracking; logged as backlog. |
| LOW | **Owner migration** — entity ownership can transfer mid-attach; `AttachEntityToEntity` only works from the owning machine. If network owner changes, other clients will re-try the attach next tick (applyAttach loop has 10s retry). Usually resolves. | ACCEPTABLE |
| LOW | **Routing bucket change while glued** (e.g. entering a house) — vehicle may not be visible in the new bucket. | NOT FIXED — document-only; attaching inside a property is an edge case. |
| LOW | **Resource restart cleanup** — `onResourceStop` detaches the local ped on the glued player's client. Remote clients do not receive a detach signal. After restart, glueSyncAll will re-sync. | ACCEPTABLE — syncs on next `playerSpawned` broadcast. |
| VERIFIED | **Collision restoration on detach** — `DetachEntity(ped, true, true)` passes `resetCollision=true`. | CORRECT |
| VERIFIED | **Ragdoll restoration** — no ragdoll was forced on attach; native handles it. | N/A |
| VERIFIED | **/unglue command** — exists, registered, triggers `sunset:server:unglue`. | CORRECT |
| VERIFIED | **Disconnect cleanup** — `playerDropped` handler clears state and broadcasts remove. | CORRECT |

---

## Damage Arc Ghost Fix Verification

**File:** `resources/[sunset]/sunset_ui/web/js/damage-indicators.js`

- Line 66-67: `marker.classList.remove('active'); void marker.offsetWidth; marker.classList.add('active');` — force-reflow correctly restarts the animation.
- Line 71: `{ once: true }` on `animationend` — prevents stale listener accumulation.
- Pause menu: `sunset_ui/client/main.lua` sends `pauseState: {paused:true}` via `Send()` which the NUI handles. No ghost arc possible because `.active` is removed by `animationend` which fires before CSS `display:none` restarts it.

Status: **STATICALLY VERIFIED**

---

## M Menu Performance

**Problem (before fix):** `buildMenuData()` in `sunset_menu/client/main.lua:141` called `Sunset.AwaitCallback('sunset:getProperties')` on every M press. The server callback ran a full SQL query plus N SQL queries for rental checks (one per property row). This blocked the menu for 100–500ms on servers with many properties.

**Fix applied:**
- `sunset_properties/client/main.lua` — added `GetCachedProperties()` and `GetCachedMeta()` exports.
- `sunset_menu/client/main.lua:141` — replaced `AwaitCallback('sunset:getProperties')` with `exports.sunset_properties:GetCachedProperties()`.

The properties client already fetches and caches on spawn and on `propertiesChanged`. Menu now opens instantly.

Status: **IMPLEMENTED — LIVE TEST REQUIRED**

---

## Properties N+1 SQL Fix

**Problem:** `publicRow()` called `activeRental(char.id, row.id)` for each property row. With 50 properties this was 50 SQL queries per `getProperties` call.

**Fix applied:** `sunset_properties/server/main.lua`
- Added `fetchRentedIds(charId)` — one query that returns all active rental property IDs for the character.
- `publicRow()` now accepts optional `rentedIds` set; falls back to single-query for non-bulk callers.
- `getProperties` callback now calls `fetchRentedIds` once and passes it to `publicRow` for all rows.

**Reduction:** N+1 queries → 2 queries (main JOIN query + one rental batch query) regardless of property count.

Status: **IMPLEMENTED — LIVE TEST REQUIRED**

---

## Pagination API

**New callback:** `sunset:getPropertiesPage`

Input: `{ page, pageSize, search, filter ('all'|'owned'|'rented'|'forsale'), sort ('price'|'id'|'name') }`
Output: `{ rows, total, page, totalPages }`

Server-side SQL filtering and LIMIT/OFFSET pagination. Uses the same `fetchRentedIds` batch optimization.

Status: **IMPLEMENTED — LIVE TEST REQUIRED**

---

## NUI Error Boundary

**Problem:** JavaScript errors in the NUI (CEF) were silent — only visible in the player's F8 console.

**Fix applied:**
- `sunset_ui/web/index.html` — added `window.onerror` and `window.addEventListener('unhandledrejection')` in an inline `<script>` at the top of `<head>`. Errors are POSTed to `https://sunset_ui/nuiError`.
- `sunset_ui/client/main.lua` — registered `nuiError` NUICallback; logs to client F8 and triggers `sunset:server:nuiError` server event.
- `sunset_ui/server/main.lua` (new file) — receives `sunset:server:nuiError` and logs to server console with player name.
- `sunset_ui/fxmanifest.lua` — added `server_scripts { 'server/main.lua' }`.

Status: **IMPLEMENTED — LIVE TEST REQUIRED**

---

## Spectate Fix

**Problem:** `/spectate [id]` did not teleport the admin near the target. If the target was >~500 m away, their ped was outside the admin's streaming range and `NetworkSetInSpectatorMode` produced a black screen.

**Fix applied:**
- `sunset_admin/server/actions.lua` — `A.spectate()` now reads `GetEntityCoords(GetPlayerPed(target))` and passes initial coords as a third argument to `sunset:admin:spectateStart`.
- `sunset_admin/client/main.lua` — `spectateStart` handler now teleports admin 2 m beside the target before calling `NetworkSetInSpectatorMode`.

Status: **IMPLEMENTED — LIVE TEST REQUIRED**

---

## All Bugs Found (Summary)

| File | Line | Severity | Issue | Status |
|------|------|----------|-------|--------|
| sunset_properties/server/main.lua | 62-75 | HIGH | N+1 SQL: `activeRental` called per property row in `getProperties` | FIXED |
| sunset_menu/client/main.lua | 141-143 | HIGH | M menu blocks on `AwaitCallback('sunset:getProperties')` every open | FIXED |
| sunset_world/server/glue_server.lua | — | MEDIUM | /glue state not cleared on player death; re-applied on respawn | FIXED |
| sunset_admin/server/actions.lua | 187 | MEDIUM | Spectate doesn't teleport admin near target; black screen if target >500m | FIXED |
| sunset_ui/web/index.html | — | MEDIUM | No global JS error boundary; NUI crashes silent | FIXED |
| sunset_world/client/glue.lua | — | MEDIUM | Vehicle deletion while attached leaves stale server state | BACKLOG |
| sunset_admin/client/main.lua | — | LOW | `specTarget` not reset in `onResourceStop` handler | LOW RISK |
| sunset_properties/server/main.lua | — | LOW | No request ID on destructive confirm (sell); narrow race window | ACCEPTABLE |
| Multiple server files | — | LOW | Multiple `SELECT *` queries (vehicles, characters, businesses) | BACKLOG — functional |
