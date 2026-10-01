# NUI runtime / startup / login pipeline report — 2026-10-01

Classification legend: VERIFIED (static proof) / FIXED (changed, static-checked) / PARTIALLY VERIFIED / REQUIRES LIVE FIVEM TEST.
Static checks after all edits: `check-lua-syntax` 414/414 OK; `check-lua-forward-refs` 0 in `[sunset]` (4 pre-existing in ox_*); `check-nui-bridge` OK (205 callbacks); `check-nui-modules` OK; `node --check` OK on every edited JS.

## A. NUI runtime cost

| # | Finding | Location | Status |
|---|---------|----------|--------|
| 1 | Permanent 60 Hz rAF "frame watchdog" in the main NUI | `sunset_ui/web/js/app.js` (~1074) | FIXED -> 500 ms timer-drift check |
| 2 | Same in auth NUI | `sunset_auth_ui/web/auth.js:19-35` | FIXED |
| 3 | Same in loadscreen | `sunset_loadscreen/script.js:~60` | Left (page destroyed at handoff); REQUIRES LIVE TEST that handoff really shuts it |
| 4 | Speedometer canvas redraw loop ran forever when not in a vehicle | `forza_speedometer.js` frame()/setActive | FIXED (loop starts/stops with `active`) |
| 5 | ATM clock interval never cleared (1 Hz forever after first open) | `atm.js` startClock/close/open | FIXED |
| 6 | Phone clock interval never cleared | `phone.js` show/hide | FIXED |
| 7 | Loadscreen: thousands of `console.log` (per file/init) | `sunset_loadscreen/script.js` btrace | FIXED (gated by `localStorage.sunset_boot_verbose`); stall/summary logs kept |
| 8 | Battlepass per-button listeners | `battlepass.js` renderBattlepass | FIXED (delegation) |
| 9 | Other intervals (helpdesk, auth_loading, license_quiz, mdc, fishing_tournament, hud date 60 s) | various | VERIFIED cleared on hide / negligible |
| 10 | ResizeObserver/MutationObserver/IntersectionObserver | all NUI JS | VERIFIED none exist |
| 11 | Duplicate window/document listeners added per open | all `addEventListener` on window/document (~79) | VERIFIED all bound once (init guards: license_quiz `_panel`, turf_map `init()` once, trade `_escBound`, atm `_initialized`) |
| 12 | `innerHTML +=` in loops | battlepass.js:67 (1x, not in loop), racing.js 3x (tiny HUD) | VERIFIED acceptable; chat bounded by `maxMessages()` |
| 13 | Inline SVG duplication | max 23 `<svg>` in any module (phone) | VERIFIED no hundreds |
| 14 | `backdrop-filter` | 123 declarations in sunset_ui css/html + tuning | VERIFIED neutralised globally (`_cef_overrides.css` `!important`, last sheet; tuning inline override) |
| 15 | `filter: blur()` on elements | `base.css:86` (80 px, `.ambient__orbs` — no longer in index.html, dead), `style.css:117` (hidden state), `atm.css:205` (1 px, tiny) | VERIFIED no live heavy blur |
| 16 | `will-change` | 4 (world-tooltip, spawn, player_interaction, turf_map) | VERIFIED, not widespread |
| 17 | `animation: ... infinite` | 43 declarations; all are state-scoped (pumping, wanted, radar lock, countdown...) or inside `.hidden`/`display:none` panels (animations don't run at display:none) | PARTIALLY VERIFIED (only panels hidden via opacity/visibility would still animate; none found) |
| 18 | Payload size instrumentation, `/nuistats`, ping/pong | `sunset_ui/client/main.lua`, `server/main.lua`, `app.js` | FIXED/new (debug-gated); REQUIRES LIVE TEST |
| 19 | `sunset:server:nuiError` shadowed `source`, unthrottled | `sunset_ui/server/main.lua` | FIXED |

### Focus audit (outside sunset_ui)
Raw `SetNuiFocus` callers found: auth_ui(3), devtools(10), jobs/trucker_npc(4), missions(8), pass(2), robbery(1), slots(3), tuning(5), turfs(3).
- FIXED (routed through `SetFocus` + owner + resource-stop + forceCloseAll release): missions, pass, turfs, tuning, slots (stop only; no safe force-close because chips payout), robbery, auth_ui.
- NOT changed: `sunset_jobs/client/trucker_npc.lua` (jobs owned by another agent; it already calls `SetFocus` first), `sunset_devtools` (disabled in cfg).
- `sunset_death` released with owner `legacy`, which the owner guard would block for non-legacy owners -> now `force`. `sunset_ui` also handles `sunset:ui:forceCloseAll` itself.
- Key swallowing (30-35, 59, 60): offenders only in radar car lock (`sunset_factions/police.lua:403`, no NUI focus), tuning dyno (focus released during dyno), admin/devtools gizmos (no text input). Appearance editor uses keepInput but its NUI has no text inputs. Chat uses exclusive focus and explicitly avoids DisableAllControlActions. VERIFIED no offender with keepInput + text input.

### Resolution overflow risks (static only; REQUIRES LIVE TEST at 1280x720, 1920x1080, 2560x1440, 3440x1440)
- `mdc_tablet.css:31` fixed 1240x780 clamped by `max-width:95vw/max-height:94vh`: at 1280x720 it shrinks to ~677 px tall; inner layout designed for 780 may need inner scroll.
- `turf_map.css:190-211` 2048x2048 canvas layers: intentional pan/zoom, fine on all.
- Ultrawide 3440x1440: no panel found with `vw`-based widths larger than viewport; HUD anchors at screen edges (check corners stay in safe zone).

## B. Startup / dependencies
- Script `mf.js` compared every `fxmanifest.lua` dependency vs `exports.<res>` usage. Many resources call `exports.sunset_ui`/`sunset_admin` without declaring them. NOT mass-declared on purpose: a declared dependency makes `restart sunset_ui` cascade-stop every dependent. Calls are guarded by `GetResourceState` convention (AGENTS.md); PARTIALLY VERIFIED (not every call site audited).
- FIXED: server.cfg.template ensure order -> topological (21 positions changed, 0 cycles). Previously 6 resources were listed before their declared deps (chat, cnn, crafting, factions, admin, tuning); FiveM auto-started deps so runtime was unchanged, template now matches.
- FIXED: `sunset_skins`, `sunset_emotes` (empty `dependencies {}`), `sunset_blackjack` now declare their deps.
- FIXED: removed 6 literal `files` entries in `sunset_ui/fxmanifest.lua` pointing to deleted CSS (style, auth_loading, nui_loading, theme, redesign, premium-auth). `index.html` refs all exist (19).
- `sunset_auth_ui` intentionally has no dependency on sunset_auth (documented cycle avoidance). No `provide`s exist. `@sunset_core/...` shared_script refs all exist.
- Not in cfg (by design): admintools, devtools, test_agent, testdriver.
- Locale: `playerReady` now pushes the account locale to sunset_ui + auth_ui NUI (previously only on change/resource start).

## C. Login / spawn pipeline (connect -> DB -> account -> character -> spawn)
| Finding | Fix | Status |
|---|---|---|
| `completeAuthentication` awaits SQL before setting `session.authenticated`; a double submit ran two interleaved auths | per-source single-flight + pcall in `sunset_core/server/main.lua` | FIXED |
| Client login/register/pick had no single-flight; `completeAuthentication` could run twice (double transition, double `authenticationComplete`, double character flow) | `authRequestBusy` / `authCompleting` in `sunset_auth/client/main.lua`; blocked login shows "already signed in" instead of silent | FIXED |
| `authSetEmail` path never marked player authenticated | `sunset_auth/server/main.lua` | FIXED |
| `enterGame` not idempotent; on load failure it fell through to creating a new character (phantom char / "limit" error) | returns loaded char; load failure returns `auth.session_not_ready` | FIXED |
| Client `autoEnterGame` bounced an authenticated player to a login form that can no longer succeed | 3 retries (1.5 s) with trace; then old fallback | FIXED |
| `sunset:client:spawnCharacter` had no single-flight; Lua error left ped frozen, screen black, `spawning=true` | guard + pcall recovery (unfreeze, fade in, enterGameplay) in `sunset_spawn/client/main.lua`; stale ped handle re-fetched before unfreeze | FIXED |
| Silent fallback to LSIA default | server `resolveAutoSpawn` logs every skipped tier + reason (`[SPAWN] ... DEFAULT spawn`); client invalid-coords fallback logged | FIXED (previous: `default_fallback`/`default` were only in boot trace) |
| Stale per-player state on drop | core (`Players`, sessions, rate tables), auth (LoginFails, Authenticated, PendingEmail), new sunset_ui/core tables cleaned in `playerDropped`; all 36 server resources that assign `[src]` tables have a drop handler | PARTIALLY VERIFIED (cleanup of every individual table not audited; jobs/security owned by others) |
| Character switch | not possible in-session (`loadCharacterForPlayer` rejects when loaded) | VERIFIED |
| HUD / world state ordering | not traced in depth | REQUIRES LIVE FIVEM TEST |

## SPECIFIC LIVE-TEST CHECKLIST
1. Fresh connect, no saved token: loadscreen -> login form shows with cursor; type A/D/W/S in username field (must type, not move).
2. Double-click Login rapidly: exactly one transition, one spawn, no red error flash; server console shows at most one "ignored" warn.
3. Saved-token quick login, then immediately click the saved account tile: single spawn.
4. New account: no phantom second character; MaxCharacters=1 intact; after `enterGame` retry (kill callback via `restart sunset_characters`? or throttle) no new character row.
5. Character with no home/faction: server console prints `[SPAWN] ... DEFAULT spawn ... reasons`; with home property: spawns at house, no log.
6. Force a Lua error in spawn (temporarily): player is released, not frozen.
7. Open each: missions offer, battlepass (`pass`), turf map (`/turfs`), tuning shop, slots, robbery hack. Press Esc/close; get killed with each open (use `/die` or admin): cursor must release. `restart sunset_missions` / `sunset_pass` / `sunset_tuning` / `sunset_slots` with panel open: cursor must release.
8. `setr sv_sunset_nuidebug 1`, play 5 min, run `/nuistats` as admin: table prints; no `[NUI-PAYLOAD CRITICAL]`. Note any WARN actions (candidates for payload trimming).
9. Leave ATM and phone closed 2 min; DevTools (F12 NUI) Performance: no 1 s/30 s timers firing; idle on foot: no rAF callbacks from `forza_speedometer`.
10. Enter/exit a vehicle repeatedly: speedometer reappears and animates every time (loop restart).
11. Resolutions 1280x720, 1920x1080, 2560x1440, 3440x1440 (+ UI scale 100/125%): MDC tablet scroll, phone, inventory, ATM, HUD corners.
12. `restart sunset_ui` mid-game and `/fixnui`: login/HUD recover; no stuck cursor.
13. Server boot log: `grep 'Error parsing script'` empty; startup order matches template; no "Could not find file" for sunset_ui.
14. Switch account language to RO then login: first character/spawn screen already in RO.
