# FiveM RPG Scalability & Reliability Changes (100–200 Concurrent Players)

## Summary of Applied Changes

| Resource | File | Type | Summary of Change |
|---|---|---|---|
| `sunset_core` | `server/main.lua` | Performance / Indexes | Added `SourceByCharacterId`, `SourceByPlayerId`, `SourceByAccountId`, and `PedToPlayerSource` indexes with exports `GetSourceByPed`, `GetSourceByCharacterId`, `GetOnlineCharacters`. |
| `sunset_core` | `server/player.lua` | Concurrency / Stability | Added `IsSavingCharacter[cid]` mutex lock to prevent concurrent save races; removed redundant SELECT query before UPDATE during routine saves. |
| `sunset_player` | `server/main.lua` | Performance / DB | Replaced synchronized 200-player batch autosave with a staggered round-robin queue worker distributing saves across `SaveInterval` with jitter. |
| `sunset_licenses` | `server/main.lua` | Hot-path Optimization | Converted `weaponDamageEvent` victim resolution from linear `GetPlayers()` loop to $O(1)$ `exports.sunset_core:GetSourceByPed`. |
| `sunset_anticheat`| `server/detectors.lua` | Hot-path Optimization | Converted `damage_check` hook from linear player loop to $O(1)$ `GetSourceByPed`. |
| `sunset_phone` | `server/main.lua` | Network / Memory / DB | Replaced global avatar scan with demand-driven `AvatarCache` and targeted `WHERE id IN (?)` queries for contacts/message participants only; added incremental message push. |
| `sunset_phone` | `client/main.lua` | Network / NUI | Handled `sunset:client:phoneNewMessage` for delta UI updates without full state reconstruction. |
| `sunset_ui` | `web/js/phone.js` | NUI Performance | Added `addMessage` delta handler for incremental message insertion and thread updates. |
| `sunset_ui` | `web/js/app.js` | NUI Routing | Registered `phoneNewMessage` action handler in main UI message bus. |
| `sunset_properties` | `server/main.lua` | Cache / DB | Implemented `ServerPropertyCache` and `PropertyGeneration` versioning; replaced raw `-1` query storms with `notifyPropertiesChanged`. |
| `sunset_properties` | `client/main.lua` | Network / DB | Added debouncing and jittered staggering for background property refreshes. |
| `sunset_scoreboard` | `server/main.lua` | Performance / Privacy | Added 2500ms server-side roster snapshot cache; removed sensitive `money` field from scoreboard payload. |
| `sunset_tuning` | `server/main.lua` | Network / OneSync | Scoped tuning modification events to player and synchronized state via OneSync vehicle entity state bags (`state.sunsetTune`, `state.sunsetCosmetics`). |
| `sunset_factions` | `server/core.lua` | State Indexing | Added in-memory `OnlineFactionMembers` tracking with `getOnlineFactionMembers(factionId)`. |
| `sunset_factions` | `server/chat.lua` | Network Routing | Scoped faction chat message distribution exclusively to online faction members. |
| `sunset_clans` | `server/main.lua` | Lookup Optimization | Replaced linear player scan in `sourceForChar` with $O(1)$ `GetSourceByCharacterId`. |
| `sunset_clans` | `server/chat.lua` | Network Routing | Optimized clan chat message routing using `GetOnlineCharacters` lookup. |
| `sunset_dispatch` | `server/service_core.lua` | Hot-path Optimization | Replaced linear `findSourceByCharacterId` with $O(1)$ `GetSourceByCharacterId`. |
| `sunset_hud` | `client/main.lua` | CEF / NUI Performance | Added hash-based state diffing in `updateHud` and throttled general HUD loop to 2 Hz. |
| `sunset_core` | `server/player.lua` | Data Integrity / Bugfix | Fixed metadata regression in `SaveCharacter`: merged DB-authoritative keys (`quickslots`, `rob_points`, `spawn_choice`) before updating `characters.metadata` to prevent overwriting keys updated via `JSON_SET`. |
| `sunset_player` | `server/main.lua` | Scheduler / Stability | Fixed autosave scheduler: replaced premature cycle restart with uniform 60s distributed cycle tracking (`cycleStart` and `60000 - elapsed` sleep), eliminating high-frequency saves at low player counts. |
| `sunset_properties` | `server/main.lua` | Network Fan-out | Replaced global `-1` query broadcast with single-property in-memory delta updates (`sunset:client:propertyDelta`) and lazy generation versioning (`sunset:client:propertiesVersion`). |
| `sunset_properties` | `client/main.lua` | Client Memory / NUI | Applied property delta updates in-memory without server round-trip; deferred full sync to panel open if generation changed; updated open panel via `propertiesShow`. |
| `sunset_clans` | `server/display.lua` & `chat.lua` | Indexing / Routing | Maintained `OnlineClanMembers[clanId]` map for $O(\text{members})$ clan chat broadcast; added $O(1)$ `GetOnlineCharacters()` map. |
| `sunset_skins` | `client/main.lua` | Entity Tracking | Added `TriggerServerEvent('sunset:server:updatePlayerPed')` after `SetPlayerModel` to preserve $O(1)$ damage victim resolution. |
| `sunset_appearance`| `client/main.lua` | Entity Tracking | Added `TriggerServerEvent('sunset:server:updatePlayerPed')` after freemode ped model switch. |
| `sunset_factions` | `client/loadout.lua` | Entity Tracking | Added `TriggerServerEvent('sunset:server:updatePlayerPed')` after faction outfit model switch. |
| `sunset_spawn` | `client/main.lua` | Entity Tracking | Added `TriggerServerEvent('sunset:server:updatePlayerPed')` immediately after initial ped model creation. |
| `villa_island` | `fxmanifest.lua` | Asset Streaming | Declared `files { 'stream/villa_island.ytyp' }` for DLC archetype request compatibility. |
| `sunset_core` | `server/security.lua` | Server Loop Optimization | Deferred `exports.sunset_admin:IsAdmin` export call inside anomaly condition, eliminating 200 export calls per 5s for normal players. |
| `sunset_core` | `server/main.lua` | DB Yield Optimization | Changed periodic 5-minute playtime flush from synchronous `MySQL.update.await` in loop to non-blocking `MySQL.update`. |
| `sunset_factions` | `server/police.lua` | DB Yield Optimization | Changed background wanted records decay persistence from synchronous `MySQL.update.await` to non-blocking `MySQL.update`. |
| `sunset_needs` | `server/main.lua` | Network Pacing | Distributed 60s character needs sync smoothly across the 60s cycle to prevent 200-packet bursts. |
| `sunset_hud` | `client/main.lua` | Client Frame Budget | Moved `BeginScaleformMovieMethod(minimap, 'SETUP_HEALTH_ARMOUR')` to scaleform load time (once); added `Wait(250)` idle sleep when HUD is inactive. |
| `sql` | `63-performance-indexes.sql` | Database Indexing | Added composite indexes on `phone_messages`, `phone_contacts`, `characters`, `property_rentals`, and `vehicles`. |
| `config` | `server.cfg.template` | Production Hardening | Disabled debug flags (`sv_sunset_jobs_debug 0`, `testdriver_autorun 0`, `sunset_devtools_enabled false`) by default. |

