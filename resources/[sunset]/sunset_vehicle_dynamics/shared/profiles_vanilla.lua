--[[
    Sunset Vehicle Dynamics - Vanilla GTA V Vehicle Profiles
    Carefully calibrated per-model road dynamics representing distinct vehicle personalities:
    weight, drivetrains (FWD/RWD/AWD), realistic braking distances, body roll and gearing.
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}
SunsetVehicleDynamics.VanillaProfiles = {
    -- Karin Sultan (Subaru Impreza WRX STI inspired AWD Sports Sedan)
    ['sultan'] = {
        archetype = 'sports_awd',
        category = 'sports_sedan_awd',
        drivetrain = 'awd',
        weightKg = 1450,
        handling = {
            fMass = 1450.0,
            fInitialDragCoeff = 6.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.50,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.31,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 158.0,
            fBrakeForce = 0.85,
            fBrakeBiasFront = 0.54,
            fHandBrakeForce = 0.70,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.40,
            fTractionCurveMin = 2.20,
            fTractionCurveLateral = 22.0,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.50,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.6,
            fSuspensionUpperLimit = 0.10,
            fSuspensionLowerLimit = -0.12,
            fAntiRollBarForce = 0.95,
            fAntiRollBarBiasFront = 0.53,
            fRollCentreHeightFront = 0.32,
            fRollCentreHeightRear = 0.33
        }
    },

    -- Karin Sultan Classic / RS (Upgraded Turbo AWD Rally Monster)
    ['sultan2'] = {
        archetype = 'sports_awd',
        category = 'sports_rally_awd',
        drivetrain = 'awd',
        weightKg = 1380,
        handling = {
            fMass = 1380.0,
            fInitialDragCoeff = 6.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.34,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 168.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.54,
            fHandBrakeForce = 0.75,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.30,
            fTractionCurveLateral = 22.5,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.50,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fSuspensionUpperLimit = 0.09,
            fSuspensionLowerLimit = -0.11,
            fAntiRollBarForce = 1.10,
            fAntiRollBarBiasFront = 0.53,
            fRollCentreHeightFront = 0.30,
            fRollCentreHeightRear = 0.31
        }
    },

    -- Karin Futo (Toyota AE86 Trueno - Lightweight RWD Drift Legend)
    ['futo'] = {
        archetype = 'sports_rwd',
        category = 'compact_rwd_drift',
        drivetrain = 'rwd',
        weightKg = 980,
        handling = {
            fMass = 980.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.06 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.28,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 148.0,
            fBrakeForce = 0.75,
            fBrakeBiasFront = 0.55,
            fHandBrakeForce = 0.85,
            fSteeringLock = 41.0,
            fTractionCurveMax = 2.20,
            fTractionCurveMin = 1.95,
            fTractionCurveLateral = 21.0,
            fLowSpeedTractionLossMult = 1.30,
            fTractionBiasFront = 0.46,
            fSuspensionForce = 1.9,
            fSuspensionCompDamp = 1.3,
            fSuspensionReboundDamp = 2.3,
            fSuspensionUpperLimit = 0.11,
            fSuspensionLowerLimit = -0.13,
            fAntiRollBarForce = 0.80,
            fAntiRollBarBiasFront = 0.50,
            fRollCentreHeightFront = 0.32,
            fRollCentreHeightRear = 0.33
        }
    },

    -- Dinka Blista (Honda Civic FWD Hatchback)
    ['blista'] = {
        archetype = 'compact_fwd',
        category = 'hatchback_fwd',
        drivetrain = 'fwd',
        weightKg = 1180,
        handling = {
            fMass = 1180.0,
            fInitialDragCoeff = 7.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.05 },
            fDriveBiasFront = 1.0,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.25,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 145.0,
            fBrakeForce = 0.70,
            fBrakeBiasFront = 0.60,
            fHandBrakeForce = 0.60,
            fSteeringLock = 39.0,
            fTractionCurveMax = 2.25,
            fTractionCurveMin = 2.05,
            fTractionCurveLateral = 21.0,
            fLowSpeedTractionLossMult = 1.05,
            fTractionBiasFront = 0.54,
            fSuspensionForce = 1.9,
            fSuspensionCompDamp = 1.3,
            fSuspensionReboundDamp = 2.3,
            fSuspensionUpperLimit = 0.10,
            fSuspensionLowerLimit = -0.12,
            fAntiRollBarForce = 0.75,
            fAntiRollBarBiasFront = 0.60,
            fRollCentreHeightFront = 0.33,
            fRollCentreHeightRear = 0.34
        }
    },

    -- Bravado Banshee (Dodge Viper 8.4L V10 RWD Torque Beast)
    ['banshee'] = {
        archetype = 'sports_rwd',
        category = 'sports_v10_rwd',
        drivetrain = 'rwd',
        weightKg = 1520,
        handling = {
            fMass = 1520.0,
            fInitialDragCoeff = 6.6,
            vecCentreOfMassOffset = { x = 0.0, y = -0.05, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.36,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 175.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.52,
            fHandBrakeForce = 0.75,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.25,
            fTractionCurveLateral = 22.5,
            fLowSpeedTractionLossMult = 1.40,
            fTractionBiasFront = 0.46,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 2.9,
            fSuspensionUpperLimit = 0.08,
            fSuspensionLowerLimit = -0.10,
            fAntiRollBarForce = 1.20,
            fAntiRollBarBiasFront = 0.52,
            fRollCentreHeightFront = 0.28,
            fRollCentreHeightRear = 0.30
        }
    },

    -- Pfister Comet (Porsche 911 Rear-Engine Precision Coupe)
    ['comet2'] = {
        archetype = 'sports_rwd',
        category = 'sports_rear_engine',
        drivetrain = 'rwd',
        weightKg = 1480,
        handling = {
            fMass = 1480.0,
            fInitialDragCoeff = 6.4,
            vecCentreOfMassOffset = { x = 0.0, y = -0.12, z = -0.11 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 175.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.50,
            fHandBrakeForce = 0.75,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fTractionCurveLateral = 23.0,
            fLowSpeedTractionLossMult = 1.20,
            fTractionBiasFront = 0.44,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fSuspensionUpperLimit = 0.08,
            fSuspensionLowerLimit = -0.10,
            fAntiRollBarForce = 1.25,
            fAntiRollBarBiasFront = 0.50,
            fRollCentreHeightFront = 0.27,
            fRollCentreHeightRear = 0.28
        }
    },

    -- Truffade Adder (Bugatti Veyron W16 Quad-Turbo AWD Grand Tourer)
    ['adder'] = {
        archetype = 'super_awd',
        category = 'hypercar_awd',
        drivetrain = 'awd',
        weightKg = 1888,
        handling = {
            fMass = 1888.0,
            fInitialDragCoeff = 6.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.12 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.39,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 195.0,
            fBrakeForce = 1.20,
            fBrakeBiasFront = 0.53,
            fHandBrakeForce = 0.80,
            fSteeringLock = 36.0,
            fTractionCurveMax = 2.70,
            fTractionCurveMin = 2.50,
            fTractionCurveLateral = 24.0,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.48,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.3,
            fSuspensionUpperLimit = 0.07,
            fSuspensionLowerLimit = -0.09,
            fAntiRollBarForce = 1.40,
            fAntiRollBarBiasFront = 0.53,
            fRollCentreHeightFront = 0.24,
            fRollCentreHeightRear = 0.25
        }
    },

    -- Pegassi Zentorno (Lamborghini Sesto Elemento / Veneno V12 AWD)
    ['zentorno'] = {
        archetype = 'super_awd',
        category = 'supercar_v12_awd',
        drivetrain = 'awd',
        weightKg = 1350,
        handling = {
            fMass = 1350.0,
            fInitialDragCoeff = 6.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.38,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 188.0,
            fBrakeForce = 1.15,
            fBrakeBiasFront = 0.52,
            fHandBrakeForce = 0.75,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.72,
            fTractionCurveMin = 2.52,
            fTractionCurveLateral = 24.5,
            fLowSpeedTractionLossMult = 1.15,
            fTractionBiasFront = 0.47,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.2,
            fSuspensionUpperLimit = 0.07,
            fSuspensionLowerLimit = -0.09,
            fAntiRollBarForce = 1.45,
            fAntiRollBarBiasFront = 0.52,
            fRollCentreHeightFront = 0.23,
            fRollCentreHeightRear = 0.24
        }
    },

    -- Bravado Buffalo (Dodge Charger HEMI V8 Muscle Sedan)
    ['buffalo'] = {
        archetype = 'muscle_rwd',
        category = 'muscle_sedan',
        drivetrain = 'rwd',
        weightKg = 1820,
        handling = {
            fMass = 1820.0,
            fInitialDragCoeff = 7.4,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.08 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.32,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 158.0,
            fBrakeForce = 0.85,
            fBrakeBiasFront = 0.53,
            fHandBrakeForce = 0.70,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.35,
            fTractionCurveMin = 2.10,
            fTractionCurveLateral = 21.5,
            fLowSpeedTractionLossMult = 1.35,
            fTractionBiasFront = 0.47,
            fSuspensionForce = 2.0,
            fSuspensionCompDamp = 1.4,
            fSuspensionReboundDamp = 2.5,
            fSuspensionUpperLimit = 0.11,
            fSuspensionLowerLimit = -0.13,
            fAntiRollBarForce = 0.90,
            fAntiRollBarBiasFront = 0.54,
            fRollCentreHeightFront = 0.34,
            fRollCentreHeightRear = 0.35
        }
    },

    -- Bravado Buffalo S
    ['buffalo2'] = {
        archetype = 'muscle_rwd',
        category = 'muscle_sedan_sport',
        drivetrain = 'rwd',
        weightKg = 1800,
        handling = {
            fMass = 1800.0,
            fInitialDragCoeff = 7.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.34,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 165.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.45,
            fTractionCurveMin = 2.25,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.05
        }
    },

    -- Obey Tailgater (Audi A6 Quattro Executive Sedan)
    ['tailgater'] = {
        archetype = 'sedan_awd',
        category = 'executive_sedan_awd',
        drivetrain = 'awd',
        weightKg = 1750,
        handling = {
            fMass = 1750.0,
            fInitialDragCoeff = 7.1,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.30,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 160.0,
            fBrakeForce = 0.88,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.40,
            fTractionCurveMin = 2.20,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fAntiRollBarForce = 0.95
        }
    },

    -- Benefactor Schafter (Mercedes E-Class Sedan)
    ['schafter2'] = {
        archetype = 'sedan_rwd',
        category = 'executive_sedan_rwd',
        drivetrain = 'rwd',
        weightKg = 1820,
        handling = {
            fMass = 1820.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.32,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 165.0,
            fBrakeForce = 0.90,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.45,
            fTractionCurveMin = 2.25,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fAntiRollBarForce = 1.0
        }
    },

    -- Benefactor Schafter V12 (Twin-Turbo V12 Beast)
    ['schafter3'] = {
        archetype = 'sports_rwd',
        category = 'executive_v12_sport',
        drivetrain = 'rwd',
        weightKg = 1860,
        handling = {
            fMass = 1860.0,
            fInitialDragCoeff = 6.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.36,
            fDriveInertia = 1.05,
            fInitialDriveMaxFlatVel = 176.0,
            fBrakeForce = 1.02,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.52,
            fTractionCurveMin = 2.32,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.15
        }
    },

    -- Declasse Granger (Chevy Suburban Heavy Duty SUV)
    ['granger'] = {
        archetype = 'suv_awd',
        category = 'fullsize_suv_awd',
        drivetrain = 'awd',
        weightKg = 2650,
        handling = {
            fMass = 2650.0,
            fInitialDragCoeff = 8.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.03 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.25,
            fDriveInertia = 1.1,
            fInitialDriveMaxFlatVel = 145.0,
            fBrakeForce = 0.75,
            fBrakeBiasFront = 0.56,
            fHandBrakeForce = 0.60,
            fSteeringLock = 36.0,
            fTractionCurveMax = 2.20,
            fTractionCurveMin = 1.95,
            fTractionCurveLateral = 20.0,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.50,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 2.9,
            fSuspensionUpperLimit = 0.13,
            fSuspensionLowerLimit = -0.15,
            fAntiRollBarForce = 0.80,
            fAntiRollBarBiasFront = 0.55,
            fRollCentreHeightFront = 0.44,
            fRollCentreHeightRear = 0.45
        }
    },

    -- Benefactor Dubsta (Mercedes G-Class 4x4 Box SUV)
    ['dubsta'] = {
        archetype = 'suv_awd',
        category = 'luxury_offroad_suv',
        drivetrain = 'awd',
        weightKg = 2550,
        handling = {
            fMass = 2550.0,
            fInitialDragCoeff = 8.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.02 },
            fDriveBiasFront = 0.50,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.28,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 150.0,
            fBrakeForce = 0.80,
            fBrakeBiasFront = 0.55,
            fSteeringLock = 36.5,
            fTractionCurveMax = 2.25,
            fTractionCurveMin = 2.00,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.0,
            fSuspensionUpperLimit = 0.14,
            fSuspensionLowerLimit = -0.16,
            fAntiRollBarForce = 0.85
        }
    },

    -- Canis Mesa (Jeep Wrangler 4x4)
    ['mesa'] = {
        archetype = 'offroad',
        category = 'offroad_utility_4x4',
        drivetrain = 'awd',
        weightKg = 1950,
        handling = {
            fMass = 1950.0,
            fInitialDragCoeff = 8.6,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.04 },
            fDriveBiasFront = 0.50,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.27,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 140.0,
            fBrakeForce = 0.72,
            fBrakeBiasFront = 0.55,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.20,
            fTractionCurveMin = 1.95,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fSuspensionUpperLimit = 0.16,
            fSuspensionLowerLimit = -0.18,
            fAntiRollBarForce = 0.70
        }
    },

    -- Vapid Sandking XL (Heavy Duty Monster Pickup)
    ['sandking'] = {
        archetype = 'pickup_4x4',
        category = 'heavy_duty_pickup_4x4',
        drivetrain = 'awd',
        weightKg = 3100,
        handling = {
            fMass = 3100.0,
            fInitialDragCoeff = 9.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.08 },
            fDriveBiasFront = 0.50,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.26,
            fDriveInertia = 1.2,
            fInitialDriveMaxFlatVel = 135.0,
            fBrakeForce = 0.70,
            fBrakeBiasFront = 0.58,
            fSteeringLock = 35.0,
            fTractionCurveMax = 2.15,
            fTractionCurveMin = 1.90,
            fSuspensionForce = 2.8,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fSuspensionUpperLimit = 0.20,
            fSuspensionLowerLimit = -0.22,
            fAntiRollBarForce = 0.75
        }
    },

    -- Annis Elegy RH8 (Nissan GT-R AWD Performance Coupe)
    ['elegy2'] = {
        archetype = 'sports_awd',
        category = 'super_sport_awd',
        drivetrain = 'awd',
        weightKg = 1550,
        handling = {
            fMass = 1550.0,
            fInitialDragCoeff = 6.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.11 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.36,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 178.0,
            fBrakeForce = 1.08,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.65,
            fTractionCurveMin = 2.45,
            fTractionCurveLateral = 23.5,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.48,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.30
        }
    },

    -- Dewbauchee Massacro (Aston Martin Vanquish V12 GT)
    ['massacro'] = {
        archetype = 'sports_rwd',
        category = 'grand_tourer_v12',
        drivetrain = 'rwd',
        weightKg = 1650,
        handling = {
            fMass = 1650.0,
            fInitialDragCoeff = 6.3,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 176.0,
            fBrakeForce = 1.02,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.20
        }
    },

    -- Dinka Jester (Honda NSX Hybrid Sport Coupe)
    ['jester'] = {
        archetype = 'sports_awd',
        category = 'hybrid_sport_awd',
        drivetrain = 'awd',
        weightKg = 1480,
        handling = {
            fMass = 1480.0,
            fInitialDragCoeff = 6.3,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.11 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 175.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.60,
            fTractionCurveMin = 2.40,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.25
        }
    },

    -- Vapid Dominator (Ford Mustang 5.0 V8 Muscle Coupe)
    ['dominator'] = {
        archetype = 'muscle_rwd',
        category = 'muscle_v8_coupe',
        drivetrain = 'rwd',
        weightKg = 1680,
        handling = {
            fMass = 1680.0,
            fInitialDragCoeff = 7.1,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.34,
            fInitialDriveMaxFlatVel = 166.0,
            fBrakeForce = 0.92,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.40,
            fTractionCurveMin = 2.15,
            fLowSpeedTractionLossMult = 1.40,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fAntiRollBarForce = 1.0
        }
    },

    -- Bravado Gauntlet (Dodge Challenger SRT Muscle Coupe)
    ['gauntlet'] = {
        archetype = 'muscle_rwd',
        category = 'muscle_heavy_coupe',
        drivetrain = 'rwd',
        weightKg = 1850,
        handling = {
            fMass = 1850.0,
            fInitialDragCoeff = 7.3,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.08 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 168.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.42,
            fTractionCurveMin = 2.18,
            fLowSpeedTractionLossMult = 1.38,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.05
        }
    },

    -- Karin Kuruma (Mitsubishi Lancer Evolution X AWD Sedan)
    ['kuruma'] = {
        archetype = 'sports_awd',
        category = 'rally_sedan_awd',
        drivetrain = 'awd',
        weightKg = 1520,
        handling = {
            fMass = 1520.0,
            fInitialDragCoeff = 6.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.33,
            fInitialDriveMaxFlatVel = 165.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.30,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.10
        }
    },

    -- Ubermacht Sentinel (BMW 3-Series / M3 Coupe)
    ['sentinel'] = {
        archetype = 'sports_rwd',
        category = 'sports_coupe_rwd',
        drivetrain = 'rwd',
        weightKg = 1580,
        handling = {
            fMass = 1580.0,
            fInitialDragCoeff = 6.7,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.32,
            fInitialDriveMaxFlatVel = 164.0,
            fBrakeForce = 0.92,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.48,
            fTractionCurveMin = 2.28,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fAntiRollBarForce = 1.05
        }
    },

    -- Gallivanter Baller (Range Rover Sport Luxury SUV)
    ['baller'] = {
        archetype = 'suv_awd',
        category = 'luxury_suv_awd',
        drivetrain = 'awd',
        weightKg = 2350,
        handling = {
            fMass = 2350.0,
            fInitialDragCoeff = 7.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.00 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.29,
            fInitialDriveMaxFlatVel = 155.0,
            fBrakeForce = 0.85,
            fBrakeBiasFront = 0.55,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.30,
            fTractionCurveMin = 2.05,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 0.90
        }
    },

    -- Pegassi Toros (Lamborghini Urus Super SUV AWD)
    ['toros'] = {
        archetype = 'suv_awd',
        category = 'super_suv_awd',
        drivetrain = 'awd',
        weightKg = 2200,
        handling = {
            fMass = 2200.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.04 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 8,
            fInitialDriveForce = 0.36,
            fInitialDriveMaxFlatVel = 175.0,
            fBrakeForce = 1.08,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.25
        }
    },

    -- Pfister Neon (Porsche Taycan Dual Motor EV Sedan)
    ['neon'] = {
        archetype = 'sports_awd',
        category = 'electric_sport_awd',
        drivetrain = 'awd',
        weightKg = 2250,
        handling = {
            fMass = 2250.0,
            fInitialDragCoeff = 6.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.15 },
            fDriveBiasFront = 0.48,
            nInitialDriveGears = 2,
            fInitialDriveForce = 0.40,
            fDriveInertia = 0.9,
            fInitialDriveMaxFlatVel = 172.0,
            fBrakeForce = 1.15,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.65,
            fTractionCurveMin = 2.45,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.2,
            fAntiRollBarForce = 1.35
        }
    },

    -- Ocelot Jugular (Jaguar XE SV Project 8 AWD)
    ['jugular'] = {
        archetype = 'sports_awd',
        category = 'track_sedan_awd',
        drivetrain = 'awd',
        weightKg = 1740,
        handling = {
            fMass = 1740.0,
            fInitialDragCoeff = 6.4,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 8,
            fInitialDriveForce = 0.36,
            fInitialDriveMaxFlatVel = 176.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.60,
            fTractionCurveMin = 2.40,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.25
        }
    },

    -- Invetero Coquette (Corvette C7 V8 RWD)
    ['coquette'] = {
        archetype = 'sports_rwd',
        category = 'sports_v8_rwd',
        drivetrain = 'rwd',
        weightKg = 1510,
        handling = {
            fMass = 1510.0,
            fInitialDragCoeff = 6.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 174.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.52,
            fTractionCurveMin = 2.30,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.15
        }
    },

    -- Grotti Carbonizzare (Ferrari F12 Berlinetta / California V12 RWD)
    ['carbonizzare'] = {
        archetype = 'sports_rwd',
        category = 'super_gt_v12',
        drivetrain = 'rwd',
        weightKg = 1580,
        handling = {
            fMass = 1580.0,
            fInitialDragCoeff = 6.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.11 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 180.0,
            fBrakeForce = 1.08,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.60,
            fTractionCurveMin = 2.38,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.25
        }
    },

    -- Overflod Entity XF (Koenigsegg CCX RWD Hypercar)
    ['entityxf'] = {
        archetype = 'super_rwd',
        category = 'hypercar_rwd',
        drivetrain = 'rwd',
        weightKg = 1280,
        handling = {
            fMass = 1280.0,
            fInitialDragCoeff = 5.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 192.0,
            fBrakeForce = 1.18,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.70,
            fTractionCurveMin = 2.48,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.3,
            fAntiRollBarForce = 1.40
        }
    },

    -- Pegassi Vacca (Lamborghini Gallardo V10 AWD)
    ['vacca'] = {
        archetype = 'super_awd',
        category = 'supercar_v10_awd',
        drivetrain = 'awd',
        weightKg = 1490,
        handling = {
            fMass = 1490.0,
            fInitialDragCoeff = 6.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.11 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.36,
            fInitialDriveMaxFlatVel = 180.0,
            fBrakeForce = 1.10,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.65,
            fTractionCurveMin = 2.45,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.30
        }
    },

    -- Grotti Turismo R (LaFerrari Hybrid Hypercar)
    ['turismo2'] = {
        archetype = 'super_rwd',
        category = 'hypercar_hybrid_rwd',
        drivetrain = 'rwd',
        weightKg = 1350,
        handling = {
            fMass = 1350.0,
            fInitialDragCoeff = 5.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.39,
            fInitialDriveMaxFlatVel = 194.0,
            fBrakeForce = 1.20,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.72,
            fTractionCurveMin = 2.50,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.45
        }
    },

    -- Pegassi Osiris (Pagani Huayra V12 AWD Hypercar)
    ['osiris'] = {
        archetype = 'super_awd',
        category = 'hypercar_v12_awd',
        drivetrain = 'awd',
        weightKg = 1320,
        handling = {
            fMass = 1320.0,
            fInitialDragCoeff = 5.9,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.39,
            fInitialDriveMaxFlatVel = 194.0,
            fBrakeForce = 1.20,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.74,
            fTractionCurveMin = 2.52,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.45
        }
    },

    -- Progen T20 (McLaren P1 Hybrid Hypercar)
    ['t20'] = {
        archetype = 'super_awd',
        category = 'hypercar_aero_awd',
        drivetrain = 'awd',
        weightKg = 1350,
        handling = {
            fMass = 1350.0,
            fInitialDragCoeff = 5.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.39,
            fInitialDriveMaxFlatVel = 194.0,
            fBrakeForce = 1.20,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.75,
            fTractionCurveMin = 2.53,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.50
        }
    }
}

SunsetVehicleDynamics.RegisterBatch(SunsetVehicleDynamics.VanillaProfiles, 'vanilla')
