-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Romanian locale (shared/locales/ro.lua)
--  Mirror of en.lua — fill in translations to activate RO.
--  Server default is 'en'; switch via Sunset.Config.Locale = 'ro'.
-- ═══════════════════════════════════════════════════════════════

Sunset = Sunset or {}
Sunset.Locales = Sunset.Locales or {}

-- Romanian strings intentionally inherit from EN until translated.
-- Copy individual keys here and translate to override.
Sunset.Locales['ro'] = setmetatable({}, { __index = Sunset.Locales['en'] })
