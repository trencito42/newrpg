--[[
    Sunset Vehicle Dynamics - Addon & Custom Vehicle Profiles
    Normalizes third-party addon vehicle handling into the server's realistic dynamics philosophy,
    fixing extreme pack outliers while preserving each car's unique exotic character.
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}
SunsetVehicleDynamics.AddonProfiles = {
    -- Sunset Addon Pack
    ['tempesta2'] = {
        archetype = 'super_awd',
        category = 'addon_super_v10_awd',
        drivetrain = 'awd',
        weightKg = 1420,
        handling = {
            fMass = 1420.0,
            fInitialDragCoeff = 6.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.12 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 186.0,
            fBrakeForce = 1.15,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.68,
            fTractionCurveMin = 2.48,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.2,
            fAntiRollBarForce = 1.35
        }
    },

    ['sentinel_rts'] = {
        archetype = 'sports_rwd',
        category = 'addon_track_coupe',
        drivetrain = 'rwd',
        weightKg = 1490,
        handling = {
            fMass = 1490.0,
            fInitialDragCoeff = 6.4,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 172.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.58,
            fTractionCurveMin = 2.38,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.25
        }
    },

    ['d7cyp'] = {
        archetype = 'super_rwd',
        category = 'addon_hyper_concept',
        drivetrain = 'rwd',
        weightKg = 1380,
        handling = {
            fMass = 1380.0,
            fInitialDragCoeff = 5.9,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.12 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 190.0,
            fBrakeForce = 1.18,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.70,
            fTractionCurveMin = 2.50,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.3,
            fAntiRollBarForce = 1.40
        }
    },

    ['schlagenstr'] = {
        archetype = 'sports_rwd',
        category = 'addon_gt_v8',
        drivetrain = 'rwd',
        weightKg = 1620,
        handling = {
            fMass = 1620.0,
            fInitialDragCoeff = 6.4,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.36,
            fInitialDriveMaxFlatVel = 176.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.58,
            fTractionCurveMin = 2.36,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.25
        }
    },

    ['cometcup'] = {
        archetype = 'sports_rwd',
        category = 'addon_cup_racer',
        drivetrain = 'rwd',
        weightKg = 1320,
        handling = {
            fMass = 1320.0,
            fInitialDragCoeff = 6.2,
            vecCentreOfMassOffset = { x = 0.0, y = -0.10, z = -0.12 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 180.0,
            fBrakeForce = 1.12,
            fBrakeBiasFront = 0.51,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.68,
            fTractionCurveMin = 2.48,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.3,
            fAntiRollBarForce = 1.40
        }
    },

    ['h4rxst2'] = {
        archetype = 'sports_awd',
        category = 'addon_rally_turbo',
        drivetrain = 'awd',
        weightKg = 1350,
        handling = {
            fMass = 1350.0,
            fInitialDragCoeff = 6.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 170.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.15
        }
    },

    -- Showcase & Pack Hypercars / Supercars
    ['chiron'] = {
        archetype = 'super_awd',
        category = 'hypercar_w16_awd',
        drivetrain = 'awd',
        weightKg = 1995,
        handling = {
            fMass = 1995.0,
            fInitialDragCoeff = 6.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.12 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.41,
            fInitialDriveMaxFlatVel = 205.0,
            fBrakeForce = 1.25,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 36.0,
            fTractionCurveMax = 2.75,
            fTractionCurveMin = 2.55,
            fSuspensionForce = 2.8,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.5,
            fAntiRollBarForce = 1.50
        }
    },

    ['divo'] = {
        archetype = 'super_awd',
        category = 'hypercar_track_w16',
        drivetrain = 'awd',
        weightKg = 1960,
        handling = {
            fMass = 1960.0,
            fInitialDragCoeff = 5.9,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.41,
            fInitialDriveMaxFlatVel = 200.0,
            fBrakeForce = 1.25,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 36.5,
            fTractionCurveMax = 2.78,
            fTractionCurveMin = 2.58,
            fSuspensionForce = 2.9,
            fSuspensionCompDamp = 2.1,
            fSuspensionReboundDamp = 3.6,
            fAntiRollBarForce = 1.55
        }
    },

    ['laferrari'] = {
        archetype = 'super_rwd',
        category = 'hypercar_hybrid_v12',
        drivetrain = 'rwd',
        weightKg = 1430,
        handling = {
            fMass = 1430.0,
            fInitialDragCoeff = 5.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.40,
            fInitialDriveMaxFlatVel = 196.0,
            fBrakeForce = 1.22,
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

    ['senna'] = {
        archetype = 'super_rwd',
        category = 'hypercar_track_aero',
        drivetrain = 'rwd',
        weightKg = 1290,
        handling = {
            fMass = 1290.0,
            fInitialDragCoeff = 5.7,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.14 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.40,
            fInitialDriveMaxFlatVel = 195.0,
            fBrakeForce = 1.25,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.80,
            fTractionCurveMin = 2.60,
            fSuspensionForce = 2.8,
            fSuspensionCompDamp = 2.1,
            fSuspensionReboundDamp = 3.5,
            fAntiRollBarForce = 1.55
        }
    },

    ['p1'] = {
        archetype = 'super_rwd',
        category = 'hypercar_hybrid_tt',
        drivetrain = 'rwd',
        weightKg = 1450,
        handling = {
            fMass = 1450.0,
            fInitialDragCoeff = 5.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.40,
            fInitialDriveMaxFlatVel = 196.0,
            fBrakeForce = 1.22,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.75,
            fTractionCurveMin = 2.53,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.45
        }
    },

    ['svj'] = {
        archetype = 'super_awd',
        category = 'supercar_v12_aero_awd',
        drivetrain = 'awd',
        weightKg = 1525,
        handling = {
            fMass = 1525.0,
            fInitialDragCoeff = 5.9,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.39,
            fInitialDriveMaxFlatVel = 194.0,
            fBrakeForce = 1.20,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.75,
            fTractionCurveMin = 2.55,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.50
        }
    },

    ['huracan'] = {
        archetype = 'super_awd',
        category = 'supercar_v10_awd',
        drivetrain = 'awd',
        weightKg = 1422,
        handling = {
            fMass = 1422.0,
            fInitialDragCoeff = 6.1,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.12 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 184.0,
            fBrakeForce = 1.15,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.68,
            fTractionCurveMin = 2.48,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.2,
            fAntiRollBarForce = 1.35
        }
    },

    ['performante'] = {
        archetype = 'super_awd',
        category = 'supercar_v10_track_awd',
        drivetrain = 'awd',
        weightKg = 1382,
        handling = {
            fMass = 1382.0,
            fInitialDragCoeff = 5.9,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.13 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 188.0,
            fBrakeForce = 1.18,
            fBrakeBiasFront = 0.52,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.72,
            fTractionCurveMin = 2.52,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.3,
            fAntiRollBarForce = 1.45
        }
    },

    ['gt3rs'] = {
        archetype = 'sports_rwd',
        category = 'track_precision_rwd',
        drivetrain = 'rwd',
        weightKg = 1430,
        handling = {
            fMass = 1430.0,
            fInitialDragCoeff = 6.0,
            vecCentreOfMassOffset = { x = 0.0, y = -0.10, z = -0.12 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 184.0,
            fBrakeForce = 1.18,
            fBrakeBiasFront = 0.51,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.75,
            fTractionCurveMin = 2.55,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.45
        }
    },

    ['gt2rs'] = {
        archetype = 'super_rwd',
        category = 'hyper_twin_turbo_rwd',
        drivetrain = 'rwd',
        weightKg = 1470,
        handling = {
            fMass = 1470.0,
            fInitialDragCoeff = 5.9,
            vecCentreOfMassOffset = { x = 0.0, y = -0.10, z = -0.13 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.40,
            fInitialDriveMaxFlatVel = 192.0,
            fBrakeForce = 1.20,
            fBrakeBiasFront = 0.51,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.76,
            fTractionCurveMin = 2.54,
            fSuspensionForce = 2.7,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.4,
            fAntiRollBarForce = 1.45
        }
    },

    ['r8v10'] = {
        archetype = 'super_awd',
        category = 'supercar_v10_awd',
        drivetrain = 'awd',
        weightKg = 1595,
        handling = {
            fMass = 1595.0,
            fInitialDragCoeff = 6.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.11 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 184.0,
            fBrakeForce = 1.12,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.66,
            fTractionCurveMin = 2.46,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.35
        }
    },

    ['gtr'] = {
        archetype = 'sports_awd',
        category = 'super_coupe_awd',
        drivetrain = 'awd',
        weightKg = 1750,
        handling = {
            fMass = 1750.0,
            fInitialDragCoeff = 6.3,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 182.0,
            fBrakeForce = 1.10,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.68,
            fTractionCurveMin = 2.48,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.35
        }
    },

    ['r34'] = {
        archetype = 'sports_awd',
        category = 'jdm_legend_awd',
        drivetrain = 'awd',
        weightKg = 1560,
        handling = {
            fMass = 1560.0,
            fInitialDragCoeff = 6.6,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.34,
            fInitialDriveMaxFlatVel = 172.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.20
        }
    },

    ['r35'] = {
        archetype = 'sports_awd',
        category = 'super_coupe_awd',
        drivetrain = 'awd',
        weightKg = 1750,
        handling = {
            fMass = 1750.0,
            fInitialDragCoeff = 6.3,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.35,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 182.0,
            fBrakeForce = 1.10,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.68,
            fTractionCurveMin = 2.48,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.35
        }
    },

    ['supra98'] = {
        archetype = 'sports_rwd',
        category = 'jdm_legend_2jz',
        drivetrain = 'rwd',
        weightKg = 1510,
        handling = {
            fMass = 1510.0,
            fInitialDragCoeff = 6.6,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.34,
            fInitialDriveMaxFlatVel = 172.0,
            fBrakeForce = 0.98,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.52,
            fTractionCurveMin = 2.30,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.15
        }
    },

    ['m5f90'] = {
        archetype = 'sedan_awd',
        category = 'executive_v8_awd',
        drivetrain = 'awd',
        weightKg = 1970,
        handling = {
            fMass = 1970.0,
            fInitialDragCoeff = 6.6,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.30,
            nInitialDriveGears = 8,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 182.0,
            fBrakeForce = 1.12,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.62,
            fTractionCurveMin = 2.42,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.25
        }
    },

    ['rs6'] = {
        archetype = 'sedan_awd',
        category = 'super_wagon_quattro',
        drivetrain = 'awd',
        weightKg = 2150,
        handling = {
            fMass = 2150.0,
            fInitialDragCoeff = 6.7,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.08 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 8,
            fInitialDriveForce = 0.38,
            fInitialDriveMaxFlatVel = 180.0,
            fBrakeForce = 1.15,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.64,
            fTractionCurveMin = 2.44,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.30
        }
    },

    ['urusa'] = {
        archetype = 'suv_awd',
        category = 'super_suv_v8',
        drivetrain = 'awd',
        weightKg = 2200,
        handling = {
            fMass = 2200.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.04 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 8,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 176.0,
            fBrakeForce = 1.10,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.58,
            fTractionCurveMin = 2.38,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.25
        }
    },

    ['urus'] = {
        archetype = 'suv_awd',
        category = 'super_suv_v8',
        drivetrain = 'awd',
        weightKg = 2200,
        handling = {
            fMass = 2200.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.04 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 8,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 176.0,
            fBrakeForce = 1.10,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 37.5,
            fTractionCurveMax = 2.58,
            fTractionCurveMin = 2.38,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 1.25
        }
    },

    ['g63amg'] = {
        archetype = 'suv_awd',
        category = 'luxury_v8_g_wagon',
        drivetrain = 'awd',
        weightKg = 2560,
        handling = {
            fMass = 2560.0,
            fInitialDragCoeff = 8.6,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.01 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 9,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 162.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.55,
            fSteeringLock = 36.5,
            fTractionCurveMax = 2.35,
            fTractionCurveMin = 2.10,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 0.95
        }
    }
}

SunsetVehicleDynamics.RegisterBatch(SunsetVehicleDynamics.AddonProfiles, 'addon')
