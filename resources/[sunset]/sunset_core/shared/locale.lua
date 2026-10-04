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

local function strictLocale()
    return GetConvar('I18N_STRICT', '0') == '1' or GetConvar('sunset_i18n_strict', '0') == '1'
end

local function interpolate(template, params, locale)
    if type(params) ~= 'table' then return template end
    return (template:gsub('{([%w_]+)}', function(name)
        local value = params[name]
        if value == nil then return '{' .. name .. '}' end
        -- A parameter may itself be a locale descriptor ({ localeKey, params }) so
        -- word-like pieces ("online", "no surrender") follow the viewer's language.
        if type(value) == 'table' and type(value.localeKey) == 'string' then
            return Sunset.Translate(locale, value.localeKey, value.params)
        end
        return tostring(value)
    end))
end

local warnedMissing = {}

-- A missing key must never show a raw key to a player. Fall back to a readable
-- phrase built from the last key segment ('jobs.message.could_not_end_shift'
-- -> 'Could not end shift') and log once. Debug builds keep the visible marker
-- so developers still notice the gap.
local function missingKey(key)
    local debugLocale = (Sunset.Config and Sunset.Config.Debug) or GetConvar('sunset_dev', '0') == '1'
    if debugLocale and not warnedMissing[key] then
        warnedMissing[key] = true
        print(('[locale] missing translation key: %s'):format(key))
    end
    if debugLocale then
        return ('[?%s]'):format(key)
    end
    local last = key:match('([^%.]+)$') or key
    last = last:gsub('_', ' ')
    return (last:gsub('^%l', string.upper))
end

function Sunset.IsValidLocale(locale)
    return validLocale(locale) ~= nil
end

-- True when the active locale (or the English fallback) defines the key.
function Sunset.HasTranslation(key, locale)
    locale = validLocale(locale) or validLocale(Sunset.CurrentLocale) or 'en'
    local primary = Sunset.Locales[locale] or {}
    local fallback = Sunset.Locales.en or {}
    local value = rawget(primary, tostring(key or '')) or rawget(fallback, tostring(key or ''))
    return type(value) == 'string' and value ~= ''
end

function Sunset.Translate(locale, key, params, ...)
    locale = validLocale(locale) or 'en'
    key = tostring(key or '')
    local primary = Sunset.Locales[locale] or {}
    local fallback = Sunset.Locales.en or {}
    local value = rawget(primary, key)
    if strictLocale() then
        local context = ('[locale] locale=%s key=%s resource=%s'):format(locale, key, GetCurrentResourceName())
        if type(value) ~= 'string' or value == '' then error(context .. ' missing translation', 2) end
        for name in value:gmatch('{([%w_]+)}') do
            if type(params) ~= 'table' or params[name] == nil then
                error(context .. ' missing parameter {' .. name .. '}', 2)
            end
        end
    end
    value = value or rawget(fallback, key)
    if type(value) ~= 'string' or value == '' then
        return missingKey(key)
    end

    if type(params) == 'table' then
        return interpolate(value, params, locale)
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

-- Resolve presentation descriptors at the last possible moment. Shared gameplay
-- configuration keeps stable English fallbacks for logs/legacy consumers and a
-- semantic `*Key` beside every visible field. A client uses its own locale; a
-- server caller may pass the recipient's locale explicitly.
function Sunset.LocalizePresentation(value, locale, seen)
    if type(value) ~= 'table' then return value end
    locale = validLocale(locale) or validLocale(Sunset.CurrentLocale) or 'en'
    seen = seen or {}
    if seen[value] then return seen[value] end

    local result = {}
    seen[value] = result
    for key, item in pairs(value) do
        result[key] = type(item) == 'table'
            and Sunset.LocalizePresentation(item, locale, seen)
            or item
    end
    for _, field in ipairs({ 'label', 'description', 'title', 'help', 'prompt', 'message',
        'placeholder', 'objective', 'hint', 'subtitle', 'stationHint', 'lockedReason',
        'outputLabel', 'inputLabel', 'itemLabel', 'jobLabel', 'factionLabel', 'locationLabel', 'dealerLabel' }) do
        local localeKey = rawget(value, field .. 'Key')
        if type(localeKey) == 'string' and localeKey ~= '' then
            -- Chat and clan/faction actions send `messageKey` + `messageParams`.
            -- Reading only `params` / `formatArgs` re-translated those lines with
            -- no arguments, so placeholders such as {value} reached the player.
            local named = rawget(value, field .. 'Params')
            if type(named) ~= 'table' then named = rawget(value, 'params') end
            local positional = rawget(value, field .. 'Args')
            if type(positional) ~= 'table' and type(named) ~= 'table' then
                positional = rawget(value, 'formatArgs')
            end
            if type(named) == 'table' then
                result[field] = Sunset.Translate(locale, localeKey, named)
            elseif type(positional) == 'table' then
                result[field] = Sunset.Translate(locale, localeKey, table.unpack(positional))
            else
                result[field] = Sunset.Translate(locale, localeKey)
            end
        end
    end
    return result
end

function Sunset.PresentationText(value, field, locale)
    if type(value) ~= 'table' then return tostring(value or '') end
    field = tostring(field or 'label')
    local localeKey = rawget(value, field .. 'Key')
    if type(localeKey) == 'string' and localeKey ~= '' then
        return Sunset.Translate(locale or Sunset.CurrentLocale, localeKey)
    end
    return tostring(rawget(value, field) or '')
end

function Sunset.ItemLabel(itemId, locale)
    local def = Sunset.Items and Sunset.Items[tostring(itemId or '')]
    return def and Sunset.PresentationText(def, 'label', locale) or tostring(itemId or '')
end

function Sunset.JobLabel(jobId, locale)
    local def = Sunset.CivilianJobs and Sunset.CivilianJobs[tostring(jobId or '')]
    return def and Sunset.PresentationText(def, 'label', locale) or tostring(jobId or '')
end

function Sunset.FactionLabel(factionId, locale)
    local def = Sunset.Factions and Sunset.Factions[tostring(factionId or '')]
    return def and Sunset.PresentationText(def, 'label', locale) or tostring(factionId or '')
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
