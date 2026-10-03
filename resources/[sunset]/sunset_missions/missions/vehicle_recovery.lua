SunsetMissions.RegisterMission('vehicle_recovery', {
    contact  = 'rico',
    labelKey = "config.missions.label.hot_wheels.44e001cb", label    = 'Hot Wheels',
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

    minDurationSec = 90,

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
        { model = 'dominator',  labelKey = "config.missions.label.dominator.54ce4a47", label = 'Dominator'  },
        { model = 'sultan',     labelKey = "config.missions.label.sultan.9493f430", label = 'Sultan'      },
        { model = 'jester',     labelKey = "config.missions.label.jester.ff7bac9d", label = 'Jester'      },
        { model = 'elegy2',     labelKey = "config.missions.label.elegy_rh8.9b488d57", label = 'Elegy RH8'   },
        { model = 'comet2',     labelKey = "config.missions.label.comet.e5d98603", label = 'Comet'       },
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
            labelKey = "config.missions.label.rockford_hills.1b6d08a5", label  = 'Rockford Hills',
            center = vector3(340.0, -798.0, 29.0),
            radius = 350.0,
        },
        hawick = {
            labelKey = "config.missions.label.hawick.dd738f95", label  = 'Hawick',
            center = vector3(134.0, -1280.0, 29.0),
            radius = 300.0,
        },
        del_perro = {
            labelKey = "config.missions.label.del_perro.c405d520", label  = 'Del Perro',
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
