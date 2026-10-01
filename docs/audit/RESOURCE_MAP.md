# SunsetMP — Complete FiveM Gamemode Resource Map

This document contains the authoritative inventory and classification of all 75 resources in the repository, compiled directly from `fxmanifest.lua` declarations and source code inspection.

---

## 1. Resource Classification Summary

| Category | Count | Description |
| :--- | :---: | :--- |
| **CORE** | 1 | Base framework, callback engine, session indexing, player state, translation engine |
| **AUTH** | 2 | Account authentication, hardware licensing, quick login, auth NUI |
| **CHARACTER** | 2 | Multi-character selection, creation, decoding, stats |
| **SPAWN** | 1 | Coordinate resolution, routing bucket preparation, collision streaming |
| **UI** | 2 | Shared NUI shell, module router, HUD, dialogs, speedometer, radar |
| **GAMEPLAY / SOCIAL** | 8 | Needs, emotes, documents, marriage, chat, help, scoreboard, interactions |
| **JOB** | 2 | Jobs framework, 7 civilian jobs (trucker, courier, fisherman, diver, hunter, garbage, mechanic) |
| **FACTION** | 2 | Factions engine, law enforcement (LSPD/BCSO), EMS, duty, detention, roster |
| **ECONOMY / COMMERCE** | 6 | Economy base, banking/ATM, dealership, fishingshop, businesses, crafting |
| **VEHICLE** | 3 | Vehicles core, garage/impound, fuel pump, handling, addon vehicles |
| **PROPERTY** | 1 | Real estate, house purchase/rent, interior instances, wardrobe, stash |
| **MISSION / QUEST** | 3 | Daily battlepass, quest progression, storyline missions |
| **ILLEGAL** | 5 | Robberies (Fleeca/Vangelico/House), Carjacking, Drugs, Turfs, Clan Wars |
| **CASINO** | 4 | Diamond Casino interior, Lucky Wheel, Blackjack, Roulette, Slot machines |
| **ADMIN / DEV** | 4 | Admin command suite, admin tools, devtools (route creator), test driver / agents |
| **WORLD / STREAMING** | 5 | World props/cashiers/elevators, bob74_ipl, villa_island, luckywheel audio |
| **EXTERNAL / LIBS** | 6 | oxmysql, ox_lib, ox_inventory, ox_target, pma-voice, sunset_panel_bridge |
| **TOTAL** | **75** | |

---

## 2. Comprehensive Resource Inventory

### CORE & AUTH

#### `sunset_core` (CORE)
- **Purpose**: Authoritative core framework, player sessions, character encoding/decoding, server callback RPC engine, i18n translation engine, high-performance online indexes.
- **Client Scripts**: `client/main.lua`
- **Server Scripts**: `server/main.lua`, `server/callbacks.lua`, `server/state_indexes.lua`
- **Shared Scripts**: `shared/config.lua`, `shared/utils.lua`, `shared/locale_loader.lua`, `shared/locales/*.lua`
- **Exports**: `GetCharacter`, `GetPlayer`, `GetPlayerByCharacterId`, `RegisterCallback`, `AwaitCallback`, `Translate`, `TFor`, `RequestModelSafe`, `CreateSafeBlip`, `AwaitGameReady`, `ApplyMoneyOperation`.
- **Database Tables**: `players`, `characters`, `server_logs`, `account_security`.
- **Dependencies**: `oxmysql`.

#### `sunset_auth` & `sunset_auth_ui` (AUTH)
- **Purpose**: Account login/registration, token verification, quick login, hardware identifier linkage.
- **Client Scripts**: `client/main.lua`
- **Server Scripts**: `server/main.lua`, `server/quick_login.lua`, `server/tokens.lua`
- **NUI**: React/HTML5 login screen, password hashing, 2FA prompt.
- **Dependencies**: `sunset_core`, `oxmysql`.

#### `sunset_characters` (CHARACTER)
- **Purpose**: Character selection interface, character creation (ped genetics, clothes, initial stats), character slot limits.
- **Client Scripts**: `client/main.lua`, `client/creator.lua`
- **Server Scripts**: `server/main.lua`
- **Dependencies**: `sunset_core`, `sunset_ui`, `sunset_appearance`.

#### `sunset_spawn` (SPAWN)
- **Purpose**: Spawn resolution (last location, faction HQ, property, or default arrivals), collision streaming, bucket management, camera fade.
- **Client Scripts**: `client/main.lua`
- **Server Scripts**: `server/main.lua`
- **Dependencies**: `sunset_core`.

---

### UI & HUD

#### `sunset_ui` (UI)
- **Purpose**: Centralized NUI manager, bridge router, focus manager (`SetFocusSafe`), sound player, module registrar.
- **Client Scripts**: `client/main.lua`, `client/nui_bridge.lua`
- **NUI**: Single Page Application container routing 40+ dynamic modules (HUD, inventory, phone, ATM, dialogs, etc.).
- **Exports**: `Send`, `SetFocus`, `Notify`, `IsOpen`.

#### `sunset_hud` (UI)
- **Purpose**: In-game player HUD, health/armor bars, hunger/thirst meters, voice indicator, stamina, money display, server watermark.
- **Client Scripts**: `client/main.lua`
- **Server Scripts**: `server/main.lua`
- **Dependencies**: `sunset_core`, `sunset_ui`.

