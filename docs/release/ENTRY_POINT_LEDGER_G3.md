# Entry Point Ledger - Group 3 (SEC3)

Resources (computed as `ls resources/[sunset]` minus G1/G2/dedicated lists):
sunset_addon_vehicles, sunset_carjack, sunset_clothing, sunset_crafting, sunset_drugs, sunset_emotes,
sunset_menu, sunset_panel_bridge, sunset_skins, sunset_tuning.
(sunset_carjack was listed in the task as G3; sunset_menu and sunset_panel_bridge were in no group. sunset_testdriver excluded.)

Enumeration grep (run per resource dir, *.lua):
`grep -rnE "RegisterNetEvent|RegisterServerEvent|RegisterCallback|RegisterCommand|^exports\(|AddEventHandler\('sunset:skins:grant" sunset_carjack sunset_clothing sunset_crafting sunset_drugs sunset_menu sunset_panel_bridge sunset_skins sunset_tuning sunset_emotes --include=*.lua`
plus `AddEventHandler('sunset:nui:*')` in client files (NUI bridge) and the panel_bridge queue `row.action` dispatch.

Total rows: 62 (server-reachable by a client: 30; server-only/queue/exports: 13; client-side-only items listed for completeness: 19). 0 triaged-only rows.
Verdicts: OK 41, FIXED 17, OPEN 4. Edits tagged `-- [SEC3]`.

Legend: callback = `exports.sunset_core:RegisterCallback`.

