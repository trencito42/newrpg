# Resource matrix

Production list is `config/server.cfg.template`. Docker generates `server.cfg` from that template. `docker/fivem/default-server.cfg` is the stock sample and is not what Coolify starts.

| Resource | Class | Started | Notes |
| --- | --- | --- | --- |
| ox_lib, oxmysql, pma-voice | CORE | yes | Before gameplay resources. |
| sunset_core, sunset_sessions, sunset_ui, sunset_auth, sunset_auth_ui, sunset_characters, sunset_spawn, sunset_player | CORE | yes | Auth bucket and spawn permit live in core. |
| sunset_inventory, sunset_economy | ECONOMY | yes | Inventory is sunset_inventory, not ox_inventory. |
| sunset_quests, sunset_intro, sunset_help | GAMEPLAY | yes | Intro after quests. |
| sunset_vehicles, sunset_addon_vehicles, showcasecars, showcasecars2, pitd_tol_car_pack_a, sunset_vehicle_dynamics, sunset_tuning, sunset_dealership, sunset_impound | VEHICLE | yes | Thumbnail generator is not started. |
| sunset_phone, sunset_shop, sunset_hud, sunset_menu, sunset_scoreboard, sunset_chat | UI | yes | |
| sunset_factions, sunset_clans, sunset_turfs, sunset_dispatch, sunset_cnn | FACTION | yes | Factions start before characters. They must not call character exports at resource start. |
| sunset_jobs, sunset_taxi, sunset_fire, sunset_licenses | JOB | yes | |
| sunset_robbery, sunset_carjack, sunset_drugs, sunset_hacking, sunset_crafting | CRIMINAL | yes | |
| sunset_properties, sunset_businesses | ECONOMY | yes | |
| sunset_casino, sunset_blackjack, sunset_slots, sunset_roulette, sunset_luckywheel | GAMEPLAY | yes | |
| sunset_racing, sunset_events, sunset_missions, sunset_fishing_tournament, sunset_marriage, sunset_pass | GAMEPLAY | yes | Ensured. Content completeness was not live-tested. |
| sunset_admin, sunset_anticheat, sunset_panel_bridge, sunset_profile_media, screenshot-basic | ADMIN | yes | |
| villa_island, bob74_ipl | WORLD | yes | |
| sunset_needs | GAMEPLAY | no | Commented. Survival drains in core config are unused while this stays off. |
| ox_inventory, ox_target | LEGACY | no | ox_inventory is explicitly waiting on a bridge. Gameplay uses sunset_inventory. |
| sunset_police_handling | VEHICLE | no | Present on disk, not ensured. Not a dependency of the template. |
| sunset_testdriver, sunset_test_agent, sunset_devtools, sunset_admintools, racket_vehicle_thumbs | DEV | no | `#@dev` lines. Thumbnail files are produced offline and consumed by `racket` NUI paths, not by running the generator in production. |

No ensured resource was missing its `fxmanifest.lua`.
