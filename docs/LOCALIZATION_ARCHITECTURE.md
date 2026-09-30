# Localization Architecture
## SunsetMP — Sunset.T() + Locale Tables

*Added in audit commit 25d78e4*

---

## Overview

All player-facing strings default to **English**. Romanian translation is supported
as an opt-in locale. Internal Discord embeds and code comments may remain in Romanian.

---

## Files

| File | Purpose |
|------|---------|
| `sunset_core/shared/locales/en.lua` | English locale table |
| `sunset_core/shared/locales/ro.lua` | Romanian locale table (inherits EN via `__index`) |
| `sunset_core/shared/locale.lua` | `Sunset.T(key, ...)` helper |

All three are loaded as `shared_scripts` in `sunset_core/fxmanifest.lua`, so they are
available on both client and server in every resource that depends on `sunset_core`.

---

## Usage

```lua
-- Simple lookup
local msg = Sunset.T('property_locked')
-- → "This property is locked."

-- With format args
local msg = Sunset.T('detention_jailed', 30)
-- → "You have been sent to jail for 30 minutes."

-- Alias
local msg = Sunset.Locale('muted', 60, 'Advertising')
-- → "You have been muted for 60 minutes. Reason: Advertising."
```

Missing key returns `[?key_name]` as a sentinel — never crashes.

---

## Adding a New String

1. Add the key to `en.lua`:
   ```lua
   ['my_resource_thing'] = 'Something happened: %s.',
   ```
2. Optionally translate in `ro.lua`:
   ```lua
   Sunset.Locales['ro']['my_resource_thing'] = 'Ceva s-a întâmplat: %s.',
   ```
3. Use in Lua:
   ```lua
   TriggerClientEvent('sunset:client:notify', src, Sunset.T('my_resource_thing', detail), 'info')
   ```

---

## Changing the Active Locale

Default locale is `'en'`. To switch to Romanian globally:

```lua
-- In sunset_core/shared/config.lua
Sunset.Config.Locale = 'ro'
```

Romanian falls back to English for any key not explicitly translated (via `__index`).

---

## Migration Status

All existing player-facing strings were batch-translated to English in audit commits
`5fd4b9d`, `81bd018`, `ae4d17e`, and `78fcc99`. New strings written after these
commits should use `Sunset.T('key')` directly rather than hardcoding English literals,
so translation can be done in one place.
