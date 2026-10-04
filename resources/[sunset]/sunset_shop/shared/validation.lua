-- ═══════════════════════════════════════════════════════════════
--  sunset_shop — shared/validation.lua
--  Pure input validators shared by the server handlers (authoritative) and
--  covered by scripts/test-shop.js. No FiveM natives, no database access.
-- ═══════════════════════════════════════════════════════════════

ShopValidation = {}

local function trim(value)
    return (tostring(value or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

-- One character name part (first OR last name).
-- Rules: 2-32 characters after trimming, ASCII letters plus single inner
-- spaces or hyphens, must start and end with a letter. Returns the cleaned
-- value or nil.
function ShopValidation.characterNamePart(value)
    if type(value) ~= 'string' then return nil end
    local cfg = (ShopConfig and ShopConfig.NameChange) or {}
    local minLength, maxLength = cfg.MinLength or 2, cfg.MaxLength or 32
    -- Leading/trailing whitespace is rejected rather than silently trimmed so
    -- the stored name is exactly what the player confirmed.
    if value ~= trim(value) then return nil end
    if #value < minLength or #value > maxLength then return nil end
    if not value:match('^[%a][%a%s%-]*[%a]$') then return nil end
    if value:find('%s%s') or value:find('%-%-') or value:find('%s%-') or value:find('%-%s') then return nil end
    if value:find('[\t\r\n]') then return nil end
    return value
end

-- One public nickname. Gameplay identity is not a first name plus a last name.
-- 3-24 characters, starts with a letter, letters/digits and single spaces.
function ShopValidation.nickname(value)
    if type(value) ~= 'string' then return nil end
    value = trim(value)
    if #value < 3 or #value > 24 then return nil end
    -- Letters and digits only. %w would also allow underscore, which the shop UI rejects.
    if not value:match('^%a[%a%d ]*$') then return nil end
    if value:find('  ', 1, true) then return nil end
    return value
end

-- Validates a full rename request. Returns firstname, lastname or nil.
function ShopValidation.characterName(firstname, lastname)
    local first = ShopValidation.characterNamePart(firstname)
    local last = ShopValidation.characterNamePart(lastname)
    if not first or not last then return nil end
    return first, last
end

-- Strict server-side hex colour check: ^#[0-9A-Fa-f]{6}$ → '#RRGGBB' upper-case.
function ShopValidation.hexColor(value)
    if type(value) ~= 'string' then return nil end
    if not value:match('^#%x%x%x%x%x%x$') then return nil end
    return value:upper()
end

-- Client-generated idempotency key: 8-64 chars of [A-Za-z0-9_:-].
function ShopValidation.requestId(value)
    if type(value) ~= 'string' then return false end
    local minLength = (ShopConfig and ShopConfig.RequestIdMinLength) or 8
    local maxLength = (ShopConfig and ShopConfig.RequestIdMaxLength) or 64
    if #value < minLength or #value > maxLength then return false end
    return value:match('^[%w_:%-]+$') ~= nil
end