---

## Detailed Audit of the 7 Pre-Load Test Items

### 1. Autosave Scheduler
- **Issue**: At low populations, the loop saved all players in rapid 250ms steps and immediately restarted another cycle without sleeping, resulting in 1 save every 2s for 1 player or ~20s for 10 players instead of the configured 60s interval.
- **Fix**: Stored `cycleStart = GetGameTimer()` before each cycle. After iterating all players, computed `elapsed = GetGameTimer() - cycleStart` and slept `math.max(0, 60000 - elapsed)`. At any population size $N \in [1, 200]$, each character is saved exactly once every 60 seconds with uniform distribution.

### 2. Metadata Regression Fix
- **Issue**: `Sunset.SaveCharacter()` previously removed the read of DB-authoritative columns before updating `characters.metadata`. Systems like `quickslots` and `rob_points` write directly to DB using `JSON_SET(...)`. A subsequent autosave of cached in-memory metadata could wipe those modifications.
- **Fix**: Re-introduced DB-authoritative merge in `Sunset.SaveCharacter()`: before writing `metadata`, queries DB for existing `quickslots`, `rob_points`, and `spawn_choice`, merges them into memory, and only then executes the final update.

### 3. Properties In-Memory Delta & Versioning
- **Issue**: When any property changed, server broadcasted `sunset:client:propertiesUpdated` to `-1`, prompting every online client to execute `getProperties` and query DB rentals.
- **Fix**: 
  - Single-property updates (buy, rent, lock) broadcast `sunset:client:propertyDelta` with the specific changed property row. Clients update their local cache in memory ($O(1)$) with zero DB roundtrips.
  - Structural changes broadcast `sunset:client:propertiesVersion(gen)`. Idle clients do not perform any queries. When a client actually opens the properties NUI panel, it lazily verifies `clientPropertyGeneration == latestServerGeneration` and only refreshes if stale.

