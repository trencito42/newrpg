-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Server Events (shared/config.lua)
-- ═══════════════════════════════════════════════════════════════

SunsetEvents = SunsetEvents or {}

SunsetEvents.Config = {
    -- Event schedule (hour = server hour, 0-23)
    schedule = {
        { hour = 18, type = 'car_meet', label = 'Car Meet', duration = 3600 },
        { hour = 20, type = 'race_night', label = 'Race Night', duration = 3600 },
        { hour = 14, type = 'fishing_tournament', label = 'Fishing Tournament', duration = 3600 },
    },

    -- Event locations
    -- race_night uses the SAME hub as sunset_racing (LS Customs parking).
    -- sunset_events does NOT create a marker there — sunset_racing owns it.
    locations = {
        car_meet = vector3(-1060.00, -2580.00, 20.00),   -- LS Customs parking
        race_night = vector3(-1060.00, -2580.00, 20.00),  -- Race hub (owned by sunset_racing)
        fishing_tournament = vector3(-1593.23, 5207.74, 3.31), -- Paleto Bay
    },

    -- Rewards
    -- Generic non-specialized event reward (e.g. car_meet).
    -- Specialized events (race_night, fishing_tournament) own their placement rewards.
    rewards = {
        car_meet = { cash = 5000, xp = 200 },
    },

    -- Announcement interval (seconds)
    announceInterval = 300,
}
