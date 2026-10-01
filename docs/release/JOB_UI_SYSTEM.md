# Job UI System (JobHud + design tokens)

Status: static checks pass; nothing visual was verified (no FiveM client available). See the live checklist at the end.

## 1. Inventory: what the player saw before

| Job | Start / instructions | Objective / progress | Result / failure | Notes |
|---|---|---|---|---|
| Courier | `courierShow` panel (own css/js, bottom-centre) + 3D text + checkpoint | message, counter, progress bar, keycap | notify + panel state | Reference quality, kept as is |
| Trucker | notify + native help text + `sunset:ui:jobObjective` (HUD task panel, bottom-left above minimap) | objective text + coarse % | notify | Laptop (`trucker-laptop`) is a menu, not a HUD |
| Garbage | notify + `jobObjective` + 3D text | "Bin N - pick up (E)" + % | notify | no remaining count, distance or earnings |
| Fisherman | notify + `jobObjective` + `fishingShow` minigame panel | go-to / cast / reel text | notify | minigame panel kept (purpose built) |
| Diver | `jobShiftShow` | counter, O2 in text | native text on contract complete | **`#job-shift-panel` DOM never existed, so nothing rendered** |
| Hunter | `jobShiftShow` + `hunterCompass*` + native help | counter, stage text | notify | same dead panel; compass kept |
| Mechanic | notify + `jobObjective` | text + % | notify | |
| Taxi | `taxiMeter*` (hud_core) + phone UI | fare meter | - | purpose-built meter, not migrated |
| Racing | `racingHud/Countdown/Go/Finished` | - | - | purpose built, not migrated |
| Fishing tournament | `fishingTournamentHud*`, results modal | - | results modal | purpose built, not migrated |
| Missions | own NUI in `sunset_missions/web` + native help | - | - | separate resource, not migrated |
| Quests | `questLogShow/Hide` panel | - | - | log panel, not an objective HUD |
| Workplaces | 3D text `[E] ...` + notify | - | - | world prompts only |

## 2. Design tokens (`web/css/tokens.css`, loaded after `variables.css`)

`variables.css` still owns palette, spacing (`--space-*`), radius (`--radius-*`), easing and durations. `tokens.css` adds HUD-level tokens; it contains only custom properties (no rules).

| Group | Tokens |
|---|---|
| z-index | `--z-hud 45`, `--z-hud-job 44`, `--z-hud-overlay 47`, `--z-panel 100`, `--z-modal 200`, `--z-toast 9999`, `--z-transition` |
| Safe area | `--safe-x clamp(16px,2vw,56px)`, `--safe-top clamp(76px,10vh,150px)`, `--safe-bottom clamp(56px,9vh,130px)` |
| Type scale | `--fs-xs/sm/md/lg/key` = `clamp(min, min(vw, vh), max)` so 21:9 does not balloon; `--tracking-caps` |
| Job HUD | `--jobhud-width clamp(300px, min(30vw,62vh), 560px)`, `--jobhud-bg/border/accent/warn/danger/success/track/pad/gap` |
| Elevation | `--shadow-hud`, `--shadow-key`, `--text-shadow-hud` (all small) |
| Motion | `--hud-enter 200ms`, `--hud-bar 300ms` (transform/opacity only) |

Adopted so far: `job-hud.css` (everything) and `courier.css` (z-index only). Nothing else was restyled.

## 3. Component API

Files: `web/css/job-hud.css`, `web/js/job-hud.js` (module `job_hud` in `module-loader.js`, no HTML fragment; the card is built lazily with `createElement`, all text via `textContent`). Actions are routed in `app.js` (`ACTION_MODULE_MAP` + dispatcher). A `jobHudClear` / `jobShiftHide` for a module that was never loaded is dropped without loading it.

Lua (sunset_ui exports, `client/main.lua`):

- `exports.sunset_ui:JobHud(data)` sends action `jobHud`. Identical consecutive payloads are dropped.
- `exports.sunset_ui:JobHudResult({kind='success'|'fail'|'cancel', title?, message?, earnings?, ttl?})` sends `jobHudResult`; auto-hides after `ttl` (1.5-15 s, default 5 s).
- `exports.sunset_ui:JobHudClear(force?)` sends `jobHudClear`. A routine clear does not wipe a result card that is still showing; `force=true` does.

`data`: `title`, `objective` (may contain `{key}` which renders a keycap using `key`), `tone` (`info|warn|danger|success`), `progress` (`{current,total}` or `{pct}` or a number), `distance` (metres), `earnings`, `timer` (`{seconds, dir='down'|'up'|nil}`; a 1 s interval exists only while a ticking timer is visible), `timerLabel`, `vehicle`, `keyHints` (`[{key,label}]`, max 4; this is the `[E] Action` format), `patch=true` (merge into the current card; ignored when nothing is shown).

Conceptual components inside the one card: JobHud (card), MissionObjective (objective line), ProgressIndicator (bar), TaskCounter (`current/total` chip), InteractionHint (keycap + label row), MissionComplete/MissionFailed (result card, `kind`).