#### `sunset_loadscreen` (UI)
- **Purpose**: Native FiveM loading screen with live phase tracking, tips carousel, self-hosted fonts, monotonic progress.
- **Files**: `index.html`, `style.css`, `script.js`.

---

### GAMEPLAY, JOBS & PROGRESSION

#### `sunset_jobs` (JOB)
- **Purpose**: Physical civilian jobs system with dedicated workplaces, NPC employers, shift tracking, and progressive leveling:
  - **Trucker**: Freight hauling, trailer docking, route ranks.
  - **Courier**: Urban package deliveries via scooter/van.
  - **Fisherman**: Pier/boat angling, mini-game catches.
  - **Diver**: Underwater salvage, breathing tanks, boat rental.
  - **Hunter**: Animal tracking, rifle harvesting, pelt weighing.
  - **Garbage Collector**: Waste pickup routes, dual-worker support.
  - **Mechanic**: Roadside repairs, vehicle towing, impound transport.
- **Client Scripts**: `client/core.lua`, `client/trucker.lua`, `client/courier.lua`, `client/fisherman.lua`, `client/diver.lua`, `client/hunter.lua`, `client/garbage.lua`, `client/mechanic.lua`, `client/workplaces.lua`.
- **Server Scripts**: `server/core.lua`, `server/route_store.lua`, `server/workplaces.lua`, etc.
- **Database Tables**: `character_jobs`, `job_routes`, `job_stats`.
- **Dependencies**: `sunset_core`, `sunset_ui`, `sunset_inventory`, `sunset_vehicles`.

#### `sunset_factions` (FACTION)
- **Purpose**: Faction hierarchy, permissions, duty system, fleet garage, equipment loadouts, and specialized modules:
  - **Police (LSPD/BCSO)**: MDT tablet, cuffing, escorting, jail sentences, speed radars, fine issuance, impounding.
  - **EMS (SAMD)**: Downed player resuscitation, hospital treatment, medical prescriptions, ambulance dispatch.
  - **Taxi (Downtown Cab)**: Metered rides, fare calculation, dispatch board.
  - **Mafia / Cartel / Gangs**: Underground turfs, weapons trafficking, cartel wars.
- **Client Scripts**: `client/main.lua`, `client/police.lua`, `client/ems.lua`, `client/loadout.lua`.
- **Server Scripts**: `server/main.lua`, `server/police.lua`, `server/ems.lua`, `server/leaders.lua`, `server/faction_roster.lua`.
- **Database Tables**: `factions`, `faction_members`, `faction_ranks`, `faction_logs`, `police_mdt_records`, `character_jail`.

#### `sunset_inventory` (ECONOMY)
- **Purpose**: Grid/slot-based inventory, weight limits, container stashes, ground item drops, secure trading, weapon attachments.
- **Client Scripts**: `client/main.lua`, `client/containers.lua`, `client/props.lua`.
- **Server Scripts**: `server/main.lua`, `server/trade.lua`, `server/quickslots.lua`.
- **Database Tables**: `character_inventory`, `inventory_containers`, `ground_drops`.

#### `sunset_vehicles` & `sunset_dealership` & `sunset_impound` (VEHICLE)
- **Purpose**: Vehicle ownership, keys/locks, fuel simulation, mileage recording, physical dealerships with 3D preview & test-drives, municipal impound lots.
- **Client Scripts**: `client/main.lua`, `client/fuel_pump.lua`.
- **Server Scripts**: `server/main.lua`, `server/keys.lua`, `server/fuel.lua`.
- **Database Tables**: `owned_vehicles`, `vehicle_keys`, `vehicle_impound`.

#### `sunset_properties` & `sunset_businesses` (PROPERTY / BUSINESS)
- **Purpose**: Real estate purchasing/renting, dynamic interior instancing, personal stashes, player-owned businesses (24/7 stores, gas stations) with supply logistics and daily revenue.
- **Database Tables**: `properties`, `property_keys`, `businesses`, `business_vaults`.

#### `sunset_quests`, `sunset_missions` & `sunset_pass` (PROGRESSION)
- **Purpose**: Main storyline RPG quests, episodic instanced co-op missions (Hot Wheels, Container 47), and seasonal Battlepass progression.
- **Database Tables**: `character_quests`, `missions_state`, `battlepass_progress`.

#### `sunset_robbery` & `sunset_carjack` & `sunset_drugs` & `sunset_turfs` (ILLEGAL)
- **Purpose**: High-stakes criminal gameplay:
  - Fleeca bank vault thermite & drilling.
  - Vangelico luxury jewelry case smashing.
  - High-end vehicle lockpicking and chop-shop stripping.
  - Weed growing & Cocaine/Meth chemical processing.
  - Clan turf zones with dynamic capture wars and hourly revenue.

#### `sunset_casino`, `sunset_luckywheel`, `sunset_blackjack`, `sunset_roulette`, `sunset_slots` (CASINO)
- **Purpose**: Fully networked Diamond Casino gaming floor, daily lucky wheel spin, multiplayer blackjack tables, 3D roulette wheel, animated slot machines with RTP verification.

---
