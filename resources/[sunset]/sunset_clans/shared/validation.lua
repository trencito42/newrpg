-- ═══════════════════════════════════════════════════════════════
--  sunset_clans — shared/validation.lua
--  Canonical clan name / tag / colour rules, shared by clan creation,
--  clan settings and the Racket Shop clan products (server/shop_ops.lua).
-- ═══════════════════════════════════════════════════════════════

SunsetClans = SunsetClans or {}

-- Tag: letters/digits only, MinTagLength..MaxTagLength after removing spaces.
function SunsetClans.cleanTag(tag)
    tag = tostring(tag or ''):gsub('%s+', '')
    if not tag:match('^[%w]+$') then return nil end
    if #tag < (SunsetClans.MinTagLength or 2) or #tag > (SunsetClans.MaxTagLength or 6) then return nil end
    return tag
end

-- Name: letters, digits, spaces, dots and dashes; trimmed length bounds.
function SunsetClans.cleanName(name)
    name = tostring(name or ''):gsub('^%s+', ''):gsub('%s+$', '')
    if #name < (SunsetClans.MinNameLength or 3) or #name > (SunsetClans.MaxNameLength or 32) then return nil end
    if not name:match('^[%w%s%-%.]+$') then return nil end
    return name
end

-- Lenient colour normaliser used by create/settings (falls back to default).
function SunsetClans.cleanColor(hex)
    hex = tostring(hex or ''):gsub('#', '')
    if not hex:match('^%x%x%x%x%x%x$') then return '#FF8C00' end
    return '#' .. string.upper(hex)
end

-- Strict colour check for paid colour changes: ^#[0-9A-Fa-f]{6}$ or nil.
function SunsetClans.strictColor(hex)
    if type(hex) ~= 'string' or not hex:match('^#%x%x%x%x%x%x$') then return nil end
    return hex:upper()
end
