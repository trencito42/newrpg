# Repository Cleanup Report

Scope: resources, sunset_ui web generations, root/docs junk, dev-vs-production gating, logging. No git commit/push was performed. Lua logic was edited only with small targeted edits.

Verification legend: VERIFIED (static proof) / FIXED / PARTIALLY VERIFIED / REQUIRES LIVE FIVEM TEST.

## 1. Resource inventory

| Resource | Class | Notes |
|---|---|---|
| ~60 `sunset_*` gameplay/framework resources, bob74_ipl, ox_lib, oxmysql, pma-voice, villa_island | ACTIVE | all `ensure`d in `config/server.cfg.template` |
| sunset_addon_vehicles (75 MB, 182 files) | ACTIVE | 6 addon models, `stream/` = yft/ytd/hi variants + tuning parts. Sized legitimately (largest file 6.1 MB); no duplicates. `tempesta.*` base files kept (cannot prove unused without binary inspection). REQUIRES LIVE FIVEM TEST for any trimming |
| sunset_luckywheel (21 MB) | ACTIVE | 20 MB is `audio/sfx/dlc_vinewood/*.awc` required by the wheel sounds |
| sunset_police_handling | ACTIVE | handling.meta only, ensured |
| sunset_appearance (1.2 MB) | ACTIVE | 2 besttorso JSON loaded by `client/torso_data.lua` |
| sunset_loadscreen | ACTIVE | trimmed (see 3) |
| sunset_testdriver, sunset_test_agent, sunset_devtools | DEV-ONLY | now `#@dev` + `sunset_dev` convar gated |
| sunset_admintools | DEV/STAFF-OPTIONAL | admin level 3 gated; moved to the `#@dev` group (was a commented ensure) |
| ox_inventory, ox_target | LEGACY, UNREFERENCED | gitignored local third-party copies, not ensured, ox_inventory has no web build. KEPT (untracked, not recoverable from git) |
| `resources/[framework]/rpg_ui` (46 MB) | DEAD | gitignored, no fxmanifest, only `web/node_modules`; no references anywhere. NOT deleted: the delete was blocked by the permission classifier because the folder is untracked (irrecoverable). Safe to `rm -rf "resources/[framework]"` manually |
| sunset_jobs/RETIRED.md | STALE FILENAME | content says "Active - started"; left untouched (jobs area belongs to another agent) |

Folders were NOT moved to `resources/[dev]/`: scripts/docs/tools use fixed paths and static checks scan `[sunset]`; gating is by cfg + convar instead.

## 2. Files removed

Tracked-file deletions (history preserved in git):

- sunset_ui legacy CSS (never loaded by index.html or module-loader, no other reference): `css/auth-forza.css, auth_loading.css, nui_loading.css, premium-auth.css, redesign.css, style.css, theme.css` (7)
- sunset_ui legacy JS (same proof): `js/auth_accounts.js, auth_email.js, auth-forza.js, auth_loading.js` (4). Login is `sunset_auth_ui`.
- `sunset_ui/web/modules/helpdesk/index.html` (not in ModuleLoader registry; exact duplicate of the `#help` block in `modules/panels/index.html`)
- `sunset_licenses/web/` (quiz.html/css/js; not in manifest, file header says unreferenced legacy)
- `scripts/extract-nui-modules.js` (one-shot migration tool; reads index.html comment markers that no longer exist)
- Root `premium_battlepass_missions.html`, `premium_faction_dashboard.html`, `premium_factions_list.html` (mockups; only mentioned in a string in the deleted script)
- `docs/gemini-code-1789085395835.html`, `docs/gemini-code-1789085610276.html` (unrelated "XODO RP" mockup, self-referencing only)
- `resources/logo_container_47.webp`, `resources/logo_hot_wheels.webp` (byte-identical to copies in sunset_missions/web/assets, which is what the code loads)
- Total: 7 + 4 + 1 + 3 files(quiz) + 1 + 3 + 2 + 2 = 23 code/doc files, plus assets below.

