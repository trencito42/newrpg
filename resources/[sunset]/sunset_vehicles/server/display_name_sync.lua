-- Mirrors the presentation-only vehicle name catalog into SQL for consumers
-- outside the FiveM Lua runtime (notably the web panel).
-- This intentionally does NOT touch dealership_vehicles: dealership rows carry
-- economy semantics such as price, stock and availability.

local function syncDisplayNames()
    local tuples = {}
    local params = {}

    for model, metadata in pairs(SunsetVehicleNames.Addons or {}) do
        if SunsetVehicleNames.Valid(model)
            and metadata
            and SunsetVehicleNames.Valid(metadata.label) then
            tuples[#tuples + 1] = '(?, ?, ?, ?)'
            params[#params + 1] = SunsetVehicleNames.Key(model)
            params[#params + 1] = metadata.label
            params[#params + 1] = metadata.brand or 'Other'
            params[#params + 1] = 'sunset_vehicles'
        end
    end

    if #tuples == 0 then return 0 end

    local sql = ([=[
        INSERT INTO vehicle_display_names (`model`, `label`, `brand`, `source`)
        VALUES %s
        ON DUPLICATE KEY UPDATE
            `label` = VALUES(`label`),
            `brand` = VALUES(`brand`),
            `source` = VALUES(`source`)
    ]=]):format(table.concat(tuples, ','))

    MySQL.query.await(sql, params)
    return #tuples
end

MySQL.ready(function()
    local ok, countOrError = pcall(syncDisplayNames)
    if not ok then
        print(('[sunset_vehicles] display-name SQL sync failed: %s'):format(tostring(countOrError)))
        return
    end

    if GetConvarInt('sunset_dev', 0) == 1 then
        print(('[sunset_vehicles] synced %d vehicle display names to SQL'):format(countOrError))
    end
end)

exports('SyncVehicleDisplayNames', syncDisplayNames)
