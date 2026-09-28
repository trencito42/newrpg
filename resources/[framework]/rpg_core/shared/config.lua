RPG = RPG or {}

RPG.Config = {
    rpc = {
        timeoutMs = 15000,
        globalWindowMs = 10000,
        globalMax = 80,
        defaultWindowMs = 5000,
        defaultMax = 15,
    },
    auth = {
        usernameMin = 3,
        usernameMax = 24,
        passwordMin = 10,
        passwordMax = 128,
        emailMax = 254,
        attemptsWindowSeconds = 600,
        attemptsMax = 6,
        lockSeconds = 900,
    },
    lifecycle = {
        connected = { authenticating = true, disconnecting = true },
        authenticating = { authenticated = true, disconnecting = true },
        authenticated = { onboarding = true, spawning = true, disconnecting = true },
        onboarding = { spawning = true, disconnecting = true },
        spawning = { active = true, disconnecting = true },
        active = { spawning = true, disconnecting = true },
        disconnecting = {},
    },
    adminLabels = {
        [0] = 'Player',
        [1] = 'Helper',
        [2] = 'Moderator',
        [3] = 'Admin',
        [4] = 'Super Admin',
        [5] = 'Owner',
    },
    models = {
        male = 'a_m_m_bevhills_02',
        female = 'u_f_y_taylor',
    },
}

