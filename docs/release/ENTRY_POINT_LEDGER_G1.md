# Entry point ledger - Group 1 (SEC3)

**Row count: 211** (rows with verdict FIXED: 49; OPEN: 0; remaining OK). Rows for grouped aliases (e.g. 19 stat aliases, 5 repair aliases) count as one row each, so the number of distinct registered names is higher than the row count; every alias shares the audited handler.

## How enumerated (reproducible)
```
cd resources/[sunset]
# server files of group 1 (manifest server_scripts) then:
grep -nE 'RegisterNetEvent|RegisterServerEvent|RegisterCallback|RegisterCommand|SetHttpHandler|AddEventHandler|registerServerCommand|exports\(' <server files>
grep -n "registerServerCommand('" sunset_admin/server/commands.lua sunset_admin/server/actions.lua   # 98 names (+19 stat aliases from loop at commands.lua:367)
grep -rn TriggerServerEvent sunset_ui/client                                                      # only nuiError reaches server
```
All server files were read in full except where the file is only exports/boilerplate (command_feedback.lua, money_log.lua, discord_logs.lua, sanctions.lua read fully; test_agent tools.lua/domains.lua/log.lua checked by grep for RegisterNetEvent/PerformHttpRequest/io/os.execute: none). Exports are server-local; they are listed because net events/callbacks forward to them, and each forwarding path was read.

Verdict legend: OK = read, checks present; FIXED = gap found and patched (tag `[SEC3]`); OPEN = documented, not fixed.

