--[[
    Sunset Vehicle Dynamics - Central Configuration
    Single Canonical Schema for Vehicle Dynamics
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}
SunsetVehicleDynamics.Config = {
    Debug = false,

    -- Excluded GTA Vehicle Classes (planes, helicopters, boats, cycles, trains)
    ExcludedClasses = {
        [13] = true, -- Cycles
        [14] = true, -- Boats
        [15] = true, -- Helicopters
        [16] = true, -- Planes
        [21] = true, -- Trains
    },

    -- Canonical list of handled physics properties and their native type
    HandledProperties = {
        -- Mass & Drag
        { name = 'fMass', type = 'float' },
        { name = 'fInitialDragCoeff', type = 'float' },

        -- Center of Mass & Inertia
        { name = 'vecCentreOfMassOffset', type = 'vector' },
        { name = 'vecInertiaMultiplier', type = 'vector' },

        -- Transmission & Drivetrain
        { name = 'fDriveBiasFront', type = 'float' },
        { name = 'nInitialDriveGears', type = 'int' },
        { name = 'fInitialDriveForce', type = 'float' },
        { name = 'fDriveInertia', type = 'float' },
        { name = 'fClutchChangeRateScaleUpShift', type = 'float' },
        { name = 'fClutchChangeRateScaleDownShift', type = 'float' },
        { name = 'fInitialDriveMaxFlatVel', type = 'float' },

        -- Braking & Steering
        { name = 'fBrakeForce', type = 'float' },
        { name = 'fBrakeBiasFront', type = 'float' },
        { name = 'fHandBrakeForce', type = 'float' },
        { name = 'fSteeringLock', type = 'float' },

        -- Traction & Grip
        { name = 'fTractionCurveMax', type = 'float' },
        { name = 'fTractionCurveMin', type = 'float' },
        { name = 'fTractionCurveLateral', type = 'float' },
        { name = 'fTractionSpringDeltaMax', type = 'float' },
        { name = 'fLowSpeedTractionLossMult', type = 'float' },
        { name = 'fCamberStiffnesss', type = 'float' },
        { name = 'fTractionBiasFront', type = 'float' },
        { name = 'fTractionLossMult', type = 'float' },

        -- Suspension & Damping
        { name = 'fSuspensionForce', type = 'float' },
        { name = 'fSuspensionCompDamp', type = 'float' },
        { name = 'fSuspensionReboundDamp', type = 'float' },
        { name = 'fSuspensionUpperLimit', type = 'float' },
        { name = 'fSuspensionLowerLimit', type = 'float' },
        { name = 'fSuspensionRaise', type = 'float' },
        { name = 'fSuspensionBiasFront', type = 'float' },

        -- Anti-Roll Bars & Roll Centers
        { name = 'fAntiRollBarForce', type = 'float' },
        { name = 'fAntiRollBarBiasFront', type = 'float' },
        { name = 'fRollCentreHeightFront', type = 'float' },
        { name = 'fRollCentreHeightRear', type = 'float' }
    },

    -- Physical safety limits for sanitization and validation
    HandlingLimits = {
        fMass = { min = 400.0, max = 15000.0, default = 1500.0 },
        fInitialDragCoeff = { min = 1.0, max = 30.0, default = 7.0 },
        vecCentreOfMassOffset = { min = -1.5, max = 1.5, type = 'vector' },
        vecInertiaMultiplier = { min = 0.5, max = 3.0, type = 'vector' },
        fDriveBiasFront = { min = 0.0, max = 1.0, default = 0.0 },
        nInitialDriveGears = { min = 1, max = 10, default = 6 },
        fInitialDriveForce = { min = 0.10, max = 0.55, default = 0.30 },
        fDriveInertia = { min = 0.5, max = 2.0, default = 1.0 },
        fClutchChangeRateScaleUpShift = { min = 0.5, max = 6.0, default = 2.0 },
        fClutchChangeRateScaleDownShift = { min = 0.5, max = 6.0, default = 2.0 },
        fInitialDriveMaxFlatVel = { min = 80.0, max = 260.0, default = 160.0 },
        fBrakeForce = { min = 0.3, max = 2.0, default = 0.85 },
        fBrakeBiasFront = { min = 0.3, max = 0.8, default = 0.53 },
        fHandBrakeForce = { min = 0.2, max = 2.0, default = 0.70 },
        fSteeringLock = { min = 20.0, max = 50.0, default = 38.0 },
        fTractionCurveMax = { min = 1.4, max = 3.2, default = 2.35 },
        fTractionCurveMin = { min = 1.2, max = 3.0, default = 2.15 },
        fTractionCurveLateral = { min = 12.0, max = 32.0, default = 22.0 },
        fTractionSpringDeltaMax = { min = 0.05, max = 0.35, default = 0.15 },
        fLowSpeedTractionLossMult = { min = 0.5, max = 2.5, default = 1.15 },
        fCamberStiffnesss = { min = 0.0, max = 1.0, default = 0.0 },
        fTractionBiasFront = { min = 0.35, max = 0.65, default = 0.49 },
        fTractionLossMult = { min = 0.5, max = 2.0, default = 1.0 },
        fSuspensionForce = { min = 1.0, max = 5.0, default = 2.2 },
        fSuspensionCompDamp = { min = 0.5, max = 4.0, default = 1.6 },
        fSuspensionReboundDamp = { min = 1.0, max = 6.0, default = 2.8 },
        fSuspensionUpperLimit = { min = 0.02, max = 0.30, default = 0.10 },
        fSuspensionLowerLimit = { min = -0.30, max = -0.02, default = -0.13 },
        fSuspensionRaise = { min = -0.15, max = 0.15, default = 0.0 },
        fSuspensionBiasFront = { min = 0.35, max = 0.65, default = 0.50 },
        fAntiRollBarForce = { min = 0.2, max = 2.5, default = 1.0 },
        fAntiRollBarBiasFront = { min = 0.35, max = 0.75, default = 0.53 },
        fRollCentreHeightFront = { min = 0.10, max = 0.70, default = 0.33 },
        fRollCentreHeightRear = { min = 0.10, max = 0.70, default = 0.34 }
    }
}