| resource | name | kind | file:line | auth checks | validation | verdict | note |
|---|---|---|---|---|---|---|---|
| addon_vehicles | (none) | data-only resource | fxmanifest.lua | n/a | n/a | OK | meta/stream files only, no Lua |
| emotes | PlayEmote/StopEmote/IsPlaying/GetEmoteWheelList | client exports | client/main.lua:105-108 | client-local | n/a | OK | no server event, no TriggerServerEvent; nothing to rate-limit server-side |
| emotes | /e style commands | client commands | client/main.lua | client-local | arg lookup in local table | OK | purely local animation |
| carjack | sunset:carjack:tryLockpick | callback | server/main.lua:50 | char loaded, lockpick HasItem + RemoveItem result checked | none needed | FIXED | added 2s RateLimit (DB + XP farm spam) |
| carjack | sunset:carjack:sell | callback | server/main.lua:199 | char, in-flight lock [SEC2], 60s cooldown, chop-shop proximity (server coords), driver seat, not owned/faction/protected | netId tonumber, entity resolved server-side, client model trusted only if hash matches, payout server computed | OK | OPEN-low: any non-owned plated/unplated vehicle incl. job vehicles without a protected state can be sold (60s cooldown caps it) |
| carjack | playerDropped | event (server) | server/main.lua:208 | n/a | n/a | OK | cleanup |
| clothing | sunset:payAppearance | callback | server/main.lua:29 | server ped near shop (15m), cash/bank charge | client amount ignored, fixed 50 | FIXED | now issues a 10-min unspent payment token; no double charge while token held |
| clothing | sunset:refundAppearance | callback | server/main.lua:56 | requires live token | amount floor/<=50 | FIXED | token expiry honoured; consumed on save so refund after successful save denied |
| clothing | HasAppearancePayment / ConsumeAppearancePayment | server exports | server/main.lua:70,74 | token per source | n/a | FIXED | new; used by sunset_appearance |
| appearance | sunset:saveAppearance (G1 file, SEC3 enforcement) | callback | sunset_appearance/server/main.lua:131 | in-game char with existing appearance now requires paid token | ValidateAppearance sanitizer, 8KB cap | FIXED | closes "clothing purchase not enforced on saveAppearance" (barber/wardrobe/direct callback). First-time/creation saves (no active char or empty appearance) stay free. EN+RO key appearance.message.payment_required |
| clothing | sunset:clothing:debug | callback | server/main.lua:83 | admin level 4 | n/a | OK | gate for debug commands |
| clothing | sunset:outfits:list | callback | server/outfits.lua:27 | char, rows scoped to character_id | n/a | OK | |
| clothing | sunset:outfits:save | callback | server/outfits.lua:40 | char, count cap 8 | name trim/len 2-24/markup chars rejected, snapshot sanitized via ValidateAppearance | OK | free by design (stores current look) |
| clothing | sunset:outfits:equip | callback | server/outfits.lua:86 | ownership by character_id | id tonumber, re-sanitized | OK | free for owned outfits |
| clothing | sunset:outfits:delete | callback | server/outfits.lua:112 | ownership in SQL | id tonumber | OK | |
| clothing | sunset:outfits:rename | callback | server/outfits.lua:124 | ownership in SQL | name rules as save | OK | |
| clothing | sunset:nui:wardrobePurchase / clothingApply (+ other wardrobe/clothing NUI events) | NUI->client->server | client/main.lua:283,319 etc | server callbacks above | barber previously `data.pay` optional | FIXED | barber now always calls payAppearance; server enforces regardless |
| clothing | sunset:clothing:applyAppearance, debugToggle | client net events (server->client) | client/main.lua:442, client/debug.lua:144 | n/a | n/a | OK | only server triggers; client-side apply only |
| clothing | clothinglab/clothingdebug/validateoutfit/repairoutfit/clothingtest | client commands | client/debug.lua:218-258 | all gated by sunset:clothing:debug (admin 4) | n/a | OK | |
| clothing | wardrobe/clothes/skin/closewardrobe/outfits | client commands | client/main.lua:399-448 | server callbacks | n/a | OK | |
| crafting | sunset:getCraftingMenu | callback | server/main.lua:1 | char, station proximity 4m (server), faction/grade/duty/illegal perm | station id looked up in server table | OK | |
| crafting | sunset:craftItem | callback | server/main.lua:96 | char, per-source lock, station proximity, faction/grade/duty, illegal perm, weapon license | recipe/station server tables, inputs/outputs from config, atomic SQL transaction w/ FOR UPDATE, weight/slot checks | OK | OPEN-low: recipe.time not enforced server-side (instant craft via direct callback) |
| drugs | sunset:drugs:harvestStart | callback | server/main.lua:100 | char (added), spot proximity, cooldown, single pending | spot index from server config | FIXED | char check added |
| drugs | sunset:drugs:harvestComplete | callback | server/main.lua:128 | char (added), pending token, elapsed time, proximity, cooldown | yield server RNG, AddItem result checked | FIXED | char check added |
| drugs | sunset:drugs:processStart | callback | server/main.lua:180 | char (added), lab proximity, cooldown, has raw | drugType string whitelist via config | FIXED | char check added |
| drugs | sunset:drugs:processComplete | callback | server/main.lua:215 | char (added), pending, elapsed, proximity | atomic ConvertItems | FIXED | char check added |
| drugs | sunset:drugs:sell | callback | server/main.lua:254 | char (added), dealer proximity, cooldown claimed before yield [SEC2], RemoveItem confirmed before pay | amount floor/1..10, price server computed (basePrice x variance) | FIXED | char check added |
| drugs | sunset:drugs:cancelAction | callback | server/main.lua:308 | clears own pending only | n/a | OK | |
| drugs | sunset:drugs:status | callback | server/main.lua:315 | read-only own inventory counts | n/a | OK | works without char (counts 0) |
| menu | sunset:getMenuData | callback | server/main.lua:72 | char+player required | read-only, own data, parametrised SQL | OK | client menu also calls buyLevel/spawnVehicle/toggleDuty/leaveFaction/quitCivilianJob, owned by core/vehicles/factions/jobs groups |
| menu | sunset_menu, stats, chatsettings, close | client commands | client/main.lua:319-332 | n/a | n/a | OK | local UI |
| panel_bridge | IsAccountOnline | server export | server/main.lua:3 | server-only (exports not client reachable) | tonumber | OK | |
| panel_bridge | GetLiveServerStats | server export | server/main.lua:554 | server-only | n/a | OK | |
| panel_bridge | queue consumer (claim + dispatch) | DB poll thread | server/main.lua:451-500 | atomic pending->processing claim; actor loaded from accounts table | pcall-wrapped, error truncated | OK | trusted panel queue; no client path |
| panel_bridge | staff_set_admin / staff_set_helper / staff_remove_role | queue action | server/main.lua:90 | actor admin>=6, no self-target, last-admin-6 protected | level range checked | OK | |
| panel_bridge | warn / mute / unmute | queue action | server/main.lua:198-275 | admin/helper levels, no self-target, target staff protection | mute minutes | FIXED | mute/unmute require resolved target; duration bounded (1..43200) |
| panel_bridge | ban | queue action | server/main.lua:174 | admin>=2, protections | durationMin | FIXED | negative/NaN/inf/huge duration produced instantly-expiring or absurd bans; now finite integer 1..5256000 else `invalid_duration` |
| panel_bridge | unban | queue action | server/main.lua:200 | admin>=3 | target required | OK | |
| panel_bridge | jail / unjail | queue action | server/main.lua:283-310 | admin>=2 | minutes | FIXED | duration bounded (1..10080), target required |
| panel_bridge | set_faction / faction_set_member / faction_set_rank / faction_warn / faction_kick(_fp) / faction_set_leader | queue action | server/main.lua:315-400 | admin>=3 or leader/subleader of named faction; set_leader admin>=4 | factionId charset, grade 0..10 integer | FIXED | non-admin leader could kick/warn any player by naming own factionId, and grant any grade. Now target must be a member (or unemployed for recruit) and grade < actor cap |
| panel_bridge | set_clan / clan_add_member / clan_set_rank / clan_warn / clan_kick / clan_dissolve | queue action | server/main.lua:405-475 | admin>=4 or clan manager rank>=5; dissolve admin>=5 or owner | clanId positive integer, rank clamp 1..7 | FIXED | non-admin manager could pull members out of other clans (DELETE by character) and grant rank >= own; now blocked. check-db-writes reports pre-existing cross-domain writes here (known debt) |
| skins | skins:getAll | callback | server/main.lua:16 | player | read-only | OK | |
| skins | skins:buy | callback | server/main.lua:59 | player+char, 1.5s RateLimit [SEC2], battlepass blocked, already-owned check | price from server config, model lookup | FIXED | added string/length validation of model before lookup. OPEN-low: purchase has no proximity to shop NPC (shop UI is also reachable via /skins by design) |
| skins | skins:equip | callback | server/main.lua:97 | player+char, ownership row required | model type/len/charset, 1s RateLimit | FIXED | model was un-typed (table into SQL param / client SetPlayerModel) |
| skins | giveskin | command | server/main.lua:132 | admin level via sunset_admin (default 3) | id tonumber, target exists | FIXED | model charset/length validated (was arbitrary string stored) |
| skins | setskin | command | server/main.lua:167 | admin level (default 1) | model charset/length | FIXED | same; level 1 setting any ped model for self is existing design |
| skins | sunset:skins:grantBattlepassSkin | server-only event | server/main.lua:229 | not a net event [SEC2] | type/len checked | OK | |
| skins | sunset:skins:applyModel / notify | client net events | client/main.lua:110,121 | server-triggered | n/a | OK | |
| skins | sunset:nui:skinShopBuy/Equip/Close (web/js/skins.js posts to client only) | NUI->client | client/main.lua:75-103 | server callbacks | data table-guarded | OK | web/js does not reach server directly |
| tuning | sunset:tuning:getTune | callback | server/main.lua:81 | char, driver seat, plate matches entity, owns vehicle row | plate normalised | OK | modelName only affects capability echo (read-only) |
| tuning | sunset:tuning:saveTune | callback | server/main.lua:197 | char, driver, plate matches, shop proximity, ownership, FOR UPDATE tx | tune/cosmetics sanitised + validated; cost computed server side; refund on commit failure | FIXED | (1) old cosmetics defaulted to the NEW cosmetics so first save of any paint/neon/wheel/vanity-plate was free: now baseline DefaultCosmetics; (2) per-source in-flight lock |
| tuning | sunset:tuning:getInstallQuote | callback | server/main.lua:207 | char, ownership | sanitised | FIXED | quote now uses same baseline as saveTune (quote == charge) |
| tuning | sunset:tuning:beginDyno | callback | server/main.lua:229 | char, driver, shop proximity, ownership, one session | token server issued | OK | |
| tuning | sunset:tuning:cancelDyno | callback | server/main.lua:250 | token must match session | tostring | OK | |
| tuning | sunset:tuning:finishDyno | callback | server/main.lua:258 | token, 8-45s timing, driver, shop proximity, ownership | hp/torque clamped 0..2000 | OPEN | hp/torque are client-measured; leaderboard value spoofable up to 2000 (cosmetic ranking only; no server dyno possible) |
| tuning | sunset:tuning:getLeaderboard | callback | server/main.lua:287 | none (public by design) | read-only top 15 | OK | exposes plates/models of top dyno cars |
| tuning | sunset:tuning:flashApplied | net event | server/main.lua:326 | char, driver, shop proximity, ownership | plate type/len | FIXED | had no rate limit (DB read + broadcast per call); added 1s limit; applies persisted (not client) tune |
| tuning | sunset:tuning:syncExhaustFx | net event | server/main.lua:345 | driver of entity, owns vehicle, persisted tune must allow the fx | fx whitelist, intensity clamp, colour from persisted tune | FIXED | interval 60ms -> 120ms (DB read per call) |
| tuning | sunset:tuning:syncNosState | net event | server/main.lua:390 | driver of entity | [SEC2] sanitised + rate limited | OK | |
| tuning | GetVehicleTuningInfo | server export | server/main.lua:430 | server-only | decodeProps | OK | |
| tuning | NUI posts (tuningSave/GetQuote/Preview/Dyno/Leaderboard...) | NUI->client | web/app.js:218 `post()` | server callbacks above | app.js never contacts server directly; innerHTML uses config labels (SEC2 note) | OK | |
| tuning | applyByPlate / loadPlateTune / exhaustFx / nosState / spawnOwnedVehicle | client net events | client/apply.lua:146,163; effects.lua:113; nitrous.lua:257; main.lua:450 | server-triggered | n/a | OK | |
| tuning | lsc_menu mechanicShopRepair call | client->server callback (owned by sunset_factions:404) | client/lsc_menu.lua:102 | n/a | n/a | OK | handler belongs to factions group |

## Cross-group notes
- Duty-weapon quickslot allowlist (sunset_inventory/sunset_factions): not in G3; not modified.
- sunset_slots/server.lua currently fails check-lua-syntax (`...` outside vararg at line 17); another agent's in-progress edit, not G3.
- check-lua-forward-refs: only sunset_factions/server/main.lua:433 (other group) + third-party libs.
- check-db-writes: panel_bridge lines are the pre-existing cross-domain writes (the panel queue by design).

## Checks after edits
check-lua-syntax (only slots, other group, failing), check-nui-bridge OK, check-locales 0 problems (new keys: appearance.message.payment_required, drugs.message.no_character, EN+RO).
