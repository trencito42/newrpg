SunsetVehicleNames = SunsetVehicleNames or {}

-- Explicit fallback for streamed vehicles when the database is not ready yet.
-- The dealership catalog remains authoritative and may override these labels.
SunsetVehicleNames.Addons = {
    tempesta2 = { label = 'Tempesta Widebody', brand = 'Pegassi' },
    sentinel_rts = { label = 'Sentinel RTS Track', brand = 'Ubermacht' },
    d7cyp = { label = 'Cypher GTS Spec', brand = 'Ubermacht' },
    schlagenstr = { label = 'Schlagen STR AMG', brand = 'Benefactor' },
    cometcup = { label = 'Comet Cup Edition', brand = 'Pfister' },
    h4rxst2 = { label = 'Harx ST2 GT', brand = 'Pfister' },
}

function SunsetVehicleNames.Key(model)
    if type(model) ~= 'string' then return '' end
    return model:match('^%s*(.-)%s*$'):lower()
end

function SunsetVehicleNames.Valid(label)
    if type(label) ~= 'string' then return false end
    local clean = label:match('^%s*(.-)%s*$')
    if clean == '' then return false end
    local upper = clean:upper()
    return upper ~= 'NULL' and upper ~= 'CARNOTFOUND' and upper ~= 'UNDEFINED' and upper ~= 'NIL'
end

function SunsetVehicleNames.Fallback(model)
    local value = tostring(model or ''):gsub('[^%w%s_-]', ' '):gsub('[_%-]+', ' ')
    value = value:match('^%s*(.-)%s*$')
    if value == '' or value:match('^0[xX]%x+$') then return 'Vehicle' end
    return value:gsub('(%a)([%w]*)', function(first, rest) return first:upper() .. rest:lower() end)
end
