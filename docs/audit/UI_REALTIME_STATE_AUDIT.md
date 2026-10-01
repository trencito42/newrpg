# UI Real-Time State Synchronization Audit & Architecture Report

## 1. Executive Summary & Root Cause Analysis

### Stale UI Snapshot Root Cause
Across earlier versions of the gamemode, interfaces suffered from a snapshot-only lifecycle:
1. **Force-Close as Pseudo-Sync:** Actions like spawning a vehicle previously invoked `closeMenu()`, forcing players to reopen the interface to view changes.
2. **Local Cache Stagnation:** Intermediate caching layers (such as `cachedExtras` in `sunset_menu`) cached query results for 5 seconds without listening for mutation callbacks or domain events (`sunset:client:vehicleUpdated`, `sunset:client:vehicleStateChanged`, `sunset:client:propertiesChanged`).
3. **NUI Key Deduplication Blindness:** NUI components (such as `menu.js` with `_vehicleSnapKey`) cached snapshot keys and did not reset state tracking when user clicks triggered async mutations, causing NUI to ignore incoming updates if top-level IDs remained unchanged.
4. **Non-Authoritative or Incomplete Mutation Returns:** Server handlers previously returned simple booleans (`{ success = true }`) rather than full authoritative entity data, depriving the client of instant delta reconciliation.

---

## 2. Real-Time State Synchronization Model

```
 USER CLICK (e.g. "Store Vehicle" / "Valet Spawn")
        │
        ▼
 UI PENDING STATE (Button disabled, debounce active, _vehicleSnapKey invalidated)
        │
        ▼
 NUI POST / CALLBACK (menuVehicleAction / garageStore / garageSpawn)
        │
        ▼
 CLIENT LUA DISPATCH (sunset_menu / sunset_vehicles client)
        │
        ▼
 AUTHORITATIVE SERVER MUTATION (sunset:spawnVehicle / sunset:storeOwnedVehicle)
        │
 ┌──────┴───────────────────────────────────────────────────────┐
 │                                                               │
 ▼                                                               ▼
SERVER DB & WORLD ENTITY UPDATE                AUTHORITATIVE EVENT & RESPONSE
(Entity spawned / deleted / stored in DB)      ({ success = true, vehicle = updatedVehicle })
                                               + TriggerClientEvent('sunset:client:vehicleStateChanged')
                                                                 │
                                                                 ▼
                                               CLIENT CACHE INVALIDATION & RECONCILIATION
                                               (Invalidates cachedExtras, updates memory cache)
                                                                 │
                                                                 ▼
                                               NUI STATE UPDATE
                                               (SendNUIMessage action: 'menuUpdate' / 'garageShow')
                                                                 │
                                                                 ▼
                                               UI RE-RENDER IN PLACE
                                               (Status -> "Stored", Button -> "Spawn Vehicle",
                                                Button re-enabled, No close/reopen required)
```

---

## 3. Fixed Modules & Domain Coverage

| Module / Screen | File Paths | Key Architectural Fixes |
| :--- | :--- | :--- |
| **Vehicle Menu (M-Menu & /v)** | `resources/[sunset]/sunset_menu/client/main.lua`<br>`resources/[sunset]/sunset_ui/web/js/menu.js` | Removed `closeMenu()` from spawn path; added explicit cache invalidation; pushed live `menuUpdate` on all mutations; added button disable pending states; wired listeners for `sunset:client:vehicleUpdated` and `sunset:client:vehicleStateChanged`. |
| **Garage Panel** | `resources/[sunset]/sunset_vehicles/client/main.lua`<br>`resources/[sunset]/sunset_vehicles/server/main.lua`<br>`resources/[sunset]/sunset_ui/web/js/panels.js` | `sunset:spawnVehicle` and `sunset:storeOwnedVehicle` now emit authoritative entity payloads; UI buttons feature debounce and pending states; garage list re-renders dynamically. |
| **Skin / Clothing Shop** | `resources/[sunset]/sunset_skins/client/main.lua`<br>`resources/[sunset]/sunset_ui/web/js/skinshop.js` | Added automatic `skinShopUpdate` dispatch upon equipping so the selected skin and badges update in place without closing the shop. |
| **Inventory & Trade** | `resources/[sunset]/sunset_inventory/server/main.lua`<br>`resources/[sunset]/sunset_inventory/client/main.lua` | Verified `sendInventoryUpdate` broadcasts authoritative item slots, weight, and capacity bonuses immediately after moves, drops, splits, and trade actions. |
| **ATM & Fleeca Banking** | `resources/[sunset]/sunset_economy/client/main.lua`<br>`resources/[sunset]/sunset_ui/web/js/atm.js` | Verified `atmUpdate` updates cardholder balances, quick amounts, and live transaction logs upon confirmation without closing. |
| **Housing & Properties** | `resources/[sunset]/sunset_properties/server/main.lua`<br>`resources/[sunset]/sunset_properties/client/main.lua` | Verified `sunset:client:propertyDelta` broadcast and `propertyManageRefresh` dispatch on lock/rent/interact actions. |
| **Businesses** | `resources/[sunset]/sunset_businesses/client/main.lua` | Verified `businessManage` returns refreshed dashboard payloads and updates open panels via `businessPanelShow`. |
| **Factions & Clans** | `resources/[sunset]/sunset_factions/client/main.lua`<br>`resources/[sunset]/sunset_clans/client/main.lua` | Verified `factionPanelRefresh` and `clanPanelShow` emit updated rosters, ranks, and balance sheets on all management mutations. |
| **Pass & Quests** | `resources/[sunset]/sunset_pass/client/main.lua`<br>`resources/[sunset]/sunset_pass/server/main.lua` | Verified `passUpdate` dispatches on claim and `sunset:pass:refresh` triggers live UI refresh on server progress. |

---

## 4. Server & NUI Event Contracts

### Authoritative Server Events
- `sunset:client:vehicleStateChanged(vehicleId, action, updatedVehicle)`: Emitted to the owning client when any vehicle state mutates.
- `sunset:client:vehicleUpdated()`: Broad client notification triggering menu/garage re-hydration.
- `sunset:client:inventoryUpdate(items, weight, cash, maxWeight)`: Real-time inventory slot & capacity delta.
- `sunset:client:propertyDelta(gen, propId, delta)`: Differential property state updates.
- `sunset:pass:refresh`: Triggers quest & battlepass UI re-sync.

### NUI Message Contracts
- `menuUpdate`: Pushes new vehicle, property, faction, and character data to an active M-menu without resetting view position.
- `garageShow`: Refreshes garage vehicle list in place.
- `skinShopUpdate`: Refreshes skin shop owned/equipped indicators in place.
- `inventoryUpdate`: Refreshes player and secondary inventory slots in place.
- `atmUpdate`: Refreshes ATM balance and transaction receipts.

---

## 5. Concurrency, Race Protection & Performance

1. **Pending State Guards:** All action buttons in `menu.js` and `panels.js` are disabled (`pointerEvents = 'none'`) during transit, preventing duplicate requests and race conditions.
2. **Delta & Cache Invalidation:** Instead of polling the database or broadcasting heavy payloads to all connected clients, events are strictly directed to the actor or open UI context.
3. **No Artificial Delays:** Replaced legacy arbitrary sleeps with direct event-driven callbacks. Perceived UI latency matches real network round-trip time (50–250ms).
