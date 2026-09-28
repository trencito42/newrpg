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
        [1] = 'Admin Level 1',
        [2] = 'Admin Level 2',
        [3] = 'Admin Level 3',
        [4] = 'Admin Level 4',
        [5] = 'Admin Level 5',
        [6] = 'Admin Level 6',
    },
    helperLabels = {
        [0] = 'Player',
        [1] = 'Helper Level 1',
        [2] = 'Helper Level 2',
        [3] = 'Helper Level 3',
    },
    models = {
        male = 'a_m_m_bevhills_02',
        female = 'u_f_y_taylor',
    },
}
