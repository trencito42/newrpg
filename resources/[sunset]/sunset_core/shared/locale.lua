-- Central shared localization primitives. Runtime language is never read from
-- a global config value: the server uses each authenticated player's account
-- preference and each client keeps its own synchronized locale.

Sunset = Sunset or {}
Sunset.Locales = Sunset.Locales or {}
Sunset.ValidLocales = { en = true, ro = true }
Sunset.CurrentLocale = Sunset.CurrentLocale or ((Sunset.Config and Sunset.Config.DefaultLanguage) or 'en')

local function validLocale(locale)
    locale = type(locale) == 'string' and locale:lower() or ''
    return Sunset.ValidLocales[locale] and locale or nil
end

local function interpolate(template, params)
    if type(params) ~= 'table' then return template end
    return (template:gsub('{([%w_]+)}', function(name)
        local value = params[name]
        if value == nil then return '{' .. name .. '}' end
        return tostring(value)
    end))
end

local warnedMissing = {}

-- A missing key must never show a raw key to a player. Fall back to a readable
-- phrase built from the last key segment ('jobs.message.could_not_end_shift'
-- -> 'Could not end shift') and log once. Debug builds keep the visible marker
-- so developers still notice the gap.
local function missingKey(key)
    if not warnedMissing[key] then
        warnedMissing[key] = true
        print(('[locale] missing translation key: %s'):format(key))
    end
    if Sunset.Config and Sunset.Config.Debug then
        return ('[?%s]'):format(key)
    end
    local last = key:match('([^%.]+)$') or key
    last = last:gsub('_', ' ')
    return (last:gsub('^%l', string.upper))
end

function Sunset.IsValidLocale(locale)
    return validLocale(locale) ~= nil
end

function Sunset.Translate(locale, key, params, ...)
    locale = validLocale(locale) or 'en'
    key = tostring(key or '')
    local primary = Sunset.Locales[locale] or {}
    local fallback = Sunset.Locales.en or {}
    local value = rawget(primary, key) or rawget(fallback, key)
    if type(value) ~= 'string' or value == '' then
        return missingKey(key)
    end

    if type(params) == 'table' then
        return interpolate(value, params)
    end

    -- Backwards compatibility for the old positional string.format API.
    if params ~= nil then
        local ok, formatted = pcall(string.format, value, params, ...)
        if ok then return formatted end
    end
    return value
end

function Sunset.T(key, params, ...)
    return Sunset.Translate(Sunset.CurrentLocale, key, params, ...)
end

function Sunset.TLocale(locale, key, params)
    return Sunset.Translate(locale, key, params)
end

function Sunset.TPlural(locale, key, count, params)
    params = type(params) == 'table' and params or {}
    params.count = count
    local suffix = tonumber(count) == 1 and '.one' or '.other'
    return Sunset.Translate(locale, key .. suffix, params)
end

function Sunset.GetLocale()
    return validLocale(Sunset.CurrentLocale) or 'en'
end

function Sunset.SetLocalLocale(locale)
    locale = validLocale(locale)
    if not locale then return false end
    Sunset.CurrentLocale = locale
    return true
end

Sunset.Locale = Sunset.T
