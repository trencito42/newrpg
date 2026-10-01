# NUI Stability Architecture — 2026-09-30

---

## Focus Ownership Model

All NUI focus is managed through a single entry point:

```
exports.sunset_ui:SetFocus(hasFocus, hasCursor, keepInput, owner)
```

`sunset_ui/client/main.lua` maintains a `focusOwner` string. Releasing focus from a different owner is blocked with a server console log (traceback included). The auth screen has a special guard that prevents any non-`'auth'`/`'force'` owner from releasing focus.

`exports.sunset_ui:ReleaseFocusUnlessModal(owner)` checks whether any modal panel (menu, properties, factions) is still open before releasing — prevents premature focus release on panel-to-panel transitions.

**Panels that own focus must always have a guaranteed close path:**
- ESC key handler (or `sunset_menu_close` key mapping)
- Close button inside the panel
- `sunset:ui:forceCloseAll` event (fires on death)

---

## Error Boundary (new, 2026-09-30)

**Problem:** JavaScript exceptions in the CEF renderer were completely silent. Players experiencing NUI crashes had no way to report them without opening F8.

**Solution:** A global error boundary added to `sunset_ui/web/index.html` before all other scripts:

```javascript
window.onerror = function(message, source, lineno, colno, error) {
    fetch('https://sunset_ui/nuiError', { method: 'POST', ... });
    return false;
};
window.addEventListener('unhandledrejection', function(event) {
    fetch('https://sunset_ui/nuiError', { method: 'POST', ... });
});
```

This POSTs to the NUI bridge, which:
1. Records to the ring buffer in `NuiDebugRecordError()` (queryable via `exports.sunset_ui:GetNuiDebugErrors()`)
2. Prints to the player's F8 console
3. Triggers `sunset:server:nuiError` server event → prints to server console with player name

This means NUI crashes are now visible in server logs without player action.

---

## Panel Isolation Contract

Each NUI panel is a self-contained module in `sunset_ui/web/js/`. Rules:

1. **Focus**: Every panel that calls `exports.sunset_ui:SetFocus(true, ...)` must call `SetFocus(false, ...)` or `ReleaseFocusUnlessModal()` on close.
2. **Timers**: `setInterval` and `setTimeout` created when a panel opens must be cleared when the panel hides. Pattern:
   ```javascript
   let pollTimer = null;
   function onShow() { pollTimer = setInterval(..., 1000); }
   function onHide() { clearInterval(pollTimer); pollTimer = null; }
   ```
3. **Event listeners**: `window.addEventListener` inside a panel must track the handler reference and call `removeEventListener` on hide, or use `{ once: true }`.
4. **innerHTML**: Never use `innerHTML` with user-controlled strings. Use `textContent` or DOM construction. The chat panel is the highest-risk area; current implementation in `chat.js` uses template strings — review for XSS on new message fields.
5. **Large payloads**: Properties list is cached client-side and sent once on panel open. Menu `menuUpdate` (1Hz) sends character stats only, not the full property list.

---

## NUI Message Flow

```
Lua (client) → exports.sunset_ui:Send(action, payload)
    → SendNUIMessage({ action, data })
    → JS app.js switch(action) dispatches to module
    → Module renders / updates DOM
    → user interaction
    → JS post(callbackName, payload)
    → FiveM NUI callback (nui_bridge.lua)
    → TriggerEvent('sunset:nui:<callbackName>', payload)
    → Lua handler
```

`check-nui-bridge.js` validates that every `post()` call has a matching `AddEventHandler('sunset:nui:...')`.

---

## Identified Leak Risks

| Panel | Risk | Status |
|-------|------|--------|
| `damage-indicators.js` | `animationend` listener accumulation on rapid damage | FIXED — `{once:true}` |
| `chat.js` | `setInterval` for timestamp ticks — verify cleared on panel hide | REVIEW |
| `menu.js` | 1Hz polling (`menuUpdate`) driven from Lua, not JS — no JS timer risk | SAFE |
| `hud.js` | Frame-driven updates via `window.addEventListener('message')` — persistent, correct | SAFE |
| Properties NUI | `refreshProperties()` on every `propertiesChanged` broadcast | MITIGATED — menu now uses cache; full-fetch only when properties panel is explicitly opened |

