SunsetMissions.RegisterMission('vehicle_recovery', {
    contact  = 'rico',
    label    = 'Hot Wheels',
    logo     = 'logo_hot_wheels.webp',
    area     = 'Rockford Hills',
    cooldown = 1800,

    requirements = {
        level      = 0,
        reputation = 0,
    },

    rewards = {
        min = 4200,
        max = 6000,
    },

    xp = 80,

    stages = {
        'BRIEFING',
        'SEARCH_AREA',
        'LOCATE_VEHICLE',
        'STEAL_VEHICLE',
        'PURSUIT',
        'DELIVER',
        'COMPLETE',
    },

    vehicles = {
        { model = 'dominator',  label = 'Dominator'  },
        { model = 'sultan',     label = 'Sultan'      },
        { model = 'jester',     label = 'Jester'      },
        { model = 'elegy2',     label = 'Elegy RH8'   },
        { model = 'comet2',     label = 'Comet'       },
    },

    colors = {
        { name = 'Black',   r = 0,   g = 0,   b = 0   },
        { name = 'White',   r = 255, g = 255, b = 255  },
        { name = 'Red',     r = 200, g = 20,  b = 20   },
        { name = 'Blue',    r = 20,  g = 60,  b = 200  },
        { name = 'Silver',  r = 180, g = 180, b = 180  },
    },

    searchZones = {
        rockford = {
            label  = 'Rockford Hills',
            center = vector3(340.0, -798.0, 29.0),
            radius = 350.0,
        },
        hawick = {
            label  = 'Hawick',
            center = vector3(134.0, -1280.0, 29.0),
            radius = 300.0,
        },
        del_perro = {
            label  = 'Del Perro',
            center = vector3(-1695.0, -582.0, 34.0),
            radius = 300.0,
        },
    },

    deliveryCoords = vector4(130.0, -2010.0, 19.0, 192.0),

    pursuitPeds = {
        { model = 'g_m_y_mexgoon_01' },
        { model = 'g_m_y_mexgoon_02' },
        { model = 'g_m_y_mexgoon_03' },
    },
    pursuitVehicle = 'granger',
    pursuitCount   = 1,
})
