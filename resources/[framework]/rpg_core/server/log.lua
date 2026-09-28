RPG = RPG or {}

local validLevels = { INFO = true, WARN = true, ERROR = true, SECURITY = true, ADMIN = true }

function RPG.Log(level, message, context)
    level = validLevels[level] and level or 'INFO'
    local suffix = ''
    if type(context) == 'table' then
        local safe = {}
        for key, value in pairs(context) do
            local lowered = string.lower(tostring(key))
            if not lowered:find('password', 1, true) and not lowered:find('secret', 1, true) then
                safe[key] = value
            end
        end
        local ok, encoded = pcall(json.encode, safe)
        if ok then suffix = ' ' .. encoded end
    end
    print(('[RPG][%s] %s%s'):format(level, tostring(message), suffix))
end

exports('Log', RPG.Log)

