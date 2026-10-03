-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Fishing Tournament Configuration (shared/config.lua)
-- ═══════════════════════════════════════════════════════════════

SunsetFishingTournament = SunsetFishingTournament or {}

SunsetFishingTournament.Config = {
    -- Default duration in seconds (if not supplied by scheduler)
    duration = 3600,

    -- Primary win metric: 'total_weight' (in kg, internally integer hectograms)
    scoreMode = 'total_weight',

    -- Minimum successful fish catches required to be eligible for placement rewards
    minFish = 3,

    -- Top entries to display in live compact HUD mini-leaderboard
    leaderboardSize = 5,

    -- Tournament join location (Paleto Bay fishing pier)
    joinLocation = vector3(-1593.23, 5207.74, 3.31),
    joinRadius = 45.0,
    interactDistance = 3.5,

    -- Placement rewards (paid strictly by sunset_fishing_tournament)
    rewards = {
        [1] = { cash = 15000, xp = 500, labelKey = "config.fishing_tournament.label.1st_place.f88e6a82", label = '1st Place' },
        [2] = { cash = 7500, xp = 250, labelKey = "config.fishing_tournament.label.2nd_place.7c4c1642", label = '2nd Place' },
        [3] = { cash = 3000, xp = 100, labelKey = "config.fishing_tournament.label.3rd_place.c6ecba6d", label = '3rd Place' },
    },

    -- Throttled sync interval for live HUD updates (ms)
    syncInterval = 1500,

    -- Diagnostic convar for verbose logs
    debugConvar = 'sv_sunset_fishing_tournament_debug',
}
