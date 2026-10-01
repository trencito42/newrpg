Config = Config or {}

Config.CNN = {
    -- Locations where players can post CNN advertisements
    locations = {
        -- Public pavement at the actual Weazel News building entrance.
        { coords = vector3(-598.27, -929.87, 23.86), radius = 4.0, nameKey = 'cnn.location.weazel_hq' },
    },

    -- Economic and timing parameters (SA:MP RPG standard)
    price = 500,               -- Cost in $ per advertisement
    minLength = 5,             -- Minimum character length
    maxLength = 140,           -- Maximum character length
    minDelay = 60,             -- Minimum queue delay before publication (seconds)
    publishInterval = 45,      -- Spacing between successive ads in seconds
    maxQueueDelay = 300,       -- Maximum delay cap (seconds)
    playerCooldown = 120,      -- Seconds cooldown between ad submissions for the same player
    maxPendingQueue = 50,      -- Maximum pending ads allowed in queue

    -- Map Blip settings
    blip = {
        sprite = 459,          -- News / Microphone icon
        color = 2,             -- Green
        scale = 0.8,
        labelKey = 'cnn.blip.announcements',
    },
}
