# Sunset Placement Studio

Developer-only in-game coordinate editing tool for SunsetMP.

## How to Enable

```
# server.cfg (dev box only — never production)
ensure sunset_devtools
setr sunset_devtools_enabled true
setr sunset_devtools_debug false   # set true for verbose F8 output
```

## Permissions

- Requires `sunset_admin` level ≥ 1 (configurable via `SunsetDevTools.Config.minAdminLevel`)
- Kill switch (`setr sunset_devtools_enabled true`) must be on
- Server validates every event — client never self-authorizes

## Commands

| Command | Description |
|---------|-------------|
| `/devplace` | List available adapters |
| `/devplace missions` | List mission contacts |
| `/devplace missions hank` | Open Hank placement gizmo |
| `/devplace trucker route1_pickup` | Edit trucker route 1 pickup |
| `/devpos [adapter] [key]` | Capture player position as coord |
| `/devroute trucker` | Open trucker route editor |
| `/devroute trucker 1` | Jump to route 1 in editor |
| `/worldprobe` | Toggle world probe (crosshair raycast) |
| `/devvalidate trucker` | Validate all trucker stages |
| `/devdrafts` | (server console) list saved drafts |
| `/devdrafts clear` | (server console) clear all drafts |

## Controls (Gizmo Mode)

| Key | Action |
|-----|--------|
| W/A/S/D | Move forward/back/left/right (entity-relative) |
| Arrow keys | Same as WASD |
| PgUp/PgDn | Move Z up/down |
| Space/Ctrl | Same as PgUp/PgDn |
| Q/E | Rotate heading |
| Shift | Fast speed (×5) |
| Alt | Fine speed (×0.1) |
| G | Ground snap |
| R | Reset pitch/roll to 0 |
| Z | Undo |
| Shift+Y | Redo |
| **ENTER** | **Capture / export** |
| **BACKSPACE** | **Cancel / exit** |

For vehicles: Num 8/2 pitch, Num 4/6 roll.

## Controls (Route Editor)

| Key | Action |
|-----|--------|
| F1/F2 | Navigate between stages |
| G | Teleport to selected stage |
| E | Open gizmo for selected stage |
| C | Capture current player position as draft for selected |
| V | Validate all stages |
| X | Export all pending drafts to F8 |
| ESC | Close route editor |

## Controls (World Probe)

| Key | Action |
|-----|--------|
| C | Copy current hit coords to clipboard |
| ESC | Close probe |

## Adapters

Adapters bridge gameplay systems to the generic editor:

```
missions  — SunsetMissions.Contacts (NPCs)
trucker   — Sunset.JobsConfig.trucker routes
```

### Adding an Adapter

In `shared/adapters.lua`:

```lua
SunsetDevTools.Adapters['myadapter'] = {
    label = 'My System',
    describe = function()
        return {
            { key = 'mykey', label = 'My Point', type = 'point', coords = vector3(0,0,0) }
        }
    end,
    load = function(key)
        return { label = 'My Point', coords = vector3(0,0,0), heading = 0.0, type = 'point' }
    end,
    export = function(key, v4, _extra)
        return ('myConfig.%s = vector4(%.2f, %.2f, %.2f, %.2f),'):format(key, v4.x, v4.y, v4.z, v4.w)
    end,
}
```

Entity types: `ped`, `vehicle`, `trailer`, `point`

## Draft Storage

Drafts are saved to `resources/[sunset]/sunset_devtools/devtools_drafts.json`.

- Drafts survive resource restart
- Never written to production DB tables
- Clear with `/devdrafts clear` from console

## Export Flow

1. Open editor: `/devplace missions hank`
2. Move Hank visually to desired position
3. Press **ENTER** — output appears in F8, vector4 copied to clipboard
4. Draft saved server-side
5. Paste snippet into `sunset_missions/shared/contacts.lua`

## Old Tools — Migration Status

| Command | Status | Notes |
|---------|--------|-------|
| `/coords` `/getpos` `/pos` | **KEEP** | Still useful for quick position lookup |
| `/moveveh` `/vehfree` | **KEEP** | Admin vehicle gizmo — still functional |
| `/spawntrailer` | **KEEP** | Use `/devplace trucker route1_pickup` for route work |
| `/tptruck` `/trucktp` | **KEEP** | Still useful for gameplay testing |
| `/setcp` `/gotocp` `/delcp` | **KEEP** | Dev checkpoints unrelated to placement |
| `/gotoloc` | **KEEP** | Location list is independent |
| `/dl` `/dlp` | **KEEP** | Debug labels complement devtools |

Devtools does NOT replace the admin gizmo — it adds ped support, adapters, validation, and export.

## Known Limitations

1. **Ground probe can hit props/containers** — always shows the detected surface model so you can judge whether it's the right surface (Part 54 of spec). Never silently auto-applies detected Z.
2. **World probe requires camera direction** — the hit Z depends on camera angle; probe from overhead for most accurate ground Z.
3. **Local entities only** — preview peds and vehicles are client-local and do not appear to other players on the server.
4. **No automatic config patching** — export generates a Lua snippet; you must paste it manually. This is by design (Part 30).
5. **Clipboard via SetClipboardText** — requires FiveM 1.0.0.4702+; older builds may not copy.
6. **Route editor E key conflict** — the E key (interact) is disabled while route editor is active to prevent NPC interactions.

## Example: Fixing Hank

```bash
/devplace missions hank
# Hank spawns at configured coords with scenario animation
# Move him with WASD/PgUp/PgDn until visually correct
# G to snap to ground — read Ground Z delta in HUD
# ENTER to capture
# Output: vector4(814.88, -2981.22, 5.02, 269.78)
# Paste into sunset_missions/shared/contacts.lua
```

## Example: Trucker Route 1

```bash
/devroute trucker 1
# All stages shown as world markers with distance labels
# F1/F2 to navigate, G to teleport to selected
# E to open gizmo on a stage
# Drive truck into parking bay, press C to capture as draft
# X to export all pending drafts
# Paste snippets into sunset_core/shared/jobs_config.lua
```
