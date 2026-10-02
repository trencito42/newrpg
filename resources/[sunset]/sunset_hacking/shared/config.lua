SunsetHacking = SunsetHacking or {}

SunsetHacking.Config = {
    Debug = false,

    -- Camera & Screen Atmosphere (Watch Dogs surveillance aesthetic)
    Effects = {
        TimecycleModifier = 'scanline_cam',       -- Primary modifier (fallback: CAMERA_BW, NG_filmic02, security_cam)
        FallbackTimecycle = 'CAMERA_BW',
        TimecycleStrength = 0.85,
        ScreenEffect = 'FocusIn',                 -- Native animpostfx effect (safe across all clients)
        FadeInDurationMs = 250,
        FadeOutDurationMs = 300,
        HideRadar = true,
        FreezePlayer = true,
        DisableControls = true,
    },

    -- Defaults by difficulty
    Difficulties = {
        easy = {
            timeLimit = 45,        -- seconds (0 for no limit)
            maxTrace = 100,
            allowCancel = true,
            puzzles = { 'easy_01', 'easy_02', 'easy_03' },
        },
        medium = {
            timeLimit = 35,
            maxTrace = 100,
            allowCancel = true,
            puzzles = { 'medium_01', 'medium_02', 'medium_03' },
        },
        hard = {
            timeLimit = 25,
            maxTrace = 100,
            allowCancel = true,
            puzzles = { 'hard_01', 'hard_02' },
        },
    },

    -- Sound Set Mappings (GTA native sounds + web audio synthesized)
    Sounds = {
        enter = { name = 'SELECT', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
        rotate = { name = 'NAV_UP_DOWN', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
        hover = { name = 'NAV_LEFT_RIGHT', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
        propagate = { name = 'PIN_BUTTON', set = 'ATM_SOUNDS' },
        unlock = { name = 'HACKING_CLICK', set = 'MP_PROPERTIES_ELEVATOR_DOORS' },
        target = { name = 'CHECKPOINT_PERFECT', set = 'HUD_MINI_GAME_SOUNDSET' },
        success = { name = 'RACE_PLACED', set = 'HUD_AWARDS' },
        fail = { name = 'Bed', set = 'WastedSounds' },
        cancel = { name = 'CANCEL', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
    },

    -- Port Index Definitions (Standard 4 cardinal directions)
    -- 0: TOP (0, -1)
    -- 1: RIGHT (1, 0)
    -- 2: BOTTOM (0, 1)
    -- 3: LEFT (-1, 0)
    DIR = {
        TOP = 0,
        RIGHT = 1,
        BOTTOM = 2,
        LEFT = 3,
    },

    -- Base ports for each node type at rotation = 0 degrees
    NodeTypes = {
        STRAIGHT = { ports = { 1, 3 }, visual = 'straight' },           -- Left + Right
        CORNER = { ports = { 0, 1 }, visual = 'corner' },               -- Top + Right
        T_JUNCTION = { ports = { 3, 0, 1 }, visual = 't_junction' },    -- Left + Top + Right
        CROSS = { ports = { 0, 1, 2, 3 }, visual = 'cross' },           -- All 4 directions
        ENDPOINT = { ports = { 0 }, visual = 'endpoint' },              -- Top only
        SOURCE = { ports = { 0, 1, 2, 3 }, visual = 'source' },         -- Power emitter
        TARGET = { ports = { 0, 1, 2, 3 }, visual = 'target' },         -- Objective diamond
        LOCKED_JUNCTION = { ports = { 0, 1 }, visual = 'locked' },      -- Unlocks when powered
    }
}
