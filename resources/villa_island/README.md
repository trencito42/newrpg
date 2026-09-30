# Villa on the Island 4.0 — FiveM Resource

Original mod: **Villa on the Island 4.0** by its author (see Credits).  
This is a FiveM adaptation of the original GTA V single-player DLC map mod.

---

## Resource structure

```
villa_island/
├── fxmanifest.lua       — FiveM resource manifest
├── stream/
│   ├── villa_island.ymap     — main villa + island entity placement
│   ├── water.ymap            — water/terrain placement
│   ├── villa_island.ytyp     — custom archetype definitions (5 block types)
│   ├── brick_stone_block.ydr       — brick/stone block drawable
│   ├── brick_stone_block+hidr.ytd  — brick/stone high-detail textures
│   ├── cobblestone_block.ydr
│   ├── cobblestone_block+hidr.ytd
│   ├── dirt_block.ydr
│   ├── dirt_block+hidr.ytd
│   ├── grass_block.ydr
│   ├── grass_block+hidr.ytd
│   ├── sand_block.ydr
│   └── sand_block+hidr.ytd
└── README.md
```

**Total stream size: ~3.9 MB**

---

## Installation

1. Copy the `villa_island/` folder to your server's `resources/[maps]/` directory  
   (or any resource folder you prefer).
2. Add to `server.cfg`:
   ```
   ensure villa_island
   ```
3. Restart the server.

---

## Location

The island is located in the **western ocean**, far west of the main GTA V map.  
Coordinates verified by direct RSC7/YMAP binary parsing of all entity positions:

```
x ≈ -5838,  y ≈ 1135,  z ≈ 8
```

Full entity bounding box: X (-5938 to -5735), Y (1038 to 1234), Z (-12 to +16)

FiveM teleport command for testing:

```lua
SetEntityCoords(PlayerPedId(), -5838.0, 1135.0, 8.0, false, false, false, true)
```

> **Note:** Previous README had wrong coordinates (x≈4600, y≈-4800) — those were
> incorrect. The island is in the deep western ocean, NOT south-east of the map.

---

## Game build requirements

The resource uses only assets included in the `stream/` folder (5 custom block
models + 2 YMAP files + 1 YTYP). No dependency on Rockstar DLC game builds.

- Compatible with FiveM server artifact **>= 4755** (current stable).
- If any entity fails to appear, ensure your server's `sv_enforceGameBuild`
  is set to a modern build (e.g. `set sv_enforceGameBuild 2699`).

---

## Asset summary

| File | Type | Purpose |
|------|------|---------|
| `villa_island.ymap` | YMAP | Main island + villa entity placements (~21 KB) |
| `water.ymap` | YMAP | Water surface placement (~1.5 KB) |
| `villa_island.ytyp` | YTYP | Archetype definitions for 5 custom block types |
| `brick_stone_block.ydr` + `.ytd` | YDR/YTD | Stone/brick block (264 KB each) |
| `cobblestone_block.ydr` + `.ytd` | YDR/YTD | Cobblestone block (495 KB each) |
| `dirt_block.ydr` + `.ytd` | YDR/YTD | Dirt block (282 KB each) |
| `grass_block.ydr` + `.ytd` | YDR/YTD | Grass-covered block (693 KB each) |
| `sand_block.ydr` + `.ytd` | YDR/YTD | Sand block (266 KB each) |

**Collision:** Physics bounds are embedded inside each `.ydr` file (no separate
`.ybn` files required). The RSC7 system-memory section of each YDR contains the
physics dictionary.

**No vanilla replacements.** All 5 models use unique names that do not conflict
with any GTA V base game assets. Original GTA V map is untouched.

**OneSync compatible.** Map entities are static streamed map objects — no Lua
scripts spawn props. Fully safe for OneSync Infinity servers.

---

## Conversion notes

- Original format: GTA V SP DLC pack (`dlcpacks:/villa_island/`)  
  Internal path: `villa_island/dlc.rpf → x64/levels/gta5/villa_island.rpf`
- The nested `villa_island.rpf` (RPF7, unencrypted) was parsed and all 13
  asset files were extracted verbatim (RSC7 format, no re-encoding).
- `villa island.ymap` (original name had a space) was renamed to
  `villa_island.ymap` to avoid filesystem/streaming issues on Linux servers.
- `content.xml` and `setup2.xml` from the original DLC are not needed —
  FiveM uses `fxmanifest.lua` instead.

---

## Known issues

- **Coordinates verified:** x≈-5838, y≈1135, z≈8 — confirmed by full RSC7
  entity binary scan. Previous README had wrong values (x≈4600, y≈-4800).
- **LODs:** The block models use `+hidr.ytd` high-detail textures. Low-LOD
  variants are not present, which may cause props to disappear at longer view
  distances. This is a characteristic of the original mod.

---

## Credits

Original mod: **Villa on the Island 4.0**  
Author: original creator (credit preserved from the original release).  
FiveM conversion: extracted from `dlc.rpf`, adapted to FiveM resource format.  
Do not claim ownership of the original map assets.
