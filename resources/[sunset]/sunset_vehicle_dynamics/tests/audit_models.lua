--[[
    Sunset Vehicle Dynamics - Model Dynamics Audit
    Audits runtime handling resolution and profile mapping.
]]

RegisterCommand('dynamicaudit', function()
    local profiles = SunsetVehicleDynamics.GetAllProfiles()
    local count = 0
    print('^2=== Sunset Vehicle Dynamics Profile Audit ===^7')
    for model, data in pairs(profiles) do
        count = count + 1
        local h = data.handling or {}
        print(string.format('[%d] %-15s | Archetype: %-15s | Drivetrain: %-4s | Mass: %4d kg | Force: %.3f | MaxVel: %.1f km/h | GripMax: %.2f',
            count, model, data.archetype or 'custom', data.drivetrain or 'n/a', math.floor(h.fMass or 0), h.fInitialDriveForce or 0, h.fInitialDriveMaxFlatVel or 0, h.fTractionCurveMax or 0))
    end
    print(string.format('^2Total profiles active: %d^7', count))
end, true)
