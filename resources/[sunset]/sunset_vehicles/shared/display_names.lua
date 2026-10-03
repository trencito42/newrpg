SunsetVehicleNames = SunsetVehicleNames or {}

-- Explicit fallback for streamed vehicles when the database is not ready yet.
-- The dealership catalog remains authoritative and may override these labels.
SunsetVehicleNames.Addons = {
    tempesta2 = { label = 'Tempesta Widebody', labelKey = "config.vehicles.label.tempesta_widebody.b746c1c5", brand = 'Pegassi' },
    sentinel_rts = { label = 'Sentinel RTS Track', labelKey = "config.vehicles.label.sentinel_rts_track.edad8d59", brand = 'Ubermacht' },
    d7cyp = { label = 'Cypher GTS Spec', labelKey = "config.vehicles.label.cypher_gts_spec.4db342da", brand = 'Ubermacht' },
    schlagenstr = { label = 'Schlagen STR AMG', labelKey = "config.vehicles.label.schlagen_str_amg.3643f2b1", brand = 'Benefactor' },
    cometcup = { label = 'Comet Cup Edition', labelKey = "config.vehicles.label.comet_cup_edition.f6cde51a", brand = 'Pfister' },
    h4rxst2 = { label = 'Harx ST2 GT', labelKey = "config.vehicles.label.harx_st2_gt.be6294c7", brand = 'Pfister' },
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
