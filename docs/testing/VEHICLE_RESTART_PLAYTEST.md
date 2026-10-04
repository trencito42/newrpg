# Vehicle Engine Health — Manual Playtest Guide

Tests for the engine/body/fuel persistence hardening introduced in the
`fix: harden vehicle health persistence across restart` commit.

Enable `Sunset.Config.VehiclePersistenceDebug = true` in
`resources/[sunset]/sunset_vehicles/shared/vehicle_config.lua` before running
these tests. **Disable it again before deploying to production.**

---

## Test 1 — Normal disconnect health preserved

**Goal:** Verifies health persists correctly across a normal player disconnect.

1. Spawn your personal vehicle.
2. Drive until engine health drops to ~800 (use `/vehstate` to read it).
3. Disconnect from the server (close client).
4. Reconnect and spawn the same vehicle.
5. **Expected:** `/vehstate` shows DB engine ≈ 800 and entity engine ≈ 800.
   Server log should show `[VEH_PERSIST] PLAYER_DROPPED … using=cache` (if a
   periodic sync ran) or `using=entity` (if disconnect happened before first sync).

---

## Test 2 — Full resource restart (not full FXServer restart)

**Goal:** Verifies that stored=0 rows are reconciled to stored=1 on resource restart.

1. Spawn your vehicle, note plate.
2. Leave it in the world and run `/restart sunset_vehicles` from txAdmin.
3. Check server log for: `Boot reconciliation: 1 vehicle(s) with stored=0 set to stored=1`.
4. Open `/v` garage — vehicle should appear as stored (not "out").
5. Spawn it again.
6. **Expected:** Engine and body match the last sync; fuel unchanged.

---

## Test 3 — Fuel=0 preserved across spawn

**Goal:** Verifies that a genuinely empty tank stays empty.

1. Run out of fuel (drive until engine stops).
2. Store the vehicle at a garage (while sitting in it or via `/v`).
3. Spawn it again.
4. **Expected:** Fuel gauge shows 0 or near-0. The vehicle should NOT spawn with
   a full tank (the old `fuel <= 0 → 100` bug would have done that).

---

## Test 4 — Spawn grace prevents collision damage on spawn

**Goal:** Verifies the per-vehicle grace window.

1. Spawn two owned vehicles in quick succession (spawn first, then drive nearby
   and spawn second while first is still settling on the ground).
2. Note engine health of both via `/vehstate` immediately after.
3. **Expected:** Both vehicles retain their DB engine health. Neither should have
   taken spawn-collision damage (logged as `[VEH_PERSIST] SPAWN_DRIFT` only if
   there is a genuine discrepancy above 5 HP).

---

## Test 5 — /vehstate shows correct DB vs entity values (admin only)

**Goal:** Verifies the debug command.

1. As admin (level 3+), get in any owned vehicle.
2. Run `/vehstate` in chat.
3. **Expected:** Chat shows four lines:
   ```
   [VehState] plate=ABC123 id=42
     DB engine: 998.0  Entity engine: 998.0
     DB body:   990.0  Entity body:   990.0
     DB fuel:    45.0  Entity fuel:    45.0
     stored: 0  destroyed: 0
   ```
4. As a non-admin player, run `/vehstate`.
5. **Expected:** Chat shows `vehstate: not your vehicle / not admin`.

---

## Test 6 — Vehicle health after full FXServer restart

**Goal:** The hardest test — verifies Fix 1 (the VehicleRuntimeState cache).

1. Spawn your vehicle. Drive it until engine ≈ 700.
2. Wait at least 35 seconds (one full periodic sync cycle) — confirm
   `[VEH_PERSIST] SYNC … reason=periodic` appears in server logs.
3. Full FXServer restart (not resource restart).
4. Reconnect. Spawn the vehicle.
5. **Expected:** Engine is ≈ 700 (the last synced value). NOT 0.
   Server log on the new session: `[VEH_PERSIST] SPAWN id=… dbEngine=700.x`.

---

## Checking logs

```bash
docker logs blazed-fivem-1 --since 5m | grep VEH_PERSIST
```

Key log lines to watch for:

| Line | Meaning |
|------|---------|
| `SPAWN id=…` | Vehicle spawned from garage — shows DB values applied |
| `APPLIED id=…` | Entity health read back after spawn — drift shows GTA interference |
| `SPAWN_DRIFT` | Entity health diverged >5 HP from what was written |
| `SYNC id=… reason=periodic` | 30-second sync saved successfully |
| `PLAYER_DROPPED … using=cache` | Good — cache used on disconnect |
| `PLAYER_DROPPED … using=entity` | Entity was readable; no cache needed |
| `PLAYER_DROPPED … using=skip` | Both entity and cache were 0 — health write skipped |
