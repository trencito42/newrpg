# IMPL_NUI — NUI performance / resolution / focus pass

## Rendering status (plain)
NO real browser rendering was done. Playwright chromium + headless shell are cached in ~/.cache/ms-playwright but cannot start (missing libatk, libgbm, libxkbcommon, libasound ...; installing needs root/downloads). claude-in-chrome has no connected browser. All resolution work below is static CSS review. No screenshots saved. 1280x720 / 1920x1080 / 2560x1440 / 3440x1440 remain REQUIRES LIVE TEST.

## Changes
- sunset_ui/web/css/_cef_overrides.css (last sheet): global `animation-play-state: paused` for `.hidden`, `[hidden]`, `.is-hidden` subtrees (hidden panels no longer tick infinite animations; resumes on show). Notifications: `overflow-wrap:anywhere`, stack max-height + lower top offset at <=800px height so long RO toasts wrap and never run off-screen.
- MDC tablet (fixed 1240x780): now `transform: scale(var(--mdc-scale))`, scale computed in `mdc_tablet.js` `fitScale()` (min(1.15, 0.96*vw/1240, 0.94*vh/780), on open + window resize; listener bound once in init). Whole tablet visible at 720p instead of being squeezed to ~677px high. Dialog/112 overlays are siblings of the tablet, so unaffected by the transform.
- phone.css: `@media (max-height:700px)` zoom 0.88 + tighter offsets.
- Removed dead `forward()` entries in sunset_ui/client/nui_bridge.lua: authPickAccount, authRemoveAccount, authSetEmail, authSetQuickLogin, authSavePortrait, authReady (only sunset_auth_ui posts these, to its own resource), inventoryTradeAccept, clanBrowse, factionBrowse, appearancePreview (no poster anywhere in repo; no dynamic post construction found). Unlisted-caller count 41 -> 31.
- sunset_clans/server/main.lua `sunset:clanDirectory`: result capped to top 150 clans (was unbounded).
- i18n.generated.js: shortened the 159-char RO devtools string.

## Kept on purpose (with proof)
- Legacy `#screen-auth` (modules/characters) + `authLogin`/`authRegister` forwards: still reachable via sunset_characters/client/main.lua:215 `exports.sunset_ui:Show('auth')` when sunset_auth is not started. Documented fallback; not removed.
- Remaining no-caller callbacks are posted by other NUI pages (tuning*, wardrobe*, pass*, loot*, fence*, hack*, jobCenterClose, ticketReceiveClose, playSound, close). Left: loadingTimeout, modalSuperseded, mdcBookingGps, tuningLeaderboard, tuningTestFlame (no poster found, but they have live Lua handlers owned by other agents/tuning; flag for owners).

## Verified, no change
- setInterval/rAF: every interval has a clear or is by design (500 ms watchdog, hud date 60 s); rAF uses are one-shot or self-terminating. No Resize/Mutation observers. `innerHTML +=` only in tiny racing HUD/battlepass.
- Properties list already server-paginated (LIMIT/OFFSET). Factions directory is a fixed small set; faction roster is per-faction (not paginated; flagged). Debug payload instrumentation is gated by `sv_sunset_nuidebug`.
- Asset duplicates by md5: only cross-resource copies (loadscreen/auth_ui/sunset_ui background + montserrat fonts; separate NUI origins, cannot share) and same variable-font file under several weight names inside sunset_ui. Not removed (needs @font-face repoint, small gain).
- Fixed-px panels >=450px reviewed (clanwar armory 800x500, vehicle menu, wheel 600x600*0.8, trucker laptop 540, turf map 2048 pan canvas): all clamp via min()/vh or fit 720p. Main panels already use min(Npx, calc(100vh - X)).

## Static per-resolution expectations
- 1280x720: MDC scaled ~0.66; phone zoomed; notifications bounded; others clamped via min()/vh.
- 1920x1080 / 2560x1440 / 3440x1440: panels keep native size (centered or edge-anchored); MDC upscaled to max 1.15; HUD corner anchoring at ultrawide unverified.

## RO overflow (22 flagged by check-locale-usage)
20 are Lua toasts/chat suggestions (wrap now); 1 NUI businesses/inventory descriptions are wrapping text blocks; devtools one shortened.

## Focus/Esc
Not re-audited beyond NUI_STARTUP_LOGIN_REPORT; MDC close/Esc path unchanged (mdc_tablet.js Esc handler). Live test needed.

## Check results
check-nui-bridge OK (205), check-nui-modules OK, check-manifests OK, node --check OK. check-locales: no output matched. check-locale-usage and check-lua-syntax FAIL on sunset_slots/server.lua (concurrent casino-agent edit: missing key slots.message.you_are_already_playing EN/RO; syntax error) — not from this pass.
