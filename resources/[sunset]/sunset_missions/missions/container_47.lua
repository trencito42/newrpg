SunsetMissions.RegisterMission('container_47', {
    contact  = 'hank',
    label    = 'Container 47',
    logo     = 'logo_container_47.webp',
    area     = 'Terminal Port',
    cooldown = 2400,

    requirements = {
        level      = 0,
        reputation = 0,
    },

    rewards = {
        min = 5500,
        max = 8000,
    },

    minDurationSec = 150,

    xp = 120,

    stages = {
        'BRIEFING',
        'ENTER_PORT',
        'SEARCH',
        'IDENTIFY',
        'BREAK_SEAL',
        'TAKE_CARGO',
        'ALERT',
        'ESCAPE',
        'DELIVER',
        'COMPLETE',
    },

    portEnterCoords = vector3(1102.0, -3002.0, 5.0),
    portEnterRadius = 30.0,

    -- Physical slot positions -- IDs are assigned randomly each run by the server
    containerSlots = {
        { coords = vector4(1204.0, -3069.0, 5.1, 270.0), row = 'D' },
        { coords = vector4(1218.0, -3069.0, 5.1, 270.0), row = 'D' },
        { coords = vector4(1232.0, -3069.0, 5.1, 270.0), row = 'D' },
        { coords = vector4(1246.0, -3069.0, 5.1, 270.0), row = 'D' },
    },
    containerIds = { 'LS-7193', 'LS-8124', 'LS-0047', 'LS-3319' },
    targetId     = 'LS-0047',

    cargoModel   = 'prop_box_ammo05a',
    deliveryCoords = vector4(1092.0, -3006.0, 5.0, 270.0),

    guardPatrols = {
        { coords = vector4(1210.0, -3060.0, 5.0, 180.0), scenario = 'WORLD_HUMAN_GUARD_STAND',   model = 's_m_m_security_01' },
        { coords = vector4(1240.0, -3080.0, 5.0, 0.0),   scenario = 'WORLD_HUMAN_SMOKING',        model = 's_m_m_security_01' },
        { coords = vector4(1220.0, -3040.0, 5.0, 90.0),  scenario = 'WORLD_HUMAN_CLIPBOARD',      model = 's_m_m_security_01' },
    },

    reinforcementVehicle = 'police',
    reinforcementCoords  = vector4(1150.0, -3020.0, 5.0, 90.0),

    exitPoints = {
        { coords = vector3(1102.0, -3002.0, 5.0), label = 'Main Gate'    },
        { coords = vector3(1282.0, -3080.0, 5.0), label = 'Dock Exit'    },
        { coords = vector3(1170.0, -3120.0, 5.0), label = 'Canal Access' },
    },
})