Manifest edits: `sunset_ui/fxmanifest.lua` (dropped 38 explicit css lines redundant with `web/css/*.css`), `sunset_loadscreen/fxmanifest.lua` (dropped logoblaze.svg), `sunset_slots/fxmanifest.lua` (dropped `html/*.json` glob matching nothing).

## 3. Unused assets removed (183 files, about 10.2 MB; about 2.2 MB of it was streamed to clients)

- `sunset_ui/web/assets/items/*.webp`: 147 files, 0.56 MB. Proof: item name not present as a token in any Lua/JS/JSON/SQL/HTML/CSS under resources/ or sql/ (icons are looked up as `assets/items/<icon>.webp`, `icon` values come from Lua item definitions); no dynamic prefix construction (`veh_*` hits are ptfx names). 87 icons kept, `LICENSE-CC0.txt`/`README.md` kept.
- `sunset_ui/web/assets/icons/` 7 files (0.25 MB), `assets/logo.webp`, `assets/blazemp.svg` (0.16 MB): no references repo-wide.
- `sunset_ui/web/assets/fonts/gfonts/` (16 woff2) + `gfonts.css` (0.45 MB): only referenced by themselves; the loadscreen has its own copy.
- `sunset_ui/web/assets/fonts/pricedown.otf` + its unused `@font-face` in fonts.css; root `Pricedown.otf` (no `font-family: Pricedown` use anywhere).
- `sunset_loadscreen/assets/logo.webp`, `logoblaze.svg` (0.15 MB): index.html/style.css/script.js use only `sunset.webp` + fonts.
- `docs/prototypes/assets/` 6 PNG/SVG (7.8 MB): not referenced by any prototype HTML or doc.

Assets reviewed and kept: item icons are all under 7 KB (none oversized); `bg_loading.webp` 208 KB, `sunset.webp` 204 KB (full-screen backgrounds, appropriate); gta-map.webp 92 KB. Font weights: Montserrat n400/600/700/900 + i800/i900 (latin + latin-ext), Chakra Petch 4 weights, Rajdhani 4 weights, Phosphor regular/bold/fill. CSS uses weights 500-900; further pruning needs a visual test (PARTIALLY VERIFIED, left as is).

## 4. UI inventory (`sunset_ui/web`)

| UI generation / file | Status | Evidence |
|---|---|---|
| index.html eager CSS (fonts, base, variables, _cef_overrides, components, animations, player_interaction, quick-hotbar, premium-factions, clans, fnc) + eager JS (i18n, module-loader, hotbar, player_interaction, fnc, app) | ACTIVE | `<link>/<script>` in index.html |
| 38 ModuleLoader modules (css/js/html in `module-loader.js` registry) | ACTIVE | all 178 registry/index paths exist; every key referenced by app.js; check-nui-modules passes |
| inventory-forza, trade-forza, dealership-forza, wardrobe-forza, store-forza, scoreboard-forza, fuel-pump-forza | ACTIVE | each is loaded by a registry entry |
| scoreboard.css (+scoreboard-forza.css), fuel_pump.css (+fuel-pump-forza.css), premium-hud/-chat/-menu/-wanted/-vehicle-menu/-properties/-factions, gameplay_glass, jobcenter, courier, studio | ACTIVE (layered) | both layers are loaded together by the same module; merging requires visual testing, so kept |
| auth-forza / auth_loading / premium-auth / nui_loading (css+js), redesign, style, theme | DEAD, REMOVED | not in index.html, not in any registry entry, no dynamic loader (`css/`/`js/` string construction absent), not referenced elsewhere |
| `characters/index.html` `#screen-auth` block, `panels.js` auth handlers, 8 `forward('auth*')` in nui_bridge.lua | LEGACY (kept) | fallback shown only if `sunset_auth` is not started; real login is `sunset_auth_ui` (own callbacks). Left because panels.js/nui_bridge are shared and the i18n keys are checked; candidate for a later removal together |
| sunset_licenses/web | DEAD, REMOVED | |
| sunset_loadscreen | ACTIVE | |
| sunset_auth_ui | ACTIVE | |
| sunset_devtools/web | DEV-ONLY | |

