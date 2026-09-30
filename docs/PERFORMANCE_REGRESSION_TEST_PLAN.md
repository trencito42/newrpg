# Performance Regression Test Plan — 2026-09-30

Test scenarios to verify the fixes from this audit session do not regress existing behavior.

---

## 1. M Menu Open Speed

**Covers:** Lazy properties load fix (AUDIT MENU-LAZY)

**Steps:**
1. Join server with a character that owns ≥ 1 property.
2. Press M. Note time from keypress to menu appearing (should be < 100 ms visual).
3. Navigate to the Properties tab. Properties should appear within 200ms (already cached from spawn).
4. Press M again to close; reopen — should be equally fast.

**Pass:** Menu appears without visible delay; Properties tab populates immediately.
**Fail:** Menu hangs for 200–500ms before appearing (indicates properties still fetched on open).

---

## 2. Properties Panel N+1 SQL

**Covers:** `fetchRentedIds` batch fix (AUDIT SQL-1)

**Steps (database):**
1. Enable slow query log: `SET GLOBAL slow_query_log = 1; SET GLOBAL long_query_time = 0;`
2. Connect as a player who rents a property.
3. Open `/properties` (triggers `sunset:getProperties` server callback).
4. Check slow query log — expect exactly **2 queries** for `properties`: the main JOIN and one `property_rentals WHERE character_id=?` batch.

**Pass:** Only 2 queries, regardless of how many properties exist.
**Fail:** Multiple `property_rentals WHERE character_id=? AND active=1 AND property_id=?` queries (N+1 pattern).

---

## 3. /glue Death Cleanup

**Covers:** `sunset:server:playerDied` and `characterSpawned` cleanup (AUDIT GLUE-DEATH)

**Steps:**
1. Admin types `/glue` near a vehicle. Confirm attachment.
2. Admin kills the glued player (or player jumps off a building).
3. Player goes through the respawn/wasted screen and respawns.
4. **Expected:** Player is NOT attached to the vehicle after respawn.
5. Remote player watching should also not see the player re-attached.

**Pass:** Player respawns without attachment; no notification about "Glued to [plate]" on respawn.
**Fail:** Player respawns and immediately flies with the vehicle.

---

## 4. Spectate Distant Player

**Covers:** Initial coords teleport fix (AUDIT SPECTATE-DIST)

**Steps:**
1. Admin and target player are in different parts of the map (> 1000m apart).
2. Admin types `/spectate [target_id]`.
3. Admin's screen should briefly show a teleport (admin ped moves near target).
4. Admin should see the target's POV within 2 seconds.

**Pass:** Spectate view loads within 2 seconds of command; target visible.
**Fail:** Black or empty spectate view; must wait for 6s watchdog timeout.

---

## 5. NUI Error Boundary

**Covers:** `window.onerror` / `unhandledrejection` boundary

**Steps (devtools method):**
1. Open FiveM dev console (if available) or inject via a test resource.
2. Trigger a deliberate JS error: `NUI.postMessage({ action: 'INVALID_ACTION_XYZ' })`.
3. Or: test resource calls `exports.sunset_ui:Send('__test_throw', {})` and adds a handler that does `throw new Error('test')`.
4. Check server console — expect `[NUI-ERROR ...]` line with message and player name.

**Pass:** Server console shows the error log within 2 seconds.
**Fail:** Error silently swallowed; nothing in server console.

---

## 6. Properties Pagination API

**Covers:** `sunset:getPropertiesPage` (AUDIT PAGINATION)

**Steps:**
1. From a test resource or NUI dev console:
   ```lua
   local result = Sunset.AwaitCallback('sunset:getPropertiesPage', {
       page = 1, pageSize = 5, search = '', filter = 'all', sort = 'price'
   })
   print(result.total, result.totalPages, #result.rows)
   ```
2. Verify `total` matches `SELECT COUNT(*) FROM properties WHERE enabled=1`.
3. Call with `page = 2` — verify different rows returned.
4. Call with `filter = 'forsale'` — verify only `for_sale=1 AND owner_character_id IS NULL` rows.
5. Call with `search = 'Villa'` — verify only matching rows.

**Pass:** Correct rows, correct total, correct pagination math.
**Fail:** Missing rows, wrong totals, or SQL error.

---

## 7. Property Enter/Exit Mutex (Regression)

**Covers:** No regression in `transState` machine from the N+1 fix.

**Steps:**
1. Stand at a property entrance marker. Rapidly press E 5 times.
2. Player should enter the property exactly once.
3. Inside, press E at the exit marker rapidly.
4. Player should exit exactly once.

**Pass:** Single entry, single exit.
**Fail:** Double-teleport, stuck in `TRANS_ENTERING` state, or duplicate routing bucket assignment.

---

## 8. SafeTeleport Regression

**Covers:** No regression in `Sunset.World.SafeTeleport` from world_stream changes.

**Steps:**
1. Enter and exit a property (uses SafeTeleport).
2. Use an elevator (uses SafeTeleport).
3. Admin `/tp` to a remote coordinate (uses admin teleport with collision request).

**Pass:** Smooth teleport; no fall-through; `ClearFocus()` called (radar/minimap behaves normally after).
**Fail:** Fall-through world; radar disappears; focus stuck at previous location.

---

## 9. Resource Restart Safety

**Covers:** Cleanup on `onResourceStop`.

**Steps:**
1. While a player is glued: `restart sunset_world` on server.
2. Player should be detached client-side (onResourceStop handler).
3. While a player is inside a property: `restart sunset_properties`.
4. Player should be teleported back to entry (routing bucket reset to 0).

**Pass:** Detach/reset works; no zombie state after restart.
**Fail:** Player stuck inside property bucket; still attached after world restart.

---

## Automation Hook

The test results above should be added to the `sunset_test_agent` suite as:
- `glue_death_cleanup` — spawn, glue, kill, respawn, assert no attachment
- `properties_no_n1` — query log check for getProperties
- `menu_open_latency` — time-to-display metric for M menu
- `spectate_distant` — spectate target 1km away, assert non-black view within 3s
