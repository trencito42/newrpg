RPG = RPG or {}
RPG.Util = RPG.Util or {}

function RPG.Util.Trim(value)
    if type(value) ~= 'string' then return '' end
    return value:match('^%s*(.-)%s*$') or ''
end

function RPG.Util.Normalize(value)
    return string.lower(RPG.Util.Trim(value))
end

function RPG.Util.Clamp(value, minimum, maximum)
    value = tonumber(value) or minimum
    return math.max(minimum, math.min(maximum, value))
end

function RPG.Util.SafeString(value, maximum)
    if type(value) ~= 'string' then return nil end
    value = RPG.Util.Trim(value)
    if value == '' or #value > maximum then return nil end
    if value:find('[%z\1-\8\11\12\14-\31]') then return nil end
    return value
end

function RPG.Util.Uuid()
    local template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return template:gsub('[xy]', function(c)
        local value = c == 'x' and math.random(0, 15) or math.random(8, 11)
        return string.format('%x', value)
    end)
end

