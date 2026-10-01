# Permission Matrix Audit (reconciles /PERMISSION_MATRIX.md)

Corrections to the root matrix: `setleader`/`removeleader` need admin 4 (sunset_factions/server/leaders.lua:60), not 3; `setadmin` owner level via `sunset_setowner` console only.

| System | Action | Required | Enforced |
|---|---|---|---|
| Core | all callbacks | rate 30/s total, 12/s per name | sunset_core/server/main.lua triggerCallback |
| Core | AddMoney/RemoveMoney/Move/Transfer | finite int 1..2e9, atomic SQL guard | sunset_core/server/player.lua SanitizeMoneyAmount |
| Admin | commands | per-command level via requirePerm | sunset_admin/server/commands.lua |
| Admin | submitFncName | pending forced FNC | commands.lua FncPending |
| Admin | setcp/delcp/gotocp/gotoloc/speed/saveGizmo events | requirePerm | commands.lua |
| Admin | adminRepairDatabase (vehicles) | admin 3 | sunset_vehicles/server/main.lua |
| Admintools/devtools/test agent | all | admin 3 / kill switch convar + admin 4-5 | respective server files |
| Casino/blackjack/roulette/slots/wheel | bets, payouts | proximity, server chips, validated bets | respective server files |
| Economy | shop, ATM, bank transfer | proximity, price from config, rate limit | sunset_economy/server/main.lua |
| Economy | lottery | char loaded, DB tx | lottery.lua |
| Inventory | trade/drop/container | proximity, ownership, locks | sunset_inventory/server |
| Vehicles | spawn/store/park/fuel/keys | ownership by char id, atomic claim | sunset_vehicles/server/main.lua |
| Vehicles | givecar | admin 3 | main.lua runGiveCar |
| Dealership | purchase | proximity, DB transaction | sunset_dealership/server/main.lua |
| Impound | confiscate | faction perm impound + officer within 40m | sunset_impound/server/main.lua |
| Impound | recover | owner, at lot, atomic claim | same |
| Properties | buy/rent/enter | proximity, tx, cuff/downed checks | sunset_properties/server/main.lua |
| Factions | invite/promote/warn/kick | faction perm or leader, rank ordering | sunset_factions/server |
| Factions | illegal sell | member, on duty, perm, within 6m of stash | sunset_factions/server/main.lua |
| Police | ticket/arrest/MDC | faction perm, distance | sunset_factions/server/police.lua |
| EMS | heal/revive/stabilize | faction perm, distance, downed | ems.lua / main.lua |
| Clans | create | one in-flight, coins spent | sunset_clans/server/main.lua |
| Clans | settings/dissolve/rank labels | leader | handleClanManage |
| Clans | invite/kick/warn | officer+ | handleClanManage |
| Turfs | admin cmds | admin 2 | sunset_turfs/server/main.lua checkAdmin |
| Turfs | warRespawn | participant + server health/downed | same |
| Robbery | start/hack/loot | session, proximity, cooldown | sunset_robbery/server |
| Robbery | robdebug | Debug flag + admin | robbery main |
| Drugs | harvest/process/sell | proximity, timers, cooldown | sunset_drugs/server/main.lua |
| Crafting | craft | station proximity, faction, duty, tx | sunset_crafting/server/main.lua |
| Documents/Licenses | exam/grant | session state, instructor duty; admin cmds admin | sunset_licenses/server |
| Phone | send/avatar/contact | char; throttles; avatar format | sunset_phone/server/main.lua |
| CNN | submit/approve/queue | char / staff / staff | sunset_cnn/server/main.lua |
| Marriage | propose/respond | proximity, fee | sunset_marriage/server/main.lua |
| Death | died/respawn events | server ped health or Downed + rate limit | sunset_death/server/main.lua |
| Skins | grantBattlepassSkin | server-only event | sunset_skins/server/main.lua |
| Anticheat | markLegitLocal | whitelist 2 types | sunset_anticheat/server/ledger.lua |
| Sessions | resetRoutingBucket | no live session | sunset_sessions/server/main.lua |
| Dispatch | 112 | char + 8s throttle | sunset_dispatch/server/main.lua |
| Chat | send / runCommand | mute, rate 350/400ms, router level check | sunset_chat/server |
