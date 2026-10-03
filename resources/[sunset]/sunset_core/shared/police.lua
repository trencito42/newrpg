Sunset = Sunset or {}

Sunset.Police = {
    summonRange = 125.0,
    arrestRange = 5.0,
    wantedDeathCaptureRange = 125.0,
    jailRadius = 12.0,
    jailCoords = vector4(1641.99, 2570.29, 45.56, 270.0),
    releaseCoords = vector4(1855.68, 2604.45, 45.67, 270.0),
    pdJailPoint = vector3(461.85, -994.55, 24.91),
    bookingPoints = {
        { labelKey = "config.core.label.mrpd_booking_basement.cf736ef5", label = 'MRPD Booking — basement', coords = vector3(461.85, -994.55, 24.91) },
        { labelKey = "config.core.label.bolingbroke_reception_front_processing_gate.a0465898", label = 'Bolingbroke Reception — front processing gate', coords = vector3(1845.91, 2585.84, 45.67) },
    },

    wantedStarSeconds = 15 * 60,

    -- GTA V has five stars, so the SA:MP six-star scale is compressed while
    -- preserving the severe maximum sentence at ★5.
    arrestJailSeconds = {
        [1] = 4 * 60,
        [2] = 8 * 60,
        [3] = 10 * 60,
        [4] = 14 * 60,
        [5] = 18 * 60,
    },

    noSurrenderJailSeconds = {
        [1] = 8 * 60 + 20,
        [2] = 16 * 60 + 40,
        [3] = 25 * 60,
        [4] = 33 * 60 + 20,
        [5] = 50 * 60,
    },

    bounties = {
        [1] = 100,
        [2] = 250,
        [3] = 500,
        [4] = 1000,
        [5] = 2000,
    },

    reasons = {
        speeding = { labelKey = "config.core.label.speeding.ee6178f5", label = 'Speeding', stars = 1, surrenderable = true },
        reckless = { labelKey = "config.core.label.reckless_driving.d0de18c1", label = 'Reckless Driving', stars = 2, surrenderable = true },
        assault = { labelKey = "config.core.label.assault.aa6c6fbb", label = 'Assault', stars = 2, surrenderable = true },
        robbery = { labelKey = "config.core.label.robbery.5e90bcae", label = 'Robbery', stars = 5, surrenderable = false },
        evading = { labelKey = "config.core.label.runner_evading_police.e4cfc8fc", label = 'Runner / Evading Police', stars = 5, surrenderable = false },
        murder = { labelKey = "config.core.label.murder.0c41131e", label = 'Murder', stars = 5, surrenderable = false },
    },

    violations = {
        { code = 'speeding', labelKey = "config.core.label.speeding.ee6178f5", label = 'Speeding', amount = 180 },
        { code = 'reckless', labelKey = "config.core.label.reckless_driving.d0de18c1", label = 'Reckless Driving', amount = 420 },
        { code = 'parking', labelKey = "config.core.label.illegal_parking.1fb2a884", label = 'Illegal Parking', amount = 90 },
        { code = 'redlight', labelKey = "config.core.label.running_red_light.df7fc7fd", label = 'Running Red Light', amount = 240 },
        { code = 'noinsurance', labelKey = "config.core.label.no_insurance.5f0a0d9b", label = 'No Insurance', amount = 600 },
        { code = 'disturbance', labelKey = "config.core.label.public_disturbance.2a1b3d75", label = 'Public Disturbance', amount = 300 },
    },

    confiscatable = {
        lockpick = true,
        gunpowder = true,
        shiv = true,
        sealed_pouch = true,
        chemicals = true,
        ammo_9mm = true,
    },

    radar = {
        mobileRange = 45.0,
        mobileCone = 18.0,
        scanIntervalMs = 750,
        defaultLimitKmh = 90,
        minLimitKmh = 20,
        maxLimitKmh = 250,
        lockCooldownMs = 4000,
        allowedModels = { 'police', 'police2', 'police3', 'police4', 'policeb', 'sheriff', 'sheriff2' },
    },

    fixedRadars = {
        { labelKey = "config.core.label.legion_square_east.2c1f0863", label = 'Legion Square East', coords = vector3(215.4, -1024.8, 29.3), limitKmh = 70, limitMph = 45, radius = 25.0 },
        { labelKey = "config.core.label.del_perro_freeway.6e9becb0", label = 'Del Perro Freeway', coords = vector3(-1470.2, -499.5, 32.8), limitKmh = 120, limitMph = 65, radius = 35.0 },
        { labelKey = "config.core.label.route_68_sandy.d32e9a43", label = 'Route 68 Sandy', coords = vector3(1956.4, 3842.1, 32.2), limitKmh = 90, limitMph = 55, radius = 30.0 },
        { labelKey = "config.core.label.palomino_ave.74ef7788", label = 'Palomino Ave', coords = vector3(-517.8, -610.2, 30.4), limitKmh = 60, limitMph = 40, radius = 25.0 },
        { labelKey = "config.core.label.great_ocean_highway.9dab9fe7", label = 'Great Ocean Highway', coords = vector3(-2825.2, 2352.1, 14.2), limitKmh = 130, limitMph = 80, radius = 40.0 },
        { labelKey = "config.core.label.olympic_freeway.e3d5995b", label = 'Olympic Freeway', coords = vector3(734.2, -1375.4, 26.2), limitKmh = 110, limitMph = 70, radius = 35.0 },
    },
}

function Sunset.GetPoliceReason(code)
    if not code or not Sunset.Police then return nil end
    return Sunset.Police.reasons[string.lower(code)]
end

function Sunset.GetPoliceViolation(code)
    if not code or not Sunset.Police then return nil end
    code = string.lower(code)
    for _, row in ipairs(Sunset.Police.violations or {}) do
        if row.code == code then return row end
    end
    return nil
end

function Sunset.IsConfiscatableItem(item)
    return Sunset.Police and Sunset.Police.confiscatable and Sunset.Police.confiscatable[item] == true
end
