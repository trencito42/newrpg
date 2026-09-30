-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Locale helper (shared/locale.lua)
--  Usage: Sunset.T('key')  or  Sunset.T('key', arg1, arg2, ...)
--  Locale is set by Sunset.Config.Locale (default 'en').
-- ═══════════════════════════════════════════════════════════════

Sunset = Sunset or {}

function Sunset.T(key, ...)
    local locale = (Sunset.Config and Sunset.Config.Locale) or 'en'
    local tbl = (Sunset.Locales and Sunset.Locales[locale])
             or (Sunset.Locales and Sunset.Locales['en'])
    local str = tbl and tbl[key]
    if not str then
        return ('[?%s]'):format(key)
    end
    local args = { ... }
    if #args == 0 then return str end
    return str:format(table.unpack(args))
end

-- Convenience alias
Sunset.Locale = Sunset.T
