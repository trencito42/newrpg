# World Streaming Architecture
## SunsetMP — Safe Teleport System

*Added in audit series commit 8fd056d*

---

## Problem

GTA V / FiveM loads world collision asynchronously. Teleporting an entity before
the destination's collision is ready causes it to fall through unloaded map geometry.
Before this system, every teleport callsite in the gamemode did:

```lua
SetEntityCoordsNoOffset(ped, x, y, z, ...)  -- moved entity BEFORE collision loaded
```

This caused players to:
- Fall through floors when entering/exiting properties
- Spawn under the map and get sent to the LSIA `DefaultSpawn` fallback
- Fall through jail cell floors on arrest
- Fall through elevator destinations

---

## Solution: `Sunset.World.SafeTeleport`

Defined in `sunset_core/client/world_stream.lua`. Loaded as a shared client script
into any resource that needs it via `@sunset_core/client/world_stream.lua` in `fxmanifest.lua`.

### How it works

1. **Fade out** (optional, default on)
2. **Freeze entity** — stops drift during loading
3. **Pre-stream destination** with `SetFocusPosAndVel` + `NewLoadSceneStartSphere` at destination
4. **Request collision** with `RequestCollisionAtCoord`
5. **Wait** (`prestreamMs`, default 300ms) for streaming to kick in
6. **Move entity** to destination with `SetEntityCoordsNoOffset`
7. **Poll** `HasCollisionLoadedAroundEntity` up to `timeout` ms (default 8000ms)
8. **`NewLoadSceneStop` + `ClearFocus`** — release streaming focus
9. **On timeout**: optionally restore to previous position (`restoreOnFail`, default true)
10. **Unfreeze** + fade in

### API

```lua
local ok = Sunset.World.SafeTeleport(coords4, opts)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coords4` | `vector4` | required | Destination `{x,y,z,w}` (w = heading) |
| `opts.fade` | boolean | `true` | Whether to fade screen |
| `opts.fadeOutMs` | number | `400` | Fade-out duration ms |
| `opts.fadeInMs` | number | `500` | Fade-in duration ms |
| `opts.loadRadius` | number | `80.0` | Streaming sphere radius |
| `opts.prestreamMs` | number | `300` | Pre-move wait ms |
| `opts.timeout` | number | `8000` | Max collision wait ms |
| `opts.restoreOnFail` | boolean | `true` | Restore to origin on timeout |

Returns `true` if collision loaded in time, `false` if timed out.

### Important: `restoreOnFail` for property interiors

When entering/exiting a property, the **server** sets the routing bucket **before**
firing the client teleport event. If the client times out and restores to origin, the
player's physical position and routing bucket would be out of sync. Therefore property
entry/exit calls use `restoreOnFail = false`:

```lua
-- sunset_properties/client/main.lua
Sunset.World.SafeTeleport(dest, { fade = true, restoreOnFail = false })
```

---

## Property Transition Mutex

Defined at the top of `sunset_properties/client/main.lua`.

```
NONE → ENTERING → INSIDE → EXITING → NONE
```

The `transState` variable prevents:
- E-spam triggering multiple simultaneous interior loads
- Concurrent entry and exit handlers racing

```lua
local TRANS_NONE     = 'NONE'
local TRANS_ENTERING = 'ENTERING'
local TRANS_INSIDE   = 'INSIDE'
local TRANS_EXITING  = 'EXITING'
local transState = TRANS_NONE
```

Any `propertyInterior` event while `transState ~= TRANS_NONE` is silently dropped.
Any `propertyExited` event while `transState ~= TRANS_INSIDE` is silently dropped.

`transState` is reset to `TRANS_NONE` on `playerSpawned`, `respawn`, `forceHospital`,
and `forceCloseAll` to prevent permanent deadlock if the server fires a reset event
mid-transition.

---

## Resources Using `SafeTeleport`

| Resource | Callsite | Notes |
|----------|---------|-------|
| `sunset_properties` | `propertyInterior`, `propertyExited` | `restoreOnFail = false` |
| `sunset_world` (elevators) | on-foot elevator use | `restoreOnFail = true` |
| `sunset_casino` | `leaveCasino()` | `restoreOnFail = true` |
| `sunset_businesses` | `sunset:client:businessTeleport` | `restoreOnFail = true` |
| `sunset_factions` | jail/release, jail timer expiry | `restoreOnFail = true` |
| `sunset_death` | `doRespawn()` | inline streaming (NetworkResurrectLocalPlayer compatibility) |

To add `SafeTeleport` to a new resource:
1. Add `'@sunset_core/client/world_stream.lua'` to `fxmanifest.lua` `client_scripts`
2. Replace `SetEntityCoordsNoOffset(ped, x, y, z, ...)` with `Sunset.World.SafeTeleport(vector4(x,y,z,heading), opts)`

---

## DefaultSpawn Fallback (sunset_spawn)

`DefaultSpawn = vector4(-1037.58, -2737.58, 20.17, 328.0)` (LSIA beach)

This fires when collision streaming times out at the character's saved spawn position.
With `SafeTeleport`, the timeout restores the player to their prior position instead.
The `DefaultSpawn` remains as a last-resort safety net for unrecoverable states only.
