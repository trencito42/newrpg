Sunset = Sunset or {}

function Sunset.Debug(...)
    if Sunset.Config.Debug then
        print('^3[Sunset]^7', ...)
    end
end

function Sunset.TableCopy(orig)
    local copy = {}
    for k, v in pairs(orig) do
        if type(v) == 'table' then
            copy[k] = Sunset.TableCopy(v)
        else
            copy[k] = v
        end
    end
    return copy
end

function Sunset.GetIdentifier(source, idType)
    for _, id in ipairs(GetPlayerIdentifiers(source)) do
        if string.find(id, idType .. ':') then
            return id
        end
    end
    return nil
end

function Sunset.FormatMoney(amount)
    local formatted = tostring(amount)
    local k
    while true do
        formatted, k = string.gsub(formatted, '^(-?%d+)(%d%d%d)', '%1.%2')
        if k == 0 then break end
    end
    return '$' .. formatted
end

if IsDuplicityVersion() then
    function Sunset.GetPlayerName(source)
        if not source or source == 0 then return 'Server' end
        local ok, name = pcall(function()
            return exports.sunset_core:GetPlayerDisplayName(source)
        end)
        if ok and type(name) == 'string' and name ~= '' then return name end
        local okBase, base = pcall(function()
            return exports.sunset_core:GetPlayerBaseName(source)
        end)
        if okBase and type(base) == 'string' and base ~= '' then return base end
        return ('Player_%d'):format(source)
    end
end
