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
| `sql` | `63-performance-indexes.sql` | Database Indexing | Added composite indexes on `phone_messages`, `phone_contacts`, `characters`, `property_rentals`, and `vehicles`. |
| `config` | `server.cfg.template` | Production Hardening | Disabled debug flags (`sv_sunset_jobs_debug 0`, `testdriver_autorun 0`, `sunset_devtools_enabled false`) by default. |