| resource | name | kind | file:line | auth checks present | validation present | verdict | note |
|---|---|---|---|---|---|---|---|
| sunset_core | sunset:server:updatePlayerPed | net event | sunset_core/server/main.lua:70 | source only; maps own ped | none needed | OK | self-only cache refresh |
| sunset_core | sunset:server:flowTrace | net event | sunset_core/server/main.lua:80 | 100ms per-source rate limit | type+length stage<=64 detail<=160 | OK | console log only |
| sunset_core | sunset:server:triggerCallback | net event (callback bus) | sunset_core/server/main.lua:269 | per-source 30/s + per-name 12/s limits; callback must exist | name string<=80, requestId number; pcall wraps handler | OK | each callback does own auth |
| sunset_core | sunset:server:playerLoaded | net event | sunset_core/server/main.lua:347 | license required; replay ignored once authenticated | n/a | OK | AUDIT P2-03 |
| sunset_core | sunset:server:prepareSpawn | net event | sunset_core/server/main.lua:371 | moves bucket 0 only if session.authenticated | n/a | OK |  |
| sunset_core | sunset:server:characterSpawned | net event | sunset_core/server/main.lua:695 | requires loaded char and matching id | tonumber compare | OK |  |
| sunset_core | sunset:server:setActiveCharacter | server-only event | sunset_core/server/main.lua:703 | not net-registered (verified by grep); server TriggerEvent only | n/a | OK |  |
| sunset_core | sunset:setLocale | callback | sunset_core/server/main.lua:251 | logged-in player (SetPlayerLocale) | locale whitelist | OK |  |
| sunset_core | sunset:setConnectionLocale | callback | sunset_core/server/main.lua:262 | pre-auth by design | locale whitelist | OK |  |
| sunset_core | sunset:getCharacters | callback | sunset_core/server/main.lua:753 | player session; filters player_id | none | OK |  |
| sunset_core | sunset:createCharacter | callback | sunset_core/server/main.lua:768 | player session; MaxCharacters; per-source in-flight lock | name/DOB/gender/nationality validated; appearance validated+8KB cap; gender forced 0/1; non-table data rejected | FIXED | [SEC3] concurrent creates bypassed limit/slot; gender float |
| sunset_core | sunset:selectCharacter | callback | sunset_core/server/main.lua:841 | player session; ownership via player_id in SQL; dup-load check; per-source in-flight lock | integer charId | FIXED | [SEC3] concurrent select/enterGame double-load |
| sunset_core | sunset:enterGame | callback | sunset_core/server/main.lua:847 | player session; idempotent | n/a | OK |  |
| sunset_core | sunset:deleteCharacter | callback | sunset_core/server/main.lua:881 | session; ownership checked twice (FOR UPDATE tx); active char refused | numeric charId | OK |  |
| sunset_core | playerDropped / onResourceStop / explosionEvent | engine handlers | sunset_core/server/main.lua:730,933; security.lua:159 | server events (explosionEvent allowlist, cancels disallowed types) | tonumber(explosionType) | OK |  |
| sunset_core | sunset:buyLevel | callback | sunset_core/server/player.lua:550 | character loaded; atomic guarded UPDATE; per-source lock | server-computed costs | FIXED | [SEC3] SQL error left lock set forever (pcall wrapper) |
| sunset_core | buylevel | command | sunset_core/server/player.lua:554 | character loaded via buyLevel | n/a | OK |  |
| sunset_core | lang / language | command x2 | sunset_core/server/locale_commands.lua:32-33 | player only | locale whitelist | OK |  |
| sunset_core | money/char exports (AddMoney,RemoveMoney,MoveMoney,TransferMoney,SetPersistentStat,SetJob,SetFaction,AddXP,SpendBlazePoints,...) | server-local exports | sunset_core/server/player.lua:652-739 | server-local only; not reachable from clients (no event forwards raw client args; checked by reading every net event/callback in group) | SanitizeMoneyAmount finite/<=2e9; field whitelist; faction/job grade tables | OK | SEC2 hardened |
| sunset_core | RegisterCallback/GetPlayer/GetCharacter/... lookup exports | server-local exports | sunset_core/server/main.lua:122-577 | server-local | tonumber | OK |  |
| sunset_core | SendDiscordLog / LogMoneyTransaction | server-local exports | discord_logs.lua:61; money_log.lua:35 | webhook URL from server convar only (never client-supplied) | reason<=64 | OK |  |
| sunset_auth | sunset:auth:requestUiStart | net event | sunset_auth/server/main.lua:39 | none (no-op) | none | OK | no-op handler |
| sunset_auth | sunset:authRegister | callback | sunset_auth/server/main.lua:128 | pre-auth; rejects already-authenticated source; 15s per-source throttle | username/password type+length (pw<=128), email regex/254, scrypt hash | FIXED | [SEC3] authenticated sources could mint accounts; no throttle; no type checks |
| sunset_auth | sunset:authLogin | callback | sunset_auth/server/main.lua:158 | lockout keyed by license (survives reconnect); rejects authenticated source | type checks, pw<=128 | FIXED | [SEC3] lockout reset on reconnect; non-string password |
| sunset_auth | sunset:authQuickLogin | callback | sunset_auth/server/main.lua:207 | token hash + device(license) hash + expiry; counted in lockout | token string 32-128 | FIXED | [SEC3] failures were not rate-limited |
| sunset_auth | sunset:authSetEmail | callback | sunset_auth/server/main.lua:233 | requires PendingEmail from verified password/token | email validated + unique | OK |  |
| sunset_auth | HashPassword/VerifyPassword/GenerateQuickToken/HashToken/IsPlayerAuthenticated | server-local exports | password.js; main.lua:35 | server-local | scrypt fixed params | OK |  |
| sunset_auth_ui | (no server entry points) | - | sunset_auth_ui/client/main.lua | client NUI forwards to sunset_core callbacks only | - | OK | 0 server scripts |
| sunset_characters | (no entry points; autosave thread) | - | sunset_characters/server/main.lua:1 | n/a | - | OK |  |
| sunset_spawn | (no server scripts) | - | sunset_spawn/fxmanifest.lua | n/a | - | OK |  |
| sunset_player | (autosave thread only) | - | sunset_player/server/main.lua | n/a | - | OK |  |
| sunset_appearance | sunset:saveAppearance | callback | sunset_appearance/server/main.lua:131 | player session; target char resolved FIRST (loaded or own via player_id); non-empty stored appearance requires sunset_clothing paid token (G3 change kept) | full sanitizer; 8KB; charId integer; SQL re-checks player_id | FIXED | [SEC3] pre-game (no loaded char) forged charId bypassed payment gate. Creation + empty-appearance first save remain free (needsPayment only when stored appearance non-empty; createCharacter validates its own appearance) |
| sunset_appearance | ValidateAppearance | server-local export | sunset_appearance/server/main.lua:174 | server-local | sanitizer | OK |  |
| sunset_admin | playerConnecting | engine handler | sunset_admin/server/main.lua:115 | ban check by license/ip/hardware tokens | parameterized | OK |  |
| sunset_admin | sunset:server:playerLoaded | net event | sunset_admin/server/main.lua:165 | DB-sourced levels only | 5s per-source throttle | FIXED | [SEC3] 3 queries per replay |
| sunset_admin | sunset:server:characterSpawned | net event | sunset_admin/server/main.lua:177 | DB-sourced levels only | 5s throttle | FIXED | [SEC3] |
| sunset_admin | sunset:server:playerReady / authenticated | server-only events | sunset_admin/server/main.lua:169,173 | not net-registered | - | OK |  |
| sunset_admin | sunset_setowner | command | sunset_admin/server/main.lua:238 | restricted=true + console only (src~=0 returns) | tonumber target | OK |  |
| sunset_admin | IsAdmin/IsHelper/SetAdmin/SetHelper/GetPlayerIP/... | server-local exports | sunset_admin/server/main.lua:15-254 | server-local | level tonumber | OK |  |
| sunset_admin | sunset:admin:setcp | net event | sunset_admin/server/commands.lua:1687 | requirePerm setcp (server level) | name normalized<=64; x,y,z,heading finite and /v/<20000 | FIXED | [SEC3] NaN/inf coords |
| sunset_admin | sunset:admin:delcp | net event | sunset_admin/server/commands.lua:1711 | requirePerm delcp | normalized id | OK |  |
| sunset_admin | sunset:admin:gotocp | net event | sunset_admin/server/commands.lua:1725 | requirePerm gotocp | string query | OK |  |
| sunset_admin | sunset:admin:gotoloc | net event | sunset_admin/server/commands.lua:1745 | requirePerm gotoloc | string query | OK |  |
| sunset_admin | sunset:admin:requestSpeed | net event | sunset_admin/server/commands.lua:1765 | requirePerm speed | clamped 0.5-10 | OK |  |
| sunset_admin | sunset:admin:saveGizmoCoords | net event | sunset_admin/server/commands.lua:1880 | requirePerm moveveh | table check; log only | OK |  |
| sunset_admin | sunset:admin:weaponGiveFailed | net event | sunset_admin/server/commands.lua:2585 | target client reports to giving admin; admin must be IsAdmin | weapon charset/len<=40; 3s rate limit per sender | FIXED | [SEC3] was unbounded text + spam to any admin |
| sunset_admin | sunset:admin:submitFncName | callback | sunset_admin/server/commands.lua:2500+ | requires admin-forced FncPending (SEC2) | 3-24 chars charset; uniqueness | OK | SEC2 re-read: minor double-submit race only rewrites same name |
| sunset_admin | freeze | command | sunset_admin/server/actions.lua:614 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | unfreeze | command | sunset_admin/server/actions.lua:615 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | slap | command | sunset_admin/server/actions.lua:616 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | pullout | command | sunset_admin/server/actions.lua:617 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | spec | command | sunset_admin/server/actions.lua:618 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | spectate | command | sunset_admin/server/actions.lua:619 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | tpcar | command | sunset_admin/server/actions.lua:620 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | bringcar | command | sunset_admin/server/actions.lua:621 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | tpback | command | sunset_admin/server/actions.lua:622 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | aunjail | command | sunset_admin/server/actions.lua:624 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | aclear | command | sunset_admin/server/actions.lua:625 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | ahealall | command | sunset_admin/server/actions.lua:626 (30s confirm) | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | fixall | command | sunset_admin/server/actions.lua:627 (confirm) | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | dvall | command | sunset_admin/server/actions.lua:628 (confirm, unowned only) | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | gotoid | command | sunset_admin/server/actions.lua:629 | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | setclan | command | sunset_admin/server/actions.lua:630 (rank clamp, clan export) | server requirePerm / staff check in handler (restricted=false, perm server-side) | arg parsing | OK |  |
| sunset_admin | ajail | command | actions.lua:623 | requirePerm ajail; self-guard | minutes 1-1440 | OK |  |
| sunset_admin | aduty | command | actions.lua:631 | IsAdmin(1) server check | see note | OK | state bag set server-side |
| sunset_admin | hduty | command | actions.lua:632 | IsHelper(1) server check | arg parsing | OK |  |
| sunset_admin | setstat/set* aliases (setcash,setmoney,setbank,setlevel,setrp,setrespect,setpaydays,setplaytime,setpremium,setsunsetcoins,setsc,setpp,sethunger,setthirst,setstress,setrob,setrobpoints) | command | sunset_admin/server/commands.lua:359-369 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | 19 registered names, one handler; bounds per stat; core SetPersistentStat |
| sunset_admin | astats | command | sunset_admin/server/commands.lua:371 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | setjobstat | command | sunset_admin/server/commands.lua:395 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | whole number bounds; job whitelist |
| sunset_admin | kick | command | sunset_admin/server/commands.lua:471 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | added rank guard canActOn + reason<=200 |
| sunset_admin | ban | command | sunset_admin/server/commands.lua:487 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | rank guard + reason cap |
| sunset_admin | banip | command | sunset_admin/server/commands.lua:504 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | rank guard + reason cap |
| sunset_admin | tempban | command | sunset_admin/server/commands.lua:521 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | rank guard; duration token whitelist |
| sunset_admin | mute | command | sunset_admin/server/commands.lua:538 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | rank guard; duration finite integer<=43200; reason<=200 |
| sunset_admin | unmute | command | sunset_admin/server/commands.lua:583 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | nmute | command | sunset_admin/server/commands.lua:603 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | staff; rank guard; duration clamp |
| sunset_admin | unnmute | command | sunset_admin/server/commands.lua:650 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | staff |
| sunset_admin | warn | command | sunset_admin/server/commands.lua:669 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | rank guard existed |
| sunset_admin | history | command | sunset_admin/server/commands.lua:685 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | clearwarns | command | sunset_admin/server/commands.lua:693 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | unban | command | sunset_admin/server/commands.lua:731 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | license: arg parameterized |
| sunset_admin | tp | command | sunset_admin/server/commands.lua:790 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | coords parsed from text; admin only |
| sunset_admin | bring | command | sunset_admin/server/commands.lua:817 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | car | command | sunset_admin/server/commands.lua:832 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | model forwarded to admin own client |
| sunset_admin | giveitem | command | sunset_admin/server/commands.lua:841 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | count integer 1-100000 |
| sunset_admin | givegun | command | sunset_admin/server/commands.lua:873 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | ammo 0-9999 |
| sunset_admin | dv | command | sunset_admin/server/commands.lua:904 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | arepaircar/arepair/fixcar/fix/fixveh | command | sunset_admin/server/commands.lua:922-925,1161 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | 5 names |
| sunset_admin | heal | command | sunset_admin/server/commands.lua:929 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | faction medics must be within 25m + same bucket |
| sunset_admin | revive | command | sunset_admin/server/commands.lua:953 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | faction medics within 25m + same bucket |
| sunset_admin | arespawn | command | sunset_admin/server/commands.lua:979 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | noclip | command | sunset_admin/server/commands.lua:1036 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | god | command | sunset_admin/server/commands.lua:1043 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | goto | command | sunset_admin/server/commands.lua:1052 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | IsStaff; helper 180s cooldown |
| sunset_admin | gethere | command | sunset_admin/server/commands.lua:1082 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | spawncar | command | sunset_admin/server/commands.lua:1097 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | gotocar | command | sunset_admin/server/commands.lua:1124 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | getcar | command | sunset_admin/server/commands.lua:1142 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | mark | command | sunset_admin/server/commands.lua:1167 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | gotomark | command | sunset_admin/server/commands.lua:1177 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | disarm | command | sunset_admin/server/commands.lua:1189 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | disarmarea | command | sunset_admin/server/commands.lua:1202 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | radius cap 200 |
| sunset_admin | setvw | command | sunset_admin/server/commands.lua:1231 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | integer 0-65535 not 9999; rank guard |
| sunset_admin | sethp | command | sunset_admin/server/commands.lua:1249 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | clamp 0-200 |
| sunset_admin | sethparea | command | sunset_admin/server/commands.lua:1262 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | hp/radius clamped |
| sunset_admin | givemoney | command | sunset_admin/server/commands.lua:1292 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | called nonexistent export AddCash (always failed); now AddMoney with 1..2e9 integer |
| sunset_admin | giverpall | command | sunset_admin/server/commands.lua:1321 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | amount integer 1..1e6 |
| sunset_admin | respawncars | command | sunset_admin/server/commands.lua:1359 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | non-player vehicles only |
| sunset_admin | entercar | command | sunset_admin/server/commands.lua:1391 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | afklist | command | sunset_admin/server/commands.lua:1397 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | togfind | command | sunset_admin/server/commands.lua:1421 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | check | command | sunset_admin/server/commands.lua:1432 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | pm | command | sunset_admin/server/commands.lua:1477 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | IsStaff |
| sunset_admin | anno | command | sunset_admin/server/commands.lua:1518 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | sett | command | sunset_admin/server/commands.lua:1535 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | hour/min range |
| sunset_admin | setw | command | sunset_admin/server/commands.lua:1549 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | weather validated by economy export |
| sunset_admin | setadmin | command | sunset_admin/server/commands.lua:1577 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | level 6 only; level now integer 0-6; offline demotion also clears admins table; license required |
| sunset_admin | sethelper | command | sunset_admin/server/commands.lua:1643 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | level 6 only; level integer 0-3; offline demotion syncs helpers table |
| sunset_admin | coords | command | sunset_admin/server/commands.lua:1694 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | dl | command | sunset_admin/server/commands.lua:1839 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | dlp | command | sunset_admin/server/commands.lua:1848 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | moveveh | command | sunset_admin/server/commands.lua:1857 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | vehfree | command | sunset_admin/server/commands.lua:1863 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | spawntrailer | command | sunset_admin/server/commands.lua:1870 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | tptruck | command | sunset_admin/server/commands.lua:1878 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | trucktp | command | sunset_admin/server/commands.lua:1885 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK |  |
| sunset_admin | report | command | sunset_admin/server/commands.lua:1975 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | player-facing; 15s cooldown; text<=300 |
| sunset_admin | ar | command | sunset_admin/server/commands.lua:2042 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | requirePerm |
| sunset_admin | cr | command | sunset_admin/server/commands.lua:2109 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | requirePerm |
| sunset_admin | reports | command | sunset_admin/server/commands.lua:2181 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | requirePerm |
| sunset_admin | n / helpme | command | sunset_admin/server/commands.lua:2275-2276 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | FIXED | player-facing; nmute check; 15s cooldown; text<=300 |
| sunset_admin | an / na / nr | command | sunset_admin/server/commands.lua:2337-2339 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | IsStaff |
| sunset_admin | nd | command | sunset_admin/server/commands.lua:2341 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | IsStaff |
| sunset_admin | fnc / givefnc / changename / setname / forcenamechange | command | sunset_admin/server/commands.lua:2497-2501 | server-side perm/staff check inside handler (registered restricted=false; perm never client-side) |  | OK | requirePerm fnc; name charset/len/unique |
| sunset_admin | sunset:helpdesk:panel | callback | sunset_admin/server/helpdesk.lua:96 | GetAdminLevel>=1 server | none | OK | read-only roster |
| sunset_admin | sunset:helpdesk:action | callback | sunset_admin/server/helpdesk.lua:143 | GetAdminLevel>=1, then every action routed through permission-checked handlers/exports | targetId tonumber; action whitelist | OK | cnn exports are called with staff source; AdMute minutes now clamped in cnn |
| sunset_admin | ExecutePanelModeration/ExecutePlayerCommand/BroadcastStaff/BanPlayer/RecordSanction/GetActiveReports/IsMuted | server-local exports | sunset_admin/server/panel.lua:3 etc | server-local; panel export re-checks actor level | whitelisted actions, reason, duration, license regex | OK |  |
| sunset_admintools | sunset:admintools:check | callback | sunset_admintools/server/main.lua:18 | IsAdmin>=3 | n/a | OK | dev-only resource |
| sunset_admintools | sunset:admintools:report | net event | sunset_admintools/server/main.lua:25 | IsAdmin>=3 | tonumber fields | OK |  |
| sunset_admintools | blzresmon | command | sunset_admintools/server/main.lua:48 | IsAdmin>=3 server | seconds clamp 3-30 | OK |  |
| sunset_admintools | sweeporphans | command | sunset_admintools/server/main.lua:78 | IsAdmin>=3 server | arg compare | OK |  |
| sunset_anticheat | sunset:anticheat:clientTick | net event | sunset_anticheat/server/detectors.lua:300 | advisory telemetry only; spam detector; nonce | payload type checks; weapons array now <=64 | FIXED | [SEC3] unbounded client array |
| sunset_anticheat | sunset:anticheat:markLegitLocal | net event | sunset_anticheat/server/ledger.lua:321 | SEC2 allowlist of 2 check types, rate limit 1s | seconds clamp | OK | SEC2 re-read |
| sunset_anticheat | acheat | command | sunset_anticheat/server/main.lua:36 | IsAdmin>=1 server | tonumber id | OK |  |
| sunset_anticheat | achud | command | sunset_anticheat/server/main.lua:125 | IsAdmin>=1 server | n/a | OK |  |
| sunset_anticheat | sunset:anticheat:panel | callback | sunset_anticheat/server/main.lua:174 | IsAdmin>=1 | tonumber | OK |  |
| sunset_anticheat | sunset:anticheat:dismiss | callback | sunset_anticheat/server/main.lua:197 | IsAdmin>=1; target must be online | tonumber | OK |  |
| sunset_anticheat | weaponDamageEvent / entityCreated / playerDropped | engine handlers | sunset_anticheat/server/detectors.lua:267; ledger.lua:300 | server engine events; detection only (never auto-ban) | type(data)=table, tonumber | OK |  |
| sunset_anticheat | MarkLegit/AddStrike/DismissStrikes/GetHeat/... | server-local exports | sunset_anticheat/server/context.lua:237; strikes.lua:273 | server-local | - | OK |  |
| sunset_devtools | sunset:devtools:checkPerm | net event | sunset_devtools/server/main.lua:22 | sunset_dev=1 + kill switch + admin level | n/a | OK | dev-only |
| sunset_devtools | sunset:devtools:saveDraft | net event | sunset_devtools/server/main.lua:35 | same gate | draft shape/size/v4 numeric now enforced | FIXED | [SEC3] unbounded client JSON to disk |
| sunset_devtools | devdrafts | command | sunset_devtools/server/main.lua:46 | gate (console ok) | clear prefix now literal not Lua pattern | FIXED | [SEC3] pattern injection |
| sunset_devtools | sunset:devtools:getJobRoutes | callback | sunset_devtools/server/routes.lua:22 | gate | jobName lower string | OK |  |
| sunset_devtools | sunset:devtools:saveJobRoutes | callback | sunset_devtools/server/routes.lua:32 | gate | table check; sunset_jobs SaveRoutes validates | OK |  |
| sunset_devtools | sunset:devtools:reloadJobRoutes | callback | sunset_devtools/server/routes.lua:53 | gate | n/a | OK |  |
| sunset_test_agent | HTTP handler (SetHttpHandler) /testagent/* | http | sunset_test_agent/server/http.lua:297 | kill switch + constant-time bearer (convar token, never sent to clients); screenshot upload needs one-shot issued id | JSON body, mime check, issued id | OK | dev-only; token only `set` (not setr) |
| sunset_test_agent | sunset:testagent:rpcResult | net event | sunset_test_agent/server/rpc.lua:95 | pending id must exist and source must equal intended target | id string | OK |  |
| sunset_test_agent | testagent | command | sunset_test_agent/server/commands.lua:24 | kill switch + admin>=minAdminLevel | action whitelist | OK |  |
| sunset_test_agent | testshot | command | sunset_test_agent/server/commands.lua:81 | kill switch + admin + registered test player | n/a | OK |  |
| sunset_test_agent | testagent_selftest | command | sunset_test_agent/server/auth.lua:238 | restricted=true + console only | n/a | OK |  |
| sunset_testdriver | integrity | command | sunset_testdriver/server/main.lua:276-291 | restricted=true and source~=0 returns; dev-only | n/a | OK |  |
| sunset_testdriver | sessiontest | command | sunset_testdriver/server/main.lua:276-291 | restricted=true and source~=0 returns; dev-only | n/a | OK |  |
| sunset_testdriver | smoketest | command | sunset_testdriver/server/main.lua:276-291 | restricted=true and source~=0 returns; dev-only | n/a | OK |  |
| sunset_testdriver | testall | command | sunset_testdriver/server/main.lua:276-291 | restricted=true and source~=0 returns; dev-only | n/a | OK |  |
| sunset_ui | sunset:server:nuiError | net event | sunset_ui/server/main.lua:7 | 5 per 10s per source | all fields stringified, control chars stripped, message<=300 | FIXED | [SEC3] log forging via newlines |
| sunset_ui | nuistats | command | sunset_ui/server/main.lua:22 | restricted=true (ACE) | n/a | OK |  |
| sunset_ui | nui_bridge.lua forward() -> client events | NUI->client | sunset_ui/client/nui_bridge.lua | only reaches server via enumerated callbacks/events; check-nui-bridge 205/205 | - | OK | only TriggerServerEvent in sunset_ui is nuiError |
| sunset_chat | sunset:chat:send | net event | sunset_chat/server/main.lua:135 | mute check; staff channel requires IsStaff; now requires loaded character | 350ms rate limit; text cleaned<=256; channel lowered | FIXED | [SEC3] pre-login clients could broadcast OOC |
| sunset_chat | sunset:chat:runCommand | net event | sunset_chat/server/command_router.lua:215 | 400ms rate limit; admin level check + handler re-checks; resources enforce own perms | line type + now <=512 chars | FIXED | [SEC3] unbounded line |
| sunset_chat | sunset:server:characterSpawned | net event | sunset_chat/server/connect_motd.lua:21 | loaded char + id match | tonumber | OK |  |
| sunset_chat | a | command | sunset_chat/server/main.lua:219 | IsAdmin>=1 | text<=256 cleaned | OK |  |
| sunset_chat | e | command | sunset_chat/server/main.lua:250 | IsStaff | text<=256 cleaned | OK |  |
| sunset_chat | lc | command | sunset_chat/server/main.lua:281 | leader/admin | text<=256 cleaned | OK |  |
| sunset_chat | me | command | sunset_chat/server/main.lua:428 | mute + now loaded character | text<=256 cleaned | FIXED | [SEC3] character required |
| sunset_chat | do | command | sunset_chat/server/main.lua:432 | mute + now loaded character | text<=256 cleaned | FIXED | [SEC3] character required |
| sunset_chat | s / shout | command | sunset_chat/server/main.lua:436,439 | mute + now loaded character | text<=256 cleaned | FIXED | [SEC3] character required |
| sunset_chat | w / whisper | command | sunset_chat/server/main.lua:443,446 | mute + now loaded character | text<=256 cleaned | FIXED | [SEC3] character required |
| sunset_chat | l / low | command | sunset_chat/server/main.lua:450,453 | mute + now loaded character | text<=256 cleaned | FIXED | [SEC3] character required |
| sunset_chat | b | command | sunset_chat/server/main.lua:457 | mute + now loaded character | text<=256 cleaned | FIXED | [SEC3] character required |
| sunset_chat | cc | command | sunset_chat/server/main.lua:541 | IsAdmin>=1 (console ok) | text<=256 cleaned | OK |  |
| sunset_chat | sunset:getChatChannels | callback | sunset_chat/server/main.lua:536 | session | n/a | OK |  |
| sunset_chat | chatIdentity staff prefix (internal) | internal | sunset_chat/server/main.lua:78 | now IsOnAdminDuty export + IsAdmin | - | FIXED | [SEC3] used client-writable state bag adminDuty -> forged [ADMIN] prefix |
| sunset_chat | RunServerCommand / RefreshCommandList | server-local exports | sunset_chat/server/main.lua:473 | server-local | - | OK |  |
| sunset_help | sunset:getHelp | callback | sunset_help/server/main.lua:185 | session (returns no-char error) | n/a | OK | fires quest progress event per call (12/s cap) - owner of quests should make help_opened idempotent |
| sunset_hud | sunset:server:hudExport | net event | sunset_hud/server/main.lua:37 | IsAdmin>=3 server | panel whitelist; x,y now finite and /v/<=10000 | FIXED | [SEC3] |
| sunset_death | sunset:death:recordAttacker | server-only event | sunset_death/server/main.lua:5 | not net-registered | tonumber | OK |  |
| sunset_death | sunset:server:playerDied | net event | sunset_death/server/main.lua:154 | RateLimit 3s; server health<=105 corroboration; war check | n/a | OK | SEC2 |
| sunset_death | sunset:death:enteredDowned | net event | sunset_death/server/main.lua:201 | RateLimit; serverSaysDead | n/a | OK |  |
| sunset_death | sunset:server:bleedoutExpired | net event | sunset_death/server/main.lua:208 | RateLimit; serverSaysDead | n/a | OK |  |
| sunset_death | sunset:server:requestRespawn | net event | sunset_death/server/main.lua:215 | RateLimit; serverSaysDead | n/a | OK |  |
| sunset_death | sunset:death:playerKilled | net event | sunset_death/server/main.lua:222 | victim must be online, within 500m, attacker recorded server-side | tonumber | OK |  |
| sunset_death | sunset:death:call112 | net event | sunset_death/server/main.lua:248 | requires server-created MurderWindow | n/a | OK |  |
| sunset_death | sunset:revivePlayer | callback | sunset_death/server/main.lua:330 | admin>=2 or faction revive perm; non-admin now within 25m + same bucket | tonumber | FIXED | [SEC3] map-wide revive by EMS |
| sunset_death | RevivePlayer/RespawnPlayer/StabilizePlayer/ClearDownedForCustody/IsPlayerDowned | server-local exports | sunset_death/server/main.lua:108-112 | server-local | tonumber, online check | OK |  |
| sunset_needs | sunset:server:needsTick | net event | sunset_needs/server/main.lua:33 | no-op | none | OK |  |
| sunset_world | sunset:world:canUseFactionLift | callback | sunset_world/server/access.lua:1 | character data only | factionId string<=64 | FIXED | [SEC3] trusted client-writable state bag sunsetFaction |
| sunset_world | sunset:server:glue | net event | sunset_world/server/glue_server.lua:15 | SEC2: rate limit, vehicle exists and within 40m | numbers finite, /offset/<=50 | OK | SEC2 re-read |
| sunset_world | sunset:server:unglue | net event | sunset_world/server/glue_server.lua:41 | own state only | n/a | OK |  |
| sunset_world | playerSpawned / sunset:server:characterSpawned / playerDied / playerDropped handlers | events | sunset_world/server/glue_server.lua:49-87 | self-state only | n/a | OK |  |
| sunset_cnn | sunset:cnn:getQueue | callback | sunset_cnn/server/main.lua:614 | IsStaff / admin/helper level (SEC2) | action whitelist, adId tonumber | OK |  |
| sunset_cnn | sunset:cnn:getHelpdeskAds | callback | sunset_cnn/server/main.lua:620 | IsStaff / admin/helper level (SEC2) | action whitelist, adId tonumber | OK |  |
| sunset_cnn | sunset:cnn:action | callback | sunset_cnn/server/main.lua:640 | IsStaff / admin/helper level (SEC2) | action whitelist, adId tonumber | FIXED | admute minutes/target/reason now validated downstream |
| sunset_cnn | ad | command | sunset_cnn/server/main.lua:678 | character + at CNN location + not muted + cooldown + atomic debit | text 5-140 chars cleaned; reason<=200 | OK |  |
| sunset_cnn | myad | command | sunset_cnn/server/main.lua:713 | character | text 5-140 chars cleaned; reason<=200 | OK |  |
| sunset_cnn | ads / adlist | command | sunset_cnn/server/main.lua:751-752 | IsStaff | text 5-140 chars cleaned; reason<=200 | OK |  |
| sunset_cnn | acceptad / aad | command | sunset_cnn/server/main.lua:771-772 | IsStaff | text 5-140 chars cleaned; reason<=200 | OK |  |
| sunset_cnn | deletead / dad / rejectad | command | sunset_cnn/server/main.lua:793-795 | IsStaff; reason clamped | text 5-140 chars cleaned; reason<=200 | FIXED | [SEC3] reason overflow VARCHAR after queue mutation / unbounded mute minutes |
| sunset_cnn | admute | command | sunset_cnn/server/main.lua:798 | IsStaff; target online; minutes finite<=43200 | text 5-140 chars cleaned; reason<=200 | FIXED | [SEC3] reason overflow VARCHAR after queue mutation / unbounded mute minutes |
| sunset_cnn | ApproveAd/RejectAd/AdMutePlayer/RunChatCommand/ExecutePlayerCommand | server-local exports | sunset_cnn/server/main.lua:197-874 | server-local; callers check staff | see above | FIXED | [SEC3] AdMutePlayer target/minutes validation |
| sunset_scoreboard | sunset:getScoreboard | callback | sunset_scoreboard/server/main.lua:101 | session; 2.5s cache | n/a | OK | shows clanTag from Player state (client-forgeable, cosmetic only; text rendered by NUI) - OPEN-cosmetic note |
| sunset_loadscreen | (none) | - | sunset_loadscreen | n/a | - | OK | 0 Lua entry points |

## Residual / OPEN observations (not row-level vulnerabilities)
- `config/server.cfg.template` sets `setr sv_stateBagStrictMode false`: clients can write their own state bags. In group 1 the three consumers (chat adminDuty, world sunsetFaction, scoreboard clanTag) were fixed except the cosmetic scoreboard clanTag; other groups should grep `Player(` `.state.` trust. Recommend `sv_stateBagStrictMode true` after verification.
- sunset_core SaveCharacter reads `Player(src).state.sunsetPropertyExit` (client-writable) to choose the persisted position: lets a client choose its last-saved location (low severity, no money/items).
- sunset_help getHelp -> `sunset:quest:progress` per call: quests owner should make idempotent.
- Test live: character create concurrency; /heal and /revive as EMS at >25m; /ban on higher admin; /setadmin by level 6 offline demote; saveAppearance at char select with forged charId; chat before login.
