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
