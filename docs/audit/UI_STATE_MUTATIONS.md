# UI State Mutations Audit Matrix

| UI Surface | Domain | Action / Mutation | Server Authority / Callback | Authoritative Response | Client / NUI Update Mechanism | Live Mutation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M-Menu (Vehicles)** | Vehicles | Spawn / Valet | `sunset:spawnVehicle` | `{ success = true, vehicle = updatedVehicle }` + `sunset:client:vehicleStateChanged` | Invalidate cache, push `menuUpdate`, keep menu open, update button to "Send to garage" | **Real-Time Synchronized** |
| **M-Menu (Vehicles)** | Vehicles | Store / Send to garage | `sunset:storeOwnedVehicle` | `{ success = true, vehicle = updatedVehicle }` + `sunset:client:vehicleStateChanged` | Invalidate cache, push `menuUpdate`, keep menu open, update button to "Spawn vehicle" | **Real-Time Synchronized** |
| **M-Menu (Vehicles)** | Vehicles | Claim Insurance | `sunset:claimVehicleInsurance` | `{ success = true, vehicle = ... }` + `sunset:client:vehicleStateChanged` | Invalidate cache, push `menuUpdate`, update status to Stored | **Real-Time Synchronized** |
| **M-Menu (Vehicles)** | Vehicles | Renew Insurance | `sunset:renewVehicleInsurance` | `{ success = true, vehicle = ... }` + `sunset:client:vehicleStateChanged` | Invalidate cache, push `menuUpdate`, update insurance badge | **Real-Time Synchronized** |
| **M-Menu (Vehicles)** | Vehicles | Park / Set Garage | `sunset:parkVehicle` | `{ success = true }` + `sunset:client:vehicleStateChanged` | Invalidate cache, push `menuUpdate` | **Real-Time Synchronized** |
| **Garage Panel** | Vehicles | Spawn vehicle | `sunset:garageSpawn` | `{ success = true, vehicle = ... }` + `sunset:client:vehicleUpdated` | Invalidate cache, push `garageShow` / `menuUpdate` | **Real-Time Synchronized** |
| **Garage Panel** | Vehicles | Store vehicle | `sunset:garageStore` | `{ success = true, vehicle = ... }` + `sunset:client:vehicleUpdated` | Invalidate cache, push `garageShow` / `menuUpdate` | **Real-Time Synchronized** |
| **Inventory** | Inventory | Use Item | `sunset:inventory:use` | `sendInventoryUpdate` (`sunset:client:inventoryUpdate`) | Push `inventoryUpdate` with updated items, weight & capacity | **Real-Time Synchronized** |
| **Inventory** | Inventory | Move / Split Item | `sunset:inventory:move` / `split` | `sendInventoryUpdate` (`sunset:client:inventoryUpdate`) | Push `inventoryUpdate` with updated slots | **Real-Time Synchronized** |
| **Inventory** | Inventory | Drop Item | `sunset:inventory:drop` | `sendInventoryUpdate` (`sunset:client:inventoryUpdate`) | Push `inventoryUpdate` with updated slots and weight | **Real-Time Synchronized** |
| **Inventory / Trade** | Trade | Offer / Accept / Confirm | `sunset:inventory:trade*` | `sendInventoryUpdate` & `inventoryTrade*` | Push trade state & inventory deltas live | **Real-Time Synchronized** |
| **ATM / Banking** | Economy | Deposit / Withdraw | `sunset:atmTransfer` | `{ ok = true, balance = ..., cash = ..., bank = ... }` | Push `atmUpdate` with updated bank & cash balances and receipt | **Real-Time Synchronized** |
| **Properties** | Housing | Lock / Rent / Renters | `sunset:propertyAction` | `sunset:client:propertyDelta` broadcast + callback | Push `propertyManageRefresh` and delta updates | **Real-Time Synchronized** |
| **Businesses** | Economy | Upgrade / Collect / Manage | `sunset:businessManage` | Refreshed dashboard table `{ mode = ..., stats = ... }` | Push `businessPanelShow` with refreshed dashboard | **Real-Time Synchronized** |
| **Faction Panel** | Factions | Rank / Warn / Kick / Motd | `sunset:factionManage` | Refreshed dashboard table (`sunset:factionDashboard`) | Push `factionPanelRefresh` with updated roster & stats | **Real-Time Synchronized** |
| **Clan Panel** | Clans | Invite / Kick / Rank / Motd | `sunset:clanManage` | Refreshed dashboard table (`clanManageDashboard`) | Push `clanPanelShow` with updated member list & bank | **Real-Time Synchronized** |
| **Battlepass / Quests** | Progression | Claim Reward | `sunset:pass:claim` | `{ ok = true, state = updatedPassState }` | Push `passUpdate` with updated claimed levels & unlocks | **Real-Time Synchronized** |
| **Battlepass / Quests** | Progression | Objective Progress | `sunset:pass:refresh` event | Fetches `sunset:pass:getData` | Push `passUpdate` with new milestone progress | **Real-Time Synchronized** |
| **Skin / Clothing** | Customization | Buy / Equip Skin | `skins:buy` / `skins:equip` | `{ success = true }` + `skins:getAll` | Push `skinShopUpdate` with updated owned/equipped flags | **Real-Time Synchronized** |
