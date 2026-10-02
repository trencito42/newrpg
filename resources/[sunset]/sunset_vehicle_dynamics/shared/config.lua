SunsetDynamics = SunsetDynamics or {}

SunsetDynamics.Config = {
    Debug = false,

    -- Re-application interval in ms for active driver seat
    ReapplyIntervalMs = 5000,

    -- Excluded GTA vehicle classes (not road cars/motorcycles)
    ExcludedClasses = {
        [13] = true, -- Cycles
        [14] = true, -- Boats
        [15] = true, -- Helicopters
        [16] = true, -- Planes
        [21] = true, -- Trains
    },

    -- Validation boundaries for physical attributes (ensures no physics glitches / explosions)
    Bounds = {
        fMass = { min = 500.0, max = 15000.0 },
        fInitialDragCoeff = { min = 1.0, max = 25.0 },
        fDriveBiasFront = { min = 0.0, max = 1.0 },
        nInitialDriveGears = { min = 1, max = 10 },
        fInitialDriveForce = { min = 0.08, max = 0.65 },
        fDriveInertia = { min = 0.3, max = 2.5 },
        fInitialDriveMaxFlatVel = { min = 100.0, max = 420.0 },
        fBrakeForce = { min = 0.25, max = 2.2 },
        fBrakeBiasFront = { min = 0.3, max = 0.8 },
        fHandBrakeForce = { min = 0.2, max = 2.5 },
        fSteeringLock = { min = 24.0, max = 55.0 },
        fTractionCurveMax = { min = 1.2, max = 3.6 },
        fTractionCurveMin = { min = 1.0, max = 3.2 },
        fTractionCurveLateral = { min = 12.0, max = 35.0 },
        fTractionSpringDeltaMax = { min = 0.05, max = 0.35 },
        fLowSpeedTractionLossMult = { min = 0.5, max = 2.5 },
        fTractionBiasFront = { min = 0.35, max = 0.65 },
        fTractionLossMult = { min = 0.5, max = 1.8 },
        fSuspensionForce = { min = 1.0, max = 4.0 },
        fSuspensionCompDamp = { min = 0.5, max = 3.5 },
        fSuspensionReboundDamp = { min = 0.8, max = 4.5 },
        fSuspensionUpperLimit = { min = 0.03, max = 0.25 },
        fSuspensionLowerLimit = { min = -0.25, max = -0.02 },
        fAntiRollBarForce = { min = 0.0, max = 2.5 },
        fRollCentreHeightFront = { min = 0.05, max = 0.75 },
        fRollCentreHeightRear = { min = 0.05, max = 0.75 },
    },

    -- Handling fields handled by the dynamics system
    HandledFields = {
        'fMass',
        'fInitialDragCoeff',
        'fDriveBiasFront',
        'nInitialDriveGears',
        'fInitialDriveForce',
        'fDriveInertia',
        'fClutchChangeRateScaleUpShift',
        'fClutchChangeRateScaleDownShift',
        'fInitialDriveMaxFlatVel',
        'fBrakeForce',
        'fBrakeBiasFront',
        'fHandBrakeForce',
        'fSteeringLock',
        'fTractionCurveMax',
        'fTractionCurveMin',
        'fTractionCurveLateral',
        'fTractionSpringDeltaMax',
        'fLowSpeedTractionLossMult',
        'fCamberStiffnesss',
        'fTractionBiasFront',
        'fTractionLossMult',
        'fSuspensionForce',
        'fSuspensionCompDamp',
        'fSuspensionReboundDamp',
        'fSuspensionUpperLimit',
        'fSuspensionLowerLimit',
        'fSuspensionRaise',
        'fSuspensionBiasFront',
        'fAntiRollBarForce',
        'fAntiRollBarBiasFront',
        'fRollCentreHeightFront',
        'fRollCentreHeightRear',
    },

    -- Vector Handling fields
    HandledVectors = {
        'vecCentreOfMassOffset',
        'vecInertiaMultiplier',
    }
}