---

## `NuiDebugRecordError` Integration

When `sv_sunset_nuidebug=1` (production default: off):

- `exports.sunset_ui:GetNuiDebugErrors(limit)` — returns the last N JS errors with message, file, line, and timestamp.
- `exports.sunset_ui:GetNuiDebugState()` — current focus owner, open screen, last message/callback.
- `exports.sunset_ui:GetNuiDebugHistory(limit)` — ring buffer of all outbound messages and NUI callbacks.

Use from `sunset_devtools` or `sunset_test_agent` to diagnose NUI regressions without a live console.

---

## Addendum 2026-10-01 — Runtime cost, focus routing, startup order, login pipeline

Full detail with file references: `docs/release/NUI_STARTUP_LOGIN_REPORT.md`.

**Runtime cost rules now enforced**
- No permanent rAF loops. `forza_speedometer.js` loops only while active; the main/auth "frame watchdog" rAF loops
  became 500 ms timer-drift checks (same stall signal, ~0.1% cost). The loadscreen watchdog is left (page is destroyed at handoff).
- Clocks (`atm.js`, `phone.js`) tick only while their panel is open. `mdc_tablet.js`, `helpdesk.js`, `fishing_tournament.js`,
  `license_quiz.js`, `auth_loading.js` already clear on hide.
- `backdrop-filter` is globally neutralised by `_cef_overrides.css` (`!important`, last stylesheet) and by the inline override in `sunset_tuning`.
  Do NOT add new `backdrop-filter`; use a solid translucent background.
- Per-row handlers: `battlepass.js` claim buttons use one delegated listener.
- Loadscreen per-file/per-init `console.log` trace is off unless `localStorage.sunset_boot_verbose = '1'`.

**Focus**
- Every resource with its own NUI page (`sunset_missions`, `sunset_pass`, `sunset_turfs`, `sunset_tuning`, `sunset_slots`,
  `sunset_robbery`, `sunset_auth_ui`) now routes focus through `exports.sunset_ui:SetFocus(has, cursor, keepInput, owner)` with a
  distinct owner, falls back to raw natives only if `sunset_ui` is not started, and releases on `onResourceStop` and `sunset:ui:forceCloseAll`.
- `sunset:ui:forceCloseAll` is now handled centrally in `sunset_ui` (releases with owner `force`), and `sunset_death` releases with `force`
  (otherwise the owner guard would block the release of another resource's focus).
- Still raw (other agents' areas, documented): `sunset_jobs/client/trucker_npc.lua` (releases only, after a SetFocus call), `sunset_devtools` (disabled in cfg).

**Diagnostics (debug only: `setr sv_sunset_nuidebug 1`)**
- `exports.sunset_ui:Send` measures the JSON payload per action: WARN > 100 KB, SEVERE > 500 KB, CRITICAL > 1 MB (F8 log).
- `/nuistats` (ACE `command.nuistats`, covered by `group.admin command allow`) prints the top 20 actions by max payload in F8.
- Ping/pong every 30 s (`nuiPing` -> `nuiPong`); only logs when the page is slow (>2 s) or silent.
- `sunset:server:nuiError` is now rate limited (5 / 10 s / player) and no longer shadows `source`.

**Startup order**: `config/server.cfg.template` ensure order is now the dependency-respecting order (FiveM already auto-started declared
dependencies first, so runtime order is unchanged but the template is honest). `sunset_skins`, `sunset_emotes`, `sunset_blackjack` declare their dependency.
The stale explicit `files` entries in `sunset_ui/fxmanifest.lua` for deleted CSS were removed (globs still cover everything present).

**Login pipeline**: see report (single-flight `CompleteAuthentication`, idempotent `enterGame`, no phantom character on load failure,
spawn single-flight + error recovery, logged default-spawn fallbacks, locale pushed to NUI on `playerReady`).
