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
else
    function Sunset.AwaitGameReady()
        while not NetworkIsSessionStarted() do Wait(100) end
        while not DoesEntityExist(PlayerPedId()) or GetEntityModel(PlayerPedId()) == 0 do Wait(100) end
        while LocalPlayer.state.sunsetAuthFlowActive or LocalPlayer.state.isSpawning do
            Wait(200)
        end
        return true
    end

    function Sunset.RequestModelSafe(model, timeoutMs)
        if not model then return false, 'NIL_MODEL' end
        local hash = (type(model) == 'number') and model or GetHashKey(tostring(model))
        if not hash or hash == 0 then return false, 'INVALID_HASH' end
        if not IsModelInCdimage(hash) or not IsModelValid(hash) then
            return false, 'NOT_IN_CDIMAGE'
        end
        if HasModelLoaded(hash) then return true, hash end

        local t0 = GetGameTimer()
        local timeout = tonumber(timeoutMs) or 5000
        RequestModel(hash)
        while not HasModelLoaded(hash) do
            if GetGameTimer() - t0 > timeout then
                return false, 'TIMEOUT'
            end
            Wait(10)
        end
        return true, hash
    end

    local function isValidCoordNumber(n)
        local num = tonumber(n)
        return num ~= nil and num == num and math.abs(num) < 20000.0 and num ~= (1/0) and num ~= (-1/0)
    end

    function Sunset.CreateSafeBlip(coords, config)
        if type(coords) ~= 'table' and type(coords) ~= 'vector3' and type(coords) ~= 'vector4' then
            return nil, 'INVALID_COORDS_TYPE'
        end
        local x = coords.x or coords[1]
        local y = coords.y or coords[2]
        local z = coords.z or coords[3]
        if not isValidCoordNumber(x) or not isValidCoordNumber(y) or not isValidCoordNumber(z) then
            return nil, 'INVALID_COORDS_VALUES'
        end

        config = config or {}
        local ok, blip = pcall(AddBlipForCoord, tonumber(x) + 0.0, tonumber(y) + 0.0, tonumber(z) + 0.0)
        if not ok or not blip or blip == 0 or not DoesBlipExist(blip) then
            return nil, 'NATIVE_ERROR'
        end

        if config.sprite then SetBlipSprite(blip, tonumber(config.sprite) or 1) end
        if config.color then SetBlipColour(blip, tonumber(config.color) or 0) end
        if config.scale then SetBlipScale(blip, tonumber(config.scale) or 0.7) end
        SetBlipAsShortRange(blip, config.shortRange ~= false)
        if config.label then
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentSubstringPlayerName(tostring(config.label))
            EndTextCommandSetBlipName(blip)
        end
        return blip
    end
end
