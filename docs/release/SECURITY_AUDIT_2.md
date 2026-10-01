# Security Audit 2 (SEC2)

Scope: all `resources/[sunset]` server events, callbacks, commands and NUI-to-server paths EXCEPT sunset_jobs, taxi, fishingshop, fishing_tournament, racing, quests, missions (other owner) and sunset_ui layout/CSS. Edits are tagged `[SEC2]` in code. The tree is not a git repo, so there is no diff; grep `SEC2`.

## Counts
- Server entry points enumerated: 491 (RegisterNetEvent / RegisterServerEvent / RegisterCallback / RegisterCommand / server-handled events) outside excluded resources. Roughly 130 callbacks/events plus ~60 commands were read in full; the rest were triaged by permission-pattern scan and spot reads.
- Vulnerable or weak found: 33
- Fixed: 31
- Remaining (documented, not fixed): 7 (2 of them are also in the "found" count, see below)

## Fixed (file)
1. sunset_core/server/player.lua: money/BP/XP amounts accepted NaN/inf/huge (`SanitizeMoneyAmount`, cap 2e9).
2. sunset_slots/server.lua: PayOutRewards trusted client amount, no session needed (infinite chips). Now requires server session, clamp 4x stake, max 200k. takePlace could steal seats.
3. sunset_blackjack/server.lua: SetPlayerBet unvalidated (negative/huge bet, bet set without chips taken, rebet mid-round); double/split ignored failed TakeMoney; moves unvalidated; sit/stand/remove unvalidated table/seat; float payout via math.tointeger.
4. sunset_roulette/server.lua: result broadcast BEFORE bets were collected (guaranteed win); bets/amounts/numbers unvalidated; chairs spoofable. Bets now collected, validated, charged first.
5. sunset_luckywheel/server.lua: no proximity; prize paid to recycled source id.
6. sunset_casino/server/main.lua: no casino proximity on money callbacks; blackjack double-settle race; roulette nil betValue; probeLog disk/log spam by clients.
7. sunset_economy/server/main.lua: atm/phone transfer NaN/non-number, no throttle; client businessId credited any business.
8. sunset_skins: grantBattlepassSkin was a client-triggerable net event (any skin for free) now server-only; skins:buy double-charge race; direct `characters` write moved to `sunset_core:SetCharacterSkin`.
9. sunset_world/server/glue_server.lua: glue to any vehicle from any distance, no rate limit.
10. sunset_inventory/server/trade.lua: NaN cash offer.
11. sunset_admin/server/commands.lua: `sunset:admin:submitFncName` let any player rename themselves; now requires admin-forced FNC pending.
12. sunset_vehicles: spawnVehicle non-atomic claim (double spawn); garage id length.
13. sunset_death/server/main.lua: playerDied / enteredDowned / bleedoutExpired / requestRespawn trusted the client (free hospital/home teleport, custody/pursuit escape). Now corroborated with server ped health or server Downed state plus rate limit. (Closes SECURITY_AUDIT H3 partially; see remaining.)
14. sunset_drugs: sell cooldown stamped after yielding calls.
15. sunset_tuning: syncNosState unsanitised broadcast, no rate limit.
16. sunset_impound: recover double-spawn/double-release race (now atomic claim before charge); confiscate had no proximity to the vehicle.
17. sunset_cnn: `sunset:cnn:getQueue` leaked phone numbers/server ids/unmoderated ads to every player (staff only now).
18. sunset_phone: avatar was stored/served unvalidated and interpolated into other players' `<img src>` (stored XSS) - validated server side AND `safeAvatarSrc` in NUI; SMS and 112 spam rate limits.
19. sunset_sessions: resetRoutingBucket let a client leave a live session bucket.
20. sunset_anticheat/server/ledger.lua: `markLegitLocal` accepted any check type (`all`) so a cheater could whitelist themselves; now only vehicle_spawn/trucker_tp, throttled.
21. sunset_turfs: warRespawn callable alive (scored kills, heal, teleport).
22. sunset_dispatch: 112 call spam (all entry points).
23. sunset_fire: NaN extinguish amount zeroed incident health.
24. sunset_carjack: parallel chop-shop sale double payout; lockpick consumed result ignored.
25. sunset_factions/server/main.lua: /sellpouch and /fence payable anywhere and paid even when RemoveItem failed; taxi fare accept double-accept.
26. sunset_clans: parallel clanCreate refund path (free clan).
27. sunset_core/server/main.lua: createCharacter stored client appearance verbatim.
28. NUI XSS (sunset_ui/web/js): panels.js (name, reason, label, plate, documents ID card, jobcenter, help), characters.js, mdc_tablet.js (35 interpolations: plates, owner names, reasons), inventory-forza.js (nearby player names), turf_map.js (clan names), phone.js (avatar, taxi labels). chat.js, clans.js, menu.js, scoreboard.js, helpdesk.js, trade, quests already escaped.
29-31. See sunset_core money helper reuse (XP/RP/BP), roulette chair release, blackjack seat.

## Remaining / not fixed (classification)
- Slots outcome is computed in the NUI (client RNG): payout is clamped, not authoritative. REQUIRES SERVER-SIDE RNG REWRITE. Status: PARTIALLY FIXED.
- Appearance/clothing purchase is not enforced on `saveAppearance` (free clothes). LOW, economy sink only.
- Weapons/teleport/noclip natives are client side by design; `/tpwp` gate is client-only (anticheat is the control). REQUIRES LIVE TEST of anticheat.
- `sunset_inventory` duty-weapon quickslot accepts any weapon string (client equips natively).
- Cross-domain DB writes sunset_vehicles -> character_inventory (fuel/gas can transaction) and others in "known debt"; moving them needs a cross-resource transaction API. check-db-writes reports 0 NEW.
- Non-sunset_ui NUIs (sunset_tuning, sunset_robbery, sunset_pass, sunset_skins web) use innerHTML with config-sourced labels only. Not player controlled.
- Admin `/coords`, test commands exist client side but gated by `sunset_dev` convar or admin level (see matrix).

## Dev/test surface
`sunset_testdriver`, `sunset_test_agent`, `sunset_devtools`, `sunset_admintools` are commented out of server.cfg.template (testdriver commands console-only; devtools/test agent require kill-switch convars + admin 4-5). `robdebug` requires `SunsetRobbery.Debug` (false) + admin. `testvault`, `testradaralert` require `sunset_dev 1`. No hardcoded test identifiers found. Note `deploy` may enable testdriver on the VPS; keep `testdriver_autorun 0` in production.

## Classification
- VERIFIED (read, no gap): economy shop/ATM, inventory move/trade/container/drop, dealership, properties buy/rent, vehicles store/fuel/insurance/keys, crafting, drugs, pass, police tickets, clans manage, licenses practical, businesses, marriage, auth.
- FIXED: items above.
- PARTIALLY VERIFIED: factions leaders/roster/EMS/detention callbacks (permission helper reads only), robbery sessions, anticheat detectors, interactions context.
- REQUIRES LIVE FIVEM TEST: death corroboration (OneSync health lag; retry window 3s), roulette bet collection timing vs client (`getClientInput` before spin), blackjack bet/double flow, turf warRespawn health check, avatar data-URL regex vs real headshots, SetCharacterSkin JSON_SET, impound proximity (needs spawned entity within 40m), faction stash proximity (6m), casino proximity (180m from exit).