Client helper (`sunset_jobs/client/core.lua`, `Sunset.JobClient`): `hud(data)` (auto-adds the running `earned` total), `hudResult`, `hudClear(force)`, `hudDistance(coords)` (throttled 750 ms, 5 m steps), `addEarned(n)`, plus `showObjective/hideObjective` kept as back-compat wrappers. Clear paths: `cleanup()` -> `clearWorkHud()`, `sessionEnded` (also shows the success/fail/cancel result), `forceClearHud`, `/quitjob`, `onResourceStop` (forced). Server-side death and disconnect end the session, which raises `sessionEnded`. Hunter and diver clear in their own `sessionEnded` and `onResourceStop` handlers.

Locale: NUI chrome labels are `ui.jobhud.*` (EN+RO, i18n.js). Job text is `jobs.hud.*` in `sunset_core/shared/locales/{en,ro}.lua` (EN+RO, ~40 keys). Layout uses ellipsis (title, hint labels, meta values), 3-line clamp plus `overflow-wrap:anywhere` (objective, result), and flex wrap (meta, hints), so ~40% longer Romanian does not clip. `check-locales.js` reports 0 problems.

## 4. Migration

Migrated: Garbage (remaining count via `current/total`, distance, earnings, `[E]` hints), Mechanic (call incoming/en-route/done, hints, earnings), Fisherman (go/cast/reel states, hints), Hunter (counter, stage, hints; this fixes the dead panel), Diver (counter, O2 timer, tone warns at 30 s, danger at 0; fixes the dead panel), Trucker (objective via `JC.hud`, progress, earnings; native help text and notifies untouched), and every generic `sessionStarted/Ended` flow (shift started text, success/fail/cancel result card). Legacy `jobShiftShow/Hide` is remapped to JobHud so any stray sender still renders.

Intentionally not migrated:
- Courier: has its own state machine (route/prompt/working/blocked) and tuned visuals; migrating would duplicate rather than reduce code. Only a z-index token swap.
- Taxi meter, racing HUD, fishing tournament HUD/results, fishing minigame panel, hunter compass, quests log, sunset_missions NUI, workplace 3D prompts, license tests: purpose-built or non-objective UIs.
- Dealership/licence tasks still use `jobObjective` (HUD task panel).
- Existing English-only `JC.notify` strings in these jobs are the localization agent's area and were not touched, except where replaced by the HUD.

Behaviour changes to be aware of: the HUD objective for garbage/trucker/mechanic/fisherman moved from the bottom-left task panel to a top-centre card; the `COMPLETED` notify was replaced by the result card (FAILED still also notifies).

## 5. Resolution notes

Placement: top-centre, `top: var(--safe-top)` (76-150 px) so it sits below the wanted banner and clear of the minimap/location block (bottom-left), chat (left), speedometer (bottom-right), and the hotbar (bottom-centre). Width is `min(30vw, 62vh)` clamped 300-560 px; the vh term stops 3440x1440 from widening. Font sizes use `min(vw, vh)` clamps. At 1280x720: width about 384 px, fonts at floor (11-14 px). At 1920x1080: about 576 -> 560 px max. 2560x1440 and 3440x1440: width 560 px, fonts at cap.

Performance: no blur, flat 8 px shadow, enter animation is opacity/transform once per show, bar uses `scaleX`. Hidden = `display:none`, no timers or rAF.

## 6. Verification

VERIFIED (static): `node --check` on job-hud.js/app.js/module-loader.js/i18n.js; check-nui-bridge (205 callbacks OK; no new `post()` was added); check-nui-modules; check-locales (0 problems); check-locale-usage (OK); check-lua-syntax (419/419); check-manifests (0 missing; `web/css/*.css`, `web/js/*.js` globs already cover the new files; `tokens.css` linked in index.html, `job-hud.*` registered in the module loader). A stub-DOM smoke test of `job-hud.js` (show, patch, result, hide, late patch) ran without errors.
FIXED: hunter and diver HUD never rendered (missing DOM for `jobShiftShow`).
REQUIRES LIVE FIVEM TEST: everything visual and all Lua runtime behaviour (exports resolve, dedupe, throttled distance, result card timing, no stuck card).
`check-lua-forward-refs` reports 4 pre-existing issues in `ox_lib` only.

## 7. Live visual-test checklist

1. 1280x720, 1920x1080, 2560x1440, 3440x1440: card does not overlap the minimap, chat, speedometer, hotbar, or wanted stars (get wanted while on a job).
2. Switch language to RO: every job's title/objective/hints wrap or ellipsise, no overflow.
3. Garbage: start shift, card shows `0/8`, distance counting down, `[E] Pick up trash`; carrying shows `[E] Dump the bag`; earnings grow; truck full shows unload text; unload shows success card with total.
4. Mechanic, Fisherman (go -> cast -> reel), Hunter (no contract, zone, animal near/down, `[B]` hint), Diver (no contract, O2 timer turns amber then red, depleted text), Trucker (pickup, deliver, park-in-bay, return).
5. Cancel (`/stopwork`, `/quitjob`), die mid-job, get jailed, `restart sunset_jobs`, `restart sunset_ui`, disconnect/reconnect: the card must never stay on screen; a failed shift shows the red card for about 7 s.
6. Start a job, hide NUI/ESC menus: no console errors, no CPU use while the card is hidden (DevTools Performance: no timers/rAF).
7. Courier and Trucker laptop unchanged visually.