### 4. Online Indexes & Clan / Faction Chat
- **Issue**: `GetOnlineCharacters()` previously looped over all `Players` in $O(N)$ on every invocation. Clan chat broadcast iterated this map for every single message.
- **Fix**:
  - `sunset_core` maintains `OnlineCharacters[characterId] = source` in $O(1)$ on player spawn and disconnect. `GetOnlineCharacters()` returns the index directly.
  - `sunset_clans` maintains `OnlineClanMembers[clanId][source] = true`. Clan chat now loops directly over the clan's online members ($O(M)$ where $M$ is online clan size), completely decoupled from total server population $N$.

### 5. Ped Mapping After Model Change
- **Issue**: `PedToPlayerSource[ped]` was cached on initial spawn. When players changed skins (`SetPlayerModel`), GTA V recreates the ped entity, causing the $O(1)$ cache hit in `GetSourceByPed` to fail.
- **Fix**:
  - Client hooks added in `sunset_skins`, `sunset_appearance`, `sunset_factions/client/loadout`, and `sunset_spawn` to immediately trigger `sunset:server:updatePlayerPed` upon model switch.
  - `GetSourceByPed` was augmented with a OneSync fallback: `NetworkGetEntityOwner(pedEntity)` retrieves the owning player source in sub-microseconds and automatically repopulates `PedToPlayerSource[pedEntity]`.

### 6. Gamemode-Wide Systems Hardening
- **Addon Vehicles**: Audited all 6 addon vehicle packages in `sunset_addon_vehicles`. Verified models and textures are lightweight (5 under 2.5MB, largest is 6.1MB), well under FiveM's 16MB warning threshold.
- **Villa Island**: Added missing `files { 'stream/villa_island.ytyp' }` directive in `resources/villa_island/fxmanifest.lua` ensuring archetype request resolution.
- **Server Loops**: Audited all 28 server-side loops. Moved admin export checks in security scanner inside anomaly branches; converted playtime flush and wanted decay updates to non-blocking async queries; paced 60s needs updates evenly across the cycle.
- **Client Frame Budget**: Eliminated per-frame `BeginScaleformMovieMethod` on minimap in `sunset_hud`; added idle sleep `Wait(250)` when HUD is inactive.
- **Memory Tables**: Audited disconnect cleanup (`playerDropped`) across robbery, casino, racing, jobs, taxi, and factions. All transient state tables are properly unmapped.

### 7. Runtime Benchmark & Load Simulation
- Implemented `scripts/benchmark-load.js` against the local MariaDB instance (`rpgblipmade`), testing 48, 100, 150, and 200 concurrent player profiles. See `docs/testing/LOAD_TEST_200P.md` for full measured metrics.

