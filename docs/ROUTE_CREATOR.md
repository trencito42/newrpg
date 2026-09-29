# Sunset Route Creator & Canonical Route Store

## 1. Overview
The **Sunset Route Creator** is an in-game developer tooling suite designed to author, edit, test, duplicate, and validate job routes in real-time without manual vector coordinate editing or server restarts.

Routes are canonically stored in `resources/[sunset]/sunset_jobs/data/job_routes.json` and managed authoritatively by `sunset_jobs/server/route_store.lua`. The devtools resource (`sunset_devtools`) acts purely as the authoring UI and is disabled in production environments.

---

## 2. Architecture

```
                                  ┌─────────────────────────────┐
                                  │   sunset_jobs/server/       │
                                  │     route_store.lua         │
                                  └──────────────┬──────────────┘
                                                 │
                     ┌───────────────────────────┴───────────────────────────┐
                     ▼                                                       ▼
      ┌─────────────────────────────┐                         ┌─────────────────────────────┐
      │  job_routes.json (Disk)     │                         │ Runtime Cache & Normalizer  │
      │  job_routes.json.bak        │                         │  SunsetJobRoutes (Server)   │
      └─────────────────────────────┘                         └──────────────┬──────────────┘
                                                                             │
                     ┌───────────────────────────────────────────────────────┴───────────────────────┐
                     ▼                                                                               ▼
      ┌─────────────────────────────┐                                                 ┌─────────────────────────────┐
      │   Production Gameplay       │                                                 │   sunset_devtools (NUI/Dev) │
      │ - Trucker & Garbage server  │                                                 │ - /devroutes UI Controller  │
      │ - Immutable Session Snapshots│                                                │ - Gizmo Visual Positioning  │
      │ - Shared Visual Primitives  │                                                 │ - Trailer Capture System    │
      └─────────────────────────────┘                                                 └─────────────────────────────┘
```

### Key Principles
1. **Single Source of Truth**: All authored route definitions reside in `sunset_jobs/data/job_routes.json`. `jobs_config.lua` retains only balancing, radius constants, payout formulas, and global depot locations.
2. **Decoupled Production vs Authoring**: `sunset_jobs` loads and validates the route store independently of `sunset_devtools`. Production continues working smoothly when `sunset_devtools_enabled` is false.
3. **Active Session Immutability**: When a player starts a shift (Trucker or Garbage), their session takes an immutable snapshot of route data. Deleting or modifying a route mid-shift will never break active workers.
4. **Shared Visual Primitives**: `sunset_jobs/client/visual_shared.lua` exports the exact checkpoint, marker, and rectangular parking bay rendering routines to `sunset_devtools`, guaranteeing that what you see in the editor is 1:1 identical to gameplay.

---

## 3. Supported Jobs & Adapters

### 3.1. Trucker (`trucker`)
- **Fields**:
  - `id`: Stable unique identifier (e.g. `fuel_west_eclipse`).
  - `label`: Player-facing route name.
  - `category`: Category tag (e.g. `fuel`, `general`, `cold`).
  - `pay`: Base payout in dollars.
  - `pickup`: `vector4` (X, Y, Z, Heading) for trailer hitching.
  - `delivery`: `vector3` (X, Y, Z) for delivery entrance checkpoint (`[E] Quick Deliver` / `[G] Manual Park`).
  - `parkingBay`: `vector4` (X, Y, Z, Heading) defining the oriented rectangular trailer parking spot.
- **Features**:
  - **Capture from Real Trailer**: Hitch or park any tanker/trailer into position, click **Capture from Trailer**, and coordinates/heading are instantly recorded.
  - **Live Parking Rectangle**: Displays heading arrow, bounds, and delivery distance.

### 3.2. Garbage (`garbage`)
- **Fields**:
  - `id`: Stable unique identifier (e.g. `south_ls_01`).
  - `label`: Route name.
  - `bins`: Ordered sequence of collection points (`vector3` X, Y, Z).
- **Features**:
  - **Sequential Order Preservation**: Author-defined collection order is strictly preserved (no random bin scrambling).
  - **Rapid Stop Authoring**: Drive or teleport along the route, press `[C]` to drop bin markers.
  - **Reordering & Deletion**: Move stops up/down or delete individual stops with real-time world preview.

---

## 4. In-Game Controls & Workflow

### 4.1. Access Command
```
/devroutes
```
*(Compatibility alias: `/devroute`)*

### 4.2. Editor Modes
- **Inspector / NUI Mode**: Full mouse cursor interaction to inspect routes, edit metadata, reorder stops, and trigger teleports.
- **Gizmo / World Edit Mode**:
  - `W / A / S / D`: Move in XY plane.
  - `PgUp / PgDn`: Move Z elevation.
  - `Q / E`: Rotate heading.
  - `Shift`: Fast movement multiplier (x5).
  - `Alt`: Precision movement multiplier (x0.1).
  - `G`: Ground diagnostic / snap test.
  - `Enter`: Confirm & apply draft.
  - `Esc`: Cancel editing and restore previous position.
- **Test Mode**:
  - Teleport directly to Pickup, Delivery, or Parking Bay without starting a paid shift or affecting economy rewards.

---

## 5. Server Configuration & Security

### 5.1. Enabling Route Devtools (`server.cfg`)
To enable devtools and route editing on a local/staging server:
```cfg
setr sunset_devtools_enabled true
```
*Note: In production environments, leave this unset or set to `false`.*

### 5.2. Permission Validation
All route mutations (`save_route`, `delete_route`, `reload_routes`) undergo server-side verification:
1. `sunset_devtools_enabled` convar check.
2. `sunset_admin` or ace permission check (`command.devroutes` or admin rank >= 2).
3. Payload schema and boundary validation (rejecting NaN, infinite coordinates, empty IDs, or malformed data).
4. Automatic creation of `job_routes.json.bak` prior to saving.

---

## 6. Automated Testing
Run the route store validation test suite:
```bash
node scripts/test-route-creator.js
```
Validates:
- Route ID uniqueness
- Serialization / Deserialization schema
- Trucker & Garbage snapshot immutability
- Garbage stop ordering preservation
- Malformed JSON recovery & fallback
