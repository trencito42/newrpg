SunsetHacking = SunsetHacking or {}

SunsetHacking.Config = {
    -- Enable debug commands (/testhack, /hack) and verbose logs
    Debug = false,

    -- Camera & Screen Atmosphere (Watch Dogs surveillance aesthetic)
    Effects = {
        TimecycleModifier = 'scanline_cam',       -- Primary modifier (fallback: CAMERA_BW)
        FallbackTimecycle = 'CAMERA_BW',
        TimecycleStrength = 0.85,
        ScreenEffect = 'FocusIn',                 -- Native animpostfx effect
        HideRadar = true,
        FreezePlayer = true,
        DisableControls = true,
    },

    -- Authoritative Difficulty Presets
    Difficulties = {
        easy = {
            timeLimit = 45,             -- seconds
            minRotations = 2,           -- minimum scrambled node rotations away from solution
            scrambleMaxTries = 20,
            templates = { 'easy_01', 'easy_02', 'easy_03' },
        },
        medium = {
            timeLimit = 35,
            minRotations = 4,
            scrambleMaxTries = 30,
            templates = { 'medium_01', 'medium_02', 'medium_03' },
        },
        hard = {
            timeLimit = 25,
            minRotations = 6,
            scrambleMaxTries = 40,
            templates = { 'hard_01', 'hard_02' },
        },
    },

    -- Cardinal Direction Constants
    -- 0: TOP / NORTH    (0, -1)
    -- 1: RIGHT / EAST   (1, 0)
    -- 2: BOTTOM / SOUTH (0, 1)
    -- 3: LEFT / WEST    (-1, 0)
    DIR = {
        TOP = 0,
        RIGHT = 1,
        BOTTOM = 2,
        LEFT = 3,
    },

    -- Base ports for each node type at rotation = 0 degrees
    NodeTypes = {
        STRAIGHT = { ports = { 1, 3 }, rotatable = true, visual = 'straight' },           -- Left + Right
        CORNER = { ports = { 0, 1 }, rotatable = true, visual = 'corner' },               -- Top + Right
        T_JUNCTION = { ports = { 3, 0, 1 }, rotatable = true, visual = 't_junction' },    -- Left + Top + Right
        CROSS = { ports = { 0, 1, 2, 3 }, rotatable = false, visual = 'cross' },          -- All 4 directions (symmetric)
        ENDPOINT = { ports = { 0 }, rotatable = true, visual = 'endpoint' },              -- Top only
        SOURCE = { ports = { 0, 1, 2, 3 }, rotatable = false, visual = 'source' },        -- Power emitter
        TARGET = { ports = { 0, 1, 2, 3 }, rotatable = false, visual = 'target' },        -- Objective diamond
        LOCKED_JUNCTION = { ports = { 0, 1 }, rotatable = true, visual = 'locked' },      -- Unlocks when powered
    },

    -- Sound Set Mappings (GTA frontend native sounds for audio fallback)
    Sounds = {
        enter = { name = 'SELECT', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
        rotate = { name = 'NAV_UP_DOWN', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
        hover = { name = 'NAV_LEFT_RIGHT', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
        propagate = { name = 'PIN_BUTTON', set = 'ATM_SOUNDS' },
        unlock = { name = 'HACKING_CLICK', set = 'MP_PROPERTIES_ELEVATOR_DOORS' },
        target = { name = 'CHECKPOINT_PERFECT', set = 'HUD_MINI_GAME_SOUNDSET' },
        success = { name = 'RACE_PLACED', set = 'HUD_AWARDS' },
        fail = { name = 'Bed', set = 'WastedSounds' },
        timeout = { name = 'Bed', set = 'WastedSounds' },
        cancel = { name = 'CANCEL', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
    },
}
