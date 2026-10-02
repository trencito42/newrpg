--[[
    Sunset Vehicle Dynamics - Emergency & Police Vehicle Profiles
    Calibrated for realistic pursuit physics: heavy chassis, upgraded brakes & cooling,
    strong high-speed stability, distinct FWD/RWD/AWD dynamics, and believable body roll.
]]

SunsetVehicleDynamics = SunsetVehicleDynamics or {}
SunsetVehicleDynamics.EmergencyProfiles = {
    -- Vapid Stanier Police Cruiser (4.6L V8 RWD, Heavy Police Sedan)
    ['police'] = {
        archetype = 'emergency_sedan',
        category = 'police_sedan',
        drivetrain = 'rwd',
        weightKg = 1750,
        handling = {
            fMass = 1750.0,
            fInitialDragCoeff = 7.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.33,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 160.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.53,
            fHandBrakeForce = 0.75,
            fSteeringLock = 39.0,
            fTractionCurveMax = 2.45,
            fTractionCurveMin = 2.25,
            fTractionCurveLateral = 22.0,
            fLowSpeedTractionLossMult = 1.15,
            fTractionBiasFront = 0.48,
            fSuspensionForce = 2.0,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fSuspensionUpperLimit = 0.10,
            fSuspensionLowerLimit = -0.13,
            fAntiRollBarForce = 0.95,
            fAntiRollBarBiasFront = 0.55,
            fRollCentreHeightFront = 0.34,
            fRollCentreHeightRear = 0.35
        }
    },

    -- Bravado Buffalo Police Cruiser (5.7L HEMI V8 RWD Pursuit Interceptor)
    ['police2'] = {
        archetype = 'emergency_sedan',
        category = 'police_interceptor',
        drivetrain = 'rwd',
        weightKg = 1800,
        handling = {
            fMass = 1800.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.36,
            fDriveInertia = 1.05,
            fInitialDriveMaxFlatVel = 170.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.54,
            fHandBrakeForce = 0.80,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fTractionCurveLateral = 22.5,
            fLowSpeedTractionLossMult = 1.20,
            fTractionBiasFront = 0.48,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.9,
            fSuspensionUpperLimit = 0.09,
            fSuspensionLowerLimit = -0.12,
            fAntiRollBarForce = 1.1,
            fAntiRollBarBiasFront = 0.55,
            fRollCentreHeightFront = 0.34,
            fRollCentreHeightRear = 0.35
        }
    },

    -- Vapid Torrence Police Interceptor (3.5L TT EcoBoost AWD Pursuit)
    ['police3'] = {
        archetype = 'emergency_sedan',
        category = 'police_interceptor_awd',
        drivetrain = 'awd',
        weightKg = 1820,
        handling = {
            fMass = 1820.0,
            fInitialDragCoeff = 7.1,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 168.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.55,
            fHandBrakeForce = 0.75,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.30,
            fTractionCurveLateral = 22.5,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.50,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.8,
            fSuspensionUpperLimit = 0.10,
            fSuspensionLowerLimit = -0.13,
            fAntiRollBarForce = 1.05,
            fAntiRollBarBiasFront = 0.54,
            fRollCentreHeightFront = 0.34,
            fRollCentreHeightRear = 0.35
        }
    },

    -- Unmarked Stanier Cruiser
    ['police4'] = {
        archetype = 'emergency_sedan',
        category = 'police_unmarked',
        drivetrain = 'rwd',
        weightKg = 1720,
        handling = {
            fMass = 1720.0,
            fInitialDragCoeff = 7.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.33,
            fDriveInertia = 1.0,
            fInitialDriveMaxFlatVel = 162.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 39.0,
            fTractionCurveMax = 2.45,
            fTractionCurveMin = 2.25,
            fSuspensionForce = 2.0,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fAntiRollBarForce = 0.95
        }
    },

    -- Sheriff Stanier Cruiser
    ['sheriff'] = {
        archetype = 'emergency_sedan',
        category = 'sheriff_cruiser',
        drivetrain = 'rwd',
        weightKg = 1760,
        handling = {
            fMass = 1760.0,
            fInitialDragCoeff = 7.3,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.33,
            fInitialDriveMaxFlatVel = 160.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 39.0,
            fTractionCurveMax = 2.45,
            fTractionCurveMin = 2.25,
            fSuspensionForce = 2.0,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.7,
            fAntiRollBarForce = 0.95
        }
    },

    -- Sheriff SUV (Declasse Granger 4x4 Heavy Duty Patrol)
    ['sheriff2'] = {
        archetype = 'emergency_suv',
        category = 'sheriff_suv',
        drivetrain = 'awd',
        weightKg = 2650,
        handling = {
            fMass = 2650.0,
            fInitialDragCoeff = 8.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.02 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.31,
            fDriveInertia = 1.1,
            fInitialDriveMaxFlatVel = 155.0,
            fBrakeForce = 0.88,
            fBrakeBiasFront = 0.56,
            fHandBrakeForce = 0.65,
            fSteeringLock = 36.0,
            fTractionCurveMax = 2.30,
            fTractionCurveMin = 2.05,
            fTractionCurveLateral = 20.0,
            fLowSpeedTractionLossMult = 1.15,
            fTractionBiasFront = 0.50,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.0,
            fSuspensionUpperLimit = 0.14,
            fSuspensionLowerLimit = -0.16,
            fAntiRollBarForce = 0.85,
            fAntiRollBarBiasFront = 0.55,
            fRollCentreHeightFront = 0.45,
            fRollCentreHeightRear = 0.46
        }
    },

    -- FIB Buffalo Cruiser
    ['fbi'] = {
        archetype = 'emergency_sedan',
        category = 'fib_interceptor',
        drivetrain = 'rwd',
        weightKg = 1800,
        handling = {
            fMass = 1800.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.36,
            fDriveInertia = 1.05,
            fInitialDriveMaxFlatVel = 170.0,
            fBrakeForce = 1.05,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.1
        }
    },

    -- FIB Granger SUV
    ['fbi2'] = {
        archetype = 'emergency_suv',
        category = 'fib_suv',
        drivetrain = 'awd',
        weightKg = 2650,
        handling = {
            fMass = 2650.0,
            fInitialDragCoeff = 8.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.02 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.31,
            fInitialDriveMaxFlatVel = 155.0,
            fBrakeForce = 0.88,
            fBrakeBiasFront = 0.56,
            fSteeringLock = 36.0,
            fTractionCurveMax = 2.30,
            fTractionCurveMin = 2.05,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.8,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 0.85
        }
    },

    -- Park Ranger SUV
    ['pranger'] = {
        archetype = 'emergency_suv',
        category = 'ranger_suv',
        drivetrain = 'awd',
        weightKg = 2700,
        handling = {
            fMass = 2700.0,
            fInitialDragCoeff = 8.6,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.03 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.30,
            fInitialDriveMaxFlatVel = 150.0,
            fBrakeForce = 0.85,
            fBrakeBiasFront = 0.56,
            fSteeringLock = 36.0,
            fTractionCurveMax = 2.25,
            fTractionCurveMin = 2.00,
            fSuspensionForce = 2.5,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.1,
            fAntiRollBarForce = 0.80
        }
    },

    -- Brute Ambulance (Heavy Duty Emergency Medic Van)
    ['ambulance'] = {
        archetype = 'van',
        category = 'ambulance',
        drivetrain = 'rwd',
        weightKg = 3800,
        handling = {
            fMass = 3800.0,
            fInitialDragCoeff = 10.5,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.08 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.25,
            fDriveInertia = 1.2,
            fInitialDriveMaxFlatVel = 140.0,
            fBrakeForce = 0.72,
            fBrakeBiasFront = 0.58,
            fHandBrakeForce = 0.55,
            fSteeringLock = 35.0,
            fTractionCurveMax = 2.05,
            fTractionCurveMin = 1.80,
            fTractionCurveLateral = 19.0,
            fLowSpeedTractionLossMult = 1.10,
            fTractionBiasFront = 0.52,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 2.0,
            fSuspensionReboundDamp = 3.2,
            fSuspensionUpperLimit = 0.12,
            fSuspensionLowerLimit = -0.15,
            fAntiRollBarForce = 0.75,
            fAntiRollBarBiasFront = 0.55,
            fRollCentreHeightFront = 0.48,
            fRollCentreHeightRear = 0.50
        }
    },

    -- MTL Fire Truck (Commercial Fire Engine)
    ['firetruk'] = {
        archetype = 'commercial_heavy',
        category = 'fire_engine',
        drivetrain = 'rwd',
        weightKg = 8500,
        handling = {
            fMass = 8500.0,
            fInitialDragCoeff = 14.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.15 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.22,
            fDriveInertia = 1.5,
            fInitialDriveMaxFlatVel = 125.0,
            fBrakeForce = 0.60,
            fBrakeBiasFront = 0.60,
            fHandBrakeForce = 0.50,
            fSteeringLock = 32.0,
            fTractionCurveMax = 1.90,
            fTractionCurveMin = 1.65,
            fTractionCurveLateral = 18.0,
            fLowSpeedTractionLossMult = 1.00,
            fTractionBiasFront = 0.55,
            fSuspensionForce = 3.5,
            fSuspensionCompDamp = 2.5,
            fSuspensionReboundDamp = 3.8,
            fSuspensionUpperLimit = 0.15,
            fSuspensionLowerLimit = -0.18,
            fAntiRollBarForce = 0.70,
            fAntiRollBarBiasFront = 0.55,
            fRollCentreHeightFront = 0.55,
            fRollCentreHeightRear = 0.55
        }
    },

    -- Addon Police Vehicles Fleet
    ['xlsstrpd'] = {
        archetype = 'emergency_suv',
        category = 'police_suv_luxury',
        drivetrain = 'awd',
        weightKg = 2400,
        handling = {
            fMass = 2400.0,
            fInitialDragCoeff = 7.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.02 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.34,
            fInitialDriveMaxFlatVel = 165.0,
            fBrakeForce = 0.98,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.45,
            fTractionCurveMin = 2.25,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.05
        }
    },

    ['carrionpd'] = {
        archetype = 'emergency_sedan',
        category = 'police_interceptor',
        drivetrain = 'rwd',
        weightKg = 1780,
        handling = {
            fMass = 1780.0,
            fInitialDragCoeff = 7.1,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 168.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.30,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.0
        }
    },

    ['omnvenpd'] = {
        archetype = 'emergency_sedan',
        category = 'police_sport_interceptor',
        drivetrain = 'awd',
        weightKg = 1680,
        handling = {
            fMass = 1680.0,
            fInitialDragCoeff = 6.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.10 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.37,
            fInitialDriveMaxFlatVel = 175.0,
            fBrakeForce = 1.08,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.60,
            fTractionCurveMin = 2.40,
            fSuspensionForce = 2.3,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.15
        }
    },

    ['rhinea19xpd'] = {
        archetype = 'emergency_sedan',
        category = 'police_luxury_interceptor',
        drivetrain = 'awd',
        weightKg = 1850,
        handling = {
            fMass = 1850.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.08 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.36,
            fInitialDriveMaxFlatVel = 172.0,
            fBrakeForce = 1.02,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.9,
            fAntiRollBarForce = 1.10
        }
    },

    ['sr8pd'] = {
        archetype = 'emergency_sedan',
        category = 'police_highway_patrol',
        drivetrain = 'rwd',
        weightKg = 1790,
        handling = {
            fMass = 1790.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 170.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.30,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.05
        }
    },

    ['shenronpd'] = {
        archetype = 'emergency_suv',
        category = 'police_suv_pursuit',
        drivetrain = 'awd',
        weightKg = 2500,
        handling = {
            fMass = 2500.0,
            fInitialDragCoeff = 8.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.00 },
            fDriveBiasFront = 0.45,
            nInitialDriveGears = 7,
            fInitialDriveForce = 0.34,
            fInitialDriveMaxFlatVel = 162.0,
            fBrakeForce = 0.95,
            fBrakeBiasFront = 0.55,
            fSteeringLock = 37.0,
            fTractionCurveMax = 2.40,
            fTractionCurveMin = 2.20,
            fSuspensionForce = 2.4,
            fSuspensionCompDamp = 1.7,
            fSuspensionReboundDamp = 3.0,
            fAntiRollBarForce = 1.0
        }
    },

    ['sultlpd'] = {
        archetype = 'emergency_sedan',
        category = 'police_rally_sedan',
        drivetrain = 'awd',
        weightKg = 1580,
        handling = {
            fMass = 1580.0,
            fInitialDragCoeff = 6.9,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.50,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 168.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.54,
            fSteeringLock = 38.0,
            fTractionCurveMax = 2.55,
            fTractionCurveMin = 2.35,
            fSuspensionForce = 2.2,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.10
        }
    },

    ['hyctailpd'] = {
        archetype = 'emergency_sedan',
        category = 'police_pursuit_sedan',
        drivetrain = 'rwd',
        weightKg = 1750,
        handling = {
            fMass = 1750.0,
            fInitialDragCoeff = 7.0,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.09 },
            fDriveBiasFront = 0.0,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.35,
            fInitialDriveMaxFlatVel = 168.0,
            fBrakeForce = 1.00,
            fBrakeBiasFront = 0.53,
            fSteeringLock = 38.5,
            fTractionCurveMax = 2.50,
            fTractionCurveMin = 2.30,
            fSuspensionForce = 2.1,
            fSuspensionCompDamp = 1.6,
            fSuspensionReboundDamp = 2.8,
            fAntiRollBarForce = 1.05
        }
    },

    ['briosoxpd'] = {
        archetype = 'emergency_sedan',
        category = 'police_compact_patrol',
        drivetrain = 'fwd',
        weightKg = 1350,
        handling = {
            fMass = 1350.0,
            fInitialDragCoeff = 7.2,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = -0.07 },
            fDriveBiasFront = 1.0,
            nInitialDriveGears = 5,
            fInitialDriveForce = 0.32,
            fInitialDriveMaxFlatVel = 155.0,
            fBrakeForce = 0.90,
            fBrakeBiasFront = 0.56,
            fSteeringLock = 40.0,
            fTractionCurveMax = 2.40,
            fTractionCurveMin = 2.20,
            fSuspensionForce = 2.0,
            fSuspensionCompDamp = 1.5,
            fSuspensionReboundDamp = 2.6,
            fAntiRollBarForce = 0.90
        }
    },

    ['tragpd'] = {
        archetype = 'emergency_suv',
        category = 'police_truck_heavy',
        drivetrain = 'awd',
        weightKg = 2800,
        handling = {
            fMass = 2800.0,
            fInitialDragCoeff = 8.8,
            vecCentreOfMassOffset = { x = 0.0, y = 0.0, z = 0.03 },
            fDriveBiasFront = 0.40,
            nInitialDriveGears = 6,
            fInitialDriveForce = 0.32,
            fInitialDriveMaxFlatVel = 150.0,
            fBrakeForce = 0.90,
            fBrakeBiasFront = 0.56,
            fSteeringLock = 35.5,
            fTractionCurveMax = 2.30,
            fTractionCurveMin = 2.05,
            fSuspensionForce = 2.6,
            fSuspensionCompDamp = 1.9,
            fSuspensionReboundDamp = 3.2,
            fAntiRollBarForce = 0.95
        }
    }
}

SunsetVehicleDynamics.RegisterBatch(SunsetVehicleDynamics.EmergencyProfiles, 'emergency')
