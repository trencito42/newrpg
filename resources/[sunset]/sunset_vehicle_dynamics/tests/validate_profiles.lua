--[[
    Sunset Vehicle Dynamics - Profile Validation Suite
    Validates that all registered profiles obey physics limits, have valid data types,
    positive mass, sensible gearing, and correct traction min/max relationships.
]]

local function runValidation()
    local errors = {}
    local warnings = {}
    local validCount = 0

    local allProfiles = SunsetVehicleDynamics.GetAllProfiles()

    for model, profile in pairs(allProfiles) do
        local h = profile.handling or {}

        -- 1. Check Mass
        if not h.fMass or type(h.fMass) ~= 'number' or h.fMass <= 0 then
            table.insert(errors, string.format('[%s] Invalid fMass: %s', model, tostring(h.fMass)))
        end

        -- 2. Check Drive Force
        if not h.fInitialDriveForce or type(h.fInitialDriveForce) ~= 'number' or h.fInitialDriveForce <= 0 or h.fInitialDriveForce > 1.0 then
            table.insert(errors, string.format('[%s] Extreme or invalid fInitialDriveForce: %s', model, tostring(h.fInitialDriveForce)))
        end

        -- 3. Check Traction Max & Min
        if h.fTractionCurveMax and h.fTractionCurveMin then
            if h.fTractionCurveMin > h.fTractionCurveMax then
                table.insert(errors, string.format('[%s] fTractionCurveMin (%.2f) > fTractionCurveMax (%.2f)', model, h.fTractionCurveMin, h.fTractionCurveMax))
            end
            if h.fTractionCurveMax > 3.5 then
                table.insert(warnings, string.format('[%s] Very high fTractionCurveMax: %.2f', model, h.fTractionCurveMax))
            end
        end

        -- 4. Check Steering Lock
        if h.fSteeringLock and (h.fSteeringLock < 20.0 or h.fSteeringLock > 50.0) then
            table.insert(warnings, string.format('[%s] Unusual fSteeringLock: %.1f deg', model, h.fSteeringLock))
        end

        -- 5. Check Gears
        if h.nInitialDriveGears and (h.nInitialDriveGears < 1 or h.nInitialDriveGears > 10) then
            table.insert(errors, string.format('[%s] Invalid gear count: %s', model, tostring(h.nInitialDriveGears)))
        end

        validCount = validCount + 1
    end

    print(string.format('^2[vehicle_dynamics_test] Validated %d profiles. Errors: %d, Warnings: %d^7', validCount, #errors, #warnings))
    for _, err in ipairs(errors) do
        print('^1  ERROR: ' .. err .. '^7')
    end
    for _, warn in ipairs(warnings) do
        print('^3  WARN:  ' .. warn .. '^7')
    end
end

CreateThread(function()
    Wait(1000)
    runValidation()
end)
