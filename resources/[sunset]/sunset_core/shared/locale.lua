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
        return ('[?%s]'):format(key)
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