## 5. Dev vs production gating

- `config/server.cfg.template`: new block "DEV / PRODUCTION SPLIT". Lines prefixed `#@dev ` (testdriver, test_agent + its convars/token, devtools + `sunset_devtools_enabled true`, admintools, `testdriver_autorun 1`) are activated by `docker/fivem/entrypoint.sh` only if `SUNSET_DEV=1`; otherwise dropped. `setr sunset_dev` is rendered from `SUNSET_DEV` (default 0). Test-agent token/enable convars are no longer emitted in production at all.
- `docker-compose.yml` passes `SUNSET_DEV`; `.env.example` documents it (must stay 0 on production).
- Resource-level fail-safe: `sunset_dev` must be 1 in addition to the existing enable convars (`sunset_test_agent_enabled`, `sunset_devtools_enabled`); `sunset_testdriver` refuses to load at all when `sunset_dev ~= 1`.
- Ungated debug/test commands now require `sunset_dev 1`: `/testvault`, `/robdoor`, `/testradaralert`, `/exhaustdebug`, `/turfdebug`, `/fishdebug`, `/casinoprobe`, `/casinoscan`, `/casinoanim`, `/casinoprops`. Admin-gated debug commands (`/robdebug`, `/ecudebug`, `/fishtournamentdebug`, `/clothinglab` etc.) kept.
- AGENTS.md updated: the `testdriver ... 56 checks, 0 failed` health check is valid only when `SUNSET_DEV=1` (dev/staging). Note: the previous template already had testdriver commented out, so the check could not pass on a template-generated production cfg. The deploy.sh flow itself is unchanged.

## 6. Logging

- Removed: 2 raw debug prints in sunset_blackjack/server.lua, the "TODO: DONT FORGET TO REMOVE THIS" commented forced-bet block, the per-frame `Wait(0)` thread polling `GlobalState.debug` (now convar `sv_sunset_blackjack_debug`), the `billy-hold-v5` version print in fishingshop, commented console.log in slots.
- Config-gated: sunset_sessions per-transition trace now needs `sv_sunset_sessions_debug 1`.
- Kept intentionally: startup "online" banners, error/failed/CRITICAL prints, anticheat TICK + SECURITY prints, admin audit prints, spawn timeout diagnostics, loadscreen stall/summary logs (already throttled via `sunset_boot_verbose`). Already convar-gated: drugs, clothing, interactions, jobs, hunting, diving, robbery (`SunsetRobbery.Debug`), boot debug. sunset_jobs trucker/hireJob prints left to the jobs owner.
- Marker search: TODO/FIXME/HACK/XXX: 1 hit (fixed). "legacy/backup/deprecated": ~216 hits, almost all gameplay `/backup` or migration notes; reviewed intentional (fishingshop legacy sell, businesses legacy location migration).

## 7. Tooling

- New `scripts/check-manifests.js` (Linux replacement for audit-static.ps1 manifest part): checks ui_page, loadscreen, client/server/shared scripts incl. `@res/path`, files{} globs, data_file, and cfg `ensure` targets. Result: 73 manifests, 882 references, 0 missing, 3 warnings (non-ensured ox_inventory build files).
- check-lua-syntax: 414 files OK. check-lua-forward-refs: 4 issues, all in third-party ox_lib/ox_inventory (0 in sunset). check-nui-bridge: all 205 posted callbacks registered. check-nui-modules, check-locales: pass. check-db-writes: 2 cross-domain violations (sunset_vehicles/character_inventory), pre-existing, not touched.
- Duplicate-command audit from audit-static.ps1 was not re-implemented.

## 8. Remaining / needs live test

- REQUIRES LIVE FIVEM TEST: NUI load of all modules after CSS/JS/asset removal (static path checks pass), loadscreen render, entrypoint `#@dev` handling inside the real container (verified in bash only; entrypoint uses the same `${//}` syntax as before), dev-command guards.
- Manual: delete `resources/[framework]` (46 MB untracked node_modules) and decide on gitignored ox_inventory/ox_target.
